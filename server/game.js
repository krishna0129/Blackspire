'use strict';
// Blackspire server: the game. It loads the very same rule files the browser uses (js/sim) into a sandbox, runs one
// copy of a floor per party and shared copies (channels) of the root village, and turns the rules' host calls into
// messages for the players in each.
//
// Who decides what: the server runs combat, damage, loot, saves, shops and enhancement. Each browser moves its own
// player (so movement answers at once) and reports where it is; checkMove() accepts a report only if it is reachable
// at that player's speed without passing through a wall.

const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const ROOT=path.join(__dirname,'..');
const SIM_FILES=['util','data','items','rules','world','village','quests','combat','update','floor3','actions'];
const TICK=1/30;          // the rules run 30 times a second
const SNAP_EVERY=2;       // each player gets a snapshot every second tick (15 a second)
const VIEW=360;           // enemies and shots further than this from a player are left out of their snapshot
const PARTY_MAX=4;
const CHANNEL_MAX=30;     // players in one copy of the village before another opens
const NOTICE_TTL=30*60*1000,NOTICE_LEN=60;   // party notices at the guild: how long one stays up, and how long it can be
const SAVE_EVERY=10;      // seconds between writes of changed characters to the database

// The host functions, as the server implements them: everything the rules report becomes an event for the players
// on that floor (or for one player: P, the player the rules are handling right now).
const HOST=`
const __PERSONAL_SFX=new Set(['pick','rare','lvl']);
let __out=[];
const __ev=(to,k,a)=>__out.push({to,k,a});
const __r=v=>Math.round(v*10)/10;
function addNum(x,y,v,kind){__ev(null,'num',[__r(x),__r(y),v,kind]);}
function burst(x,y,n,col,sp){__ev(null,'burst',[__r(x),__r(y),n,col,sp]);}
function part(){}
function vfx(f){__ev(null,'vfx',[f]);}
function sfx(n){__ev(__PERSONAL_SFX.has(n)&&P?P.id:null,'sfx',[n]);}
function shake(v,personal){__ev(personal&&P?P.id:null,'shake',[v]);}
function hitstop(){}
function log(h){if(P)__ev(P.id,'log',[h]);}
function banner(m,s,ms){__ev(null,'banner',[m,s,ms]);}
function bannerMe(m,s,ms){if(P)__ev(P.id,'banner',[m,s,ms]);}
function toast(it){if(P)__ev(P.id,'toast',[it]);}
function bagBadge(){if(P)__ev(P.id,'bagBadge',[]);}
function hurtFlash(){if(P)__ev(P.id,'hurtFlash',[]);}
function bossBar(n){__ev(null,'bossBar',[n]);}
function persist(){if(P)P.dirty=true;}
function onDeath(lost,cp){if(P)__ev(P.id,'onDeath',[lost,cp]);}
function mapChanged(){__ev(null,'gates',[]);}
function __take(){const o=__out;__out=[];return o;}
// const and let values in the rules are not visible from outside the sandbox; these hand them over.
function __lists(){return{SKINS,HAIRS,EYES,OUTFITS,STYLES:STYLES.length,START:[...Object.keys(WTYPES).filter(k=>!WTYPES[k].magic),'grimoire:magic','grimoire:faith']};}
function __actions(){return ACTIONS;}
function __boxSolid(x,y,r){return boxSolid(x,y,r);}
function __nearHome(){return nearHome();}
function __classOf(it){return classOf(it);}
`;
function loadRules(){
  const ctx=vm.createContext({console});
  for(const f of SIM_FILES)vm.runInContext(fs.readFileSync(path.join(ROOT,'js/sim',f+'.js'),'utf8'),ctx,{filename:'js/sim/'+f+'.js'});
  vm.runInContext(HOST,ctx,{filename:'server/host'});
  return ctx;
}

const isNum=v=>typeof v==='number'&&Number.isFinite(v);
const r1=v=>Math.round(v*10)/10;
// A character sheet upload: a PNG of 88 x 78 game pixels, as a data URL, small enough to send to a party.
// SHEET_URL_MAX stays under the socket's message limit (maxPayload in index.js).
const SHEET_URL_MAX=120000,RULES=loadRules();
function validSheet(url){
  if(url===null)return true;
  if(typeof url!=='string'||url.length>SHEET_URL_MAX||!url.startsWith('data:image/png;base64,'))return false;
  const b=Buffer.from(url.slice(22),'base64');   // 88 x 78, or a whole multiple of it for finer art (sheetRatio, data.js)
  return b.length>24&&b.readUInt32BE(0)===0x89504e47&&b.toString('ascii',12,16)==='IHDR'&&RULES.sheetRatio(b.readUInt32BE(16),b.readUInt32BE(20))>0;
}

class Game{
  constructor(db){
    this.db=db;this.R=loadRules();this.parties=new Map();this.byCode=new Map();this.worlds=new Set();this.notices=[];this.nextNotice=1;this.nextPid=1;this.ticks=0;this.saveT=0;
    this.timer=setInterval(()=>this.tick(),1000*TICK);
  }
  stop(){clearInterval(this.timer);for(const p of this.parties.values())for(const m of p.members)this.store(m);}
  // online characters, for the character screen; floor 0 is the village
  charSummary(m){return m.S?{name:m.S.char.name,level:m.S.char.level,floor:m.S.floor==null?1:m.S.floor}:null;}

  /* ---------- characters ---------- */
  createChar(m,o){
    const R=this.R,ok=(list,v)=>list.includes(v);
    const L=R.__lists();
    if(!o||typeof o.name!=='string')return'Pick a name.';
    const name=o.name.replace(/[^\p{L}\p{N} _'-]/gu,'').trim().slice(0,14);
    if(!name)return'Pick a name.';
    const look=o.look||{};
    if(!ok(L.SKINS,look.skin)||!ok(L.HAIRS,look.hair)||!ok(L.EYES,look.eyes)||!Number.isInteger(look.style)||look.style<0||look.style>=L.STYLES)return'That look is not available.';
    if(!ok(L.START,o.weapon)||!ok(L.OUTFITS,o.outfit))return'That outfit or weapon is not available.';
    if(o.custom!=null&&!validSheet(o.custom))return'A character sheet must be a PNG of 88 x 78 pixels, or a whole multiple of that up to x4, under 88 KB.';
    const s=R.newState(name,{skin:look.skin,hair:look.hair,style:look.style,eyes:look.eyes},o.weapon,o.outfit);
    s.char.custom=o.custom||null;
    m.S=JSON.parse(JSON.stringify(s));this.db.saveChar(m.account,m.S);return null;
  }
  store(m){if(m.S){if(m.pl&&!m.pl.dead){m.S.hp=Math.round(m.pl.hp);this.R.storeNeeds(m.pl);}const j=JSON.stringify(m.S);if(j!==m.lastStored){this.db.saveChar(m.account,m.S);m.lastStored=j;}}}

  /* ---------- parties and worlds ----------
     A world is one running copy of a map, and every player in the game is in exactly one (m.w):
       - a party's floor: {kind:'floor', n, seed, G, members}, its own copy, as before;
       - a channel of the root village: {kind:'village', n:0, ch, G, members}, shared by everyone in it, up to
         CHANNEL_MAX players (more channels open as it fills, the way MMO towns do).
     A party (code, leader, members, n) stays together: it travels as one, and its members share a channel. */
  newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;do{c='';for(let i=0;i<6;i++)c+=A[crypto.randomInt(A.length)];}while(this.byCode.has(c));return c;}
  // Puts member m into the game: in a party of their own, where they were last (the village, or a floor).
  play(m){
    if(!m.S)return;
    if(m.party)return this.sendFloor(m);
    const n=m.S.floor===0?0:Math.min(m.S.floor||1,m.S.best||1);
    const p=this.newParty(m,n);this.moveParty(p);
  }
  newParty(m,n){
    const p={id:crypto.randomUUID(),code:this.newCode(),members:[],leader:m,n,seed:crypto.randomInt(2**31),floorW:null};
    this.parties.set(p.id,p);this.byCode.set(p.code,p);p.members.push(m);m.party=p;m.pid=m.pid||this.nextPid++;return p;
  }
  // Takes the party's members out of wherever they are and into p.n: a fresh copy of the floor, or a village channel.
  moveParty(p){
    for(const m of p.members)this.leaveWorld(m);
    let w;
    if(p.n===0)w=this.channelFor(p.members.length);
    else{w={kind:'floor',n:p.n,seed:p.seed+p.n*7919,members:[]};w.G=this.R.genFloor(w.n,w.seed);this.worlds.add(w);}
    p.floorW=w.kind==='floor'?w:null;
    for(const m of p.members)this.enterWorld(w,m);
    for(const m of p.members)this.sendFloor(m);
    this.sendParty(p);
  }
  // A village channel with room for k more: the fullest one that fits, so people meet; a new one if none does.
  channelFor(k){
    let best=null;for(const w of this.worlds)if(w.kind==='village'&&w.members.length+k<=CHANNEL_MAX&&(!best||w.members.length>best.members.length))best=w;
    if(best)return best;
    let ch=1;while([...this.worlds].some(w=>w.kind==='village'&&w.ch===ch))ch++;
    const w={kind:'village',n:0,seed:0,ch,members:[],G:this.R.genVillage()};this.worlds.add(w);return w;
  }
  enterWorld(w,m){
    m.w=w;w.members.push(m);this.placePlayer(w,m);
    for(const q of w.members)if(q!==m)this.sendWorld(q);   // everyone already there learns who arrived
  }
  leaveWorld(m){
    const w=m.w;if(!w)return;
    if(m.pl){m.pl.gone=true;w.G.players=w.G.players.filter(q=>q!==m.pl);}
    w.members=w.members.filter(q=>q!==m);m.w=null;m.pl=null;
    if(!w.members.length)this.worlds.delete(w);
    else for(const q of w.members)this.sendWorld(q);
  }
  removeMember(m){
    const p=m.party;if(!p)return;this.store(m);this.leaveWorld(m);
    p.members=p.members.filter(q=>q!==m);m.party=null;
    if(!p.members.length){this.parties.delete(p.id);this.byCode.delete(p.code);return;}
    if(p.leader===m)p.leader=p.members[0];
    this.sendParty(p);
  }
  join(m,code){
    const p=typeof code==='string'&&this.byCode.get(code.trim().toUpperCase());
    if(!p)return'No party has that code.';
    if(p===m.party)return'You are already in that party.';
    if(p.members.length>=PARTY_MAX)return'That party is full.';
    this.removeMember(m);p.members.push(m);m.party=p;
    this.enterWorld(p.leader.w,m);this.sendFloor(m);this.sendParty(p);return null;
  }
  // Out of the party, into one of your own, staying where you are: the same village channel, or a fresh copy of the floor.
  leave(m){
    if(!m.party||m.party.members.length<2)return'You are not in a party with anyone.';
    const w=m.w,n=m.party.n;this.removeMember(m);m.S.floor=n;
    const p=this.newParty(m,n);
    if(n===0&&this.worlds.has(w)){this.enterWorld(w,m);this.sendFloor(m);this.sendParty(p);}else this.moveParty(p);
    return null;
  }
  partyBest(p){return Math.max(...p.members.map(m=>m.S.best||1));}
  // The whole party moves to n (0 is the village): a fresh copy of a floor, enemies and boss included. cp: arrive at
  // that safe point of the floor (0, its entrance).
  travel(p,n,cp){
    p.n=n;
    for(const m of p.members){m.S.floor=n;m.S.hp=m.pl&&!m.pl.dead?Math.round(m.pl.hp):null;this.R.storeNeeds(m.pl);if(n>0&&cp!=null){m.S.cp=cp;m.S.cpFloor=n;}}
    this.moveParty(p);
  }
  placePlayer(w,m){
    const R=this.R;R.setWorld(w.G);
    m.S.floor=w.n;const pl=R.makePlayer(m.pid,m.S);pl.remote=true;pl.name=m.S.char.name;
    if(m.S.hp!=null&&m.S.hp>0)pl.hp=Math.min(pl.ST.maxHp,m.S.hp);
    m.pl=pl;m.budget=0;m.in={mx:0,my:0,atk:false,block:false};m.pos=null;w.G.players.push(pl);
  }

  /* ---------- party notices ----------
     The guild's other board: a party leader posts a line ("two for floor 3, healer wanted") and anyone online can join
     from it. A notice comes down when its party fills up or breaks up, when its leader takes it down, or after 30 minutes. */
  noticeList(m){
    const now=Date.now();
    this.notices=this.notices.filter(n=>{const p=this.parties.get(n.party);return p&&p.members.length<PARTY_MAX&&now-n.t<NOTICE_TTL;});
    return this.notices.map(n=>{const p=this.parties.get(n.party),L=p.leader.S;
      return{id:n.id,code:p.code,name:L.char.name,level:L.char.level,cls:this.R.__classOf(L.equip.weapon),size:p.members.length,best:this.partyBest(p),
        text:n.text,mins:Math.floor((now-n.t)/60000),own:!!m&&m.party===p};});
  }
  postNotice(m,text){
    const p=m.party;
    if(!m.w||m.w.kind!=='village')return'Party notices are posted at the guild, in the village.';
    if(p.leader!==m)return'Only the party leader posts the party\u2019s notice.';
    if(p.members.length>=PARTY_MAX)return'Your party is already full.';
    text=String(text||'').replace(/[\u0000-\u001f\u007f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,NOTICE_LEN);
    if(!text)return'Write what your party is looking for.';
    this.notices=this.notices.filter(n=>n.party!==p.id);
    this.notices.push({id:this.nextNotice++,party:p.id,text,t:Date.now()});return null;
  }

  /* ---------- messages to players ---------- */
  send(m,o){if(m.ws.readyState===1)m.ws.send(JSON.stringify(o));}
  sendFloor(m){
    const w=m.w,G=w.G;this.sendSave(m,true);   // the save first: the browser needs the character to set up the floor
    this.send(m,{t:'floor',n:w.n,seed:w.seed,ch:w.ch||0,id:m.pid,x:m.pl.x,y:m.pl.y,tp:m.pl.tp,hp:m.pl.hp,gatesOpen:G.gatesOpen,gate:G.gate,boss:G.bossEnt?G.bossEnt.name:null});
    this.sendWorld(m);
  }
  // What other players need to draw you: name, level, look and gear (or your own character sheet).
  look(m){const S=m.S,e=S.equip,w=e.weapon;
    return{id:m.pid,name:S.char.name,level:S.char.level,look:S.char.look,custom:S.char.custom||null,
      weapon:{type:w.type,tint:w.tint,school:w.school||null},armor:e.armor?{type:e.armor.type,tint:e.armor.tint}:null,boots:e.boots?{type:e.boots.type,tint:e.boots.tint}:null};}
  sendParty(p){
    const o={t:'party',code:p.code,leader:p.leader.pid,best:this.partyBest(p),members:p.members.map(m=>this.look(m))};
    for(const m of p.members)this.send(m,o);
  }
  // Everyone else in your world, to draw. A character sheet (up to 120 KB) goes to each player once, not every time.
  sendWorld(m){
    const w=m.w;if(!w)return;m.sheets=m.sheets||new Map();
    const people=w.members.filter(q=>q!==m).map(q=>{const l=this.look(q);if(l.custom){if(m.sheets.get(q.pid)===l.custom)l.custom=true;else m.sheets.set(q.pid,l.custom);}return l;});
    this.send(m,{t:'world',ch:w.ch||0,people});
  }
  sendSave(m,force){const j=JSON.stringify(m.S);if(force||j!==m.lastSent){m.lastSent=j;this.send(m,{t:'save',s:m.S});}}
  snapshot(w,m){
    const G=w.G,me=m.pl,near=e=>Math.abs(e.x-me.x)<VIEW&&Math.abs(e.y-me.y)<VIEW*.7;
    return{t:'s',time:r1(G.time),
      me:{hp:r1(me.hp),mp:r1(me.mp),food:r1(me.food),drink:r1(me.drink),buff:me.buff?[me.buff.id,Math.round(me.buff.t)]:0,x:r1(me.x),y:r1(me.y),tp:me.tp,dead:me.dead,safe:me.safe,locked:me.locked,inv:r1(me.inv),guard:r1(me.guard),
        swing:me.swing?[r1(me.swing.t),r1(me.swing.d),me.swing.hit?1:0]:0,skillCd:r1(me.skillCd),skillMax:r1(me.skillMax),potCd:r1(me.potCd),dodgeCd:r1(me.dodgeCd),mom:me.mom,blocking:!!me.blocking},
      // in a busy village, only the people near you
      pl:G.players.filter(q=>q!==me&&!q.gone&&(w.kind!=='village'||near(q))).map(q=>({id:q.id,x:r1(q.x),y:r1(q.y),dir:q.dir,moving:q.moving,dead:q.dead,inv:r1(q.inv),guard:r1(q.guard),hp:Math.ceil(q.hp),maxHp:q.ST.maxHp,
        swing:q.swing?[r1(q.swing.t),r1(q.swing.d)]:0,blocking:!!q.blocking,dash:!!q.dash})),
      en:G.enemies.filter(e=>!e.dead&&(e.boss||near(e))).map(e=>({id:e.id,type:e.type,x:r1(e.x),y:r1(e.y),dir:e.dir,face:e.face,state:e.state,t:r1(e.t||0),hopT:e.hopT,
        flash:e.flash>0?1:0,stun:e.stun>0?1:0,hurtT:e.hurtT>0?1:0,hp:Math.ceil(e.hp),maxHp:e.maxHp,elite:e.elite,boss:!!e.boss,sprite:e.sprite||null,name:e.name||null,moving:!!e.moving,lunge:e.lunge>0?1:0,ph:r1(e.ph),burrowed:!!e.burrowed,cx:e.state==='channel'?e.cx:undefined,cy:e.state==='channel'?e.cy:undefined})),
      pr:G.proj.filter(near).map(q=>({x:r1(q.x),y:r1(q.y),vx:r1(q.vx),vy:r1(q.vy),c:q.c,arrow:!!q.arrow,a:q.a})),
      pp:G.pproj.filter(near).map(q=>({k:q.k,x:r1(q.x),y:r1(q.y),vx:r1(q.vx),vy:r1(q.vy),a:q.a})),
      dr:G.drops.filter(d=>d.owner===me.id).map(d=>({uid:d.uid,k:d.k,x:r1(d.x),y:r1(d.y),t:r1(d.t),r:d.item?d.item.rarity:0,id:d.k==='mat'?d.id:undefined})),
      co:G.corpses.filter(near).map(c=>({x:r1(c.x),y:r1(c.y)})),
      be:(G.beams||[]).map(B=>({x:r1(B.x),y:r1(B.y),a:B.a,va:B.va,len:B.len,t:r1(B.t)})),
      te:G.tele.map(q=>({x:r1(q.x),y:r1(q.y),r:q.r,t:r1(q.t),d:q.d,line:!!q.line,cone:!!q.cone,a:q.a,len:q.len,half:q.half})),
      g:{open:G.gatesOpen,gate:G.gate,awake:G.bossAwake,boss:G.bossEnt?{hp:Math.ceil(G.bossEnt.hp),maxHp:G.bossEnt.maxHp,dead:G.bossEnt.dead}:null},
      ev:m.out.splice(0)};
  }

  /* ---------- the loop ---------- */
  tick(){
    const R=this.R;this.ticks++;this.saveT+=TICK;const snap=this.ticks%SNAP_EVERY===0,saveNow=this.saveT>=SAVE_EVERY;if(saveNow)this.saveT=0;
    for(const w of this.worlds){
      try{
        R.setWorld(w.G);
        for(const m of w.members){const pl=m.pl;pl.in=m.in;R.setPlayer(pl);this.checkMove(m);}
        R.simUpdate(TICK);
        for(const e of R.__take())for(const m of w.members)if(e.to==null||e.to===m.pid)m.out.push([e.k,e.a]);
        for(const m of w.members){
          if(m.pl.dirty){m.pl.dirty=false;this.store(m);}
          if(snap)this.send(m,this.snapshot(w,m));
          if(this.ticks%15===0){this.sendSave(m);const sig=JSON.stringify(this.look(m));
            if(sig!==m.lookSig){m.lookSig=sig;for(const q of w.members)if(q!==m)this.sendWorld(q);if(m.party)this.sendParty(m.party);}}
          if(saveNow)this.store(m);
        }
      }catch(err){console.error(w.kind,w.ch||w.n,'tick failed:',err);}
    }
  }
  // Accepts the browser's reported position if the player could have got there since the last report: within their
  // speed budget (faster while a dodge-roll the server knows about is under way) and without passing through a wall.
  // A rejected report bumps tp, which tells the browser to jump back to where the server has them.
  checkMove(m){
    const R=this.R,pl=m.pl,q=m.pos;m.pos=null;
    const fast=pl.ST.move,cap=fast*3.3*.25+16;
    m.budget=Math.min(cap,m.budget+fast*(pl.dash?3.6:1.25)*TICK);
    if(!q||pl.dead||q.tp!==pl.tp)return;
    const d=Math.hypot(q.x-pl.x,q.y-pl.y);if(d<.01)return;
    let ok=d<=m.budget;
    for(let i=1,n=Math.ceil(d/3);ok&&i<=n;i++){const u=i/n;if(R.__boxSolid(pl.x+(q.x-pl.x)*u,pl.y+(q.y-pl.y)*u,pl.cr))ok=false;}
    if(ok){pl.x=q.x;pl.y=q.y;m.budget-=d;}else pl.tp++;
  }

  /* ---------- messages from players ---------- */
  handle(m,o){
    const R=this.R,p=m.party,pl=m.pl,w=m.w;
    if(o.t==='play')return this.play(m);
    if(!p||!pl||!w)return;
    R.setWorld(w.G);R.setPlayer(pl);
    switch(o.t){
      case'in':   // held input and where the browser has the player
        m.in={mx:isNum(o.mx)?Math.max(-1,Math.min(1,o.mx)):0,my:isNum(o.my)?Math.max(-1,Math.min(1,o.my)):0,atk:!!o.atk,block:!!o.block};
        if(isNum(o.x)&&isNum(o.y)&&isNum(o.tp))m.pos={x:o.x,y:o.y,tp:o.tp};
        return;
      case'p':    // a one-off press
        pl.in=m.in;
        if(o.a==='atk')pl.atkBuf=.18;else if(o.a==='skill')R.useSkill();else if(o.a==='dodge')R.dodge();else if(o.a==='potion')R.usePotion();else if(o.a==='eat')R.eat();else if(o.a==='drink')R.drink();
        return;
      case'act':{ // gear, attributes, traders, the stash, the forge, the well
        if(!Object.prototype.hasOwnProperty.call(R.__actions(),o.name)||!Array.isArray(o.args)||o.args.length>3)return this.send(m,{t:'ar',id:o.id,r:false});
        if(o.name==='custom'&&!validSheet(o.args[0]))return this.send(m,{t:'ar',id:o.id,r:false,err:'A character sheet must be a PNG of 88 x 78 pixels, or a whole multiple of that up to x4, under 88 KB.'});
        const r=R.runAction(o.name,o.args.map(a=>typeof a==='string'||isNum(a)||a===null?a:null));
        for(const e of R.__take())for(const q of w.members)if(e.to==null||e.to===q.pid)q.out.push([e.k,e.a]);
        this.sendSave(m,true);return this.send(m,{t:'ar',id:o.id,r});}
      case'chamber':{const q=w.G.gates[o.g];if(q&&R.nearGate()===q)R.enterChamber(q);return;}
      case'respawn':if(pl.dead){R.respawnPlayer(pl);this.send(m,{t:'respawned'});}return;
      case'climb':if(w.G.gate&&Math.hypot(w.G.gate.x-pl.x,w.G.gate.y-pl.y)<26)this.travel(p,p.n+1);return;
      case'travel':{   // the Teleport Gate, or a floor's gate: to the village (0) or a floor, and on it a safe point you have visited
        if(p.leader!==m)return this.send(m,{t:'err',msg:'Only the party leader chooses the floor.'});
        if(!Number.isInteger(o.n)||o.n<0||o.n>this.partyBest(p)||o.n===p.n||!R.__nearHome())return;
        const cp=Number.isInteger(o.cp)&&o.cp>0&&((m.S.points||{})[o.n]||[]).includes(o.cp)?o.cp:0;
        return this.travel(p,o.n,cp);}
      case'join':{const err=this.join(m,o.code);if(err)this.send(m,{t:'err',msg:err});return;}
      case'notices':return this.send(m,{t:'notices',list:this.noticeList(m)});
      case'notice':{const err=this.postNotice(m,o.text);if(err)this.send(m,{t:'err',msg:err});return this.send(m,{t:'notices',list:this.noticeList(m)});}
      case'unnotice':this.notices=this.notices.filter(n=>n.party!==p.id);return this.send(m,{t:'notices',list:this.noticeList(m)});
      case'leave':{const err=this.leave(m);if(err)this.send(m,{t:'err',msg:err});return;}
    }
  }
}
module.exports={Game,validSheet,loadRules,TICK};

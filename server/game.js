'use strict';
// Blackspire server: the game. It loads the very same rule files the browser uses (js/sim) into a sandbox, runs one
// floor per party, and turns the rules' host calls into messages for the players on that floor.
//
// Who decides what: the server runs combat, damage, loot, saves, shops and enhancement. Each browser moves its own
// player (so movement answers at once) and reports where it is; checkMove() accepts a report only if it is reachable
// at that player's speed without passing through a wall.

const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');

const ROOT=path.join(__dirname,'..');
const SIM_FILES=['util','data','items','rules','world','combat','update','floor3','actions'];
const TICK=1/30;          // the rules run 30 times a second
const SNAP_EVERY=2;       // each player gets a snapshot every second tick (15 a second)
const VIEW=360;           // enemies and shots further than this from a player are left out of their snapshot
const PARTY_MAX=4;
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
    this.db=db;this.R=loadRules();this.parties=new Map();this.byCode=new Map();this.nextPid=1;this.ticks=0;this.saveT=0;
    this.timer=setInterval(()=>this.tick(),1000*TICK);
  }
  stop(){clearInterval(this.timer);for(const p of this.parties.values())for(const m of p.members)this.store(m);}

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
  charSummary(m){return m.S?{name:m.S.char.name,level:m.S.char.level,floor:m.S.floor||1}:null;}
  store(m){if(m.S){if(m.pl&&!m.pl.dead){m.S.hp=Math.round(m.pl.hp);this.R.storeNeeds(m.pl);}const j=JSON.stringify(m.S);if(j!==m.lastStored){this.db.saveChar(m.account,m.S);m.lastStored=j;}}}

  /* ---------- parties ---------- */
  newCode(){const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;do{c='';for(let i=0;i<6;i++)c+=A[crypto.randomInt(A.length)];}while(this.byCode.has(c));return c;}
  // Puts member m into the game: in a party of their own, on the floor they were last on.
  play(m){
    if(!m.S)return;
    if(m.party)return this.sendFloor(m.party,m);
    const p={id:crypto.randomUUID(),code:this.newCode(),members:[],leader:m,n:Math.min(m.S.floor||1,m.S.best||1),seed:crypto.randomInt(2**31),G:null};
    this.parties.set(p.id,p);this.byCode.set(p.code,p);
    this.addMember(p,m);this.buildWorld(p);
  }
  addMember(p,m){
    p.members.push(m);m.party=p;m.pid=this.nextPid++;
    if(p.G)this.placePlayer(p,m);
  }
  removeMember(m){
    const p=m.party;if(!p)return;this.store(m);
    p.members=p.members.filter(q=>q!==m);if(p.G&&m.pl){m.pl.gone=true;p.G.players=p.G.players.filter(q=>q!==m.pl);}
    m.party=null;m.pl=null;
    if(!p.members.length){this.parties.delete(p.id);this.byCode.delete(p.code);return;}
    if(p.leader===m)p.leader=p.members[0];
    this.sendParty(p);
  }
  join(m,code){
    const p=typeof code==='string'&&this.byCode.get(code.trim().toUpperCase());
    if(!p)return'No party has that code.';
    if(p===m.party)return'You are already in that party.';
    if(p.members.length>=PARTY_MAX)return'That party is full.';
    this.removeMember(m);this.addMember(p,m);this.sendFloor(p,m);this.sendParty(p);return null;
  }
  leave(m){if(!m.party||m.party.members.length<2)return'You are not in a party with anyone.';const n=m.party.n;this.removeMember(m);m.S.floor=n;this.play(m);return null;}
  partyBest(p){return Math.max(...p.members.map(m=>m.S.best||1));}
  // The whole party moves to floor n: a fresh copy of it, enemies and boss included.
  travel(p,n){p.n=n;for(const m of p.members){m.S.floor=n;m.S.hp=m.pl&&!m.pl.dead?Math.round(m.pl.hp):null;this.R.storeNeeds(m.pl);}this.buildWorld(p);}
  buildWorld(p){
    const R=this.R;p.G=R.genFloor(p.n,p.seed+p.n*7919);R.setWorld(p.G);
    for(const m of p.members)this.placePlayer(p,m);
    for(const m of p.members)this.sendFloor(p,m);
    this.sendParty(p);
  }
  placePlayer(p,m){
    const R=this.R;R.setWorld(p.G);
    m.S.floor=p.n;const pl=R.makePlayer(m.pid,m.S);pl.remote=true;pl.name=m.S.char.name;
    if(m.S.hp!=null&&m.S.hp>0)pl.hp=Math.min(pl.ST.maxHp,m.S.hp);
    m.pl=pl;m.budget=0;m.in={mx:0,my:0,atk:false,block:false};m.pos=null;p.G.players.push(pl);
  }

  /* ---------- messages to players ---------- */
  send(m,o){if(m.ws.readyState===1)m.ws.send(JSON.stringify(o));}
  sendFloor(p,m){
    const G=p.G;this.sendSave(m,true);   // the save first: the browser needs the character to set up the floor
    this.send(m,{t:'floor',n:p.n,seed:p.seed+p.n*7919,id:m.pid,x:m.pl.x,y:m.pl.y,tp:m.pl.tp,hp:m.pl.hp,gatesOpen:G.gatesOpen,gate:G.gate,boss:G.bossEnt?G.bossEnt.name:null});
  }
  // What other players need to draw you: name, level, look and gear (or your own character sheet).
  look(m){const S=m.S,e=S.equip,w=e.weapon;
    return{id:m.pid,name:S.char.name,level:S.char.level,look:S.char.look,custom:S.char.custom||null,
      weapon:{type:w.type,tint:w.tint,school:w.school||null},armor:e.armor?{type:e.armor.type,tint:e.armor.tint}:null,boots:e.boots?{type:e.boots.type,tint:e.boots.tint}:null};}
  sendParty(p){
    const o={t:'party',code:p.code,leader:p.leader.pid,best:this.partyBest(p),members:p.members.map(m=>this.look(m))};
    for(const m of p.members){m.lookSig=JSON.stringify(this.look(m));this.send(m,o);}
  }
  sendSave(m,force){const j=JSON.stringify(m.S);if(force||j!==m.lastSent){m.lastSent=j;this.send(m,{t:'save',s:m.S});}}
  snapshot(p,m){
    const G=p.G,me=m.pl,near=e=>Math.abs(e.x-me.x)<VIEW&&Math.abs(e.y-me.y)<VIEW*.7;
    return{t:'s',time:r1(G.time),
      me:{hp:r1(me.hp),mp:r1(me.mp),food:r1(me.food),drink:r1(me.drink),x:r1(me.x),y:r1(me.y),tp:me.tp,dead:me.dead,safe:me.safe,locked:me.locked,inv:r1(me.inv),guard:r1(me.guard),
        swing:me.swing?[r1(me.swing.t),r1(me.swing.d),me.swing.hit?1:0]:0,skillCd:r1(me.skillCd),skillMax:r1(me.skillMax),potCd:r1(me.potCd),dodgeCd:r1(me.dodgeCd),mom:me.mom,blocking:!!me.blocking},
      pl:G.players.filter(q=>q!==me&&!q.gone).map(q=>({id:q.id,x:r1(q.x),y:r1(q.y),dir:q.dir,moving:q.moving,dead:q.dead,inv:r1(q.inv),guard:r1(q.guard),hp:Math.ceil(q.hp),maxHp:q.ST.maxHp,
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
    for(const p of this.parties.values()){
      try{
        R.setWorld(p.G);
        for(const m of p.members){const pl=m.pl;pl.in=m.in;R.setPlayer(pl);this.checkMove(m);}
        R.simUpdate(TICK);
        for(const e of R.__take())for(const m of p.members)if(e.to==null||e.to===m.pid)m.out.push([e.k,e.a]);
        for(const m of p.members){
          if(m.pl.dirty){m.pl.dirty=false;this.store(m);}
          if(snap)this.send(m,this.snapshot(p,m));
          if(this.ticks%15===0){this.sendSave(m);if(JSON.stringify(this.look(m))!==m.lookSig)this.sendParty(p);}
          if(saveNow)this.store(m);
        }
      }catch(err){console.error('party',p.code,'tick failed:',err);}
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
    const R=this.R,p=m.party,pl=m.pl;
    if(o.t==='play')return this.play(m);
    if(!p||!pl)return;
    R.setWorld(p.G);R.setPlayer(pl);
    switch(o.t){
      case'in':   // held input and where the browser has the player
        m.in={mx:isNum(o.mx)?Math.max(-1,Math.min(1,o.mx)):0,my:isNum(o.my)?Math.max(-1,Math.min(1,o.my)):0,atk:!!o.atk,block:!!o.block};
        if(isNum(o.x)&&isNum(o.y)&&isNum(o.tp))m.pos={x:o.x,y:o.y,tp:o.tp};
        return;
      case'p':    // a one-off press
        pl.in=m.in;
        if(o.a==='atk')pl.atkBuf=.18;else if(o.a==='skill')R.useSkill();else if(o.a==='dodge')R.dodge();else if(o.a==='potion')R.usePotion();else if(o.a==='eat')R.eat();else if(o.a==='drink')R.drink();
        return;
      case'act':{ // gear, attributes, the blacksmith
        if(!Object.prototype.hasOwnProperty.call(R.__actions(),o.name)||!Array.isArray(o.args)||o.args.length>3)return this.send(m,{t:'ar',id:o.id,r:false});
        if(o.name==='custom'&&!validSheet(o.args[0]))return this.send(m,{t:'ar',id:o.id,r:false,err:'A character sheet must be a PNG of 88 x 78 pixels, or a whole multiple of that up to x4, under 88 KB.'});
        const r=R.runAction(o.name,o.args.map(a=>typeof a==='string'||isNum(a)||a===null?a:null));
        for(const e of R.__take())for(const q of p.members)if(e.to==null||e.to===q.pid)q.out.push([e.k,e.a]);
        this.sendSave(m,true);return this.send(m,{t:'ar',id:o.id,r});}
      case'chamber':{const q=p.G.gates[o.g];if(q&&R.nearGate()===q)R.enterChamber(q);return;}
      case'respawn':if(pl.dead){R.respawnPlayer(pl);this.send(m,{t:'respawned'});}return;
      case'climb':if(p.G.gate&&Math.hypot(p.G.gate.x-pl.x,p.G.gate.y-pl.y)<26)this.travel(p,p.n+1);return;
      case'travel':
        if(p.leader!==m)return this.send(m,{t:'err',msg:'Only the party leader chooses the floor.'});
        if(!Number.isInteger(o.n)||o.n<1||o.n>this.partyBest(p)||!R.__nearHome())return;
        return this.travel(p,o.n);
      case'join':{const err=this.join(m,o.code);if(err)this.send(m,{t:'err',msg:err});return;}
      case'leave':{const err=this.leave(m);if(err)this.send(m,{t:'err',msg:err});return;}
    }
  }
}
module.exports={Game,validSheet,loadRules,TICK};

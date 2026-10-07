'use strict';
// Blackspire: online play, the browser's side. The server runs the floor; this keeps a copy of it to draw.
//   - Your own player moves here at once (steerPlayer) and its position goes to the server with your input, about
//     30 times a second. The server checks it and, if it disagrees, bumps P.tp and this jumps to where it says.
//   - Everything else (enemies, other players, shots, your loot) comes in snapshots 15 times a second. Enemies and
//     other players are drawn a little in the past (DELAY), sliding between the two snapshots around that moment,
//     so they move smoothly even though updates arrive in steps.
//   - What happened (hits, sounds, messages) comes as events, replayed through the same host functions as
//     single player (host.js).

const DELAY=110;   // ms
const ONLINE_KEY='blackspire.online';
const EVENTS={num:addNum,burst,vfx,sfx,shake,log,banner,toast,bagBadge,hurtFlash,bossBar,onDeath,gates:()=>{}};

Object.assign(NET,{
  on:false,ws:null,party:null,others:[],snaps:[],acts:new Map(),aid:0,sendT:0,last:null,bossName:null,
  // where the server is: the page's own address when the server served it, else what the player typed
  defaultUrl(){return location.protocol.startsWith('http')?`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`:'ws://localhost:8080/ws';},
  saved(){try{return JSON.parse(localStorage.getItem(ONLINE_KEY))||{};}catch(e){return{};}},
  remember(o){try{localStorage.setItem(ONLINE_KEY,JSON.stringify(Object.assign(this.saved(),o)));}catch(e){}},

  // Opens the connection. Resolves once it is open; onAuth gets every login answer.
  connect(url){
    this.close();
    return new Promise((res,rej)=>{
      let ws;try{ws=new WebSocket(url);}catch(e){rej(new Error('That server address is not valid.'));return;}
      this.ws=ws;
      ws.onopen=()=>res();
      ws.onerror=()=>rej(new Error('Could not reach the server at '+url+'.'));
      ws.onmessage=e=>{let o;try{o=JSON.parse(e.data);}catch(err){return;}this.receive(o);};
      ws.onclose=()=>{if(this.ws!==ws)return;const was=this.on;this.ws=null;this.on=false;if(was)showTitle('The connection to the server was lost.');};
    });
  },
  close(){if(this.ws){const ws=this.ws;this.ws=null;ws.close();}this.on=false;this.party=null;this.others=[];this.snaps=[];this.acts.clear();},
  send(o){if(this.ws&&this.ws.readyState===1)this.ws.send(JSON.stringify(o));},
  act(name,args,done){const id=++this.aid;if(done)this.acts.set(id,done);this.send({t:'act',id,name,args:args||[]});},
  // one-off presses; a dodge-roll also starts here at once so it feels instant (the server runs its own)
  press(a){this.send({t:'p',a});if(a==='dodge'&&mode==='play')dodge();},

  receive(o){
    switch(o.t){
      case'auth':case'created':case'kicked':if(this.onMsg)this.onMsg(o);if(o.t==='kicked')showTitle(o.msg);return;
      case'save':{
        S=migrateSave(o.s);if(P){P.S=S;setPlayer(P);calcStats();refreshSprites();refreshHudStatic();bagBadge();}
        if(mode==='panel')renderPanel();return;}
      case'floor':return this.enterFloor(o);
      case's':return this.snapshot(o);
      case'party':this.party=o;this.setOthers();if(mode==='pause')renderParty();return;
      case'ar':{const f=this.acts.get(o.id);this.acts.delete(o.id);if(o.err)log(esc(o.err));if(f)f(o.r);return;}
      case'respawned':if(mode==='dead')mode='play';$('#dead').hidden=true;return;
      case'err':log(esc(o.msg));if(mode==='pause')$('#partyMsg').textContent=o.msg;return;
    }
  },
  // A new floor (first entry, the party travelling, or joining a party): build a local copy of it to draw.
  enterFloor(o){
    this.on=true;this.snaps=[];this.bossName=o.boss;
    G=genFloor(o.n,o.seed);G.enemies=[];G.bossEnt=null;G.drops=[];
    if(o.gatesOpen)openGates();G.mapCv=paintMap(G);G.gate=o.gate;
    P=makePlayer(o.id,S);Object.assign(P,{x:o.x,y:o.y,tp:o.tp,hp:o.hp});G.players=[P];setPlayer(P);
    useCustom(S.char.custom||null);refreshSprites();refreshHudStatic();reveal();drawMini();
    for(const k in hc)delete hc[k];
    for(const id of['#title','#online','#creator','#boss','#dead','#ask','#debug','#pause','#travel','#panel'])$(id).hidden=true;
    $('#hud').hidden=false;$('#toasts').innerHTML='';bagBadge();mode='play';inp.atk=false;
    banner('Floor '+o.n,this.party&&this.party.members.length>1?'Party of '+this.party.members.length:'Online',2400);
    this.setOthers();
  },
  // Avatars for everyone else in the party, rebuilt when their gear or look changes.
  setOthers(){
    if(!this.party||!G)return;const keep=new Map(this.others.map(q=>[q.id,q]));
    this.others=this.party.members.filter(m=>!P||m.id!==P.id).map(m=>{
      const q=keep.get(m.id)||{id:m.id,other:true,x:-999,y:-999,dir:0,walk:0,hp:1,maxHp:1,r:5};
      const sig=JSON.stringify(m);if(q.sig!==sig){q.sig=sig;q.name=m.name;const W=WTYPES[m.weapon.type];
        q.st={ranged:!!W.ranged,magic:!!W.magic,arc:W.arc,thrust:!W.magic&&!W.ranged&&W.arc<50,shield:W.shield||null};
        q.wspr=buildWeapon(m.weapon.type,m.weapon.tint,m.weapon.school);q.bowf=m.weapon.type==='bow'?bowFrames(m.weapon.tint):null;
        q.av=buildAvatar(m.look,{armor:m.armor,boots:m.boots},null);
        if(m.custom)loadImage(m.custom).then(im=>{if(sheetImage(im)&&q.sig===sig)q.av=buildAvatar(m.look,{},im);});}
      return q;});
  },
  snapshot(o){
    if(!G||!P)return;
    o.at=performance.now();this.snaps.push(o);while(this.snaps.length>4)this.snaps.shift();
    const me=o.me;
    if(me.tp>P.tp){P.x=me.x;P.y=me.y;P.tp=me.tp;P.dash=null;}   // the server moved us (a teleport, a respawn, or a refused report)
    Object.assign(P,{hp:me.hp,mp:me.mp,dead:me.dead,safe:me.safe,locked:me.locked,inv:me.inv,guard:me.guard,skillCd:me.skillCd,skillMax:me.skillMax,potCd:me.potCd,mom:me.mom});
    if(!P.dash)P.dodgeCd=Math.max(P.dodgeCd,me.dodgeCd);
    P.swing=me.swing?{t:me.swing[0],d:me.swing[1],a:P.aim,hit:!!me.swing[2]}:null;
    G.proj=o.pr;G.pproj=o.pp;G.tele=o.te;G.corpses=o.co||[];G.beams=o.be||[];
    G.drops=o.dr.map(d=>({k:d.k,x:d.x,y:d.y,t:d.t,id:d.id,uid:d.uid,owner:P.id,item:{rarity:d.r}}));
    const g=o.g;if(g.open&&!G.gatesOpen)openGates();G.gate=g.gate;G.bossAwake=g.awake;
    G.bossEnt=g.boss?Object.assign(G.bossEnt||{},g.boss,{name:this.bossName}):null;
    for(const [k,a] of o.ev){const f=EVENTS[k];if(f)try{f(...a);}catch(e){console.warn('event',k,e);}}
  },
  // Every frame: move yourself, tell the server, and place everything else between the two nearest snapshots.
  frame(dt){
    if(!G||!P)return;
    G.time+=dt;updateCosmetics(dt);
    P.in=mode==='play'&&!P.dead?readInput():{mx:0,my:0,atk:false,block:false};
    if(!P.dead){setPlayer(P);steerPlayer(dt);if(P.swing)P.swing.t+=dt;}
    this.sendT+=dt;if(this.sendT>=1/30){this.sendT=0;this.send({t:'in',mx:P.in.mx,my:P.in.my,atk:P.in.atk,block:P.in.block,x:Math.round(P.x*10)/10,y:Math.round(P.y*10)/10,tp:P.tp});}
    for(const p of G.proj){p.x+=p.vx*dt;p.y+=p.vy*dt;}for(const p of G.pproj){p.x+=p.vx*dt;p.y+=p.vy*dt;}
    for(const t of G.tele)t.t+=dt;for(const d of G.drops)d.t+=dt;if(G.beams)for(const B of G.beams)B.a+=B.va*dt;
    const n=this.snaps.length;if(!n)return;
    const at=performance.now()-DELAY;let a=this.snaps[0],b=this.snaps[n-1];
    for(let i=0;i<n-1;i++)if(this.snaps[i].at<=at&&this.snaps[i+1].at>=at){a=this.snaps[i];b=this.snaps[i+1];break;}
    const u=b.at>a.at?clamp((at-a.at)/(b.at-a.at),0,1):1,prev=new Map(a.en.map(e=>[e.id,e]));
    G.enemies=b.en.map(e=>{const q=prev.get(e.id),c=Object.assign({},e,{r:ETYPES[e.type].r,kx:0,ky:0,bobY:0});
      if(q){c.x=q.x+(e.x-q.x)*u;c.y=q.y+(e.y-q.y)*u;}if(e.boss)c.r=ETYPES.boss.r;return c;});
    const pprev=new Map(a.pl.map(q=>[q.id,q]));
    for(const q of this.others){const s=b.pl.find(x=>x.id===q.id);if(!s){q.x=-999;continue;}const r=pprev.get(q.id)||s;
      const nx=r.x+(s.x-r.x)*u,ny=r.y+(s.y-r.y)*u;q.moving=Math.hypot(nx-q.x,ny-q.y)>.05;if(q.moving)q.walk+=dt*7;q.x=nx;q.y=ny;
      Object.assign(q,{dir:s.dir,dead:s.dead,inv:s.inv,guard:s.guard,hp:s.hp,maxHp:s.maxHp,blocking:s.blocking,dash:s.dash});
      q.swing=s.swing?{t:s.swing[0],d:s.swing[1],a:DIR_ANGLE[s.dir],hit:s.swing[0]>=s.swing[1]*.4}:null;}
  },
});

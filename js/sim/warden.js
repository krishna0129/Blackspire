'use strict';
// Blackspire: the Gate Warden, floor 1's boss (docs/design/bosses.md). A spectral knight, three phases:
//   1. Sweeps and summons (to 70%): sweeping blows to read and dodge, an overhead cleave to parry, a whirl and a leap
//      with ground markers, a charge; it calls skitters.
//   2. The gate opens (70% to 35%): spectral chains whip across the floor in marked lanes, and it blinks to you.
//   3. The split (35%): an echo of it steps out. Together they share its strength (it takes far less damage) until
//      its poise is broken: only the real one has a poise bar. Break it and the echo shatters for good.
// Every blow has a wind-up drawn on the body (e.act, for the renderer: which move, when it began, how long until it
// lands, which way it faces). Area attacks show a marker on the floor; sword blows do not: you read the wind-up.
// It enrages well past a fight's normal length. A wipe resets it (resetBoss, update.js).

const WARDEN={
  p2:.7,p3:.35,                       // the phases begin at these shares of its health
  gap:[1.5,1.2,1],                   // seconds between attacks, by phase
  enrage:900,rage:.72,rageDmg:1.8,     // seconds awake before it enrages; then everything is faster and hits harder
  poise:.3,poiseBack:.06,              // its poise, as a share of its health (sturdier than other bosses'), and how fast it mends (a share a second, once left alone)
  sweep:{wind:.85,arc:150,r:60,dmg:.9,rec:.45},
  back:{wind:.55,arc:150,r:60,dmg:.8,rec:.5},
  cleave:{wind:1.1,arc:56,r:74,dmg:1.9,rec:.95,stun:2.8,poise:.3},   // the blow to parry: parried, it reels and its poise cracks
  whirl:{wind:.95,r:64,dmg:1.2,rec:.6,wave:{at:.55,r:112,inner:54,dmg:.9}},   // (the wave: phase 2 on, safe close in)
  leap:{wind:.95,r:46,dmg:1.3,rec:.55,far:100},
  charge:{wind:.6,len:160,speed:280,t:.5,dmg:1.2,rec:.9},
  chains:{wind:1,lane:26,dmg:.85,every:17,rec:.5},
  blink:{out:.35,dist:42,wind:.55},
  echo:{hp:.04,dmg:.6,shield:.6,back:18,poise:.4},   // its health (of the Warden's), its blows, the damage the Warden shrugs off while it stands, seconds until it re-forms, the Warden's poise in phase 3
  calls:[.85,.55],
};
const wRoom=()=>{const R=G.boss,T=TILE;return{x0:(R.x+1)*T,y0:(R.y+1)*T,x1:(R.x+R.w-1)*T,y1:(R.y+R.h-1)*T};};
function wardenInit(e){
  if(!e.echo){e.maxPoise=e.maxHp*WARDEN.poise;e.poise=e.maxPoise;e.poiseBack=WARDEN.poiseBack;}
  Object.assign(e,{phase:1,seq:0,act:null,actAt:0,actD:0,aimA:0,busy:0,atkT:1.6,wokeAt:G.time,called:0,chainT:WARDEN.chains.every*.6,lastAtk:'',immune:false,gone:false,enraged:false,split:false,echoAt:0,combo:0});
}
// what it is doing, for the renderer: the move, when it began, how long until it lands, where it faces
function wAct(e,k,d,a){e.act=k;e.actAt=G.time;e.actD=d;if(a!=null)e.aimA=a;e.state='act';}
function wDone(e,rec){e.busy=G.time+rec;e.atkT=WARDEN.gap[e.phase-1]*wPace(e);}
const wPace=e=>e.enraged?WARDEN.rage:e.phase===3?.88:1;
const wDmg=e=>e.dmg*(e.enraged?WARDEN.rageDmg:1)*(e.echo?WARDEN.echo.dmg:1);
// A step of a move, later. Dropped if the Warden has died, been reset or been staggered since: a broken poise or a
// parry stops whatever it was doing.
function wStep(e,t,fn){const q=e.seq;after(t,()=>{if(e.dead||e.seq!==q)return;if(e.stun>0||e.staggerT>0){wAbort(e);return;}fn();});}
function wAbort(e){e.seq++;e.busy=0;e.act=null;e.state='chase';e.immune=false;e.gone=false;e.combo=0;}
const wAim=e=>{const t=targetFor(e)||P;return Math.atan2(t.y-e.y,t.x-e.x);};
// everyone within r of the Warden and inside the arc it faces
function wArcHit(e,a,arc,r,dmg,sure){
  let parried=false;
  forPlayers(pl=>{if(pl.dead)return;const d=hyp(pl.x-e.x,pl.y-e.y);if(d>r+pl.r||Math.abs(angDiff(Math.atan2(pl.y-e.y,pl.x-e.x),a))>arc*Math.PI/360)return;
    e.parried=0;hurtPlayer(dmg,e,sure);if(e.parried)parried=true;});
  return parried;
}

/* ---------- the moves ---------- */
// A sweeping blow: no marker, read the shoulder. It follows you through the wind-up until just before it lands.
function wSweep(e,kind,then){
  const M=WARDEN[kind],w=M.wind*wPace(e);wAct(e,kind,w,wAim(e));e.track=G.time+w-.35;
  wStep(e,w,()=>{const a=e.aimA;vfx({k:'eslash',x:e.x,y:e.y,a,arc:M.arc,r:M.r,dir:kind==='back'?-1:1,big:1,c:'#ff9a7a',t:0,d:.22});sfx('heavy');shake(3);
    wArcHit(e,a,M.arc,M.r,wDmg(e)*M.dmg,false);
    if(then)wStep(e,.32,then);else wDone(e,M.rec);});
}
// The overhead cleave, the blow to parry: a long wind-up with a glint on the blade. Parried, the Warden reels for
// seconds and its poise cracks; blocked or dodged, it still leaves it open for a moment.
function wCleave(e){
  const M=WARDEN.cleave,w=M.wind*wPace(e);wAct(e,'cleave',w,wAim(e));e.track=G.time+w-.22;
  vfx({k:'glint',x:e.x,y:e.y,t:0,d:.5});sfx('glint');
  wStep(e,w,()=>{const a=e.aimA;vfx({k:'eslash',x:e.x,y:e.y,a,arc:M.arc,r:M.r,dir:1,big:1,c:'#ffe9a8',t:0,d:.25});vfx({k:'quake',x:e.x+Math.cos(a)*M.r*.7,y:e.y+Math.sin(a)*M.r*.7,r:22,t:0,d:.5});sfx('heavy');shake(6);
    if(wArcHit(e,a,M.arc,M.r,wDmg(e)*M.dmg,false)){   // parried: the opening
      wAbort(e);e.stun=Math.max(e.stun,M.stun);e.act='reel';e.actAt=G.time;e.actD=M.stun;
      addNum(e.x,e.y-e.r-22,'OPENING','crit');if(!e.echo)wearPoise(e,(e.maxPoise||0)*M.poise);return;}
    wDone(e,M.rec);});
}
// The whirl: a marked circle around it. From phase 2 a wave follows, rolling outward: safe close in, at its feet.
function wWhirl(e){
  const M=WARDEN.whirl,w=M.wind*wPace(e),x=e.x,y=e.y;wAct(e,'whirl',w);
  G.tele.push({x,y,r:M.r,t:0,d:w,fn:()=>{if(e.dead||e.seq!==q)return;shake(6);sfx('heavy');vfx({k:'slash',x,y,a:0,arc:360,r:M.r,dir:1,c:'#ff9a7a',t:0,d:.3});vfx({k:'quake',x,y,r:M.r,t:0,d:.5});
    forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-x,pl.y-y)<M.r+pl.r-2)hurtPlayer(wDmg(e)*M.dmg,e,true);});}});
  const q=e.seq,V=M.wave;
  if(e.phase>1&&!e.echo)wStep(e,w,()=>{G.tele.push({x,y,r:V.r,inner:V.inner,t:0,d:V.at,fn:()=>{if(e.dead)return;shake(5);vfx({k:'ring',x,y,r:V.r,c:'#7fe0d0',t:0,d:.4});
      forPlayers(pl=>{const d=hyp(pl.x-x,pl.y-y);if(!pl.dead&&d<V.r+pl.r-2&&d>V.inner)hurtPlayer(wDmg(e)*V.dmg,e,true,null,true);});}});
    wStep(e,V.at,()=>wDone(e,M.rec));});
  else wStep(e,w,()=>wDone(e,M.rec));
}
// The leap: it comes down where you stand (a marked circle). What it does when you keep your distance.
function wLeap(e){
  const M=WARDEN.leap,w=M.wind*wPace(e),t=targetFor(e)||P,R=wRoom(),tx=clamp(t.x,R.x0+10,R.x1-10),ty=clamp(t.y,R.y0+10,R.y1-10);
  wAct(e,'leap',w,Math.atan2(ty-e.y,tx-e.x));e.lx0=e.x;e.ly0=e.y;e.lx1=tx;e.ly1=ty;e.state='leap';
  G.tele.push({x:tx,y:ty,r:M.r,t:0,d:w,fn:()=>{}});
  wStep(e,w,()=>{e.x=tx;e.y=ty;e.state='act';shake(8);sfx('heavy');vfx({k:'quake',x:tx,y:ty,r:M.r,t:0,d:.6});burst(tx,ty,16,'#8a7a6a',90);
    forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<M.r+pl.r-2)hurtPlayer(wDmg(e)*M.dmg,e,true);});wDone(e,M.rec);});
}
// The charge: a marked lane, then it runs it down.
function wCharge(e){
  const M=WARDEN.charge,w=M.wind*wPace(e),a=wAim(e);wAct(e,'brace',w,a);
  G.tele.push({line:true,x:e.x,y:e.y,a,len:M.len,t:0,d:w,fn:()=>{}});
  wStep(e,w,()=>{wAct(e,'charge',M.t,a);e.state='charge';e.t=M.t;e.cvx=Math.cos(a)*M.speed;e.cvy=Math.sin(a)*M.speed;e.chHit=[];});
}
// It calls the swarm.
function wSummon(e){
  wAct(e,'summon',.9);banner('It calls the swarm','',1400);
  wStep(e,.9,()=>{for(let i=0;i<3;i++){const a=Math.random()*TAU,s=makeEnemy(e.calls||'skitter',e.x,e.y,G.hpM,G.dmgM,false);s.state='chase';s.summoned=true;s.kx=Math.cos(a)*120;s.ky=Math.sin(a)*120;G.enemies.push(s);}
    sfx('boss');wDone(e,.5);});
}
// The chains (phase 2 on): spectral chains across the floor, each lane marked before it whips. Two patterns: a rake
// (every other lane across the whole chamber, then the lanes between) and a cross through where you stand, twice.
function wChains(e){
  const M=WARDEN.chains,w=M.wind*wPace(e),R=wRoom(),q=e.seq;wAct(e,'chains',w+.9);e.chainT=M.every;
  const lane=(x,y,a,len,half,d)=>G.tele.push({line:true,x,y,a,len,w:half,t:0,d,fn:()=>{if(e.dead||e.seq!==q)return;vfx({k:'chain',x,y,a,len,w:half,t:0,d:.35});sfx('chain');shake(2);
    const ca=Math.cos(a),sa=Math.sin(a);forPlayers(pl=>{if(pl.dead)return;const dx=pl.x-x,dy=pl.y-y,along=dx*ca+dy*sa,off=Math.abs(-dx*sa+dy*ca);
      if(along>-4&&along<len+4&&off<half+pl.r-2)hurtPlayer(wDmg(e)*M.dmg,e,true,null,true);});}});
  if(Math.random()<.5){   // the rake
    const n=Math.floor((R.y1-R.y0)/M.lane),h=(R.y1-R.y0)/n,first=Math.random()<.5?0:1;
    const row=k=>{for(let i=k;i<n;i+=2)lane(R.x0,R.y0+h*(i+.5),0,R.x1-R.x0,h/2-1,w);};
    row(first);wStep(e,.75*wPace(e),()=>row(1-first));
  }else{   // the cross, twice: each through where its target stands at that moment
    const cross=th=>{const t=targetFor(e)||P,L=420;for(const a of[th,th+Math.PI/2])lane(t.x-Math.cos(a)*L/2,t.y-Math.sin(a)*L/2,a,L,10,w*.85);};
    const th=Math.random()*Math.PI;cross(th);wStep(e,.6*wPace(e),()=>cross(th+Math.PI/4));
    if(e.phase===3)wStep(e,1.2*wPace(e),()=>cross(th));
  }
  wStep(e,w+.9,()=>wDone(e,M.rec));
}
// The blink (phase 2 on): it is gone, then beside you with a blow already on its way.
function wBlink(e,then){
  const M=WARDEN.blink,R=wRoom(),o=M.out*wPace(e);wAct(e,'vanish',o);e.immune=true;
  burst(e.x,e.y-6,14,'#7fe0d0',70);sfx('blink');
  wStep(e,o,()=>{e.gone=true;
    wStep(e,.3,()=>{const t=targetFor(e)||P;let best=null;
      for(let i=0;i<8;i++){const a=(t.aim??0)+Math.PI+(i%2?1:-1)*Math.ceil(i/2)*.7,x=t.x+Math.cos(a)*M.dist,y=t.y+Math.sin(a)*M.dist;   // behind you first, then round to your sides
        if(x>R.x0+8&&x<R.x1-8&&y>R.y0+8&&y<R.y1-8&&!boxSolid(x,y,e.cr)){best=[x,y];break;}}
      if(best){e.x=best[0];e.y=best[1];}
      e.gone=false;e.immune=false;burst(e.x,e.y-6,14,'#7fe0d0',70);sfx('blink');wAct(e,'appear',.3,wAim(e));
      wStep(e,.3,()=>then?then():wSweep(e,'back'));});});
}
// The phases' beginnings: a roar, nothing touches it while it lasts.
function wPhase(e,n){
  e.seq++;e.phase=n;e.immune=true;e.combo=0;wAct(e,'roar',2.2,wAim(e));e.busy=G.time+2.4;
  banner(n===2?'The gate opens':'The Warden splits',n===2?'Chains cross the floor: watch the marks':'Only the true one can be broken. Find it.',3000);sfx('boss');shake(8);
  vfx({k:'ring',x:e.x,y:e.y,r:120,c:'#7fe0d0',t:0,d:.8});
  const q=e.seq;after(2.2,()=>{if(e.dead||e.seq!==q)return;e.immune=false;
    if(n===3){e.split=true;e.maxPoise=e.maxHp*WARDEN.poise*WARDEN.echo.poise;e.poise=e.maxPoise;e.poiseBack=1e-9;wEcho(e);}   // (split, its poise no longer mends: every blow on the true one counts toward finding it)
    wDone(e,.3);});
}
// The echo: the Warden's double. No poise bar, a little health, lighter blows. Struck down, it re-forms, until the
// true Warden's poise is broken.
function wEcho(e){
  if(e.dead||!e.split)return;const R=wRoom(),x=clamp(R.x0+R.x1-e.x,R.x0+16,R.x1-16),y=clamp(R.y0+R.y1-e.y,R.y0+16,R.y1-16);
  const c=makeEnemy('boss',x,y,1,1,false);
  Object.assign(c,{echo:true,of:e.id,ai:'warden',name:e.name,fam:e.fam,sprite:e.sprite,mres:e.mres,summoned:true,noPoise:true,maxPoise:0,hp:Math.round(e.maxHp*WARDEN.echo.hp),dmg:e.dmg,state:'chase'});
  c.maxHp=c.hp;wardenInit(c);c.phase=e.phase;c.enraged=e.enraged;c.atkT=1.2;G.enemies.push(c);burst(x,y-6,18,'#7fe0d0',80);sfx('blink');
}
const wEchoOf=e=>G.enemies.find(c=>c.echo&&c.of===e.id&&!c.dead);
// Its poise broke (wearPoise, combat.js). In phase 3 that is how it is found: the echo shatters, and stays gone.
function wardenBroken(e){
  wAbort(e);if(e.echo||!e.split)return;
  e.split=false;e.maxPoise=e.maxHp*WARDEN.poise;e.poise=e.maxPoise;e.poiseBack=WARDEN.poiseBack;const c=wEchoOf(e);if(c){c.dead=true;burst(c.x,c.y-6,30,'#7fe0d0',120);}
  banner('The echo shatters','It stands alone now',2400);sfx('crit');shake(6);
}
// The echo fell (killEnemy, combat.js): it will be back.
function wardenEchoFell(c){const e=G.enemies.find(b=>b.id===c.of&&!b.dead);if(e&&e.split)e.echoAt=G.time+WARDEN.echo.back;}
// While its echo stands, the Warden shrugs off most of what hits it (damageEnemy, combat.js).
const wardenShield=e=>e.ai==='warden'&&!e.echo&&e.split&&wEchoOf(e)?1-WARDEN.echo.shield:1;

/* ---------- its mind ---------- */
function wardenAI(e,dt,d,ux,uy){
  const W=WARDEN;if(e.phase==null)wardenInit(e);
  if(e.state==='leap'){const p=clamp((G.time-e.actAt)/e.actD,0,1),s=p*p*(3-2*p);e.x=e.lx0+(e.lx1-e.lx0)*s;e.y=e.ly0+(e.ly1-e.ly0)*s;return;}
  if(e.state==='charge'){
    moveEnt(e,e.cvx*dt,e.cvy*dt);e.t-=dt;
    forPlayers(pl=>{if(!pl.dead&&!e.chHit.includes(pl.id)&&hyp(pl.x-e.x,pl.y-e.y)<e.r+pl.r+2){e.chHit.push(pl.id);hurtPlayer(wDmg(e)*W.charge.dmg,e,true);}});
    if(Math.random()<.6)part({x:e.x+rand(-8,8),y:e.y+rand(-4,10),vx:0,vy:0,t:0,d:.3,c:'#3a1d25'});
    if(e.t<=0){e.state='act';wDone(e,W.charge.rec);}
    return;
  }
  if(e.state==='act'){
    if(G.time<e.track)e.aimA=wAim(e);   // a wind-up follows you until just before the blow
    if(e.busy&&G.time>=e.busy){e.state='chase';e.act=null;e.busy=0;}
    return;
  }
  if(e.echo){const b=G.enemies.find(o=>o.id===e.of);if(!b||b.dead||!b.split){e.dead=true;return;}e.phase=b.phase;e.enraged=b.enraged;}
  else{
    // the enrage, the phases, the echo re-forming, the swarm
    if(!e.enraged&&G.time-e.wokeAt>W.enrage){e.enraged=true;banner('The Warden rages','End it, or be ended',2600);sfx('boss');shake(8);}
    const hp=e.hp/e.maxHp;
    if(e.phase===1&&hp<=W.p2)return wPhase(e,2);
    if(e.phase===2&&hp<=W.p3)return wPhase(e,3);
    if(e.split&&!wEchoOf(e)&&e.echoAt&&G.time>=e.echoAt){e.echoAt=0;wEcho(e);}
    if(e.called<W.calls.length&&hp<=W.calls[e.called]&&e.phase<3){e.called++;return wSummon(e);}
    e.chainT-=dt;
  }
  const reach=e.r+P.r+18;
  if(d>reach)walkEnt(e,ux*e.speed*dt,uy*e.speed*dt);
  e.aimA=Math.atan2(uy,ux);e.atkT-=dt;if(e.atkT>0)return;
  // what next: by how far you are, never the same move twice running
  const near=d<W.sweep.r+4,far=d>W.leap.far,opts=[];
  const add=(k,w)=>{if(k!==e.lastAtk&&w>0)opts.push([k,w]);};
  if(e.echo){add('sweep',near?5:0);add('combo',near?3:0);add('whirl',near?2:0);add('leap',far?4:1);if(!opts.length)return;}
  else if(e.phase===1){add('sweep',near?4:0);add('combo',near?2.5:0);add('cleave',near?2.5:d<90?1:0);add('whirl',near?2:0);add('charge',near?.6:far?4:2);add('leap',far?5:d>70?1.5:0);}
  else{if(e.chainT<=0)return e.lastAtk='chains',wChains(e);
    add('sweep',near?3:0);add('combo',near?3:0);add('cleave',near?2.5:d<90?1:0);add('whirl',near?2:0);add('chains',1.6);add('blink',far?5:near?.8:2.5);add('leap',far?2.5:d>70?1:0);add('charge',far?1:0);}
  if(!opts.length){if(d<=reach)opts.push(['sweep',1]);else return;}   // still closing in
  let r=Math.random()*opts.reduce((a,o)=>a+o[1],0),k=opts[0][0];for(const o of opts){r-=o[1];if(r<=0){k=o[0];break;}}
  e.lastAtk=k;
  if(k==='sweep')wSweep(e,'sweep');
  else if(k==='combo')wSweep(e,'sweep',()=>wSweep(e,'back',e.phase===3&&!e.echo?()=>wCleave(e):null));   // phase 3: the string ends in the cleave
  else if(k==='cleave')wCleave(e);
  else if(k==='whirl')wWhirl(e);
  else if(k==='leap')wLeap(e);
  else if(k==='charge')wCharge(e);
  else if(k==='chains')wChains(e);
  else if(k==='blink')wBlink(e);
}

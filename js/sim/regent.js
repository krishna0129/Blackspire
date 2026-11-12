'use strict';
// Blackspire: the Bone Regent, floor 2's boss (docs/design/bosses.md). A dead king behind a tower shield, three phases:
//   1. The shield wall (to 70%): while it walks its shield is up, and blows from the front do almost nothing. It lowers
//      it to strike, so its own attacks are your openings; it turns slowly, so its back is another. Its overhead
//      strike glints: parry it and it reels, shield down, for seconds.
//   2. The guard (70% to 35%): it calls skeletons to stand with it. The call is a long channel with its shield down
//      and its ward against magic gone. Bone lanes cross the floor; it charges behind its shield.
//   3. The broken throne (35%): the shield shatters. No more wall, but it is faster, and grave spikes burst from the
//      floor: under your feet, and in rings that leave gaps to stand in.
// It uses the Warden's plumbing (wAct, wStep, wAbort, wAim, wArcHit, wRoom: warden.js) and its renderer (e.act).

const REGENT={
  p2:.7,p3:.35,gap:[1.5,1.25,.95],
  enrage:900,rage:.72,rageDmg:1.8,
  poise:.3,poiseBack:.06,
  guard:{arc:150,take:.12,turn:1.9,behind:1.6},   // the shield: the arc it covers, the share of a blow that gets through, how fast it turns (radians a second), and how long it lets you stand behind it
  swing:{wind:.8,arc:130,r:58,dmg:.95,rec:.9},
  bash:{wind:.5,arc:90,r:44,dmg:.6,rec:.7,kb:150},
  strike:{wind:1.15,arc:56,r:72,dmg:2,rec:1,stun:3,poise:.3},      // the blow to parry
  spin:{wind:.6,r:56,dmg:1,rec:.8},                                // what standing behind it too long earns
  volley:{wind:.75,n:7,half:.5,speed:140,dmg:.75,rec:.7,far:90},
  call:{wind:3,n:2,rec:.6,at:[.7,.5]},                             // the channel: three seconds open; then the guard stands
  cross:{wind:1,dmg:.9,rec:.5,every:15},
  charge:{wind:.7,len:170,speed:260,t:.55,dmg:1.3,rec:1},
  spikes:{n:4,r:19,wind:.62,gap:.3,dmg:1.1,rec:.5},
  rings:{wind:1.05,dmg:1.2,rec:.6,every:13},
};
function regentInit(e){
  e.maxPoise=e.maxHp*REGENT.poise;e.poise=e.maxPoise;e.poiseBack=REGENT.poiseBack;e.baseMres=e.baseMres??e.mres;e.mres=e.baseMres;
  Object.assign(e,{phase:1,seq:0,act:null,actAt:0,actD:0,aimA:e.aimA||Math.PI/2,busy:0,atkT:1.8,wokeAt:G.time,called:0,crossT:REGENT.cross.every*.5,ringT:5,lastAtk:'',immune:false,gone:false,enraged:false,guard:false,shield:true,behindT:0});
}
const rPace=e=>e.enraged?REGENT.rage:e.phase===3?.82:1;
const rDmg=e=>e.dmg*(e.enraged?REGENT.rageDmg:1);
function rDone(e,rec){e.busy=G.time+rec;e.atkT=REGENT.gap[e.phase-1]*rPace(e);}
// The shield wall: how much of a blow gets through (damageEnemy). from: where the blow came from.
function regentGuard(e,o){
  if(e.ai!=='regent'||!e.guard||e.stun>0||e.staggerT>0)return 1;
  const fx=o.fx??P.x,fy=o.fy??P.y;if(Math.abs(angDiff(Math.atan2(fy-e.y,fx-e.x),e.aimA))>REGENT.guard.arc*Math.PI/360)return 1;
  if(G.time-(e.clangAt||0)>.25){e.clangAt=G.time;sfx('block');addNum(e.x,e.y-e.r-12,'BLOCKED','evade');vfx({k:'hit',x:e.x+Math.cos(e.aimA)*e.r,y:e.y+Math.sin(e.aimA)*e.r,a:e.aimA+Math.PI,c:'#cfd6e0',w:.8,t:0,d:.16});}
  return REGENT.guard.take;
}
function regentBroken(e){wAbort(e);e.guard=false;}

/* ---------- the moves ---------- */
function rSwing(e){
  const M=REGENT.swing,w=M.wind*rPace(e);wAct(e,'sweep',w,e.aimA);e.track=G.time+w-.35;
  wStep(e,w,()=>{const a=e.aimA;vfx({k:'eslash',x:e.x,y:e.y,a,arc:M.arc,r:M.r,dir:1,big:1,c:'#e8dfb8',t:0,d:.22});sfx('heavy');shake(3);
    wArcHit(e,a,M.arc,M.r,rDmg(e)*M.dmg,false);
    if(e.phase===3&&Math.random()<.6)wStep(e,.3,()=>rBash(e));else rDone(e,M.rec);});
}
// The shield bash: quick, short, and it throws you back.
function rBash(e){
  const M=REGENT.bash,w=M.wind*rPace(e);wAct(e,'bash',w,wAim(e));e.track=G.time+w-.2;
  wStep(e,w,()=>{const a=e.aimA;vfx({k:'eslash',x:e.x,y:e.y,a,arc:M.arc,r:M.r,dir:-1,big:1,c:'#cfd6e0',t:0,d:.16});sfx('block');shake(3);
    forPlayers(pl=>{if(pl.dead)return;const d=hyp(pl.x-e.x,pl.y-e.y);if(d>M.r+pl.r||Math.abs(angDiff(Math.atan2(pl.y-e.y,pl.x-e.x),a))>M.arc*Math.PI/360)return;
      const hp=pl.hp;hurtPlayer(rDmg(e)*M.dmg,e,false);if(pl.hp<hp){pl.kx=(pl.kx||0)+Math.cos(a)*M.kb;pl.ky=(pl.ky||0)+Math.sin(a)*M.kb;}});
    rDone(e,M.rec);});
}
// The overhead strike, the blow to parry: the blade glints. Parried, it reels with its shield down and its poise cracks.
function rStrike(e){
  const M=REGENT.strike,w=M.wind*rPace(e);wAct(e,'cleave',w,wAim(e));e.track=G.time+w-.22;
  vfx({k:'glint',x:e.x,y:e.y,t:0,d:w});sfx('glint');
  wStep(e,w,()=>{const a=e.aimA;vfx({k:'eslash',x:e.x,y:e.y,a,arc:M.arc,r:M.r,dir:1,big:1,c:'#fff3c0',t:0,d:.25});sfx('heavy');shake(6);
    vfx({k:'quake',x:e.x+Math.cos(a)*M.r*.7,y:e.y+Math.sin(a)*M.r*.7,r:22,t:0,d:.5});
    if(wArcHit(e,a,M.arc,M.r,rDmg(e)*M.dmg,false)){wAbort(e);e.stun=Math.max(e.stun||0,M.stun);e.act='reel';e.actAt=G.time;e.guard=false;wearPoise(e,e.maxPoise*M.poise);
      addNum(e.x,e.y-e.r-18,'OPEN','crit');return;}
    rDone(e,M.rec);});
}
// You stood behind it too long: it wheels round with its blade out. A marked circle.
function rSpin(e){
  const M=REGENT.spin,w=M.wind*rPace(e);wAct(e,'whirl',w);e.behindT=0;
  G.tele.push({x:e.x,y:e.y,r:M.r,t:0,d:w,fn:()=>{}});
  wStep(e,w,()=>{vfx({k:'eslash',x:e.x,y:e.y,a:e.aimA,arc:360,r:M.r,dir:1,big:1,c:'#e8dfb8',t:0,d:.3});sfx('heavy');shake(4);
    forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-e.x,pl.y-e.y)<M.r+pl.r-2)hurtPlayer(rDmg(e)*M.dmg,e,true);});e.aimA=wAim(e);rDone(e,M.rec);});
}
// The rib volley: bone shards in a fan. Ordinary shots: they can be dodged, and a swing knocks them down.
function rVolley(e){
  const M=REGENT.volley,w=M.wind*rPace(e),a=wAim(e);wAct(e,'volley',w,a);
  G.tele.push({cone:true,x:e.x,y:e.y,a,half:M.half,len:120,t:0,d:w,fn:()=>{}});
  wStep(e,w,()=>{sfx('swing');const h=(M.n-1)/2;for(let i=-h;i<=h;i++){const b=a+i*M.half/h;G.proj.push({x:e.x,y:e.y,vx:Math.cos(b)*M.speed,vy:Math.sin(b)*M.speed,dmg:rDmg(e)*M.dmg,life:1.5,c:'#d9d4c4',fam:famOf(e),dtype:ETYPES[e.type].dtype});}
    rDone(e,M.rec);});
}
// It calls its guard: a long channel, shield down, its ward against magic gone. Then the skeletons stand.
function rCall(e){
  const M=REGENT.call;wAct(e,'summon',M.wind);e.guard=false;e.mres=0;banner('The dead answer','It is open while it calls',2200);sfx('boss');
  vfx({k:'ring',x:e.x,y:e.y,r:70,c:'#bfe9c8',t:0,d:M.wind});
  const q=e.seq;after(M.wind,()=>{e.mres=e.baseMres;if(e.dead||e.seq!==q)return;   // (a broken poise ends the call: no guard comes)
    const n=M.n+Math.max(0,G.players.filter(pl=>!pl.gone).length-1);
    for(let i=0;i<n;i++){const a=i/n*TAU+.6,s=makeEnemy(e.calls||'skel',e.x+Math.cos(a)*30,e.y+Math.sin(a)*30,G.hpM,G.dmgM,false);s.state='chase';s.summoned=true;s.kx=Math.cos(a)*90;s.ky=Math.sin(a)*90;G.enemies.push(s);
      vfx({k:'spikes',x:s.x,y:s.y,t:0,d:.4});}
    shake(5);rDone(e,M.rec);});
}
// Bone lanes: a cross through where you stand, then another turned an eighth of a circle.
function rCross(e){
  const M=REGENT.cross,w=M.wind*rPace(e),q=e.seq;wAct(e,'chains',w+.8);e.crossT=M.every;
  const lane=(x,y,a,len,half,d)=>G.tele.push({line:true,x,y,a,len,w:half,t:0,d,fn:()=>{if(e.dead||e.seq!==q)return;vfx({k:'chain',x,y,a,len,w:half,c:'#e8dfb8',t:0,d:.35});vfx({k:'spikes',x:x+Math.cos(a)*len/2,y:y+Math.sin(a)*len/2,t:0,d:.4});sfx('chain');shake(2);
    const ca=Math.cos(a),sa=Math.sin(a);forPlayers(pl=>{if(pl.dead)return;const dx=pl.x-x,dy=pl.y-y,along=dx*ca+dy*sa,off=Math.abs(-dx*sa+dy*ca);
      if(along>-4&&along<len+4&&off<half+pl.r-2)hurtPlayer(rDmg(e)*M.dmg,e,true,null,true);});}});
  const cross=th=>{const t=targetFor(e)||P,L=420;for(const a of[th,th+Math.PI/2])lane(t.x-Math.cos(a)*L/2,t.y-Math.sin(a)*L/2,a,L,11,w*.85);};
  const th=Math.random()*Math.PI;cross(th);wStep(e,.65*rPace(e),()=>cross(th+Math.PI/4));
  wStep(e,w+.8,()=>rDone(e,M.rec));
}
// The charge, shield first, down a marked lane.
function rCharge(e){
  const M=REGENT.charge,w=M.wind*rPace(e),a=wAim(e);wAct(e,'brace',w,a);
  G.tele.push({line:true,x:e.x,y:e.y,a,len:M.len,t:0,d:w,fn:()=>{}});
  wStep(e,w,()=>{wAct(e,'charge',M.t,a);e.state='charge';e.t=M.t;e.cvx=Math.cos(a)*M.speed;e.cvy=Math.sin(a)*M.speed;e.chHit=[];});
}
// Grave spikes (phase 3): bone bursts under your feet, four times running, each where you stand at that moment.
function rSpikes(e){
  const M=REGENT.spikes,n=M.n+(e.enraged?1:0),q=e.seq;wAct(e,'spikes',M.gap*n+.4);
  const spike=k=>{if(e.dead||e.seq!==q||k>=n)return;const tg=targetFor(e);if(!tg)return;const tx=tg.x,ty=tg.y;
    G.tele.push({x:tx,y:ty,r:M.r,t:0,d:M.wind*rPace(e),fn:()=>{if(e.dead)return;vfx({k:'spikes',x:tx,y:ty,t:0,d:.4});shake(3);
      forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<M.r+pl.r-2)hurtPlayer(rDmg(e)*M.dmg,e,true,null,true);});}});
    after(M.gap,()=>spike(k+1));};
  spike(0);wStep(e,M.gap*n+.4,()=>rDone(e,M.rec));
}
// The throne's ruin (phase 3): two rings of spikes round it, one after the other. Stand in the gap between, then
// step into where the first has been.
function rRings(e){
  const M=REGENT.rings,w=M.wind*rPace(e),q=e.seq,x=e.x,y=e.y;wAct(e,'slam',w);e.ringT=M.every;
  const ring=(inner,r,d)=>G.tele.push({x,y,r,inner,t:0,d,fn:()=>{if(e.dead||e.seq!==q)return;vfx({k:'quake',x,y,r,big:1,t:0,d:.6});for(let i=0;i<10;i++){const a=i/10*TAU;vfx({k:'spikes',x:x+Math.cos(a)*(r+inner)/2,y:y+Math.sin(a)*(r+inner)/2,t:0,d:.4});}
    sfx('boom');shake(6);forPlayers(pl=>{if(pl.dead)return;const d2=hyp(pl.x-x,pl.y-y);if(d2<r+pl.r-2&&d2>inner-pl.r+2)hurtPlayer(rDmg(e)*M.dmg,e,true,null,true);});}});
  ring(0,46,w);ring(78,118,w);wStep(e,w+.55,()=>{ring(44,80,.75*rPace(e));ring(116,170,.75*rPace(e));});
  wStep(e,w+.7,()=>rDone(e,M.rec));
}
function rPhase(e,n){
  e.seq++;e.phase=n;e.immune=true;e.guard=false;wAct(e,'roar',2.2,wAim(e));e.busy=G.time+2.4;
  banner(n===2?'The Regent calls its guard':'The throne breaks',n===2?'Strike while it calls':'Its shield is gone. Watch the floor.',3000);sfx('boss');shake(8);
  vfx({k:'ring',x:e.x,y:e.y,r:120,c:'#e8dfb8',t:0,d:.8});
  if(n===3){e.shield=false;vfx({k:'quake',x:e.x,y:e.y,r:60,big:1,t:0,d:.8});burst(e.x,e.y,30,'#cfc8a8',140);}
  const q=e.seq;after(2.2,()=>{if(e.dead||e.seq!==q)return;e.immune=false;rDone(e,.3);});
}

function regentAI(e,dt,d,ux,uy){
  const R=REGENT;if(e.phase==null)regentInit(e);
  if(e.state==='charge'){
    moveEnt(e,e.cvx*dt,e.cvy*dt);e.t-=dt;
    forPlayers(pl=>{if(!pl.dead&&!e.chHit.includes(pl.id)&&hyp(pl.x-e.x,pl.y-e.y)<e.r+pl.r+2){e.chHit.push(pl.id);hurtPlayer(rDmg(e)*R.charge.dmg,e,true);}});
    if(Math.random()<.6)part({x:e.x+rand(-8,8),y:e.y+rand(-4,10),vx:0,vy:0,t:0,d:.3,c:'#8d8674'});
    if(e.t<=0){e.state='act';rDone(e,R.charge.rec);}
    return;
  }
  if(e.state==='act'){
    if(G.time<e.track)e.aimA=wAim(e);
    if(e.busy&&G.time>=e.busy){e.state='chase';e.act=null;e.busy=0;}
    return;
  }
  if(!e.enraged&&G.time-e.wokeAt>R.enrage){e.enraged=true;banner('The Regent rages','End it, or be ended',2600);sfx('boss');shake(8);}
  const hp=e.hp/e.maxHp;
  if(e.phase===1&&hp<=R.p2)return rPhase(e,2);
  if(e.phase===2&&hp<=R.p3)return rPhase(e,3);
  if(e.phase>=2&&e.called<R.call.at.length&&hp<=R.call.at[e.called]){e.called++;return rCall(e);}
  e.crossT-=dt;e.ringT-=dt;
  // walking: shield up (until it breaks), turning toward you no faster than it can
  e.guard=e.shield&&!(e.stun>0)&&!(e.staggerT>0);
  const want=Math.atan2(uy,ux),off=angDiff(want,e.aimA),turn=(e.shield?R.guard.turn:5)*(e.enraged?1.4:1)*dt;
  e.aimA+=Math.abs(off)<=turn?off:Math.sign(off)*turn;
  const reach=e.r+P.r+16,behind=Math.abs(off)>1.9;
  if(d>reach)walkEnt(e,ux*e.speed*dt,uy*e.speed*dt);
  e.behindT=behind&&d<R.spin.r?e.behindT+dt:Math.max(0,e.behindT-dt*2);
  if(e.behindT>R.guard.behind)return rSpin(e);
  e.atkT-=dt;if(e.atkT>0||Math.abs(off)>.6)return;   // it strikes only at what is before it
  const near=d<R.swing.r+2,far=d>R.volley.far,opts=[];
  if(near)opts.push(['swing',4],['bash',e.phase===3?1:3],['strike',3]);
  if(far)opts.push(['volley',4],['charge',e.phase>=2?3:0]);else opts.push(['volley',1]);
  if(e.phase>=2&&e.crossT<=0)opts.push(['cross',6]);
  if(e.phase===3){opts.push(['spikes',3]);if(e.ringT<=0)opts.push(['rings',7]);}
  const pool=opts.filter(o=>o[1]>0&&o[0]!==e.lastAtk);let r=Math.random()*pool.reduce((s,o)=>s+o[1],0),pick=pool[0]&&pool[0][0];
  for(const[k,wt]of pool){r-=wt;if(r<=0){pick=k;break;}}
  if(!pick){if(!near)return;pick='swing';}
  e.lastAtk=pick;e.guard=false;
  ({swing:rSwing,bash:rBash,strike:rStrike,volley:rVolley,charge:rCharge,cross:rCross,spikes:rSpikes,rings:rRings})[pick](e);
}

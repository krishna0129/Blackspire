'use strict';
// Blackspire: floor 3, roots and the restless dead (docs/design/floor-3.md). How its enemies and its boss behave.
// Every function here runs with P set to the player the enemy is after (see targetFor in update.js).

// a spot to blink to: on open floor, in sight of where it stands, not in a safe room
function blinkSpot(e,min,max){
  for(let i=0;i<14;i++){const a=Math.random()*TAU,r=rand(min,max),x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r;
    if(!boxSolid(x,y,e.cr+1)&&los(e.x,e.y,x,y)&&!inSafe(x,y))return{x,y};}
  return null;
}
const nearestCorpse=(e,range)=>{let best=null,bd=range;for(const c of G.corpses){if(c.claim&&c.claim!==e&&!c.claim.dead&&c.claim.state==='channel')continue;
  const d=hyp(c.x-e.x,c.y-e.y);if(d<bd&&los(e.x,e.y,c.x,c.y)){bd=d;best=c;}}return best;};
// A corpse gets up as a thrall at half health. raised: gives no experience and no loot when killed again.
function raiseCorpse(c,collect){
  G.corpses=G.corpses.filter(q=>q!==c);
  const s=makeEnemy('thrall',c.x,c.y,G.hpM,G.dmgM,false);s.hp=Math.round(s.maxHp*.5);s.raised=true;s.state='chase';s.stun=.4;
  if(collect){s.collect=true;s.summoned=true;}
  G.enemies.push(s);burst(c.x,c.y,12,'#9be08a',45);vfx({k:'pulse',x:c.x,y:c.y,r:14,t:0,d:.4,c:'#9be08a'});sfx('cast');
  return s;
}

const FLOOR3_AI={
  // Keeps its distance and throws grave-fire; stops to raise any body in reach (a 1.2 s channel that any hit breaks);
  // blinks away when you get close.
  gravecaller(e,dt,T,dx,dy,d){
    if(e.blinkCd>0)e.blinkCd-=dt;if(e.raiseCd>0)e.raiseCd-=dt;e.moving=false;
    if(e.state==='channel'){
      const c=e.chan;if(!c||!G.corpses.includes(c)){e.state='chase';e.chan=null;return;}
      e.t-=dt;if(e.t>0)return;
      raiseCorpse(c,false);if(e.elite){const c2=nearestCorpse(e,130);if(c2)raiseCorpse(c2,false);}   // an elite raises two
      e.state='chase';e.chan=null;e.raiseCd=2.5;return;
    }
    if(d<42&&e.blinkCd<=0){const q=blinkSpot(e,70,105);if(q){burst(e.x,e.y,10,'#4b3f5c',50);e.x=q.x;e.y=q.y;burst(e.x,e.y,10,'#9be08a',50);e.blinkCd=5;sfx('cast');return;}}
    if(e.raiseCd<=0){const c=nearestCorpse(e,130);if(c){e.state='channel';e.t=1.2;e.chan=c;c.claim=e;e.cx=c.x;e.cy=c.y;return;}}
    const ux=dx/d,uy=dy/d,mv=d<64?-1:d>110?1:0;
    if(mv){moveEnt(e,ux*mv*e.speed*dt,uy*mv*e.speed*dt);e.moving=true;}
    e.fire-=dt;
    if(e.fire<=0&&d<160&&los(e.x,e.y,P.x,P.y)){e.fire=rand(2.2,3);e.flash=.06;
      G.proj.push({x:e.x,y:e.y-6,vx:ux*T.pspeed,vy:uy*T.pspeed,dmg:e.dmg,life:2.4,c:T.pcol});}
  },
  // Rooted in a wall. Marks a lane toward you, then lashes along it.
  thornroot(e,dt,T,dx,dy,d){
    if(e.state==='windup'||e.state==='recover'){e.t-=dt;if(e.t<=0){if(e.state==='windup'){e.state='recover';e.t=1;}else e.state='chase';}return;}
    e.fire=(e.fire||0)-dt;
    if(d<82&&e.fire<=0&&los(e.x,e.y,P.x,P.y)){
      const a=Math.atan2(dy,dx),len=82,x0=e.x,y0=e.y;e.state='windup';e.t=.7;e.fire=2.2;
      G.tele.push({line:true,x:x0,y:y0,a,len,t:0,d:.7,fn:()=>{if(e.dead)return;sfx('swing');vfx({k:'line',x:x0,y:y0,a,len,t:0,d:.2,w:1});
        forPlayers(pl=>{if(pl.dead)return;const px=pl.x-x0,py=pl.y-y0,al=px*Math.cos(a)+py*Math.sin(a),pe=Math.abs(-px*Math.sin(a)+py*Math.cos(a));
          if(al>=0&&al<=len&&pe<11+pl.r-2)hurtPlayer(e.dmg,e,true);});}});
    }
  },
  // A rooted flower. Every 4 s it pulses, healing every other enemy nearby by 12% of its health.
  bloodbloom(e,dt,T){
    e.fire=(e.fire??2)-dt;if(e.fire>0)return;e.fire=4;
    const R=56;vfx({k:'pulse',x:e.x,y:e.y,r:R,t:0,d:.6,c:'#9be08a'});
    for(const q of G.enemies){if(q===e||q.dead||q.boss||q.burrowed||hyp(q.x-e.x,q.y-e.y)>R)continue;
      const h=Math.min(q.maxHp-q.hp,Math.round(q.maxHp*.12));if(h>0){q.hp+=h;addNum(q.x,q.y-q.r-5,'+'+h,'heal');}}
  },
  // Burrows under the floor (out of reach) and moves toward you; marks a circle under you and bursts up through it;
  // then lies exposed for a moment, then fights inside its skull shell (40% damage taken) before burrowing again.
  hermit(e,dt,T,dx,dy,d){
    e.moving=false;
    if(e.state==='chase'){e.state='burrowed';e.burrowed=true;e.t=4;burst(e.x,e.y,10,'#4a3f2c',40);return;}
    if(e.state==='burrowed'){e.t-=dt;
      if(d>14)moveEnt(e,dx/d*e.speed*dt,dy/d*e.speed*dt);
      if(Math.random()<.4)part({x:e.x+rand(-5,5),y:e.y+rand(-2,3),vx:rand(-8,8),vy:-10,t:0,d:.35,c:pick(['#4a3f2c','#2b2418','#6b5a3c'])});
      if(d<16||e.t<=0){const tx=P.x,ty=P.y,R=18;e.state='emerge';e.t=.8;
        G.tele.push({x:tx,y:ty,r:R,t:0,d:.8,fn:()=>{if(e.dead)return;e.x=tx;e.y=ty;e.burrowed=false;e.state='exposed';e.t=1.6;
          shake(4);burst(tx,ty,18,'#6b5a3c',80);burst(tx,ty,8,'#b9b4a6',60);sfx('boom');
          forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<R+pl.r-2)hurtPlayer(e.dmg*1.3,e,true,null,true);});}});}
      return;}
    if(e.state==='emerge')return;   // the telegraph's callback brings it up
    if(e.state==='exposed'){e.t-=dt;if(e.t<=0){e.state='shell';e.t=2.6;e.bite=0;}return;}
    if(e.state==='shell'){e.t-=dt;e.bite-=dt;
      if(d>e.r+P.r+4){moveEnt(e,dx/d*e.speed*.6*dt,dy/d*e.speed*.6*dt);e.moving=true;}
      else if(e.bite<=0){e.bite=1.1;e.lunge=.12;hurtPlayer(e.dmg,e);}
      if(e.t<=0){e.state='burrowed';e.burrowed=true;e.t=4;burst(e.x,e.y,10,'#4a3f2c',40);}
      return;}
    e.state='chase';
  },
};

/* ---------- the Pale Collector (floor 3 boss) ----------
   Raises thralls from the bodies in its chamber; they ignore you and walk to it, and each one that arrives heals it
   (8%, 12% below a third of its health). Throws three soul bolts at a time. From two thirds: the lantern sweep, a
   beam that turns around it. Below a third: blinks between the chamber's corners and roots erupt under its target. */
function collectWalk(e,dt){
  const b=G.bossEnt;if(!b||b.dead){e.collect=false;e.state='chase';return;}
  const dx=b.x-e.x,dy=b.y-e.y,d=hyp(dx,dy)||1;e.face=dx>0?1:-1;
  if(d<b.r+e.r+2){const ph3=b.hp/b.maxHp<.33,h=Math.round(b.maxHp*(ph3?.12:.08));
    b.hp=Math.min(b.maxHp,b.hp+h);addNum(b.x,b.y-b.r-8,'+'+h,'heal');vfx({k:'pulse',x:b.x,y:b.y,r:26,t:0,d:.5,c:'#9be08a'});
    burst(e.x,e.y,10,'#9be08a',50);sfx('heal');e.dead=true;return;}
  moveEnt(e,dx/d*e.speed*dt,dy/d*e.speed*dt);e.moving=true;
}
// How far a beam from (x,y) at angle a reaches before the first wall (or a sealed gate), up to len.
function beamReach(x,y,a,len){const c=Math.cos(a),s=Math.sin(a);for(let r=4;r<len;r+=3)if(solid(x+c*r,y+s*r))return r;return len;}
function updateBeams(dt){
  for(const B of G.beams){B.t-=dt;B.a+=B.va*dt;const reach=beamReach(B.x,B.y,B.a,B.len);
    forPlayers(pl=>{if(pl.dead||B.hit.includes(pl.id))return;const px=pl.x-B.x,py=pl.y-B.y,al=px*Math.cos(B.a)+py*Math.sin(B.a),pe=Math.abs(-px*Math.sin(B.a)+py*Math.cos(B.a));
      if(al>=0&&al<=reach&&pe<8+pl.r-2){B.hit.push(pl.id);hurtPlayer(B.dmg,B.src,true);}});}
  G.beams=G.beams.filter(B=>B.t>0&&!B.src.dead);
}
function rootSpikes(e,n,gap,warn){
  const spike=k=>{if(e.dead||k>=n)return;const tg=targetFor(e);if(!tg)return;const tx=tg.x,ty=tg.y,rad=18;
    G.tele.push({x:tx,y:ty,r:rad,t:0,d:warn,fn:()=>{if(e.dead)return;vfx({k:'spikes',x:tx,y:ty,t:0,d:.4});shake(3);
      forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<rad+pl.r-2)hurtPlayer(e.dmg*1.1,e,true,null,true);});}});
    after(gap,()=>spike(k+1));};
  spike(0);
}
function collectorAI(e,dt,d,ux,uy){
  const f=e.hp/e.maxHp,phase=f>.66?1:f>.33?2:3,r=G.boss;
  if(!G.beams)G.beams=[];
  if(e.state==='cast'){e.t-=dt;if(e.t<=0)e.state='chase';return;}
  if(d>78)moveEnt(e,ux*e.speed*dt,uy*e.speed*dt);else if(d<36)moveEnt(e,-ux*e.speed*.6*dt,-uy*e.speed*.6*dt);
  e.raiseT=(e.raiseT??3)-dt;
  if(e.raiseT<=0){e.raiseT=phase===1?9:phase===2?8:7;
    const inRoom=G.corpses.filter(c=>c.x>r.x*TILE&&c.x<(r.x+r.w)*TILE&&c.y>r.y*TILE&&c.y<(r.y+r.h)*TILE).sort((a,b)=>hyp(a.x-e.x,a.y-e.y)-hyp(b.x-e.x,b.y-e.y));
    const n=Math.min(inRoom.length,phase===1?2:3);
    if(n){e.state='cast';e.t=1;banner('The dead are collected','',1400);
      for(const c of inRoom.slice(0,n)){vfx({k:'raise',x:e.x,y:e.y-14,x2:c.x,y2:c.y,t:0,d:1});after(1,()=>{if(!e.dead&&G.corpses.includes(c))raiseCorpse(c,true);});}
      return;}
  }
  if(phase===3){e.blinkT=(e.blinkT??0)-dt;
    if(e.blinkT<=0){e.blinkT=6;const corners=[[2,2],[r.w-3,2],[2,r.h-3],[r.w-3,r.h-3]].map(([i,j])=>({x:(r.x+i+.5)*TILE,y:(r.y+j+.5)*TILE}));
      const q=corners.sort((a,b)=>hyp(b.x-e.x,b.y-e.y)-hyp(a.x-e.x,a.y-e.y))[Math.floor(Math.random()*2)];
      burst(e.x,e.y,16,'#b3afc0',60);e.x=q.x;e.y=q.y;burst(e.x,e.y,16,'#9be08a',60);sfx('cast');
      e.state='cast';e.t=.4*5+.3;rootSpikes(e,5,.4,.5);return;}}
  e.atkT-=dt;if(e.atkT>0)return;
  if(phase>=2&&Math.random()<.45){
    // lantern sweep: a red lane first, then a beam that turns half way around, catching anyone in its path once
    const a0=Math.atan2(uy,ux)-1.1,len=170,dir=Math.random()<.5?1:-1,s0=dir>0?a0:a0+2.2;
    e.state='cast';e.t=.8+1.8;e.atkT=2.2;
    G.tele.push({line:true,x:e.x,y:e.y,a:s0,len,t:0,d:.8,fn:()=>{if(e.dead)return;sfx('boss');G.beams.push({x:e.x,y:e.y,a:s0,va:dir*2.2/1.8,len,t:1.8,dmg:e.dmg*1.3,hit:[],src:e});}});
    return;
  }
  // soul bolts: three at a time, ordinary shots that can be evaded, blocked or knocked down
  const a=Math.atan2(uy,ux);e.state='cast';e.t=.5;e.atkT=(phase===3?1.2:1.6);sfx('cast');
  for(let i=-1;i<=1;i++){const b=a+i*.22;G.proj.push({x:e.x+10,y:e.y-6,vx:Math.cos(b)*120,vy:Math.sin(b)*120,dmg:e.dmg*.8,life:2,c:'#9be08a'});}
}

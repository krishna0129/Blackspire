'use strict';
// Blackspire: Per-frame simulation: player, enemies, bosses.

/* ---------- update ----------
   One step of the floor: every player, every enemy, every shot. The host runs it each frame (single player)
   or each tick (server), after setting each player's input (P.in). */
// Whom an enemy goes after: the nearest living player it can reach. Ordinary enemies ignore anyone in a safe room or
// sealed in the boss chamber; the boss only cares about whoever is sealed in with it, if anyone is.
function targetFor(e){
  const inside=e.boss&&G.players.some(q=>q.locked&&!q.dead&&!q.gone);let best=null,bd=1e9;
  for(const pl of G.players){if(pl.dead||pl.gone)continue;if(e.boss?inside&&!pl.locked:pl.safe||pl.locked)continue;
    const d=hyp(pl.x-e.x,pl.y-e.y);if(d<bd){bd=d;best=pl;}}
  return best||G.players.find(q=>!q.gone)||null;
}
const pull=(d,pl,dt)=>{const dist=hyp(d.x-pl.x,d.y-pl.y);if(dist<46){const s=140*dt/Math.max(dist,1);d.x+=(pl.x-d.x)*s;d.y+=(pl.y-d.y)*s;}};
function simUpdate(dt){
  if(G.hitstop>0){G.hitstop-=dt;return;}   // freeze-frame after a melee hit (single player only)
  if(!G.players.some(q=>!q.gone))return;
  G.time+=dt;
  for(let i=G.timers.length-1;i>=0;i--){const t=G.timers[i];t.t-=dt;if(t.t<=0){G.timers.splice(i,1);t.fn();}}
  forPlayers(()=>updatePlayer(dt));
  for(const e of G.enemies)if(!e.dead){const t=targetFor(e);if(t){setPlayer(t);updateEnemy(e,dt);}}
  G.enemies=G.enemies.filter(e=>!e.dead);
  // enemy shots hit whichever player they reach first
  for(const p of G.proj){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(solid(p.x,p.y)||inSafe(p.x,p.y))p.life=0;
    if(p.life>0)for(const pl of G.players)if(!pl.dead&&!pl.gone&&hyp(p.x-pl.x,p.y-pl.y)<pl.r+2){setPlayer(pl);hurtPlayer(p.dmg,null,false,{x:p.x-p.vx,y:p.y-p.vy});p.life=0;break;}}
  G.proj=G.proj.filter(p=>p.life>0);
  // the players' bolts, arrows and fireballs: hits count for whoever shot them
  for(const p of G.pproj){
    const ow=playerById(p.owner);if(!ow){p.life=0;continue;}setPlayer(ow);
    const fire=p.k==='fire';
    for(let i=0;i<2&&p.life>0;i++){
      const ox=p.x,oy=p.y;p.x+=p.vx*dt/2;p.y+=p.vy*dt/2;
      if(solid(p.x,p.y)){p.life=0;if(fire)explode(ox,oy);else burst(ox,oy,3,p.k==='arrow'?'#8d8b98':'#cfc8ff',30);break;}
      for(const e of G.enemies){if(e.dead||hyp(e.x-p.x,e.y-p.y)>e.r+(fire?4:3))continue;
        p.life=0;if(fire)explode(p.x,p.y);else if(damageEnemy(e,p.mult||1,{fx:ox-p.vx,fy:oy-p.vy}))gainMomentum();break;}
    }
    if(p.life>0){p.life-=dt;if(p.life<=0&&fire)explode(p.x,p.y);}
    if(fire&&p.life>0)part({x:p.x+rand(-1,1),y:p.y+rand(-1,1),vx:rand(-6,6),vy:-10,t:0,d:.3,c:pick(['#f08a3c','#d9534f','#ffe9a8'])});
  }
  G.pproj=G.pproj.filter(p=>p.life>0);
  // bodies crumble after a while (the ones lying in a boss chamber do not)
  for(const c of G.corpses){c.t-=dt;if(c.t<=0)burst(c.x,c.y,6,'#55513f',30);}
  G.corpses=G.corpses.filter(c=>c.t>0);
  // the Pale Collector's lantern beams
  if(G.beams)updateBeams(dt);
  // telegraphs
  for(const t of G.tele){t.t+=dt;if(t.t>=t.d&&!t.done){t.done=true;t.fn();}}
  G.tele=G.tele.filter(t=>!t.done);
  // drops: each belongs to one player, who alone can pick it up
  for(const d of G.drops){d.t+=dt;if(d.t<.25)continue;const pl=playerById(d.owner);if(!pl){d.gone=true;continue;}if(pl.dead)continue;setPlayer(pl);
    const dist=hyp(d.x-P.x,d.y-P.y);
    if(d.k==='shard'){pull(d,P,dt);if(dist<8){S.shards+=d.amt;d.gone=true;}}
    else if(d.k==='mat'){pull(d,P,dt);
      if(dist<8){S.mats[d.id]=(S.mats[d.id]||0)+d.amt;d.gone=true;sfx('pick');log(`Picked up <span style="color:${MATS[d.id].color}">${d.amt>1?d.amt+' ':''}${MATS[d.id].name}</span>`);}}
    else if(SUPPLIES[d.k]){if(dist<10){const s=SUPPLIES[d.k];S[s.key]=(S[s.key]||0)+1;d.gone=true;sfx('pick');log('Picked up a '+s.name.toLowerCase());}}
    else if(dist<11){if(S.inv.length<BAG_SIZE){d.item.isNew=true;S.inv.push(d.item);d.gone=true;sfx(d.item.rarity>=2?'rare':'pick');
        toast(d.item);bagBadge();if(d.item.rarity>=2)burst(P.x,P.y-4,14,RARITY[d.item.rarity].color,70);
        log(`Picked up <span style="color:${RARITY[d.item.rarity].color}">${esc(d.item.name)}</span>`);}
      else if(!d.warned||G.time-d.warned>4){d.warned=G.time;log('Bag is full. Open Gear and salvage something.');}}}
  G.drops=G.drops.filter(d=>!d.gone);
  // chests: each player opens each chest once, and the loot is theirs
  forPlayers(pl=>{if(pl.dead)return;const opened=floorState(G.n).chests;
    for(let ci=0;ci<G.chests.length;ci++){const c=G.chests[ci];if(opened.includes(ci)||hyp(c.x-P.x,c.y-P.y)>=13)continue;
      opened.push(ci);sfx('pick');burst(c.x,c.y,10,'#dcb65c',50);
      dropLoot('chest',c.x,c.y+10);}});
  // the boss wakes when anyone is inside its chamber, and goes back to sleep at full health if nobody is left alive in there
  const b=G.bossEnt,r=G.boss;
  if(b&&!b.dead&&!G.bossAwake&&G.players.some(pl=>!pl.gone&&!pl.dead&&pl.x>(r.x+1)*TILE&&pl.x<(r.x+r.w-1)*TILE&&pl.y>(r.y+1)*TILE&&pl.y<(r.y+r.h-1)*TILE))wakeBoss();
  if(b&&!b.dead&&G.bossAwake&&!G.players.some(pl=>pl.locked&&!pl.dead&&!pl.gone))resetBoss();
}
function resetBoss(){
  const b=G.bossEnt;G.bossAwake=false;G.tele=[];G.timers=[];
  Object.assign(b,{hp:b.maxHp,state:'idle',summons:0,atkT:1.5,stun:0,kx:0,ky:0,bleedT:0,sunder:0,x:(G.boss.x+G.boss.w/2)*TILE,y:(G.boss.y+G.boss.h/2)*TILE});
  G.enemies=G.enemies.filter(e=>e===b||!e.summoned);G.beams=[];bossBar(null);
  if(G.arena){G.corpses=G.corpses.filter(c=>!c.arena);for(const q of G.arena)G.corpses.push({x:q.x,y:q.y,t:1e9,arena:true});}   // the chamber's bodies are back
}
// Hunger and thirst (NEEDS, data.js) drain all the time on a floor. Low weakens you; empty costs health every second.
function updateNeeds(dt){
  if(G.village)return;   // nobody goes hungry at home
  let empty=0;
  const slow=P.buff&&P.buff.id==='fed'?.5:1;
  for(const k in NEEDS){const was=P[k];P[k]=Math.max(0,P[k]-NEEDS[k].drain*slow*dt);
    if(was>=NEED_LOW&&P[k]<NEED_LOW)log(NEEDS[k].low);
    if(was>0&&P[k]<=0)log(`<span style="color:var(--red)">${NEEDS[k].empty}</span>`);
    if(P[k]<=0)empty++;}
  P.needT=(P.needT||0)+dt;
  if(P.needT>=1){P.needT-=1;if(empty&&!god){const d=Math.max(1,Math.round(ST.maxHp*NEED_HURT*empty));P.hp-=d;addNum(P.x,P.y-16,d,'hurt');if(P.hp<=0)die();}}
}
function updatePlayer(dt){
  if(P.dead)return;
  const buff=P.buff&&P.buff.id;
  P.mp=Math.min(ST.maxMp,P.mp+ST.mpRegen*(P.drink<NEED_LOW?.5:1)*(buff==='clear'?1.25:1)*dt);
  if(P.buff){P.buff.t-=dt;if(P.buff.t<=0){log(BUFFS[P.buff.id].name+' has worn off.');P.buff=null;}}if(P.guard>0)P.guard-=dt;if(P.ward>0)P.ward-=dt;if(P.hot){heal(P.hot.rate*dt);P.hot.t-=dt;if(P.hot.t<=0)P.hot=null;}
  P.atkCd-=dt;P.skillCd=Math.max(0,P.skillCd-dt);P.potCd=Math.max(0,P.potCd-dt);P.eatCd=Math.max(0,P.eatCd-dt);P.inv=Math.max(0,P.inv-dt);
  if(P.momT>0){P.momT-=dt;if(P.momT<=0)P.mom=0;}
  if(P.food>=NEED_LOW)heal(ST.regen*(buff==='hearty'?1.5:1)*dt);
  updateNeeds(dt);if(P.dead)return;
  // Safe rooms: no fighting in either direction. The last one you stand in is where you wake after dying.
  const si=P.locked?-1:safeIndex(P.x,P.y);P.safe=si>=0;
  if(si>=0&&(S.cp!==si||S.cpFloor!==G.n)){S.cp=si;S.cpFloor=G.n;if(si>0){log('Safe room reached. You will wake here if you fall.');sfx('pick');}}
  // safe points you have stood in, by floor: the Teleport Gate can take you back to them
  if(si>0&&G.n>0){const pts=S.points||(S.points={}),l=pts[G.n]||(pts[G.n]=[]);if(!l.includes(si))l.push(si);}
  if(onThorns(P.x,P.y)&&!P.safe){P.thornT=(P.thornT||0)-dt;if(P.thornT<=0){P.thornT=.7;
    const d=Math.max(1,Math.round(THORN_DMG*G.dmgM*100/(100+ST.def)));if(!god){P.hp-=d;addNum(P.x,P.y-16,d,'hurt');if(P.hp<=0)die();}}}
  else P.thornT=0;
  if(P.dead)return;
  steerPlayer(dt);
  if(!P.dash){
    if(P.atkBuf>0)P.atkBuf-=dt;
    if((P.in.atk||P.atkBuf>0)&&P.atkCd<=0&&!P.blocking){P.atkBuf=0;if(P.safe)sheathed();else startSwing();}
  }
  if(P.swing){const s=P.swing;s.t+=dt;
    if(!s.hit&&s.t>=s.d*.4){s.hit=true;
      if(ST.magic)castBolt();
      else if(ST.ranged)fireArrow(P.aim,1);
      else{hitArc(s.a,Math.max(ST.arc,ST.thrust?40:0),ST.range,1,{melee:true});
      if(ST.thrust)vfx({k:'line',x:P.x,y:P.y,a:s.a,len:ST.range+5,t:0,d:.1});else slashFx(s.a,ST.arc,ST.range,s.dir,.14);}}
    if(s.t>=s.d)P.swing=null;}
}
// Facing, blocking and moving. Online, each browser runs this for its own player so movement answers at once, and
// sends where it ended up; the server (where P.remote is set) runs it too for facing and timers, but takes the
// position from the browser after checking it (see the server's checkMove).
function steerPlayer(dt){
  P.dodgeCd=Math.max(0,P.dodgeCd-dt);
  let mx=P.in.mx,my=P.in.my;const m=hyp(mx,my);if(m>1){mx/=m;my/=m;}
  // Facing is one of four directions and follows movement; attacks, shots and skills all go the way you face.
  // Moving diagonally keeps the current facing when it is one of the two directions held.
  // Blocking: hold the key to raise the shield. You keep facing the same way (so you can back off or sidestep
  // behind it), you move slowly, and you cannot swing.
  const wasBlocking=P.blocking;
  P.blocking=!!ST.shield&&P.in.block&&!P.swing&&!P.dash&&!P.safe;
  P.blockT=P.blocking?(wasBlocking?P.blockT+dt:0):0;
  if(!P.swing&&!P.dash&&!P.blocking&&m>.2){const ax=Math.abs(mx),ay=Math.abs(my),h=mx>0?3:2,v=my>0?0:1;
    if(ax>.25&&ay>.25){if(P.dir!==h&&P.dir!==v)P.dir=ax>=ay?h:v;}else P.dir=ax>ay?h:v;}
  P.aim=DIR_ANGLE[P.dir];
  if(P.dash){
    const D=P.dash;if(!P.remote)moveEnt(P,D.vx*dt,D.vy*dt);D.t-=dt;
    if(Math.random()<.7)part({x:P.x,y:P.y+rand(-6,4),vx:0,vy:0,t:0,d:.22,c:'#4a4a5e'});
    if(D.t<=0)P.dash=null;
  }else{
    const sp=ST.move*(P.swing?(ST.magic||ST.ranged?.3:0):P.blocking?SHIELDS[ST.shield].slow:1)*(onThorns(P.x,P.y)?THORN_SLOW:1)*(P.food<NEED_LOW?.9:1);   // you plant your feet to swing
    if(P.lunge>0){P.lunge-=dt;if(!P.remote)moveEnt(P,Math.cos(P.aim)*110*dt,Math.sin(P.aim)*110*dt);}
    if(!P.remote)moveEnt(P,mx*sp*dt,my*sp*dt);
    P.moving=m>.1;if(P.moving)P.walk+=dt*(sp/64)*7;
  }
}
function updateEnemy(e,dt){   // enemies never step into a safe room, whether walking or knocked back
  const ox=e.x,oy=e.y,T=ETYPES[e.type],sp=e.speed,thorny=!T.plant&&!e.boss&&!e.burrowed&&onThorns(e.x,e.y);
  if(thorny){e.speed*=THORN_SLOW;e.thornT=(e.thornT||0)-dt;
    if(e.thornT<=0){e.thornT=.7;const d=Math.max(1,Math.round(THORN_DMG*G.dmgM));e.hp-=d;e.hurtT=4;addNum(e.x,e.y-e.r-5,d,'bleed');if(e.hp<=0){killEnemy(e);e.speed=sp;return;}}}
  updateEnemyCore(e,dt);e.speed=sp;
  if(!e.dead&&!e.boss&&inSafe(e.x,e.y)&&!inSafe(ox,oy)){e.x=ox;e.y=oy;e.kx=e.ky=0;}
}
function updateEnemyCore(e,dt){
  if(e.flash>0)e.flash-=dt;if(e.hurtT>0)e.hurtT-=dt;if(e.sunder>0)e.sunder-=dt;
  if(ETYPES[e.type].dummy){   // a scarecrow: shrugs off knockback and stuns, and is whole again once left alone
    e.kx=e.ky=0;e.stun=0;if(e.hurtT<=0){e.hp=e.maxHp;e.bleedT=0;}else if(e.bleedT>0){e.bleedT-=dt;e.bleedAcc+=e.bleedDps*dt;
      if(e.bleedAcc>=1){const d=Math.floor(e.bleedAcc);e.bleedAcc-=d;e.hp-=d;addNum(e.x,e.y-e.r-5,d,'bleed');}}
    return;}
  if(e.bleedT>0){e.bleedT-=dt;e.bleedAcc+=e.bleedDps*dt;if(e.bleedAcc>=1){const d=Math.floor(e.bleedAcc);e.bleedAcc-=d;e.hp-=d;e.hurtT=4;addNum(e.x,e.y-e.r-5,d,'bleed');if(e.hp<=0){killEnemy(e);return;}}}
  if(Math.abs(e.kx)+Math.abs(e.ky)>1){moveEnt(e,e.kx*dt,e.ky*dt);const k=Math.max(0,1-9*dt);e.kx*=k;e.ky*=k;}
  if(e.stun>0){e.stun-=dt;return;}
  if(e.collect)return collectWalk(e,dt);   // raised by the Pale Collector: they only want to reach it
  const dx=P.x-e.x,dy=P.y-e.y,d=hyp(dx,dy)||1,ux=dx/d,uy=dy/d;
  if(P.safe&&!e.boss&&e.state!=='idle')e.state='idle';   // they lose interest while you are in a safe room
  if(e.state==='idle'){if(!e.boss&&d<96&&!P.dead&&!P.locked&&!P.safe)e.state='chase';return;}
  if(P.dead)return;
  if(Math.abs(dx)>2)e.face=dx>0?1:-1;
  if(e.boss)return updateBoss(e,dt,d,ux,uy);
  const T=ETYPES[e.type];
  // separation
  let sx=0,sy=0;for(const o of G.enemies){if(o===e||o.dead)continue;const ox=e.x-o.x,oy=e.y-o.y,od=hyp(ox,oy),min=e.r+o.r;if(od<min&&od>.01){sx+=ox/od*(min-od);sy+=oy/od*(min-od);}}
  if((sx||sy)&&!T.rooted&&!e.burrowed)moveEnt(e,sx*4*dt,sy*4*dt);
  if(T.ai&&FLOOR3_AI[T.ai])return FLOOR3_AI[T.ai](e,dt,T,dx,dy,d);
  if(T.ai)return zeldaAI(e,dt,T,dx,dy,d);
  if(T.ranged){
    let mv=0;if(d<52)mv=-1;else if(d>92)mv=1;
    moveEnt(e,ux*mv*e.speed*dt,uy*mv*e.speed*dt);
    e.fire-=dt;
    if(e.fire<=0&&d<140&&los(e.x,e.y,P.x,P.y)){e.fire=rand(1.9,2.6);e.flash=.06;const v=T.pspeed||88;G.proj.push({x:e.x,y:e.y,vx:ux*v,vy:uy*v,dmg:e.dmg,life:2.4,c:T.pcol});}
    return;
  }
  if(e.state==='chase'){
    moveEnt(e,ux*e.speed*dt,uy*e.speed*dt);
    if(d<e.r+P.r+T.reach){e.state='windup';e.t=T.windup;}
  }else if(e.state==='windup'){
    e.t-=dt;if(e.t<=0){if(d<e.r+P.r+T.reach+7)hurtPlayer(e.dmg,e);e.state='recover';e.t=T.recover;e.lunge=.12;}
  }else if(e.state==='recover'){e.t-=dt;if(e.lunge>0)e.lunge-=dt;if(e.t<=0)e.state='chase';}
}
/* ---------- floor 2: the dead ----------
   They move the way enemies in old top-down adventures do: along one axis at a time, facing where they walk,
   and each attack goes in the direction faced, so stepping aside is a real answer to all three.
     stalfos  bone soldier: weaves in, lunges in a straight line, may hop back from your swing
     archer   bone archer: sidesteps onto your row or column, then looses an arrow along it; hops away if crowded
     darknut  bone knight: turns slowly, shield stops everything from its front, heavy swing with a long recovery */
function faceTo(e,dx,dy){e.dir=Math.abs(dx)>=Math.abs(dy)?(dx>0?3:2):(dy>0?0:1);}
function stepAxis(e,dt,dx,dy,speed){
  const a=DIR_ANGLE[e.dir],ox=e.x,oy=e.y;moveEnt(e,Math.cos(a)*speed*dt,Math.sin(a)*speed*dt);e.moving=true;
  if(hyp(e.x-ox,e.y-oy)<speed*dt*.3)e.dir=e.dir>=2?(dy>0?0:1):(dx>0?3:2);   // walked into a wall: try the other axis
}
function zeldaAI(e,dt,T,dx,dy,d){
  e.moving=false;if(e.hopCd>0)e.hopCd-=dt;
  const ax=Math.abs(dx),ay=Math.abs(dy);
  if(e.state==='hop'){e.t-=dt;moveEnt(e,e.hvx*dt,e.hvy*dt);if(e.t<=0)e.state='chase';return;}
  const along=()=>e.dir>=2?ax:ay,off=()=>e.dir>=2?ay:ax;
  const toward=()=>(e.dir===3&&dx>0)||(e.dir===2&&dx<0)||(e.dir===0&&dy>0)||(e.dir===1&&dy<0);
  if(T.ai==='stalfos'){
    if(e.state==='chase'){
      e.think-=dt;
      if(e.think<=0||!toward()||along()<3){e.think=rand(.35,.7);   // usually the longer axis, sometimes the other, which makes them weave
        if(ax>8&&ay>8&&Math.random()<.3)e.dir=ax>=ay?(dy>0?0:1):(dx>0?3:2);else faceTo(e,dx,dy);}
      if(toward()&&along()<34&&off()<9){e.state='windup';e.t=T.windup;return;}
      stepAxis(e,dt,dx,dy,e.speed);
    }else if(e.state==='windup'){e.t-=dt;if(e.t<=0){e.state='strike';e.t=.2;e.hit=false;}}
    else if(e.state==='strike'){const a=DIR_ANGLE[e.dir];e.t-=dt;moveEnt(e,Math.cos(a)*150*dt,Math.sin(a)*150*dt);
      if(!e.hit&&d<e.r+P.r+4){e.hit=true;hurtPlayer(e.dmg,e);}
      if(e.t<=0){e.state='recover';e.t=T.recover;}}
    else if(e.state==='recover'){e.t-=dt;if(e.t<=0){e.state='chase';e.think=0;}}
    return;
  }
  if(T.ai==='archer'){
    if(e.state==='draw'){e.t-=dt;
      if(e.t<=0){const a=DIR_ANGLE[e.dir],v=T.pspeed;G.proj.push({x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,dmg:e.dmg,life:1.6,c:T.pcol,arrow:true,a});sfx('swing');e.state='chase';e.fire=rand(1.6,2.3);}
      return;}
    if(e.state!=='chase')e.state='chase';
    e.fire-=dt;const lined=ax<7||ay<7;
    if(d<46&&e.hopCd<=0){faceTo(e,dx,dy);e.state='hop';e.t=e.hopT=.22;e.hvx=-dx/d*140;e.hvy=-dy/d*140;e.hopCd=2.2;return;}
    if(lined&&d<150&&e.fire<=0&&los(e.x,e.y,P.x,P.y)){faceTo(e,dx,dy);e.state='draw';e.t=.45;return;}
    if(!lined){e.dir=ax<ay?(dx>0?3:2):(dy>0?0:1);stepAxis(e,dt,dx,dy,e.speed);}   // close the smaller gap to line up
    else{faceTo(e,dx,dy);if(d>120)stepAxis(e,dt,dx,dy,e.speed);}
    return;
  }
  // darknut
  if(e.state==='chase'){
    e.think-=dt;if(e.think<=0){e.think=.75;faceTo(e,dx,dy);}   // it only re-faces you every so often: that is the opening
    if(toward()&&along()<e.r+P.r+T.reach+6&&off()<14){e.state='windup';e.t=T.windup;return;}
    if(toward())stepAxis(e,dt,dx,dy,e.speed);
  }else if(e.state==='windup'){e.t-=dt;
    if(e.t<=0){const a=DIR_ANGLE[e.dir];vfx({k:'eslash',x:e.x,y:e.y,a,r:30,t:0,d:.2});shake(2);
      if(d<e.r+P.r+T.reach+12&&Math.abs(angDiff(Math.atan2(dy,dx),a))<1)hurtPlayer(e.dmg,e);
      e.state='recover';e.t=T.recover;}}
  else if(e.state==='recover'){e.t-=dt;if(e.t<=0){e.state='chase';e.think=0;}}
}
function updateBoss(e,dt,d,ux,uy){
  const rage=e.hp/e.maxHp<.3?.7:1;
  if(e.ai==='collector')return collectorAI(e,dt,d,ux,uy);
  if(e.state==='charge'){
    moveEnt(e,e.cvx*dt,e.cvy*dt);e.t-=dt;
    forPlayers(pl=>{if(!pl.dead&&!e.chHit.includes(pl.id)&&hyp(pl.x-e.x,pl.y-e.y)<e.r+pl.r+2){e.chHit.push(pl.id);hurtPlayer(e.dmg*1.3,e,true);}});
    if(Math.random()<.6)part({x:e.x+rand(-8,8),y:e.y+rand(-4,10),vx:0,vy:0,t:0,d:.3,c:'#3a1d25'});
    if(e.t<=0){e.state='chase';e.atkT=1.1*rage;}
    return;
  }
  if(e.state==='cast'){e.t-=dt;if(e.t<=0)e.state='chase';return;}
  if(d>e.r+P.r+6)moveEnt(e,ux*e.speed*dt,uy*e.speed*dt);
  const need=e.summons===0?.66:e.summons===1?.33:-1;
  if(e.hp/e.maxHp<need){e.summons++;banner(e.ai==='regent'?'The dead answer':'It calls the swarm','',1400);
    for(let i=0;i<(e.ai==='regent'?2:3+Math.min(3,G.n-1));i++){const a=Math.random()*TAU,s=makeEnemy(e.calls||'skitter',e.x,e.y,G.hpM,G.dmgM,false);s.state='chase';s.summoned=true;s.kx=Math.cos(a)*120;s.ky=Math.sin(a)*120;G.enemies.push(s);}}
  e.atkT-=dt;
  if(e.atkT<=0){
    if(e.ai==='regent'){boneAttack(e,d,ux,uy,rage);return;}
    if(d<64||Math.random()<.35){
      const tx=d<64?e.x:P.x,ty=d<64?e.y:P.y,rad=d<64?48:34,dur=(d<64?.8:.95)*rage;
      e.state='cast';e.t=dur;e.atkT=1.5*rage;
      G.tele.push({x:tx,y:ty,r:rad,t:0,d:dur,fn:()=>{if(e.dead)return;shake(7);burst(tx,ty,18,'#7a2a32',90);forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<rad+pl.r-2)hurtPlayer(e.dmg*1.5,e,true);});}});
    }else{
      const a=Math.atan2(uy,ux),dur=.6*rage;e.state='cast';e.t=dur;
      G.tele.push({line:true,x:e.x,y:e.y,a,len:150,t:0,d:dur,fn:()=>{if(e.dead)return;e.state='charge';e.t=.5;e.cvx=Math.cos(a)*270;e.cvy=Math.sin(a)*270;e.chHit=[];}});
    }
  }
}
// The Bone Regent (floor 2). Four attacks, all shown in red before they land. It never repeats one twice running.
function boneAttack(e,d,ux,uy,rage){
  // close up it favours the slam and the cross, at range the volley and the spikes, but every attack can show up at any distance
  const r=Math.random(),near=d<58,order=['slam','cross','spikes','fan'];
  let kind=near?(r<.35?'slam':r<.7?'cross':r<.87?'spikes':'fan'):(r<.4?'fan':r<.75?'spikes':'cross');
  if(kind===e.lastAtk){kind=order[(order.indexOf(kind)+1)%4];if(kind==='slam'&&!near)kind='cross';}
  e.lastAtk=kind;
  if(kind==='slam'){
    const tx=e.x,ty=e.y,rad=48,dur=.8*rage;e.state='cast';e.t=dur;e.atkT=1.5*rage;
    G.tele.push({x:tx,y:ty,r:rad,t:0,d:dur,fn:()=>{if(e.dead)return;shake(7);burst(tx,ty,18,'#8d8674',90);forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<rad+pl.r-2)hurtPlayer(e.dmg*1.5,e,true);});}});
  }else if(kind==='fan'){
    // Rib volley: seven bone shards in a cone. These are ordinary shots, so they can be evaded and a melee swing knocks them down.
    const a=Math.atan2(uy,ux),half=.5,dur=.75*rage;e.state='cast';e.t=dur+.15;e.atkT=1.4*rage;
    G.tele.push({cone:true,x:e.x,y:e.y,a,half,len:120,t:0,d:dur,fn:()=>{if(e.dead)return;sfx('swing');
      for(let i=-3;i<=3;i++){const b=a+i*half/3;G.proj.push({x:e.x,y:e.y,vx:Math.cos(b)*135,vy:Math.sin(b)*135,dmg:e.dmg*.8,life:1.5,c:'#d9d4c4'});}}});
  }else if(kind==='spikes'){
    // Grave spikes: bone erupts under your feet four times in a row (five when enraged), each aimed at where you stand at that moment.
    const n=rage<1?5:4;e.state='cast';e.t=.3*n+.3;e.atkT=1.6*rage;
    // aimed at whoever the boss is after now; if they fall, at whoever it turns to next
    const spike=k=>{if(e.dead||k>=n)return;const tg=targetFor(e);if(!tg)return;const tx=tg.x,ty=tg.y,rad=19;
      G.tele.push({x:tx,y:ty,r:rad,t:0,d:.62*rage,fn:()=>{if(e.dead)return;vfx({k:'spikes',x:tx,y:ty,t:0,d:.4});shake(3);
        forPlayers(pl=>{if(!pl.dead&&hyp(pl.x-tx,pl.y-ty)<rad+pl.r-2)hurtPlayer(e.dmg*1.1,e,true,null,true);});}});
      after(.3,()=>spike(k+1));};
    spike(0);
  }else{
    // Bone cross: four lanes through the boss; the gaps between them are safe. Below 30% health a diagonal cross follows the first.
    const cross=(base,dur,again)=>{const x0=e.x,y0=e.y,len=170;e.state='cast';e.t=dur+.1;
      for(let i=0;i<4;i++)G.tele.push({line:true,x:x0,y:y0,a:base+i*Math.PI/2,len,t:0,d:dur,fn:i?()=>{}:()=>{
        if(e.dead)return;shake(6);
        for(let j=0;j<4;j++)vfx({k:'line',x:x0,y:y0,a:base+j*Math.PI/2,len,t:0,d:.25,w:1});
        forPlayers(pl=>{if(pl.dead)return;const dx=pl.x-x0,dy=pl.y-y0;
          for(let j=0;j<4;j++){const b=base+j*Math.PI/2,c=Math.cos(b),sn=Math.sin(b),al=dx*c+dy*sn,pe=Math.abs(-dx*sn+dy*c);
            if(al>=0&&al<=len&&pe<13+pl.r-2){hurtPlayer(e.dmg*1.4,e,true);break;}}});
        if(again)cross(base+Math.PI/4,.55,false);}});};
    e.atkT=1.7*rage;cross(Math.random()<.5?0:Math.PI/4,.85*rage,rage<1);
  }
}

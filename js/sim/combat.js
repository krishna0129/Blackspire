'use strict';
// Blackspire: Hit detection, damage, skills, spells, boss chamber.

/* ---------- world helpers ---------- */
function solid(px,py){const tx=Math.floor(px/TILE),ty=Math.floor(py/TILE);if(tx<0||ty<0||tx>=MW||ty>=MH)return true;return G.map[ty*MW+tx]!==1;}
const boxSolid=(x,y,r)=>solid(x-r,y-r)||solid(x+r,y-r)||solid(x-r,y+r)||solid(x+r,y+r);
function moveEnt(e,dx,dy){
  const r=e.cr,stepN=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/6));dx/=stepN;dy/=stepN;
  for(let i=0;i<stepN;i++){if(!boxSolid(e.x+dx,e.y,r))e.x+=dx;if(!boxSolid(e.x,e.y+dy,r))e.y+=dy;}
}
// line of sight through the tile map, so nothing reaches through walls or a sealed gate
function los(x1,y1,x2,y2){const n=Math.ceil(hyp(x2-x1,y2-y1)/6);for(let i=1;i<n;i++){const u=i/n;if(solid(x1+(x2-x1)*u,y1+(y2-y1)*u))return false;}return true;}
const after=(t,fn)=>G.timers.push({t,fn});

/* ---------- combat ---------- */
function hitArc(ang,arcDeg,range,mult,o){
  let n=0;const half=arcDeg/2*Math.PI/180;
  for(const e of G.enemies){if(e.dead)continue;const dx=e.x-P.x,dy=e.y-P.y,d=hyp(dx,dy)-e.r;if(d>range||!los(P.x,P.y,e.x,e.y))continue;
    if(arcDeg<360&&d>2&&Math.abs(angDiff(Math.atan2(dy,dx),ang))>half+Math.atan2(e.r,Math.max(4,d+e.r))*.8)continue;
    if(damageEnemy(e,mult,o))n++;}
  if(n)gainMomentum();
  // break incoming shots
  for(const p of G.proj){const dx=p.x-P.x,dy=p.y-P.y;if(hyp(dx,dy)<range+2&&(arcDeg>=360||Math.abs(angDiff(Math.atan2(dy,dx),ang))<half)){p.life=0;burst(p.x,p.y,4,'#6fd6e6',30);}}
  return n;
}
function hitLine(ang,len,wid,mult,o){
  const c=Math.cos(ang),s=Math.sin(ang);let n=0;
  for(const e of G.enemies){if(e.dead)continue;const dx=e.x-P.x,dy=e.y-P.y,al=dx*c+dy*s,pe=Math.abs(-dx*s+dy*c);
    if(al>-e.r&&al<len+e.r&&pe<wid+e.r&&los(P.x,P.y,e.x,e.y)&&damageEnemy(e,mult,o))n++;}
  if(n)gainMomentum();
  return n;
}
// Quickening: one stack per attack that lands (a swing, a shot, a skill), however many enemies it hits.
function gainMomentum(){if(ST.p.momentum){P.mom=Math.min(5,P.mom+1);P.momT=3;}}
// Returns true if the blow landed, false if it was blocked or the target was already dead.
function damageEnemy(e,mult,o={}){
  if(e.dead||e.burrowed)return false;   // an Ossuary hermit under the floor is out of reach
  // A bone knight's shield stops anything that comes from the side it faces, unless it is mid-swing or reeling.
  if(ETYPES[e.type].shield&&!e.boss&&e.stun<=0&&(e.state==='chase'||e.state==='idle')){
    const fa=DIR_ANGLE[e.dir||0];
    if(Math.abs(angDiff(Math.atan2((o.fy??P.y)-e.y,(o.fx??P.x)-e.x),fa))<1.05){
      if(G.time-(e.blkT??-9)>.6){e.blkT=G.time;addNum(e.x,e.y-e.r-13,'BLOCK','resist');sfx('block');}
      burst(e.x+Math.cos(fa)*7,e.y+Math.sin(fa)*7,3,'#c3cad6',40);if(e.state==='idle')e.state='chase';return false;}
  }
  let d=ST.dmg*mult*rand(.9,1.1);const crit=o.crit||Math.random()*100<ST.crit;
  if(crit)d*=ST.critDmg/100;
  if(ST.p.execute&&e.hp/e.maxHp<.3)d*=1+ST.p.execute/100;
  if(ST.p.giant&&(e.boss||e.elite))d*=1+ST.p.giant/100;
  if(e.sunder>0)d*=1.25;
  const T=ETYPES[e.type];
  if(o.burn&&T.weak&&T.weak.fire)d*=T.weak.fire;   // fire: Fireball's blast (its burn is scaled the same way below)
  if(e.state==='shell')d*=.4;                       // a hermit's skull shell
  // melee hits land with a beat of freeze-frame and stagger whatever they hit
  if(o.melee){hitstop(crit?.075:.045);if(!e.boss&&!ETYPES[e.type].heavy){e.stun=Math.max(e.stun,.2);if(e.state==='windup'||e.state==='draw')e.state='chase';}}   // a hit breaks a light enemy's attack
  const resisted=ST.magic&&e.mres>0;if(resisted)d*=1-e.mres;
  d=Math.max(1,Math.round(d));
  e.hp-=d;e.flash=.09;e.hurtT=4;if(e.state==='idle'){if(e.boss)wakeBoss();else e.state='chase';}
  addNum(e.x,e.y-e.r-5,d,resisted?'resist':crit?'crit':'hit');
  if(resisted){if(G.time-e.resT>1.8){e.resT=G.time;addNum(e.x,e.y-e.r-13,'RESIST','resist');}}
  burst(e.x,e.y,crit?6:3,crit?'#ffe9a8':'#b9b4c8',crit?70:45);
  sfx(crit?'crit':'hit');
  if(ST.p.lifesteal)heal(d*ST.p.lifesteal/100);
  if(!o.noProc){
    if(ST.p.bleed){e.bleedT=3;e.bleedDps=ST.dmg*ST.p.bleed/100/3;}
    if(ST.p.stagger&&Math.random()*100<ST.p.stagger)e.stun=Math.max(e.stun,e.boss?.2:.8);
    if(ST.p.spark&&Math.random()*100<ST.p.spark){let best=null,bd=64;for(const q of G.enemies){if(q===e||q.dead)continue;const dd=hyp(q.x-e.x,q.y-e.y);if(dd<bd){bd=dd;best=q;}}
      if(best){vfx({k:'bolt',x:e.x,y:e.y,x2:best.x,y2:best.y,t:0,d:.14});damageEnemy(best,mult*.5,{noProc:true,kb:0});}}
  }
  if(o.stun)e.stun=Math.max(e.stun,e.boss?o.stun*.25:o.stun);
  if(o.sunder)e.sunder=o.sunder;
  if(o.burn&&ST.p.ember){e.bleedT=3;e.bleedDps=ST.dmg*ST.p.ember/100/3*(1-e.mres)*(T.weak&&T.weak.fire||1);}
  if(e.state==='channel'){e.state='chase';e.chan=null;e.raiseCd=1.5;burst(e.x,e.y-8,6,'#9be08a',40);sfx('block');}   // any hit breaks a Gravecaller's channel
  if(!e.boss&&!T.rooted){const a=Math.atan2(e.y-(o.fy??P.y),e.x-(o.fx??P.x)),k=(o.kb??ST.kb)*(o.melee?1.5:1)*(ETYPES[e.type].heavy?.4:1);e.kx+=Math.cos(a)*k;e.ky+=Math.sin(a)*k;}
  if(e.hp<=0)killEnemy(e);
  return true;
}
function wakeBoss(){
  const b=G.bossEnt;if(!b||b.dead||G.bossAwake)return;
  G.bossAwake=true;b.state='chase';bossBar(b.name);banner(b.name,'Floor '+G.n+' boss',2600);sfx('boss');shake(6);
}
// Every player on the floor shares the kill: each gets the experience and their own roll of the loot.
function killEnemy(e){
  if(e.dead)return;
  if(ETYPES[e.type].dummy){e.hp=1;return;}   // a training scarecrow can't fall, however hard it is hit
  e.dead=true;sfx('kill');
  burst(e.x,e.y,e.boss?40:10,'#3a3a4c',e.boss?120:60);burst(e.x,e.y,e.boss?14:3,ETYPES[e.type].eye,70);
  const T=ETYPES[e.type];
  if(T.corpse&&!e.collect)G.corpses.push({x:e.x,y:e.y,t:6});   // a thrall leaves its body behind, for a Gravecaller to raise
  forPlayers(pl=>{
    S.kills++;if(e.raised)return;   // the raised dead give nothing: no experience, no loot, so raising cannot be farmed
    gainXp(T.xp*(1+.3*(G.n-1))*(e.elite?3:1));
    dropLoot(e.boss?'boss':e.elite?'elite':'normal',e.x,e.y);
    if(e.boss){
      const fs=floorState(G.n),first=!fs.boss;fs.boss++;S.best=Math.max(S.best,G.n+1);
      fs.shops=[];   // a fallen boss restocks this floor's traders
      bannerMe(first?'Floor '+G.n+' cleared':e.name+' falls again',first?'The chamber is open and the way up is waiting.':'The traders on this floor have restocked.',3600);
      if(!P.dead)P.hp=ST.maxHp;persist();
    }
  });
  if(e.boss){G.gate={x:(G.boss.x+G.boss.w/2)*TILE,y:(G.boss.y+2.5)*TILE};shake(8);sfx('gate');openGates();bossBar(null);}
}
// Every drop goes through here. (ox,oy) is where it came from (the enemy or chest). If the landing
// spot is inside a wall, or on the far side of one, it is pulled back toward the origin until it is on open floor.
function drop(d,ox,oy){
  const bad=(x,y)=>boxSolid(x,y,3)||!los(ox,oy,x,y);
  if(bad(d.x,d.y)){let ok=false;
    for(let i=1;i<=8&&!ok;i++){const u=i/8,x=d.x+(ox-d.x)*u,y=d.y+(oy-d.y)*u;if(!bad(x,y)){d.x=x;d.y=y;ok=true;}}
    if(!ok){d.x=P.x;d.y=P.y;}}
  d.t=0;d.owner=P.id;d.uid=++G.did;G.drops.push(d);   // loot is personal: only its owner sees and picks it up
}
function dropShards(x,y,n){while(n>0){const a=Math.min(n,n>12?5:1);n-=a;drop({k:'shard',amt:a,x:x+rand(-8,8),y:y+rand(-8,8)},x,y);}}
// Rolls the current player's share of a LOOT table entry (data.js) and drops it around (x,y).
function dropLoot(kind,x,y){
  const L=LOOT[kind],sp=kind==='boss'?18:kind==='chest'?12:6;
  dropShards(x,y,Math.round(rand(L.shards[0],L.shards[1])*(1+.25*(G.n-1))));
  const m={};for(const k in L.mats){const[c,lo,hi]=L.mats[k];m[k]=Math.random()<c?Math.round(rand(lo,hi)):0;}dropMats(x,y,m);
  for(const q of L.items)if(Math.random()<q.chance)dropItem(x+rand(-sp,sp),y+rand(-sp,sp),randomItem(G.n+q.ilvl,q.bonus,q.minRar),x,y);
  for(const k in SUPPLIES)for(const c of L[SUPPLIES[k].key]||[])if(Math.random()<c)drop({k,x:x+rand(-sp,sp),y:y+rand(-sp,sp)},x,y);
}
function dropMats(x,y,m){for(const id in m)if(m[id]>0)drop({k:'mat',id,amt:m[id],x:x+rand(-9,9),y:y+rand(-9,9)},x,y);}
function dropItem(x,y,it,ox=x,oy=y){drop({k:'item',item:it,x,y},ox,oy);}
function gainXp(v){
  const c=S.char;c.xp+=Math.round(v*(1+(ST.g.xp||0)/100));
  while(c.xp>=xpNeed(c.level)){c.xp-=xpNeed(c.level);c.level++;c.pts+=3;calcStats();P.hp=ST.maxHp;P.mp=ST.maxMp;
    bannerMe('Level '+c.level,'3 attribute points to spend. Open Gear.',2600);sfx('lvl');burst(P.x,P.y,24,'#6fd6e6',90);}
}
function heal(v){P.hp=Math.min(ST.maxHp,P.hp+v);}
// sure = telegraphed boss attack, which dexterity cannot evade. from = where a shot came from.
// ground = it comes up from under your feet, so no shield can stop it: the answer is to move.
function hurtPlayer(dmg,src,sure,from,ground){
  if(P.inv>0||P.dead||god)return;
  // Blocking: a raised shield stops blows that come from the side you face. Each one costs mana.
  const o=from||src;
  if(P.blocking&&o&&ST.shield&&!ground){
    const SH=SHIELDS[ST.shield];
    if(Math.abs(angDiff(Math.atan2(o.y-P.y,o.x-P.x),DIR_ANGLE[P.dir]))<=SH.arc*Math.PI/360){
      if(P.mp>=SH.cost){
        P.mp-=SH.cost;const cut=sure?SH.sure:SH.cut,parry=!sure&&P.blockT<.25;   // raising it just in time is a parry
        addNum(P.x,P.y-16,'BLOCK','evade');sfx('block');burst(P.x+Math.cos(DIR_ANGLE[P.dir])*8,P.y+Math.sin(DIR_ANGLE[P.dir])*8,4,'#c3cad6',45);
        if(parry&&src&&!src.boss&&!src.dead)src.stun=Math.max(src.stun||0,.9);
        if(cut>=1||parry){P.inv=.15;return;}
        dmg*=1-cut;
      }else if(G.time-P.lastBreak>2.5){P.lastBreak=G.time;log('No mana left to hold the block.');}
    }
  }
  if(!sure&&ST.evade>0&&Math.random()*100<ST.evade){P.inv=.2;addNum(P.x,P.y-16,'DODGE','evade');return;}
  let d=dmg*100/(100+ST.def);if(P.ward>0&&ST.p.ward)d*=1-ST.p.ward/100;if(P.guard>0)d*=.4;
  d=Math.max(1,Math.round(d));
  P.hp-=d;P.inv=.45;shake(4,true);addNum(P.x,P.y-16,d,'hurt');sfx('hurt');hurtFlash();
  if(ST.g.thorns&&src&&!src.dead){const t=Math.max(1,Math.round(dmg*ST.g.thorns/100));src.hp-=t;src.flash=.09;addNum(src.x,src.y-src.r-5,t,'bleed');if(src.hp<=0)killEnemy(src);}
  if(P.hp<=0)die();
}
function die(){
  P.dead=true;P.hp=0;P.swing=P.dash=null;S.deaths++;const lost=Math.floor(S.shards*.2);S.shards-=lost;S.hp=null;
  S.food=Math.max(50,Math.round(P.food));S.drink=Math.max(50,Math.round(P.drink));S.buff=null;P.buff=null;persist();   // you wake up at least half fed
  onDeath(lost,S.cpFloor===G.n&&S.cp>0);   // cp: whether they wake in a safe room (true) or at the entrance
}

function startSwing(){
  const aspd=ST.aspd*(1+P.mom*(ST.p.momentum||0)/100);
  P.atkCd=1/aspd;
  // A swing commits you: it always sweeps the same way across the direction you face, with a short step forward.
  P.swing={t:0,d:clamp(.42/aspd,.1,.34),a:P.aim,hit:false,dir:1};if(!ST.magic&&!ST.ranged)P.lunge=.07;sfx(ST.magic?'cast':'swing');
  // Bone soldiers watch the blade: one in front of a melee swing may hop back out of reach.
  if(!ST.magic&&!ST.ranged)for(const e of G.enemies){
    if(e.dead||ETYPES[e.type].ai!=='stalfos'||e.state!=='chase'||e.stun>0||e.hopCd>0)continue;
    const dx=e.x-P.x,dy=e.y-P.y,d=hyp(dx,dy)||1;
    if(d<ST.range+16&&Math.abs(angDiff(Math.atan2(dy,dx),P.aim))<1.2&&Math.random()<.5){e.state='hop';e.t=e.hopT=.24;e.hvx=dx/d*150;e.hvy=dy/d*150;e.hopCd=2;}
  }
}
function slashFx(a,arc,r,dir=1,d=.16){vfx({k:'slash',x:P.x,y:P.y,a,arc,r,dir,t:0,d});}
function sheathed(){if(G.time-P.lastSheath>3.5){P.lastSheath=G.time;log('Weapons stay sheathed in a safe room.');}}
function useSkill(){
  if(P.dead||P.skillCd>0)return;
  if(P.safe){sheathed();return;}
  const id=ST.skill,sk=SKILLS[id],a=P.aim;
  if(P.mp<sk.mp){if(G.time-P.lastNoMana>.8){P.lastNoMana=G.time;addNum(P.x,P.y-18,'NO MANA','mana');}return;}
  P.mp-=sk.mp;
  P.skillMax=P.skillCd=sk.cd*(1-ST.cdr/100)*(id==='heal'?1-(ST.p.quick||0)/100:1);sfx(id==='heal'?'heal':'skill');
  if(id==='circle'){hitArc(0,360,ST.range*1.35,2.2,{kb:120});slashFx(a,360,ST.range*1.35,1,.24);shake(4);}
  else if(id==='blink'){
    let best=null,bd=150;for(const e of G.enemies){if(e.dead)continue;const d=hyp(e.x-P.x,e.y-P.y);if(d<bd&&los(P.x,P.y,e.x,e.y)){bd=d;best=e;}}
    burst(P.x,P.y,10,'#55556a',50);
    if(best){const dir=Math.atan2(best.y-P.y,best.x-P.x);let tx=best.x+Math.cos(dir)*(best.r+9),ty=best.y+Math.sin(dir)*(best.r+9);
      if(boxSolid(tx,ty,P.cr)){tx=best.x-Math.cos(dir)*(best.r+9);ty=best.y-Math.sin(dir)*(best.r+9);}
      if(!boxSolid(tx,ty,P.cr)){P.x=tx;P.y=ty;P.tp++;}
      P.dir=dirOf(Math.atan2(best.y-P.y,best.x-P.x));P.aim=DIR_ANGLE[P.dir];P.inv=Math.max(P.inv,.35);if(damageEnemy(best,3,{crit:true,melee:true}))gainMomentum();slashFx(P.aim,120,ST.range+6);}
    else{P.dash={t:.12,vx:Math.cos(a)*300,vy:Math.sin(a)*300};P.inv=Math.max(P.inv,.2);}
  }
  else if(id==='sunder'){hitArc(a,170,ST.range*1.35,2.8,{sunder:4,kb:90});slashFx(a,170,ST.range*1.35,1,.22);shake(6);}
  else if(id==='guard'){P.guard=5;vfx({k:'ring',x:P.x,y:P.y,r:24,t:0,d:.3});burst(P.x,P.y,12,'#e6e1d3',50);}
  else if(id==='pierce'){hitLine(a,120,9,2.5,{kb:50});vfx({k:'line',x:P.x,y:P.y,a,len:122,t:0,d:.2,w:1});shake(3);}
  else if(id==='volley'){for(let i=-2;i<=2;i++)fireArrow(a+i*.15,.8);}
  else if(id==='fireball'){G.pproj.push({k:'fire',owner:P.id,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*135,vy:Math.sin(a)*135,life:1.25});}
  else if(id==='heal')castHeal();
}
/* ---------- shots and spells ---------- */
function castBolt(){const a=P.aim,v=190;G.pproj.push({k:'bolt',owner:P.id,mult:1,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:ST.range/v});}
function fireArrow(a,mult){const v=260;G.pproj.push({k:'arrow',owner:P.id,a,mult,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:ST.range/v});}
// Fire burns bodies to ash: they can no longer be raised.
function burnCorpses(x,y,R){G.corpses=G.corpses.filter(c=>{if(hyp(c.x-x,c.y-y)>R+4)return true;burst(c.x,c.y,10,'#f08a3c',50);burst(c.x,c.y,6,'#3a3a3a',30);return false;});}
function explode(x,y){
  const R=30*(1+(ST.p.blast||0)/100);
  let n=0;for(const e of G.enemies){if(!e.dead&&hyp(e.x-x,e.y-y)<R+e.r&&los(x,y,e.x,e.y)&&damageEnemy(e,2.6,{kb:70,fx:x,fy:y,burn:true}))n++;}
  if(n)gainMomentum();
  burnCorpses(x,y,R);
  vfx({k:'boom',x,y,r:R,t:0,d:.34});burst(x,y,22,'#f08a3c',110);burst(x,y,10,'#ffe9a8',60);shake(4);sfx('boom');
}
// Heal is an area effect around the caster. It only ever walks the list of allies, so enemies
// standing in the circle get nothing. Every player on the floor is an ally.
const HEAL_R=70;
const allies=()=>G.players.filter(q=>!q.gone);
function castHeal(){
  const amt=healAmount();
  for(const t of allies()){if(t.dead||hyp(t.x-P.x,t.y-P.y)>HEAL_R)continue;
    t.hp=Math.min(t.ST.maxHp,t.hp+amt);addNum(t.x,t.y-18,'+'+amt,'heal');}
  if(ST.p.mend)P.hot={t:5,rate:amt*ST.p.mend/100/5};
  if(ST.p.ward)P.ward=4;
  vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R,t:0,d:.95});
}
/* ---------- boss chamber ---------- */
// Steps the current player through gate q into the chamber, which seals behind them until the boss dies.
function enterChamber(q){
  if(!q||G.gatesOpen||!G.bossEnt||G.bossEnt.dead||P.dead)return;
  burst(P.x,P.y,10,'#7a2a32',50);P.x=q.ix;P.y=q.iy;P.tp++;P.dash=null;P.locked=true;
  // whatever was chasing you is left outside, unless someone else is still out there for it to fight
  if(G.players.every(q=>q.locked||q.dead||q.gone)){G.proj=[];for(const e of G.enemies)if(!e.boss&&e.state!=='idle')e.state='idle';}
  sfx('lock');wakeBoss();
}
function dodge(){
  if(P.dead||P.dodgeCd>0||P.dash)return;
  let mx=P.in.mx,my=P.in.my;if(!mx&&!my){mx=Math.cos(P.aim);my=Math.sin(P.aim);}const m=hyp(mx,my);
  P.dash={t:.16,vx:mx/m*ST.move*3.3,vy:my/m*ST.move*3.3};P.inv=Math.max(P.inv,.3);P.dodgeCd=.9;
}
function usePotion(){
  if(P.dead||P.potCd>0||S.potions<=0||P.hp>=ST.maxHp)return;
  S.potions--;P.potCd=1.2;heal(ST.maxHp*.45);burst(P.x,P.y,12,'#d9534f',50);sfx('pick');
}
// Eating a ration or drinking from a flask: refills its meter. Nothing happens when the meter is already full.
function useSupply(k){
  const s=SUPPLIES[k];if(P.dead||P.eatCd>0||!s.need||(S[s.key]||0)<=0||P[s.need]>=99)return;
  S[s.key]--;if(k==='flask')S.empties=(S.empties||0)+1;   // the flask is kept, empty
  P.eatCd=.6;P[s.need]=Math.min(100,P[s.need]+s.gives);burst(P.x,P.y,8,s.color,40);sfx('pick');
}
// declared as functions so the server can call them on its sandbox (R.eat, R.drink)
function eat(){useSupply('ration');}
function drink(){useSupply('flask');}

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
// How much of a blow of this type an enemy shrugs off (a fraction; negative is a weakness). Elements are cut by its
// resistance to magic (mres) and its family's resistance to that element; rot and physical by its family's only.
function resOf(e,type){const F=FAMILIES[famOf(e)],r=(F&&F.res&&F.res[type]||0)/100;return DTYPES[type]&&DTYPES[type].elem?(e.mres||0)+r:r;}
// Returns true if the blow landed, false if it was blocked or the target was already dead.
// o.tags: the blow's tags (TAGS), when it is not the basic attack; o.type: its damage type, if not the tags'.
function damageEnemy(e,mult,o={}){
  if(e.dead||e.burrowed)return false;   // an Ossuary hermit under the floor is out of reach
  // A bone knight's shield stops anything that comes from the side it faces, unless it is mid-swing or reeling.
  if(ETYPES[e.type].shield&&!e.boss&&e.stun<=0&&(e.state==='chase'||e.state==='idle')){
    const fa=DIR_ANGLE[e.dir||0];
    if(Math.abs(angDiff(Math.atan2((o.fy??P.y)-e.y,(o.fx??P.x)-e.x),fa))<1.05){
      if(G.time-(e.blkT??-9)>.6){e.blkT=G.time;addNum(e.x,e.y-e.r-13,'BLOCK','resist');sfx('block');}
      burst(e.x+Math.cos(fa)*7,e.y+Math.sin(fa)*7,3,'#c3cad6',40);if(e.state==='idle')e.state='chase';return false;}
  }
  // What the blow is: its tags (the skill's, or the basic attack's) and so its damage type.
  const tags=o.tags||ST.tags,type=o.type||(o.burn?'fire':dtypeOf(tags));   // burn: a fire blast
  P.fightT=G.time;   // in combat (the skill board waits until it is over)
  let d=ST.dmg*mult*rand(.9,1.1);const crit=o.crit||Math.random()*100<ST.crit;
  if(crit)d*=ST.critDmg/100;
  // "Increased" damage from the skill tree: every tag the blow carries adds its share, all in one sum.
  let inc=0;for(const t of tags)inc+=ST.inc[t]||0;d*=1+inc/100;
  // Everything that reads "% more damage" adds up in one bucket and is applied once, so no two of them multiply each
  // other: Executioner's, Giant-slaying, Sunder's mark, and a forged weapon's bonus against this enemy's family.
  const bane=ST.vs[famOf(e)]||0;
  let more=bane;
  if(ST.p.execute&&e.hp/e.maxHp<.3)more+=ST.p.execute;
  if(ST.p.giant&&(e.boss||e.elite))more+=ST.p.giant;
  if(e.sunder>0)more+=25;
  if(P.berserkT>0)more+=40;                                    // Berserk
  if(e.tauntBy===P.id&&G.time<e.tauntT)more+=40;              // Challenge: it takes more from the one who marked it
  if(e.staggerT>0)more+=COMBAT.epoise.more;   // its poise is broken: it reels, and takes more
  d*=1+more/100;
  const T=ETYPES[e.type];
  if(T.weak&&T.weak[type])d*=T.weak[type];        // a weakness to a type: Thornroot to fire (its burn is scaled the same way below)
  if(e.state==='shell')d*=.4;                       // a hermit's skull shell
  // melee hits land with a beat of freeze-frame and stagger whatever they hit
  if(o.melee){hitstop(crit?.075:.045);if(!e.boss&&!ETYPES[e.type].heavy){e.stun=Math.max(e.stun,.2);if(e.state==='windup'||e.state==='draw')e.state='chase';}}   // a hit breaks a light enemy's attack
  const res=resOf(e,type),resisted=res>0;d*=1-res;
  d=Math.max(1,Math.round(d));
  e.hp-=d;e.flash=.09;e.hurtT=4;if(e.state==='idle'){if(e.boss)wakeBoss();else e.state='chase';}
  wearPoise(e,ST.dmg*mult*ST.pz*(o.pz??1));
  // what skills leave on a blow: a slow, poison, a Death Mark counting, Berserk's healing
  if(o.slow){e.slowT=Math.max(e.slowT||0,o.slow);e.slowF=.6;}
  if(o.poison){e.bleedT=4;e.bleedDps=Math.max(e.bleedDps||0,ST.dmg*.6/4);e.bleedAcc=e.bleedAcc||0;}
  if(e.mark&&e.mark.by===P.id)e.mark.acc+=d;
  if(P.berserkT>0)heal(d*.1);
  addNum(e.x,e.y-e.r-5,d,resisted?'resist':crit?'crit':bane?'bane':'hit');
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
  // a skill's challenges (tree.js): this use hit one more enemy, and perhaps killed it
  if(o.use){o.use.hits++;skillCount(o.use.skill,'hit',{hits:o.use.hits});if(e.dead)skillCount(o.use.skill,'kill',{e});}
  return true;
}
// An enemy's poise (COMBAT.epoise): a share of its health, worn down by blows (heavier weapons wear it faster). Broken,
// the enemy is staggered for a moment and takes more damage; then its poise is whole again.
function wearPoise(e,v){
  if(e.dead||ETYPES[e.type].dummy)return;
  const E=COMBAT.epoise;
  if(e.maxPoise==null){e.maxPoise=e.maxHp*(e.boss?E.boss:e.elite?E.elite:E.share);e.poise=e.maxPoise;}
  if(e.staggerT>0)return;
  e.poise-=v;e.poiseT=G.time;
  if(e.poise<=0){const t=e.boss?E.bossStun:E.stun;e.staggerT=t;e.stun=Math.max(e.stun||0,t);e.poise=e.maxPoise;
    if(e.state==='windup'||e.state==='draw'||e.state==='cast'||e.state==='channel')e.state='chase';
    addNum(e.x,e.y-e.r-13,'STAGGERED','crit');burst(e.x,e.y-6,10,'#ffe9a8',60);sfx('crit');}
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
    gainXp(T.xp*(1+.3*(G.n-1))*(e.elite?3:1));questKill(e);
    dropLoot(e.boss?'boss':e.elite?'elite':'normal',e.x,e.y,e);
    if(e.boss){
      const fs=floorState(G.n),first=!fs.boss;fs.boss++;S.best=Math.max(S.best,G.n+1);
      fs.shops=[];floorState(0).shops=[];   // a fallen boss restocks this floor's traders, and the village market
      bannerMe(first?'Floor '+G.n+' cleared':e.name+' falls again',first?'The chamber is open and the way up is waiting.':'This floor’s traders and the village market have restocked.',3600);
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
// Rolls the current player's share of a LOOT table entry (data.js) and drops it around (x,y). e: the enemy that
// died, if one did: its family decides which monster drop can fall (an ordinary enemy's type may set its own roll).
function dropLoot(kind,x,y,e){
  const L=LOOT[kind],sp=kind==='boss'?18:kind==='chest'?12:6;
  dropShards(x,y,Math.round(rand(L.shards[0],L.shards[1])*(1+.25*(G.n-1))));
  const m={};for(const k in L.mats){const[c,lo,hi]=L.mats[k];m[k]=Math.random()<c?Math.round(rand(lo,hi)):0;}
  const fam=famOf(e),fr=fam&&(kind==='normal'&&ETYPES[e.type].famDrop||L.fam);
  if(fr&&Math.random()<fr[0])m[FAMILIES[fam].mat]=Math.round(rand(fr[1],fr[2]));
  dropMats(x,y,m);
  for(const q of L.items)if(Math.random()<q.chance)dropItem(x+rand(-sp,sp),y+rand(-sp,sp),randomItem(G.n+q.ilvl,q.bonus,q.minRar),x,y);
  for(const k in SUPPLIES)for(const c of L[SUPPLIES[k].key]||[])if(Math.random()<c)drop({k,x:x+rand(-sp,sp),y:y+rand(-sp,sp)},x,y);
}
function dropMats(x,y,m){for(const id in m)if(m[id]>0)drop({k:'mat',id,amt:m[id],x:x+rand(-9,9),y:y+rand(-9,9)},x,y);}
function dropItem(x,y,it,ox=x,oy=y){drop({k:'item',item:it,x,y},ox,oy);}
function gainXp(v){
  const c=S.char;c.xp+=Math.round(v*(1+(ST.g.xp||0)/100)*(P.rested>0?1+REST_XP/100:1));   // well rested: a night at the inn
  while(c.xp>=xpNeed(c.level)){c.xp-=xpNeed(c.level);c.level++;c.pts+=3;calcStats();P.hp=ST.maxHp;P.mp=ST.maxMp;
    bannerMe('Level '+c.level,'3 attribute points to spend. Open Gear.',2600);sfx('lvl');burst(P.x,P.y,24,'#6fd6e6',90);}
}
function heal(v){P.hp=Math.min(ST.maxHp,P.hp+v);}
// sure = telegraphed boss attack, which dexterity cannot evade. from = where a shot came from (and the family of
// whoever fired it). Armour and boots forged against the attacker's family take their share off the damage.
// ground = it comes up from under your feet, so no shield can stop it: the answer is to move.
function hurtPlayer(dmg,src,sure,from,ground){
  if(P.inv>0||P.dead||god||P.vanishT>0)return;   // Vanish: nothing touches you
  const o=from||src,C=COMBAT;
  const type=(from&&from.dtype)||(src&&ETYPES[src.type]&&ETYPES[src.type].dtype)||'physical',magic=type!=='physical';
  const heavy=!magic&&!!(sure||(src&&(src.boss||(ETYPES[src.type]&&ETYPES[src.type].heavy))));
  const facing=arc=>o&&Math.abs(angDiff(Math.atan2(o.y-P.y,o.x-P.x),P.aim))<=arc*Math.PI/360;
  // Parry: block pressed just before the blow, facing it, with a shield, a sword or a dagger. Nothing gets through,
  // and the attacker is staggered (a boss only briefly). Telegraphed area attacks and the ground can't be parried.
  // Riposte: for a moment every blow from the front is parried, free, and answered hard
  if(P.riposteT>0&&!sure&&!ground&&facing(160)){P.inv=.15;addNum(P.x,P.y-16,'RIPOSTE','crit');sfx('block');
    if(src&&!src.dead&&src.maxHp){src.stun=Math.max(src.stun||0,src.boss?C.parry.bossStun:C.parry.stun);damageEnemy(src,3,{crit:true,melee:true,tags:SKILLS.riposte.tags});slashFx(Math.atan2(src.y-P.y,src.x-P.x),100,ST.range+6);}
    return;}
  if(ST.parry&&!sure&&!ground&&G.time-P.parryAt<C.parry.win&&facing(ST.shield?SHIELDS[ST.shield].arc:C.parry.arc)&&P.sta>=C.parry.cost){
    P.sta-=C.parry.cost;P.staT=G.time;P.parryAt=-9;P.inv=.15;
    addNum(P.x,P.y-16,'PARRY','evade');sfx('block');burst(P.x+Math.cos(P.aim)*8,P.y+Math.sin(P.aim)*8,8,'#ffe9a8',70);
    if(src&&!src.dead&&src.maxHp){src.stun=Math.max(src.stun||0,src.boss?C.parry.bossStun:C.parry.stun);if(src.state==='windup'||src.state==='strike')src.state='recover',src.t=Math.max(src.t||0,.4);}
    return;
  }
  // Blocking: a raised shield stops blows from the side you face. Each one costs stamina; without it, the block breaks.
  if(P.blocking&&o&&ST.shield&&!ground){
    const SH=SHIELDS[ST.shield];
    if(facing(SH.arc)){
      if(P.sta>=SH.cost){
        P.sta-=SH.cost;P.staT=G.time;const cut=sure?SH.sure:SH.cut;
        addNum(P.x,P.y-16,'BLOCK','evade');sfx('block');burst(P.x+Math.cos(P.aim)*8,P.y+Math.sin(P.aim)*8,4,'#c3cad6',45);
        push(o,heavy?C.kb.light:C.kb.light*.4);
        if(cut>=1){P.inv=.15;return;}
        dmg*=1-cut;
      }else{P.blocking=false;P.stagger=Math.max(P.stagger,C.kb.stagger);if(G.time-P.lastBreak>2.5){P.lastBreak=G.time;log('No stamina left: your guard breaks.');}}
    }
  }
  if(!sure&&ST.evade>0&&Math.random()*100<ST.evade){P.inv=.2;addNum(P.x,P.y-16,'DODGE','evade');return;}
  let d=dmg*100/(100+ST.def);if(P.ward>0&&ST.p.ward)d*=1-ST.p.ward/100;if(P.guard>0)d*=.4;if(P.cryT>0)d*=.7;   // Enduring Cry
  d*=1-(ST.res[famOf(from)||famOf(src)]||0)/100;
  d*=1-(ST.eres[type]||0)/100;   // resistances from the skill tree
  d=Math.max(1,Math.round(d));
  // an Aegis takes the blow first
  if(P.shield>0){const ab=Math.min(P.shield,d);P.shield-=ab;d-=ab;addNum(P.x,P.y-24,'-'+ab,'evade');if(d<=0){P.inv=.3;sfx('block');return;}}
  P.hp-=d;P.inv=.45;P.fightT=G.time;shake(4,true);addNum(P.x,P.y-16,d,'hurt');sfx('hurt');hurtFlash();
  // What the blow does to you: a push (magic and heavy blows push further), a stagger from a heavy one, and perhaps
  // an interruption: a spell you are casting holds by focus (Mind), anything else by poise (armour weight).
  if(!(P.berserkT>0)){push(o,magic?C.kb.magic:heavy?C.kb.heavy:C.kb.light);   // Berserk: nothing knocks you back
    if(heavy)P.stagger=Math.max(P.stagger,C.kb.stagger);}
  const casting=P.swing&&!P.swing.hit&&ST.magic;let broken=false;
  if(casting)broken=Math.random()*100>=ST.focus;
  else{P.poise-=heavy?C.poise.heavy:C.poise.light;P.poiseT=G.time;if(P.poise<=0){broken=true;P.poise=ST.maxPoise;P.stagger=Math.max(P.stagger,C.kb.stagger);}}
  if(broken&&P.swing&&!P.swing.hit){P.swing=null;P.atkCd=Math.max(P.atkCd,.25);addNum(P.x,P.y-24,'INTERRUPTED','resist');}
  if(ST.g.thorns&&src&&!src.dead){const t=Math.max(1,Math.round(dmg*ST.g.thorns/100));src.hp-=t;src.flash=.09;addNum(src.x,src.y-src.r-5,t,'bleed');if(src.hp<=0)killEnemy(src);}
  if(P.hp<=0)die();
}
// A push away from whatever struck (o), of strength k. Online the server sets it and the browser plays it out (kbN).
function push(o,k){const a=o?Math.atan2(P.y-o.y,P.x-o.x):P.aim+Math.PI;P.kx+=Math.cos(a)*k;P.ky+=Math.sin(a)*k;P.kbN++;}
function die(){
  P.dead=true;P.hp=0;P.swing=P.dash=null;P.emp=null;P.shield=0;S.deaths++;const lost=Math.floor(S.shards*.2);S.shards-=lost;S.hp=null;
  P.deadAt=G.time;P.deathLost=lost;   // a Templar can still undo it for a while (js/sim/skills.js, revive)
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
/* ---------- shots and spells ---------- */
function castBolt(mult=1){const a=P.aim,v=190;G.pproj.push({k:'bolt',owner:P.id,mult,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:ST.range/v});}
function fireArrow(a,mult,tags,use,f){const v=260;G.pproj.push({k:'arrow',f,owner:P.id,a,mult,tags,use,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:ST.range/v});}
// Fire burns bodies to ash: they can no longer be raised.
function burnCorpses(x,y,R){G.corpses=G.corpses.filter(c=>{if(hyp(c.x-x,c.y-y)>R+4)return true;burst(c.x,c.y,10,'#f08a3c',50);burst(c.x,c.y,6,'#3a3a3a',30);return false;});}
function explode(x,y,use){
  const R=30*(1+(ST.p.blast||0)/100);
  let n=0;for(const e of G.enemies){if(!e.dead&&hyp(e.x-x,e.y-y)<R+e.r&&los(x,y,e.x,e.y)&&damageEnemy(e,2.6,{kb:70,fx:x,fy:y,burn:true,tags:SKILLS.fireball.tags,use}))n++;}
  if(n)gainMomentum();
  burnCorpses(x,y,R);
  vfx({k:'boom',x,y,r:R,t:0,d:.34});burst(x,y,22,'#f08a3c',110);burst(x,y,10,'#ffe9a8',60);shake(4);sfx('boom');
}
// Heal is an area effect around the caster. It only ever walks the list of allies, so enemies
// standing in the circle get nothing. Every player on the floor is an ally.
const HEAL_R=70;
const allies=()=>G.players.filter(q=>!q.gone);
/* ---------- boss chamber ---------- */
// Steps the current player through gate q into the chamber, which seals behind them until the boss dies.
function enterChamber(q){
  if(!q||G.gatesOpen||!G.bossEnt||G.bossEnt.dead||P.dead)return;
  burst(P.x,P.y,10,'#7a2a32',50);P.x=q.ix;P.y=q.iy;P.tp++;P.dash=null;P.locked=true;
  // whatever was chasing you is left outside, unless someone else is still out there for it to fight
  if(G.players.every(q=>q.locked||q.dead||q.gone)){G.proj=[];for(const e of G.enemies)if(!e.boss&&e.state!=='idle')e.state='idle';}
  sfx('lock');wakeBoss();
}
// The dash (docs/design/combat.md): stamina, no invulnerability; how far depends on the class (casters dash short).
// It cancels a swing that has not landed.
function dodge(){
  if(P.dead||P.dodgeCd>0||P.dash||P.stagger>0)return;
  if(P.sta<COMBAT.sta.dash){if(G.time-(P.lastNoSta??-9)>.8){P.lastNoSta=G.time;addNum(P.x,P.y-18,'NO STAMINA','mana');}return;}
  P.sta-=COMBAT.sta.dash;P.staT=G.time;
  let mx=P.in.mx,my=P.in.my;if(!mx&&!my){mx=Math.cos(P.aim);my=Math.sin(P.aim);}const m=hyp(mx,my),v=ST.move*COMBAT.dashSpeed*ST.dashMul;
  if(P.swing&&!P.swing.hit)P.swing=null;
  P.dash={t:COMBAT.dashT,vx:mx/m*v,vy:my/m*v};P.dodgeCd=COMBAT.dashCd;
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

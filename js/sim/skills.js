// Blackspire: skills in four slots (docs/design/skills.md#the-playtests-skills-decided).
// Each class has a pool: everyday skills for Q, E and C, and ultimates for X (one of them). The character chooses
// which (S.char.slots, changed out of combat like the skill board). Every skill has its own cooldown (P.cds).
// Runs the same in the browser and on the server, like the rest of js/sim.

const SLOTS=['q','e','c','x'];
// Each class's pool. Skills listed here but not yet in SKILLS (data.js) are built class by class (the build plan's
// step 2) and are left out until they exist.
const CLASS_KIT={
  templar:{day:['heal','partyheal','renewal','aegis','revive','smite','guard'],ult:['judgement','massheal','resurrect']},
  marauder:{day:['sunder','guard','heavy','leap'],ult:['cry','quake','berserk']},
  duelist:{day:['circle','pierce','riposte','double'],ult:['cuts','challenge','storm']},
  ranger:{day:['volley','lightarrow','caustic','split'],ult:['rain','ballista','tornado']},
  shadow:{day:['blink','viper','vortex','smoke'],ult:['deathmark','dance','vanish']},
  witch:{day:['fireball','frostbolt','arc','icenova'],ult:['raise','meteor','blizzard']},
};
// what can go in a slot: Q, E and C hold everyday skills, X an ultimate; only skills that exist yet
function kitOf(cls,slot){const k=CLASS_KIT[cls];if(!k)return[];return(slot==='x'?k.ult:k.day).filter(id=>SKILLS[id]);}
// a new character's (or an old save's) slots: the first everyday skills, and the first ultimate
function defaultSlots(cls){const d=kitOf(cls,'q'),u=kitOf(cls,'x');return{q:d[0]||null,e:d[1]||null,c:d[2]||null,x:u[0]||null};}
// keep the slots to skills of the class, filling any gap (a class change, a skill renamed)
function tidySlots(c){
  const s=c.slots||(c.slots={}),used=new Set();
  for(const k of SLOTS){if(!kitOf(c.cls,k).includes(s[k])||used.has(s[k]))s[k]=null;if(s[k])used.add(s[k]);}
  for(const k of SLOTS)if(!s[k])s[k]=kitOf(c.cls,k).find(id=>!used.has(id))||null,s[k]&&used.add(s[k]);
  return s;
}

/* ---------- using a skill ---------- */
const cdLeft=id=>(P.cds&&P.cds[id])||0;
function useSkill(slot='q'){
  if(P.dead||P.stagger>0)return;
  if(P.safe){sheathed();return;}
  if(!ST.kit)return;   // an off-class weapon: no skills
  const id=(S.char.slots||{})[slot];if(!id||!SKILLS[id]||!kitOf(S.char.cls,slot).includes(id))return;
  if(cdLeft(id)>0)return;
  const sk=SKILLS[id],a=P.aim,tags=sk.tags,use={skill:id,hits:0};
  if(P.mp<sk.mp){if(G.time-P.lastNoMana>.8){P.lastNoMana=G.time;addNum(P.x,P.y-18,'NO MANA','mana');}return;}
  const fx=SKILL_FX[id];if(fx.can&&!fx.can())return;   // a skill with no one to use it on costs nothing
  P.mp-=sk.mp;skillCount(id,'use');P.fightT=G.time;
  const cd=sk.cd*(1-ST.cdr/100)*ST.cdMult*(id==='heal'?1-(ST.p.quick||0)/100:1);
  (P.cds||(P.cds={}))[id]=cd;(P.cdMax||(P.cdMax={}))[id]=cd;
  sfx(sk.sound||(tags.includes('aura')?'heal':'skill'));
  P.castId=id;P.castAt=G.time;   // for the renderer: which skill, when (its animation)
  fx.go(a,tags,use);
}

/* ---------- the helpers skills share ---------- */
const ALLY_R=210;
// The ally a targeted skill goes to: the one nearest the line you aim along (within reach); yourself if none.
function allyAimed(pred=t=>!t.dead){
  let best=null,bd=.5;
  for(const t of allies()){if(t===P||!pred(t))continue;const d=hyp(t.x-P.x,t.y-P.y);if(d>ALLY_R)continue;
    const off=Math.abs(angDiff(Math.atan2(t.y-P.y,t.x-P.x),P.aim));if(off<bd){bd=off;best=t;}}
  return best;
}
const healOn=(t,amt)=>{const before=t.hp;t.hp=Math.min(t.ST.maxHp,t.hp+amt);addNum(t.x,t.y-18,'+'+Math.round(amt),'heal');return t.hp-before;};
// Empowered attacks (docs/design/skills.md): the next basic attacks hit harder. "up front" skills paid on use;
// "per hit" skills cost a little mana each time one lands. P.emp is taken by each swing, shot or bolt as it lands.
function empower(o){P.emp=Object.assign({t:8,n:4,mult:1.6,per:0},o);}
// It returns what the attack carries: a damage multiplier (m), how hard it breaks poise (pz), whether it poisons.
const PLAIN={m:1,pz:1,poison:0};
function takeEmpower(){
  if(P.vanishT>0){P.vanishT=0;return{m:4,pz:2,poison:0,c:'#b9a8ff'};}   // the first blow out of Vanish
  const E=P.emp;if(!E||E.t<=0||E.n<=0){P.emp=null;return PLAIN;}
  if(E.per){if(P.mp<E.per){P.emp=null;addNum(P.x,P.y-18,'NO MANA','mana');return PLAIN;}P.mp-=E.per;}
  E.n--;if(E.n<=0)P.emp=null;
  burst(P.x+Math.cos(P.aim)*10,P.y+Math.sin(P.aim)*10,8,E.c||'#ffe9a8',60);
  return{m:E.mult,pz:E.pz||1,poison:E.poison||0,c:E.c};
}
// A fallen ally can be brought back for a while after the fall (docs/design/multiplayer.md#falling), with nothing lost.
const REVIVE_WINDOW=15;
const revivable=t=>t.dead&&!t.gone&&G.time-(t.deadAt??-99)<=REVIVE_WINDOW;
function revive(t,share){
  const me=P;setPlayer(t);
  P.dead=false;P.hp=Math.max(1,Math.round(ST.maxHp*share));P.inv=1.5;P.stagger=0;giveBack(S,P.lost);P.lost=null;
  revived();burst(P.x,P.y,20,'#ffe9a8',90);
  setPlayer(me);addNum(t.x,t.y-22,'REVIVED','heal');
}
// Effects that land later (Judgement's strikes): G.pfx, each with its owner, played out in updateSkillFx.
function later(o){G.pfx.push(Object.assign({t:0,owner:P.id},o));}
function updateSkillFx(dt){
  if(!G.pfx)return;
  for(const q of G.pfx){if(q.done)continue;q.t+=dt;const ow=playerById(q.owner);if(!ow||ow.dead&&q.dies){q.done=true;continue;}
    setPlayer(ow);
    if(q.tick){q.acc=(q.acc||0)+dt;if(LASTING[q.k].move)LASTING[q.k].move(q,dt);while(q.acc>=q.tick){q.acc-=q.tick;LASTING[q.k].go(q);}if(q.t>=q.d)q.done=true;}
    else if(q.t>=q.d){q.done=true;LANDING[q.k](q);}
  }
  G.pfx=G.pfx.filter(q=>!q.done);
}
// everything in a circle, from its centre (walls block)
function hitCircle(x,y,r,mult,o={}){let n=0;for(const e of G.enemies)if(!e.dead&&hyp(e.x-x,e.y-y)<r+e.r&&los(x,y,e.x,e.y)&&damageEnemy(e,mult,Object.assign({fx:x,fy:y},o)))n++;if(n)gainMomentum();return n;}
// the enemy you aim at: nearest the line you aim along (within reach), else the nearest
function enemyAimed(range){
  let best=null,bd=.6,near=null,nd=range;
  for(const e of G.enemies){if(e.dead||!los(P.x,P.y,e.x,e.y))continue;const d=hyp(e.x-P.x,e.y-P.y);if(d>range)continue;
    const off=Math.abs(angDiff(Math.atan2(e.y-P.y,e.x-P.x),P.aim));if(off<bd){bd=off;best=e;}if(d<nd){nd=d;near=e;}}
  return best||near;
}
// lightning that leaps from one enemy to the next nearest, n times
function chain(from,n,mult,tags,use,range=70){
  const hit=new Set([from]);let cur=from;
  for(let i=0;i<n;i++){let nx=null,nd=range;for(const e of G.enemies){if(e.dead||hit.has(e))continue;const d=hyp(e.x-cur.x,e.y-cur.y);if(d<nd&&los(cur.x,cur.y,e.x,e.y)){nd=d;nx=e;}}
    if(!nx)break;hit.add(nx);vfx({k:'bolt',x:cur.x,y:cur.y,x2:nx.x,y2:nx.y,t:0,d:.2});damageEnemy(nx,mult,{tags,use});cur=nx;}
}
// a player enemies cannot find: vanished, or standing in a smoke cloud
const hidden=pl=>pl.vanishT>0||(G.pfx||[]).some(q=>q.k==='smoke'&&hyp(pl.x-q.x,pl.y-q.y)<q.r);
// Effects that land once, after a delay (k: what to do when q.t reaches q.d).
const LANDING={
  judge:q=>{const n=hitCircle(q.x,q.y,q.r,2.2,{kb:40,w:2,c:'#ffe9a8',tags:SKILLS.judgement.tags,use:q.use});vfx({k:'pillar',x:q.x,y:q.y,r:q.r,c:'#ffe9a8',t:0,d:.4});vfx({k:'boom',x:q.x,y:q.y,r:q.r,t:0,d:.3,c:'#ffe9a8'});burst(q.x,q.y,16,'#ffe9a8',90);shake(3);sfx('boom');},
  shock:q=>{hitCircle(P.x,P.y,q.r,1.4,{kb:80,pz:2,w:1.6,tags:SKILLS.quake.tags,use:q.use});vfx({k:'quake',x:P.x,y:P.y,r:q.r,t:0,d:.5});shake(6);sfx('boom');},
  cut:q=>{const e=G.enemies.find(x=>x.id===q.e&&!x.dead);if(!e)return;damageEnemy(e,.9,{melee:true,w:q.i===7?2:1,tags:SKILLS.cuts.tags,use:q.use});vfx({k:'cut',x:e.x,y:e.y,a:q.i*2.4+rand(-.3,.3),len:e.r*2+26,t:0,d:.16});P.castAt=G.time;sfx('swing');},
  thrust:q=>{const L=ST.range+REACH.storm;hitLine(P.aim,L,10,2,{kb:40,w:1.5,tags:SKILLS.storm.tags,use:q.use});vfx({k:'thrust',x:P.x,y:P.y,a:P.aim,len:L+2,t:0,d:.2});P.castAt=G.time;sfx('thrust');},
  dance:q=>{const e=G.enemies.find(x=>x.id===q.e&&!x.dead);if(!e)return;const a=Math.atan2(P.y-e.y,P.x-e.x),tx=e.x+Math.cos(a)*(e.r+8),ty=e.y+Math.sin(a)*(e.r+8);
    burst(P.x,P.y,8,'#55556a',50);if(!boxSolid(tx,ty,P.cr)){P.x=tx;P.y=ty;P.tp++;}P.aim=Math.atan2(e.y-P.y,e.x-P.x);P.dir=dirOf(P.aim);
    damageEnemy(e,1.8,{crit:true,melee:true,w:1.5,c:'#b9a8ff',tags:SKILLS.dance.tags,use:q.use});vfx({k:'cut',x:e.x,y:e.y,a:P.aim+1.2,len:e.r*2+30,c:'#b9a8ff',t:0,d:.18});P.castAt=G.time;sfx('swing');},
  mark:q=>{const e=G.enemies.find(x=>x.id===q.e&&!x.dead);if(!e||!e.mark)return;const d=Math.round(e.mark.acc*.5);e.mark=null;if(d<1)return;
    e.hp-=d;e.flash=.15;e.hurtT=4;addNum(e.x,e.y-e.r-10,d,'crit');burst(e.x,e.y-6,22,'#b04a6a',110);vfx({k:'boom',x:e.x,y:e.y,r:26,c:'#c0507a',t:0,d:.35});vfx({k:'cut',x:e.x,y:e.y,a:.8,len:e.r*2+34,c:'#ff7aa8',t:0,d:.25});shake(5);hitstop(.08);sfx('hitHeavy');if(e.hp<=0)killEnemy(e);},
  meteor:q=>{hitCircle(q.x,q.y,q.r,3.5,{kb:140,burn:true,w:3,tags:SKILLS.meteor.tags,use:q.use});vfx({k:'quake',x:q.x,y:q.y,r:q.r,c:'#ff8a3a',t:0,d:.7});burnCorpses(q.x,q.y,q.r);vfx({k:'boom',x:q.x,y:q.y,r:q.r,t:0,d:.45});burst(q.x,q.y,30,'#f08a3c',140);shake(9);sfx('boom');},
  slam:q=>{hitCircle(P.x,P.y,34,2,{kb:110,pz:2,w:2.2,tags:SKILLS.leap.tags,use:q.use});vfx({k:'quake',x:P.x,y:P.y,r:34,t:0,d:.5});burst(P.x,P.y,18,'#8a7a66',100);sfx('boom');},
  tornado:q=>{for(let i=0;i<12;i++){const a=i/12*Math.PI*2;G.pproj.push({k:'arrow',f:'plain',owner:P.id,a,mult:.8,tags:SKILLS.tornado.tags,use:q.use,x:q.x,y:q.y,vx:Math.cos(a)*240,vy:Math.sin(a)*240,life:.6});}burst(q.x,q.y,14,'#e8e8f0',90);},
};
// Effects that last and act every q.tick seconds (move: how they follow or walk, every frame).
const LASTING={
  pool:{go:q=>{hitCircle(q.x,q.y,q.r,.35,{tags:SKILLS.caustic.tags,use:q.use,noProc:true});}},
  rain:{go:q=>{for(let i=0;i<3;i++){const t=rand(0,Math.PI*2),r=rand(0,q.r),x=q.x+Math.cos(t)*r,y=q.y+Math.sin(t)*r;hitCircle(x,y,10,.6,{tags:SKILLS.rain.tags,use:q.use,noProc:true});burst(x,y,4,'#c3c0b0',40);}}},
  ballista:{go:q=>{let best=null,bd=220;for(const e of G.enemies){if(e.dead)continue;const d=hyp(e.x-q.x,e.y-q.y);if(d<bd&&los(q.x,q.y,e.x,e.y)){bd=d;best=e;}}
    if(best){const a=Math.atan2(best.y-q.y,best.x-q.x);G.pproj.push({k:'arrow',f:'plain',owner:P.id,a,mult:.9,tags:SKILLS.ballista.tags,use:q.use,x:q.x,y:q.y,vx:Math.cos(a)*300,vy:Math.sin(a)*300,life:.8});q.a=a;sfx('swing');}}},
  vortex:{move:q=>{q.x=P.x;q.y=P.y;},go:q=>{hitCircle(q.x,q.y,q.r,.55,{melee:true,tags:SKILLS.vortex.tags,use:q.use,noProc:true});}},
  smoke:{go:()=>{}},
  blizzard:{go:q=>{hitCircle(q.x,q.y,q.r,.35,{slow:3,tags:SKILLS.blizzard.tags,use:q.use,noProc:true});for(let i=0;i<4;i++)burst(q.x+rand(-q.r,q.r),q.y+rand(-q.r,q.r),2,'#cfe8ff',30);}},
  // a raised dead: walks to the nearest enemy and strikes it
  minion:{move:(q,dt)=>{q.x??=P.x;q.y??=P.y;let best=null,bd=160;for(const e of G.enemies){if(e.dead)continue;const d=hyp(e.x-q.x,e.y-q.y);if(d<bd){bd=d;best=e;}}
      const tx=best?best.x:P.x+Math.cos(q.i*2.1)*18,ty=best?best.y:P.y+Math.sin(q.i*2.1)*18,d=hyp(tx-q.x,ty-q.y);q.e=best&&bd<16+best.r?best.id:null;
      if(d>(best?12+best.r:10)){const v=Math.min(d,85*dt);q.x+=(tx-q.x)/d*v;q.y+=(ty-q.y)/d*v;}},
    go:q=>{const e=q.e!=null&&G.enemies.find(x=>x.id===q.e&&!x.dead);if(e){damageEnemy(e,.7,{fx:q.x,fy:q.y,tags:SKILLS.raise.tags,use:q.use,noProc:true});burst(e.x,e.y-4,4,'#9be08a',40);}}},
};
/* ---------- reach ---------- */
// How far skills reach, in game units (a tile is 16). Melee skills go by the weapon's own reach (ST.range); skills
// that land somewhere land at the mouse, no farther than their reach (P.aimD: how far the mouse points).
const LEAP_T=.32;   // seconds a Leap Slam is in the air
const REACH={line:44,storm:60,cuts:40,leap:90,judge:110,rain:130,meteor:120,blizzard:110,mark:160,dance:120,blink:120,arc:140,split:4};
function aimed(a,max){const d=P.aimD==null?max:clamp(P.aimD,0,max);return{x:P.x+Math.cos(a)*d,y:P.y+Math.sin(a)*d};}
/* ---------- what each skill does ---------- */
// go(a, tags, use): the effect; can(): whether there is anything to use it on (if not, nothing is spent)
const SKILL_FX={
  // ----- skills from before the four slots -----
  circle:{go:(a,tags,use)=>{const r=ST.range*1.35;hitArc(0,360,r,2.2,{kb:120,w:1.7,tags,use});slashFx(a,360,r,1,.28);vfx({k:'ring',x:P.x,y:P.y,r:r+6,c:'#cfe8ff',t:0,d:.3});sfx('whoosh');}},
  blink:{go:(a,tags,use)=>{
    let best=null,bd=REACH.blink;for(const e of G.enemies){if(e.dead)continue;const d=hyp(e.x-P.x,e.y-P.y);if(d<bd&&los(P.x,P.y,e.x,e.y)){bd=d;best=e;}}
    burst(P.x,P.y,10,'#55556a',50);
    if(best){const dir=Math.atan2(best.y-P.y,best.x-P.x);let tx=best.x+Math.cos(dir)*(best.r+9),ty=best.y+Math.sin(dir)*(best.r+9);
      if(boxSolid(tx,ty,P.cr)){tx=best.x-Math.cos(dir)*(best.r+9);ty=best.y-Math.sin(dir)*(best.r+9);}
      if(!boxSolid(tx,ty,P.cr)){P.x=tx;P.y=ty;P.tp++;}
      P.aim=Math.atan2(best.y-P.y,best.x-P.x);P.dir=dirOf(P.aim);P.inv=Math.max(P.inv,.35);if(damageEnemy(best,3,{crit:true,melee:true,w:2,c:'#b9a8ff',tags,use}))gainMomentum();vfx({k:'cut',x:best.x,y:best.y,a:P.aim+1.1,len:best.r*2+34,c:'#b9a8ff',t:0,d:.2});slashFx(P.aim,120,ST.range+6);}
    else{P.dash={t:.12,vx:Math.cos(a)*300,vy:Math.sin(a)*300};P.inv=Math.max(P.inv,.2);}}},
  sunder:{go:(a,tags,use)=>{const r=ST.range*1.35;hitArc(a,170,r,2.8,{sunder:4,kb:90,w:2.2,tags,use});slashFx(a,170,r,1,.24);vfx({k:'quake',x:P.x+Math.cos(a)*r*.6,y:P.y+Math.sin(a)*r*.6,r:20,t:0,d:.45});shake(4);sfx('boom');}},
  guard:{go:()=>{P.guard=5;vfx({k:'ring',x:P.x,y:P.y,r:24,t:0,d:.3});burst(P.x,P.y,12,'#e6e1d3',50);}},
  pierce:{go:(a,tags,use)=>{const L=ST.range+REACH.line;hitLine(a,L,9,2.5,{kb:70,w:1.9,tags,use});vfx({k:'thrust',x:P.x,y:P.y,a,len:L+2,big:1,t:0,d:.26});shake(2);sfx('thrust');}},
  volley:{go:(a,tags,use)=>{for(let i=-2;i<=2;i++)fireArrow(a+i*.15,.8,tags,use);}},
  fireball:{go:(a,tags,use)=>{G.pproj.push({k:'fire',owner:P.id,use,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*135,vy:Math.sin(a)*135,life:ST.range/135});}},
  // ----- the Templar -----
  // Heal: one ally (the one you aim at, or yourself), a lot
  heal:{go:()=>{const t=allyAimed()||P,amt=healAmount()*1.4;healOn(t,amt);
    if(ST.p.mend)t.hot={t:5,rate:amt*ST.p.mend/100/5};if(ST.p.ward)P.ward=4;
    vfx({k:'heal',x:t.x,y:t.y,r:22,t:0,d:.7});burst(t.x,t.y-6,12,'#ffe9a8',60);}},
  // Party Heal: everyone near you (never enemies: it only walks the list of allies)
  partyheal:{go:()=>{const amt=healAmount();
    for(const t of allies()){if(t.dead||hyp(t.x-P.x,t.y-P.y)>HEAL_R)continue;healOn(t,amt);}
    if(ST.p.ward)P.ward=4;vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R,t:0,d:.95});}},
  // Renewal: healing over 8 seconds on one ally
  renewal:{go:()=>{const t=allyAimed()||P,amt=healAmount()*1.8;t.hot={t:8,rate:amt/8};
    addNum(t.x,t.y-20,'RENEWAL','heal');vfx({k:'ring',x:t.x,y:t.y,r:16,t:0,d:.5,c:'#9fe0a8'});burst(t.x,t.y-6,10,'#9fe0a8',40);}},
  // Aegis: a shield on one ally that takes the next blows for it
  aegis:{go:()=>{const t=allyAimed()||P;t.shield=Math.round(healAmount()*1.3);t.shieldT=8;
    addNum(t.x,t.y-20,'AEGIS','evade');vfx({k:'ring',x:t.x,y:t.y,r:18,t:0,d:.5,c:'#cfe4ff'});burst(t.x,t.y-6,12,'#cfe4ff',50);}},
  // Revive: a fallen ally you aim at, while it can still be undone
  revive:{can:()=>!!allyAimed(revivable),go:()=>{const t=allyAimed(revivable);if(t)revive(t,.35);}},
  // Smite: the next four basic attacks strike with holy light (paid up front)
  smite:{go:()=>{empower({id:'smite',t:8,n:4,mult:1.7,c:'#ffe9a8'});addNum(P.x,P.y-20,'SMITE','crit');burst(P.x,P.y-6,14,'#ffe9a8',60);}},
  // ----- the Templar's ultimates -----
  // Judgement: eight strikes of light fall where you aim, one after another
  judgement:{go:(a,tags,use)=>{const{x:cx,y:cy}=aimed(a,REACH.judge);
    for(let i=0;i<8;i++){const r=i?rand(6,38):0,t=rand(0,Math.PI*2);later({k:'judge',x:cx+Math.cos(t)*r,y:cy+Math.sin(t)*r,r:22,d:.45+i*.22,use,mark:1});}}},
  // Mass Heal: the whole party, wherever they are on the floor, and a little over time after
  massheal:{go:()=>{const amt=healAmount()*2.2;
    for(const t of allies()){if(t.dead)continue;healOn(t,amt);t.hot={t:6,rate:amt*.4/6};vfx({k:'heal',x:t.x,y:t.y,r:30,t:0,d:1});}
    vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R*1.6,t:0,d:1.2});shake(2);}},
  // Resurrection: every fallen ally who can still be brought back, wherever they lie
  resurrect:{can:()=>allies().some(t=>t!==P&&revivable(t)),go:()=>{for(const t of allies())if(t!==P&&revivable(t))revive(t,.6);
    vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R*1.6,t:0,d:1.2});}},
  // ----- the Marauder -----
  heavy:{go:()=>{empower({id:'heavy',t:8,n:3,mult:1.6,pz:3,c:'#ffd27a'});addNum(P.x,P.y-20,'HEAVY','crit');}},
  // Leap Slam: a third of a second in the air to where you aim, then the slam (LANDING.slam)
  leap:{go:(a,tags,use)=>{const L=P.aimD==null?REACH.leap:clamp(P.aimD,16,REACH.leap),T=LEAP_T;burst(P.x,P.y,10,'#8a7a66',60);
    P.dash={t:T,vx:Math.cos(a)*L/T,vy:Math.sin(a)*L/T,leap:1};P.swing=null;P.inv=Math.max(P.inv,T);later({k:'slam',d:T,use});}},
  cry:{go:()=>{for(const t of allies())if(!t.dead&&hyp(t.x-P.x,t.y-P.y)<140){t.cryT=10;addNum(t.x,t.y-22,'ENDURE','evade');}
    vfx({k:'pulse',x:P.x,y:P.y,r:140,t:0,d:.6,c:'#e8c060'});shake(4);sfx('roar');}},
  quake:{go:(a,tags,use)=>{hitCircle(P.x,P.y,62,2.6,{kb:120,pz:3,w:3,tags,use});vfx({k:'quake',x:P.x,y:P.y,r:62,big:1,t:0,d:.7});burst(P.x,P.y,30,'#8a7a66',120);sfx('boom');
    later({k:'shock',x:P.x,y:P.y,r:62,d:.8,use});}},
  berserk:{go:()=>{P.berserkT=10;addNum(P.x,P.y-22,'BERSERK','hurt');burst(P.x,P.y-6,18,'#d9534f',80);vfx({k:'ring',x:P.x,y:P.y,r:40,c:'#d9534f',t:0,d:.5});shake(4);sfx('roar');}},
  // ----- the Duelist -----
  riposte:{go:()=>{P.riposteT=1;P.parryAt=-9;addNum(P.x,P.y-20,'EN GARDE','evade');vfx({k:'ring',x:P.x,y:P.y,r:18,c:'#cfe8ff',t:0,d:.3});}},
  double:{go:()=>{empower({id:'double',t:10,n:99,mult:1.9,per:3,c:'#cfe8ff'});addNum(P.x,P.y-20,'DOUBLE','crit');}},
  cuts:{can:()=>!!enemyAimed(ST.range+REACH.cuts),go:(a,tags,use)=>{const e=enemyAimed(ST.range+REACH.cuts);P.inv=Math.max(P.inv,1);for(let i=0;i<8;i++)later({k:'cut',e:e.id,i,d:.1+i*.11,use,dies:1});}},
  challenge:{can:()=>!!enemyAimed(200),go:()=>{const e=enemyAimed(200);e.tauntBy=P.id;e.tauntT=G.time+12;if(e.state==='idle')e.state='chase';addNum(e.x,e.y-e.r-12,'CHALLENGED','crit');burst(e.x,e.y-6,12,'#e8c060',60);}},
  storm:{go:(a,tags,use)=>{for(let i=0;i<5;i++)later({k:'thrust',d:.05+i*.16,use,dies:1});}},
  // ----- the Ranger -----
  lightarrow:{go:(a,tags,use)=>{fireArrow(a,1.2,tags,use,'light');}},
  caustic:{go:(a,tags,use)=>{fireArrow(a,.8,tags,use,'caustic');}},
  split:{go:(a,tags,use)=>{fireArrow(a,1.5,tags,use,'split');}},
  rain:{go:(a,tags,use)=>{const t=aimed(a,REACH.rain);later({k:'rain',x:t.x,y:t.y,r:50,d:2,tick:.25,use,vis:1});}},
  ballista:{go:(a,tags,use)=>{later({k:'ballista',x:P.x+Math.cos(a)*14,y:P.y+Math.sin(a)*14,r:8,d:15,tick:.6,use,vis:1,a});}},
  tornado:{go:(a,tags,use)=>{fireArrow(a,1,tags,use,'tornado');}},
  // ----- the Shadow -----
  viper:{go:()=>{empower({id:'viper',t:10,n:99,mult:1.25,per:2,poison:1,c:'#7fd060'});addNum(P.x,P.y-20,'VIPER','crit');}},
  vortex:{go:(a,tags,use)=>{later({k:'vortex',x:P.x,y:P.y,r:30,d:4,tick:.3,use,vis:1,dies:1});}},
  smoke:{go:()=>{later({k:'smoke',x:P.x,y:P.y,r:42,d:5,tick:1,vis:1});burst(P.x,P.y,24,'#55556a',70);}},
  deathmark:{can:()=>!!enemyAimed(REACH.mark),go:(a,tags,use)=>{const e=enemyAimed(REACH.mark);e.mark={by:P.id,acc:0};later({k:'mark',e:e.id,d:4,use});addNum(e.x,e.y-e.r-12,'MARKED','crit');}},
  dance:{can:()=>G.enemies.some(e=>!e.dead&&hyp(e.x-P.x,e.y-P.y)<REACH.dance),go:(a,tags,use)=>{
    const list=G.enemies.filter(e=>!e.dead&&hyp(e.x-P.x,e.y-P.y)<REACH.dance&&los(P.x,P.y,e.x,e.y)).sort((p,q)=>hyp(p.x-P.x,p.y-P.y)-hyp(q.x-P.x,q.y-P.y)).slice(0,6);
    P.inv=Math.max(P.inv,list.length*.18+.3);list.forEach((e,i)=>later({k:'dance',e:e.id,d:.05+i*.18,use,dies:1}));}},
  vanish:{go:()=>{P.vanishT=4;burst(P.x,P.y,24,'#3a3a4a',80);addNum(P.x,P.y-20,'VANISH','evade');}},
  // ----- the Witch -----
  frostbolt:{go:(a,tags,use)=>{G.pproj.push({k:'frost',owner:P.id,use,tags,mult:1.6,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*200,vy:Math.sin(a)*200,life:ST.range/200});}},
  arc:{can:()=>!!enemyAimed(REACH.arc),go:(a,tags,use)=>{const e=enemyAimed(REACH.arc);vfx({k:'bolt',x:P.x,y:P.y,x2:e.x,y2:e.y,t:0,d:.2});damageEnemy(e,1.4,{w:1.3,tags,use});chain(e,4,.9,tags,use);}},
  icenova:{go:(a,tags,use)=>{hitCircle(P.x,P.y,48,1.6,{kb:120,slow:3,w:1.7,tags,use});vfx({k:'pulse',x:P.x,y:P.y,r:48,t:0,d:.4,c:'#9fd8ff'});vfx({k:'frost',x:P.x,y:P.y,r:48,t:0,d:.9});burst(P.x,P.y,22,'#cfe8ff',100);}},
  raise:{go:(a,tags,use)=>{for(let i=0;i<3;i++)later({k:'minion',i,x:P.x+Math.cos(i*2.1)*14,y:P.y+Math.sin(i*2.1)*14,r:6,d:20,tick:.8,use,vis:1,dies:1});burst(P.x,P.y,20,'#9be08a',70);}},
  meteor:{go:(a,tags,use)=>{const t=aimed(a,REACH.meteor);later({k:'meteor',x:t.x,y:t.y,r:42,d:1.2,use,mark:1});}},
  blizzard:{go:(a,tags,use)=>{const t=aimed(a,REACH.blizzard);later({k:'blizzard',x:t.x,y:t.y,r:52,d:5,tick:.4,use,vis:1});}},
};

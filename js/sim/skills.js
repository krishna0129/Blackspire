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
function takeEmpower(){
  const E=P.emp;if(!E||E.t<=0||E.n<=0){P.emp=null;return 1;}
  if(E.per){if(P.mp<E.per){P.emp=null;addNum(P.x,P.y-18,'NO MANA','mana');return 1;}P.mp-=E.per;}
  E.n--;if(E.n<=0)P.emp=null;
  burst(P.x+Math.cos(P.aim)*10,P.y+Math.sin(P.aim)*10,8,E.c||'#ffe9a8',60);
  return E.mult;
}
// A fallen ally can be brought back for a while after the fall (docs/design/multiplayer.md#falling), with nothing lost.
const REVIVE_WINDOW=15;
const revivable=t=>t.dead&&!t.gone&&G.time-(t.deadAt??-99)<=REVIVE_WINDOW;
function revive(t,share){
  const me=P;setPlayer(t);
  P.dead=false;P.hp=Math.max(1,Math.round(ST.maxHp*share));P.inv=1.5;P.stagger=0;if(P.deathLost){S.shards+=P.deathLost;P.deathLost=0;}
  revived();burst(P.x,P.y,20,'#ffe9a8',90);
  setPlayer(me);addNum(t.x,t.y-22,'REVIVED','heal');
}
// Effects that land later (Judgement's strikes): G.pfx, each with its owner, played out in updateSkillFx.
function later(o){G.pfx.push(Object.assign({t:0,owner:P.id},o));}
function updateSkillFx(dt){
  if(!G.pfx)return;
  for(const q of G.pfx){q.t+=dt;if(q.t<q.d||q.done)continue;q.done=true;const ow=playerById(q.owner);if(!ow)continue;setPlayer(ow);
    if(q.k==='judge'){let n=0;for(const e of G.enemies)if(!e.dead&&hyp(e.x-q.x,e.y-q.y)<q.r+e.r&&damageEnemy(e,2.2,{kb:40,fx:q.x,fy:q.y,tags:SKILLS.judgement.tags,use:q.use}))n++;
      if(n)gainMomentum();vfx({k:'boom',x:q.x,y:q.y,r:q.r,t:0,d:.3,c:'#ffe9a8'});burst(q.x,q.y,16,'#ffe9a8',90);shake(3);sfx('boom');}
  }
  G.pfx=G.pfx.filter(q=>!q.done);
}

/* ---------- what each skill does ---------- */
// go(a, tags, use): the effect; can(): whether there is anything to use it on (if not, nothing is spent)
const SKILL_FX={
  // ----- skills from before the four slots -----
  circle:{go:(a,tags,use)=>{hitArc(0,360,ST.range*1.35,2.2,{kb:120,tags,use});slashFx(a,360,ST.range*1.35,1,.24);shake(4);}},
  blink:{go:(a,tags,use)=>{
    let best=null,bd=150;for(const e of G.enemies){if(e.dead)continue;const d=hyp(e.x-P.x,e.y-P.y);if(d<bd&&los(P.x,P.y,e.x,e.y)){bd=d;best=e;}}
    burst(P.x,P.y,10,'#55556a',50);
    if(best){const dir=Math.atan2(best.y-P.y,best.x-P.x);let tx=best.x+Math.cos(dir)*(best.r+9),ty=best.y+Math.sin(dir)*(best.r+9);
      if(boxSolid(tx,ty,P.cr)){tx=best.x-Math.cos(dir)*(best.r+9);ty=best.y-Math.sin(dir)*(best.r+9);}
      if(!boxSolid(tx,ty,P.cr)){P.x=tx;P.y=ty;P.tp++;}
      P.aim=Math.atan2(best.y-P.y,best.x-P.x);P.dir=dirOf(P.aim);P.inv=Math.max(P.inv,.35);if(damageEnemy(best,3,{crit:true,melee:true,tags,use}))gainMomentum();slashFx(P.aim,120,ST.range+6);}
    else{P.dash={t:.12,vx:Math.cos(a)*300,vy:Math.sin(a)*300};P.inv=Math.max(P.inv,.2);}}},
  sunder:{go:(a,tags,use)=>{hitArc(a,170,ST.range*1.35,2.8,{sunder:4,kb:90,tags,use});slashFx(a,170,ST.range*1.35,1,.22);shake(6);}},
  guard:{go:()=>{P.guard=5;vfx({k:'ring',x:P.x,y:P.y,r:24,t:0,d:.3});burst(P.x,P.y,12,'#e6e1d3',50);}},
  pierce:{go:(a,tags,use)=>{hitLine(a,120,9,2.5,{kb:50,tags,use});vfx({k:'line',x:P.x,y:P.y,a,len:122,t:0,d:.2,w:1});shake(3);}},
  volley:{go:(a,tags,use)=>{for(let i=-2;i<=2;i++)fireArrow(a+i*.15,.8,tags,use);}},
  fireball:{go:(a,tags,use)=>{G.pproj.push({k:'fire',owner:P.id,use,x:P.x+Math.cos(a)*8,y:P.y+Math.sin(a)*6,vx:Math.cos(a)*135,vy:Math.sin(a)*135,life:1.25});}},
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
  judgement:{go:(a,tags,use)=>{const cx=P.x+Math.cos(a)*70,cy=P.y+Math.sin(a)*70;
    for(let i=0;i<8;i++){const r=i?rand(6,38):0,t=rand(0,Math.PI*2);later({k:'judge',x:cx+Math.cos(t)*r,y:cy+Math.sin(t)*r,r:22,d:.45+i*.22,use,mark:1});}}},
  // Mass Heal: the whole party, wherever they are on the floor, and a little over time after
  massheal:{go:()=>{const amt=healAmount()*2.2;
    for(const t of allies()){if(t.dead)continue;healOn(t,amt);t.hot={t:6,rate:amt*.4/6};vfx({k:'heal',x:t.x,y:t.y,r:30,t:0,d:1});}
    vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R*1.6,t:0,d:1.2});shake(2);}},
  // Resurrection: every fallen ally who can still be brought back, wherever they lie
  resurrect:{can:()=>allies().some(t=>t!==P&&revivable(t)),go:()=>{for(const t of allies())if(t!==P&&revivable(t))revive(t,.6);
    vfx({k:'heal',x:P.x,y:P.y,r:HEAL_R*1.6,t:0,d:1.2});}},
};

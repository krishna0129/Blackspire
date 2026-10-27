'use strict';
// Blackspire: the skill tree (docs/design/skills.md). One web of nodes that everybody shares. You start at the node
// of the weapon you carried when you first spent a point, and take nodes one next to another: one point a level,
// and one for each floor whose boss you were first to beat.
//
// Kinds of node (TREE[id].k):
//   start    where a weapon's builds begin. Yours is taken for free.
//   small    a little of one thing: a tag's damage, health, a resistance.
//   notable  a bundle, at the end of a short spur.
//   skill    teaches a base skill. soon: the skill comes with the new combat, so the node cannot be taken yet.
//   adv      an advanced skill, reached through its base skill's node (also soon, for now).
// What a node gives is its fx (treeApply reads it):
//   inc:{tag:%}  more damage from hits carrying that tag (TAGS, data.js), added together with the other "increased"
//   res:{type:%} less damage taken of that type (DTYPES)
//   hp, hpPct, def, defPct, crit, critDmg, move, aspd, cdr, mana, mregen, regen, evade, heal: as computeStats has them
// The layout (x, y) is for the tree screen only: the rules care about links, not places.

// The eight starts, around the circle, so that neighbours share ground: the blades together, the casters together.
const TREE_STARTS=['sword','spear','great','mace','faith','grimoire','bow','dagger'];
const TREE_START_NAMES={sword:'Longsword',spear:'Spear',great:'Greatsword',mace:'Mace',faith:'Grimoire of faith',grimoire:'Grimoire of magic',bow:'Bow',dagger:'Dagger'};
// Per start: what its small nodes give (a cycle of fx), its notable, and its three base skills with their two advanced
// skills each (the wave 1 and wave 2 tables in skills.md).
const TREE_PLAN={
  sword:{small:[{inc:{melee:6}},{defPct:5},{inc:{sword:8}},{crit:2}],notable:['Duellist',{inc:{melee:16},crit:4}],
    skills:[['Double Strike','Blade Flurry','Flicker Strike'],['Riposte','Parry','Shield Charge'],['Frost Blades','Molten Strike','Smite']]},
  spear:{small:[{inc:{melee:6}},{aspd:4},{inc:{spear:8}},{move:3}],notable:['Impaler',{inc:{melee:12,spear:10},aspd:6}],
    skills:[['Spear Lunge','Phase Run','Berserk'],['Spear Throw','Lightning Warp','Storm Call'],['Lacerate','Puncture','Blood Rage']]},
  great:{small:[{inc:{area:6}},{critDmg:10},{inc:{greatsword:8}},{hp:12}],notable:['Executioner',{inc:{area:14,melee:8},critDmg:20}],
    skills:[['Ground Slam','Earthquake','Sunder'],['Cyclone','Reave','Bladestorm'],['Heavy Strike','Boneshatter','Tectonic Slam']]},
  mace:{small:[{hp:15},{defPct:6},{inc:{mace:8}},{regen:.4}],notable:['Bulwark',{hpPct:8,defPct:12}],
    skills:[['Leap Slam','Dominating Blow','Animate Guardian'],['Enduring Cry','Seismic Cry',"Battlemage's Cry"],['Steelskin','Molten Shell','Bone Armour']]},
  faith:{small:[{heal:6},{mregen:8},{res:{rot:6}},{regen:.4}],notable:['Shepherd',{heal:18,mana:20}],
    skills:[['Heal','Holy Relic','Auras'],['Raise Zombie','Raise Spectre','Summon Skeletons'],['Essence Drain','Contagion','Blight']]},
  grimoire:{small:[{inc:{fire:7}},{inc:{lightning:7}},{inc:{cold:7}},{mana:12}],notable:['Elementalist',{inc:{fire:12,cold:12,lightning:12},cdr:4}],
    skills:[['Fireball','Firestorm','Flameblast'],['Frostbolt','Ice Nova','Glacial Cascade'],['Arc','Spark','Ball Lightning']]},
  bow:{small:[{inc:{projectile:6}},{crit:2},{inc:{bow:8}},{evade:1.5}],notable:['Marksman',{inc:{projectile:14},crit:5}],
    skills:[['Split Arrow','Tornado Shot','Barrage'],['Lightning Arrow','Galvanic Arrow','Ice Shot'],['Caustic Arrow','Toxic Rain','Explosive Arrow']]},
  dagger:{small:[{crit:2},{move:3},{inc:{dagger:8}},{evade:1.5}],notable:['Assassin',{crit:6,critDmg:25}],
    skills:[['Viper Strike','Pestilent Strike','Cobra Lash'],['Blade Vortex','Withering Step','Smoke Mine'],['Blink','Traps','Mines']]},
};
// The inner ring, shared by everyone: two nodes between each pair of starts, and a notable in each gap.
const TREE_RING=[{hp:10},{mana:10},{defPct:4},{regen:.3},{move:2},{cdr:2},{res:{fire:5}},{res:{cold:5}},{res:{lightning:5}},{res:{rot:5}},{hpPct:3},{mregen:6}];
const TREE_HUB=[['Endurance',{hpPct:6,regen:.6}],['Clarity',{mana:25,mregen:15}],['Warding',{res:{fire:10,cold:10,lightning:10,rot:10}}],['Swiftness',{move:5,aspd:4}]];

const TREE=(()=>{
  const N={},link=(a,b)=>{N[a].to.push(b);N[b].to.push(a);};
  const add=(id,k,x,y,o={})=>{N[id]=Object.assign({id,k,x:Math.round(x),y:Math.round(y),to:[]},o);return id;};
  const R0=600,RING=230;
  TREE_STARTS.forEach((w,si)=>{
    const th=-Math.PI/2+si*Math.PI*2/TREE_STARTS.length,P_=TREE_PLAN[w];
    // place by (u: outward from the centre, v: sideways), around this start's direction
    const at=(u,v)=>[Math.cos(th)*u-Math.sin(th)*v,Math.sin(th)*u+Math.cos(th)*v];
    let sm=0;const small=()=>P_.small[sm++%P_.small.length];
    const s=add(w,'start',...at(R0,0),{name:TREE_START_NAMES[w],w});
    // the way in, toward the ring
    let prev=s;for(const u of[R0-90,R0-180,R0-270]){const id=add(`${w}.in${u}`,'small',...at(u,0),{fx:small()});link(prev,id);prev=id;}
    N[prev].ringFoot=si;
    // a spur off the way in, ending in the start's notable
    let sp=`${w}.in${R0-180}`;for(const[u,v]of[[R0-200,55],[R0-240,95]]){const id=add(`${w}.sp${v}`,'small',...at(u,v),{fx:small()});link(sp,id);sp=id;}
    link(sp,add(`${w}.notable`,'notable',...at(R0-290,125),{name:P_.notable[0],fx:P_.notable[1]}));
    // three branches outward: two small nodes, the base skill, and its two advanced skills
    P_.skills.forEach(([base,a1,a2],bi)=>{
      const v0=(bi-1)*190;let p=s;
      for(const u of[R0+90,R0+170]){const id=add(`${w}.b${bi}.${u}`,'small',...at(u,v0*(u-R0)/170),{fx:small()});link(p,id);p=id;}
      const sk=add(`${w}.b${bi}.skill`,'skill',...at(R0+270,v0*1.35),{name:base,soon:true});link(p,sk);
      [a1,a2].forEach((nm,ai)=>link(sk,add(`${w}.b${bi}.adv${ai}`,'adv',...at(R0+400,v0*1.35+(ai?70:-70)),{name:nm,soon:true})));
    });
  });
  // the ring: from each start's foot, two nodes toward the next start's, and a notable in the hub between
  const n=TREE_STARTS.length;let ri=0;
  TREE_STARTS.forEach((w,si)=>{
    const foot=Object.values(N).find(q=>q.ringFoot===si).id,next=Object.values(N).find(q=>q.ringFoot===(si+1)%n).id;
    const a0=-Math.PI/2+si*Math.PI*2/n,a1=a0+Math.PI*2/n;let prev=foot;
    for(const f of[1/3,2/3]){const a=a0+(a1-a0)*f,id=add(`ring.${si}.${f<.5?0:1}`,'small',Math.cos(a)*RING,Math.sin(a)*RING,{fx:TREE_RING[ri++%TREE_RING.length]});link(prev,id);prev=id;}
    link(prev,next);
    if(si%2===0){const a=(a0+a1)/2,h=TREE_HUB[si/2];link(`ring.${si}.0`,add(`hub.${si}`,'notable',Math.cos(a)*110,Math.sin(a)*110,{name:h[0],fx:h[1]}));}
  });
  return N;
})();

/* ---------- points ---------- */
const treeOf=s=>Array.isArray(s.tree)?s.tree:(s.tree=[]);
// floors whose boss this save beat (the first kill gives the point; rematches give none)
const bossClears=s=>Object.keys(s.floors||{}).filter(n=>+n>0&&s.floors[n].boss>0).length;
const treeEarned=s=>(s.char.level-1)+bossClears(s);
const treeLeft=s=>treeEarned(s)-treeOf(s).length;
// The start a save builds from: chosen when the first point is spent (the weapon carried then), and again after a reset.
const startKey=w=>w.type==='grimoire'&&w.school==='faith'?'faith':w.type;
const treeStart=s=>s.treeStart&&TREE[s.treeStart]?s.treeStart:startKey(s.equip.weapon);
// Can this save take node id now? Not taken, not a start, not a skill still to come, a point to spend, and next to
// its start or a node it owns.
function treeCanTake(s,id){
  const q=TREE[id],own=treeOf(s);
  if(!q||q.k==='start'||q.soon||own.includes(id)||treeLeft(s)<1)return false;
  const st=treeStart(s);return q.to.some(t=>t===st||own.includes(t));
}
// What a reset costs: a little more each level.
const treeResetCost=s=>treeOf(s).length?20*s.char.level:0;

/* ---------- what the nodes add up to ---------- */
// Called by computeStats, after gear: st is the stats so far, tree the ids taken.
function treeApply(st,tree){
  const t={inc:{},res:{},hp:0,hpPct:0,def:0,defPct:0,crit:0,critDmg:0,move:0,aspd:0,cdr:0,mana:0,mregen:0,regen:0,evade:0,heal:0};
  for(const id of tree||[]){const q=TREE[id];if(!q||!q.fx)continue;
    for(const k in q.fx){const v=q.fx[k];if(k==='inc'||k==='res'){for(const x in v)t[k][x]=(t[k][x]||0)+v[x];}else if(k in t)t[k]+=v;}}
  st.inc=t.inc;st.eres=t.res;
  st.maxHp=(st.maxHp+t.hp)*(1+t.hpPct/100);st.def=(st.def+t.def)*(1+t.defPct/100);
  st.crit+=t.crit;st.critDmg+=t.critDmg;st.movePct+=t.move;st.aspd*=1+t.aspd/100;st.cdr=Math.min(60,st.cdr+t.cdr);
  st.maxMp+=t.mana;st.mpRegen*=1+t.mregen/100;st.regen+=t.regen;st.evade=Math.min(40,st.evade+t.evade);st.healPow*=1+t.heal/100;
  return st;
}
// One line saying what a node does, for the tree screen.
function treeDesc(q){
  if(q.k==='start')return`Where ${q.name.toLowerCase()} builds begin.`;
  if(q.soon)return q.k==='skill'?'Teaches this skill: coming with the new combat.':'An advanced form of the skill before it: coming with the new combat.';
  const out=[],f=q.fx,pct=(v,s)=>`+${v}% ${s}`;
  for(const k in f){const v=f[k];
    if(k==='inc')for(const t in v)out.push(pct(v[t],`${TAGS[t].name.toLowerCase()} damage`));
    else if(k==='res')for(const t in v)out.push(`${v[t]}% less ${DTYPES[t].name.toLowerCase()} damage taken`);
    else out.push({hp:`+${v} health`,hpPct:pct(v,'health'),def:`+${v} defense`,defPct:pct(v,'defense'),crit:`+${v}% critical chance`,critDmg:pct(v,'critical damage'),
      move:pct(v,'move speed'),aspd:pct(v,'attack speed'),cdr:pct(v,'cooldown recovery'),mana:`+${v} mana`,mregen:pct(v,'mana regeneration'),
      regen:`+${v} health regenerated a second`,evade:`+${v}% chance to dodge`,heal:pct(v,'healing')}[k]);}
  return out.join(', ')+'.';
}

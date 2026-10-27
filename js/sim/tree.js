'use strict';
// Blackspire: classes and their skill boards (docs/design/skills.md).
//
// A character has a class, chosen when it is made. Each class has its weapons; any weapon can be carried, but only a
// class weapon brings its skill (an off-class weapon gives the basic attack and nothing more). Each class has one board.
//
// A board is in tiers. A tier opens once enough points are spent on the board (TIERS); inside an open tier any node
// can be taken, a point at a time, up to its ranks. Points: one a level, and one for each floor whose boss you were
// first to beat. Kinds of node (k):
//   skill    a base skill. now: today's skill it is (SKILLS key), which every class member knows from the start, free.
//            soon: it comes with the new combat. vars: its variations, each sealed behind a challenge (ch) and free
//            once the challenge is met; a character may have both, and uses one at a time (S.vars).
//   passive  ranks of a small bonus.
//   key      a capstone, one rank: a bigger bonus at the top of the board.
// A node's fx is per rank, read by treeApply:
//   inc:{tag:%}  more damage from hits that carry the tag (TAGS)   res:{type:%}  less damage taken of a type (DTYPES)
//   hp, hpPct, def, defPct, crit, critDmg, move, aspd, cdr, mana, mregen, regen, evade, heal: as computeStats has them
// Challenges (ch), counted for the base skill (S.prog, see skillCount): k 'uses' (n uses), 'multi' (n uses that hit at
// least min enemies), 'kills' (n kills), 'elite' (n elites or bosses killed), 'fam' (n kills of family fam).

const CLASSES={
  marauder:{name:'Marauder',attrs:['str','vit'],weapons:['great','mace'],blurb:'Strength and a thick hide. Greatswords and maces.'},
  duelist:{name:'Duelist',attrs:['str','agi'],weapons:['sword','spear'],blurb:'Strength and footwork. Longswords and spears.'},
  ranger:{name:'Ranger',attrs:['dex','agi'],weapons:['bow'],blurb:'A steady eye and quick feet. Bows.'},
  shadow:{name:'Shadow',attrs:['dex','int'],weapons:['dagger'],blurb:'Cunning and quick hands. Daggers.'},
  witch:{name:'Witch',attrs:['int','mnd'],weapons:['grimoire:magic'],blurb:'Intelligence and a deep well of mana. Grimoires of magic.'},
  templar:{name:'Templar',attrs:['str','fai'],weapons:['mace','grimoire:faith'],blurb:'Strength and faith. Maces and grimoires of faith.'},
};
const wkeyOf=w=>w.type==='grimoire'?'grimoire:'+(w.school||'magic'):w.type;
const classOK=(cls,w)=>!cls||!CLASSES[cls]||CLASSES[cls].weapons.includes(wkeyOf(w));
// the class a weapon belongs to first, for characters made before classes (and the default in the creator)
const CLASS_OF_WEAPON={sword:'duelist',spear:'duelist',great:'marauder',mace:'marauder',dagger:'shadow',bow:'ranger','grimoire:magic':'witch','grimoire:faith':'templar'};
const classesFor=w=>Object.keys(CLASSES).filter(c=>CLASSES[c].weapons.includes(wkeyOf(w)));
const TIERS=[0,3,6,10,15];

// [kind, name, per-rank fx or skill fields, ranks]. A row is a tier.
const S_=(name,o)=>['skill',name,o,1],P_=(name,fx,max)=>['passive',name,fx,max],K_=(name,fx)=>['key',name,fx,1];
const V=(name,ch)=>({name,ch});
const BOARD_PLAN={
  marauder:[
    [S_('Sunder',{now:'sunder',vars:[V('Earthquake',{k:'multi',min:3,n:50}),V('Tectonic Slam',{k:'kills',n:80})]}),
     S_('Bulwark',{now:'guard',vars:[V('Molten Shell',{k:'uses',n:60}),V('Bone Armour',{k:'uses',n:120})]}),P_('Thick Hide',{hp:12},5)],
    [S_('Heavy Strike',{soon:true,vars:[V('Boneshatter',{k:'kills',n:100}),V('Infernal Blow',{k:'elite',n:10})]}),P_('Brute Force',{inc:{melee:5}},5),P_('Iron Skin',{defPct:4},5)],
    [S_('Leap Slam',{soon:true,vars:[V('Dominating Blow',{k:'elite',n:15}),V('Animate Guardian',{k:'kills',n:150})]}),P_('Crushing Blows',{critDmg:8},3),P_('Bloodied',{regen:.3},3)],
    [S_('Enduring Cry',{soon:true,vars:[V('Seismic Cry',{k:'uses',n:60}),V("Battlemage's Cry",{k:'multi',min:3,n:40})]}),P_('Unbreakable',{hpPct:4},3),P_('Warlord',{inc:{area:6}},3)],
    [K_('Unstoppable',{hpPct:10,defPct:15}),K_('Bloodlust',{inc:{melee:20},aspd:8})],
  ],
  duelist:[
    [S_('Circular Slash',{now:'circle',vars:[V('Reave',{k:'multi',min:3,n:60}),V('Bladestorm',{k:'kills',n:120})]}),
     S_('Piercing Line',{now:'pierce',vars:[V('Lacerate',{k:'multi',min:2,n:60}),V('Puncture',{k:'elite',n:10})]}),P_('Footwork',{move:3},3)],
    [S_('Riposte',{soon:true,vars:[V('Parry',{k:'uses',n:30}),V('Shield Charge',{k:'kills',n:60})]}),P_('Precision',{crit:2},5),P_('Blade Dancer',{aspd:3},5)],
    [S_('Double Strike',{soon:true,vars:[V('Blade Flurry',{k:'kills',n:150}),V('Flicker Strike',{k:'multi',min:2,n:80})]}),P_('Finesse',{inc:{sword:6}},3),P_('Long Reach',{inc:{spear:6}},3)],
    [S_('Spear Throw',{soon:true,vars:[V('Lightning Warp',{k:'uses',n:60}),V('Storm Call',{k:'kills',n:100})]}),P_("Duellist's Eye",{critDmg:10},3),P_('Parry and Thrust',{defPct:4},3)],
    [K_('Showman',{crit:6,critDmg:25}),K_('Victor',{inc:{melee:15},hpPct:6,regen:.5})],
  ],
  ranger:[
    [S_('Volley',{now:'volley',vars:[V('Tornado Shot',{k:'multi',min:3,n:60}),V('Barrage',{k:'elite',n:12})]}),P_('Steady Aim',{inc:{bow:5}},5),P_('Light Feet',{move:3},3)],
    [S_('Lightning Arrow',{soon:true,vars:[V('Galvanic Arrow',{k:'multi',min:3,n:50}),V('Ice Shot',{k:'kills',n:120})]}),P_('Eagle Eye',{crit:2},5),P_('Evasion',{evade:1.5},4)],
    [S_('Caustic Arrow',{soon:true,vars:[V('Toxic Rain',{k:'fam',fam:'beast',n:40}),V('Explosive Arrow',{k:'multi',min:4,n:30})]}),P_('Full Quiver',{inc:{projectile:5}},5),P_("Hunter's Mark",{critDmg:8},3)],
    [S_('Rain of Arrows',{soon:true,vars:[V('Ballista',{k:'uses',n:80}),V('Mirror Arrow',{k:'kills',n:100})]}),P_('Swift Draw',{aspd:4},3),P_('Trailwise',{res:{cold:6}},3)],
    [K_('True Shot',{inc:{projectile:20},crit:4}),K_('Wayfinder',{move:8,evade:4,mregen:20})],
  ],
  shadow:[
    [S_('Shadowstep',{now:'blink',vars:[V('Withering Step',{k:'uses',n:50}),V('Smoke Mine',{k:'elite',n:10})]}),P_('Lethality',{crit:2},5),P_('Quick Hands',{aspd:3},5)],
    [S_('Viper Strike',{soon:true,vars:[V('Pestilent Strike',{k:'fam',fam:'spirit',n:40}),V('Cobra Lash',{k:'multi',min:2,n:60})]}),P_('Shadows',{evade:1.5},4),P_('Dagger Arts',{inc:{dagger:6}},3)],
    [S_('Blade Vortex',{soon:true,vars:[V('Traps',{k:'kills',n:150}),V('Mines',{k:'multi',min:3,n:40})]}),P_('Cruelty',{critDmg:10},3),P_('Venom',{inc:{rot:8}},3)],
    [P_('Nightwalker',{move:4},3),P_('Opportunist',{crit:3},3),P_('Cold Blood',{res:{rot:6}},3)],
    [K_('Killing Blow',{crit:6,critDmg:30}),K_("Trickster's Gift",{inc:{area:15},cdr:8})],
  ],
  witch:[
    [S_('Fireball',{now:'fireball',vars:[V('Firestorm',{k:'multi',min:3,n:50}),V('Flameblast',{k:'kills',n:100})]}),P_('Arcane Mind',{mana:10},5),P_('Kindling',{inc:{fire:6}},5)],
    [S_('Frostbolt',{soon:true,vars:[V('Ice Nova',{k:'multi',min:3,n:50}),V('Glacial Cascade',{k:'kills',n:120})]}),P_('Hoarfrost',{inc:{cold:6}},5),P_('Static',{inc:{lightning:6}},5)],
    [S_('Arc',{soon:true,vars:[V('Spark',{k:'kills',n:150}),V('Ball Lightning',{k:'multi',min:3,n:60})]}),P_('Meditation',{mregen:8},5),P_('Spellcraft',{cdr:2},5)],
    [S_('Raise Zombie',{soon:true,vars:[V('Raise Spectre',{k:'elite',n:10}),V('Summon Skeletons',{k:'uses',n:80})]}),P_('Ward',{res:{fire:5,cold:5}},3),P_('Confluence',{inc:{fire:4,cold:4,lightning:4}},3)],
    [K_('Plaguebearer',{inc:{rot:20},mana:30}),K_("Lich's Pact",{inc:{minion:25},hpPct:6})],
  ],
  templar:[
    [S_('Heal',{now:'heal',vars:[V('Holy Relic',{k:'uses',n:60}),V('Auras',{k:'uses',n:120})]}),
     S_('Bulwark',{now:'guard',vars:[V('Molten Shell',{k:'uses',n:60}),V('Bone Armour',{k:'uses',n:120})]}),P_('Devotion',{heal:5},5)],
    [S_('Smite',{soon:true,vars:[V('Consecrated Ground',{k:'multi',min:3,n:50}),V('Holy Strike',{k:'kills',n:120})]}),P_('Faithful',{mregen:6},5),P_('Plated',{defPct:4},5)],
    [S_('Essence Drain',{soon:true,vars:[V('Contagion',{k:'multi',min:3,n:40}),V('Blight',{k:'fam',fam:'undead',n:60})]}),P_('Sanctity',{res:{rot:6}},3),P_('Zeal',{inc:{lightning:6}},3)],
    [S_('Storm Call',{soon:true,vars:[V('Orb of Storms',{k:'uses',n:60}),V('Shock Nova',{k:'multi',min:3,n:50})]}),P_('Guardian',{hpPct:4},3),P_('Mender',{regen:.4},3)],
    [K_('Divine Judgement',{inc:{lightning:15,fire:15}}),K_('Sanctuary',{heal:20,mana:30,mregen:20})],
  ],
};
// Every node, by id ("class.slug"), with its tier and column.
const TREE=(()=>{
  const N={},slug=s=>s.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
  for(const cls in BOARD_PLAN)BOARD_PLAN[cls].forEach((row,tier)=>row.forEach(([k,name,o,max],col)=>{
    const id=cls+'.'+slug(name),q={id,cls,k,name,tier,col,max};
    if(k==='skill'){Object.assign(q,{now:o.now||null,soon:!!o.soon,vars:o.vars.map((v,i)=>({id:id+'.'+i,name:v.name,ch:v.ch}))});}
    else q.fx=o;
    N[id]=q;}));
  return N;
})();
const boardOf=cls=>Object.values(TREE).filter(q=>q.cls===cls);

/* ---------- points ---------- */
// S.tree: {node id: ranks}. The free skills (now) are not in it.
const treeOf=s=>s.tree&&typeof s.tree==='object'&&!Array.isArray(s.tree)?s.tree:(s.tree={});
const bossClears=s=>Object.keys(s.floors||{}).filter(n=>+n>0&&s.floors[n].boss>0).length;
const treeEarned=s=>(s.char.level-1)+bossClears(s);
const treeSpent=s=>Object.values(treeOf(s)).reduce((a,b)=>a+b,0);
const treeLeft=s=>treeEarned(s)-treeSpent(s);
const tierOpen=(spent,tier)=>spent>=TIERS[tier];
// Can this tree take one more rank of id? (t: the ranks so far, a copy while checking a batch.) In your class's board,
// a passive or a key, below its ranks, in an open tier, with a point to spend.
function treeCanRank(s,id,t=treeOf(s)){
  const q=TREE[id];if(!q||q.cls!==s.char.cls||q.k==='skill')return false;
  const spent=Object.values(t).reduce((a,b)=>a+b,0);
  return(t[id]||0)<q.max&&tierOpen(spent,q.tier)&&spent<treeEarned(s);
}
// Applies a batch of ranks ({id: n}) at once, in tier order, or none of them. What the board's Confirm sends.
function treeBatch(s,add){
  const t=Object.assign({},treeOf(s)),ids=Object.keys(add||{}).filter(id=>TREE[id]).sort((a,b)=>TREE[a].tier-TREE[b].tier);
  for(const id of ids){const n=add[id];if(!Number.isInteger(n)||n<1||n>5)return null;for(let i=0;i<n;i++){if(!treeCanRank(s,id,t))return null;t[id]=(t[id]||0)+1;}}
  return ids.length?t:null;
}
const treeResetCost=s=>20*treeSpent(s);
// The skill tree only opens out of combat: in a safe place, or 5 seconds after you last struck or were struck.
const outOfCombat=()=>!!(G.village||P.safe||G.time-(P.fightT??-99)>5);

/* ---------- challenges ---------- */
// The base skill a SKILLS key counts toward, for this class (its board's node with that now).
const nowNode=(cls,skill)=>Object.values(TREE).find(q=>q.cls===cls&&q.now===skill)||null;
const progKey=(id,ch)=>id+'|'+ch.k+(ch.k==='multi'?ch.min:ch.k==='fam'?ch.fam:'');
const progOf=(s,id,ch)=>(s.prog||{})[progKey(id,ch)]||0;
const varOpen=(s,node,v)=>progOf(s,node.id,v.ch)>=v.ch.n;
// Counts toward the challenges of the skill being used: ev 'use' (it was used), 'hit' (that use has now hit o.hits
// enemies), 'kill' (it killed o.e).
function skillCount(skill,ev,o){
  const q=nowNode(S.char.cls,skill);if(!q)return;const p=S.prog||(S.prog={});
  for(const v of q.vars){const ch=v.ch,k=progKey(q.id,ch);let add=0;
    if(ev==='use'&&ch.k==='uses')add=1;
    else if(ev==='hit'&&ch.k==='multi'&&o.hits===ch.min)add=1;
    else if(ev==='kill'){const e=o.e;if(ch.k==='kills'||(ch.k==='elite'&&(e.elite||e.boss))||(ch.k==='fam'&&famOf(e)===ch.fam))add=1;}
    if(add&&(p[k]||0)<ch.n){p[k]=(p[k]||0)+1;if(p[k]>=ch.n)bannerMe(v.name+' unlocked',`A new form of ${q.name}. Choose it on your skill board (P).`,3200);}}
}

/* ---------- what the board adds up to ---------- */
function treeApply(st,tree){
  const t={inc:{},res:{},hp:0,hpPct:0,def:0,defPct:0,crit:0,critDmg:0,move:0,aspd:0,cdr:0,mana:0,mregen:0,regen:0,evade:0,heal:0};
  for(const id in tree||{}){const q=TREE[id],r=tree[id];if(!q||!q.fx||!(r>0))continue;
    for(const k in q.fx){const v=q.fx[k];if(k==='inc'||k==='res'){for(const x in v)t[k][x]=(t[k][x]||0)+v[x]*r;}else if(k in t)t[k]+=v*r;}}
  st.inc=t.inc;st.eres=t.res;
  st.maxHp=(st.maxHp+t.hp)*(1+t.hpPct/100);st.def=(st.def+t.def)*(1+t.defPct/100);
  st.crit+=t.crit;st.critDmg+=t.critDmg;st.movePct+=t.move;st.aspd*=1+t.aspd/100;st.cdr=Math.min(60,st.cdr+t.cdr);
  st.maxMp+=t.mana;st.mpRegen*=1+t.mregen/100;st.regen+=t.regen;st.evade=Math.min(40,st.evade+t.evade);st.healPow*=1+t.heal/100;
  return st;
}
// One line saying what a node does (per rank), for the board.
function treeDesc(q){
  if(q.k==='skill')return q.soon?'A skill that comes with the new combat.':`Your class knows it from the start. Its weapon: ${q.now==='guard'?'the mace':q.now==='heal'?'the grimoire of faith':q.now==='fireball'?'the grimoire of magic':
    {circle:'the longsword',pierce:'the spear',sunder:'the greatsword',volley:'the bow',blink:'the dagger'}[q.now]}.`;
  const out=[],f=q.fx,pct=(v,s)=>`+${v}% ${s}`;
  for(const k in f){const v=f[k];
    if(k==='inc')for(const t in v)out.push(pct(v[t],`${TAGS[t].name.toLowerCase()} damage`));
    else if(k==='res')for(const t in v)out.push(`${v[t]}% less ${DTYPES[t].name.toLowerCase()} damage taken`);
    else out.push({hp:`+${v} health`,hpPct:pct(v,'health'),def:`+${v} defense`,defPct:pct(v,'defense'),crit:`+${v}% critical chance`,critDmg:pct(v,'critical damage'),
      move:pct(v,'move speed'),aspd:pct(v,'attack speed'),cdr:pct(v,'cooldown recovery'),mana:`+${v} mana`,mregen:pct(v,'mana regeneration'),
      regen:`+${v} health regenerated a second`,evade:`+${v}% chance to dodge`,heal:pct(v,'healing')}[k]);}
  return out.join(', ')+(q.max>1?' a rank.':'.');
}
function chDesc(ch){
  const k=ch.k,n=ch.n;
  return(k==='uses'?`Use it ${n} times`:k==='multi'?`Hit ${ch.min} or more enemies with one use, ${n} times`:k==='kills'?`Kill ${n} enemies with it`:
    k==='elite'?`Kill ${n} elites or bosses with it`:`Kill ${n} ${FAMILIES[ch.fam].them} with it`)+'.';
}

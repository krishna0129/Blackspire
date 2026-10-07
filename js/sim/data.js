'use strict';
// Blackspire: Game tables: weapons, skills, passives, gear, enemies.

/* ---------- data ---------- */
const TILE=16, MW=120, MH=80;
const RARITY=[
  {name:'Common',color:'#9a98a6',mult:1,aff:0},
  {name:'Uncommon',color:'#7fc46a',mult:1.15,aff:1},
  {name:'Rare',color:'#5aa7e6',mult:1.32,aff:1},
  {name:'Epic',color:'#b07be8',mult:1.55,aff:2},
  {name:'Legendary',color:'#e8b24a',mult:1.85,aff:2},
];
// One weapon type = one class = one skill. aspd = attacks per second, range px, arc degrees (under 50 = thrust).
// ranged:true fires arrows, magic:true fires bolts; for both, range is how far the shot flies.
const WTYPES={
  sword:{name:'Longsword',cls:'Swordsman',dmg:12,aspd:1.6,range:26,arc:110,kb:40,skill:'circle',shield:'buckler',blurb:'Longsword and buckler'},
  dagger:{name:'Dagger',cls:'Rogue',dmg:6.5,aspd:3.2,range:19,arc:80,kb:10,crit:12,skill:'blink',blurb:'Fastest, shortest reach'},
  great:{name:'Greatsword',cls:'Slayer',dmg:26,aspd:0.85,range:34,arc:150,kb:90,skill:'sunder',blurb:'Slow, wide, heavy'},
  mace:{name:'Mace',cls:'Tank',dmg:16,aspd:1.25,range:24,arc:100,kb:70,def:8,skill:'guard',shield:'shield',blurb:'Mace and heavy shield'},
  spear:{name:'Spear',cls:'Lancer',dmg:13,aspd:1.4,range:44,arc:24,kb:30,skill:'pierce',blurb:'Longest melee reach, narrow'},
  bow:{name:'Bow',cls:'Archer',dmg:10,aspd:1.5,range:150,arc:0,kb:25,crit:5,ranged:true,skill:'volley',blurb:'Arrows from range, scales with dexterity'},
  grimoire:{name:'Grimoire',cls:'Mage',dmg:9,aspd:1.5,range:135,arc:0,kb:20,magic:true,skill:'fireball',blurb:'Ranged bolts'},
};
// Off-hand shields. cut: share of a blow from the front that blocking removes. sure: the same for a boss's
// telegraphed attacks. arc: how wide "the front" is, in degrees. cost: mana per blocked blow. slow: move speed while blocking.
const SHIELDS={
  buckler:{name:'Buckler',cut:.6,sure:.3,arc:130,cost:4,slow:.55,w:9,h:9},
  shield:{name:'Heavy shield',cut:1,sure:.6,arc:170,cost:7,slow:.3,w:11,h:13},
};
// Every skill has a cooldown (seconds) and a mana cost.
const SKILLS={
  circle:{name:'Circular slash',cd:5,mp:14,desc:'One full spin that cuts everything around you and throws it back.'},
  blink:{name:'Shadowstep',cd:5,mp:14,desc:'Appear behind the nearest enemy for a guaranteed critical.'},
  sunder:{name:'Sunder',cd:6,mp:16,desc:'A huge cleave. Enemies hit take 25% more damage for 4s.'},
  guard:{name:'Bulwark',cd:12,mp:18,desc:'Take 60% less damage for 5 seconds.'},
  pierce:{name:'Piercing line',cd:5,mp:14,desc:'A long thrust that passes through every enemy in a line.'},
  volley:{name:'Volley',cd:6,mp:16,desc:'Five arrows in a fan.'},
  fireball:{name:'Fireball',cd:5,mp:18,desc:'A slow orb that bursts on impact and hits everything in the blast. Intelligence raises its damage.'},
  heal:{name:'Heal',cd:9,mp:24,desc:'Restores health to you and every ally near you. It never affects enemies. Faith raises the amount.'},
};
const skillOf=it=>it.school==='faith'?'heal':WTYPES[it.type].skill;
const classOf=it=>it.school==='faith'?'Healer':WTYPES[it.type].cls;
// A grimoire belongs to exactly one school and only ever rolls bonuses from that school's pool.
const GRIM={
  magic:{label:'embers',attr:'intelligence and Fireball',tint:'#8a2f2f',pool:{
    int:{name:'Scholar\u2019s',range:[2,5],scale:1,fmt:v=>`+${v} intelligence`},
    mdmg:{name:'Searing',range:[8,20],fmt:v=>`+${v}% magic damage`},
    blast:{name:'Bursting',range:[15,35],fmt:v=>`+${v}% Fireball blast radius`},
    ember:{name:'Smouldering',range:[25,55],fmt:v=>`Fireball burns for ${v}% damage over 3s`}}},
  faith:{label:'grace',attr:'faith and Heal',tint:'#d8cfa8',pool:{
    fai:{name:'Devout',range:[2,5],scale:1,fmt:v=>`+${v} faith`},
    heal:{name:'Merciful',range:[10,25],fmt:v=>`+${v}% healing from Heal`},
    mend:{name:'Lingering',range:[30,60],fmt:v=>`Heal restores a further ${v}% over 5s`},
    quick:{name:'Swift',range:[10,25],fmt:v=>`Heal recharges ${v}% faster`},
    ward:{name:'Warding',range:[10,22],fmt:v=>`Take ${v}% less damage for 4s after Heal`}}},
};
const affDef=(it,id)=>it.slot==='weapon'?(PASSIVES[id]||GRIM.magic.pool[id]||GRIM.faith.pool[id]):GEAR_AFFIX[id];
const PASSIVES={
  lifesteal:{name:'Leeching',range:[2,5],fmt:v=>`Heal ${v}% of damage dealt`},
  bleed:{name:'Serrated',range:[20,45],fmt:v=>`Hits bleed for ${v}% damage over 3s`},
  keen:{name:'Keen',range:[5,12],fmt:v=>`+${v}% critical chance`},
  brutal:{name:'Brutal',range:[20,50],fmt:v=>`+${v}% critical damage`},
  execute:{name:'Executioner\u2019s',range:[25,60],fmt:v=>`+${v}% damage to enemies below 30% health`},
  momentum:{name:'Quickening',range:[4,9],fmt:v=>`Each hit gives +${v}% attack speed for 3s, up to 5 stacks`},
  reach:{name:'Sweeping',range:[10,22],fmt:v=>`+${v}% reach and arc`},
  stagger:{name:'Staggering',range:[8,18],fmt:v=>`${v}% chance to stun for 0.8s`},
  focus:{name:'Focused',range:[10,25],fmt:v=>`Skill recharges ${v}% faster`},
  giant:{name:'Giant-slaying',range:[15,35],fmt:v=>`+${v}% damage to elites and floor bosses`},
  spark:{name:'Arcing',range:[15,30],fmt:v=>`${v}% chance to arc half damage to a second enemy`},
};
const GEAR_AFFIX={
  hp:{name:'Stalwart',range:[12,30],scale:1,fmt:v=>`+${v} health`},
  def:{name:'Warded',range:[3,8],scale:1,fmt:v=>`+${v} defense`},
  move:{name:'Fleet',range:[3,7],fmt:v=>`+${v}% move speed`},
  crit:{name:'Hunter\u2019s',range:[2,6],fmt:v=>`+${v}% critical chance`},
  regen:{name:'Mending',range:[1,3],fmt:v=>`+${v} health per second`},
  thorns:{name:'Barbed',range:[10,25],fmt:v=>`Reflect ${v}% of damage taken`},
  xp:{name:'Seeker\u2019s',range:[5,12],fmt:v=>`+${v}% experience`},
  cdr:{name:'Adept\u2019s',range:[5,12],fmt:v=>`Skill recharges ${v}% faster`},
  mana:{name:'Deep',range:[8,18],scale:1,fmt:v=>`+${v} max mana`},
  mregen:{name:'Flowing',range:[10,25],fmt:v=>`+${v}% mana regeneration`},
};
const ATYPES={
  tunic:{name:'Tunic',def:4,hp:10,move:0},
  leather:{name:'Leather jerkin',def:7,hp:16,move:0},
  coat:{name:'Longcoat',def:6,hp:10,move:3},
  plate:{name:'Plate cuirass',def:14,hp:30,move:-4},
};
const BTYPES={
  boots:{name:'Boots',def:2,move:4},
  greaves:{name:'Greaves',def:5,move:1},
  striders:{name:'Striders',def:1,move:7},
};
const TTYPES={ring:{name:'Ring'},charm:{name:'Charm'},band:{name:'Band'}};
const LEGEND={sword:['Nightfall','Pale Oath'],dagger:['Whisper','Thorn of Dusk'],
  great:['Gravemaker','Ashen Sun','Rift Cleaver'],bow:['Farsight','Mourning Dove'],mace:['Bellringer','Stonevow','Last Light'],spear:['Skyreach','Long Night'],
  magic:['Cinderscript','The Red Canticle'],faith:['Dawn Psalter','Book of Quiet Mercy']};
const BOWS=['#8a5a2b','#6b4a2c','#3b3f52','#b0464d','#63b98e','#dcb65c'];
const BLADES=['#c3cad6','#3b3f52','#b0464d','#5ab0de','#63b98e','#dcb65c','#a98be0'];
const OUTFITS=['#23232b','#2b3350','#5a2630','#2f4a3a','#8a8474','#6b4a2c','#3c2c52','#b9b4a6'];
const SKINS=['#f2d3b6','#e0b08a','#c68d62','#9a643f','#6e4428','#d9c7c0'];
const HAIRS=['#1b1b22','#4a2f1e','#8a5a2b','#d8b45a','#b9382f','#c9c6d4','#3d5a8a','#7a4a8f'];
const EYES=['#1c1c24','#2f5fa8','#2f7f4a','#7a4a1e','#a83232','#6f55c0'];
const STYLES=['Short','Spiked','Long','Tail','Bob','Buzz'];
const ETYPES={
  shade:{name:'Shade',hp:34,dmg:9,speed:40,r:6,reach:5,windup:.38,recover:.7,xp:9,eye:'#e2553f'},
  skitter:{name:'Skitter',hp:15,dmg:5,speed:74,r:4,reach:4,windup:.22,recover:.5,xp:5,eye:'#e2b93b'},
  brute:{name:'Brute',hp:110,dmg:19,speed:26,r:8,reach:8,windup:.75,recover:1,xp:20,eye:'#e2553f',heavy:true},
  // Floor 2: the dead. mres = share of magic damage they ignore (grimoire bolts, Fireball, its burn).
  // ai: these three move and fight the way enemies in old top-down adventures do (see zeldaAI in update.js).
  // fw, fh: frame size in their sprite sheet (three frames across, three facings down).
  skel:{name:'Bone soldier',hp:46,dmg:11,speed:46,r:6,reach:6,windup:.3,recover:.55,xp:12,eye:'#9be08a',mres:.75,line:'#8d8674',ai:'stalfos',fw:20,fh:23},
  skelarcher:{name:'Bone archer',hp:26,dmg:10,speed:40,r:5,ranged:true,pspeed:150,pcol:'#d9d4c4',xp:13,eye:'#9be08a',mres:.75,line:'#8d8674',ai:'archer',fw:18,fh:21},
  skelknight:{name:'Bone knight',hp:140,dmg:21,speed:30,r:8,reach:8,windup:.7,recover:1.1,xp:26,eye:'#9be08a',mres:.85,heavy:true,line:'#8d8674',ai:'darknut',shield:true,fw:24,fh:24},
  wisp:{name:'Wisp',hp:22,dmg:8,speed:32,r:4,ranged:true,xp:11,eye:'#6fd6e6'},
  boss:{name:'Boss',hp:520,dmg:22,speed:36,r:15,xp:160,eye:'#ff4a3d'},
};
// Enhancement materials, from common to rare. Enemies, chests and bosses drop them; salvaging gear gives them back.
const MATS={
  scrap:{name:'Iron scrap',color:'#b9b4c8'},
  ember:{name:'Emberstone',color:'#f08a3c'},
  crystal:{name:'Spire crystal',color:'#a98be0'},
};
const BOSSES=['The Gate Warden','The Bone Regent','The Pale Collector','Ash Regent','The Unlit King','Keeper of the Ninth Stair','Old Hunger','The Bell Below'];

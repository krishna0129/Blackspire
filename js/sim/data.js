'use strict';
// Blackspire: Game tables: weapons, skills, passives, gear, enemies.

/* ---------- data ---------- */
const TILE=16, MW=120, MH=80;
// A player's own character sheet: 88 x 78 game pixels. The file may be drawn finer, at a whole-number ratio up to
// MAX_RATIO (176 x 156 is a ratio of 2). Returns the ratio, or 0 when the size doesn't fit.
const SHEET_W=88, SHEET_H=78, MAX_RATIO=4;
function sheetRatio(w,h){const k=w/SHEET_W;return Number.isInteger(k)&&k>=1&&k<=MAX_RATIO&&h===SHEET_H*k?k:0;}
const RARITY=[
  {name:'Common',color:'#9a98a6',mult:1,aff:0},
  {name:'Uncommon',color:'#7fc46a',mult:1.15,aff:1},
  {name:'Rare',color:'#5aa7e6',mult:1.32,aff:1},
  {name:'Epic',color:'#b07be8',mult:1.55,aff:2},
  {name:'Legendary',color:'#e8b24a',mult:1.85,aff:2},
];
// One weapon type = one class = one skill. aspd = attacks per second, range px, arc degrees (under 50 = thrust).
// ranged:true fires arrows, magic:true fires bolts; for both, range is how far the shot flies. tags: the basic attack's
// (TAGS): the grimoire's bolts are lightning.
const WTYPES={
  sword:{tags:['melee','physical','sword'],name:'Longsword',cls:'Swordsman',dmg:12,aspd:1.6,range:26,arc:110,kb:40,skill:'circle',shield:'buckler',blurb:'Longsword and buckler',pz:1,parry:true},
  dagger:{tags:['melee','physical','dagger'],name:'Dagger',cls:'Rogue',dmg:6.5,aspd:3.2,range:19,arc:80,kb:10,crit:12,skill:'blink',blurb:'Fastest, shortest reach',pz:0.6,parry:true},
  great:{tags:['melee','area','physical','greatsword'],name:'Greatsword',cls:'Slayer',dmg:26,aspd:0.85,range:34,arc:150,kb:90,skill:'sunder',blurb:'Slow, wide, heavy',pz:2.2,parry:true},
  mace:{tags:['melee','physical','mace'],name:'Mace',cls:'Tank',dmg:16,aspd:1.25,range:24,arc:100,kb:70,def:8,skill:'guard',shield:'shield',blurb:'Mace and heavy shield',pz:1.6},
  spear:{tags:['melee','physical','spear'],name:'Spear',cls:'Lancer',dmg:13,aspd:1.4,range:44,arc:24,kb:30,skill:'pierce',blurb:'Longest melee reach, narrow',pz:1.1},
  bow:{tags:['projectile','physical','bow'],name:'Bow',cls:'Archer',dmg:10,aspd:1.5,range:150,arc:0,kb:25,crit:5,ranged:true,skill:'volley',blurb:'Arrows from range, scales with dexterity',pz:0.5},
  grimoire:{tags:['projectile','lightning','grimoire'],name:'Grimoire',cls:'Mage',dmg:9,aspd:1.5,range:135,arc:0,kb:20,magic:true,skill:'fireball',blurb:'Ranged bolts',pz:0.5},
};
// Off-hand shields. cut: share of a blow from the front that blocking removes. sure: the same for a boss's
// telegraphed attacks. arc: how wide "the front" is, in degrees. cost: stamina per blocked blow. slow: move speed while blocking.
// pz (weapons above): how hard a weapon's blows wear down an enemy's poise. parry: a weapon that can parry without a
// shield (docs/design/combat.md): swords and daggers. Shields parry too, and are the only way to hold a block.
const SHIELDS={
  buckler:{name:'Buckler',cut:.6,sure:.3,arc:130,cost:14,slow:.55,w:9,h:9},
  shield:{name:'Heavy shield',cut:1,sure:.6,arc:170,cost:20,slow:.3,w:11,h:13},
};
// Stamina, the dash, parrying, poise and focus (docs/design/combat.md).
//   sta     stamina: the bar's size by class (STA_CLASS), what a dash costs, how fast it comes back, and how much slower
//           while you are doing anything but walking (attacking, blocking, dashing)
//   parry   how long after pressing block a blow counts as parried, what it costs, how arc-wide the front is without a
//           shield, and how long it staggers the attacker (bosses much less)
//   poise   yours: a base, more for each point of armour weight (ARMOR_WEIGHT); a physical blow wears it down, and at
//           zero it interrupts you. It comes back after a moment without being hit.
//   focus   per point of Mind, the chance a blow does not break a spell you are casting (at most focusMax)
//   epoise  an enemy's poise, as a share of its health; broken, it is staggered (stun) and takes more damage (more%)
//   kb      how far a blow pushes you: light physical, heavy physical (also a short stagger), magic
const COMBAT={
  sta:{dash:30,regen:30,busy:.35,delay:.5},
  dashSpeed:3.3,dashT:.16,dashCd:.35,
  parry:{win:.2,cost:8,arc:120,stun:1,bossStun:.3},
  poise:{base:10,perWeight:6,light:8,heavy:26,regen:18,delay:2},
  focus:{perMind:3,max:75},
  epoise:{share:.35,elite:.45,boss:.14,stun:1.2,bossStun:3,more:30,regen:.25,delay:3},
  kb:{light:45,heavy:120,magic:85,stagger:.35},
  swingSlow:.45,
  walk:{up:.11,down:.085,foe:.25},   // seconds: you to full speed, you to a stop, an enemy to its full pace
};
// What each piece of armour weighs, until the new gear arrives (docs/design/gear.md#weight): poise grows with it.
const ARMOR_WEIGHT={tunic:1,leather:2,coat:2,plate:5,striders:.5,boots:1,greaves:2};
// Each class's base numbers (docs/design/classes.md): health and mana as multipliers, stamina as the bar's size,
// dash as a multiplier of its length.
const CLASS_BASE={
  marauder:{hp:1.2,mp:1,sta:120,dash:1},
  duelist:{hp:1,mp:.7,sta:120,dash:1},
  ranger:{hp:1,mp:1,sta:100,dash:1.15},
  shadow:{hp:.85,mp:.7,sta:120,dash:1.3},
  witch:{hp:.85,mp:1.3,sta:80,dash:.75},
  templar:{hp:1,mp:1.3,sta:80,dash:.75},
};
// Damage types. Every hit is one of these. physical is weapons and arrows; the rest are elements, which an enemy's
// mres (its resistance to magic) also cuts, and rot, which only a family's own resistance does (FAMILIES[].res).
// status: what each will do when the new combat gives elements their effects (docs/design/skills.md).
const DTYPES={
  physical:{name:'Physical',color:'#d9d4c4',status:'bleed'},
  fire:{name:'Fire',color:'#f08a3c',status:'burn',elem:true},
  cold:{name:'Cold',color:'#8fd8f0',status:'chill',elem:true},
  lightning:{name:'Lightning',color:'#e8e070',status:'shock',elem:true},
  rot:{name:'Rot',color:'#9be08a',status:'wither'},
};
// Tags: a closed list. Every hit carries some (the skill's, or the basic attack's: WTYPES[].tags), and the skill tree
// and, later, gear only ever add damage to a tag, never to one skill, so a new skill works with them from the start.
const TAGS={
  melee:{name:'Melee'},projectile:{name:'Projectile'},area:{name:'Area'},chain:{name:'Chain'},channel:{name:'Channelled'},
  totem:{name:'Totem'},trap:{name:'Trap'},mine:{name:'Mine'},minion:{name:'Minion'},aura:{name:'Aura'},warcry:{name:'Warcry'},
  movement:{name:'Movement'},guard:{name:'Guard'},overtime:{name:'Over time'},
  physical:{name:'Physical'},fire:{name:'Fire'},cold:{name:'Cold'},lightning:{name:'Lightning'},rot:{name:'Rot'},
  sword:{name:'Longsword'},greatsword:{name:'Greatsword'},mace:{name:'Mace'},spear:{name:'Spear'},dagger:{name:'Dagger'},bow:{name:'Bow'},grimoire:{name:'Grimoire'},
};
// The damage type of a hit with these tags: the first type among them, else physical.
const dtypeOf=tags=>(tags||[]).find(t=>DTYPES[t])||'physical';
// Every skill has a cooldown (seconds) and a mana cost, and tags (TAGS) for what it is.
const SKILLS={
  circle:{tags:['melee','area','physical','sword'],name:'Circular slash',cd:5,mp:14,desc:'One full spin that cuts everything around you and throws it back.'},
  blink:{tags:['melee','movement','physical','dagger'],name:'Shadowstep',cd:5,mp:14,desc:'Appear behind the nearest enemy for a guaranteed critical.'},
  sunder:{tags:['melee','area','physical','greatsword'],name:'Sunder',cd:6,mp:16,desc:'A huge cleave. Enemies hit take 25% more damage for 4s.'},
  guard:{tags:['guard','mace'],name:'Bulwark',cd:12,mp:18,desc:'Take 60% less damage for 5 seconds.'},
  pierce:{tags:['melee','physical','spear'],name:'Piercing line',cd:5,mp:14,desc:'A thrust that passes through every enemy in a short line: your weapon\u2019s reach and almost three tiles more.'},
  volley:{tags:['projectile','physical','bow'],name:'Volley',cd:6,mp:16,desc:'Five arrows in a fan.'},
  fireball:{tags:['projectile','area','fire','grimoire'],name:'Fireball',cd:5,mp:18,desc:'A slow orb that bursts on impact and hits everything in the blast. Intelligence raises its damage.'},
  heal:{tags:['aura','grimoire'],name:'Heal',cd:6,mp:22,desc:'Restores a lot of health to the ally you aim at, or to you. Faith raises the amount.'},
  // the Templar (docs/design/skills.md): heals, a shield, a revive, an empowered attack; and three ultimates
  partyheal:{tags:['aura'],name:'Party Heal',cd:14,mp:34,desc:'Restores health to you and every ally near you. It never affects enemies.'},
  renewal:{tags:['aura'],name:'Renewal',cd:10,mp:24,desc:'The ally you aim at (or you) heals steadily for 8 seconds.'},
  aegis:{tags:['guard'],name:'Aegis',cd:14,mp:26,desc:'A shield on the ally you aim at (or you) takes the next blows, for 8 seconds.'},
  revive:{tags:['aura'],name:'Revive',cd:40,mp:40,desc:'Brings back a fallen ally you aim at, within 15 seconds of the fall, with nothing lost.'},
  smite:{tags:['melee','empower'],name:'Smite',cd:12,mp:22,sound:'crit',desc:'Your next four attacks strike with holy light: 70% more damage, for 8 seconds.'},
  judgement:{tags:['area','lightning'],name:'Judgement',cd:75,mp:60,ult:true,desc:'Eight strikes of light fall where you aim, one after another.'},
  massheal:{tags:['aura'],name:'Mass Heal',cd:90,mp:70,ult:true,desc:'A great heal for the whole party, wherever they are on the floor, and more over the next seconds.'},
  resurrect:{tags:['aura'],name:'Resurrection',cd:150,mp:80,ult:true,desc:'Brings back every fallen ally, within 15 seconds of their fall, with nothing lost.'},
  // the Marauder
  heavy:{tags:['melee','physical','empower'],name:'Heavy Strike',cd:9,mp:16,sound:'crit',desc:'Your next three attacks land 60% harder and break poise three times as fast, for 8 seconds.'},
  leap:{tags:['melee','area','movement','physical'],name:'Leap Slam',cd:8,mp:18,desc:'Leap to the mouse (up to five or six tiles) and slam down, striking everything around you.'},
  cry:{tags:['warcry'],name:'Enduring Cry',cd:60,mp:40,ult:true,desc:'A warcry: you and every ally near you take 30% less damage for 10 seconds.'},
  quake:{tags:['melee','area','physical'],name:'Earthquake',cd:60,mp:50,ult:true,desc:'A huge slam around you, and an aftershock a moment later. It breaks poise like nothing else.'},
  berserk:{tags:['physical'],name:'Berserk',cd:70,mp:40,ult:true,desc:'For 10 seconds: 40% more damage, heal 10% of what you deal, and nothing knocks you back.'},
  // the Duelist
  riposte:{tags:['melee','guard','physical'],name:'Riposte',cd:7,mp:14,desc:'For a moment, any blow from the front is parried and answered with a hard counter.'},
  double:{tags:['melee','physical','empower'],name:'Double Strike',cd:12,mp:10,desc:'For 10 seconds every attack lands twice, at 3 mana a hit.'},
  cuts:{tags:['melee','physical'],name:'Thousand Cuts',cd:60,mp:45,ult:true,desc:'A blinding flurry of eight cuts on the enemy you aim at, within a few steps of your reach.'},
  challenge:{tags:['physical'],name:'Challenge',cd:50,mp:30,ult:true,desc:'Mark the enemy you aim at for 12 seconds: it must fight you, and takes 40% more from you.'},
  storm:{tags:['melee','physical'],name:'Piercing Storm',cd:60,mp:50,ult:true,desc:'Five thrusts, one after another, each through every enemy in a line: your reach and almost four tiles more.'},
  // the Ranger
  lightarrow:{tags:['projectile','lightning','bow'],name:'Lightning Arrow',cd:5,mp:16,desc:'An arrow that leaps on to three more enemies.'},
  caustic:{tags:['projectile','rot','bow'],name:'Caustic Arrow',cd:7,mp:18,desc:'An arrow that leaves a pool of poison where it lands, for 5 seconds.'},
  split:{tags:['projectile','physical','bow'],name:'Split Arrow',cd:5,mp:14,desc:'A heavy arrow that passes through up to four enemies.'},
  rain:{tags:['projectile','area','physical'],name:'Rain of Arrows',cd:60,mp:50,ult:true,desc:'Arrows fall over a wide area where you aim, for 2 seconds.'},
  ballista:{tags:['projectile','physical'],name:'Ballista',cd:60,mp:45,ult:true,desc:'Set down a ballista that shoots the nearest enemy for 15 seconds.'},
  tornado:{tags:['projectile','physical'],name:'Tornado Shot',cd:50,mp:40,ult:true,desc:'One arrow that bursts into twelve, in every direction, where it stops.'},
  // the Shadow
  viper:{tags:['melee','rot','empower'],name:'Viper Strike',cd:10,mp:8,desc:'For 10 seconds your attacks poison, at 2 mana a hit.'},
  vortex:{tags:['melee','area','physical'],name:'Blade Vortex',cd:8,mp:18,desc:'Blades spin around you for 4 seconds, cutting whatever comes close.'},
  smoke:{tags:['movement'],name:'Smoke Cloud',cd:14,mp:20,desc:'A cloud of smoke where you stand: inside it, enemies lose track of you for 5 seconds.'},
  deathmark:{tags:['physical'],name:'Death Mark',cd:50,mp:35,ult:true,desc:'Mark the enemy you aim at: after 4 seconds it takes half of everything you dealt it again.'},
  dance:{tags:['melee','movement','physical'],name:'Shadow Dance',cd:60,mp:45,ult:true,desc:'Blink from enemy to enemy, striking up to six of them.'},
  vanish:{tags:['movement'],name:'Vanish',cd:60,mp:35,ult:true,desc:'Vanish for 4 seconds: enemies lose you, nothing touches you, and your next attack deals four times the damage.'},
  // the Witch
  frostbolt:{tags:['projectile','cold','grimoire'],name:'Frostbolt',cd:4,mp:14,desc:'A bolt of ice that slows what it hits by 40% for 3 seconds.'},
  arc:{tags:['lightning','chain','grimoire'],name:'Arc',cd:5,mp:16,desc:'Lightning that jumps from the enemy you aim at to four more.'},
  icenova:{tags:['area','cold','grimoire'],name:'Ice Nova',cd:9,mp:22,desc:'A ring of frost bursts from you: it hurts, slows and pushes back everything near.'},
  raise:{tags:['minion'],name:'Raise the Dead',cd:70,mp:55,ult:true,desc:'Three of the dead rise to fight beside you for 20 seconds.'},
  meteor:{tags:['area','fire'],name:'Meteor',cd:60,mp:50,ult:true,desc:'After a moment, marked on the ground, a meteor strikes where you aimed.'},
  blizzard:{tags:['area','cold'],name:'Blizzard',cd:60,mp:50,ult:true,desc:'A storm of ice where you aim, for 5 seconds: it slows and hurts everything inside.'},
};
const skillOf=it=>it.school==='faith'?'heal':WTYPES[it.type].skill;   // a weapon's own skill (the board's "now" skills, and old saves)
// the classes whose weapon this is (CLASSES, tree.js)
const classOf=it=>classesFor(it).map(c=>CLASSES[c].name).join(' or ');
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
// Enemy families. Every monster belongs to one: ETYPES[].fam, and a boss takes FLOORS[].boss.fam. A family has its own
// drop (mat, a MATS key), and the forge turns those drops into gear against that family: weapons that hit it harder,
// armour and boots that take less from it (FORGING, below). them: how the family reads in a sentence. bane, ward: the
// names forged weapons and armour carry. tint, cloth: their colours (blades and bows; armour and boots). res: percent
// less damage taken of a type (DTYPES), negative for a weakness; only for types no weapon deals yet, so nothing today changes.
const FAMILIES={
  spirit:{res:{rot:-25,cold:25},name:'Spirits',them:'spirits',mat:'essence',bane:'Shadebane',ward:'Shadeward',tint:'#d86fb6',cloth:'#5a2e52'},
  undead:{res:{rot:50,cold:25},name:'Undead',them:'the undead',mat:'bone',bane:'Gravebane',ward:'Graveward',tint:'#e6dfc4',cloth:'#8a8474'},
  plant:{res:{cold:-25,rot:25},name:'Plants',them:'plants',mat:'thornwood',bane:'Thornbane',ward:'Thornward',tint:'#7fb04a',cloth:'#3c5a2a'},
  beast:{res:{rot:-25},name:'Beasts',them:'beasts',mat:'chitin',bane:'Beastbane',ward:'Beastward',tint:'#b5533c',cloth:'#6a3226'},
};
// e: an enemy, or anything that carries a family (a shot remembers who fired it)
const famOf=e=>e?e.fam||(ETYPES[e.type]&&ETYPES[e.type].fam)||null:null;
// dtype: the damage type of its attacks (DTYPES), physical if not given.
// famDrop on a type: its own roll for its family's drop, instead of the LOOT table's ([chance, min, max])
const ETYPES={
  // the training yard's scarecrows: they take hits and show the numbers, never move, strike back or die
  dummy:{name:'Training scarecrow',hp:1e6,dmg:0,speed:0,r:6,reach:0,windup:1,recover:1,xp:0,eye:'#000',line:'#4a3324',dummy:true},
  shade:{fam:'spirit',name:'Shade',hp:34,dmg:9,speed:40,r:6,reach:5,windup:.38,recover:.7,xp:9,eye:'#e2553f'},
  skitter:{fam:'spirit',name:'Skitter',hp:15,dmg:5,speed:74,r:4,reach:4,windup:.22,recover:.5,xp:5,eye:'#e2b93b'},
  brute:{fam:'spirit',name:'Brute',hp:110,dmg:19,speed:26,r:8,reach:8,windup:.75,recover:1,xp:20,eye:'#e2553f',heavy:true},
  // Floor 2: the dead. mres = share of magic damage they ignore (grimoire bolts, Fireball, its burn).
  // ai: these three move and fight the way enemies in old top-down adventures do (see zeldaAI in update.js).
  // fw, fh: frame size in their sprite sheet (three frames across, three facings down).
  skel:{fam:'undead',name:'Bone soldier',hp:46,dmg:11,speed:46,r:6,reach:6,windup:.3,recover:.55,xp:12,eye:'#9be08a',mres:.75,line:'#8d8674',ai:'stalfos',fw:20,fh:23},
  skelarcher:{fam:'undead',name:'Bone archer',hp:26,dmg:10,speed:40,r:5,ranged:true,pspeed:150,pcol:'#d9d4c4',xp:13,eye:'#9be08a',mres:.75,line:'#8d8674',ai:'archer',fw:18,fh:21},
  skelknight:{fam:'undead',name:'Bone knight',hp:140,dmg:21,speed:30,r:8,reach:8,windup:.7,recover:1.1,xp:26,eye:'#9be08a',mres:.85,heavy:true,line:'#8d8674',ai:'darknut',shield:true,fw:24,fh:24},
  // Floor 3: roots and the restless dead (docs/design/floor-3.md). rooted: never moves or gets knocked back.
  // weak: damage taken from a kind of attack is multiplied (fire = Fireball and its burn). corpse: leaves a body behind.
  thrall:{fam:'undead',name:'Rotting thrall',hp:70,dmg:15,speed:30,r:6,reach:7,windup:.6,recover:.9,xp:16,eye:'#d6f07a',line:'#4d5a36',heavy:true,corpse:true},
  gravecaller:{fam:'undead',dtype:'rot',name:'Gravecaller',hp:38,dmg:12,speed:38,r:6,ranged:true,pspeed:105,pcol:'#9be08a',xp:24,eye:'#9be08a',line:'#3f3452',ai:'gravecaller'},
  thornroot:{fam:'plant',name:'Thornroot',hp:80,dmg:16,speed:0,r:8,xp:18,eye:'#f2a03c',line:'#33421f',ai:'thornroot',rooted:true,heavy:true,plant:true,weak:{fire:2},famDrop:[.6,1,1]},
  bloodbloom:{fam:'plant',name:'Bloodbloom',hp:30,dmg:0,speed:0,r:6,xp:14,eye:'#9be08a',line:'#4e1520',ai:'bloodbloom',rooted:true,plant:true},
  hermit:{fam:'beast',name:'Ossuary hermit',hp:120,dmg:20,speed:52,r:9,xp:30,eye:'#f2a03c',line:'#2b261c',ai:'hermit',heavy:true,famDrop:[1,1,2]},
  wisp:{fam:'spirit',dtype:'cold',name:'Wisp',hp:22,dmg:8,speed:32,r:4,ranged:true,xp:11,eye:'#6fd6e6'},
  boss:{name:'Boss',hp:520,dmg:22,speed:36,r:15,xp:160,eye:'#ff4a3d',heavy:true},
};
// Materials. The first three are for enhancing, from common to rare: enemies, chests and bosses drop them, and
// salvaging gear gives them back. The rest are monster drops, one per family (fam): only that family drops it, and the
// forge makes gear against that family from it.
const MATS={
  scrap:{name:'Iron scrap',color:'#b9b4c8'},
  ember:{name:'Emberstone',color:'#f08a3c'},
  crystal:{name:'Spire crystal',color:'#a98be0'},
  essence:{name:'Shade essence',color:'#d86fb6',fam:'spirit'},
  bone:{name:'Old bone',color:'#e6dfc4',fam:'undead'},
  thornwood:{name:'Thornwood',color:'#7fb04a',fam:'plant'},
  chitin:{name:'Chitin plate',color:'#b5533c',fam:'beast'},
};
/* Forging: gear made from one family's drops, at the blacksmith (grimoires at the arcanist). A forged piece is always
   Rare, at the item level a shop would sell (shopFloor), and carries a bonus against that family on top of what any
   Rare piece has:
     weapon        +bonus% damage to that family
     armor, boots  bonus% less damage taken from that family (worn together, the two add up)
   drops: how many of the family's drop it costs; scrap: iron scrap; shards: at item level 1, +30% a level after;
   bonus: [lowest, highest] percent, rolled when it is made. Salvaging a forged piece returns a third of its drops. */
const FORGING={
  weapon:{drops:12,scrap:4,shards:80,bonus:[15,25]},
  armor:{drops:10,scrap:3,shards:60,bonus:[10,20]},
  boots:{drops:6,scrap:2,shards:40,bonus:[5,10]},
};
const FORGE_RARITY=2;
/* The market: what the village's exchange buys and sells, at prices that move with its stock (js/sim/market.js).
   base: shards for one when the exchange holds its normal stock. stock: that normal stock; the smaller it is, the
   harder each trade moves the price. Keep every stock at 10 or more: below that, the rounding and the 2x cap leave
   room to buy one and sell it back for more (the market test walks every stock level to make sure none does). */
const MARKET={
  scrap:{base:5,stock:120},ember:{base:22,stock:40},crystal:{base:70,stock:12},
  essence:{base:6,stock:60},bone:{base:6,stock:60},thornwood:{base:10,stock:40},chitin:{base:12,stock:30},
};
const MARKET_MIN=.5,MARKET_MAX=2;   // a price never leaves this share of its base
const MARKET_SPREAD=.8;             // selling pays this share of the buy price
const MARKET_DRIFT=.1;              // each hour a stock moves this share of its normal size back toward normal
const MARKET_SELL_SHARE=.5;         // one player can sell this share of a good's normal stock per hour
const MARKET_HOUR=3600000;
// Everything that makes one floor different from another. Floors past the end of the list repeat the last one.
//   theme: index into THEMES (client/paint.js), the floor's stone
//   spawns: what ordinary rooms spawn, as a bag drawn from evenly (repeats make a type more common)
//   wall: a stationary enemy that may grow from a room's top wall, and the chance per room
//   thorns: thorn patches at the edges of rooms (slow and prick everything but plants)
//   boss: name, family (FAMILIES), sprite file (assets/sprites/enemies/<sprite>.png), behaviour (update.js), outline colour, and extras:
//         mres = share of magic damage ignored, calls = what it summons, corpses = corpses lying in its chamber
const FLOORS=[
  {theme:0,intro:'Find the boss chamber. It is somewhere to the east.',introMs:2800,
    spawns:['shade','shade','shade','skitter','skitter','skitter','brute','wisp'],
    boss:{name:'The Gate Warden',fam:'spirit',sprite:'boss',ai:'warden',line:'#7a4a52',calls:'skitter',hpX:18}},
  {theme:1,intro:'The dead here shrug off magic. Bring steel.',introMs:4200,
    spawns:['skel','skel','skel','skelarcher','skelarcher','skelknight','skitter','wisp'],
    boss:{name:'The Bone Regent',fam:'undead',sprite:'boneboss',ai:'regent',line:'#9a8f6a',mres:.3,calls:'skel',hpX:16}},
  {theme:2,intro:'Roots have broken into the crypt. Kill whatever raises the dead.',introMs:4200,
    spawns:['thrall','thrall','thrall','gravecaller','gravecaller','hermit','bloodbloom','skelarcher'],
    wall:{type:'thornroot',chance:.55},thorns:true,
    boss:{name:'The Pale Collector',fam:'undead',sprite:'collector',ai:'collector',line:'#8a8698',corpses:true}},
];
const floorDef=n=>FLOORS[Math.min(n,FLOORS.length)-1];
const THORN_SLOW=.6,THORN_DMG=3;   // thorn patches: speed multiplier, and damage every 0.7 s (scaled by floor, through defense)
// Supplies: things you carry by count and use with a key. key: the save's counter; price: shards on floor 1 (+25% a floor).
// need/gives: the meter a ration or flask refills, and by how much.
const SUPPLIES={
  potS:{key:'potS',cat:'hp',fill:.1,name:'Small health potion',price:10,color:'#e0736f',desc:'Restores 10% of your health.'},
  potion:{key:'potions',cat:'hp',fill:.25,name:'Health potion',price:25,color:'#d9534f',desc:'Restores 25% of your health.'},
  potL:{key:'potL',cat:'hp',fill:.5,name:'Large health potion',price:50,color:'#b52f2c',desc:'Restores 50% of your health.'},
  manaS:{key:'manaS',cat:'mp',fill:.1,name:'Small mana potion',price:10,color:'#7f8cf2',desc:'Restores 10% of your mana.'},
  mana:{key:'manas',cat:'mp',fill:.25,name:'Mana potion',price:25,color:'#5b6cf0',desc:'Restores 25% of your mana.'},
  manaL:{key:'manaL',cat:'mp',fill:.5,name:'Large mana potion',price:50,color:'#3a45c4',desc:'Restores 50% of your mana.'},
  ration:{key:'rations',cat:'food',name:'Ration',price:12,color:'#d9a441',need:'food',gives:40,desc:'Bread and dried meat. Fills 40% of your hunger meter.'},
  bag:{key:'bags',name:'Sleeping bag',price:40,color:'#8a6a44',desc:'A night\u2019s sleep in any safe room or safe point, away from the inn: all your fatigue is gone (without the inn\u2019s well-rested bonus). Used once: lay it on the ground, then F to sleep.'},
  flask:{key:'flasks',cat:'drink',name:'Water flask',price:8,color:'#5aa7e6',need:'drink',gives:50,desc:'Clean water. Fills 50% of your thirst meter. You keep the flask once it is drunk: the village well fills it again for free.'},
};
// The quick slots, keys 1 to 4: one per category of supply (docs/design/combat.md#quick-slots-1-to-4). Each holds the
// item of its category the player chose (S.quick); when that runs out, the slot reaches for another of the category.
const QUICK=[{cat:'hp',name:'Health'},{cat:'mp',name:'Mana'},{cat:'food',name:'Food'},{cat:'drink',name:'Water'}];
const QUICK_DEFAULT={hp:'potion',mp:'mana',food:'ration',drink:'flask'};
const POTION_CD=1.2;   // seconds between any two potions, health or mana
// What each kind of trader sells: gear slots, and supplies (SUPPLIES keys). Tower traders carry a bit of everything;
// the village market splits it between stalls.
const TRADER_SELLS={
  all:{gear:['weapon','armor','boots','trinket'],supplies:['potS','potion','potL','manaS','mana','manaL','ration','flask']},
  weapons:{gear:['weapon'],supplies:[]},
  gear:{gear:['armor','boots','trinket'],supplies:[]},
  potions:{gear:[],supplies:['potS','potion','potL','manaS','mana','manaL']},
  food:{gear:[],supplies:['ration','flask','bag']},
  inn:{gear:[],supplies:[],meals:true},   // the innkeeper: meals, eaten at the table
  market:{gear:[],supplies:[],market:true},   // the exchange: materials and monster drops, at moving prices (MARKET)
};
// The inn's meals. cook: the crops from your own field the innkeeper can cook it from instead of charging. Eaten on the spot, not carried: each fills the meters by food and drink and gives its buff
// (BUFFS) for BUFF_TIME seconds. One buff at a time; a new meal replaces it, and it is lost when you fall.
const MEALS={
  stew:{name:'Root stew',price:15,cook:{potato:3},food:100,drink:20,buff:'fed',desc:'Potatoes and roots, slow-cooked under the tree.'},
  roast:{name:'Roast boar and bread',price:30,food:100,drink:0,buff:'hearty',desc:'The innkeeper\u2019s best. A whole evening\u2019s worth.'},
  breakfast:{name:'Innkeeper\u2019s breakfast',price:12,food:100,drink:100,buff:'morning',morning:true,desc:'Eggs, bread and strong tea, served to the ones who slept here. Only in the first ten minutes after you wake.'},
  tea:{name:'Glowcap tea',price:10,cook:{glowcap:2},food:0,drink:100,buff:'clear',desc:'Brewed from the mushrooms on the roots. Faintly glowing.'},
};
const BUFFS={
  fed:{name:'Well fed',desc:'Hunger and thirst drain half as fast.'},
  hearty:{name:'Hearty',desc:'Natural healing is 50% faster.'},
  clear:{name:'Clear-headed',desc:'Mana comes back 25% faster.'},
  morning:{name:'Fresh start',desc:'You move 8% faster and heal 25% faster.'},
};
const BUFF_TIME=20*60;
// Fatigue: play time since you last slept, in seconds (time logged off does not count). Each tier from the time it
// starts: cd (skill cooldowns, % longer), move (% slower), dodge (% less chance to dodge), mregen (% slower mana).
// It never stops you playing; it makes fighting harder. Sleeping in a rented room at the inn (or logging off in it)
// clears it and leaves you well rested (WELL_RESTED seconds of +REST_XP% experience); a sleeping bag clears it in any
// safe area; a safe room's campfire takes half of it, once every FIRE_EVERY seconds of play.
const FATIGUE=[
  {at:0,name:'Rested'},
  {at:2*3600,name:'Weary',cd:10,dodge:15},
  {at:4*3600,name:'Tired',cd:20,move:8,dodge:35,mregen:20},
  {at:6*3600,name:'Exhausted',cd:35,move:15,dodge:60,mregen:40},
];
const FATIGUE_MAX=7*3600,WELL_RESTED=3600,REST_XP=10,FIRE_EVERY=3600,REST_SIT=8,REST_HEAL=.2,BREAKFAST_WINDOW=600;
const fatigueTier=sec=>{let i=0;for(let k=0;k<FATIGUE.length;k++)if(sec>=FATIGUE[k].at)i=k;return i;};
const roomPrice=level=>20+4*level;   // a room at the inn, for the day
// The barkeep's rumours: one each time you talk to him, in turn.
const RUMOURS=[
  'They say the Gate Warden calls skitters to it when it is hurt. Kill the little ones first, or do not, and be quick.',
  'The bone soldiers of the second floor shrug off magic. Bring steel, or bring friends who do.',
  'Fire burns the roots on the third floor twice over, and a body that is burned cannot be raised again.',
  'Some say a trapdoor waits in a boss room or two, sealed until the boss is dead. Some say a lot of things.',
  'Sleep in a bed before you climb. A tired adventurer is a slow one, and the tower does not wait.',
  'A safe room\u2019s fire will not give you a night\u2019s sleep, but it will take the edge off. Once in a while.',
  'Gravecallers raise the dead they find. Kill them first, then burn what they were reaching for.',
  'The exchange pays less for whatever everyone else is selling. Sell what is rare.',
];
// Hunger and thirst. Each meter runs from 100 (full) to 0 and drains while you are on a floor: food in about 25 minutes,
// drink in about 15. Below NEED_LOW you are weakened (hungry: no natural healing and 10% slower; thirsty: half mana
// regeneration). At 0, each empty meter costs NEED_HURT of your max health every second.
const NEEDS={
  food:{drain:100/(25*60),low:'You are getting hungry. Eat a ration (R).',empty:'You are starving and losing health. Eat something (R).'},
  drink:{drain:100/(15*60),low:'You are getting thirsty. Drink some water (T).',empty:'You are parched and losing health. Drink something (T).'},
};
const NEED_LOW=25,NEED_HURT=.01;
// What a trader keeps of each supply: a random amount in this range, refilled when the floor's boss falls.
const STOCK_RANGE=[5,10];
const STASH_SIZE=60;   // the universal stash: one store, reached from any stash chest
const ELITE_CHANCE=.07;   // share of room spawns that are elites: 2.4x health, 1.3x damage, 3x experience, better loot
// Loot, rolled separately for every player who gets credit. shards: [min,max], scaled by +25% per floor above 1.
// items: one roll each: chance, rarity bonus (see rollRarity), lowest rarity, item level above the floor's.
// supplies (by SUPPLIES key: potions, potS, manas, rations, flasks...): one chance each. mats: [chance, min, max] per material.
// fam: [chance, min, max] of the drop of the family of whatever died (chests have no family, so none).
const LOOT={
  normal:{shards:[1,4],items:[{chance:.13,bonus:0,minRar:0,ilvl:0}],potS:[.05],manaS:[.04],rations:[.04],flasks:[.05],mats:{scrap:[.3,1,1],ember:[.03,1,1]},fam:[.3,1,1]},
  elite:{shards:[14,14],items:[{chance:.7,bonus:18,minRar:1,ilvl:0}],potions:[.25],manas:[.2],potS:[.2],rations:[.25],flasks:[.3],mats:{scrap:[1,1,3],ember:[.4,1,1],crystal:[.04,1,1]},fam:[1,2,3]},
  boss:{shards:[60,60],items:[{chance:1,bonus:25,minRar:2,ilvl:1},{chance:1,bonus:25,minRar:1,ilvl:1},{chance:1,bonus:25,minRar:1,ilvl:1}],potions:[1],potL:[1],manaL:[1],rations:[1],flasks:[1],
    mats:{scrap:[1,4,6],ember:[1,2,3],crystal:[1,1,1]},fam:[1,6,8]},
  chest:{shards:[8,16],items:[{chance:1,bonus:12,minRar:0,ilvl:0},{chance:.35,bonus:6,minRar:0,ilvl:0}],potions:[.4],manas:[.3],potL:[.05],manaL:[.04],rations:[.4],flasks:[.5],mats:{scrap:[1,1,2],ember:[.25,1,1]}},
};
// Names kept for floors still to be designed: 'Ash Regent', 'The Unlit King', 'Keeper of the Ninth Stair', 'Old Hunger', 'The Bell Below'.

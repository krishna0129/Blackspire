#!/usr/bin/env node
'use strict';
// Writes the player wiki (docs/wiki/*.md) from the game's own tables, so its numbers always match the game.
//
//   node tools/wiki.js           rewrite the pages
//   node tools/wiki.js --check   exit 1 if the pages are out of date (npm test runs this)
//
// Numbers come from js/sim (data.js, items.js). The prose that cannot be read from data (how an enemy fights,
// how to beat it) lives in NOTES below: update it when an enemy's behaviour changes.

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadRules}=require('../server/game.js');
const R=loadRules(),D=vm.runInContext(`({ETYPES,RARITY,WTYPES,ATYPES,BTYPES,TTYPES,PASSIVES,GEAR_AFFIX,GRIM,MATS,LOOT,SPAWNS,ELITE_CHANCE,BOSSES,
  ENH_CHANCE,ENH_MAX,SKILLS,ilvlMult,itemMult,enhanceRecipe,enhanceCost,salvageValue,salvageMats})`,R);
const OUT=path.join(__dirname,'..','docs','wiki');
const FLOORS=[1,2,3];   // floors the tables show

/* ---------- hand-written notes ---------- */
const NOTES={
  shade:{fights:'Walks straight at you, winds up for 0.38 s, then swipes. Any hit during the wind-up cancels it.',
    beat:'The baseline enemy. Hit it while it winds up and it never lands a blow.',stats:'Strength or the attribute your weapon scales with; Vitality while learning.'},
  skitter:{fights:'Fast (74 speed) and fragile, with a short 0.22 s wind-up. Comes in groups, and the Gate Warden summons them.',
    beat:'Wide arcs (Greatsword, Longsword, Circular slash) clear a group in one swing. Keep moving so they come to you in a line.',stats:'Agility (attack speed) or Strength.'},
  brute:{fights:'Slow and heavy: hits do not stagger it and barely knock it back. A long 0.75 s wind-up into a 19-damage blow.',
    beat:'Watch for the wind-up and dodge-roll through it, or raise a shield. Sunder (+25% damage taken) pays off on its large health pool.',stats:'Vitality, or Dexterity for evasion. Shield classes can block it.'},
  wisp:{fights:'Floats at 52 to 92 px, firing a slow orb every 2 to 2.6 s. Its shots stop at walls and safe rooms.',
    beat:'Close in. A melee swing knocks its shots out of the air, and a raised shield blocks them.',stats:'Any. Ranged classes outtrade it.'},
  skel:{fights:'Moves along one axis at a time and lunges in a straight line when lined up with you. Half the time it hops back out of a melee swing aimed at it.',
    beat:'Step off its line before the lunge, then punish the recovery. Ignores 75% of magic damage: bring steel.',stats:'Strength. Mages struggle here.'},
  skelarcher:{fights:'Sidesteps onto your row or column, draws for 0.45 s, then looses an arrow along that line. Hops away if you get within 46 px.',
    beat:'Never stand on its row or column for long. Rush it between shots; corners break its line. Ignores 75% of magic damage.',stats:'Dexterity (evasion, up to 30%) and Agility (move speed).'},
  skelknight:{fights:'Its shield stops everything from the side it faces while it walks or stands, but it only re-faces you every 0.75 s. Heavy 0.7 s wind-up, then a long 1.1 s recovery.',
    beat:'Hit it from the side or behind, or during its recovery. Shadowstep (Dagger) lands behind it with a guaranteed critical. Ignores 85% of magic damage.',stats:'Strength and Agility.'},
};
const BOSS_NOTES=[
  {name:'The Gate Warden',floors:'Floor 1 (and every floor from 3 until those get their own bosses)',
    attacks:['Slam: a red circle around itself when you are close (48 px). Leave the circle.','Targeted burst: a red circle where you stand, from range. Move off it.',
      'Charge: a red lane, then it runs along it. Step sideways.','Calls skitters at 66% and 33% health: 3, plus 1 per floor above 1 (6 at most).','Below 30% health everything comes faster.'],
    tips:'Every attack is telegraphed and cannot be evaded by Dexterity, but it can be dodge-rolled. Clear the skitters with wide swings.'},
  {name:'The Bone Regent',floors:'Floor 2',
    attacks:['Slam around itself, as the Gate Warden.','Rib volley: seven bone shards in a cone. Ordinary shots: Dexterity can evade them and a melee swing knocks them down.',
      'Grave spikes: four bursts (five when enraged) under whoever it targets, 0.3 s apart. They come up from below, so no shield stops them: keep moving.',
      'Bone cross: four lanes through the boss; the gaps between them are safe. Below 30% health a diagonal cross follows.',
      'Raises two bone soldiers at 66% and 33% health.','Never uses the same attack twice in a row.'],
    tips:'Takes half damage from magic. Its own shield blocks nothing, so any steel weapon works.'},
];

/* ---------- helpers ---------- */
const pct=v=>(v*100).toFixed(v<.1&&v>0?1:0)+'%';
const fx=(v,d=1)=>Number.isInteger(v)?String(v):v.toFixed(d);
const table=(head,rows)=>[`| ${head.join(' | ')} |`,`|${head.map(()=>'---').join('|')}|`,...rows.map(r=>`| ${r.join(' | ')} |`)].join('\n');
const floorMult=n=>({hp:1+.38*(n-1),dmg:1+.22*(n-1),xp:1+.3*(n-1),shards:1+.25*(n-1)});
// rollRarity(bonus) with a floor of minRar, as exact probabilities by rarity
function rarityOdds(bonus,minRar){
  const F=t=>Math.min(1,Math.max(0,(t+bonus)/100)),cut=[F(1.5),F(7),F(22),F(52)];
  const p=[1-cut[3],cut[3]-cut[2],cut[2]-cut[1],cut[1]-cut[0],cut[0]];
  for(let r=0;r<minRar;r++){p[minRar]+=p[r];p[r]=0;}return p;
}
const matAvg=([c,lo,hi])=>c*(lo===hi?lo:(lo+hi)/2);
const matText=m=>Object.keys(m).map(k=>{const[c,lo,hi]=m[k];return`${MAT(k)}: ${c<1?pct(c)+' for ':''}${lo===hi?lo:lo+' to '+hi}`;}).join('<br>');
const MAT=k=>D.MATS[k].name;
// how many attempts a step takes on average, counting the +10% per failure
function attempts(c){let e=0,reach=1;for(let k=0;reach>1e-9;k++){e+=reach;reach*=1-Math.min(1,c+.1*k);}return e;}
// an affix's possible values at a rarity (rollAff: range[0] + spread * clamp(random*0.7 + rarity*0.1))
const affRange=(d,rar,ilvl=1)=>{const s=d.scale?D.ilvlMult(ilvl):1,f=v=>Math.max(1,Math.round((d.range[0]+(d.range[1]-d.range[0])*v)*s));return[f(Math.min(1,rar*.1)),f(Math.min(1,.7+rar*.1))];};
const HEADER=t=>`# ${t}\n\n> Generated by \`node tools/wiki.js\` from the game's data. Do not edit by hand: change the data (js/sim) or the notes in tools/wiki.js, then run it again.\n`;

/* ---------- pages ---------- */
function dropsPage(){
  const L=D.LOOT,src={normal:'Ordinary enemy',elite:'Elite enemy',boss:'Floor boss',chest:'Chest'};
  const out=[HEADER('Drops'),
`Every kill rewards **every player on the floor**, and each player gets their **own roll** of the loot: nobody can take
your drops, and only you see them. Each chest opens once per player. Bosses return whenever you arrive on a floor, so
their loot can be farmed.`,
`## What drops from what`,
table(['Source','Shards (floor 1 / 2 / 3)','Items','Potions','Materials'],Object.keys(L).map(k=>{const q=L[k];
  return[src[k],FLOORS.map(n=>{const m=floorMult(n).shards,a=Math.round(q.shards[0]*m),b=Math.round(q.shards[1]*m);return a===b?a:a+'–'+b;}).join(' / '),
    q.items.map(i=>`${i.chance<1?pct(i.chance):'1'}${i.ilvl?' (item level +'+i.ilvl+')':''}${i.minRar?', at least '+D.RARITY[i.minRar].name.toLowerCase():''}`).join('<br>'),
    q.potions.length>1?q.potions.length+' potions':pct(q.potions[0]),matText(q.mats)];})),
`Elites are ${pct(D.ELITE_CHANCE)} of room spawns, marked by gold outlines and eyes. They have 2.4× health and 1.3× damage, and give 3× experience.`,
`## Item rarity odds`,
`Each item roll has a rarity bonus that shifts the odds. Rarity multiplies an item's base numbers and sets how many bonuses it carries.`,
table(['Roll',...D.RARITY.map(r=>r.name)],[['Ordinary enemy',0,0],['Chest, second item',6,0],['Chest',12,0],['Elite',18,1],['Boss',25,1],['Boss, first item',25,2]].map(([n,b,m])=>[n,...rarityOdds(b,m).map(v=>v?pct(v):'–')])),
table(['Rarity','Stat multiplier','Bonuses (weapon, armor, boots)','Bonuses (grimoire, trinket)'],D.RARITY.map(r=>[`${r.name}`,r.mult+'×',r.aff,r.aff+1])),
`## What kind of item`,
table(['Slot','Chance','Types (equally likely)'],[['Weapon',.42,Object.values(D.WTYPES).map(w=>w.name).join(', ')],['Armor',.24,Object.values(D.ATYPES).map(a=>a.name).join(', ')],
  ['Boots',.17,Object.values(D.BTYPES).map(a=>a.name).join(', ')],['Trinket',.17,Object.values(D.TTYPES).map(a=>a.name).join(', ')]].map(([a,b,c])=>[a,pct(b),c])),
`A grimoire is equally likely to be of embers (Fireball, intelligence) or of grace (Heal, faith). Items drop at the
floor's item level (bosses: one higher), which raises base numbers by 22% per level.`,
`## Average yield per kill`,
table(['Source','Shards (floor 1)','Items','Iron scrap','Emberstone','Spire crystal'],Object.keys(L).map(k=>{const q=L[k];
  return[src[k],fx((q.shards[0]+q.shards[1])/2),fx(q.items.reduce((a,i)=>a+i.chance,0),2),...['scrap','ember','crystal'].map(m=>q.mats[m]?fx(matAvg(q.mats[m]),2):'–')];})),
`## Where each enemy appears`,
table(['Floor','Enemies (share of room spawns)'],D.SPAWNS.map((bag,i)=>{const c={};for(const t of bag)c[t]=(c[t]||0)+1;
  return[i===D.SPAWNS.length-1?`${i+1} and up`:String(i+1),Object.keys(c).map(t=>`${D.ETYPES[t].name} ${pct(c[t]/bag.length)}`).join(', ')];})),
`## Unique drops

**Not in the game yet.** Today every enemy rolls from the same pool above, so the type of enemy only changes how
many you can kill per minute. Per-enemy unique drops are planned, starting with floor 3: see
[docs/design/floor-3.md](../design/floor-3.md). When they land, this page lists them by enemy.`];
  return out.join('\n\n')+'\n';
}

function enhancePage(){
  const it=(rar,ilvl,plus)=>({rarity:rar,ilvl,plus,slot:'weapon'});
  let cum={shards:0,scrap:0,ember:0,crystal:0};
  const steps=[];for(let k=1;k<=D.ENH_MAX;k++){const r=D.enhanceRecipe(it(0,1,k-1)),e=attempts(r.chance);
    for(const m in r.mats)cum[m]+=r.mats[m]*e;
    steps.push([`+${k}`,Object.keys(r.mats).map(m=>`${r.mats[m]} ${MAT(m)}`).join(', '),pct(r.chance),fx(e,2),['scrap','ember','crystal'].map(m=>fx(cum[m],1)).join(' / ')]);}
  const shardsTo=(rar,ilvl)=>{let s=0;for(let k=1;k<=D.ENH_MAX;k++){const r=D.enhanceRecipe(it(rar,ilvl,k-1));s+=D.enhanceCost(it(rar,ilvl,k-1))*attempts(r.chance);}return Math.round(s);};
  const W=Object.values(D.WTYPES);
  const dmg=(T,ilvl)=>{const lo=T.dmg*D.ilvlMult(ilvl)*D.RARITY[0].mult*.95,hi=T.dmg*D.ilvlMult(ilvl)*D.RARITY[4].mult*1.05*D.itemMult({plus:D.ENH_MAX});return`${lo.toFixed(1)}–${hi.toFixed(1)}`;};
  const gear=(T,key,ilvl)=>{const lo=Math.round(T[key]*D.ilvlMult(ilvl)*D.RARITY[0].mult),hi=Math.round(Math.round(T[key]*D.ilvlMult(ilvl)*D.RARITY[4].mult)*D.itemMult({plus:D.ENH_MAX}));return lo===hi?String(lo):`${lo}–${hi}`;};
  const affRows=(pool,label)=>Object.values(pool).map(d=>[label?label(d):d.name,d.fmt('N'),...D.RARITY.map((r,i)=>{const[a,b]=affRange(d,i);return a===b?String(a):`${a}–${b}`;}),d.scale?'yes':'']);
  const out=[HEADER('Enhancement and item stats'),
`## Enhancing

A blacksmith (in every start room and safe room) enhances weapons, armor and boots up to +${D.ENH_MAX}. Each level adds
8% to the item's base numbers, so +${D.ENH_MAX} is ×${D.itemMult({plus:D.ENH_MAX})}. Trinkets cannot be enhanced.
Up to +5 an attempt always works. From +6 it can fail: the level stays, the cost is spent, and that item's next
attempt gets +10% (shown on the item), until it succeeds.`,
table(['Level','Materials per attempt','Chance','Average attempts','Materials to get here from +0, on average (scrap / ember / crystal)'],steps),
`### Shard cost

Each attempt costs \`22 × (current level + 1) × (1 + 0.3 × (item level − 1)) × rarity multiplier\` shards, rounded.
Average shards to take an item from +0 to +${D.ENH_MAX}, failures included:`,
table(['Item level',...D.RARITY.map(r=>r.name)],[1,2,3,4].map(l=>[l,...D.RARITY.map((r,i)=>shardsTo(i,l).toLocaleString('en'))])),
`### Salvaging

Salvaging gives \`6 × (1 + 0.22 × (item level − 1)) × rarity multiplier³ × (1 + 0.5 × level)\` shards, plus materials:`,
table(['Rarity','Materials back'],D.RARITY.map((r,i)=>[r.name,Object.entries(D.salvageMats({rarity:i})).map(([k,v])=>v+' '+MAT(k)).join(', ')])),
`## Weapon damage range

Lowest possible (common, +0, low roll) to highest possible (legendary, +${D.ENH_MAX}, high roll), per item level.
Base rolls vary ±5%.`,
table(['Weapon','Class','Attacks/s','Reach',...[1,2,3,4].map(l=>'Item level '+l)],W.map(T=>[T.name,T.cls,T.aspd,T.ranged||T.magic?T.range+' (shot)':T.range+(T.arc<50?', thrust':', '+T.arc+'°'),...[1,2,3,4].map(l=>dmg(T,l))])),
`## Armor and boots range

Same rule: common +0 to legendary +${D.ENH_MAX}. Move speed bonuses do not grow with rarity or level.`,
table(['Item','Stat',...[1,2,3,4].map(l=>'Item level '+l)],[
  ...Object.values(D.ATYPES).flatMap(T=>[[T.name,'Defense',...[1,2,3,4].map(l=>gear(T,'def',l))],[T.name,'Health',...[1,2,3,4].map(l=>gear(T,'hp',l))],...(T.move?[[T.name,'Move',...[1,2,3,4].map(()=>(T.move>0?'+':'')+T.move+'%')]]:[])]),
  ...Object.values(D.BTYPES).flatMap(T=>[[T.name,'Defense',...[1,2,3,4].map(l=>gear(T,'def',l))],[T.name,'Move',...[1,2,3,4].map(()=>'+'+T.move+'%')]])]),
`## Bonus (affix) ranges by rarity

A bonus's value is rolled when the item drops; a higher rarity raises both ends. Values below are at item level 1;
"grows" marks bonuses that also rise 22% per item level. Enhancement does not change bonuses.`,
`### Weapons (any but grimoires)`,table(['Bonus','Effect',...D.RARITY.map(r=>r.name),'Grows'],affRows(D.PASSIVES)),
`### Grimoires of embers`,table(['Bonus','Effect',...D.RARITY.map(r=>r.name),'Grows'],affRows(D.GRIM.magic.pool)),
`### Grimoires of grace`,table(['Bonus','Effect',...D.RARITY.map(r=>r.name),'Grows'],affRows(D.GRIM.faith.pool)),
`### Armor, boots and trinkets`,table(['Bonus','Effect',...D.RARITY.map(r=>r.name),'Grows'],affRows(D.GEAR_AFFIX))];
  return out.join('\n\n')+'\n';
}

function monstersPage(){
  const where=t=>D.SPAWNS.map((b,i)=>b.includes(t)?(i===D.SPAWNS.length-1?`${i+1}+`:String(i+1)):null).filter(Boolean).join(', ');
  const out=[HEADER('Monsters'),
`Enemies get tougher on every floor: health +38%, damage +22% and experience +30% per floor above the first.
Elites (gold) have 2.4× health and 1.3× damage. Damage shown is before your defense, which removes
\`defense / (100 + defense)\` of each blow.

**Weapons with a bonus against a monster type: none yet.** The only targeted bonus today is the weapon affix
*Giant-slaying* (extra damage to elites and bosses), and the dead take less magic damage (below). Monster-type
bonuses are planned (see [docs/design/floor-3.md](../design/floor-3.md)); this page will list them and where they
drop. Until then, any source can drop any weapon: the best odds of a good one are elites (70% item chance, at least
uncommon) and bosses (three items, one item level higher).`];
  for(const [t,E] of Object.entries(D.ETYPES)){if(t==='boss')continue;const n=NOTES[t]||{};
    out.push(`## ${E.name}`,
table(['','Floor 1','Floor 2','Floor 3'],[['Health (elite)',...FLOORS.map(f=>`${Math.round(E.hp*floorMult(f).hp)} (${Math.round(E.hp*floorMult(f).hp*2.4)})`)],
  ['Damage per hit (elite)',...FLOORS.map(f=>`${(E.dmg*floorMult(f).dmg).toFixed(1)} (${(E.dmg*floorMult(f).dmg*1.3).toFixed(1)})`)],
  ['Experience (elite)',...FLOORS.map(f=>`${Math.round(E.xp*floorMult(f).xp)} (${Math.round(E.xp*floorMult(f).xp*3)})`)]]),
`- **Found on floors:** ${where(t)||'(summoned only)'}
- **Speed:** ${E.speed}${E.ranged?' · **ranged**':''}${E.heavy?' · **heavy** (not staggered by hits)':''}${E.mres?` · **ignores ${pct(E.mres)} of magic damage**`:''}${E.shield?' · **shield**':''}
- **How it fights:** ${n.fights||'—'}
- **How to beat it:** ${n.beat||'—'}
- **Recommended attributes:** ${n.stats||'—'}`);}
  const B=D.ETYPES.boss;
  out.push(`## Floor bosses`,
`Base health ${B.hp} and damage ${B.dmg}, scaled by floor like everything else (floor 2: ${Math.round(B.hp*floorMult(2).hp)} health).
Telegraphed attacks (red markings) cannot be evaded by Dexterity; shields cut them by less than ordinary blows. If
everyone inside the chamber falls, the boss heals to full.`);
  for(const b of BOSS_NOTES)out.push(`### ${b.name}\n\n*${b.floors}*\n\n${b.attacks.map(a=>'- '+a).join('\n')}\n\n${b.tips}`);
  return out.join('\n\n')+'\n';
}

function indexPage(){return HEADER('Blackspire wiki')+`
- [Drops](drops.md): what every enemy, elite, boss and chest drops, rarity odds, where each enemy appears.
- [Enhancement and item stats](enhancement.md): costs and odds for every level, the stat range of every item, bonus ranges by rarity.
- [Monsters](monsters.md): health, damage and experience by floor, how each enemy fights and how to beat it, the bosses.
`;}

const pages={'README.md':indexPage(),'drops.md':dropsPage(),'enhancement.md':enhancePage(),'monsters.md':monstersPage()};
if(process.argv.includes('--check')){
  const stale=Object.keys(pages).filter(f=>{try{return fs.readFileSync(path.join(OUT,f),'utf8')!==pages[f];}catch(e){return true;}});
  if(stale.length){console.error('docs/wiki is out of date ('+stale.join(', ')+'). Run: node tools/wiki.js');process.exit(1);}
}else{fs.mkdirSync(OUT,{recursive:true});for(const f in pages)fs.writeFileSync(path.join(OUT,f),pages[f]);console.log('wrote docs/wiki/'+Object.keys(pages).join(', '));}

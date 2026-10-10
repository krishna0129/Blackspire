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
const R=loadRules(),D=vm.runInContext(`({ETYPES,RARITY,WTYPES,ATYPES,BTYPES,TTYPES,PASSIVES,GEAR_AFFIX,GRIM,MATS,LOOT,FLOORS,ELITE_CHANCE,SUPPLIES,STOCK_RANGE,
  ENH_CHANCE,ENH_MAX,SKILLS,FAMILIES,FORGING,FORGE_RARITY,MARKET,MARKET_MIN,MARKET_MAX,MARKET_SPREAD,MARKET_DRIFT,MARKET_SELL_SHARE,buyAt,sellAt,marketCap,ilvlMult,itemMult,enhanceRecipe,enhanceCost,salvageValue,salvageMats})`,R);
const OUT=path.join(__dirname,'..','docs','wiki');
const SHOWN=[1,2,3];   // floors the tables show

/* ---------- hand-written notes ---------- */
const NOTES={
  thrall:{fights:'Shambles in with a slow, heavy swing (0.6 s wind-up) that hits do not interrupt. When it dies it leaves its body for 6 s, and a Gravecaller nearby can raise it again at half health.',
    beat:'Kill the Gravecaller first, or burn the body (any Fireball blast). Raised thralls give no experience and no loot.',stats:'Strength or Vitality; fire for the bodies.'},
  gravecaller:{fights:'Keeps 64 to 110 px away and throws slow grave-fire. Stops to raise a body within reach: a 1.2 s channel, shown as a green line to the body. Blinks away when you get close (every 5 s). An elite raises two at once.',
    beat:'Any hit breaks the channel, so ranged attacks are perfect. Rush it after it blinks. It has little health: always kill it first.',stats:'Dexterity or Intelligence (ranged), or Agility to catch it.'},
  thornroot:{fights:'Grows from the top wall of a room and never moves. Marks a lane toward you for 0.7 s, then lashes along it.',
    beat:'Step out of the lane, then hit it while it recovers. Takes double damage from fire; cannot be knocked back.',stats:'Any; Fireball melts it.'},
  bloodbloom:{fights:'A rooted flower. Every 4 s a green ring pulses out and heals every other enemy nearby by 12% of its health.',
    beat:'Fragile: kill it first, or the fight drags on.',stats:'Any.'},
  hermit:{fights:'Burrows under the floor, where nothing can hit it, and moves toward you. A red circle marks where it will burst up; it hits hard and no shield stops it. Then it lies dazed for 1.6 s, then fights inside its skull shell (taking 40% damage) for 2.6 s before burrowing again.',
    beat:'Step off the circle, then hit it hard while it is dazed: that is the only time it takes full damage.',stats:'Agility (move speed) to leave the circle; burst damage for the opening.'},
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
  {name:'The Gate Warden',img:'boss-warden',shots:[['attack-warden-slam','Slam'],['attack-warden-burst','Targeted burst'],['attack-warden-charge','Charge lane']],floors:'Floor 1',
    attacks:['Slam: a red circle around itself when you are close (48 px). Leave the circle.','Targeted burst: a red circle where you stand, from range. Move off it.',
      'Charge: a red lane, then it runs along it. Step sideways.','Calls skitters at 66% and 33% health: 3, plus 1 per floor above 1 (6 at most).','Below 30% health everything comes faster.'],
    tips:'Every attack is telegraphed and cannot be evaded by Dexterity, but it can be dodge-rolled. Clear the skitters with wide swings.'},
  {name:'The Bone Regent',img:'boss-regent',shots:[['attack-regent-slam','Slam'],['attack-regent-fan','Rib volley'],['attack-regent-spikes','Grave spikes (one burst)'],['attack-regent-cross','Bone cross (diagonal)']],floors:'Floor 2',
    attacks:['Slam around itself, as the Gate Warden.','Rib volley: seven bone shards in a cone. Ordinary shots: Dexterity can evade them and a melee swing knocks them down.',
      'Grave spikes: four bursts (five when enraged) under whoever it targets, 0.3 s apart. They come up from below, so no shield stops them: keep moving.',
      'Bone cross: four lanes through the boss; the gaps between them are safe. Below 30% health a diagonal cross follows.',
      'Raises two bone soldiers at 66% and 33% health.','Never uses the same attack twice in a row.'],
    tips:'Takes half damage from magic. Its own shield blocks nothing, so any steel weapon works.'},
  {name:'The Pale Collector',img:'boss-collector',shots:[['attack-collector-bolts','Soul bolts'],['attack-collector-raise','Raising the dead'],['attack-collector-sweep','Lantern sweep']],floors:'Floor 3 (and every floor above until they get their own)',
    attacks:['Soul bolts: three green shots in a spread. Ordinary shots: they can be evaded, blocked and knocked down.',
      'Raises thralls from the six bodies in its chamber (two at a time, three from two thirds of its health). They ignore you and walk to it; each one that arrives heals it by 8% (12% below a third).',
      'Lantern sweep, from two thirds of its health: a red lane, then a beam that turns half way around it. The beam stops at walls.',
      'Below a third: blinks between the corners of the chamber, and roots erupt under its target five times in a row (no shield stops them).',
      'If everyone in the chamber falls, it heals and its bodies return.'],
    tips:'Burn the bodies with Fireball before it can use them, and kill thralls on their way to it. Parties split naturally: one intercepts thralls while the others fight.'},
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
// families (FAMILIES, data.js): a roll of a family's drop as text, who is in a family, and which roll a monster uses
const famRoll=([c,lo,hi])=>`${c<1?pct(c)+' for ':''}${lo===hi?lo:lo+' to '+hi}`;
const famMonsters=f=>Object.keys(D.ETYPES).filter(t=>D.ETYPES[t].fam===f);
const famBosses=f=>D.FLOORS.filter(F=>F.boss.fam===f).map(F=>F.boss.name);
const famDropOf=t=>D.ETYPES[t].famDrop||D.LOOT.normal.fam;
const famLink=f=>`[${D.FAMILIES[f].name}](forging.md)`;
// how many attempts a step takes on average, counting the +10% per failure
function attempts(c){let e=0,reach=1;for(let k=0;reach>1e-9;k++){e+=reach;reach*=1-Math.min(1,c+.1*k);}return e;}
// an affix's possible values at a rarity (rollAff: range[0] + spread * clamp(random*0.7 + rarity*0.1))
const affRange=(d,rar,ilvl=1)=>{const s=d.scale?D.ilvlMult(ilvl):1,f=v=>Math.max(1,Math.round((d.range[0]+(d.range[1]-d.range[0])*v)*s));return[f(Math.min(1,rar*.1)),f(Math.min(1,.7+rar*.1))];};
// pictures rendered by tools/wiki-images.js, and charts written below
const IMG=(f,alt,w)=>`<img src="img/${f}.png" alt="${alt}"${w?` width="${w}"`:''}>`;
const WICON={sword:'item-sword',dagger:'item-dagger',great:'item-great',mace:'item-mace',spear:'item-spear',bow:'item-bow'};
const HEADER=t=>`# ${t}\n\n> Generated by \`node tools/wiki.js\` from the game's data. Do not edit by hand: change the data (js/sim) or the notes in tools/wiki.js, then run it again.\n`;


/* ---------- charts (SVG, written next to the pages) ----------
   Dark surface like the game's panels. Text uses text colours only; marks carry the colour. */
const C={bg:'#0d0d12',ink:'#e6e1d3',dim:'#8d8b98',grid:'#2e2e3a',font:'system-ui,-apple-system,Segoe UI,Helvetica,Arial,sans-serif'};
const svgWrap=(w,h,body,title)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">
<rect width="${w}" height="${h}" rx="6" fill="${C.bg}"/>
<g font-family="${C.font}">${body}</g>
</svg>
`;
const txt=(x,y,t,o={})=>`<text x="${x}" y="${y}" fill="${o.fill||C.ink}" font-size="${o.size||12}"${o.anchor?` text-anchor="${o.anchor}"`:''}${o.weight?` font-weight="${o.weight}"`:''}>${t}</text>`;
// a bar with 4px rounding on its data end only (square at the baseline)
const hbar=(x,y,w,h,fill,roundEnd)=>{if(w<=0)return'';const r=Math.min(4,w);
  return roundEnd?`<path d="M${x},${y}h${w-r}a${r},${r} 0 0 1 ${r},${r}v${h-2*r}a${r},${r} 0 0 1 -${r},${r}h-${w-r}z" fill="${fill}"/>`:`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;};
const vbar=(x,y,w,h,fill)=>{const r=Math.min(4,h);return`<path d="M${x},${y+h}v-${h-r}a${r},${r} 0 0 1 ${r},-${r}h${w-2*r}a${r},${r} 0 0 1 ${r},${r}v${h-r}z" fill="${fill}"/>`;};

// Rarity odds by source: one 100% bar per roll. The rarity colours are the game's own; Rare and Epic are close for
// red-green colour blindness, so every segment that fits carries its percentage and a 2px gap separates segments.
function rarityChart(){
  const rows=[['Ordinary enemy',0,0],['Chest, second item',6,0],['Chest',12,0],['Elite',18,1],['Boss',25,1],['Boss, first item',25,2]];
  const W=860,L=150,BW=690,top=78,RH=22,GAP=16,h=top+rows.length*(RH+GAP)+18;
  let b=txt(20,30,'Item rarity odds by source',{size:16,weight:600})+txt(20,50,'Share of item rolls landing on each rarity. A higher rarity bonus moves odds straight to Legendary; Epic stays at 5.5%.',{fill:C.dim,size:12});
  let lx=L;D.RARITY.forEach(r=>{b+=`<rect x="${lx}" y="61" width="10" height="10" rx="2" fill="${r.color}"/>`+txt(lx+15,70,r.name,{fill:C.dim,size:12});lx+=r.name.length*7+36;});
  rows.forEach(([name,bonus,minR],i)=>{const y=top+i*(RH+GAP),p=rarityOdds(bonus,minR);let x=L;
    b+=txt(L-10,y+RH/2+4,name,{anchor:'end',size:12});
    const segs=p.map((v,k)=>({v,k})).filter(q=>q.v>0);
    segs.forEach((q,j)=>{const w=q.v*BW-(j<segs.length-1?2:0);b+=hbar(x,y,w,RH,D.RARITY[q.k].color,j===segs.length-1);
      if(w>=34)b+=txt(x+w/2,y+RH/2+4,pct(q.v),{anchor:'middle',fill:'#0d0d12',size:11,weight:600});x+=q.v*BW;});});
  return svgWrap(W,h,b,'Item rarity odds by source');
}
// Enhancement success chance per level: one series, so no legend; only the levels that can fail are labelled.
function enhanceChart(){
  const W=720,H=310,L=60,B=262,T=90,CW=24,step=62,col='#6fd6e6';
  let b=txt(20,30,'Enhancement success chance per attempt',{size:16,weight:600})+txt(20,50,'Before the +10% each failure adds to that item’s next try. From +6 an attempt can fail.',{fill:C.dim,size:12});
  for(const v of[0,.25,.5,.75,1]){const y=B-(B-T)*v;b+=`<line x1="${L}" x2="${L+step*10}" y1="${y}" y2="${y}" stroke="${C.grid}" stroke-width="1"/>`+txt(L-8,y+4,Math.round(v*100)+'%',{anchor:'end',fill:C.dim,size:11});}
  D.ENH_CHANCE.forEach((c,i)=>{const x=L+step*i+(step-CW)/2,h=(B-T)*c;b+=vbar(x,B-h,CW,h,col)+txt(x+CW/2,B+16,'+'+(i+1),{anchor:'middle',fill:C.dim,size:11});
    if(c<1)b+=txt(x+CW/2,B-h-6,pct(c),{anchor:'middle',size:11,weight:600});});
  b+=`<line x1="${L+step*.5-12}" x2="${L+step*4.5+12}" y1="${T-12}" y2="${T-12}" stroke="${C.dim}" stroke-width="1"/>`+txt(L+step*2.5,T-18,'+1 to +5 always work',{anchor:'middle',fill:C.dim,size:11});
  return svgWrap(W,H,b,'Enhancement success chance per attempt');
}

/* ---------- pages ---------- */
function dropsPage(){
  const L=D.LOOT,src={normal:'Ordinary enemy',elite:'Elite enemy',boss:'Floor boss',chest:'Chest'};
  const out=[HEADER('Drops'),
`Every kill rewards **every player on the floor**, and each player gets their **own roll** of the loot: nobody can take
your drops, and only you see them. Each chest opens once per player. Bosses return whenever you arrive on a floor, so
their loot can be farmed.`,
`## What drops from what`,
`On the ground: ${IMG('drop-shard','shards',36)} shards ${IMG('drop-potion','potion',36)} potion ${IMG('drop-ration','ration',36)} ration ${IMG('drop-flask','water flask',36)} water flask ${IMG('drop-scrap','Iron scrap',36)} Iron scrap ${IMG('drop-ember','Emberstone',36)} Emberstone ${IMG('drop-crystal','Spire crystal',36)} Spire crystal ${Object.keys(D.MATS).filter(k=>D.MATS[k].fam).map(k=>IMG('drop-'+k,MAT(k),36)+' '+MAT(k)).join(' ')} (monster drops, the diamonds) ${IMG('drop-item','item',36)} an item (rare and better ones also send a beam of their colour into the dark).`,
table(['Source','Shards (floor 1 / 2 / 3)','Items','Potions, rations, water','Materials','Its family\u2019s drop'],Object.keys(L).map(k=>{const q=L[k];
  return[src[k],SHOWN.map(n=>{const m=floorMult(n).shards,a=Math.round(q.shards[0]*m),b=Math.round(q.shards[1]*m);return a===b?a:a+'–'+b;}).join(' / '),
    q.items.map(i=>`${i.chance<1?pct(i.chance):'1'}${i.ilvl?' (item level +'+i.ilvl+')':''}${i.minRar?', at least '+D.RARITY[i.minRar].name.toLowerCase():''}`).join('<br>'),
    Object.values(D.SUPPLIES).map(s=>{const c=q[s.key]||[];return(c.length>1?c.length:c[0]>=1?'1':pct(c[0]))+' '+s.name.toLowerCase()+(c.length>1?'s':'');}).join('<br>'),matText(q.mats),q.fam?famRoll(q.fam):'–'];})),
`Rations and water flasks refill the hunger and thirst meters. Traders in safe rooms also sell them, ${D.STOCK_RANGE[0]}–${D.STOCK_RANGE[1]} of each supply, restocked when the floor\u2019s boss falls.`,
`Elites are ${pct(D.ELITE_CHANCE)} of room spawns, marked by gold outlines and eyes. They have 2.4× health and 1.3× damage, and give 3× experience.`,
`## Item rarity odds`,
`![Item rarity odds by source: Legendary rises from 1.5% to 27% as the rarity bonus grows, while Epic stays at 5.5%](img/rarity-odds.svg)`,
`${D.RARITY.map((r,i)=>IMG('rarity-'+i,r.name+' longsword',48)+' '+r.name).join(' &nbsp; ')}`,
`Each item roll has a rarity bonus that shifts the odds. Rarity multiplies an item's base numbers and sets how many bonuses it carries.`,
table(['Roll',...D.RARITY.map(r=>r.name)],[['Ordinary enemy',0,0],['Chest, second item',6,0],['Chest',12,0],['Elite',18,1],['Boss',25,1],['Boss, first item',25,2]].map(([n,b,m])=>[n,...rarityOdds(b,m).map(v=>v?pct(v):'–')])),
table(['Rarity','Stat multiplier','Bonuses (weapon, armor, boots)','Bonuses (grimoire, trinket)'],D.RARITY.map(r=>[`${r.name}`,r.mult+'×',r.aff,r.aff+1])),
`## What kind of item`,
table(['Slot','Chance','Types (equally likely)'],[['Weapon',.42,Object.entries(D.WTYPES).map(([k,w])=>(k==='grimoire'?IMG('item-grimoire-magic','',28)+IMG('item-grimoire-faith','',28):IMG(WICON[k],'',28))+' '+w.name).join(' ')],
  ['Armor',.24,Object.entries(D.ATYPES).map(([k,a])=>IMG('item-armor-'+k,'',28)+' '+a.name).join(' ')],
  ['Boots',.17,Object.entries(D.BTYPES).map(([k,a])=>IMG('item-boots-'+k,'',28)+' '+a.name).join(' ')],['Trinket',.17,IMG('item-trinket','',28)+' '+Object.values(D.TTYPES).map(a=>a.name).join(', ')]].map(([a,b,c])=>[a,pct(b),c])),
`A grimoire is equally likely to be of embers (Fireball, intelligence) or of grace (Heal, faith). Items drop at the
floor's item level (bosses: one higher), which raises base numbers by 22% per level.`,
`## Average yield per kill`,
table(['Source','Shards (floor 1)','Items','Iron scrap','Emberstone','Spire crystal','Its family\u2019s drop'],Object.keys(L).map(k=>{const q=L[k];
  return[src[k],fx((q.shards[0]+q.shards[1])/2),fx(q.items.reduce((a,i)=>a+i.chance,0),2),...['scrap','ember','crystal'].map(m=>q.mats[m]?fx(matAvg(q.mats[m]),2):'–'),q.fam?fx(matAvg(q.fam),2):'–'];})),
`## Where each enemy appears`,
table(['Floor','Enemies (share of room spawns)','Also','Boss'],D.FLOORS.map((f,i)=>{const bag=f.spawns,c={};for(const t of bag)c[t]=(c[t]||0)+1;
  return[i===D.FLOORS.length-1?`${i+1} and up`:String(i+1),Object.keys(c).map(t=>`${D.ETYPES[t].name} ${pct(c[t]/bag.length)}`).join(', '),
    [f.wall?`${D.ETYPES[f.wall.type].name} on the top wall of ${pct(f.wall.chance)} of rooms`:'',f.thorns?'thorn patches':''].filter(Boolean).join('; ')||'–',f.boss.name];})),
`## Monster drops

Every monster belongs to a **family**, and each family has its own drop. A monster only ever drops its own
family\u2019s, on top of everything above; chests have no family and drop none. The blacksmith and the arcanist turn
them into gear against that family: see [Forging](forging.md). The exchange buys and sells them: see
[The market](market.md).`,
table(['Family','Drop','Ordinary monsters (chance per kill)','Elites','Bosses'],Object.keys(D.FAMILIES).map(f=>{const F=D.FAMILIES[f],boss=famBosses(f);
  return[F.name,IMG('drop-'+F.mat,MAT(F.mat),28)+' '+MAT(F.mat),famMonsters(f).map(t=>`${D.ETYPES[t].name}: ${famRoll(famDropOf(t))}`).join('<br>'),famRoll(L.elite.fam),
    boss.length?boss.map(b=>`${b}: ${famRoll(L.boss.fam)}`).join('<br>'):'none yet'];})),
`Tough monsters that are rare for their family roll better than the usual ${famRoll(L.normal.fam)}: ${Object.keys(D.ETYPES).filter(t=>D.ETYPES[t].famDrop).map(t=>D.ETYPES[t].name).join(', ')}.
The dead that a Gravecaller or the Pale Collector raises drop nothing, like the rest of their loot.`,
`## Unique drops

**Not in the game yet.** Apart from its family\u2019s drop, every enemy rolls from the same pool above. One-of-a-kind
items from particular enemies and bosses are planned: see [docs/design/floor-3.md](../design/floor-3.md). When they
land, this page lists them by enemy.`];
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

The blacksmith (at the forge, in the root village) enhances weapons, armor and boots up to +${D.ENH_MAX}. Each level adds
8% to the item's base numbers, so +${D.ENH_MAX} is ×${D.itemMult({plus:D.ENH_MAX})}. Trinkets cannot be enhanced.
Up to +5 an attempt always works. From +6 it can fail: the level stays, the cost is spent, and that item's next
attempt gets +10% (shown on the item), until it succeeds.`,
`![Enhancement success chance: 100% for +1 to +5, then 80%, 65%, 50%, 38% and 28% for +6 to +10](img/enhance-odds.svg)`,
table(['Level','Materials per attempt','Chance','Average attempts','Materials to get here from +0, on average (scrap / ember / crystal)'],steps),
`### Shard cost

Each attempt costs \`22 × (current level + 1) × (1 + 0.3 × (item level − 1)) × rarity multiplier\` shards, rounded.
Average shards to take an item from +0 to +${D.ENH_MAX}, failures included:`,
table(['Item level',...D.RARITY.map(r=>r.name)],[1,2,3,4].map(l=>[l,...D.RARITY.map((r,i)=>shardsTo(i,l).toLocaleString('en'))])),
`### Salvaging

Salvaging gives \`6 × (1 + 0.22 × (item level − 1)) × rarity multiplier³ × (1 + 0.5 × level)\` shards, plus materials:`,
table(['Rarity','Materials back'],D.RARITY.map((r,i)=>[r.name,Object.entries(D.salvageMats({rarity:i})).map(([k,v])=>v+' '+MAT(k)).join(', ')])),
`A [forged](forging.md) piece also returns a third of the monster drops that went into it: ${Object.keys(D.FORGING).map(s=>`${Math.floor(D.FORGING[s].drops/3)} from ${s==='weapon'?'a weapon':s}`).join(', ')}.`,
`## Weapon damage range

Lowest possible (common, +0, low roll) to highest possible (legendary, +${D.ENH_MAX}, high roll), per item level.
Base rolls vary ±5%.`,
table(['Weapon','Class','Attacks/s','Reach',...[1,2,3,4].map(l=>'Item level '+l)],Object.entries(D.WTYPES).map(([k,T])=>[(k==='grimoire'?IMG('item-grimoire-magic','',32)+IMG('item-grimoire-faith','',32):IMG(WICON[k],'',32))+' '+T.name,T.cls,T.aspd,T.ranged||T.magic?T.range+' (shot)':T.range+(T.arc<50?', thrust':', '+T.arc+'°'),...[1,2,3,4].map(l=>dmg(T,l))])),
`## Armor and boots range

Same rule: common +0 to legendary +${D.ENH_MAX}. Move speed bonuses do not grow with rarity or level.`,
table(['Item','Stat',...[1,2,3,4].map(l=>'Item level '+l)],[
  ...Object.entries(D.ATYPES).flatMap(([k,T])=>[[IMG('item-armor-'+k,'',32)+' '+T.name,'Defense',...[1,2,3,4].map(l=>gear(T,'def',l))],[T.name,'Health',...[1,2,3,4].map(l=>gear(T,'hp',l))],...(T.move?[[T.name,'Move',...[1,2,3,4].map(()=>(T.move>0?'+':'')+T.move+'%')]]:[])]),
  ...Object.entries(D.BTYPES).flatMap(([k,T])=>[[IMG('item-boots-'+k,'',32)+' '+T.name,'Defense',...[1,2,3,4].map(l=>gear(T,'def',l))],[T.name,'Move',...[1,2,3,4].map(()=>'+'+T.move+'%')]])]),
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
  const where=t=>D.FLOORS.map((f,i)=>f.spawns.includes(t)||(f.wall&&f.wall.type===t)?(i===D.FLOORS.length-1?`${i+1}+`:String(i+1)):null).filter(Boolean).join(', ');
  const out=[HEADER('Monsters'),
`Enemies get tougher on every floor: health +38%, damage +22% and experience +30% per floor above the first.
Elites (gold) have 2.4× health and 1.3× damage. Damage shown is before your defense, which removes
\`defense / (100 + defense)\` of each blow.

**Floor 3** adds three rules: thralls leave bodies that a Gravecaller can raise (fire burns them for good); thorn
patches at the edges of rooms slow everything but plants by 40% and prick for small damage; and Thornroots take
double damage from fire.

**Families.** Every monster belongs to a family and drops that family\u2019s own material. Gear
[forged](forging.md) from it works against the whole family: a weapon deals +${D.FORGING.weapon.bonus[0]}% to +${D.FORGING.weapon.bonus[1]}% damage to it, armor and
boots take less damage from it. Each monster\u2019s family is listed below.`,
table(['Family','Monsters','Bosses','Drop'],Object.keys(D.FAMILIES).map(f=>[D.FAMILIES[f].name,famMonsters(f).map(t=>D.ETYPES[t].name).join(', '),famBosses(f).join(', ')||'none yet',IMG('drop-'+D.FAMILIES[f].mat,'',28)+' '+MAT(D.FAMILIES[f].mat)])),
`Other targeted bonuses: the weapon affix *Giant-slaying* (extra damage to elites and bosses); the dead take less
magic damage and Thornroots more fire (below). Every "% more damage" bonus (a forged weapon\u2019s, Giant-slaying,
Executioner\u2019s, Sunder\u2019s mark) adds up and is applied once: +20% and +30% make +50%, not +56%.`];
  for(const [t,E] of Object.entries(D.ETYPES)){if(t==='boss'||E.dummy)continue;const n=NOTES[t]||{};
    out.push(`## ${E.name}`,`${IMG('enemy-'+t,E.name)} ${IMG('enemy-'+t+'-elite',E.name+', elite')}<br><sub>Ordinary and elite</sub>`,
table(['','Floor 1','Floor 2','Floor 3'],[['Health (elite)',...SHOWN.map(f=>`${Math.round(E.hp*floorMult(f).hp)} (${Math.round(E.hp*floorMult(f).hp*2.4)})`)],
  ['Damage per hit (elite)',...SHOWN.map(f=>`${(E.dmg*floorMult(f).dmg).toFixed(1)} (${(E.dmg*floorMult(f).dmg*1.3).toFixed(1)})`)],
  ['Experience (elite)',...SHOWN.map(f=>`${Math.round(E.xp*floorMult(f).xp)} (${Math.round(E.xp*floorMult(f).xp*3)})`)]]),
`- **Family:** ${famLink(E.fam)} · drops ${MAT(D.FAMILIES[E.fam].mat)} (${famRoll(famDropOf(t))}; elites ${famRoll(D.LOOT.elite.fam)})
- **Found on floors:** ${where(t)||'(summoned only)'}
- **Speed:** ${E.speed}${E.ranged?' · **ranged**':''}${E.heavy?' · **heavy** (not staggered by hits)':''}${E.mres?` · **ignores ${pct(E.mres)} of magic damage**`:''}${E.shield?' · **shield**':''}${E.rooted?' · **rooted** (never moves, no knockback)':''}${E.weak&&E.weak.fire?` · **takes ${E.weak.fire}× fire damage**`:''}${E.corpse?' · **leaves a body**':''}
- **How it fights:** ${n.fights||'—'}
- **How to beat it:** ${n.beat||'—'}
- **Recommended attributes:** ${n.stats||'—'}`);}
  const B=D.ETYPES.boss;
  out.push(`## Floor bosses`,
`Base health ${B.hp} and damage ${B.dmg}, scaled by floor like everything else (floor 2: ${Math.round(B.hp*floorMult(2).hp)} health, floor 3: ${Math.round(B.hp*floorMult(3).hp)}).
Telegraphed attacks (red markings) cannot be evaded by Dexterity; shields cut them by less than ordinary blows. If
everyone inside the chamber falls, the boss heals to full.`);
  const bossFam=n=>{const F=D.FLOORS.find(f=>f.boss.name===n);return F&&F.boss.fam;};
  for(const b of BOSS_NOTES)out.push(`### ${b.name}\n\n${IMG(b.img,b.name,150)}\n\n*${b.floors}* · Family: ${famLink(bossFam(b.name))}, drops ${famRoll(D.LOOT.boss.fam)} ${MAT(D.FAMILIES[bossFam(b.name)].mat)}\n\n${b.attacks.map(a=>'- '+a).join('\n')}\n\n${b.tips}`,
    `What each warning looks like, just before it lands:\n\n`+table(b.shots.map(x=>x[1]),[b.shots.map(([f,n])=>IMG(f,n+': the red warning before it lands',230))]));
  return out.join('\n\n')+'\n';
}

function forgingPage(){
  const F=D.FORGING,R=D.RARITY[D.FORGE_RARITY],slotName={weapon:'Weapon',armor:'Armor',boots:'Boots'},lv=[1,2,3,4];
  const shards=(s,l)=>Math.round(F[s].shards*(1+.3*(l-1)));
  const gives=s=>s==='weapon'?`+${F[s].bonus[0]}% to +${F[s].bonus[1]}% damage to the family`:`${F[s].bonus[0]}% to ${F[s].bonus[1]}% less damage taken from the family`;
  const out=[HEADER('Forging'),
`Every monster belongs to a **family** and drops that family\u2019s own material (the diamonds on the ground). In the
root village those drops are made into gear **against that family**:

- a forged **weapon** deals more damage to every monster and boss of the family;
- forged **armor** and **boots** take less damage from them, shots included, and worn together the two add up.

Against everything else a forged piece is an ordinary ${R.name.toLowerCase()} piece, so it is a tool to bring to the floors where
that family lives, not a replacement for your best gear.`,
`## Where

- **The blacksmith**, at the forge in the market: every weapon but grimoires, every armor, every pair of boots.
- **The arcanist**, at the witchcraft room next door: grimoires, of embers or of grace.

Talk to either (E), pick a family, then a piece. Trinkets cannot be forged.`,
`## What it costs and what you get`,
table(['Piece','Monster drops','Iron scrap',...lv.map(l=>'Shards at item level '+l),'Bonus'],Object.keys(F).map(s=>[slotName[s],F[s].drops,F[s].scrap,...lv.map(l=>shards(s,l)),gives(s)])),
`- A forged piece is always **${R.name}** (${R.mult}× base numbers) with a ${R.name.toLowerCase()} piece\u2019s usual random bonus: ${R.aff} on a weapon, armor or boots, ${R.aff+1} on a grimoire, from its own school.
- Its **item level** is the highest floor you have reached, the same as the village market\u2019s stock. Shards cost 30% more per level; the drops do not.
- The **size of the bonus** is rolled when the piece is made, anywhere in its range. Forging again rolls again.
- It can be **enhanced** like any other piece; enhancing raises its base numbers, not the family bonus.
- **Salvaging** it returns a third of the drops (${Object.keys(F).map(s=>`${Math.floor(F[s].drops/3)} from ${s==='weapon'?'a weapon':s}`).join(', ')}), with the usual shards and scrap.
- Drops, chests and shops never carry a family bonus: forging is the only source.`,
`## The families`,
table(['Family','Drop','Weapon','Armor and boots','Who is in it'],Object.keys(D.FAMILIES).map(f=>{const A=D.FAMILIES[f];
  return[A.name,IMG('drop-'+A.mat,MAT(A.mat),28)+' '+MAT(A.mat),IMG('forged-weapon-'+f,A.bane+' longsword',36)+' '+A.bane,IMG('forged-armor-'+f,A.ward+' plate cuirass',36)+' '+A.ward,
    [...famMonsters(f).map(t=>D.ETYPES[t].name),...famBosses(f)].join(', ')];})),
`The corner diamond on a forged piece\u2019s icon is its family\u2019s colour. How often each monster drops its family\u2019s
material is on the [Drops](drops.md#monster-drops) page.`,
`## How the bonus is counted

- **Weapons.** Every "% more damage" bonus adds up and is applied once: the family bonus, *Giant-slaying* (elites and
  bosses), *Executioner\u2019s* (below 30% health) and Sunder\u2019s mark (+25%). A +20% Gravebane greatsword with +30%
  Giant-slaying deals +50% to an elite bone soldier. Critical hits, magic resistance and fire weakness still multiply
  on top. Hits that got the family bonus show their number in orange (critical hits stay yellow).
- **Armor and boots.** The family\u2019s share comes off after defense: with ${F.armor.bonus[1]}% armor and ${F.boots.bonus[1]}% boots, the most
  that can be forged, a blow from that family does ${100-F.armor.bonus[1]-F.boots.bonus[1]}% of what it would have.
- Thorn patches belong to no family, so nothing forged helps against them.`];
  return out.join('\n\n')+'\n';
}

function marketPage(){
  const M=D.MARKET,goods=Object.keys(M),icon=k=>IMG('drop-'+k,MAT(k),28)+' '+MAT(k);
  // n bought, or sold, one after another, starting from the normal stock
  const bulk=(k,n,side)=>{let s=M[k].stock,t=0;for(let i=0;i<n;i++){if(side==='buy'){if(s<1)return null;t+=D.buyAt(k,s);s--;}else{t+=D.sellAt(k,s);s++;}}return t;};
  const hrs=Math.round(1/D.MARKET_DRIFT);
  const out=[HEADER('The market'),
`The **exchange** is the desk at the bottom of the root village\u2019s market, under the board with the day\u2019s
prices. It buys and sells the enhancement materials and every family\u2019s monster drop. Talk to the broker (E) and pick a good.`,
`## How prices move

One rule sets every price, from how much of the good the exchange holds:

\`\`\`
buy price  = usual price × (normal stock ÷ stock now), never under ${pct(D.MARKET_MIN)} or over ${pct(D.MARKET_MAX)} of the usual price
sell price = ${pct(D.MARKET_SPREAD)} of the buy price
\`\`\`

- Every one you **buy** leaves the exchange with one less, so the next costs a little more.
- Every one you **sell** leaves it with one more, so the next pays a little less.
- A trade of several is made one at a time, each at the price the one before left. The screen shows the total before
  you agree to it, and that total is what you pay or get.
- Each hour, every stock moves **${pct(D.MARKET_DRIFT)} of its normal size** back toward normal. A good bought out completely stays
  at its dearest for ${Math.round(hrs*(1-1/D.MARKET_MAX))} hours, then eases back to its usual price by hour ${hrs}. A glut clears at the same rate.
- One seller can sell **${pct(D.MARKET_SELL_SHARE)} of a good\u2019s normal stock per hour**. The count starts again on the hour.
- Buying one and selling it straight back always loses shards: that is what the ${pct(1-D.MARKET_SPREAD)} gap is for.`,
`## The goods`,
table(['Good','Usual price','Sells for','Cheapest / dearest to buy','Least / most it sells for','Normal stock','You can sell per hour'],goods.map(k=>[icon(k),M[k].base,D.sellAt(k,M[k].stock),
  `${D.buyAt(k,M[k].stock*4)} / ${D.buyAt(k,1)}`,`${D.sellAt(k,M[k].stock*4)} / ${D.sellAt(k,1)}`,M[k].stock,D.marketCap(k)])),
`Rare goods have small stocks, so each trade moves their price further: three ${MAT('crystal')}s are ${pct(3/M.crystal.stock)} of what the
exchange holds, three ${MAT('scrap')} are ${pct(3/M.scrap.stock)}.`,
`## Trading several at once

From the normal stock, in shards for the whole lot:`,
table(['Good','Buy 1','Buy 5','Buy 20','Sell 1','Sell 5','Sell 20'],goods.map(k=>[MAT(k),...[1,5,20].map(n=>{const t=bulk(k,n,'buy');return t==null?'not enough stock':t;}),
  ...[1,5,20].map(n=>n>D.marketCap(k)?`over the hourly ${D.marketCap(k)}`:bulk(k,n,'sell'))])),
`## Single player and online

- **Single player:** the exchange\u2019s stock is part of your save. Only you move its prices, and the hourly drift
  goes on while you are away.
- **Online:** a server keeps one stock for the root village, shared by every channel, so everyone moves the same
  prices. If someone trades between your looking and your clicking and the price moves against you, the trade is
  refused and the screen shows the new price; nothing is taken.`,
`## Other uses for what you carry

- The **guild\u2019s board** asks for one enhancement material and one monster drop each day and pays **30% over the
  usual price**, plus experience. The exchange usually pays ${pct(D.MARKET_SPREAD)} of it, so a delivery is the better deal unless the
  exchange is running very low on that good.
- Monster drops are what [forged gear](forging.md) is made from, and enhancement materials are what
  [enhancing](enhancement.md) costs. Whatever the exchange pays, check you will not need them first.
- Crops are not traded here: the food and drink stall buys those at a fixed price.`];
  return out.join('\n\n')+'\n';
}

function indexPage(){return HEADER('Blackspire wiki')+`
- [Drops](drops.md): what every enemy, elite, boss and chest drops, rarity odds, where each enemy appears, each family\u2019s monster drop.
- [Forging](forging.md): gear made from monster drops, against one family of monsters: where, what it costs, what it gives.
- [The market](market.md): the exchange that buys and sells materials and monster drops, and how its prices move.
- [Enhancement and item stats](enhancement.md): costs and odds for every level, the stat range of every item, bonus ranges by rarity.
- [Monsters](monsters.md): health, damage and experience by floor, each monster\u2019s family, how it fights and how to beat it, the bosses.
`;}

const pages={'README.md':indexPage(),'drops.md':dropsPage(),'forging.md':forgingPage(),'market.md':marketPage(),'enhancement.md':enhancePage(),'monsters.md':monstersPage()};
pages['img/rarity-odds.svg']=rarityChart();pages['img/enhance-odds.svg']=enhanceChart();
if(process.argv.includes('--check')){
  const stale=Object.keys(pages).filter(f=>{try{return fs.readFileSync(path.join(OUT,f),'utf8')!==pages[f];}catch(e){return true;}});
  if(stale.length){console.error('docs/wiki is out of date ('+stale.join(', ')+'). Run: node tools/wiki.js');process.exit(1);}
}else{fs.mkdirSync(path.join(OUT,'img'),{recursive:true});for(const f in pages)fs.writeFileSync(path.join(OUT,f),pages[f]);console.log('wrote docs/wiki/'+Object.keys(pages).join(', '));}

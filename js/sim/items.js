'use strict';
// Blackspire: Item generation and pricing.

/* ---------- items ---------- */
let UIDN=1;
const uid=()=>Date.now().toString(36)+'-'+(UIDN++).toString(36)+Math.floor(Math.random()*1296).toString(36);
const ilvlMult=l=>1+0.22*(l-1);
const itemMult=it=>1+0.08*(it.plus||0);
function rollRarity(bonus=0){const r=Math.random()*100-bonus;return r<1.5?4:r<7?3:r<22?2:r<52?1:0;}
function rollAff(pool,n,rar,ilvl){
  const ids=shuffle(Object.keys(pool)).slice(0,n);
  return ids.map(id=>{const d=pool[id];let v=d.range[0]+(d.range[1]-d.range[0])*clamp(Math.random()*.7+rar*.1,0,1);if(d.scale)v*=ilvlMult(ilvl);return{id,v:Math.max(1,Math.round(v))};});
}
function makeWeapon(type,ilvl,rar,school){
  const T=WTYPES[type],R=RARITY[rar];
  const it={uid:uid(),slot:'weapon',type,rarity:rar,ilvl,plus:0,base:{dmg:+(T.dmg*ilvlMult(ilvl)*R.mult*rand(.95,1.05)).toFixed(1)}};
  if(T.magic){
    it.school=school||(Math.random()<.5?'magic':'faith');const g=GRIM[it.school];it.tint=g.tint;
    it.aff=rollAff(g.pool,Math.min(R.aff+1,Object.keys(g.pool).length),rar,ilvl);
    it.name=rar===4?pick(LEGEND[it.school]):g.pool[it.aff[0].id].name+' grimoire';
  }else{
    const pal=T.ranged?BOWS:BLADES;it.tint=(rar>=2||Math.random()<.2)?pick(pal):pal[0];it.aff=rollAff(PASSIVES,R.aff,rar,ilvl);
    it.name=rar===4?pick(LEGEND[type]):(it.aff[0]?PASSIVES[it.aff[0].id].name:(rar===0?pick(['Iron','Worn','Plain']):'Fine'))+' '+T.name.toLowerCase();
  }
  return it;
}
// Is this bag item better than what is equipped? It is tried on (computeStats with the item swapped in) and
// the real totals are compared, so affixes count, not just the base numbers.
//   weapons: damage per second, with crits and rough values for the damage passives. Lifesteal, reach and skill
//            cooldown cannot be ranked against damage, so they are left out. A different weapon type is a class
//            change, never an "upgrade".
//   armor, boots: effective health (health through defense and evasion), nudged by move speed.
//   trinkets: all affixes, which cannot honestly be ranked, so only an empty slot counts. The detail view
//            lists what would change.
function weaponScore(st){
  const p=st.p,crit=Math.min(100,st.crit)/100,hit=st.dmg*(1+crit*(st.critDmg/100-1));
  let dps=hit*st.aspd*(1+(p.momentum||0)*3/100);                          // about three Quickening stacks in a fight
  dps*=1+(p.execute||0)/100*.3+(p.giant||0)/100*.25+(p.spark||0)/100*.5;  // share of damage each one applies to
  return dps+st.dmg*(p.bleed||0)/100/3;                                    // bleed refreshes, it does not stack
}
const defScore=st=>st.maxHp*(100+st.def)/100/(1-st.evade/100)*(1+st.movePct/200);
function isUpgrade(it){
  const cur=S.equip[it.slot];if(!cur)return true;
  if(it.slot==='trinket')return false;
  if(it.slot==='weapon'&&(it.type!==cur.type||it.school!==cur.school))return false;
  const now=computeStats(S.char,S.equip),alt=computeStats(S.char,{...S.equip,[it.slot]:it}),score=it.slot==='weapon'?weaponScore:defScore;
  return score(alt)>score(now)*1.02;
}
function gearName(it,base){return (it.aff[0]?GEAR_AFFIX[it.aff[0].id].name:(it.rarity===0?'Plain':'Fine'))+' '+base.toLowerCase();}
function makeArmor(type,ilvl,rar,tint){
  const T=ATYPES[type],m=ilvlMult(ilvl)*RARITY[rar].mult;
  const it={uid:uid(),slot:'armor',type,rarity:rar,ilvl,plus:0,tint:tint||pick(OUTFITS),
    base:{def:Math.round(T.def*m),hp:Math.round(T.hp*m),move:T.move},aff:rollAff(GEAR_AFFIX,RARITY[rar].aff,rar,ilvl)};
  it.name=gearName(it,T.name);return it;
}
function makeBoots(type,ilvl,rar){
  const T=BTYPES[type],m=ilvlMult(ilvl)*RARITY[rar].mult;
  const it={uid:uid(),slot:'boots',type,rarity:rar,ilvl,plus:0,tint:pick(['#2a211b','#3a3a44','#4a3524','#1c1c22','#5a5648']),
    base:{def:Math.round(T.def*m),move:T.move},aff:rollAff(GEAR_AFFIX,RARITY[rar].aff,rar,ilvl)};
  it.name=gearName(it,T.name);return it;
}
function makeTrinket(type,ilvl,rar){
  const it={uid:uid(),slot:'trinket',type,rarity:rar,ilvl,plus:0,tint:pick(['#dcb65c','#c3cad6','#5ab0de','#b0464d','#63b98e']),
    base:{},aff:rollAff(GEAR_AFFIX,RARITY[rar].aff+1,rar,ilvl)};
  it.name=gearName(it,TTYPES[type].name);return it;
}
function randomItem(ilvl,bonus=0,minRar=0){
  const rar=Math.max(minRar,rollRarity(bonus)),r=Math.random();
  if(r<.42)return makeWeapon(pick(Object.keys(WTYPES)),ilvl,rar);
  if(r<.66)return makeArmor(pick(Object.keys(ATYPES)),ilvl,rar);
  if(r<.83)return makeBoots(pick(Object.keys(BTYPES)),ilvl,rar);
  return makeTrinket(pick(Object.keys(TTYPES)),ilvl,rar);
}
const salvageValue=it=>Math.round(6*ilvlMult(it.ilvl)*RARITY[it.rarity].mult**3*(1+.5*(it.plus||0)));
// Salvaging also returns materials: scrap from anything, emberstone from epics up, a crystal from a legendary.
const salvageMats=it=>{const m={scrap:1+it.rarity};if(it.rarity>=3)m.ember=it.rarity-2;if(it.rarity>=4)m.crystal=1;return m;};
/* Enhancement. Each step costs shards plus materials: scrap for +1 to +3, emberstone joins from +4,
   spire crystals from +7. Up to +5 it always works. From +6 it can fail: a failure keeps the level but uses the
   cost, and adds 10 points to the item's next chance (it.pity), which resets on success. */
const ENH_CHANCE=[1,1,1,1,1,.8,.65,.5,.38,.28],ENH_MAX=10;
function enhanceRecipe(it){
  const k=(it.plus||0)+1;
  return{to:k,shards:enhanceCost(it),mats:k<=3?{scrap:k}:k<=6?{scrap:3,ember:k-3}:{ember:3,crystal:k-6},
    chance:Math.min(1,ENH_CHANCE[k-1]+(it.pity||0))};
}
const hasMats=(have,need)=>Object.keys(need).every(k=>(have[k]||0)>=need[k]);
// One enhancement attempt on item `it`, paid from save `s`. Returns null if it cannot be afforded, else whether it worked.
function enhanceItem(s,it){
  if((it.plus||0)>=ENH_MAX)return null;const r=enhanceRecipe(it);
  if(s.shards<r.shards||!hasMats(s.mats,r.mats))return null;
  s.shards-=r.shards;for(const k in r.mats)s.mats[k]-=r.mats[k];
  if(Math.random()<r.chance){it.plus=r.to;delete it.pity;return true;}
  it.pity=+((it.pity||0)+.1).toFixed(2);return false;
}
function salvageItem(s,i){const it=s.inv[i];if(!it)return;s.inv.splice(i,1);s.shards+=salvageValue(it);const m=salvageMats(it);for(const k in m)s.mats[k]=(s.mats[k]||0)+m[k];}
const matsText=m=>Object.keys(m).map(k=>m[k]+' '+MATS[k].name).join(', ');
const enhanceCost=it=>Math.round(22*((it.plus||0)+1)*(1+.3*(it.ilvl-1))*RARITY[it.rarity].mult);
const BAG_SIZE=30;
const buyPrice=it=>Math.round([40,70,130,240,450][it.rarity]*(1+.3*(it.ilvl-1)));
// The floor whose prices and item levels a shop uses: its own, or in the village, the highest floor you have reached.
const shopFloor=()=>G.n||Math.max(1,S.best||1);
const supplyPrice=k=>Math.round(SUPPLIES[k].price*(1+.25*(shopFloor()-1)));
const potionPrice=()=>supplyPrice('potion');
const mealPrice=k=>Math.round(MEALS[k].price*(1+.25*(shopFloor()-1)));

// A trader's gear for the current player, at the shop's floor level. kind (TRADER_SELLS): 'all' is a tower trader's
// mixed pack (one weapon of your own class, then five random pieces); the village stalls keep to their own goods.
function makeStock(kind='all'){
  const rar=()=>{const r=Math.random();return r<.03?3:r<.2?2:r<.55?1:0;};   // a shop sells mostly ordinary gear: 45% common, 35% uncommon, 17% rare, 3% epic, never legendary
  const n=shopFloor(),w=S.equip.weapon,want=TRADER_SELLS[kind].gear,st=[];
  if(!want.length)return[];
  if(want.includes('weapon'))st.push(makeWeapon(w.type,n,Math.max(1,rar()),w.school));
  for(let i=0,tries=0;st.length<6&&tries<200;tries++){const it=randomItem(n,0),q=rar();if(!want.includes(it.slot))continue;i++;
    st.push(it.slot==='weapon'?makeWeapon(it.type,n,q,it.school):it.slot==='armor'?makeArmor(it.type,n,q):it.slot==='boots'?makeBoots(it.type,n,q):makeTrinket(it.type,n,q));}
  return st.map(it=>({it,price:buyPrice(it)}));
}

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
// Is this bag item better than what is equipped? Only compares like with like.
function isUpgrade(it){
  const cur=S.equip[it.slot];if(!cur)return true;
  if(it.slot==='weapon'){const A=WTYPES[it.type],B=WTYPES[cur.type];if(it.type!==cur.type||it.school!==cur.school)return false;return it.base.dmg*itemMult(it)*A.aspd>cur.base.dmg*itemMult(cur)*B.aspd*1.02;}
  if(it.slot==='trinket')return false;
  const sc=q=>((q.base.def||0)+(q.base.hp||0)/3)*itemMult(q)+(q.base.move||0)*1.5;
  return sc(it)>sc(cur)*1.02;
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
const enhanceCost=it=>Math.round(22*((it.plus||0)+1)*(1+.3*(it.ilvl-1))*RARITY[it.rarity].mult);
const BAG_SIZE=30;
const buyPrice=it=>Math.round([40,70,130,240,450][it.rarity]*(1+.3*(it.ilvl-1)));
const potionPrice=()=>Math.round(25*(1+.25*(G.n-1)));

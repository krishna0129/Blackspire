'use strict';
// Blackspire: everything a player can do outside of combat (gear, attributes, the blacksmith), as named actions.
// Single player calls them directly; online, the client asks the server to run them, so the server's copy of the
// save is the only one that counts. Each acts on the current player (setPlayer) and returns a result, or false.

const nearSmithIdx=si=>{const q=G.smiths[si];return!!q&&hyp(q.x-P.x,q.y-P.y)<40;};
const ACTIONS={
  // make the stock the first time a smith's counter is opened
  openShop(si){if(!nearSmithIdx(si))return false;const sh=shopOf(si);if(!sh.stock)sh.stock=makeStock();return true;},
  buy(si,i){
    if(!nearSmithIdx(si))return false;const sh=shopOf(si),e=sh.stock&&sh.stock[i];
    if(!e||S.shards<e.price||S.inv.length>=BAG_SIZE)return false;
    S.shards-=e.price;S.inv.push(e.it);sh.stock.splice(i,1);return S.inv.length-1;
  },
  buyPotion(si){
    if(!nearSmithIdx(si))return false;const sh=shopOf(si),pr=potionPrice();
    if(S.shards<pr||sh.potions<=0)return false;S.shards-=pr;sh.potions--;S.potions++;return true;
  },
  // bag item i goes on; whatever it replaces takes its place in the bag
  equip(i){
    const it=S.inv[i];if(!it)return false;
    const old=S.equip[it.slot];S.equip[it.slot]=it;if(old)S.inv[i]=old;else S.inv.splice(i,1);
    calcStats();return it.slot;
  },
  unequip(slot){
    if(slot!=='trinket'||!S.equip.trinket||S.inv.length>=BAG_SIZE)return false;
    S.inv.push(S.equip.trinket);S.equip.trinket=null;calcStats();return true;
  },
  spend(k){
    const c=S.char;if(!ATTRS.includes(k)||c.pts<=0)return false;
    c.pts--;c[k]++;const full=P.hp>=ST.maxHp;calcStats();
    if(full||k==='vit')P.hp=Math.min(ST.maxHp,P.hp+14);if(k==='mnd')P.mp=Math.min(ST.maxMp,P.mp+10);return true;
  },
  // where: 'eq' (key = slot) or 'bag' (key = index). Only next to a blacksmith.
  enhance(where,key){
    if(!G.smiths.some((q,i)=>nearSmithIdx(i)))return false;
    const it=where==='eq'?S.equip[key]:S.inv[key];if(!it||it.slot==='trinket')return false;
    const ok=enhanceItem(S,it);if(ok===null)return false;calcStats();
    log(ok?`<span style="color:var(--cyan)">${esc(it.name)} is now +${it.plus}.</span>`:`The enhancement failed. ${esc(it.name)} stays +${it.plus||0}; the next try is more likely to work.`);
    return ok?'up':'fail';
  },
  salvage(i){if(!S.inv[i])return false;salvageItem(S,i);return true;},
  seen(){for(const it of S.inv)delete it.isNew;return true;},
  custom(url){S.char.custom=url||null;return true;},
};
function runAction(name,args){const f=ACTIONS[name];return f&&!P.dead?f(...(Array.isArray(args)?args:[])):false;}

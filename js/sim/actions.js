'use strict';
// Blackspire: everything a player can do outside of combat (gear, attributes, the trader, the blacksmith), as named actions.
// Single player calls them directly; online, the client asks the server to run them, so the server's copy of the
// save is the only one that counts. Each acts on the current player (setPlayer) and returns a result, or false.

const nearSmithIdx=si=>{const q=G.smiths[si];return!!q&&hyp(q.x-P.x,q.y-P.y)<40;};
const nearTraderIdx=si=>{const q=G.traders[si];return!!q&&hyp(q.x-P.x,q.y-P.y)<40;};
const ACTIONS={
  // make the stock the first time a trader's pack is opened
  openShop(si){
    if(!nearTraderIdx(si))return false;
    // The village market restocks with each day's quest board, as well as whenever a boss falls (killEnemy). The
    // tower's traders only restock when their own floor's boss falls.
    if(G.village){const f=floorState(0),day=questDay();if(f.day!==day){f.shops=[];f.day=day;}}
    const sh=shopOf(si);if(!sh.stock)sh.stock=makeStock(G.traders[si].sells||'all');return true;
  },
  buy(si,i){
    if(!nearTraderIdx(si))return false;const sh=shopOf(si),e=sh.stock&&sh.stock[i];
    if(!e||S.shards<e.price||S.inv.length>=BAG_SIZE)return false;
    S.shards-=e.price;S.inv.push(e.it);sh.stock.splice(i,1);return S.inv.length-1;
  },
  // k: a SUPPLIES key (potion, ration, flask)
  buySupply(si,k){
    const s=SUPPLIES[k];if(!s||!nearTraderIdx(si)||!TRADER_SELLS[G.traders[si].sells||'all'].supplies.includes(k))return false;const sh=shopOf(si),pr=supplyPrice(k);
    if(S.shards<pr||sh[s.key]<=0)return false;S.shards-=pr;sh[s.key]--;S[s.key]=(S[s.key]||0)+1;return true;
  },
  buyPotion(si){return ACTIONS.buySupply(si,'potion');},
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
  // the universal stash: the same one behind every stash chest. i: a bag slot (stash) or a stash slot (unstash)
  stash(i){if(!nearStash(40)||!S.inv[i]||S.stash.length>=STASH_SIZE)return false;S.stash.push(S.inv.splice(i,1)[0]);return S.stash.length-1;},
  unstash(i){if(!nearStash(40)||!S.stash[i]||S.inv.length>=BAG_SIZE)return false;S.inv.push(S.stash.splice(i,1)[0]);return S.inv.length-1;},
  // the village well fills every empty flask you carry, for nothing
  fillFlasks(){if(!nearWell(40)||!(S.empties>0))return false;const n=S.empties;S.flasks+=n;S.empties=0;return n;},
  // a meal at the inn, eaten at once: the meters fill and its buff starts (MEALS)
  // own: cooked from your own crops (m.cook) instead of paid for
  eatMeal(si,k,own){
    const m=MEALS[k];if(!m||!nearTraderIdx(si)||!TRADER_SELLS[G.traders[si].sells||'all'].meals)return false;const pr=mealPrice(k);
    if(own){if(!m.cook||Object.keys(m.cook).some(c=>(S.crops[c]||0)<m.cook[c]))return false;for(const c in m.cook)S.crops[c]-=m.cook[c];}
    else{if(S.shards<pr)return false;S.shards-=pr;}
    P.food=Math.min(100,P.food+m.food);P.drink=Math.min(100,P.drink+m.drink);P.buff={id:m.buff,t:BUFF_TIME};
    log(`You eat the ${m.name.toLowerCase()}. ${BUFFS[m.buff].name}: ${BUFFS[m.buff].desc.toLowerCase()}`);sfx('pick');return true;
  },
  // the Adventurers' Guild: take a quest from today's board, give one up, or hand a finished one in for its reward
  takeQuest(id){
    if(!nearGuild(40))return false;const L=questLog(),q=questById(id);
    if(!q||id in L.active||L.done.includes(id)||Object.keys(L.active).length>=QUEST_MAX)return false;L.active[id]=0;return true;
  },
  dropQuest(id){const L=questLog();if(!(id in L.active))return false;delete L.active[id];return true;},
  handIn(id){
    if(!nearGuild(40))return false;const L=questLog(),q=questById(id);
    if(!q||!(id in L.active)||!questReady(q))return false;
    if(q.kind==='deliver')S.mats[q.mat]-=q.n;
    delete L.active[id];L.done.push(id);
    const R=q.reward;S.shards+=R.shards;for(const k in R.mats||{})S.mats[k]=(S.mats[k]||0)+R.mats[k];
    log(`<span style="color:var(--cyan)">${q.title} handed in: ${R.shards} shards and ${R.xp} experience${R.mats?', and a Spire crystal':''}.</span>`);
    sfx('lvl');gainXp(R.xp);return true;
  },
  // the innkeeper wraps potatoes into a ration to take into the tower
  packRation(si){
    if(!nearTraderIdx(si)||!TRADER_SELLS[G.traders[si].sells||'all'].meals||(S.crops.potato||0)<RATION_POTATOES)return false;
    S.crops.potato-=RATION_POTATOES;S.rations=(S.rations||0)+1;sfx('pick');return true;
  },
  // the fields, from the fields manager (at the field's entrance, its people, or any plot): i is the plot's number
  buyPlot(i){
    if(!nearFields()||!VILLAGE.plots[i]||myPlot(i))return false;const pr=plotPrice(S.plots.length);if(S.shards<pr)return false;
    S.shards-=pr;S.plots.push({i,crop:null,t:0});sfx('lvl');return true;
  },
  plant(i,crop){
    const p=myPlot(i),C=CROPS[crop];if(!nearFields()||!p||p.crop||!C||!G.crops.includes(crop)||S.shards<C.seed)return false;
    S.shards-=C.seed;p.crop=crop;p.t=Date.now();sfx('pick');return true;
  },
  harvest(i){
    const p=myPlot(i);if(!nearFields()||!cropReady(p))return false;const C=CROPS[p.crop],n=Math.round(rand(C.yield[0],C.yield[1]));
    const v=takeHarvest(p.crop,n);log(`Harvested ${n} ${n>1?C.plural:C.name.toLowerCase()}`+(v?`; the broker sold them for ${v} shards.`:'.'));p.crop=null;p.t=0;sfx('pick');return n;
  },
  // help for the whole field. Hiring the farmhand pays the first day's wage at once.
  farmhand(on){
    const F=farmLog();if(!nearFields()||!S.plots.length)return false;
    if(!on){F.farmer=false;return true;}
    if(F.farmer)return false;const w=FARMHAND_WAGE*S.plots.length;if(S.shards<w)return false;
    S.shards-=w;F.farmer=true;F.paid=Date.now()+FARM_DAY;return true;
  },
  broker(on){if(!nearFields()||!S.plots.length)return false;farmLog().broker=!!on;return true;},
  // the food and drink stall buys your crops at the full price: what doing it yourself is worth
  sellCrops(si,crop){
    if(!nearTraderIdx(si)||G.traders[si].sells!=='food'||!CROPS[crop]||!(S.crops[crop]>0))return false;
    const n=S.crops[crop],v=cropValue(crop,n);S.crops[crop]=0;S.shards+=v;sfx('pick');log(`Sold ${n} ${CROPS[crop].plural} for ${v} shards.`);return v;
  },
  salvage(i){if(!S.inv[i])return false;salvageItem(S,i);return true;},
  seen(){for(const it of S.inv)delete it.isNew;return true;},
  custom(url){S.char.custom=url||null;return true;},
};
function runAction(name,args){const f=ACTIONS[name];return f&&!P.dead?f(...(Array.isArray(args)?args:[])):false;}

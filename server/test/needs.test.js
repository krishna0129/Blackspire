'use strict';
// Hunger, thirst and the trader (js/sim: NEEDS, SUPPLIES, shopOf, the buySupply action), run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

// a fresh sandbox with floor 1 and one player standing in the start room, next to its trader
function world(save=''){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');${save}setWorld(genFloor(1,7));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  return run;
}
const step=(run,secs)=>run(`for(let i=0;i<${Math.round(secs*30)};i++){for(const q of G.players)q.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);

test('hunger and thirst drain over time, and thirst faster',()=>{
  const run=world();
  assert.strictEqual(run(`[pl.food,pl.drink].join()`),'100,100');
  step(run,60);
  const [f,d]=run(`[pl.food,pl.drink]`);
  assert.ok(Math.abs(f-(100-100/25))<.2,'food: '+f);    // 25 minutes from full to empty
  assert.ok(Math.abs(d-(100-100/15))<.2,'drink: '+d);   // 15 minutes
});

test('empty meters cost health every second; eating and drinking refill them',()=>{
  const run=world();
  run(`pl.food=0;pl.drink=0;pl.hp=pl.ST.maxHp;`);
  step(run,3);
  const lost=run(`pl.ST.maxHp-pl.hp`),per=run(`Math.max(1,Math.round(pl.ST.maxHp*NEED_HURT*2))`);
  assert.ok(lost>=2*per&&lost<=3*per,`lost ${lost}, ${per} a second`);
  run(`eat();`);assert.strictEqual(run(`[pl.food,S.rations].join()`),'40,1');
  run(`pl.eatCd=0;drink();`);assert.strictEqual(run(`[Math.round(pl.drink),S.flasks].join()`),'50,1');
  run(`pl.eatCd=0;pl.drink=100;drink();`);assert.strictEqual(run(`S.flasks`),1,'a full meter wastes nothing');
});

test('starving to death wakes you at least half fed',()=>{
  const run=world();
  run(`pl.food=0;pl.drink=10;pl.hp=1;`);step(run,1.1);
  assert.ok(run(`pl.dead`));
  assert.strictEqual(run(`[S.food,S.drink].join()`),'50,50');
  assert.strictEqual(run(`respawnPlayer(pl);[pl.food,pl.drink].join()`),'50,50');
});

test('a trader holds 5 to 10 of each supply, sells only when you stand at the pack, and runs out',()=>{
  const run=world();
  run(`const t=G.traders[0];pl.x=t.x;pl.y=t.y+8;S.shards=10000;`);
  const n=run(`const sh=shopOf(0);[sh.potions,sh.rations,sh.flasks]`);
  for(const v of n)assert.ok(v>=5&&v<=10,'stock '+v);
  let bought=0;while(run(`runAction('buySupply',[0,'flask'])`))bought++;
  assert.strictEqual(bought,n[2]);assert.strictEqual(run(`S.flasks`),2+n[2]);
  run(`pl.x+=200;`);assert.strictEqual(run(`runAction('buySupply',[0,'potion'])`),false,'too far from the trader');
  run(`pl.x=G.smiths[0].x;pl.y=G.smiths[0].y;`);assert.strictEqual(run(`runAction('buySupply',[0,'potion'])`),false,'the blacksmith does not sell supplies');
});

test('a counter from an old save holding 98 potions is brought back into range',()=>{
  const run=world(`s.floors={1:{chests:[],shops:[{stock:null,potions:98}],boss:0}};`);
  const v=run(`shopOf(0).potions`);assert.ok(v>=5&&v<=10,'potions '+v);
});

test('old saves get full meters and a few supplies',()=>{
  const R=loadRules();
  const s=vm.runInContext(`(()=>{const s=newState('T',{},'sword','#222');delete s.food;delete s.drink;delete s.rations;delete s.flasks;return migrateSave(JSON.parse(JSON.stringify(s)));})()`,R);
  assert.strictEqual([s.food,s.drink,s.rations,s.flasks].join(),'100,100,2,2');
});

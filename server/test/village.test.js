'use strict';
// The root village (js/sim/village.js) and the travel rules around it, run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function village(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genVillage());const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  return run;
}
const step=(run,secs)=>run(`for(let i=0;i<${Math.round(secs*30)};i++){for(const q of G.players)q.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);

test('new characters start in the village, on open ground, safe, by the Teleport Gate',()=>{
  const run=village();
  assert.strictEqual(run(`S.floor`),0);
  assert.ok(run(`!solid(pl.x,pl.y)`),'standing on open ground');
  step(run,.2);
  assert.ok(run(`pl.safe`),'the whole village is safe');
  assert.ok(run(`hyp(G.home.x-pl.x,G.home.y-pl.y)<6*TILE`),'the gate is right there');
});

test('every building, stall and tree blocks its footprint, and every person can be reached from open ground',()=>{
  const run=village();
  for(const q of['G.traders','G.smiths','G.talkers'])
    assert.ok(run(`${q}.every(n=>[[0,1],[0,1.6],[0,2]].some(([dx,dy])=>!solid(n.x+dx*TILE,n.y+dy*TILE)&&hyp(dy*TILE,0)<24))`),q+' reachable from the front');
  assert.ok(run(`solid(vx(9.5),vy(8))`),'inside the inn is blocked');
  assert.ok(run(`solid(vx(44),vy(7.5))`),'a stall is blocked');
});

test('hunger and thirst hold still at home',()=>{
  const run=village();
  step(run,30);
  assert.strictEqual(run(`[pl.food,pl.drink].join()`),'100,100');
});

test('the market stalls each sell their own goods',()=>{
  const run=village();
  run(`S.shards=1e6;`);
  const sells=run(`G.traders.map(t=>t.sells).join()`);assert.strictEqual(sells,'weapons,gear,potions,food');
  const at=i=>`pl.x=G.traders[${i}].x;pl.y=G.traders[${i}].y+16;`;
  run(at(0)+`runAction('openShop',[0]);`);
  assert.ok(run(`shopOf(0).stock.length>0&&shopOf(0).stock.every(e=>e.it.slot==='weapon')`),'weapons stall: weapons only');
  run(at(1)+`runAction('openShop',[1]);`);
  assert.ok(run(`shopOf(1).stock.every(e=>e.it.slot!=='weapon')`),'gear stall: no weapons');
  run(at(3));
  assert.strictEqual(run(`runAction('buySupply',[3,'flask'])`),true);
  assert.strictEqual(run(`runAction('buySupply',[3,'potion'])`),false,'the food stall has no potions');
  run(at(2));
  assert.strictEqual(run(`runAction('buySupply',[2,'potion'])`),true);
});

test('safe points you stand in are remembered for the Teleport Gate',()=>{
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genFloor(2,5));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  run(`const q=G.smiths[1];pl.x=q.x;pl.y=q.y+20;`);step(run,.1);
  assert.strictEqual(run(`JSON.stringify(S.points)`),'{"2":[1]}');
  run(`S.cp=1;S.cpFloor=2;const p2=makePlayer(2,S);G.players=[p2];setPlayer(p2);`);
  assert.strictEqual(run(`safeIndex(P.x,P.y)`),1,'arriving at that safe point');
});

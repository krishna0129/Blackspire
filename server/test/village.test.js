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
  const sells=run(`G.traders.map(t=>t.sells).join()`);assert.strictEqual(sells,'weapons,gear,potions,food,inn');
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
  run(`const q=G.points[1];pl.x=q.x;pl.y=q.y+20;`);step(run,.1);
  assert.strictEqual(run(`JSON.stringify(S.points)`),'{"2":[1]}');
  run(`S.cp=1;S.cpFloor=2;const p2=makePlayer(2,S);G.players=[p2];setPlayer(p2);`);
  assert.strictEqual(run(`safeIndex(P.x,P.y)`),1,'arriving at that safe point');
});

test('the stash is one store behind every chest: put away in the tower, take out at the inn',()=>{
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');s.inv.push(randomItem(1,0),randomItem(1,0));setWorld(genFloor(1,3));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  assert.strictEqual(run(`G.smiths.length`),0,'no blacksmith in the tower');
  assert.strictEqual(run(`G.stashes.length`),run(`G.traders.length`),'a stash chest by every trader');
  run(`pl.x+=300;`);assert.strictEqual(run(`runAction('stash',[0])`),false,'only at a stash chest');
  run(`const q=G.stashes[1];pl.x=q.x;pl.y=q.y+8;`);
  assert.strictEqual(run(`runAction('stash',[0])`),0);
  assert.strictEqual(run(`[S.inv.length,S.stash.length].join()`),'1,1');
  run(`const S0=S;setWorld(genVillage());const p2=makePlayer(1,S0);G.players=[p2];setPlayer(p2);const q=G.stashes[0];p2.x=q.x;p2.y=q.y+8;`);
  assert.strictEqual(run(`runAction('unstash',[0])`),1);
  assert.strictEqual(run(`[S.inv.length,S.stash.length].join()`),'2,0');
});

test('a drunk flask stays as an empty one, and the well fills empties for free',()=>{
  const run=village();
  run(`pl.drink=10;S.flasks=2;S.empties=0;drink();`);
  assert.strictEqual(run(`[S.flasks,S.empties].join()`),'1,1');
  assert.strictEqual(run(`runAction('fillFlasks',[])`),false,'only at the well');
  run(`const w=G.wells[0];pl.x=w.x;pl.y=w.y+10;S.shards=7;`);
  assert.strictEqual(run(`runAction('fillFlasks',[])`),1);
  assert.strictEqual(run(`[S.flasks,S.empties,S.shards].join()`),'2,0,7');
  assert.strictEqual(run(`runAction('fillFlasks',[])`),false,'nothing left to fill');
});

test('the inn serves meals: they fill you up, cost shards, and leave a buff that slows hunger',()=>{
  const run=village();
  run(`const k=G.traders.findIndex(t=>t.sells==='inn');globalThis.inn=k;pl.x=G.traders[k].x;pl.y=G.traders[k].y+16;pl.food=20;pl.drink=30;S.shards=100;`);
  assert.strictEqual(run(`runAction('eatMeal',[inn,'stew'])`),true);
  assert.strictEqual(run(`[pl.food,pl.drink,S.shards,pl.buff.id,pl.buff.t].join()`),'100,50,85,fed,1200');
  assert.strictEqual(run(`runAction('eatMeal',[0,'stew'])`),false,'only the innkeeper serves meals');
  run(`S.shards=5;`);assert.strictEqual(run(`runAction('eatMeal',[inn,'roast'])`),false,'not without the shards');
  // on a floor, well fed: hunger drains half as fast
  const R=loadRules(),f=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genFloor(1,7));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);pl.buff={id:'fed',t:600};`,R);
  f(`for(let i=0;i<1800;i++){pl.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);
  assert.ok(Math.abs(f(`pl.food`)-(100-100/25/2))<.2,'half the usual drain');
  assert.ok(Math.abs(f(`pl.buff.t`)-540)<.5,'the buff counts down');
});

test('the training yard is the one place in the village to fight: scarecrows take hits and never fall',()=>{
  const run=village();
  assert.strictEqual(run(`G.enemies.length`),3);assert.ok(run(`G.enemies.every(e=>e.type==='dummy')`));
  step(run,.2);assert.ok(run(`pl.safe`),'the square is safe');
  run(`const e=G.enemies[0];pl.x=e.x;pl.y=e.y+14;pl.dir=1;`);step(run,.1);
  assert.ok(!run(`pl.safe`),'the yard is not');
  run(`globalThis.d0=G.enemies[0].hp;hitArc(DIR_ANGLE[1],120,30,1,{melee:true});`);   // a real swing, facing it
  assert.ok(run(`G.enemies[0].hp<d0`),'the swing lands');
  run(`for(let i=0;i<20;i++)damageEnemy(G.enemies[0],1e4);`);
  assert.ok(run(`!G.enemies[0].dead`),'and it never falls');
  step(run,5);
  assert.strictEqual(run(`G.enemies[0].hp===G.enemies[0].maxHp`),true,'whole again once left alone');
  assert.strictEqual(run(`[G.enemies[0].x===vx(VILLAGE.scarecrows[0][0]),pl.hp===pl.ST.maxHp].join()`),'true,true','it never moves or strikes back');
});

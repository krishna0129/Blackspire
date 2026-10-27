'use strict';
// Fatigue, the inn's rooms, sleeping bags, campfires, breakfast and the barkeep (FATIGUE in data.js, actions.js),
// run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function world(n=0){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(${n?`genFloor(${n},7)`:'genVillage()'});const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);G.enemies=G.enemies.filter(e=>e.boss);
    function atInn(){const i=G.traders.findIndex(t=>TRADER_SELLS[t.sells].meals);P.x=G.traders[i].x;P.y=G.traders[i].y+8;return i;}
    function play(sec){for(let t=0;t<sec;t+=1){P.in={mx:0,my:0,atk:false,block:false};P.food=P.drink=100;simUpdate(1);}}`,R);
  return run;
}

test('fatigue grows with play, and each tier slows skills, feet, dodging and mana',()=>{
  const run=world(1);
  const base=JSON.parse(run(`JSON.stringify({cd:ST.cdMult,move:ST.move,evade:ST.evade,mp:ST.mpRegen})`));
  assert.strictEqual(base.cd,1);
  run(`play(30);`);
  assert.ok(run(`P.fat`)>=29&&run(`P.fat`)<=31,'thirty seconds of play');
  run(`P.fat=2*3600-1;play(2);`);
  assert.strictEqual(run(`FATIGUE[ST.fatigue].name`),'Weary');
  assert.strictEqual(run(`ST.cdMult`),1.1);
  run(`P.fat=6*3600;calcStats();`);
  assert.strictEqual(run(`FATIGUE[ST.fatigue].name`),'Exhausted');
  assert.ok(Math.abs(run(`ST.move`)/base.move-.85)<.01,'15% slower');
  assert.ok(Math.abs(run(`ST.mpRegen`)/base.mp-.6)<.01,'mana 40% slower');
  run(`P.fat=FATIGUE_MAX;play(5);`);
  assert.strictEqual(run(`P.fat`),7*3600,'it stops at seven hours');
  assert.ok(run(`P.mp=0;P.skillCd=0;useSkill();true`)!==undefined);
});

test('a room at the inn: rented for the day, slept in for a clean slate and a well-rested bonus, and logging off in it counts',()=>{
  const run=world(0);
  run(`S.shards=500;S.char.level=5;P.fat=5*3600;calcStats();`);
  const i=run(`atInn()`);
  assert.strictEqual(run(`runAction('enterRoom',[${i}])`),false,'not rented yet');
  assert.strictEqual(run(`runAction('rentRoom',[${i}])`),true);
  assert.strictEqual(run(`S.shards`),500-run(`roomPrice(5)`));
  assert.strictEqual(run(`runAction('rentRoom',[${i}])`),false,'already yours today');
  assert.strictEqual(run(`runAction('enterRoom',[${i}])`),true);
  run(`play(60);`);
  assert.strictEqual(run(`P.fat`),5*3600,'no fatigue while in the room');
  assert.ok(run(`!!nearStash()`),'the stash is in the room');
  assert.strictEqual(run(`runAction('sleep',[])`),true);
  assert.strictEqual(run(`P.fat+'|'+P.rested+'|'+FATIGUE[ST.fatigue].name`),`0|${3600}|Rested`);
  run(`runAction('leaveRoom',[]);S.char.xp=0;gainXp(100);`);
  assert.strictEqual(run(`S.char.xp`),110,'well rested: 10% more experience');
  // breakfast, only just after waking
  assert.strictEqual(run(`runAction('eatMeal',[${i},'breakfast'])`),true);
  run(`P.awake=BREAKFAST_WINDOW+1;`);
  assert.strictEqual(run(`runAction('eatMeal',[${i},'breakfast'])`),false,'too late for breakfast');
  // logging off in the room is a night's sleep
  run(`P.fat=3*3600;runAction('enterRoom',[${i}]);storeNeeds(P);const p2=makePlayer(1,S);G.players=[p2];setPlayer(p2);`);
  assert.strictEqual(run(`P.fat+'|'+P.rested+'|'+S.inRoom`),'0|3600|false');
});

test('a sleeping bag clears fatigue in a safe room, without the bonus; a campfire takes half, once an hour',()=>{
  const run=world(1);
  run(`S.bags=1;P.fat=4*3600;P.safe=false;`);
  assert.strictEqual(run(`runAction('sleepBag',[])`),false,'not out in the open');
  run(`P.safe=true;`);
  assert.strictEqual(run(`runAction('sleepBag',[])`),true);
  assert.strictEqual(run(`P.fat+'|'+P.rested+'|'+S.bags`),'0|0|0');
  assert.ok(run(`TRADER_SELLS.food.supplies.includes('bag')`),'sold at the food and drink stall');
  run(`const f=G.fires[0];P.x=f.x+10;P.y=f.y;P.fat=4000;`);
  assert.strictEqual(run(`runAction('restFire',[])`),true);
  assert.strictEqual(run(`P.fat`),2000);
  assert.strictEqual(run(`runAction('restFire',[])`),false,'once an hour of play');
  run(`P.fireCd=0;P.x=-500;`);
  assert.strictEqual(run(`runAction('restFire',[])`),false,'only by the fire');
});

test('the barkeep tells his rumours in turn',()=>{
  const run=world(0);
  run(`const b=G.talkers.find(t=>t.rumours);P.x=b.x;P.y=b.y+8;`);
  assert.strictEqual(run(`runAction('rumour',[])`),0);
  assert.strictEqual(run(`runAction('rumour',[])`),1);
  assert.ok(run(`RUMOURS.length`)>=6);
});

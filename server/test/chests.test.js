'use strict';
// Which chests a character has opened is kept by their place on a floor's layout (js/sim/rules.js, claimChests).
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

test('opened chests belong to the layout they were opened on',()=>{
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');
    const on=seed=>{setWorld(genFloor(1,seed));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);};
    const openAll=()=>{for(const c of G.chests){P.x=c.x;P.y=c.y;P.hp=P.ST.maxHp;simUpdate(1/30);}};
    const opened=()=>s.floors[1].chests.length;`,R);
  run(`on(s.seed);openAll();`);
  const n=run(`G.chests.length`);assert.ok(n>0,'the floor has chests');
  assert.strictEqual(run(`opened()`),n);
  run(`on(s.seed);`);assert.strictEqual(run(`opened()`),n,'the same layout again: they stay opened');
  run(`on(s.seed+1);`);assert.strictEqual(run(`opened()`),0,'another layout of the floor: none of its chests is opened');
  run(`openAll();on(s.seed+1);`);assert.strictEqual(run(`opened()`),run(`G.chests.length`),'and what is opened there stays opened there');
  // saves from before the layout was recorded
  run(`on(s.seed);openAll();delete s.floors[1].seed;on(s.seed);`);
  assert.strictEqual(run(`opened()`),n,'an old single-player save, made on the character’s own seed, keeps its opened chests');
  run(`delete s.floors[1].seed;on(s.seed+1);`);
  assert.strictEqual(run(`opened()`),0,'an old online character, whose list came from other layouts, starts again');
});

'use strict';
// The Bone Regent (js/sim/regent.js, docs/design/bosses.md): the shield wall, the blow to parry, the call, the broken
// throne, and the reset when everyone falls. Run headless, as the server runs the rules.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function world(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`setWorld(genFloor(2,7));const pl=makePlayer(1,newState('T',{},'sword','#222','duelist'));G.players=[pl];setPlayer(pl);
    const b=G.bossEnt,room=G.boss;G.enemies=[b];b.x=(room.x+room.w/2)*TILE;b.y=(room.y+room.h/2)*TILE;pl.x=b.x+40;pl.y=b.y;pl.safe=false;pl.locked=true;wakeBoss();
    function step(t,keep){for(let i=0;i<Math.round(t*30);i++){pl.in={mx:0,my:0,atk:false,block:false,aim:Math.atan2(b.y-pl.y,b.x-pl.x)};pl.aim=pl.in.aim;if(keep)pl.hp=pl.ST.maxHp;simUpdate(1/30);}setPlayer(pl);}
    function quiet(){wAbort(b);b.atkT=99;b.stun=0;b.staggerT=0;G.tele.length=0;}`,R);
  return run;
}

test('the shield wall: from the front almost nothing gets through; from behind, or while it strikes, everything does',()=>{
  const run=world();
  assert.strictEqual(run(`b.ai`),'regent');assert.ok(run(`b.maxHp`)>=run(`ETYPES.boss.hp`)*10,'a long fight');
  run(`quiet();b.aimA=0;step(.1,1);`);assert.strictEqual(run(`b.guard`),true);
  assert.strictEqual(run(`regentGuard(b,{fx:b.x+40,fy:b.y})`),run(`REGENT.guard.take`),'from the front');
  assert.strictEqual(run(`regentGuard(b,{fx:b.x-40,fy:b.y})`),1,'from behind');
  run(`quiet();rSwing(b);`);assert.strictEqual(run(`b.guard&&b.state!=='act'`),false);
  run(`b.guard=false;`);assert.strictEqual(run(`regentGuard(b,{fx:b.x+40,fy:b.y})`),1,'its own blow is your opening');
});

test('the overhead strike: parried, it reels with its shield down and its poise cracks',()=>{
  const run=world();
  run(`quiet();b.aimA=0;P.hp=ST.maxHp=1e5;rStrike(b);step(REGENT.strike.wind-.1);P.parryAt=G.time;globalThis.h0=P.hp;step(.2);`);
  assert.strictEqual(run(`P.hp`),run(`h0`));assert.ok(run(`b.stun`)>2);assert.strictEqual(run(`b.guard`),false);
  assert.ok(run(`b.poise`)<run(`b.maxPoise*.75`));
  assert.strictEqual(run(`regentGuard(b,{fx:b.x+40,fy:b.y})`),1,'open from the front while it reels');
});

test('phases: at 70% it calls its guard, open while it calls; at 35% the shield breaks and the floor erupts',()=>{
  const run=world();
  run(`quiet();b.hp=b.maxHp*.69;step(.2,1);`);assert.strictEqual(run(`b.phase`),2);assert.strictEqual(run(`b.immune`),true);
  run(`step(2.6,1);`);assert.strictEqual(run(`b.act`),'summon');assert.strictEqual(run(`b.mres`),0,'its ward is down as it calls');assert.strictEqual(run(`b.guard`),false);
  run(`step(REGENT.call.wind+.2,1);`);assert.strictEqual(run(`G.enemies.filter(e=>e.summoned&&!e.dead).length`),2);assert.ok(run(`b.mres`)>0);
  run(`G.enemies=[b];quiet();b.hp=b.maxHp*.34;step(.2,1);step(2.6,1);`);
  assert.strictEqual(run(`b.phase`),3);assert.strictEqual(run(`b.shield`),false);
  run(`quiet();step(.2,1);`);assert.strictEqual(run(`b.guard`),false,'no wall without a shield');
  run(`quiet();rRings(b);`);assert.ok(run(`G.tele.length`)>=2);
  run(`P.x=b.x+62;P.y=b.y;P.hp=ST.maxHp=1e5;step(REGENT.rings.wind+.1);`);assert.strictEqual(run(`P.hp`),1e5,'the gap between the rings is safe');
});

test('everyone falls: the Regent is whole again, shield and all, and its guard is gone',()=>{
  const run=world();
  run(`quiet();b.hp=b.maxHp*.3;step(.2,1);step(2.6,1);step(REGENT.call.wind+3,1);`);
  run(`P.locked=false;P.dead=true;step(.1);`);
  assert.strictEqual(run(`G.bossAwake`),false);assert.strictEqual(run(`b.hp`),run(`b.maxHp`));assert.strictEqual(run(`b.shield`),true);
  assert.strictEqual(run(`G.enemies.filter(e=>e.summoned).length`),0);
});

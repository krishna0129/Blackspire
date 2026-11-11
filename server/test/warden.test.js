'use strict';
// The Gate Warden (js/sim/warden.js, docs/design/bosses.md): its health, its phases, the blow to parry, the echo
// and the reset when everyone falls. Run headless, as the server runs the rules.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

// one Duelist in the Warden's chamber, the Warden awake; step(t) runs the world with the player standing still
function world(n=1){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`setWorld(genFloor(1,7));const pls=[];for(let i=0;i<${n};i++){const pl=makePlayer(i+1,newState('T'+i,{},'sword','#222','duelist'));pls.push(pl);}
    G.players=pls;const pl=pls[0];setPlayer(pl);const b=G.bossEnt,room=G.boss;G.enemies=[b];
    b.x=(room.x+room.w/2)*TILE;b.y=(room.y+room.h/2)*TILE;pls.forEach((q,i)=>{q.x=b.x+40;q.y=b.y+i*14;q.safe=false;q.locked=true;});
    const base=b.maxHp;wakeBoss();
    function step(t,keep){for(let i=0;i<Math.round(t*30);i++){for(const q of G.players){q.in={mx:0,my:0,atk:false,block:false,aim:Math.atan2(b.y-q.y,b.x-q.x)};q.aim=q.in.aim;if(keep)q.hp=q.ST.maxHp;}simUpdate(1/30);}setPlayer(pl);}
    function quiet(){wAbort(b);b.atkT=99;b.stun=0;b.staggerT=0;G.tele.length=0;}`,R);
  return run;
}

test('the Warden is a long fight: many times a common boss\'s health, and 80% more for each player after the first',()=>{
  const one=world(1),two=world(2);
  assert.ok(one(`b.maxHp`)>=one(`ETYPES.boss.hp`)*10,'solo health');
  assert.strictEqual(one(`b.maxHp`),one(`base`));
  assert.strictEqual(two(`b.maxHp`),Math.round(two(`base`)*1.8));
  assert.strictEqual(one(`b.maxPoise`),one(`b.maxHp*WARDEN.poise`),'its own poise: a share of its health');
});

test('phases: at 70% it roars, untouchable, and the chains begin; at 35% it splits, and the echo shields it',()=>{
  const run=world();
  run(`quiet();b.hp=b.maxHp*.69;step(.2,1);`);
  assert.strictEqual(run(`b.phase`),2);assert.strictEqual(run(`b.immune`),true);
  const hp=run(`b.hp`);assert.strictEqual(run(`damageEnemy(b,5,{})`),false,'nothing touches it mid-roar');assert.strictEqual(run(`b.hp`),hp);
  run(`step(2.4,1);`);assert.strictEqual(run(`b.immune`),false);
  run(`quiet();b.hp=b.maxHp*.34;step(.2,1);step(2.4,1);`);
  assert.strictEqual(run(`b.phase`),3);assert.strictEqual(run(`b.split`),true);
  assert.strictEqual(run(`G.enemies.filter(e=>e.echo&&!e.dead).length`),1,'the echo stands');
  assert.strictEqual(run(`wardenShield(b)`),run(`1-WARDEN.echo.shield`));
  // break the true one's poise: the echo shatters for good, and the shield with it
  run(`quiet();wearPoise(b,b.maxPoise+1);`);
  assert.strictEqual(run(`b.split`),false);assert.strictEqual(run(`G.enemies.filter(e=>e.echo&&!e.dead).length`),0);assert.strictEqual(run(`wardenShield(b)`),1);
});

test('the cleave: unparried it hits hard; parried, the Warden reels for seconds and its poise cracks',()=>{
  const run=world();
  run(`quiet();P.hp=ST.maxHp=1e5;wCleave(b);step(WARDEN.cleave.wind+.1);`);
  assert.ok(run(`ST.maxHp-P.hp`)>=run(`b.dmg*WARDEN.cleave.dmg*.3`),'it landed');
  assert.ok(!(run(`b.stun`)>1),'and it is not stunned');
  run(`quiet();b.poise=b.maxPoise;P.hp=ST.maxHp;P.inv=0;P.sta=ST.maxSta||100;wCleave(b);step(WARDEN.cleave.wind-.1);
    const h=P.hp;P.parryAt=G.time;globalThis.h0=h;step(.2);`);
  assert.strictEqual(run(`P.hp`),run(`h0`),'the parry takes the blow');
  assert.ok(run(`b.stun`)>2,'the opening');assert.strictEqual(run(`b.act`),'reel');
  assert.ok(run(`b.poise`)<run(`b.maxPoise*.75`),'its poise cracks');
});

test('marked attacks land where they were marked, when they were marked',()=>{
  const run=world();
  run(`quiet();P.hp=ST.maxHp=1e5;P.x=b.x+80;P.y=b.y;wLeap(b);`);
  assert.strictEqual(run(`G.tele.length`),1);assert.ok(Math.abs(run(`G.tele[0].x-P.x`))<12,'the mark is on you');
  run(`step(WARDEN.leap.wind*.5);`);const hp=run(`P.hp`);assert.strictEqual(hp,1e5,'not yet');
  run(`step(WARDEN.leap.wind*.5+.1);`);assert.ok(run(`P.hp`)<1e5,'it comes down');assert.ok(run(`hyp(b.x-P.x,b.y-P.y)`)<20,'on the mark');
  // step off the mark and it misses
  run(`quiet();P.hp=1e5;P.inv=0;b.x=P.x-80;wLeap(b);P.x-=70;step(WARDEN.leap.wind+.1);`);assert.strictEqual(run(`P.hp`),1e5);
});

test('everyone falls: the Warden is whole again, in its first phase, alone',()=>{
  const run=world();
  run(`quiet();b.hp=b.maxHp*.3;step(.2,1);step(2.6,1);step(2.8,1);`);assert.strictEqual(run(`b.split`),true);
  run(`P.locked=false;P.dead=true;step(.1);`);
  assert.strictEqual(run(`G.bossAwake`),false);assert.strictEqual(run(`b.hp`),run(`b.maxHp`));
  assert.strictEqual(run(`G.enemies.filter(e=>e.echo).length`),0);assert.ok(!run(`b.split`)&&!run(`b.immune`)&&!run(`b.gone`));
  run(`P.dead=false;P.locked=true;wakeBoss();`);assert.strictEqual(run(`b.phase`),1);
});

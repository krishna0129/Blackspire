'use strict';
// Floor 3's rules (js/sim/floor3.js and the hooks in combat.js / update.js), run headless in the same sandbox the
// server uses. Each test builds its own floor so they do not depend on each other.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

// A fresh sandbox with floor 3 built from a fixed seed and one levelled player in it. Returns a runner for code.
function floor3(seed=4242){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`Math.random=mulberry32(${seed}^0x5bd1e995);`,R);   // the AI rolls dice: seed them so every run plays out the same
  // at the sandbox's top level, so later snippets (each in its own block) can use pl
  vm.runInContext(`const s=newState('T',{},'great','#222');s.char.level=14;setWorld(genFloor(3,${seed}));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);
    {const r=G.rooms.filter(q=>q.kind==='room').sort((a,b)=>b.w*b.h-a.w*a.h)[0];pl.x=(r.x+r.w/2)*TILE;pl.y=(r.y+r.h/2)*TILE;pl.safe=false;}`,R);   // out of the safe start room
  return run;
}
const step=(run,n)=>run(`for(let i=0;i<${n};i++){for(const q of G.players)q.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);

test('floor 3 spawns its own cast, thorn patches and a boss with bodies in its chamber',()=>{
  const run=floor3();
  const types=run(`[...new Set(G.enemies.map(e=>e.type))].sort().join(',')`);
  for(const t of['thrall','gravecaller','hermit','bloodbloom','thornroot'])assert.ok(types.includes(t),t+' spawns');
  assert.ok(run(`G.thorns.reduce((a,b)=>a+b,0)`)>0);
  assert.strictEqual(run(`G.bossEnt.name`),'The Pale Collector');
  assert.strictEqual(run(`G.corpses.filter(c=>c.arena).length`),6);
});

test('floors 1 and 2 are generated exactly as before the floors table',()=>{
  const R=loadRules();
  const sig=n=>vm.runInContext(`{const g=genFloor(${n},99);g.rooms.map(r=>r.x+','+r.y).join(';')+'|'+g.chests.length+'|'+g.enemies.length+'|'+(g.thorns?1:0)}`,R);
  // recorded from main before the floors table existed: same rooms, same chests, same enemies, no thorns
  assert.strictEqual(sig(1),'4,54;63,6;31,33;76,14;73,47;48,44;12,3;35,68;55,20;17,28;66,59;33,55;67,35;78,54;21,17;37,19;5,44;17,56;99,20;92,23|7|79|0');
  assert.strictEqual(sig(2),'9,31;23,11;67,41;55,22;3,66;66,71;5,43;55,4;68,55;46,43;70,13;15,46;31,68;20,31;40,16;39,23;68,26;39,53;41,6;100,52;93,55|3|78|0');
});

test('a thrall leaves a body; a Gravecaller raises it at half health, and the raised give nothing',()=>{
  const run=floor3();
  run(`const th=G.enemies.find(e=>e.type==='thrall');killEnemy(th);`);
  assert.strictEqual(run(`G.corpses.filter(c=>!c.arena).length`),1);
  run(`const gc=G.enemies.find(e=>e.type==='gravecaller'),c=G.corpses.find(c=>!c.arena);G.enemies=[gc,G.bossEnt];
    gc.x=c.x+40;gc.y=c.y;gc.state='chase';gc.raiseCd=0;pl.x=gc.x+100;pl.y=gc.y;`);
  step(run,60);
  assert.ok(run(`(()=>{const r=G.enemies.find(e=>e.raised);return!!r&&r.hp===Math.round(r.maxHp*.5);})()`),'raised at half health');
  assert.ok(run(`(()=>{const xp=S.char.xp,d=G.drops.length,r=G.enemies.find(e=>e.raised);killEnemy(r);return S.char.xp===xp&&G.drops.length===d;})()`),'no experience, no loot');
});

test('any hit breaks a Gravecaller\'s channel',()=>{
  const run=floor3();
  run(`const gc=G.enemies.find(e=>e.type==='gravecaller');G.enemies=[gc,G.bossEnt];G.corpses.push({x:gc.x+20,y:gc.y,t:9});gc.state='chase';gc.raiseCd=0;pl.x=gc.x+90;pl.y=gc.y;`);
  step(run,2);
  assert.strictEqual(run(`G.enemies[0].state`),'channel');
  run(`setPlayer(pl);damageEnemy(G.enemies[0],.01);`);
  assert.notStrictEqual(run(`G.enemies[0].state`),'channel');
});

test('fire burns bodies and does double damage to Thornroots',()=>{
  const run=floor3();
  run(`G.corpses.push({x:pl.x+50,y:pl.y,t:9});explode(pl.x+50,pl.y);`);
  assert.ok(run(`!G.corpses.some(c=>!c.arena)`),'burned');
  const ratio=run(`(()=>{const t=G.enemies.find(e=>e.type==='thornroot');t.hp=t.maxHp=1e7;ST.crit=0;const a=t.hp;damageEnemy(t,1,{});const n=a-t.hp,b=t.hp;damageEnemy(t,1,{burn:true});return(b-t.hp)/n;})()`);
  assert.ok(ratio>1.6&&ratio<2.5,'about double: '+ratio);
});

test('an Ossuary hermit cannot be hit while burrowed, bursts up under you, then fights in its shell',()=>{
  const run=floor3();
  run(`const he=G.enemies.find(e=>e.type==='hermit');G.enemies=[he,G.bossEnt];he.x=pl.x+60;he.y=pl.y;he.state='chase';pl.hp=1e6;god=false;`);
  const seen=new Set();let hitWhileBurrowed=null;
  for(let i=0;i<200;i++){step(run,1);const st=run(`G.enemies[0].state`);seen.add(st);
    if(st==='burrowed'&&hitWhileBurrowed===null)hitWhileBurrowed=run(`damageEnemy(G.enemies[0],1)`);}
  assert.strictEqual(hitWhileBurrowed,false);
  for(const st of['burrowed','emerge','exposed','shell'])assert.ok(seen.has(st),st);
  assert.ok(run(`pl.hp<1e6`),'the burst hurts');
});

test('thorn patches slow and prick; a Bloodbloom heals the enemies around it',()=>{
  const run=floor3();
  run(`const i=G.thorns.findIndex(v=>v);pl.x=(i%MW+.5)*TILE;pl.y=(Math.floor(i/MW)+.5)*TILE;G.enemies=[G.bossEnt];pl.hp=500;`);
  step(run,30);
  assert.ok(run(`pl.hp<500`),'pricked');
  run(`const bb=makeEnemy('bloodbloom',pl.x+300,pl.y,1,1,false),m=makeEnemy('thrall',bb.x+20,bb.y,1,1,false);m.hp=10;m.state=bb.state='chase';bb.fire=0;G.enemies=[bb,m,G.bossEnt];pl.x=bb.x+40;pl.y=bb.y;pl.safe=false;`);
  step(run,1);
  assert.ok(run(`G.enemies[1].hp>10`),'healed');
});

test('the Pale Collector: raised thralls walk to it and heal it; the lantern beam stops at walls; a reset restores the bodies',()=>{
  const run=floor3(77);
  run(`god=true;enterChamber(G.gates[1]);G.enemies=[G.bossEnt];G.bossEnt.hp=G.bossEnt.maxHp*.5;`);
  const h0=run(`G.bossEnt.hp`);let beam=false;
  for(let i=0;i<40;i++){step(run,30);if(run(`!!(G.beams&&G.beams.length)`))beam=true;}
  assert.ok(run(`G.bossEnt.hp`)>h0,'collection heals it');
  assert.ok(beam,'phase 2 sweeps');
  assert.ok(run(`beamReach(G.bossEnt.x,G.bossEnt.y,0,1000)<1000`),'beams stop at walls');
  run(`pl.dead=true;`);step(run,2);
  assert.strictEqual(run(`G.corpses.filter(c=>c.arena).length`),6,'bodies back after a reset');
  assert.strictEqual(run(`G.bossEnt.hp===G.bossEnt.maxHp`),true);
});

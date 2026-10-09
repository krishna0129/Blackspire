'use strict';
// The Adventurers' Guild: the daily quest board (js/sim/quests.js), run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function village(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genVillage());const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);
    globalThis.atGuild=()=>{pl.x=G.guild.x;pl.y=G.guild.y+14;};globalThis.away=()=>{pl.x=G.home.x;pl.y=G.home.y;};`,R);
  return{R,run};
}

test('one board a day, the same for everyone: three hunts, two deliveries and a bounty',()=>{
  const {run}=village();
  const a=run(`JSON.stringify(questBoard(20000))`),b=run(`JSON.stringify(questBoard(20000))`),c=run(`JSON.stringify(questBoard(20001))`);
  assert.strictEqual(a,b,'built from the day alone');assert.notStrictEqual(a,c,'a new day, a new board');
  assert.strictEqual(run(`questBoard(20000).map(q=>q.kind).join()`),'hunt,hunt,hunt,deliver,deliver,boss');
  assert.ok(run(`questBoard(20000).filter(q=>q.kind==='hunt').every(q=>FLOORS[q.f-1].spawns.includes(q.type))`),'hunts name a floor the enemy is on');
});

test('take a hunt at the guild, kill your way through it, hand it in for the reward',()=>{
  const {run}=village();
  run(`globalThis.q=questBoard(questDay())[0];away();`);
  assert.strictEqual(run(`runAction('takeQuest',[q.id])`),false,'only at the guild');
  run(`atGuild();`);assert.strictEqual(run(`runAction('takeQuest',[q.id])`),true);
  assert.strictEqual(run(`runAction('handIn',[q.id])`),false,'not until it is done');
  // the kills happen on the quest's floor
  run(`globalThis.S0=S;setWorld(genFloor(q.f,7));const p2=makePlayer(1,S0);G.players=[p2];setPlayer(p2);
    for(let i=0;i<q.n+2;i++)killEnemy(makeEnemy(q.type,p2.x,p2.y,1,1,false));`);
  assert.strictEqual(run(`questLog().active[q.id]`),run(`q.n`),'counts up to what is asked, and no further');
  run(`setWorld(genVillage());const p3=makePlayer(1,S0);G.players=[p3];setPlayer(p3);p3.x=G.guild.x;p3.y=G.guild.y+14;globalThis.sh=S.shards;`);
  assert.strictEqual(run(`runAction('handIn',[q.id])`),true);
  assert.strictEqual(run(`S.shards-sh`),run(`q.reward.shards`));
  assert.ok(run(`questLog().done.includes(q.id)&&!(q.id in questLog().active)`));
  assert.strictEqual(run(`runAction('takeQuest',[q.id])`),false,'a handed-in quest is not on offer again today');
});

test('a delivery takes the materials when handed in; at most three quests at once',()=>{
  const {run}=village();
  run(`atGuild();globalThis.B=questBoard(questDay());globalThis.d=B.find(x=>x.kind==='deliver');S.mats[d.mat]=d.n+1;`);
  assert.strictEqual(run(`runAction('takeQuest',[d.id])`),true);
  assert.strictEqual(run(`runAction('handIn',[d.id])`),true);
  assert.strictEqual(run(`S.mats[d.mat]`),1,'it took exactly what was asked');
  run(`for(const x of B.filter(x=>x.kind==='hunt'))runAction('takeQuest',[x.id]);`);
  assert.strictEqual(run(`Object.keys(questLog().active).length`),3);
  assert.strictEqual(run(`runAction('takeQuest',[B[5].id])`),false,'three is the limit');
  assert.strictEqual(run(`runAction('dropQuest',[B[0].id])`),true);
  assert.strictEqual(run(`runAction('takeQuest',[B[5].id])`),true,'giving one up frees a place');
});

test('a bounty counts only the named floor’s boss; the board refreshes at midnight and takes everything with it',()=>{
  const {run}=village();
  run(`atGuild();globalThis.b=questBoard(questDay())[5];runAction('takeQuest',[b.id]);
    globalThis.S0=S;setWorld(genFloor(b.f===1?2:1,3));const p2=makePlayer(1,S0);G.players=[p2];setPlayer(p2);G.bossEnt.hp=0;killEnemy(G.bossEnt);`);
  assert.strictEqual(run(`questLog().active[b.id]`),0,'another floor’s boss does not count');
  run(`setWorld(genFloor(b.f,3));const p3=makePlayer(1,S0);G.players=[p3];setPlayer(p3);killEnemy(G.bossEnt);`);
  assert.strictEqual(run(`questLog().active[b.id]`),1);
  run(`S.quests.day--;`);   // as if the board had refreshed since
  assert.strictEqual(run(`Object.keys(questLog().active).length`),0,'finished or not, it is gone');
});

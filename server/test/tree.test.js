'use strict';
// The skill tree (js/sim/tree.js), tags and damage types (data.js, combat.js), and the balance runner (tools/balance.js),
// run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {loadRules}=require('../game');
const plain=v=>JSON.parse(JSON.stringify(v));

function world(wkey='sword',n=1){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'${wkey}','#222');setWorld(genFloor(${n},7));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);G.enemies=G.enemies.filter(e=>e.boss);
    function foe(type){const e=makeEnemy(type,P.x+12,P.y,1,1,false);e.maxHp=e.hp=1e9;e.state='chase';G.enemies.push(e);return e;}
    function hit(e,o){ST.crit=0;let t=0;for(let i=0;i<200;i++){const h=e.hp;damageEnemy(e,1,Object.assign({crit:false,noProc:true},o));t+=h-e.hp;}return t/200;}`,R);
  return run;
}

test('the tree is one web: links go both ways, every node can be reached from a start, each start has three skills that branch in two',()=>{
  const run=world();
  assert.deepStrictEqual(plain(run(`Object.values(TREE).filter(q=>q.to.some(t=>!TREE[t]||!TREE[t].to.includes(q.id))).map(q=>q.id)`)),[],'links are mutual');
  assert.ok(run(`(()=>{const seen=new Set(TREE_STARTS),todo=[...TREE_STARTS];while(todo.length)for(const t of TREE[todo.pop()].to)if(!seen.has(t)){seen.add(t);todo.push(t);}return seen.size===Object.keys(TREE).length;})()`),'all connected');
  for(const w of run(`TREE_STARTS`)){
    const skills=plain(run(`Object.values(TREE).filter(q=>q.k==='skill'&&q.id.startsWith('${w}.'))`));
    assert.strictEqual(skills.length,3,w);
    for(const q of skills)assert.strictEqual(q.to.filter(t=>run(`TREE['${t}'].k`)==='adv').length,2,q.name);}
  const n=run(`Object.keys(TREE).length`);assert.ok(n>=180&&n<=220,`about 200 nodes, ${n}`);
  assert.deepStrictEqual(plain(run(`Object.values(TREE).filter(q=>q.fx&&q.fx.inc&&Object.keys(q.fx.inc).some(t=>!TAGS[t])).map(q=>q.id)`)),[],'nodes only name real tags');
  assert.deepStrictEqual(plain(run(`Object.values(TREE).filter(q=>q.fx&&q.fx.res&&Object.keys(q.fx.res).some(t=>!DTYPES[t])).map(q=>q.id)`)),[],'and real damage types');
  assert.ok(run(`Object.values(TREE).every(q=>q.k==='start'||q.soon||treeDesc(q).length>5)`),'every node says what it does');
});

test('points: one a level and one a first boss kill; nodes are taken next to what you own, from the start you build from',()=>{
  const run=world();
  assert.strictEqual(run(`treeLeft(S)`),0,'level 1, no boss: nothing to spend');
  run(`S.char.level=4;S.floors[1]={chests:[],shops:[],boss:2};S.floors[2]={chests:[],shops:[],boss:0};`);
  assert.strictEqual(run(`treeEarned(S)`),4,'3 levels and one boss beaten (however many times)');
  assert.strictEqual(run(`runAction('treeTake',['spear.in510'])`),false,'not next to the longsword start');
  assert.strictEqual(run(`runAction('treeTake',['sword.in330'])`),false,'not next to anything owned');
  assert.strictEqual(run(`runAction('treeTake',['sword.b0.skill'])`),false,'skills to come cannot be taken');
  assert.strictEqual(run(`runAction('treeTake',['sword.in510'])`),true);
  assert.strictEqual(run(`S.treeStart`),'sword','the first point fixes the start');
  assert.strictEqual(run(`runAction('treeTake',['sword.in420'])&&runAction('treeTake',['sword.in330'])&&runAction('treeTake',['sword.sp55'])`),true);
  assert.strictEqual(run(`runAction('treeTake',['sword.sp95'])`),false,'out of points');
  // a new weapon does not move the start once points are spent
  run(`S.equip.weapon=makeWeapon('bow',1,0);calcStats();`);
  assert.strictEqual(run(`treeStart(S)`),'sword');
  // reset: somewhere safe, for shards
  run(`P.safe=false;S.shards=1e4;`);
  assert.strictEqual(run(`runAction('treeReset',[])`),false,'not in the open');
  run(`P.safe=true;`);const cost=run(`treeResetCost(S)`);
  assert.strictEqual(run(`runAction('treeReset',[])`),true);
  assert.strictEqual(run(`S.shards`),1e4-cost);
  assert.strictEqual(run(`S.tree.length+'|'+treeStart(S)`),'0|bow','empty, and the next point builds from the weapon now carried');
});

test('nodes add up into the stats, and "increased damage" counts only for hits with that tag',()=>{
  const run=world();
  const base=plain(run(`({hp:ST.maxHp,crit:ST.crit})`));
  run(`S.char.level=20;['sword.in510','sword.in420','sword.in330','sword.sp55','sword.sp95','sword.notable'].forEach(id=>runAction('treeTake',[id]));`);
  assert.deepStrictEqual(plain(run(`ST.inc`)),{melee:6+6+16,sword:8},'two melee nodes and Duellist, one sword node');
  assert.ok(run(`ST.crit`)>base.crit,'Duellist and a crit node');
  const e=run(`globalThis.e=foe('dummy');1`);
  const melee=run(`hit(e,{})`),spell=run(`hit(e,{tags:['projectile','fire']})`);
  assert.ok(Math.abs(melee/spell-1.36)<.05,`a sword hit is 36% up (melee and sword), a fire bolt is not: ${melee/spell}`);
  assert.strictEqual(run(`computeStats(S.char,S.equip,[]).maxHp`),run(`computeStats(S.char,S.equip).maxHp`),'no tree, no change');
});

test('damage types: the grimoire’s bolts and Fireball are elements the dead shrug off; family resistances; shots carry their type',()=>{
  const run=world('grimoire:magic',2);
  assert.strictEqual(run(`dtypeOf(ST.tags)`),'lightning');
  assert.strictEqual(run(`dtypeOf(SKILLS.fireball.tags)`),'fire');
  run(`globalThis.sk=foe('skel');`);
  const bolt=run(`hit(sk,{})`),rot=run(`hit(sk,{tags:['rot']})`),phys=run(`hit(sk,{tags:['physical']})`);
  assert.ok(Math.abs(bolt/phys-.25)<.03,'bone soldiers ignore 75% of a bolt');
  assert.ok(Math.abs(rot/phys-.5)<.03,'and half of rot, as all the undead do');
  run(`globalThis.sh=foe('shade');`);
  assert.ok(run(`hit(sh,{tags:['rot']})/hit(sh,{tags:['physical']})`)>1.2,'spirits are weak to rot');
  // a wisp's shot is cold, and a tree node against cold takes its share off
  run(`P.hp=ST.maxHp=1e6;ST.def=0;ST.evade=0;ST.eres={cold:50};`);
  const cold=run(`P.inv=0;const h=P.hp;hurtPlayer(100,null,true,{x:P.x+5,y:P.y,dtype:'cold'});h-P.hp`),phy=run(`P.inv=0;const h=P.hp;hurtPlayer(100,null,true,{x:P.x+5,y:P.y});h-P.hp`);
  assert.strictEqual(cold*2,phy);
  assert.strictEqual(run(`ETYPES.wisp.dtype`),'cold');
});

test('the balance table is up to date with the rules',()=>{
  const {rows,report,OUT}=require('../../tools/balance.js');
  const r=report(rows());
  assert.strictEqual(fs.readFileSync(OUT,'utf8'),r.md,'docs/balance.md is out of date: run npm run balance');
  assert.ok(!r.fail,'a build with a budget is more than 35% from it');
});

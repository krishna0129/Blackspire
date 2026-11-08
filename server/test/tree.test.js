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

test('classes and their boards: six classes, five tiers each, every base skill with two variations behind challenges',()=>{
  const run=world();
  assert.deepStrictEqual(plain(run(`Object.keys(CLASSES)`)),['marauder','duelist','ranger','shadow','witch','templar']);
  for(const c of run(`Object.keys(CLASSES)`)){
    assert.strictEqual(run(`BOARD_PLAN.${c}.length`),5,c+': five tiers');
    assert.ok(run(`boardOf('${c}').filter(q=>q.k==='key').length`)>=1,c+': a capstone');
    // every class weapon's skill is a known (now) skill on the board
    for(const w of plain(run(`CLASSES.${c}.weapons`))){const sk=run(`skillOf({type:'${w.split(':')[0]}',school:${w.includes(':')?`'${w.split(':')[1]}'`:'undefined'}})`);
      assert.ok(run(`!!nowNode('${c}','${sk}')`),`${c} knows ${sk}`);}}
  assert.ok(run(`Object.values(TREE).filter(q=>q.k==='skill').every(q=>q.vars.length===2&&q.vars.every(v=>v.ch&&v.ch.n>0))`),'two variations each, with a challenge');
  assert.deepStrictEqual(plain(run(`Object.values(TREE).filter(q=>q.fx&&((q.fx.inc&&Object.keys(q.fx.inc).some(t=>!TAGS[t]))||(q.fx.res&&Object.keys(q.fx.res).some(t=>!DTYPES[t])))).map(q=>q.id)`)),[],'nodes name real tags and types');
  assert.ok(run(`Object.values(TREE).every(q=>treeDesc(q).length>5)`),'every node says what it does');
  assert.ok(run(`Object.values(TREE).filter(q=>q.k==='skill').every(q=>q.vars.every(v=>chDesc(v.ch).length>5))`),'and every challenge');
});

test('points are placed in batches, in open tiers only, out of combat; a full reset costs 20 shards a point',()=>{
  const run=world();
  assert.strictEqual(run(`S.char.cls`),'duelist','a longsword makes a duelist by default');
  run(`S.char.level=10;S.floors[1]={chests:[],shops:[],boss:2};S.floors[2]={chests:[],shops:[],boss:0};`);
  assert.strictEqual(run(`treeEarned(S)`),10,'9 levels and one boss beaten (however many times)');
  const B=x=>run(`runAction('boardCommit',[${JSON.stringify(JSON.stringify(x))}])`);
  assert.strictEqual(B({'duelist.precision':1}),false,'tier 2 opens at 3 points');
  assert.strictEqual(B({'marauder.thick-hide':1}),false,'not another class’s board');
  assert.strictEqual(B({'duelist.riposte':1}),false,'skills are not bought with points');
  assert.strictEqual(B({'duelist.footwork':4}),false,'Footwork has 3 ranks');
  assert.strictEqual(run(`S.tree['duelist.footwork']||0`),0,'a refused batch spends nothing');
  assert.strictEqual(B({'duelist.footwork':3,'duelist.precision':2}),true,'3 in tier 1 open tier 2, in the same batch');
  assert.strictEqual(run(`treeSpent(S)+'|'+treeLeft(S)`),'5|5');
  run(`P.fightT=G.time;P.safe=false;`);
  assert.strictEqual(B({'duelist.precision':1}),false,'not in a fight');
  run(`G.time+=6;`);
  assert.strictEqual(B({'duelist.precision':1}),true,'five seconds later');
  assert.strictEqual(B({'duelist.showman':1}),false,'tier 5 opens at 15');
  run(`S.shards=1000;`);
  assert.strictEqual(run(`treeResetCost(S)`),120,'6 points, 20 shards each');
  assert.strictEqual(run(`runAction('treeReset',[])`),true);
  assert.strictEqual(run(`S.shards+'|'+treeSpent(S)`),'880|0');
});

test('an off-class weapon brings no skill; nodes add up into the stats; increased damage counts only for its tags',()=>{
  const run=world();
  assert.strictEqual(run(`ST.skill`),'circle');
  run(`S.equip.weapon=makeWeapon('bow',1,0);calcStats();`);
  assert.strictEqual(run(`ST.skill`),null,'a duelist with a bow: basic attack only');
  assert.strictEqual(run(`P.mp=1e3;const m=P.mp;useSkill();m-P.mp`),0,'and no skill to use');
  run(`S.equip.weapon=makeWeapon('sword',1,0);S.char.level=20;runAction('boardCommit',[JSON.stringify({'duelist.footwork':3,'duelist.precision':3,'duelist.finesse':3})]);`);
  assert.deepStrictEqual(plain(run(`ST.inc`)),{sword:18},'Finesse, three ranks');
  const e=run(`globalThis.e=foe('dummy');1`);
  const sword=run(`hit(e,{})`),fire=run(`hit(e,{tags:['projectile','fire']})`);
  assert.ok(Math.abs(sword/fire-1.18)<.04,`a sword hit is 18% up, a fire bolt is not: ${sword/fire}`);
  assert.strictEqual(run(`computeStats(S.char,S.equip,{}).maxHp`),run(`computeStats(S.char,S.equip).maxHp`),'no board, no change');
});

test('challenges count the class skill’s uses, crowds and kills; a met challenge opens its variation, free, one in use at a time',()=>{
  const run=world();
  run(`P.mp=1e6;ST.maxMp=1e6;P.safe=false;for(let i=0;i<4;i++){const e=foe('shade');e.hp=e.maxHp=1;e.x=P.x+10;e.y=P.y+(i-1.5)*4;}P.skillCd=0;useSkill();`);
  assert.strictEqual(run(`progOf(S,'duelist.circular-slash',{k:'multi',min:3})`),1,'one spin that hit three or more');
  assert.strictEqual(run(`progOf(S,'duelist.circular-slash',{k:'kills'})`),4,'four kills');
  assert.strictEqual(run(`runAction('setVar',['duelist.circular-slash',0])`),false,'Reave is still sealed');
  run(`S.prog[progKey('duelist.circular-slash',{k:'multi',min:3})]=60;`);
  assert.strictEqual(run(`runAction('setVar',['duelist.circular-slash',0])`),true,'60 crowds: Reave opens, for no points');
  assert.strictEqual(run(`treeSpent(S)`),0);
  assert.strictEqual(run(`S.vars['duelist.circular-slash']`),0,'in use');
  assert.strictEqual(run(`runAction('setVar',['duelist.circular-slash',1])`),false,'the other still needs its own challenge');
  assert.strictEqual(run(`runAction('setVar',['duelist.circular-slash',-1])&&S.vars['duelist.circular-slash']`),null,'and none can be in use');
});

test('attribute points wait to be confirmed, and are spent together',()=>{
  const run=world();
  run(`S.char.pts=5;`);
  assert.strictEqual(run(`runAction('attrCommit',[JSON.stringify({str:3,vit:3})])`),false,'more than there is to spend');
  assert.strictEqual(run(`S.char.str`),0,'nothing spent');
  assert.strictEqual(run(`runAction('attrCommit',[JSON.stringify({str:3,vit:2})])`),true);
  assert.strictEqual(run(`S.char.str+'|'+S.char.vit+'|'+S.char.pts`),'3|2|0');
  assert.strictEqual(run(`runAction('attrCommit',[JSON.stringify({luck:1})])`),false,'no such attribute');
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

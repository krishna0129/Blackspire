'use strict';
// Death, potions and the stash (build plan step 3; docs/design/combat.md#death): a fall takes everything carried but
// equipped gear, potions come in sizes for health and mana, keys 1 to 4 use the item bound to their category, and the
// stash keeps goods by count. Run headless, as the server runs the rules.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');
const J=v=>JSON.parse(v);

// one player standing at the start room's stash chest, out of the safe room's protection for the potion tests
function world(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222','duelist');setWorld(genFloor(1,7));const pl=makePlayer(1,s);
    G.players=[pl];setPlayer(pl);const st=G.stashes[0];pl.x=st.x;pl.y=st.y;G.enemies=G.enemies.filter(e=>e.boss);`,R);
  return run;
}

test('a fall takes everything carried, and only that: the gear on you and the stash stay',()=>{
  const run=world();
  run(`S.shards=120;S.mats.scrap=7;S.mats.ember=2;S.potions=4;S.potL=1;S.manas=2;S.rations=3;S.flasks=1;S.empties=2;S.bags=1;
    S.inv.push(makeArmor('tunic',1,0),makeWeapon('dagger',1,0));S.stash.push(makeBoots('boots',1,0));S.vault.shards=50;S.vault.sup.potions=2;
    globalThis.eq=JSON.stringify(S.equip);die();`);
  const after=J(run(`JSON.stringify({sh:S.shards,m:S.mats,inv:S.inv.length,stash:S.stash.length,v:S.vault,p:[S.potions,S.potL,S.manas,S.rations,S.flasks,S.empties,S.bags]})`));
  assert.strictEqual(after.sh,0);assert.deepStrictEqual(after.m,{scrap:0,ember:0,crystal:0});
  assert.strictEqual(after.inv,0,'gear in the bag is lost');
  assert.deepStrictEqual(after.p,[0,0,0,0,0,0,0],'potions, food, water, flasks and bags are lost');
  assert.strictEqual(after.stash,1);assert.strictEqual(after.v.shards,50);assert.strictEqual(after.v.sup.potions,2,'the stash keeps it all');
  assert.strictEqual(run(`JSON.stringify(S.equip)===eq`),true,'equipped gear stays');
  assert.deepStrictEqual(J(run(`JSON.stringify(lossCounts(P.lost))`)),[120,9,14,2],'the dialog counts it: shards, materials, supplies, gear');
});

test('potions in sizes: health and mana, 10%, 25% and 50%, sharing one cooldown',()=>{
  const run=world();
  run(`P.safe=false;ST.maxHp=200;ST.maxMp=100;P.hp=20;P.mp=10;S.potS=1;S.potions=1;S.potL=1;S.manaS=1;S.manas=1;S.manaL=1;S.quick.hp='potL';`);
  run(`usePotion();`);assert.strictEqual(run(`P.hp`),120,'the large one heals 50%');
  run(`useMana();`);assert.strictEqual(run(`P.mp`),10,'the cooldown is shared');
  run(`P.potCd=0;useMana();`);assert.strictEqual(run(`P.mp`),35,'the bound mana potion (25%)');
  run(`P.potCd=0;P.hp=200;usePotion();`);assert.strictEqual(run(`S.potL`),0,'(the large one was used up)');
  assert.strictEqual(run(`S.potS+S.potions`),2,'nothing is spent at full health');
  run(`P.potCd=0;P.hp=100;usePotion();`);assert.strictEqual(run(`S.potS`),0,'with the bound one gone, the smallest of the category');
  assert.strictEqual(run(`P.hp`),120);
});

test('keys 1 to 4 belong to a category: any item of it can be bound, nothing else',()=>{
  const run=world();
  assert.strictEqual(run(`runAction('bindQuick',['hp','potS'])`),true);
  assert.strictEqual(run(`S.quick.hp`),'potS');
  assert.strictEqual(run(`runAction('bindQuick',['hp','manaL'])`),false,'a mana potion on the health key');
  assert.strictEqual(run(`runAction('bindQuick',['food','flask'])`),false);
  assert.strictEqual(run(`runAction('bindQuick',['drink','flask'])`),true);
  run(`P.drink=40;drink();`);assert.strictEqual(run(`P.drink`),90);
});

test('the stash keeps goods by count: store and take, all of a kind or some; only beside a stash chest',()=>{
  const run=world();
  run(`S.shards=80;S.mats.scrap=6;S.manas=3;S.potions=2;`);
  assert.strictEqual(run(`runAction('store',['mat','scrap',4])`),4);
  assert.strictEqual(run(`runAction('store',['shards',null])`),80);
  assert.strictEqual(run(`runAction('storeAll',[])`),2,'the rest of the scrap; supplies stay in the bag');
  assert.strictEqual(run(`runAction('store',['sup','mana',null])`),3);run(`runAction('store',['sup','potion',null])`);
  assert.deepStrictEqual(J(run(`JSON.stringify([S.shards,S.mats.scrap,S.manas,S.potions,S.vault.shards,S.vault.mats.scrap,S.vault.sup.manas])`)),[0,0,0,0,80,6,3]);
  assert.strictEqual(run(`runAction('take',['sup','mana',1])`),1);
  assert.strictEqual(run(`runAction('take',['shards',null])`),80);
  assert.deepStrictEqual(J(run(`JSON.stringify([S.manas,S.vault.sup.manas,S.shards,S.vault.shards])`)),[1,2,80,0]);
  assert.strictEqual(run(`runAction('take',['mat','nothing',1])`),false,'no such material');
  run(`P.x+=400;`);assert.strictEqual(run(`runAction('store',['shards',null])`),false,'away from the chest');
});

test('saves from before potion sizes: the old potions stay (now 25%), the new kinds start at none, the keys are bound',()=>{
  const run=world();
  const s=J(run(`const o=newState('O',{},'bow','#222','ranger');delete o.manas;delete o.quick;delete o.vault;o.potions=5;JSON.stringify(migrateSave(o))`));
  assert.strictEqual(s.potions,5);assert.strictEqual(s.manas,0);assert.strictEqual(s.potL,0);
  assert.deepStrictEqual(s.quick,{hp:'potion',mp:'mana',food:'ration',drink:'flask'});
  assert.deepStrictEqual(s.vault,{shards:0,mats:{},sup:{}});
});

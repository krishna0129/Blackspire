'use strict';
// Skills in four slots (js/sim/skills.js, docs/design/skills.md): each class's pool, choosing skills out of combat,
// a cooldown per skill, and the Templar's kit. Run headless, as the server runs the rules.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');
const plain=v=>JSON.parse(JSON.stringify(v));

// a floor with two Templars: the one playing (P) and an ally a little to the east
function world(wkey='grimoire:faith',cls='templar'){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'${wkey}','#222','${cls}');setWorld(genFloor(1,7));const pl=makePlayer(1,s);
    const s2=newState('U',{},'grimoire:faith','#222','templar');const pl2=makePlayer(2,s2);pl2.x=pl.x+60;pl2.y=pl.y;
    G.players=[pl,pl2];setPlayer(pl);G.enemies=G.enemies.filter(e=>e.boss);P.safe=false;P.mp=ST.maxMp=1e4;P.fightT=-99;
    globalThis.ally=pl2;function foe(type,dx=12,dy=0){const e=makeEnemy(type,P.x+dx,P.y+dy,1,1,false);e.state='chase';G.enemies.push(e);return e;}
    // choosing a skill recalculates stats (and caps mana); the start room is a safe room, where skills stay sheathed
    function slot(k,id){S.char.slots[k]=id;calcStats();P.mp=ST.maxMp=1e4;P.safe=false;}
    function tick(t){for(let i=0;i<Math.round(t*30);i++){for(const q of G.players){setPlayer(q);if(!q.dead)updatePlayer(1/30);}setPlayer(pl);updateSkillFx(1/30);G.time+=1/30;}}`,R);
  return run;
}

test('every class starts with skills in Q, E, C and an ultimate in X, from its own pool',()=>{
  for(const[wk,cls]of[['grimoire:faith','templar'],['great','marauder'],['sword','duelist'],['bow','ranger'],['dagger','shadow'],['grimoire:magic','witch']]){
    const run=world(wk,cls),s=plain(run(`S.char.slots`));
    for(const k of['q','e','c'])if(s[k])assert.ok(run(`CLASS_KIT.${cls}.day.includes('${s[k]}')`),`${cls} ${k}`);
    if(s.x)assert.ok(run(`CLASS_KIT.${cls}.ult.includes('${s.x}')`),`${cls} x`);
    assert.ok(s.q,`${cls} has a skill on Q`);
  }
  const run=world();
  assert.deepStrictEqual(plain(run(`S.char.slots`)),{q:'heal',e:'partyheal',c:'renewal',x:'judgement'});
});

test('skills are chosen out of combat; a skill already slotted swaps; ultimates only on X',()=>{
  const run=world();
  assert.strictEqual(run(`runAction('setSlot',['q','aegis'])`),true);
  assert.strictEqual(run(`S.char.slots.q`),'aegis');
  assert.strictEqual(run(`runAction('setSlot',['e','aegis'])`),true);
  assert.deepStrictEqual([run(`S.char.slots.e`),run(`S.char.slots.q`)],['aegis','partyheal'],'swapped');
  assert.strictEqual(run(`runAction('setSlot',['q','massheal'])`),false,'an ultimate on Q');
  assert.strictEqual(run(`runAction('setSlot',['x','heal'])`),false,'an everyday skill on X');
  assert.strictEqual(run(`runAction('setSlot',['q','fireball'])`),false,'another class’s skill');
  run(`P.fightT=G.time;`);
  assert.strictEqual(run(`runAction('setSlot',['x','massheal'])`),false,'not in a fight');
  // an old save without slots gets the class's first skills
  assert.deepStrictEqual(plain(run(`const o=JSON.parse(JSON.stringify(S));delete o.char.slots;migrateSave(o).char.slots`)),{q:'heal',e:'partyheal',c:'renewal',x:'judgement'});
});

test('each skill has its own cooldown; an off-class weapon brings no skills',()=>{
  const run=world();
  run(`slot('q','aegis');slot('e','renewal');useSkill('q');`);
  assert.ok(run(`P.cds.aegis`)>0);
  run(`useSkill('e');`);
  assert.ok(run(`P.cds.renewal`)>0,'another skill is not held up by the first');
  const mp=run(`P.mp`);run(`useSkill('q');`);
  assert.strictEqual(run(`P.mp`),mp,'on cooldown: nothing happens');
  run(`S.equip.weapon=makeWeapon('bow',1,0);calcStats();P.cds={};`);
  const m2=run(`P.mp`);run(`useSkill('q');`);
  assert.strictEqual(run(`P.mp`),m2,'a bow is not a Templar’s weapon');
});

test('the Templar heals the ally it aims at, the party, over time, and shields',()=>{
  const run=world();
  run(`ally.hp=10;P.hp=10;P.in.aim=0;P.aim=0;slot('q','heal');useSkill('q');`);
  assert.ok(run(`ally.hp`)>10&&run(`P.hp`)===10,'Heal goes to the ally aimed at');
  run(`P.aim=Math.PI;P.cds={};useSkill('q');`);
  assert.ok(run(`P.hp`)>10,'aiming at no one heals yourself');
  run(`ally.hp=10;P.hp=10;ally.x=P.x+40;slot('q','partyheal');P.cds={};useSkill('q');`);
  assert.ok(run(`ally.hp`)>10&&run(`P.hp`)>10,'Party Heal: everyone near');
  run(`ally.hp=10;P.aim=Math.atan2(ally.y-P.y,ally.x-P.x);slot('q','renewal');P.cds={};useSkill('q');`);
  assert.strictEqual(run(`ally.hp`),10,'Renewal heals over time, not at once');
  run(`tick(4);`);
  assert.ok(run(`ally.hp`)>10);
  // Aegis: a shield takes the blow first
  run(`slot('q','aegis');P.cds={};P.aim=Math.PI;useSkill('q');globalThis.e=foe('skel');P.inv=0;ST.evade=0;`);
  const hp=run(`P.hp=ST.maxHp;P.hp`);run(`hurtPlayer(5,e);`);
  assert.strictEqual(run(`P.hp`),hp,'the shield took it');
  assert.ok(run(`P.shield`)<run(`Math.round(healAmount()*1.3)`));
});

test('Revive brings a fallen ally back within 15 seconds, with what the fall cost; after that, it does nothing',()=>{
  const run=world();
  run(`setPlayer(ally);S.shards=100;die();setPlayer(G.players[0]);`);
  assert.strictEqual(run(`ally.dead`),true);
  assert.strictEqual(run(`ally.S.shards`),80,'the fall cost 20%');
  run(`slot('q','revive');P.aim=Math.atan2(ally.y-P.y,ally.x-P.x);G.time+=10;useSkill('q');`);
  assert.strictEqual(run(`ally.dead`),false,'brought back');
  assert.strictEqual(run(`ally.S.shards`),100,'nothing lost');
  run(`setPlayer(ally);die();setPlayer(G.players[0]);G.time+=16;P.cds={};`);
  const mp=run(`P.mp`);run(`useSkill('q');`);
  assert.strictEqual(run(`ally.dead`),true,'too late');
  assert.strictEqual(run(`P.mp`),mp,'and nothing is spent on no one');
  // Resurrection: every fallen ally at once
  run(`setPlayer(ally);ally.dead=false;ally.hp=1;die();setPlayer(G.players[0]);slot('x','resurrect');useSkill('x');`);
  assert.strictEqual(run(`ally.dead`),false);
});

test('Smite empowers the next four attacks; Judgement strikes later, where you aimed; Mass Heal reaches the whole party',()=>{
  const run=world('mace','templar');
  run(`globalThis.e=foe('skel');e.maxHp=e.hp=1e6;wearPoise(e,0);e.maxPoise=e.poise=1e9;ST.crit=0;Math.random=()=>.5;P.in.aim=P.aim=0;`);
  const hit=()=>run(`const h=e.hp;P.swing={t:0,d:.3,a:0,hit:false};P.swing.t=.2;updatePlayer(0);h-e.hp`);
  const plain0=hit();
  run(`slot('e','smite');useSkill('e');`);
  const strong=[hit(),hit(),hit(),hit()],after=hit();
  for(const d of strong)assert.ok(Math.abs(d/plain0-1.7)<.1,`${d} vs ${plain0}`);
  assert.ok(Math.abs(after/plain0-1)<.05,'four, then back to normal');
  // Judgement: nothing at once, the strikes fall after
  run(`globalThis.j=foe('skel',70,0);j.maxHp=j.hp=1e6;slot('x','judgement');P.in.aim=P.aim=0;useSkill('x');`);
  assert.strictEqual(run(`j.hp`),1e6,'not at once');
  assert.ok(run(`G.pfx.length`)===8);
  run(`tick(2.5);`);
  assert.ok(run(`j.hp`)<1e6,'the strikes land');
  // Mass Heal: an ally far away is healed too
  run(`ally.x=P.x+400;ally.hp=5;slot('x','massheal');useSkill('x');`);
  assert.ok(run(`ally.hp`)>5);
});

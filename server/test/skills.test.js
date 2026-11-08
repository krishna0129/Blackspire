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
    const room=G.rooms.filter(r=>r.kind==='room').sort((a,b)=>b.w*b.h-a.w*a.h)[0];pl.x=(room.x+room.w/2)*TILE;pl.y=(room.y+room.h/2)*TILE;   // the floor's biggest room
    const s2=newState('U',{},'grimoire:faith','#222','templar');const pl2=makePlayer(2,s2);pl2.x=pl.x+60;pl2.y=pl.y;
    G.players=[pl,pl2];setPlayer(pl);G.enemies=G.enemies.filter(e=>e.boss);P.safe=false;P.mp=ST.maxMp=1e4;P.fightT=-99;
    globalThis.ally=pl2;function foe(type,dx=12,dy=0){const e=makeEnemy(type,P.x+dx,P.y+dy,1,1,false);e.state='chase';G.enemies.push(e);return e;}
    // choosing a skill recalculates stats (and caps mana); the start room is a safe room, where skills stay sheathed
    function slot(k,id){S.char.slots[k]=id;calcStats();P.mp=ST.maxMp=1e4;P.safe=false;}
    // time passes: the whole world's update (players, enemies, shots, skills), with the players untouchable meanwhile
    function tick(t){const g=god;god=true;for(let i=0;i<Math.round(t*30);i++){for(const q of G.players)q.in={mx:0,my:0,atk:false,block:false,aim:q.aim};simUpdate(1/30);}god=g;setPlayer(pl);}`,R);
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
  run(`setPlayer(ally);S.shards=100;S.manas=3;S.mats.scrap=5;die();setPlayer(G.players[0]);`);
  assert.strictEqual(run(`ally.dead`),true);
  assert.strictEqual(run(`ally.S.shards+ally.S.manas+ally.S.mats.scrap`),0,'the fall took everything carried');
  run(`slot('q','revive');P.aim=Math.atan2(ally.y-P.y,ally.x-P.x);G.time+=10;useSkill('q');`);
  assert.strictEqual(run(`ally.dead`),false,'brought back');
  assert.strictEqual(run(`JSON.stringify([ally.S.shards,ally.S.manas,ally.S.mats.scrap])`),'[100,3,5]','nothing lost');
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

// one class at a time: a floor with that class, enemies placed by hand, Math.random fixed
function cls(wkey,c){const run=world(wkey,c);run(`ST.crit=0;Math.random=()=>.5;P.in.aim=P.aim=0;G.time=100;`);return run;}
const fresh=run=>run(`P.cds={};P.mp=1e4;P.safe=false;P.inv=0;`);

test('every class has its whole pool: at least four everyday skills and three ultimates',()=>{
  const run=world();
  for(const c of['templar','marauder','duelist','ranger','shadow','witch']){
    assert.ok(run(`kitOf('${c}','q').length`)>=4,c);assert.strictEqual(run(`kitOf('${c}','x').length`),3,c);
    assert.strictEqual(run(`CLASS_KIT.${c}.day.concat(CLASS_KIT.${c}.ult).filter(id=>!SKILLS[id]).length`),0,c+': every skill exists');
    assert.ok(run(`CLASS_KIT.${c}.day.concat(CLASS_KIT.${c}.ult).every(id=>SKILL_FX[id])`),c+': every skill does something');
  }
});

test('the Marauder: Leap Slam, Enduring Cry, Earthquake and its aftershock, Berserk',()=>{
  const run=cls('great','marauder');
  run(`globalThis.e=foe('skel',90,0);e.maxHp=e.hp=1e6;slot('q','leap');`);fresh(run);
  const x0=run(`P.x`);run(`useSkill('q');`);
  assert.ok(run(`P.x`)>x0+40,'leapt forward');assert.ok(run(`e.hp`)<1e6,'and slammed');
  run(`slot('x','cry');`);fresh(run);run(`useSkill('x');`);
  assert.ok(run(`P.cryT`)>0&&run(`ally.cryT`)>0||run(`hyp(ally.x-P.x,ally.y-P.y)`)>=140,'the cry reaches allies near');
  const hp=run(`P.hp=ST.maxHp;globalThis.s2=foe('skel');P.inv=0;ST.evade=0;hurtPlayer(20,s2);ST.maxHp-P.hp`);
  run(`P.cryT=0;P.hp=ST.maxHp;P.inv=0;hurtPlayer(20,s2);`);assert.ok(hp<run(`ST.maxHp-P.hp`),'less damage under the cry');
  run(`globalThis.q=foe('skel',30,0);q.maxHp=q.hp=1e6;slot('x','quake');`);fresh(run);run(`useSkill('x');`);
  const h1=run(`q.hp`);run(`tick(1);`);assert.ok(run(`q.hp`)<h1,'the aftershock');
  run(`slot('x','berserk');`);fresh(run);run(`useSkill('x');P.kx=0;P.inv=0;hurtPlayer(5,s2);`);
  assert.strictEqual(run(`P.kx`),0,'nothing knocks a berserker back');
});

test('the Duelist: Riposte counters, Double Strike pays per hit, Challenge marks, Thousand Cuts',()=>{
  const run=cls('sword','duelist');
  run(`globalThis.e=foe('skel');e.maxHp=e.hp=1e6;slot('q','riposte');`);fresh(run);run(`useSkill('q');`);
  const hp=run(`P.hp`);run(`hurtPlayer(20,e);`);
  assert.strictEqual(run(`P.hp`),hp,'parried');assert.ok(run(`e.hp`)<1e6,'and answered');
  run(`slot('q','double');`);fresh(run);run(`useSkill('q');P.mp=100;P.swing={t:.2,d:.3,a:0,hit:false};updatePlayer(0);`);
  assert.strictEqual(run(`P.mp`),97,'3 mana a hit');
  run(`globalThis.c=foe('skel',60,30);c.maxHp=c.hp=1e6;slot('x','challenge');P.in.aim=P.aim=Math.atan2(c.y-P.y,c.x-P.x);`);fresh(run);run(`useSkill('x');`);
  assert.strictEqual(run(`targetFor(c)===G.players[0]`),true);
  run(`ally.x=c.x+2;ally.y=c.y;`);assert.strictEqual(run(`targetFor(c)===G.players[0]`),true,'it fights the one who marked it, even with another closer');
  run(`globalThis.k=foe('skel',30,-28);k.maxHp=k.hp=1e6;slot('x','cuts');P.in.aim=P.aim=Math.atan2(k.y-P.y,k.x-P.x);`);fresh(run);run(`useSkill('x');tick(1.2);`);
  assert.ok(run(`k.hp`)<1e6);
});

test('the Ranger: Lightning Arrow leaps, Caustic Arrow leaves poison, Split Arrow goes through, a Ballista shoots',()=>{
  const run=cls('bow','ranger');
  run(`G.enemies=G.enemies.filter(e=>e.boss);globalThis.a1=foe('skel',40,0);globalThis.a2=foe('skel',60,20);for(const e of [a1,a2]){e.maxHp=e.hp=1e6;}slot('q','lightarrow');`);
  fresh(run);run(`useSkill('q');tick(.5);`);assert.ok(run(`a1.hp`)<1e6&&run(`a2.hp`)<1e6,'it leapt to the second');
  run(`a1.x=P.x+40;a1.y=P.y;a2.x=P.x+110;a2.y=P.y;a1.hp=a2.hp=1e6;a1.stun=a2.stun=5;P.in.aim=P.aim=0;slot('q','split');`);fresh(run);run(`useSkill('q');tick(.6);`);
  assert.ok(run(`a1.hp`)<1e6&&run(`a2.hp`)<1e6,'through both in a line');
  run(`slot('q','caustic');a1.hp=1e6;`);fresh(run);run(`useSkill('q');tick(.3);`);
  assert.ok(run(`G.pfx.some(q=>q.k==='pool')`));const h=run(`a1.hp`);run(`tick(2);`);assert.ok(run(`a1.hp`)<h,'the pool hurts');
  run(`slot('x','ballista');a1.hp=1e6;`);fresh(run);run(`useSkill('x');tick(1.5);`);assert.ok(run(`a1.hp`)<1e6);
});

test('the Shadow: Viper Strike poisons, Smoke Cloud and Vanish hide you, Death Mark strikes again',()=>{
  const run=cls('dagger','shadow');
  run(`globalThis.e=foe('skel');e.maxHp=e.hp=1e6;slot('q','viper');`);fresh(run);run(`useSkill('q');P.swing={t:.2,d:.3,a:0,hit:false};updatePlayer(0);`);
  assert.ok(run(`e.bleedT`)>0,'poisoned');
  run(`slot('q','smoke');`);fresh(run);run(`useSkill('q');ally.x=P.x+400;`);
  assert.strictEqual(run(`hidden(G.players[0])`),true);
  run(`slot('x','vanish');P.x+=200;`);fresh(run);run(`useSkill('x');`);
  const hp=run(`P.hp`);run(`hurtPlayer(50,e);`);assert.strictEqual(run(`P.hp`),hp,'nothing touches you');
  run(`P.x-=200;P.vanishT=0;e.mark=null;slot('x','deathmark');`);fresh(run);run(`useSkill('x');damageEnemy(e,10,{});`);
  const h=run(`e.hp`);run(`tick(4.2);`);assert.ok(run(`e.hp`)<h,'the mark strikes');
});

test('the Witch: Frostbolt slows, Arc jumps, Meteor lands late, the dead rise and fight',()=>{
  const run=cls('grimoire:magic','witch');
  run(`G.enemies=G.enemies.filter(e=>e.boss);globalThis.w1=foe('skel',40,0);globalThis.w2=foe('skel',60,20);for(const e of [w1,w2])e.maxHp=e.hp=1e6;slot('q','frostbolt');`);
  fresh(run);run(`useSkill('q');tick(.4);`);assert.ok(run(`w1.slowT`)>0,'slowed');
  run(`slot('q','arc');w2.hp=1e6;`);fresh(run);run(`useSkill('q');`);assert.ok(run(`w2.hp`)<1e6,'jumped');
  run(`w1.hp=1e6;slot('x','meteor');P.aim=Math.atan2(w1.y-P.y,w1.x-P.x);w1.x=P.x+Math.cos(P.aim)*90;w1.y=P.y+Math.sin(P.aim)*90;`);fresh(run);run(`useSkill('x');`);
  assert.strictEqual(run(`w1.hp`),1e6,'not at once');run(`tick(1.4);`);assert.ok(run(`w1.hp`)<1e6,'it lands');
  run(`w1.hp=1e6;w1.x=P.x+30;w1.y=P.y;slot('x','raise');`);fresh(run);run(`useSkill('x');tick(3);`);
  assert.ok(run(`w1.hp`)<1e6,'the risen fight');
});

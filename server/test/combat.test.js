'use strict';
// The core of combat (docs/design/combat.md): aiming, stamina and the dash, parrying and blocking, pushes, poise and
// focus, and enemies' poise. Run headless, as the server runs the rules.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function world(wkey='sword',cls){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'${wkey}','#222'${cls?`,'${cls}'`:''});setWorld(genFloor(1,7));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);
    G.enemies=G.enemies.filter(e=>e.boss);P.safe=false;P.inv=0;
    function foe(type,dx=12){const e=makeEnemy(type,P.x+dx,P.y,1,1,false);e.state='chase';G.enemies.push(e);return e;}
    function step(t){for(let i=0;i<Math.round(t*30);i++){P.in.mx=P.in.my=0;steerPlayer(1/30);updatePlayer(1/30);G.time+=1/30;}}`,R);
  return run;
}

test('attacks go where the mouse aims, and the four-way facing follows it',()=>{
  const run=world();
  run(`P.in.aim=2.4;steerPlayer(1/30);`);
  assert.strictEqual(run(`P.aim`),2.4);
  assert.strictEqual(run(`P.dir`),run(`dirOf(2.4)`));
  run(`P.in.aim=null;P.dir=3;steerPlayer(1/30);`);
  assert.strictEqual(run(`P.aim`),0,'without a mouse, the way you face');
});

test('you keep moving while you swing, slower; staggered, you stand still',()=>{
  const run=world();
  const walk=run(`const x=P.x;P.in={mx:1,my:0,atk:false,block:false,aim:0};steerPlayer(.1);P.x-x`);
  const swing=run(`const x=P.x;P.swing={t:0,d:.3,a:0,hit:false};P.in={mx:1,my:0,atk:false,block:false,aim:0};steerPlayer(.1);P.swing=null;P.x-x`);
  assert.ok(swing>0&&Math.abs(swing/walk-run(`COMBAT.swingSlow`))<.05,`${swing} vs ${walk}`);
  assert.strictEqual(run(`const x=P.x;P.stagger=.3;P.in={mx:1,my:0,atk:false,block:false,aim:0};steerPlayer(.1);P.stagger=0;P.x-x`),0);
});

test('the dash costs stamina and gives no invulnerability; how far depends on the class; stamina comes back',()=>{
  const run=world('sword','duelist');
  run(`P.in={mx:1,my:0,atk:false,block:false,aim:0};dodge();`);
  assert.strictEqual(run(`P.sta`),run(`ST.maxSta-COMBAT.sta.dash`));
  assert.strictEqual(run(`P.inv`),0,'no invulnerability');
  run(`P.dash=null;P.dodgeCd=0;P.sta=10;dodge();`);
  assert.strictEqual(run(`!!P.dash`),false,'not without the stamina');
  run(`step(3);`);
  assert.ok(run(`P.sta`)>10+30,'it comes back');
  const witch=world('grimoire:magic','witch');
  assert.ok(witch(`ST.dashMul`)<run(`ST.dashMul`),'casters dash shorter');
  assert.ok(witch(`ST.maxSta`)<run(`ST.maxSta`)&&witch(`ST.maxMp`)>run(`ST.maxMp`),'less stamina, more mana');
});

test('a parry: block pressed just before the blow; nothing gets through and the attacker reels',()=>{
  const run=world('great','marauder');
  assert.strictEqual(run(`ST.parry`),true,'a greatsword parries, without a shield');
  run(`globalThis.e=foe('skel');P.in.aim=0;P.in.block=true;P.wasBlock=false;steerPlayer(1/30);`);
  const hp=run(`P.hp`);
  run(`hurtPlayer(20,e);`);
  assert.strictEqual(run(`P.hp`),hp);
  assert.ok(run(`e.stun`)>=.9,'staggered');
  run(`G.time+=1;P.inv=0;hurtPlayer(20,e);`);
  assert.ok(run(`P.hp`)<hp,'too late: it lands');
  const bow=world('bow','ranger');
  assert.strictEqual(bow(`ST.parry`),false,'a bow cannot parry');
});

test('holding a block (shields only) costs stamina per blow; without stamina the guard breaks',()=>{
  const run=world('mace','templar');
  run(`globalThis.e=foe('skel');P.in={mx:0,my:0,atk:false,block:true,aim:0};P.wasBlock=true;steerPlayer(1/30);`);
  assert.strictEqual(run(`P.blocking`),true);
  const hp=run(`P.hp`),sta=run(`P.sta`);
  run(`hurtPlayer(20,e);`);
  assert.strictEqual(run(`P.hp`),hp,'a heavy shield stops it all');
  assert.strictEqual(run(`P.sta`),sta-run(`SHIELDS.shield.cost`));
  run(`P.inv=0;P.sta=1;hurtPlayer(20,e);`);
  assert.ok(run(`P.hp`)<hp&&run(`P.stagger`)>0,'no stamina: the guard breaks');
});

test('a blow pushes you; a heavy one staggers; a spell is held by focus, a swing by poise',()=>{
  const run=world('sword','duelist');
  run(`globalThis.e=foe('skel');hurtPlayer(10,e);`);
  assert.ok(run(`P.kx`)<0,'pushed away from it');
  assert.strictEqual(run(`P.stagger>0`),false,'a light blow does not stagger');
  run(`P.inv=0;P.kx=0;globalThis.dk=foe('brute');hurtPlayer(10,dk);`);
  assert.ok(run(`P.stagger`)>0,'a heavy blow staggers');
  // poise: light blows wear it down, then one interrupts a swing
  run(`P.stagger=0;P.poise=ST.maxPoise;let n=0;do{P.inv=0;P.swing={t:0,d:.3,a:0,hit:false};hurtPlayer(1,e);n++;}while(P.swing&&n<20);globalThis.n=n;`);
  assert.ok(run(`n`)>1,'one light blow does not break poise');
  assert.strictEqual(run(`P.swing`),null,'the blow that breaks it interrupts the swing');
  // heavier armour, more poise
  assert.ok(run(`S.equip.armor=makeArmor('plate',1,0,'#222');calcStats();ST.maxPoise`)>run(`S.equip.armor=makeArmor('tunic',1,0,'#222');calcStats();ST.maxPoise`));
  // focus: a caster with Mind keeps casting through a blow more often
  const w=world('grimoire:magic','witch');
  const kept=mnd=>w(`S.char.mnd=${mnd};calcStats();ST.evade=0;globalThis.e3=globalThis.e3||foe('skel');let s=1;Math.random=()=>(s=s*16807%2147483647)/2147483647;let k=0;for(let i=0;i<400;i++){P.inv=0;P.hp=ST.maxHp;P.dead=false;P.swing={t:0,d:.3,a:0,hit:false};hurtPlayer(1,e3);if(P.swing)k++;}k`);
  assert.ok(kept(20)>kept(0)+100,'focus from Mind');
});

test('enemies have poise: blows wear it down (a greatsword fastest); broken, they reel and take more',()=>{
  const run=world('great','marauder');
  run(`globalThis.e=foe('skel');e.maxHp=e.hp=1e6;ST.crit=0;`);
  run(`wearPoise(e,1);`);
  assert.ok(run(`e.maxPoise`)>0);
  const per=w=>w(`globalThis.f=foe('skel');wearPoise(f,0);f.maxHp=f.hp=1e6;let n=0;while(!(f.staggerT>0)&&n<500){damageEnemy(f,1,{crit:false,noProc:true});n++;}n`);
  const great=per(run),dagger=per(world('dagger','shadow'));
  assert.ok(great<dagger,`greatsword ${great} blows, dagger ${dagger}`);
  run(`globalThis.g=foe('skel');wearPoise(g,0);g.maxPoise=g.poise=1e9;g.maxHp=g.hp=1e6;g.state='chase';`);
  const plain=run(`const h=g.hp;Math.random=()=>.5;damageEnemy(g,1,{crit:false,noProc:true});h-g.hp`);
  const reeling=run(`g.staggerT=1;g.poise=g.maxPoise;const h=g.hp;damageEnemy(g,1,{crit:false,noProc:true});h-g.hp`);
  assert.ok(Math.abs(reeling/plain-(1+run(`COMBAT.epoise.more`)/100))<.05,`${reeling} vs ${plain}`);
});

test('weight: you gather speed and brake over a moment, a string of swings keeps you slow, and enemies start from slow',()=>{
  const run=world();
  run(`globalThis.home=[P.x,P.y];`);
  const go=`P.in={mx:1,my:0,atk:false,block:false,aim:0};`,stop=`P.in={mx:0,my:0,atk:false,block:false,aim:0};`;
  // from a stand: not at full speed on the first frame, there within a fifth of a second
  assert.ok(run(`${go}steerPlayer(1/60);hyp(P.vx,P.vy)/ST.move`)<.3,'the first frame is slow');
  run(`for(let i=0;i<12;i++){${go}steerPlayer(1/60);}`);
  assert.ok(Math.abs(run(`P.vx/ST.move`)-1)<1e-6,'full speed after 0.2 s');
  // letting go: still moving on the next frame, stopped within a tenth of a second or so
  assert.ok(run(`${stop}steerPlayer(1/60);P.vx`)>0,'it takes a moment to stop');
  assert.strictEqual(run(`for(let i=0;i<8;i++){${stop}steerPlayer(1/60);}P.vx`),0);
  assert.strictEqual(run(`P.moving`),false);
  // a reversal brakes first: for a moment you still drift the old way
  run(`for(let i=0;i<12;i++){${go}steerPlayer(1/60);}`);
  assert.ok(run(`P.in={mx:-1,my:0,atk:false,block:false,aim:0};steerPlayer(1/60);P.vx`)>0);
  // attack held: slow between the swings too, not only during them
  run(`P.vx=P.vy=0;P.swing=null;P.atkCd=.3;for(let i=0;i<20;i++){P.in={mx:1,my:0,atk:true,block:false,aim:0};steerPlayer(1/60);}`);
  assert.ok(Math.abs(run(`P.vx/ST.move`)-run(`COMBAT.swingSlow`))<1e-6,'slow while the string of swings goes on');
  // a dash leaves you running
  run(`P.atkCd=0;P.vx=0;P.sta=ST.maxSta;P.in={mx:1,my:0,atk:false,block:false,aim:0};dodge();for(let i=0;i<40&&P.dash;i++)steerPlayer(1/60);`);
  assert.ok(run(`P.vx/ST.move`)>.99,'out of the dash at a run');
  // an enemy: its first step is short, its pace full a quarter of a second on
  run(`globalThis.wk=makeEnemy('skel',home[0]+24,home[1],1,1,false);wk.speed=40;`);
  const first=run(`const x=wk.x;walkEnt(wk,-40/60,0);G.time+=1/60;x-wk.x`);
  run(`for(let i=0;i<20;i++){walkEnt(wk,-40/60,0);G.time+=1/60;}`);
  const later=run(`const x=wk.x;walkEnt(wk,-40/60,0);G.time+=1/60;x-wk.x`);
  assert.ok(first<later*.5&&Math.abs(later-40/60)<1e-6,`${first} then ${later}`);
  run(`G.time+=.5;`);
  assert.ok(run(`const x=wk.x;walkEnt(wk,-40/60,0);x-wk.x`)<later*.5,'after a stop it starts from slow again');
});

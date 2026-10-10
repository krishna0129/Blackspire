'use strict';
// The root village (js/sim/village.js) and the travel rules around it, run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

function village(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genVillage());const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  return run;
}
const step=(run,secs)=>run(`for(let i=0;i<${Math.round(secs*30)};i++){for(const q of G.players)q.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);

test('new characters start in the village, on open ground, safe, by the Teleport Gate',()=>{
  const run=village();
  assert.strictEqual(run(`S.floor`),0);
  assert.ok(run(`!solid(pl.x,pl.y)`),'standing on open ground');
  step(run,.2);
  assert.ok(run(`pl.safe`),'the whole village is safe');
  assert.ok(run(`hyp(G.home.x-pl.x,G.home.y-pl.y)<6*TILE`),'the gate is right there');
});

test('every building, stall and tree blocks its footprint, and every person can be reached from open ground',()=>{
  const run=village();
  for(const q of['G.traders','G.smiths','G.talkers'])
    assert.ok(run(`${q}.every(n=>[[0,1],[0,1.6],[0,2]].some(([dx,dy])=>!solid(n.x+dx*TILE,n.y+dy*TILE)&&hyp(dy*TILE,0)<24))`),q+' reachable from the front');
  assert.ok(run(`solid(vx(9.5),vy(8))`),'inside the inn is blocked');
  assert.ok(run(`solid(vx(44),vy(7.5))`),'a stall is blocked');
});

test('hunger and thirst hold still at home',()=>{
  const run=village();
  step(run,30);
  assert.strictEqual(run(`[pl.food,pl.drink].join()`),'100,100');
});

test('the market stalls each sell their own goods',()=>{
  const run=village();
  run(`S.shards=1e6;`);
  const sells=run(`G.traders.map(t=>t.sells).join()`);assert.strictEqual(sells,'weapons,gear,potions,food,inn,market');
  const at=i=>`pl.x=G.traders[${i}].x;pl.y=G.traders[${i}].y+16;`;
  run(at(0)+`runAction('openShop',[0]);`);
  assert.ok(run(`shopOf(0).stock.length>0&&shopOf(0).stock.every(e=>e.it.slot==='weapon')`),'weapons stall: weapons only');
  run(at(1)+`runAction('openShop',[1]);`);
  assert.ok(run(`shopOf(1).stock.every(e=>e.it.slot!=='weapon')`),'gear stall: no weapons');
  run(at(3));
  assert.strictEqual(run(`runAction('buySupply',[3,'flask'])`),true);
  assert.strictEqual(run(`runAction('buySupply',[3,'potion'])`),false,'the food stall has no potions');
  run(at(2));
  assert.strictEqual(run(`runAction('buySupply',[2,'potion'])`),true);
});

test('the village market restocks when a floor\u2019s boss falls, and with each new day',()=>{
  const run=village();
  run(`S.shards=1e6;globalThis.stall=k=>G.traders.findIndex(t=>t.sells===k);
    globalThis.home=k=>{setWorld(genVillage());const p=makePlayer(1,S);G.players=[p];setPlayer(p);const i=stall(k);p.x=G.traders[i].x;p.y=G.traders[i].y+16;runAction('openShop',[i]);return i;};
    globalThis.buyOut=()=>{const i=home('potions');let n=0;while(runAction('buySupply',[i,'potion']))n++;return n;};
    globalThis.beatBoss=n=>{setWorld(genFloor(n,S.seed));const p=makePlayer(1,S);G.players=[p];setPlayer(p);killEnemy(G.bossEnt);};`);
  const first=run(`buyOut()`);assert.ok(first>=5&&first<=10,'5 to 10 potions to begin with');
  assert.strictEqual(run(`buyOut()`),0,'sold out, and still sold out on coming back the same day');
  run(`beatBoss(1);`);
  assert.ok(run(`buyOut()`)>=5,'a boss fell in the tower: the market has restocked');
  run(`floorState(0).day--;`);   // as if the stall was last opened yesterday
  assert.ok(run(`buyOut()`)>=5,'a new day: restocked again');
  assert.strictEqual(run(`buyOut()`),0,'but only once a day');
  // gear restocks too, and at the level of the highest floor reached
  run(`const i=home('weapons');while(runAction('buy',[i,0])!==false&&S.inv.length<BAG_SIZE);globalThis.left=shopOf(i).stock.length;S.inv.length=0;`);
  assert.strictEqual(run(`left`),0,'the weapons stall is bought out');
  run(`beatBoss(1);const i=home('weapons');globalThis.st=shopOf(i).stock;`);
  assert.ok(run(`st.length>=1&&st.every(e=>e.it.ilvl===2)`),'new weapons, for floor 2 now that it is unlocked');
});

test('safe points you stand in are remembered for the Teleport Gate',()=>{
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genFloor(2,5));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  run(`const q=G.points[1];pl.x=q.x;pl.y=q.y+20;`);step(run,.1);
  assert.strictEqual(run(`JSON.stringify(S.points)`),'{"2":[1]}');
  run(`S.cp=1;S.cpFloor=2;const p2=makePlayer(2,S);G.players=[p2];setPlayer(p2);`);
  assert.strictEqual(run(`safeIndex(P.x,P.y)`),1,'arriving at that safe point');
});

test('the stash is one store behind every chest: put away in the tower, take out at the inn',()=>{
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');s.inv.push(randomItem(1,0),randomItem(1,0));setWorld(genFloor(1,3));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);`,R);
  assert.strictEqual(run(`G.smiths.length`),0,'no blacksmith in the tower');
  assert.strictEqual(run(`G.stashes.length`),run(`G.traders.length`),'a stash chest by every trader');
  run(`pl.x+=300;`);assert.strictEqual(run(`runAction('stash',[0])`),false,'only at a stash chest');
  run(`const q=G.stashes[1];pl.x=q.x;pl.y=q.y+8;`);
  assert.strictEqual(run(`runAction('stash',[0])`),0);
  assert.strictEqual(run(`[S.inv.length,S.stash.length].join()`),'1,1');
  run(`const S0=S;setWorld(genVillage());const p2=makePlayer(1,S0);G.players=[p2];setPlayer(p2);const q=G.stashes[0];p2.x=q.x;p2.y=q.y+8;`);
  assert.strictEqual(run(`runAction('unstash',[0])`),1);
  assert.strictEqual(run(`[S.inv.length,S.stash.length].join()`),'2,0');
});

test('a drunk flask stays as an empty one, and the well fills empties for free',()=>{
  const run=village();
  run(`pl.drink=10;S.flasks=2;S.empties=0;drink();`);
  assert.strictEqual(run(`[S.flasks,S.empties].join()`),'1,1');
  assert.strictEqual(run(`runAction('fillFlasks',[])`),false,'only at the well');
  run(`const w=G.wells[0];pl.x=w.x;pl.y=w.y+10;S.shards=7;`);
  assert.strictEqual(run(`runAction('fillFlasks',[])`),1);
  assert.strictEqual(run(`[S.flasks,S.empties,S.shards].join()`),'2,0,7');
  assert.strictEqual(run(`runAction('fillFlasks',[])`),false,'nothing left to fill');
});

test('the inn serves meals: they fill you up, cost shards, and leave a buff that slows hunger',()=>{
  const run=village();
  run(`const k=G.traders.findIndex(t=>t.sells==='inn');globalThis.inn=k;pl.x=G.traders[k].x;pl.y=G.traders[k].y+16;pl.food=20;pl.drink=30;S.shards=100;`);
  assert.strictEqual(run(`runAction('eatMeal',[inn,'stew'])`),true);
  assert.strictEqual(run(`[pl.food,pl.drink,S.shards,pl.buff.id,pl.buff.t].join()`),'100,50,85,fed,1200');
  assert.strictEqual(run(`runAction('eatMeal',[0,'stew'])`),false,'only the innkeeper serves meals');
  run(`S.shards=5;`);assert.strictEqual(run(`runAction('eatMeal',[inn,'roast'])`),false,'not without the shards');
  // on a floor, well fed: hunger drains half as fast
  const R=loadRules(),f=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genFloor(1,7));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);pl.buff={id:'fed',t:600};`,R);
  f(`for(let i=0;i<1800;i++){pl.in={mx:0,my:0,atk:false,block:false};simUpdate(1/30);}`);
  assert.ok(Math.abs(f(`pl.food`)-(100-100/25/2))<.2,'half the usual drain');
  assert.ok(Math.abs(f(`pl.buff.t`)-540)<.5,'the buff counts down');
});

test('the training yard is the one place in the village to fight: scarecrows take hits and never fall',()=>{
  const run=village();
  assert.strictEqual(run(`G.enemies.length`),3);assert.ok(run(`G.enemies.every(e=>e.type==='dummy')`));
  step(run,.2);assert.ok(run(`pl.safe`),'the square is safe');
  run(`const e=G.enemies[0];pl.x=e.x;pl.y=e.y+14;pl.dir=1;`);step(run,.1);
  assert.ok(!run(`pl.safe`),'the yard is not');
  run(`globalThis.d0=G.enemies[0].hp;hitArc(DIR_ANGLE[1],120,30,1,{melee:true});`);   // a real swing, facing it
  assert.ok(run(`G.enemies[0].hp<d0`),'the swing lands');
  run(`for(let i=0;i<20;i++)damageEnemy(G.enemies[0],1e4);`);
  assert.ok(run(`!G.enemies[0].dead`),'and it never falls');
  step(run,5);
  assert.strictEqual(run(`G.enemies[0].hp===G.enemies[0].maxHp`),true,'whole again once left alone');
  assert.strictEqual(run(`[G.enemies[0].x===vx(VILLAGE.scarecrows[0][0]),pl.hp===pl.ST.maxHp].join()`),'true,true','it never moves or strikes back');
});

test('the fields manager: buy, plant and harvest any plot from the field\u2019s entrance; crops grow in real time',()=>{
  const run=village();
  run(`S.shards=1000;globalThis.atDesk=()=>{const q=G.fieldDesk[0];pl.x=q.x;pl.y=q.y+12;};`);
  assert.strictEqual(run(`runAction('buyPlot',[0])`),false,'not from across the village');
  run(`atDesk();`);
  assert.strictEqual(run(`runAction('buyPlot',[0])`),true);assert.strictEqual(run(`S.shards`),900,'the first plot is 100 shards');
  assert.strictEqual(run(`runAction('buyPlot',[0])`),false,'already yours');
  assert.strictEqual(run(`runAction('buyPlot',[5])`),true);assert.strictEqual(run(`S.shards`),700,'the second costs twice as much');
  assert.strictEqual(run(`runAction('buyPlot',[9])`),false,'there is no tenth plot');
  assert.strictEqual(run(`runAction('plant',[0,'wheat'])`),false,'only what this village grows');
  assert.strictEqual(run(`runAction('plant',[0,'potato'])`),true);
  assert.strictEqual(run(`runAction('plant',[2,'potato'])`),false,'not a plot you don\u2019t own');
  assert.strictEqual(run(`runAction('harvest',[0])`),false,'not before it has grown');
  run(`myPlot(0).t-=CROPS.potato.grow-1000;`);assert.strictEqual(run(`runAction('harvest',[0])`),false,'a second early is still early');
  run(`myPlot(0).t-=2000;`);const n=run(`runAction('harvest',[0])`);
  assert.ok(n>=4&&n<=6,'4 to 6 potatoes: '+n);assert.strictEqual(run(`S.crops.potato`),n);
  assert.strictEqual(run(`myPlot(0).crop`),null,'the plot is empty again');
  run(`const[px,py]=VILLAGE.plots[3];pl.x=vx(px+1.5);pl.y=vy(py+1);`);
  assert.strictEqual(run(`runAction('plant',[5,'glowcap'])`),true,'standing on any plot works too');
});

test('the innkeeper cooks from your own crops, and packs potatoes as rations',()=>{
  const run=village();
  run(`const k=G.traders.findIndex(t=>t.sells==='inn');globalThis.inn=k;pl.x=G.traders[k].x;pl.y=G.traders[k].y+16;S.shards=0;S.crops={potato:5,glowcap:1};pl.food=10;`);
  assert.strictEqual(run(`runAction('eatMeal',[inn,'stew',true])`),true,'stew from three potatoes, no shards');
  assert.strictEqual(run(`[S.crops.potato,pl.food,pl.buff.id].join()`),'2,100,fed');
  assert.strictEqual(run(`runAction('eatMeal',[inn,'tea',true])`),false,'tea needs two glowcaps');
  assert.strictEqual(run(`runAction('eatMeal',[inn,'roast',true])`),false,'the roast is not from the fields');
  run(`globalThis.r0=S.rations;`);assert.strictEqual(run(`runAction('packRation',[inn])`),true);
  assert.strictEqual(run(`[S.crops.potato,S.rations-r0].join()`),'0,1');
});

test('the farmhand: paid a day at a time, brings in and replants while you are away, leaves when unpaid',()=>{
  const run=village();
  run(`S.shards=2000;const[px,py]=VILLAGE.plots[0];pl.x=vx(px+1.5);pl.y=vy(py+1);runAction('buyPlot',[0]);runAction('plant',[0,'potato']);
    globalThis.H=CROPS.potato.grow;`);
  run(`globalThis.s0=S.shards;`);assert.strictEqual(run(`runAction('farmhand',[true])`),true);
  assert.strictEqual(run(`s0-S.shards`),40,'the first day, one plot');
  // five hours pass with nobody around
  run(`globalThis.now=Date.now();myPlot(0).t-=5*H+60000;globalThis.s1=S.shards;farmWork(now);`);
  const p=run(`S.crops.potato`);assert.ok(p>=20&&p<=30,'five harvests of 4 to 6: '+p);
  assert.strictEqual(run(`s1-S.shards`),50,'five replantings at 10 shards');
  assert.ok(run(`myPlot(0).crop==='potato'&&now-myPlot(0).t<H`),'replanted and growing');
  // a new day: another wage; then a day with no shards to pay
  run(`S.shards=40;farmLog().paid=now-1;farmWork(now);`);
  assert.strictEqual(run(`[S.farm.farmer,S.shards].join()`),'true,0','the wage is paid');
  run(`farmLog().paid=now-1;farmWork(now);`);
  assert.strictEqual(run(`S.farm.farmer`),false,'and without it they leave');
});

test('the broker sells harvests for a cut; selling yourself at the food stall pays the full price',()=>{
  const run=village();
  run(`S.shards=1000;const[px,py]=VILLAGE.plots[0];pl.x=vx(px+1.5);pl.y=vy(py+1);runAction('buyPlot',[0]);runAction('plant',[0,'glowcap']);
    runAction('broker',[true]);myPlot(0).t-=CROPS.glowcap.grow;globalThis.s0=S.shards;globalThis.n=runAction('harvest',[0]);`);
  assert.strictEqual(run(`S.shards-s0`),run(`Math.floor(n*15*.75)`),'sold, less a quarter');
  assert.ok(!run(`S.crops.glowcap`),'nothing kept');
  run(`runAction('broker',[false]);S.crops.potato=10;const k=G.traders.findIndex(t=>t.sells==='food');globalThis.food=k;pl.x=G.traders[k].x;pl.y=G.traders[k].y+16;globalThis.s1=S.shards;`);
  assert.strictEqual(run(`runAction('sellCrops',[food,'potato'])`),40);
  assert.strictEqual(run(`[S.shards-s1,S.crops.potato].join()`),'40,0','ten potatoes at 4 each, all yours');
  assert.strictEqual(run(`runAction('sellCrops',[0,'potato'])`),false,'only the food and drink stall buys crops');
});

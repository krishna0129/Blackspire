'use strict';
// Enemy families, their drops, and the gear forged from them (FAMILIES and FORGING in js/sim/data.js), run headless
// like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');
const plain=v=>JSON.parse(JSON.stringify(v));   // objects from the rules' sandbox have its own prototypes

// A character on floor n (0 is the village), with helpers: dummy(type) puts one enemy of a type in front of them,
// hits(n,type) is the average damage of n plain hits on it, taken(n,src) the average damage the player takes.
function world(n=1){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(${n?`genFloor(${n},7)`:'genVillage()'});const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);G.enemies=G.enemies.filter(e=>e.boss);
    function foe(type){const e=makeEnemy(type,P.x+12,P.y,1,1,false);e.maxHp=e.hp=1e9;e.state='chase';G.enemies.push(e);return e;}
    function hits(n,e,o){let t=0;ST.crit=0;for(let i=0;i<n;i++){const h=e.hp;damageEnemy(e,1,Object.assign({crit:false,noProc:true},o));t+=h-e.hp;}return t/n;}
    function taken(n,src,from){let t=0;for(let i=0;i<n;i++){P.hp=ST.maxHp=1e6;P.inv=0;hurtPlayer(20,src,true,from);t+=1e6-P.hp;}return t/n;}
    function wear(it){S.equip[it.slot]=it;calcStats();return it;}
    function atSmith(){P.x=G.smiths[0].x;P.y=G.smiths[0].y+16;}
    function atArcanist(){const q=G.talkers.find(t=>t.arcanist);P.x=q.x;P.y=q.y+16;}
    function rich(){S.shards=1e6;for(const k in MATS)S.mats[k]=999;}`,R);
  return run;   // hits() switches crits off: they would blur the averages
}

test('every monster belongs to a family, every boss too, and every family has a drop and someone who drops it',()=>{
  const run=world();
  assert.deepStrictEqual(plain(run(`Object.keys(ETYPES).filter(k=>k!=='dummy'&&k!=='boss'&&!FAMILIES[ETYPES[k].fam])`)),[],'ordinary enemies');
  assert.deepStrictEqual(plain(run(`FLOORS.filter(F=>!FAMILIES[F.boss.fam]).map(F=>F.boss.name)`)),[],'bosses');
  assert.ok(run(`Object.keys(FAMILIES).every(f=>MATS[FAMILIES[f].mat]&&MATS[FAMILIES[f].mat].fam===f)`),'each family names its own drop');
  assert.ok(run(`Object.keys(FAMILIES).every(f=>Object.keys(ETYPES).some(k=>ETYPES[k].fam===f&&FLOORS.some(F=>F.spawns.includes(k)||F.wall&&F.wall.type===k)))`),'each family is in the tower');
  assert.strictEqual(run(`famOf(G.bossEnt)`),'spirit','the floor 1 boss is a spirit');
  assert.strictEqual(run(`famOf(makeEnemy('dummy',0,0,1,1,false))`),null,'a scarecrow is nobody’s family');
});

test('a monster drops only its own family’s drop; bosses and elites always do; chests never do',()=>{
  const run=world(3);
  run(`globalThis.fall=(type,elite,n)=>{G.drops=[];for(let i=0;i<n;i++){const e=makeEnemy(type,P.x,P.y,1,1,elite);G.enemies.push(e);killEnemy(e);}
    const m={};for(const d of G.drops)if(d.k==='mat'&&MATS[d.id].fam)m[d.id]=(m[d.id]||0)+d.amt;return m;};`);
  const skel=run(`fall('skel',false,400)`);
  assert.deepStrictEqual(Object.keys(skel),['bone'],'only bone from the dead');
  assert.ok(skel.bone>80&&skel.bone<160,`about 30% of 400 kills, got ${skel.bone}`);
  assert.deepStrictEqual(Object.keys(run(`fall('bloodbloom',false,200)`)),['thornwood']);
  const hermit=run(`fall('hermit',false,100)`);
  assert.ok(hermit.chitin>=100&&hermit.chitin<=200,'a hermit always leaves 1 or 2 plates');
  const elite=run(`fall('shade',true,50)`);
  assert.ok(elite.essence>=100&&elite.essence<=150,'an elite always leaves 2 or 3');
  const boss=run(`G.drops=[];killEnemy(G.bossEnt);G.drops.filter(d=>d.k==='mat'&&d.id==='bone').reduce((a,d)=>a+d.amt,0)`);
  assert.ok(boss>=6&&boss<=8,'the floor 3 boss leaves 6 to 8 bones');
  assert.strictEqual(run(`G.drops=[];for(let i=0;i<50;i++)dropLoot('chest',P.x,P.y);G.drops.filter(d=>d.k==='mat'&&MATS[d.id].fam).length`),0,'chests have no family');
  // picked up like any material
  run(`G.drops=[];S.mats.bone=0;drop({k:'mat',id:'bone',amt:3,x:P.x,y:P.y},P.x,P.y);for(let i=0;i<20;i++){P.in={mx:0,my:0};simUpdate(1/30);}`);
  assert.strictEqual(run(`S.mats.bone`),3);
});

test('forging: the blacksmith makes weapons, armour and boots from a family’s drops; the arcanist makes grimoires',()=>{
  const run=world(0);
  run(`rich();`);
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'not from across the village');
  run(`atSmith();`);
  const before=run(`({shards:S.shards,bone:S.mats.bone,scrap:S.mats.scrap})`);
  const i=run(`runAction('forge',['weapon','sword','undead'])`);
  assert.strictEqual(i,0,'it lands in the bag');
  const it=run(`S.inv[0]`),F=run(`FORGING.weapon`);
  assert.strictEqual(it.name,'Gravebane longsword');
  assert.strictEqual(it.rarity,2,'always Rare');assert.strictEqual(it.fam.id,'undead');
  assert.ok(it.fam.v>=F.bonus[0]&&it.fam.v<=F.bonus[1],'the bonus is inside its range');
  assert.strictEqual(it.aff.length,1,'with a Rare piece’s one random bonus');
  const after=run(`({shards:S.shards,bone:S.mats.bone,scrap:S.mats.scrap})`);
  assert.deepStrictEqual([before.shards-after.shards,before.bone-after.bone,before.scrap-after.scrap],[F.shards,F.drops,F.scrap],'it costs what the table says at item level 1');
  assert.strictEqual(run(`S.mats.essence`),999,'and nothing of any other family');
  assert.strictEqual(run(`S.inv[runAction('forge',['armor','plate','plant'])].name`),'Thornward plate cuirass');
  assert.strictEqual(run(`S.inv[runAction('forge',['boots','greaves','spirit'])].name`),'Shadeward greaves');
  assert.strictEqual(run(`runAction('forge',['weapon','grimoire:magic','undead'])`),false,'the blacksmith does not write grimoires');
  run(`atArcanist();`);
  const g=run(`S.inv[runAction('forge',['weapon','grimoire:faith','beast'])]`);
  assert.strictEqual(g.school,'faith');assert.strictEqual(g.fam.id,'beast');assert.strictEqual(g.name,'Beastbane grimoire');
  assert.ok(g.aff.every(a=>run(`!!GRIM.faith.pool['${a.id}']`)),'a grimoire still only rolls its own school’s bonuses');
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'the arcanist forges nothing else');
});

test('forging refuses what it cannot make or you cannot pay for',()=>{
  const run=world(0);
  run(`rich();atSmith();`);
  for(const args of[['trinket','ring','undead'],['weapon','sword','dragon'],['weapon','plate','undead'],['armor','sword','undead'],['weapon','sword:magic','undead'],
    ['weapon','grimoire','undead'],['weapon','grimoire:shadow','undead'],['__proto__','sword','undead'],['weapon','constructor','undead'],['weapon','sword','constructor'],['weapon',null,'undead']])
    assert.strictEqual(run(`runAction('forge',${JSON.stringify(args)})`),false,JSON.stringify(args));
  assert.strictEqual(run(`S.inv.length`),0);
  run(`S.mats.bone=FORGING.weapon.drops-1;`);
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'one bone short');
  run(`S.mats.bone=99;S.shards=forgeRecipe('weapon','undead').shards-1;`);
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'one shard short');
  run(`S.shards=1e6;S.mats.scrap=0;`);
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'no scrap');
  run(`rich();while(S.inv.length<BAG_SIZE)S.inv.push(makeBoots('boots',1,0));`);
  assert.strictEqual(run(`runAction('forge',['weapon','sword','undead'])`),false,'no room in the bag');
  assert.strictEqual(run(`S.mats.bone`),999,'and nothing was taken');
  // the item level, and the price, follow the highest floor reached
  run(`S.inv=[];S.best=3;`);
  assert.strictEqual(run(`S.inv[runAction('forge',['weapon','sword','undead'])].ilvl`),3);
  assert.strictEqual(run(`forgeRecipe('weapon','undead').shards`),Math.round(run(`FORGING.weapon.shards`)*1.6));
});

test('a forged weapon hits its own family harder, and nothing else',()=>{
  const run=world();
  run(`wear(Object.assign(makeWeapon('sword',1,0),{aff:[],fam:{id:'undead',v:20}}));`);
  assert.deepStrictEqual(plain(run(`ST.vs`)),{undead:20});
  const base=run(`ST.dmg`);
  const near=(got,want,msg)=>assert.ok(Math.abs(got-want)<want*.03,`${msg}: got ${got.toFixed(2)}, want about ${want.toFixed(2)}`);
  near(run(`hits(2000,foe('skel'))`),base*1.2,'+20% to a bone soldier');
  near(run(`hits(2000,foe('shade'))`),base,'nothing extra to a shade');
  near(run(`hits(2000,foe('thornroot'))`),base,'nothing extra to a plant');
  run(`setWorld(genFloor(2,7));G.players=[pl];setPlayer(pl);G.bossEnt.hp=G.bossEnt.maxHp=1e9;`);
  near(run(`hits(2000,G.bossEnt)`),base*1.2,'+20% to the Bone Regent');
});

test('every "% more damage" adds up in one bucket and is applied once',()=>{
  const run=world();
  run(`wear(Object.assign(makeWeapon('great',1,0),{aff:[{id:'giant',v:30},{id:'execute',v:40}],fam:{id:'undead',v:20}}));`);
  const base=run(`ST.dmg`);
  // an elite bone soldier, marked by Sunder, below 30% health: 20 + 30 + 40 + 25 = 115% more, not 1.2 x 1.3 x 1.4 x 1.25
  const got=run(`const e=makeEnemy('skel',P.x+12,P.y,1,1,true);e.maxHp=1e9;e.hp=1e8;e.sunder=99;e.state='chase';G.enemies.push(e);hits(2000,e)`);
  assert.ok(Math.abs(got-base*2.15)<base*.06,`got ${got.toFixed(2)}, want about ${(base*2.15).toFixed(2)}`);
});

test('forged armour and boots take less from their family, shots included, and the two add up',()=>{
  const run=world();
  const near=(got,want,msg)=>assert.ok(Math.abs(got-want)<=1,`${msg}: got ${got}, want about ${want}`);
  const bare=run(`taken(50,foe('skel'))`);
  run(`wear(Object.assign(makeArmor('tunic',1,0),{aff:[],fam:{id:'undead',v:20}}));`);
  assert.deepStrictEqual(plain(run(`ST.res`)),{undead:20});
  const worn=run(`taken(50,foe('skel'))`),other=run(`taken(50,foe('shade'))`);
  assert.ok(worn<other&&worn<bare,'less from the dead than from a shade, and less than before');
  near(worn,run(`20*100/(100+ST.def)`)*.8,'20% less from a bone soldier');
  near(other,run(`20*100/(100+ST.def)`),'a shade hits as hard as ever');
  run(`wear(Object.assign(makeBoots('boots',1,0),{aff:[],fam:{id:'undead',v:10}}));`);
  assert.deepStrictEqual(plain(run(`ST.res`)),{undead:30});
  near(run(`taken(50,foe('skel'))`),run(`20*100/(100+ST.def)`)*.7,'30% less with both');
  // a shot remembers who fired it
  near(run(`taken(50,null,{x:P.x+9,y:P.y,fam:'undead'})`),run(`20*100/(100+ST.def)`)*.7,'30% less from a bone archer’s arrow');
  near(run(`taken(50,null,{x:P.x+9,y:P.y})`),run(`20*100/(100+ST.def)`),'nothing off a shot from nobody');
  // every enemy shot in the rules carries its shooter's family
  run(`G.enemies=[];G.proj=[];const r=G.rooms.find(q=>q.kind==='room');P.x=(r.x+2.5)*TILE;P.y=(r.y+2.5)*TILE;   // out of the safe start room
    const a=foe('skelarcher');a.x=P.x+50;a.dir=2;a.state='draw';a.t=0;for(let i=0;i<3;i++){P.in={mx:0,my:0};simUpdate(1/30);}`);
  assert.strictEqual(run(`G.proj.length&&G.proj[0].fam`),'undead');
});

test('salvaging a forged piece gives back a third of its drops; old saves and plain gear are untouched',()=>{
  const run=world(0);
  run(`rich();atSmith();runAction('forge',['armor','plate','plant']);S.mats.thornwood=0;runAction('salvage',[0]);`);
  assert.strictEqual(run(`S.mats.thornwood`),Math.floor(run(`FORGING.armor.drops`)/3));
  assert.deepStrictEqual(plain(run(`salvageMats(makeArmor('plate',1,2))`)),{scrap:3},'plain gear returns no monster drops');
  // a save from before families: no family materials, no fam on anything
  const st=run(`const old=JSON.parse(JSON.stringify(newState('O',{},'bow','#222')));old.mats={scrap:2,ember:0,crystal:0};const m=migrateSave(old);computeStats(m.char,m.equip)`);
  assert.deepStrictEqual(plain([st.vs,st.res]),[{},{}]);
  assert.ok(run(`[makeWeapon('sword',3,2),makeArmor('plate',3,3),randomItem(2,50,2)].every(it=>!it.fam)`),'drops and shop stock never carry a family');
  assert.ok(run(`setWorld(genVillage());G.players=[pl];setPlayer(pl);makeStock('weapons').concat(makeStock('gear')).every(e=>!e.it.fam)`));
});

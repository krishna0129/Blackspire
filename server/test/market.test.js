'use strict';
// The market (js/sim/market.js): the exchange's moving prices, buying and selling, and the rules that keep it from
// being milked. Run headless like the server.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');
const plain=v=>JSON.parse(JSON.stringify(v));   // objects from the rules' sandbox have its own prototypes

// A character standing at the exchange in the village, with a clock the test can move.
function market(){
  const R=loadRules(),run=code=>vm.runInContext(`{${code}}`,R);
  vm.runInContext(`const s=newState('T',{},'sword','#222');setWorld(genVillage());const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);
    const ex=G.traders.find(t=>t.sells==='market');P.x=ex.x;P.y=ex.y+14;
    let NOW=Date.UTC(2026,0,1,12,10);Date.now=()=>NOW;   // ten past the hour, so "an hour later" is a new hour for certain
    function hours(h){NOW+=h*MARKET_HOUR;}`,R);
  return run;
}

test('the exchange is in the village market, reachable, and only it trades',()=>{
  const run=market();
  assert.ok(run(`nearExchange()`));
  assert.ok(plain(run(`runAction('market',[])`)).stock.bone===run(`MARKET.bone.stock`),'a fresh book holds the normal stock');
  run(`S.shards=1e6;P.x=G.smiths[0].x;P.y=G.smiths[0].y+16;`);
  assert.strictEqual(run(`runAction('market',[])`),false,'not from the forge');
  assert.strictEqual(run(`runAction('marketBuy',['bone',1,999])`),false);
  assert.strictEqual(run(`S.mats.bone||0`),0);
});

test('one rule for every price: base x normal stock / stock now, held between half and double; selling pays 80%',()=>{
  const run=market();
  for(const k of plain(run(`Object.keys(MARKET)`))){
    const M=plain(run(`MARKET.${k}`));
    assert.ok(M.stock>=10&&M.base>=1&&run(`!!MATS.${k}`),k+' is a real material with a stock of 10 or more');
    assert.strictEqual(run(`buyAt('${k}',${M.stock})`),M.base,k+' at its usual price when the stock is normal');
    assert.strictEqual(run(`buyAt('${k}',${M.stock/2})`),M.base*2,k+' doubles at half stock');
    assert.strictEqual(run(`buyAt('${k}',1)`),M.base*2,k+' never more than double');
    assert.strictEqual(run(`buyAt('${k}',0)`),M.base*2);
    assert.strictEqual(run(`buyAt('${k}',${M.stock*2})`),Math.max(1,Math.round(M.base/2)),k+' halves at double stock');
    assert.strictEqual(run(`buyAt('${k}',${M.stock*50})`),Math.max(1,Math.round(M.base/2)),k+' never less than half');
    assert.strictEqual(run(`sellAt('${k}',${M.stock})`),Math.floor(M.base*.8),k+' sells for 80%');
  }
});

test('no round trip pays: buying one and selling it back, or the other way round, never makes a shard',()=>{
  const run=market();
  const bad=plain(run(`const out=[];for(const k in MARKET)for(let s=0;s<=MARKET[k].stock*3;s++){
    if(s>=1&&sellAt(k,s-1)>buyAt(k,s))out.push(k+' buy then sell at '+s);
    if(buyAt(k,s+1)<sellAt(k,s))out.push(k+' sell then buy at '+s);}
    out`));
  assert.deepStrictEqual(bad,[]);
  // and in practice: any run of buys followed by selling the lot back loses money
  for(const[k,n]of[['scrap',40],['crystal',6],['bone',25],['chitin',15]]){
    run(`S.market=null;S.sold=null;S.shards=100000;S.mats.${k}=0;`);
    const paid=plain(run(`runAction('marketBuy',['${k}',${n},1e9])`)),got=plain(run(`runAction('marketSell',['${k}',${n},0])`));
    assert.ok(paid.ok&&got.ok,k);assert.ok(got.total<paid.total,`${k}: paid ${paid.total}, got back ${got.total}`);
    assert.strictEqual(run(`S.shards`),100000-paid.total+got.total);
    assert.strictEqual(run(`marketStock('${k}')`),run(`MARKET.${k}.stock`),'the stock is back where it was');
  }
});

test('buying moves the price up and selling moves it down, and the price shown is the price paid',()=>{
  const run=market();
  run(`S.shards=10000;S.mats.bone=0;`);
  const p0=run(`buyAt('bone',marketStock('bone'))`),q5=run(`marketQuote('buy','bone',5)`);
  const r=plain(run(`runAction('marketBuy',['bone',5,${q5}])`));
  assert.ok(r.ok);assert.strictEqual(r.total,q5);
  assert.strictEqual(run(`S.shards`),10000-q5);assert.strictEqual(run(`S.mats.bone`),5);
  assert.strictEqual(r.book.stock.bone,run(`MARKET.bone.stock`)-5);
  run(`runAction('marketBuy',['bone',20,1e9]);`);
  const p1=run(`buyAt('bone',marketStock('bone'))`);assert.ok(p1>p0,`dearer after 25 were bought: ${p0} -> ${p1}`);
  // selling
  run(`S.sold=null;S.mats.essence=30;`);
  const s0=run(`sellAt('essence',marketStock('essence'))`),q=run(`marketQuote('sell','essence',30)`),before=run(`S.shards`);
  const sold=plain(run(`runAction('marketSell',['essence',30,${q}])`));
  assert.ok(sold.ok);assert.strictEqual(run(`S.shards`),before+q);assert.strictEqual(run(`S.mats.essence`),0);
  assert.ok(q<s0*30,'thirty at once pay less than thirty times the first price');
  assert.ok(run(`sellAt('essence',marketStock('essence'))`)<s0,'and the next one pays less');
  // a bulk buy costs exactly what buying one at a time would
  run(`S.market=null;`);const bulk=run(`marketQuote('buy','ember',8)`);
  assert.strictEqual(run(`let t=0;for(let i=0;i<8;i++)t+=runAction('marketBuy',['ember',1,1e9]).total;t`),bulk);
});

test('a trade is refused, and nothing changes, when the price moved, the stock or the shards run out, or the hourly limit is reached',()=>{
  const run=market();
  const snap=()=>plain(run(`({shards:S.shards,mats:S.mats,stock:marketView().stock})`));
  run(`S.shards=500;S.mats.bone=100;`);
  // someone else bought in between: the quote on screen is stale
  const q=run(`marketQuote('buy','bone',10)`);run(`marketBook().stock.bone=marketStock('bone')-20;`);
  let a=snap();let r=plain(run(`runAction('marketBuy',['bone',10,${q}])`));
  assert.deepStrictEqual([r.ok,r.why],[false,'price']);assert.deepStrictEqual(snap(),a);
  assert.ok(r.book.stock.bone===run(`MARKET.bone.stock`)-20,'the refusal carries the book as it is now');
  const qs=run(`marketQuote('sell','bone',10)`);run(`marketBook().stock.bone=marketStock('bone')+60;`);
  r=plain(run(`runAction('marketSell',['bone',10,${qs}])`));assert.deepStrictEqual([r.ok,r.why],[false,'price']);
  // not enough shards, not enough stock, not enough to sell
  run(`S.shards=3;`);assert.strictEqual(plain(run(`runAction('marketBuy',['crystal',1,1e9])`)).why,'shards');
  run(`S.shards=1e6;`);assert.strictEqual(plain(run(`runAction('marketBuy',['crystal',13,1e9])`)).why,'stock');
  assert.strictEqual(plain(run(`runAction('marketSell',['chitin',1,0])`)).why,'have');
  // the hourly limit: half the normal stock of a good, per seller, per hour
  const cap=run(`marketCap('bone')`);assert.strictEqual(cap,run(`MARKET.bone.stock`)/2);
  assert.ok(plain(run(`runAction('marketSell',['bone',${cap},0])`)).ok);
  assert.strictEqual(run(`marketRoom('bone')`),0);
  a=snap();r=plain(run(`runAction('marketSell',['bone',1,0])`));assert.deepStrictEqual([r.ok,r.why],[false,'limit']);assert.deepStrictEqual(snap(),a);
  assert.strictEqual(run(`marketRoom('essence')`),run(`marketCap('essence')`),'each good has its own limit');
  run(`hours(1);`);assert.strictEqual(run(`marketRoom('bone')`),cap,'and it starts again with the next hour');
  // nonsense
  for(const args of[['dragon',1,9],['bone',0,9],['bone',-3,9],['bone',1.5,9],['bone',1000,9],['__proto__',1,9],['constructor',1,9],['bone','2',9],['bone',1,'x'],['potato',1,9]])
    assert.strictEqual(run(`runAction('marketBuy',${JSON.stringify(args)})`),false,JSON.stringify(args));
  assert.strictEqual(run(`runAction('marketSell',['bone',NaN,0])`),false);
});

test('stock drifts back to normal: a tenth of the normal stock each hour, from either side',()=>{
  const run=market();
  run(`S.shards=1e6;runAction('marketBuy',['bone',40,1e9]);S.mats.essence=30;runAction('marketSell',['essence',30,0]);`);
  const n=run(`MARKET.bone.stock`);
  assert.deepStrictEqual(plain(run(`[marketStock('bone'),marketStock('essence')]`)),[n-40,n+30]);
  run(`NOW+=59*60000;`);assert.strictEqual(run(`marketStock('bone')`),n-40,'nothing within the hour');
  run(`NOW+=60000;`);assert.deepStrictEqual(plain(run(`[marketStock('bone'),marketStock('essence')]`)),[n-34,n+24],'six back after one hour');
  run(`hours(3);`);assert.deepStrictEqual(plain(run(`[marketStock('bone'),marketStock('essence')]`)),[n-16,n+6]);
  run(`hours(50);`);assert.deepStrictEqual(plain(run(`[marketStock('bone'),marketStock('essence')]`)),[n,n],'and it stops at normal');
  assert.strictEqual(run(`buyAt('bone',marketStock('bone'))`),run(`MARKET.bone.base`));
  // a book that is damaged or from the future does not break anything
  run(`S.market={t:NOW+1e12,stock:{bone:'lots',ember:-5}};`);
  assert.deepStrictEqual(plain(run(`[marketStock('bone'),marketStock('ember')]`)),[n,run(`MARKET.ember.stock`)]);
  run(`S.market=7;`);assert.strictEqual(run(`marketStock('bone')`),n);
});

test('single player keeps the book in the save; a shared book (online) is used instead when the village has one',()=>{
  const run=market();
  run(`S.shards=1e6;runAction('marketBuy',['bone',10,1e9]);`);
  assert.strictEqual(run(`S.market.stock.bone`),run(`MARKET.bone.stock`)-10);
  assert.strictEqual(plain(run(`migrateSave(JSON.parse(JSON.stringify(S)))`)).market.stock.bone,run(`MARKET.bone.stock`)-10,'it survives saving and loading');
  // two characters, one shared book: the second pays the price the first left
  run(`G.market={t:NOW,stock:{}};globalThis.s2=newState('U',{},'bow','#222');const p2=makePlayer(2,s2);p2.x=P.x;p2.y=P.y;G.players.push(p2);s2.shards=1e6;
    runAction('marketBuy',['ember',15,1e9]);globalThis.left=buyAt('ember',marketStock('ember'));setPlayer(p2);`);
  assert.strictEqual(run(`marketQuote('buy','ember',1)`),run(`left`));
  assert.ok(run(`left`)>run(`MARKET.ember.base`));
  assert.strictEqual(run(`s2.market`),undefined,'the second character’s save holds no book of its own');
  assert.strictEqual(run(`s.market.stock.ember`),undefined,'and the first one’s own book was not touched');
  assert.strictEqual(run(`marketRoom('bone')`),run(`marketCap('bone')`),'but the hourly selling limit is each character’s own');
});

test('the guild asks for monster drops too, and pays 30% over the exchange’s usual price',()=>{
  const run=market();
  const days=plain(run(`const out=[];for(let d=20000;d<20060;d++)out.push(questBoard(d).filter(q=>q.kind==='deliver').map(q=>[q.mat,q.n,q.reward.shards]));out`));
  assert.ok(days.every(d=>d.length===2&&!run(`MATS.${d[0][0]}.fam`)&&!!run(`MATS.${d[1][0]}.fam`)),'one material and one monster drop every day');
  assert.ok(new Set(days.map(d=>d[1][0])).size>=3,'different families on different days');
  for(const d of days)for(const[mat,n,shards]of d)assert.strictEqual(shards,Math.round(n*run(`MARKET.${mat}.base`)*1.3));
});

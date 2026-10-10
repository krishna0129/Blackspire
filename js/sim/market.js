'use strict';
// Blackspire: the market (docs/design/world.md). The village's exchange buys and sells stackable goods: materials and
// monster drops (MARKET, data.js). One rule sets every price, from how much of a good the exchange holds:
//
//   buy price  = base x clamp(normal stock / stock now, 0.5, 2)     rounded
//   sell price = 80% of that                                       rounded down
//
// Buying takes one from the stock, so the next one costs a little more; selling adds one, so the next sale pays a
// little less. Each hour the stock moves a tenth of its normal size back toward normal, so prices recover.
//
// The stock is "the book": {t, stock:{good: count}}. Single player keeps one in the save (S.market). Online, the
// server keeps one for everybody and hangs it on every copy of the village (G.market), so players move each other's
// prices; a browser shows the copy the server last sent it.

// The book, brought up to now. A good the book has never seen holds its normal stock.
function marketBook(now=Date.now()){
  let B=G.market||S.market;if(!B||typeof B!=='object')B=S.market={t:now,stock:{}};
  if(!B.stock||typeof B.stock!=='object')B.stock={};
  if(!(B.t<=now))B.t=now;
  const hours=Math.floor((now-B.t)/MARKET_HOUR);
  if(hours>0){B.t+=hours*MARKET_HOUR;
    for(const k in MARKET){const n=MARKET[k].stock,s=marketStock(k,B),step=Math.max(1,Math.round(n*MARKET_DRIFT))*hours;
      B.stock[k]=s<n?Math.min(n,s+step):Math.max(n,s-step);}}
  return B;
}
function marketStock(k,B=marketBook()){const s=B.stock[k];return Number.isFinite(s)&&s>=0?Math.floor(s):MARKET[k].stock;}
// what one costs, and what one sells for, when the exchange holds s of it
const marketFactor=(k,s)=>clamp(MARKET[k].stock/Math.max(s,.001),MARKET_MIN,MARKET_MAX);
const buyAt=(k,s)=>Math.max(1,Math.round(MARKET[k].base*marketFactor(k,s)));
const sellAt=(k,s)=>Math.max(1,Math.floor(MARKET[k].base*marketFactor(k,s)*MARKET_SPREAD));
// What n of a good cost to buy (side 'buy') or pay when sold ('sell') right now, one at a time, each at the price the
// one before it left. null when the exchange does not hold n to sell you.
function marketQuote(side,k,n,B=marketBook()){
  let s=marketStock(k,B),total=0;
  for(let i=0;i<n;i++){if(side==='buy'){if(s<1)return null;total+=buyAt(k,s);s--;}else{total+=sellAt(k,s);s++;}}
  return total;
}
// How many more of a good the exchange takes from the current player this hour: half its normal stock an hour, each.
// The count is kept in the save (S.sold), by the hour.
const marketHour=(now=Date.now())=>Math.floor(now/MARKET_HOUR);
const marketCap=k=>Math.max(1,Math.floor(MARKET[k].stock*MARKET_SELL_SHARE));
function marketRoom(k,now=Date.now()){const L=S.sold;return marketCap(k)-(L&&L.h===marketHour(now)&&L.n[k]||0);}
// A copy of the book to hand to a browser: every good's stock, and when it last drifted.
function marketView(){const B=marketBook(),stock={};for(const k in MARKET)stock[k]=marketStock(k,B);return{t:B.t,stock};}
const nearExchange=(r=40)=>(G.traders||[]).some(q=>q.sells==='market'&&hyp(q.x-P.x,q.y-P.y)<r);

// Buys n of good k for the current player. max: the most they agreed to pay for all n (the price on their screen),
// so a price that moved since, because someone else bought, is refused instead of charged. Returns {ok, total, book},
// or {ok:false, why, book} with why 'stock', 'price' or 'shards'.
function marketBuy(k,n,max){
  const B=marketBook(),total=marketQuote('buy',k,n,B),no=why=>({ok:false,why,book:marketView()});
  if(total==null)return no('stock');
  if(max!=null&&total>max)return no('price');
  if(S.shards<total)return no('shards');
  S.shards-=total;S.mats[k]=(S.mats[k]||0)+n;B.stock[k]=marketStock(k,B)-n;
  return{ok:true,total,book:marketView()};
}
// Sells n of good k. min: the least they agreed to take for all n. why: 'have', 'limit' or 'price'.
function marketSell(k,n,min){
  const B=marketBook(),total=marketQuote('sell',k,n,B),no=why=>({ok:false,why,book:marketView()});
  if((S.mats[k]||0)<n)return no('have');
  if(marketRoom(k)<n)return no('limit');
  if(min!=null&&total<min)return no('price');
  const h=marketHour();if(!S.sold||S.sold.h!==h)S.sold={h,n:{}};
  S.sold.n[k]=(S.sold.n[k]||0)+n;S.mats[k]-=n;S.shards+=total;B.stock[k]=marketStock(k,B)+n;
  return{ok:true,total,book:marketView()};
}

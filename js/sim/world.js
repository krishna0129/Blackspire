'use strict';
// Blackspire: Floor generation and tile painting.

/* ---------- floor generation ---------- */
// Builds floor n. The layout depends only on (seed, n), so a server and its clients build the same map.
function genFloor(n,seed){
  const rng=mulberry32((seed^Math.imul(n,2654435761))>>>0),ri=(a,b)=>a+Math.floor(rng()*(b-a+1));
  const map=new Uint8Array(MW*MH),rooms=[];   // 0 void, 1 floor, 2 wall, 3 boss gate (solid until the boss dies)
  const fits=r=>rooms.every(o=>r.x+r.w+2<=o.x||o.x+o.w+2<=r.x||r.y+r.h+2<=o.y||o.y+o.h+2<=r.y);
  const start={x:ri(3,9),y:ri(4,MH-13),w:8,h:7,kind:'start'};rooms.push(start);
  // The boss chamber sits alone on the east side. Everything else stays west of `limit`,
  // so no corridor can ever cut through it and the only ways in are its three gates.
  const boss={x:ri(MW-22,MW-19),y:ri(7,MH-19),w:14,h:12,kind:'boss'},limit=boss.x-11;
  const want=16+Math.min(4,n);
  for(let i=0;i<1500&&rooms.length<want+1;i++){const w=ri(6,12),h=ri(5,9),r={x:ri(2,limit-w),y:ri(2,MH-h-3),w,h,kind:'room'};if(fits(r))rooms.push(r);}
  const cx=r=>r.x+(r.w>>1),cy=r=>r.y+(r.h>>1);
  const set=(X,Y)=>{if(X>0&&Y>0&&X<MW-1&&Y<MH-1)map[Y*MW+X]=1;};
  rooms.push(boss);
  for(const r of rooms)for(let y=r.y;y<r.y+r.h;y++)for(let X=r.x;X<r.x+r.w;X++)set(X,y);
  const carveH=(x1,x2,y)=>{for(let X=Math.min(x1,x2);X<=Math.max(x1,x2)+1;X++){set(X,y);set(X,y+1);}};
  const carveV=(y1,y2,X)=>{for(let y=Math.min(y1,y2);y<=Math.max(y1,y2)+1;y++){set(X,y);set(X+1,y);}};
  const connect=(a,b)=>{const ax=cx(a),ay=cy(a),bx=cx(b),by=cy(b);if(rng()<.5){carveH(ax,bx,ay);carveV(ay,by,bx);}else{carveV(ay,by,ax);carveH(ax,bx,by);}};
  // chain: start -> nearest unvisited -> ...
  const rest=rooms.filter(r=>r.kind==='room'),order=[start];let cur=start;
  while(rest.length){let bi=0,bd=1e9;rest.forEach((r,i)=>{const d=hyp(cx(r)-cx(cur),cy(r)-cy(cur));if(d<bd){bd=d;bi=i;}});cur=rest.splice(bi,1)[0];order.push(cur);}
  for(let i=1;i<order.length;i++)connect(order[i-1],order[i]);
  if(order.length>=4)for(let i=0;i<4;i++){const a=ri(0,order.length-3);connect(order[a],order[a+2]);}
  // Safe rooms: two of them, a third and two thirds of the way along the route. No enemies or chests spawn there.
  // Safe points: at most three a floor. The start room, one room about half way along the route,
  // and an antechamber in front of the boss chamber's west gate (made below).
  if(order.length>=5)order[Math.floor(order.length/2)].kind='safe';
  // three approaches (north, west, south), each linked to its own nearest room
  const hubX=boss.x-10,midY=boss.y+(boss.h>>1)-1,gN=boss.x+ri(3,boss.w-5),gS=boss.x+ri(3,boss.w-5);
  const pts=[{x:hubX,y:boss.y-4},{x:hubX,y:midY},{x:hubX,y:boss.y+boss.h+2}],used=new Set();
  for(const p of pts){
    let best=null,bd=1e9;
    for(const r of order){if(r===start&&order.length>2)continue;if(used.has(r)&&used.size<order.length-1)continue;const d=hyp(cx(r)-p.x,cy(r)-p.y);if(d<bd){bd=d;best=r;}}
    used.add(best);carveH(cx(best),p.x,cy(best));carveV(cy(best),p.y,p.x);
  }
  carveH(hubX,gN,boss.y-4);carveV(boss.y-4,boss.y-3,gN);
  const ante={x:boss.x-7,y:midY-2,w:6,h:6,kind:'safe',smith:[2.3,1.5]};rooms.push(ante);
  for(let y=ante.y;y<ante.y+ante.h;y++)for(let X=ante.x;X<ante.x+ante.w;X++)set(X,y);
  carveH(hubX,boss.x-9,midY);
  carveH(hubX,gS,boss.y+boss.h+2);carveV(boss.y+boss.h+1,boss.y+boss.h+2,gS);
  const T=TILE,gates=[
    {tiles:[[gN,boss.y-1],[gN+1,boss.y-1]],x:(gN+1)*T,y:(boss.y-.5)*T,ix:(gN+1)*T,iy:(boss.y+1.3)*T},
    {tiles:[[boss.x-1,midY],[boss.x-1,midY+1]],x:(boss.x-.5)*T,y:(midY+1)*T,ix:(boss.x+1.3)*T,iy:(midY+1)*T},
    {tiles:[[gS,boss.y+boss.h],[gS+1,boss.y+boss.h]],x:(gS+1)*T,y:(boss.y+boss.h+.5)*T,ix:(gS+1)*T,iy:(boss.y+boss.h-1.3)*T},
  ];
  for(const q of gates)for(const t of q.tiles)map[t[1]*MW+t[0]]=3;
  for(let y=0;y<MH;y++)for(let X=0;X<MW;X++){if(map[y*MW+X])continue;
    out:for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=X+dx,ny=y+dy;if(nx<0||ny<0||nx>=MW||ny>=MH)continue;if(map[ny*MW+nx]===1){map[y*MW+X]=2;break out;}}}
  const g={n,map,rooms,start,boss,gates,gatesOpen:false,locked:false,enemies:[],chests:[],drops:[],proj:[],pproj:[],fx:[],nums:[],parts:[],tele:[],timers:[],
    players:[],seen:new Uint8Array(MW*MH),gate:null,bossAwake:false,bossEnt:null,shake:0,time:0};
  const hpM=1+.38*(n-1),dmgM=1+.22*(n-1);
  g.hpM=hpM;g.dmgM=dmgM;
  // A blacksmith stands in the start room and in each safe room. g.safe[i] is the rectangle around g.smiths[i]; index 0 is the start.
  // What each one sells is kept in each player's save, not here: see shopOf().
  const safeRooms=[start,...rooms.filter(r=>r.kind==='safe')];
  g.safe=safeRooms.map(r=>({x0:r.x*TILE,y0:r.y*TILE,x1:(r.x+r.w)*TILE,y1:(r.y+r.h)*TILE}));
  g.smiths=safeRooms.map((r,i)=>i?{x:(r.x+(r.smith?r.smith[0]:r.w/2))*TILE,y:(r.y+(r.smith?r.smith[1]:r.h/2))*TILE-(r.smith?0:6)}:{x:(r.x+1.8)*TILE,y:(r.y+1.6)*TILE});
  // floor 1: shadow creatures. floor 2 on: mostly the dead, with a few living things left for spell-casters
  const bag=n<2?['shade','shade','shade','skitter','skitter','skitter','brute','wisp']:['skel','skel','skel','skelarcher','skelarcher','skelknight','skitter','wisp'];
  for(const r of rooms){
    if(r.kind!=='room')continue;
    const cnt=2+Math.floor(r.w*r.h/24)+ri(0,1)+Math.min(2,Math.floor((n-1)/2));
    for(let i=0;i<cnt;i++)g.enemies.push(makeEnemy(bag[ri(0,bag.length-1)],(ri(r.x+1,r.x+r.w-2)+.5)*TILE,(ri(r.y+1,r.y+r.h-2)+.5)*TILE,hpM,dmgM,rng()<.07));
    if(rng()<.4)g.chests.push({x:(ri(r.x+1,r.x+r.w-2)+.5)*TILE,y:(ri(r.y+1,r.y+r.h-2)+.5)*TILE});   // opened or not is per player: floorState(n).chests
  }
  // The boss is always there, even on a floor you have cleared: a rematch is optional (the floor gate takes you past it)
  // and it is how boss loot is farmed.
  const b=makeEnemy('boss',(cx(boss)+.5)*TILE,(cy(boss)+.5)*TILE,hpM,dmgM,false);
  b.boss=true;b.name=BOSSES[(n-1)%BOSSES.length];b.atkT=1.5;b.summons=0;g.enemies.push(b);g.bossEnt=b;
  if(n===2){b.skin='skelknight';b.mres=.5;b.calls='skel';}   // The Bone Regent: half magic resistance, raises bone soldiers
  // The floor gate in the start room travels to any floor you have unlocked.
  g.home={x:(start.x+start.w-1.8)*TILE,y:(start.y+1.6)*TILE};
  return g;
}
function openGates(){for(const q of G.gates)for(const t of q.tiles)G.map[t[1]*MW+t[0]]=1;G.gatesOpen=true;for(const pl of G.players)pl.locked=false;mapChanged();}
function safeIndex(x,y){const a=G.safe;for(let i=0;i<a.length;i++){const r=a[i];if(x>=r.x0&&x<r.x1&&y>=r.y0&&y<r.y1)return i;}return -1;}
const inSafe=(x,y)=>safeIndex(x,y)>=0;
const nearHome=()=>G.home&&hyp(G.home.x-P.x,G.home.y-P.y)<20;
function nearSmith(){for(const q of G.smiths)if(hyp(q.x-P.x,q.y-P.y)<26)return q;return null;}
function nearGate(){
  if(G.gatesOpen||P.locked||!G.bossEnt||G.bossEnt.dead)return null;
  for(const q of G.gates)if(hyp(q.x-P.x,q.y-P.y)<27)return q;
  return null;
}
let EID=0;   // enemy ids, so the server and clients can tell enemies apart in snapshots
function makeEnemy(type,x,y,hpM,dmgM,elite){
  const T=ETYPES[type],hp=Math.round(T.hp*hpM*(elite?2.4:1));
  return{id:++EID,type,x,y,r:T.r,cr:Math.min(T.r,6),hp,maxHp:hp,dmg:T.dmg*dmgM*(elite?1.3:1),speed:T.speed*(elite?1.1:1),elite,
    mres:T.mres||0,resT:-9,state:'idle',t:0,flash:0,stun:0,kx:0,ky:0,bleedT:0,bleedDps:0,bleedAcc:0,sunder:0,hurtT:0,fire:rand(1,2.4),face:1,dir:0,moving:false,think:0,hopCd:0,ph:Math.random()*TAU,bobY:0,lunge:0};
}

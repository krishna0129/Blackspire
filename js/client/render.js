'use strict';
// Blackspire: Drawing the world.

/* ---------- render ---------- */
const DIG={'0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001111001111','4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001001001001','8':'111101111101111','9':'111101111001111','!':'010010010000010',
  '+':'000010111010000','R':'110101110101101','B':'110101110101110','L':'100100100100111','C':'111100100100111','K':'101110100110101','S':'011100010001110','I':'111010010010111','T':'111010010010010','M':'101111111101101','A':'010101111101101','N':'110101101101101','D':'110101101101110','O':'111101101101111','G':'111100101101111','E':'111100110100111'};
function drawNum(str,x,y,col){
  const w=str.length*4-1;let ox=Math.round(x-w/2);y=Math.round(y);
  for(let pass=0;pass<2;pass++){ctx.fillStyle=pass?col:'#000';let cx=ox+(pass?0:1);const cy=y+(pass?0:1);
    for(const ch of str){const g=DIG[ch];if(g)for(let i=0;i<15;i++)if(g[i]==='1')ctx.fillRect(cx+i%3,cy+Math.floor(i/3),1,1);cx+=4;}}
}
function dotArc(x,y,r,a0,a1,col){ctx.fillStyle=col;const n=Math.max(2,Math.ceil(Math.abs(a1-a0)*r/1.4));for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;ctx.fillRect(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r),1,1);}}
function render(){
  // The camera is locked to the player's rounded position, so the avatar sits on one fixed screen pixel while the world scrolls.
  const sh=G.shake;camX=Math.round(P.x)-Math.floor(W/2)+(sh?Math.round(rand(-sh,sh)*.5):0);camY=Math.round(P.y)-Math.floor(H/2)+(sh?Math.round(rand(-sh,sh)*.5):0);
  ctx.fillStyle='#060609';ctx.fillRect(0,0,W,H);
  ctx.drawImage(G.mapCv,-camX,-camY);
  const t=G.time;
  // gates: the way up (cyan, after the boss falls) and the floor gate in the start room (amber)
  if(G.gate)drawPortal(G.gate,t,'#6fd6e6','#c8f3fa');
  if(G.home)drawPortal(G.home,t,'#e2b93b','#f5e2a8');
  // telegraphs
  for(const q of G.tele){const p=q.t/q.d;
    if(q.cone){const x=q.x-camX,y=q.y-camY,a0=q.a-q.half,a1=q.a+q.half;ctx.fillStyle='#d9534f';
      for(const[al,rr]of[[.14,q.len],[.3,q.len*p]]){ctx.globalAlpha=al;ctx.beginPath();ctx.moveTo(x,y);ctx.arc(x,y,rr,a0,a1);ctx.closePath();ctx.fill();}
      ctx.globalAlpha=1;dotArc(x,y,q.len,a0,a1,'#d9534f');}
    else if(q.line){ctx.save();ctx.translate(q.x-camX,q.y-camY);ctx.rotate(q.a);ctx.globalAlpha=.16+.3*p;ctx.fillStyle='#d9534f';ctx.fillRect(0,-13,q.len,26);ctx.globalAlpha=.8;ctx.fillRect(0,-13,q.len*p,1);ctx.fillRect(0,12,q.len*p,1);ctx.restore();ctx.globalAlpha=1;}
    else{const x=q.x-camX,y=q.y-camY;ctx.globalAlpha=.14;ctx.fillStyle='#d9534f';ctx.beginPath();ctx.arc(x,y,q.r,0,TAU);ctx.fill();ctx.globalAlpha=.34;ctx.beginPath();ctx.arc(x,y,q.r*p,0,TAU);ctx.fill();ctx.globalAlpha=1;dotArc(x,y,q.r,0,TAU,'#d9534f');}}
  // chests + drops
  const opened=floorState(G.n).chests;   // which chests are open is yours alone
  G.chests.forEach((c,i)=>ctx.drawImage(chestSheet(),opened.includes(i)?14:0,0,14,11,Math.round(c.x-camX-7),Math.round(c.y-camY-6),14,11));
  for(const d of G.drops){if(d.owner!==P.id)continue;const x=Math.round(d.x-camX),y=Math.round(d.y-camY+Math.sin(d.t*5)*1.2);
    if(d.k==='shard'){ctx.fillStyle='#6fd6e6';ctx.fillRect(x,y-1,1,3);ctx.fillRect(x-1,y,3,1);}
    else if(d.k==='mat'){ctx.fillStyle='#050508';ctx.fillRect(x-2,y-2,4,4);ctx.fillStyle=MATS[d.id].color;ctx.fillRect(x-1,y-1,2,2);}
    else if(d.k==='potion'){ctx.fillStyle='#050508';ctx.fillRect(x-2,y-3,5,6);ctx.fillStyle='#d9534f';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#e6e1d3';ctx.fillRect(x,y-2,1,1);}
    else{const c=RARITY[d.item.rarity].color;ctx.fillStyle='#050508';ctx.fillRect(x-3,y-1,7,3);ctx.fillRect(x-1,y-3,3,7);ctx.fillStyle=c;ctx.fillRect(x-2,y,5,1);ctx.fillRect(x,y-2,1,5);ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);}}
  // entities, y-sorted
  const list=[P];
  for(const e of G.enemies)if(e.x-camX>-48&&e.x-camX<W+48&&e.y-camY>-48&&e.y-camY<H+48)list.push(e);   // only what is on screen
  for(const q of G.smiths)list.push({smith:q,y:q.y,r:6});
  list.sort((a,b)=>(a.y+a.r)-(b.y+b.r));
  for(const e of list){if(e===P)drawPlayer();else if(e.smith)drawSmith(e.smith,t);else drawEnemy(e,t);}
  // projectiles, particles, slashes
  for(const p of G.proj){const x=Math.round(p.x-camX),y=Math.round(p.y-camY);ctx.fillStyle=p.c||'#6fd6e6';
    if(p.arrow){const c=Math.cos(p.a),sn=Math.sin(p.a);for(let i=1;i<7;i++)ctx.fillRect(Math.round(x-c*i),Math.round(y-sn*i),1,1);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);continue;}
    ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);}
  for(const p of G.parts){ctx.globalAlpha=1-p.t/p.d;ctx.fillStyle=p.c;ctx.fillRect(Math.round(p.x-camX),Math.round(p.y-camY),1,1);}
  ctx.globalAlpha=1;
  for(const f of G.fx){const p=f.t/f.d,x=f.x-camX,y=f.y-camY;ctx.globalAlpha=1-p*p;
    if(f.k==='slash'){const half=f.arc/2*Math.PI/180;
      if(f.arc>=360){const a=f.a+p*TAU;dotArc(x,y,f.r,a-2.6,a,'#e6e1d3');dotArc(x,y,f.r-2,a-1.8,a,'#8d8b98');}
      else{const lead=f.a+(f.dir>0?-half+2*half*Math.min(1,p*1.6):half-2*half*Math.min(1,p*1.6)),tail=f.a+(f.dir>0?-half:half);
        dotArc(x,y,f.r,tail,lead,'#e6e1d3');dotArc(x,y,f.r-1,tail,lead,'#e6e1d3');dotArc(x,y,f.r-3,tail+(lead-tail)*.3,lead,'#8d8b98');}}
    else if(f.k==='line'){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(f.a);ctx.fillStyle='#e6e1d3';ctx.fillRect(8,0,f.len-8,1);if(f.w){ctx.fillStyle='#8d8b98';ctx.fillRect(8,-2,f.len*.8,1);ctx.fillRect(8,2,f.len*.8,1);}ctx.restore();}
    else if(f.k==='ring'){dotArc(x,y,f.r*p,0,TAU,'#e6e1d3');dotArc(x,y,f.r*p-2,0,TAU,'#8d8b98');}
    else if(f.k==='boom'){const rr=f.r*Math.min(1,p*1.8);ctx.globalAlpha=(1-p)*.4;ctx.fillStyle='#f08a3c';ctx.beginPath();ctx.arc(x,y,rr,0,TAU);ctx.fill();ctx.globalAlpha=1-p*p;dotArc(x,y,rr,0,TAU,'#f08a3c');dotArc(x,y,rr-2,0,TAU,'#ffe9a8');}
    else if(f.k==='heal'){const hx=P.x-camX,hy=P.y-camY,rr=6+(f.r-6)*Math.min(1,p*1.7);
      ctx.globalAlpha=(1-p)*.16;ctx.fillStyle='#9be08a';ctx.beginPath();ctx.arc(x,y,rr,0,TAU);ctx.fill();ctx.globalAlpha=1-p*p;dotArc(x,y,rr,0,TAU,'#9be08a');dotArc(x,y,rr-3,0,TAU,'#ffe9a8');
      for(let i=0;i<7;i++){const a=i*.9+.4,rx=Math.round(hx+Math.cos(a)*(7+(i%3)*3)),ry=Math.round(hy+8-p*28-(i%4)*4);ctx.fillStyle=i%2?'#ffe9a8':'#9be08a';ctx.fillRect(rx-1,ry,3,1);ctx.fillRect(rx,ry-1,1,3);}}
    else if(f.k==='spikes'){ctx.fillStyle='#d9d4c4';for(let i=0;i<8;i++){const a=i*.85,rr=3+(i%3)*6,sx=Math.round(x+Math.cos(a)*rr),sy=Math.round(y+Math.sin(a)*rr*.6+4),h=Math.round((1-p)*(7+(i%3)*4));
      ctx.fillRect(sx,sy-h,1,h);if(h>3)ctx.fillRect(sx+1,sy-h+3,1,h-3);}}
    else if(f.k==='eslash'){dotArc(x,y,f.r,f.a-1,f.a-1+2*Math.min(1,p*1.8),'#d9d4c4');dotArc(x,y,f.r-2,f.a-.8,f.a-.8+1.6*Math.min(1,p*1.8),'#8d8674');}
    else if(f.k==='bolt'){ctx.fillStyle='#6fd6e6';const n=10;for(let i=0;i<=n;i++){const u=i/n;ctx.fillRect(Math.round(x+(f.x2-f.x)*u+rand(-2,2)),Math.round(y+(f.y2-f.y)*u+rand(-2,2)),1,1);}}
  }
  ctx.globalAlpha=1;
  // darkness
  ctx.drawImage(light,0,0);
  // things that glow through the dark
  for(const e of G.enemies){if(e.state==='idle'&&!e.boss)continue;if(e.x-camX<-48||e.x-camX>W+48||e.y-camY<-48||e.y-camY>H+48)continue;const s=enemySprite(e.type,e.elite,e.skin),bx=Math.round(e.x-camX),by=Math.round(e.y-camY-s.fh/2+e.bobY);
    if(!s.eyes)continue;const fx=e.fx||0,fy=e.fy||0;
    if(e.flip){ctx.save();ctx.translate(bx,0);ctx.scale(-1,1);ctx.drawImage(s.eyes,fx,fy,s.fw,s.fh,-Math.ceil(s.fw/2),by,s.fw,s.fh);ctx.restore();}else ctx.drawImage(s.eyes,fx,fy,s.fw,s.fh,bx-Math.floor(s.fw/2),by,s.fw,s.fh);}
  for(const d of G.drops)if(d.owner===P.id&&d.k==='item'&&d.item.rarity>=2){const x=Math.round(d.x-camX),y=Math.round(d.y-camY);ctx.fillStyle=RARITY[d.item.rarity].color;for(let i=0;i<10;i++){ctx.globalAlpha=.7*(1-i/10);ctx.fillRect(x,y-4-i,1,1);}ctx.globalAlpha=1;}
  if(G.gate){const gx=G.gate.x-camX,gy=G.gate.y-camY;dotArc(gx,gy,10+Math.sin(t*4)*1.5,t,t+2,'#6fd6e6');}
  if(G.home){const gx=G.home.x-camX,gy=G.home.y-camY;dotArc(gx,gy,10+Math.sin(t*4)*1.5,t,t+2,'#e2b93b');}
  // forge light: a warm glow that carries through the dark, so a safe room can be spotted from a distance
  for(const q of G.smiths){const x=q.x-camX+17,y=q.y-camY+4;if(x<-70||y<-70||x>W+70||y>H+70)continue;
    const fl=.85+.15*Math.sin(t*7+q.x);ctx.globalCompositeOperation='lighter';ctx.fillStyle='#f08a3c';
    for(const[r,al]of[[52,.045],[34,.06],[18,.09]]){ctx.globalAlpha=al*fl;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;drawFlame(Math.round(q.x-camX)+13,Math.round(q.y-camY)+6,t);}
  if(!G.gatesOpen){ctx.fillStyle='#d9534f';ctx.globalAlpha=.55+.3*Math.sin(t*3);for(const q of G.gates)for(const tl of q.tiles)ctx.fillRect(tl[0]*TILE+7-camX,tl[1]*TILE+7-camY,2,2);ctx.globalAlpha=1;}
  for(const p of G.pproj){const x=Math.round(p.x-camX),y=Math.round(p.y-camY);
    if(p.k==='fire'){ctx.fillStyle='#d9534f';ctx.fillRect(x-2,y-2,5,5);ctx.fillStyle='#f08a3c';ctx.fillRect(x-2,y-1,5,3);ctx.fillRect(x-1,y-2,3,5);ctx.fillStyle='#ffe9a8';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);}
    else if(p.k==='arrow'){const c=Math.cos(p.a),sn=Math.sin(p.a);ctx.fillStyle='#8d8b98';for(let i=2;i<7;i++)ctx.fillRect(Math.round(x-c*i),Math.round(y-sn*i),1,1);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);ctx.fillRect(Math.round(x-c),Math.round(y-sn),1,1);}
    else{ctx.fillStyle='#cfc8ff';ctx.fillRect(x-1,y-1,3,3);ctx.fillStyle='#fff';ctx.fillRect(x,y,1,1);}}
  // numbers
  for(const n of G.nums){const col=n.kind==='crit'?'#ffd86a':n.kind==='hurt'?'#ff6a5e':n.kind==='bleed'?'#c05a6a':n.kind==='heal'?'#9be08a':n.kind==='evade'?'#6fd6e6':n.kind==='mana'?'#7fa8ff':n.kind==='resist'?'#8e97b5':'#e6e1d3';
    ctx.globalAlpha=n.t>.5?1-(n.t-.5)/.25:1;drawNum(n.v,n.x-camX,n.y-camY-n.t*18,col);}
  ctx.globalAlpha=1;
}
function drawPortal(q,t,col,hi){
  const gx=q.x-camX,gy=q.y-camY,pu=Math.sin(t*4)*1.5;
  ctx.globalAlpha=.18;ctx.fillStyle=col;ctx.beginPath();ctx.arc(gx,gy,13+pu,0,TAU);ctx.fill();ctx.globalAlpha=1;
  dotArc(gx,gy,10+pu,0,TAU,col);dotArc(gx,gy,6,t*2,t*2+4,hi);dotArc(gx,gy,3,-t*3,-t*3+3,'#fff');
}
function drawEnemy(e,t){
  const s=enemySprite(e.type,e.elite,e.skin);let x=e.x-camX,y=e.y-camY;
  let bob=e.type==='wisp'?Math.sin(t*5+e.ph)*2:(e.state==='chase'&&!s.sheet?Math.abs(Math.sin(t*9+e.ph))*-1.5:0);
  if(e.state==='hop')bob=-Math.sin((1-Math.max(0,e.t)/(e.hopT||.24))*Math.PI)*6;
  if(e.state==='windup'||e.state==='draw'){x+=rand(-.8,.8);if(!s.sheet)bob-=1;}
  if(e.lunge>0){const a=Math.atan2(P.y-e.y,P.x-e.x);x+=Math.cos(a)*4;y+=Math.sin(a)*4;}
  if(e.stun>0)x+=Math.sin(t*40)*.6;
  e.bobY=Math.round(bob);
  // which frame: single-frame enemies mirror to face you; the skeletons have a row per facing and step, step, attack across
  let fx=0,fy=0,flip=e.face<0;const fw=s.fw,fh=s.fh;
  if(s.sheet){const d=e.dir||0,atk=e.state==='windup'||e.state==='strike'||e.state==='draw';
    fy=[0,1,2,2][d]*fh;flip=d===2;fx=(atk?2:(e.moving?Math.floor(t*6+e.ph)%2:0))*fw;}
  e.fx=fx;e.fy=fy;e.flip=flip;
  const dx=Math.round(x),dy=Math.round(y-fh/2+bob),img=e.flash>0?s.white:s.c;
  if(e.type!=='wisp'){ctx.globalAlpha=.35;ctx.fillStyle='#000';ctx.fillRect(dx-e.r,Math.round(y+e.r+2),e.r*2,2);ctx.globalAlpha=1;}
  if(flip){ctx.save();ctx.translate(dx,0);ctx.scale(-1,1);ctx.drawImage(img,fx,fy,fw,fh,-Math.ceil(fw/2),dy,fw,fh);ctx.restore();}
  else ctx.drawImage(img,fx,fy,fw,fh,dx-Math.floor(fw/2),dy,fw,fh);
  if(e.state==='windup'||e.state==='draw'){ctx.fillStyle='#fff';ctx.fillRect(dx,dy-4,1,2);ctx.fillRect(dx,dy-1,1,1);}
  if(e.hurtT>0&&!e.boss){const w=Math.max(8,e.r*2),p=clamp(e.hp/e.maxHp,0,1);ctx.fillStyle='#000';ctx.fillRect(dx-w/2-1,dy-4,w+2,3);ctx.fillStyle=e.elite?'#e8b24a':'#d9534f';ctx.fillRect(dx-w/2,dy-3,Math.ceil(w*p),1);}
}
// Where the weapon hand sits and how the weapon rests, for facing down, up, left, right.
// The off-hand shield: [dx, dy, frame (0 front, 1 back, 2 edge-on), drawn in front of the body?] for facing down, up, left, right.
const SHIELD_REST=[[-7,3,0,1],[-7,2,1,0],[1,3,0,1],[-1,3,0,0]],SHIELD_UP=[[0,7,0,1],[0,-13,1,0],[-8,1,2,1],[8,1,2,1]];   // facing away, a raised shield shows over the head
const HAND=[[5,4],[5,-1],[-4,3],[4,3]],SWING_PIVOT=[[1,5],[1,-3],[-3,3],[3,3]],REST_ANGLE=[Math.PI/2-.35,-Math.PI/2+.45,Math.PI-1,1],BOOK=[[7,5],[7,-5],[-8,1],[8,1]];
function drawPlayer(){
  const x=Math.round(P.x)-camX,y=Math.round(P.y)-camY;
  if(P.dead)return;
  const d=P.dir,sw=P.swing,base=DIR_ANGLE[d];
  const col=sw?3:(P.moving&&!P.dash?[1,0,2,0][Math.floor(P.walk)%4]:0);   // attack pose, or step, stand, other step, stand
  let wa=ST.ranged?base:REST_ANGLE[d],hx=x+HAND[d][0],hy=y+HAND[d][1];
  if(sw){const p=sw.t/sw.d;hx=x+SWING_PIVOT[d][0];hy=y+SWING_PIVOT[d][1];
    if(ST.thrust){wa=base;const off=Math.sin(p*Math.PI)*8;hx+=Math.cos(base)*off;hy+=Math.sin(base)*off;}
    else if(ST.ranged)wa=base;
    else wa=base+(p-.5)*Math.max(100,ST.arc)*Math.PI/180;}   // the blade sweeps across the direction faced
  const weapon=ST.magic?()=>{   // a grimoire floats by the hand instead of swinging
      const bx=x+BOOK[d][0],by=Math.round(y+BOOK[d][1]+Math.sin(G.time*3));ctx.drawImage(WSPR,bx-6,by-5);
      if(sw){ctx.fillStyle='#cfc8ff';ctx.fillRect(bx+Math.round(Math.cos(base)*6),by+Math.round(Math.sin(base)*6),2,2);}}
    :()=>{const spr=BOWF&&sw?BOWF[sw.hit?2:1]:WSPR;   // bow: draw, loose, then back to a nocked arrow
      ctx.save();ctx.translate(Math.round(hx),Math.round(hy));ctx.rotate(wa);ctx.drawImage(spr,-spr.ox,-spr.oy);ctx.restore();};
  ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.fillRect(x-5,y+9,10,2);ctx.globalAlpha=1;
  const SH=ST.shield?SHIELDS[ST.shield]:null,sp=SH?(P.blocking?SHIELD_UP:SHIELD_REST)[d]:null;
  const shield=()=>{const im=shieldSprite(ST.shield);ctx.drawImage(im,sp[2]*SH.w,0,SH.w,SH.h,x+sp[0]-(SH.w>>1),y+sp[1]-(SH.h>>1),SH.w,SH.h);};
  const behind=d===1;if(behind)weapon();   // facing away: the weapon is on the far side of the body
  if(sp&&!sp[3])shield();
  if(P.inv>0&&!P.dash&&Math.floor(G.time*24)%2)ctx.globalAlpha=.45;
  const fx=col*FRAME_W,fy=DIR_ROW[d]*FRAME_H;
  if(d===2){ctx.save();ctx.translate(x,0);ctx.scale(-1,1);ctx.drawImage(AV,fx,fy,FRAME_W,FRAME_H,-12,y-13,FRAME_W,FRAME_H);ctx.restore();}
  else ctx.drawImage(AV,fx,fy,FRAME_W,FRAME_H,x-12,y-13,FRAME_W,FRAME_H);
  ctx.globalAlpha=1;if(!behind)weapon();
  if(sp&&sp[3])shield();
  if(P.guard>0){const t=G.time*3;if(P.guard>1||Math.floor(G.time*10)%2)for(let k=0;k<3;k++)dotArc(x,y,13,t+k*TAU/3,t+k*TAU/3+1.3,'#e6e1d3');}
}
const mini=$('#mini'),mctx=mini.getContext('2d');mini.width=MW;mini.height=MH;
function drawMini(){
  const id=mctx.createImageData(MW,MH),d=id.data,r=G.boss;
  for(let i=0;i<MW*MH;i++){const m=G.map[i];if(!G.seen[i]||(m!==1&&m!==3))continue;const x=i%MW,y=(i/MW)|0,inB=x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h,j=i*4;
    if(m===3){d[j]=226;d[j+1]=80;d[j+2]=74;d[j+3]=255;continue;}
    if(inSafe(x*TILE+8,y*TILE+8)){d[j]=168;d[j+1]=124;d[j+2]=72;d[j+3]=255;continue;}   // safe rooms show amber
    d[j]=inB?120:92;d[j+1]=inB?56:90;d[j+2]=inB?64:112;d[j+3]=255;}
  mctx.putImageData(id,0,0);
  const px=Math.floor(P.x/TILE),py=Math.floor(P.y/TILE);
  if(G.home){mctx.fillStyle='#e2b93b';mctx.fillRect(Math.floor(G.home.x/TILE)-1,Math.floor(G.home.y/TILE)-1,3,3);}
  if(G.gate){mctx.fillStyle='#6fd6e6';mctx.fillRect(Math.floor(G.gate.x/TILE)-1,Math.floor(G.gate.y/TILE)-1,3,3);}
  mctx.fillStyle='#fff';mctx.fillRect(px-1,py-1,2,2);
}

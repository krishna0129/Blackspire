'use strict';
// Blackspire: painting a floor's tiles into one big canvas, once per floor (and again when its gates open).

// Each floor has its own stone. Floor 2 (and anything above it for now) is a crypt: greener stone, bones on the ground.
const THEMES=[
  {f:['#1a1a22','#1c1c25','#181820'],grid:'#131319',speck:'#262631',crack:'#0c0c11',face:'#2c2c39',brick:'#1e1e28',top:'#404051',wall:'#1a1a22',edge:'#262631'},
  {f:['#181d1c','#1a201f','#161a19'],grid:'#111514',speck:'#252c2a',crack:'#0b0e0d',face:'#283230',brick:'#1b2322',top:'#3b4946',wall:'#171b1a',edge:'#232b29',bones:'#55513f'},
  // floor 3: older, rootbound stone. roots: tendrils creeping in from the walls
  {f:['#1b1a15','#1d1c16','#191812'],grid:'#14130f',speck:'#2b2a20',crack:'#0d0c09',face:'#2c2a20',brick:'#211f17',top:'#4a4433',wall:'#1a1913',edge:'#29271d',bones:'#55513f',roots:true},
];
function paintMap(g){
  const[c,x]=mk(MW*TILE,MH*TILE),m=g.map,TH=THEMES[floorDef(g.n).theme];
  x.fillStyle='#060609';x.fillRect(0,0,c.width,c.height);
  for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){
    const t=m[ty*MW+tx],px=tx*TILE,py=ty*TILE,h=hash2(tx,ty,g.n);
    if(t===1){
      x.fillStyle=TH.f[h<.33?0:h<.66?1:2];x.fillRect(px,py,16,16);
      x.fillStyle=TH.grid;x.fillRect(px+15,py,1,16);x.fillRect(px,py+15,16,1);
      if(h>.84){x.fillStyle=TH.speck;x.fillRect(px+3+Math.floor(h*97)%8,py+4+Math.floor(h*53)%8,2,1);x.fillRect(px+2+Math.floor(h*31)%10,py+3+Math.floor(h*71)%9,1,1);}
      if(h<.05){x.fillStyle=TH.crack;x.fillRect(px+4,py+6,5,1);x.fillRect(px+8,py+7,3,1);x.fillRect(px+10,py+8,1,2);}
      else if(TH.bones&&h<.085){x.fillStyle=TH.bones;const bx=px+3+Math.floor(h*977)%6,by=py+5+Math.floor(h*613)%6;x.fillRect(bx+1,by+1,4,1);x.fillRect(bx,by,1,3);x.fillRect(bx+5,by,1,3);}
      else if(TH.bones&&h<.1){x.fillStyle=TH.bones;const bx=px+4+Math.floor(h*977)%6,by=py+4+Math.floor(h*613)%6;x.fillRect(bx,by,4,3);x.fillRect(bx+1,by+3,2,1);x.fillStyle=TH.crack;x.fillRect(bx,by+1,1,1);x.fillRect(bx+3,by+1,1,1);}
      if(ty>0&&m[(ty-1)*MW+tx]===2){x.fillStyle='rgba(0,0,0,.4)';x.fillRect(px,py,16,3);x.fillStyle='rgba(0,0,0,.2)';x.fillRect(px,py+3,16,2);}
    }else if(t===3){
      x.fillStyle='#1c0f13';x.fillRect(px,py,16,16);x.fillStyle='#4a2229';for(let i=1;i<16;i+=4)x.fillRect(px+i,py,2,16);
      x.fillStyle='#6a2f38';x.fillRect(px,py+2,16,1);x.fillRect(px,py+13,16,1);x.fillStyle='#b0464d';x.fillRect(px+6,py+6,4,4);x.fillStyle='#1c0f13';x.fillRect(px+7,py+7,2,2);
    }else if(t===2){
      const face=ty+1<MH&&m[(ty+1)*MW+tx]===1;
      if(face){
        x.fillStyle=TH.face;x.fillRect(px,py,16,16);x.fillStyle=TH.brick;
        x.fillRect(px,py+5,16,1);x.fillRect(px,py+11,16,1);const o=(tx%2)*4;
        x.fillRect(px+(3+o)%16,py,1,5);x.fillRect(px+(11+o)%16,py,1,5);x.fillRect(px+(7+o)%16,py+6,1,5);x.fillRect(px+(15+o)%16,py+6,1,5);x.fillRect(px+(3+o)%16,py+12,1,4);x.fillRect(px+(11+o)%16,py+12,1,4);
        x.fillStyle=TH.top;x.fillRect(px,py,16,1);
      }else{
        x.fillStyle=TH.wall;x.fillRect(px,py,16,16);x.fillStyle=TH.edge;
        if(tx>0&&m[ty*MW+tx-1]===1)x.fillRect(px,py,1,16);
        if(tx<MW-1&&m[ty*MW+tx+1]===1)x.fillRect(px+15,py,1,16);
        if(ty>0&&m[(ty-1)*MW+tx]===1)x.fillRect(px,py,16,2);
      }
    }
  }
  // roots creeping in along the walls, and thorn patches (see onThorns)
  if(TH.roots)for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){if(m[ty*MW+tx]!==1)continue;const h=hash2(tx,ty,33);
    const nearWall=m[(ty-1)*MW+tx]===2||m[ty*MW+tx-1]===2||m[ty*MW+tx+1]===2;
    if(nearWall&&h<.35){x.fillStyle=h<.17?'#2f3d22':'#3b4a2a';const px=tx*TILE,py=ty*TILE;
      for(let i=0;i<9;i++)x.fillRect(px+((h*97+i*5)%14|0),py+((h*53+i*3)%6|0)+i,1+(i%3===0),1);
      if(h<.08){x.fillStyle='#b9b4a6';x.fillRect(px+(h*700%12|0),py+5,1,1);}}}
  if(g.thorns)for(let ty=0;ty<MH;ty++)for(let tx=0;tx<MW;tx++){if(!g.thorns[ty*MW+tx])continue;
    for(let j=0;j<TILE;j+=2)for(let i=0;i<TILE;i+=2){const q=hash2(tx*16+i,ty*16+j,7);
      if(q<.45){x.fillStyle=q<.2?'#2f3d22':'#4d6233';x.fillRect(tx*TILE+i,ty*TILE+j,2,1);}else if(q>.93){x.fillStyle='#b9b4a6';x.fillRect(tx*TILE+i,ty*TILE+j,1,1);}}}
  const ring=(r,rad,col,gap)=>{const X=(r.x+r.w/2)*TILE,Y=(r.y+r.h/2)*TILE;x.fillStyle=col;const n=Math.floor(rad*5);for(let i=0;i<n;i++){if(gap&&i%gap===0)continue;const a=i/n*TAU;x.fillRect(Math.round(X+Math.cos(a)*rad),Math.round(Y+Math.sin(a)*rad),1,1);}};
  x.fillStyle='rgba(140,30,45,.07)';x.fillRect(g.boss.x*TILE,g.boss.y*TILE,g.boss.w*TILE,g.boss.h*TILE);
  ring(g.boss,62,'#3a1d25',0);ring(g.boss,56,'#2c171d',3);ring(g.boss,20,'#3a1d25',2);
  ring(g.start,30,'#1d2c35',0);ring(g.start,25,'#18242b',3);
  for(const r of g.rooms)if(r.kind==='safe'){x.fillStyle='rgba(240,138,60,.045)';x.fillRect(r.x*TILE,r.y*TILE,r.w*TILE,r.h*TILE);ring(r,28,'#3a2a1d',0);ring(r,23,'#2e2218',3);}
  return c;
}

// The root village's ground (js/sim/village.js), painted pixel by pixel once: grass, the roots that wall it in, worn
// paths, the square's flagstones, the market's cobbles, the fields and the training yard. Buildings, trees and
// people are props drawn on top, y-sorted, by render().
function paintVillage(g){
  const[c,x]=mk(MW*TILE,MH*TILE);x.fillStyle='#060609';x.fillRect(0,0,c.width,c.height);
  const W0=VW*TILE,H0=VH*TILE,id=x.createImageData(W0,H0),d=id.data,T=TILE;
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const C={grass:['#21321d','#24371f','#1f2f1b','#273b22'].map(hex),blade:hex('#2d4523'),blade2:hex('#38542a'),root:hex('#17140f'),bark:hex('#1d1913'),bark2:hex('#241f17'),vein:hex('#2c3820'),vein2:hex('#3b4a2a'),
    dirt:hex('#3a3326'),dirt2:hex('#433a2c'),dirt3:hex('#322c21'),edge:hex('#2a251c'),flag:hex('#3a362e'),flag2:hex('#34302a'),flag3:hex('#403b32'),grout:hex('#1f1c17'),rim:hex('#4a4232'),
    cob:hex('#2f2b23'),cob2:hex('#38332a'),soil:hex('#3a2a1a'),furrow:hex('#2a1d12'),sand:hex('#3a3424'),sand2:hex('#423b29'),fence:hex('#6b4a2c'),fence2:hex('#4a3324'),gate:hex('#1b2329'),rune:hex('#2c4a52')};
  const FL=[hex('#e9838b'),hex('#e2b93b'),hex('#cfc8ff'),hex('#e6e1d3')];
  // distance to the nearest path, from stamping each path's curve
  const dist=new Float32Array(W0*H0).fill(99),R=13;
  for(const[p0,p1,p2,p3]of VILLAGE.paths){const pt=u=>{const v=1-u;return[0,1].map(i=>(v*v*v*p0[i]+3*v*v*u*p1[i]+3*v*u*u*p2[i]+u*u*u*p3[i])*T);};
    for(let k=0;k<=160;k++){const[cx,cy]=pt(k/160),wob=Math.sin(k*.7)*1.5;
      for(let yy=Math.max(0,cy-R-3|0);yy<=Math.min(H0-1,cy+R+3);yy++)for(let xx=Math.max(0,cx-R-3|0);xx<=Math.min(W0-1,cx+R+3);xx++){
        const dd=Math.hypot(xx-cx,yy-cy)-wob;const i=yy*W0+xx;if(dd<dist[i])dist[i]=dd;}}}
  const inRect=(px,py,[rx,ry,rw,rh])=>px>=rx*T&&py>=ry*T&&px<(rx+rw)*T&&py<(ry+rh)*T;
  const onFence=(px,py,[rx,ry,rw,rh])=>{const x0=rx*T,y0=ry*T,x1=(rx+rw)*T-1,y1=(ry+rh)*T-1;
    if(px<x0-1||px>x1+1||py<y0-1||py>y1+1)return 0;const side=(py>=y0-1&&py<=y0)||(py>=y1&&py<=y1+1)||(px>=x0-1&&px<=x0)||(px>=x1&&px<=x1+1);
    if(!side)return 0;if(Math.abs(py-y1)<=1&&Math.abs(px-(x0+x1)/2)<10)return 0;   // a gap to walk in through
    return((px-x0)%16<2||(py-y0)%16<2)?2:1;};
  const sq=VILLAGE.square,sx=sq.x*T,sy=sq.y*T,sr=sq.r*T;
  for(let py=0;py<H0;py++)for(let px=0;px<W0;px++){
    const tx=px>>4,ty=py>>4,i=(py*W0+px)*4,m=g.map[(VOY+ty)*MW+VOX+tx],edge=Math.min(tx,ty,VW-1-tx,VH-1-ty);
    let col=C.grass[Math.floor(hash2(px>>2,py>>2,3)*4)];
    const h=hash2(px,py,9);
    if(h<.03)col=C.blade;else if(h<.04)col=C.blade2;
    // flowers, in small clumps
    if(hash2(px>>3,py>>3,11)<.025&&hash2(px,py,12)<.14)col=FL[Math.floor(hash2(px>>3,py>>3,13)*4)];
    if(inRect(px,py,VILLAGE.fields)){col=C.grass[1];for(const[ax,ay]of VILLAGE.plots)if(inRect(px,py,[ax,ay,3,2]))col=(py%4===0)?C.furrow:C.soil;}
    if(inRect(px,py,VILLAGE.yard))col=hash2(px>>1,py>>1,4)<.5?C.sand:C.sand2;
    const pd=dist[py*W0+px];
    if(pd<R){col=pd>R-2?C.edge:(h<.25?C.dirt2:h<.4?C.dirt3:C.dirt);}
    if(inRect(px,py,VILLAGE.market)){const bx=(px+((py>>3)%2)*4)>>3,by=py>>3;col=(px+((py>>3)%2)*4)%8===0||py%8===0?C.grout:(hash2(bx,by,6)<.5?C.cob:C.cob2);}
    const ds=Math.hypot(px-sx,py-sy);
    if(ds<sr){const ring=Math.floor(ds/9),ang=Math.atan2(py-sy,px-sx),seg=Math.floor((ang+Math.PI)*(ring+2)/1.2);
      col=ds%9<1||((ang+Math.PI)*(ring+2)/1.2)%1<.06?C.grout:[C.flag,C.flag2,C.flag3][Math.floor(hash2(ring,seg,8)*3)];
      if(ds>sr-3)col=C.rim;if(ds<2.4*T)col=ds>2.4*T-2?C.rune:C.gate;}
    const f=onFence(px,py,VILLAGE.fields)||onFence(px,py,VILLAGE.yard);if(f)col=f===2?C.fence:C.fence2;
    if(m===2&&(edge<3||(ty<4&&tx>=19&&tx<=36))){   // the roots: mottled bark, with moss here and there
      const v=hash2(px>>2,py>>1,14);col=v<.45?C.root:v<.8?C.bark:C.bark2;if(hash2(px>>1,py>>1,15)<.04)col=C.vein2;}
    d[i]=col[0];d[i+1]=col[1];d[i+2]=col[2];d[i+3]=255;}
  x.putImageData(id,VOX*T,VOY*T);
  // soft shadows under trees and buildings
  x.fillStyle='rgba(0,0,0,.28)';
  for(const q of g.props){const sh=q.s.includes('tree')?[13,4]:q.s.endsWith('inn')||q.s.endsWith('guild')?[70,5]:null;if(!sh)continue;
    for(let j=-sh[1];j<=sh[1];j++){const w=Math.round(sh[0]*Math.sqrt(1-(j/sh[1])**2));x.fillRect(Math.round(q.x-w),Math.round(q.y+j+1),w*2,1);}}
  return c;
}

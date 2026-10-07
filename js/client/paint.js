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

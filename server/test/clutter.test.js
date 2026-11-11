'use strict';
// Room clutter (js/sim/world.js): barrels, crates, coffins and rubble in room corners stand on tiles the rules make
// solid, so nobody walks through them, and they never cut a room off.
const test=require('node:test'),assert=require('node:assert'),vm=require('node:vm');
const {loadRules}=require('../game');

test('clutter is solid, and every floor tile can still be reached from the start',()=>{
  const R=loadRules();
  const r=JSON.parse(vm.runInContext(`(()=>{const out=[];
    for(let s=1;s<=40;s++){const g=genFloor(1+s%5,s);setWorld(g);
      const solidAll=g.clutter.every(q=>g.map[q.y*MW+q.x]===4&&solid(q.x*TILE+8,q.y*TILE+8));
      // flood from the start room over floor tiles (the boss's gates closed)
      const seen=new Uint8Array(MW*MH),st=g.start,q=[[st.x+1,st.y+1]];seen[(st.y+1)*MW+st.x+1]=1;
      while(q.length){const[x,y]=q.pop();for(const[X,Y]of[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){const i=Y*MW+X;if(!seen[i]&&g.map[i]===1){seen[i]=1;q.push([X,Y]);}}}
      let cut=0;for(let i=0;i<MW*MH;i++)if(g.map[i]===1&&!seen[i]){const x=i%MW,y=(i/MW)|0,b=g.boss;if(!(x>=b.x&&x<b.x+b.w&&y>=b.y&&y<b.y+b.h))cut++;}
      out.push({n:g.clutter.length,solidAll,cut});}
    return JSON.stringify(out);})()`,R));
  assert.ok(r.reduce((a,b)=>a+b.n,0)>100,'there is clutter');
  assert.ok(r.every(f=>f.solidAll),'every piece blocks its tile');
  assert.deepStrictEqual(r.map(f=>f.cut),r.map(()=>0),'no floor tile is cut off');
});

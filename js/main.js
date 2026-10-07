'use strict';
// Blackspire: Main loop and start-up.

/* ---------- main loop ---------- */
let last=performance.now();
function frame(now){
  const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
  if(mode==='play'){update(dt);if(mode==='play'||mode==='dead')updateHud();}
  else if(G){G.time+=dt;
    if(mode==='dead'){for(const p of G.parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}G.parts=G.parts.filter(p=>p.t<p.d);for(const n of G.nums)n.t+=dt;G.nums=G.nums.filter(n=>n.t<.75);}}
  if(G&&P)render();
  requestAnimationFrame(frame);
}
resize();
loadSprites().then(()=>{showTitle();requestAnimationFrame(frame);});   // nothing is drawn until every sprite file is in

// small hook for testing and for wiring a server later
window.BLACKSPIRE={Store,get state(){return S;},get stats(){return ST;},get floor(){return G;},get player(){return P;},enterFloor,randomItem,makeWeapon,calcStats};

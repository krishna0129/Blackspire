'use strict';
// Blackspire: Main loop and start-up.

/* ---------- main loop ---------- */
let last=performance.now(),saveT=0,miniT=0;
function frame(now){
  const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
  if(NET.on)NET.frame(dt);   // online: the server runs the floor; this draws what it last sent
  // During a freeze-frame nothing moves, effects included. The test is "> 0": the freeze counts down past zero and
  // stays a hair below it, and treating that as still frozen left every number and particle hanging for good.
  else if(mode==='play'){P.in=readInput();if(!(G.hitstop>0))updateCosmetics(dt);simUpdate(dt);
    if(mode==='play'){saveT+=dt;if(saveT>20){saveT=0;save();}}}
  else if(G){G.time+=dt;if(mode==='dead')updateCosmetics(dt);}
  if(G&&P&&(mode==='play'||mode==='dead')){miniT-=dt;if(miniT<=0){miniT=.15;reveal();drawMini();}updateHud();}
  if(G&&P)render();
  requestAnimationFrame(frame);
}
resize();
loadSprites().then(()=>{resize();showTitle();requestAnimationFrame(frame);});   // nothing is drawn until every sprite file is in

// small hook for testing and for wiring a server later
window.BLACKSPIRE={Store,get state(){return S;},get stats(){return ST;},get floor(){return G;},get player(){return P;},enterFloor,randomItem,makeWeapon,calcStats};

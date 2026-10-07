'use strict';
// Blackspire: the browser's side of the host functions the rules call (see the list at the top of js/sim/rules.js).
// Single player calls them straight from the rules. Online, the server sends the same calls as events and net.js
// replays them here, so effects look the same in both modes.

function addNum(x,y,v,kind){G.nums.push({x:x+rand(-3,3),y,v:String(v)+(kind==='crit'?'!':''),kind,t:0});}
function burst(x,y,n,col,sp=40){for(let i=0;i<n;i++){const a=Math.random()*TAU,s=rand(sp*.3,sp);G.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,t:0,d:rand(.2,.5),c:col});}}
function part(p){G.parts.push(p);}
function vfx(f){G.fx.push(f);}
function shake(v){G.shake=Math.max(G.shake||0,v);}
function hitstop(v){G.hitstop=Math.max(G.hitstop||0,v);}
function log(html){const el=$('#log'),d=document.createElement('div');d.innerHTML=html;el.appendChild(d);while(el.children.length>5)el.firstChild.remove();setTimeout(()=>d.remove(),5200);}
let banT=0;
function banner(main,sub,ms=2400){$('#banMain').textContent=main;$('#banSub').textContent=sub||'';$('#banner').hidden=false;clearTimeout(banT);banT=setTimeout(()=>$('#banner').hidden=true,ms);}
const bannerMe=banner;
function hurtFlash(){const h=$('#hurt');h.style.transition='none';h.style.opacity=.9;requestAnimationFrame(()=>{h.style.transition='';h.style.opacity=0;});}
function bossBar(name){$('#boss').hidden=!name;if(name)$('#bossName').textContent=name;}
function persist(){save();}
function mapChanged(){G.mapCv=paintMap(G);}
function onDeath(lost,cp){
  mode='dead';
  $('#deadTxt').textContent=`You lose ${lost} shard${lost===1?'':'s'}. You wake ${cp?'in the last safe room you reached':'at the entrance of floor '+G.n}. `+
    (NET.on?'The fight goes on without you until then. ':'Enemies on this floor return, so you can fight them again for experience. ')+'Chests you opened stay empty. Gear and levels stay.';
  $('#respawnTxt').textContent=cp?'Respawn at the safe room':'Respawn at the entrance';
  setTimeout(()=>{if(mode==='dead')$('#dead').hidden=false;},700);
}

// Particles, slashes and floating numbers only exist on screen: they age here, every frame, in either mode.
function updateCosmetics(dt){
  for(const a of[G.fx,G.nums])for(const f of a)f.t+=dt;
  G.fx=G.fx.filter(f=>f.t<f.d);G.nums=G.nums.filter(n=>n.t<.75);
  for(const p of G.parts){p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=1-4*dt;p.vy*=1-4*dt;}
  G.parts=G.parts.filter(p=>p.t<p.d);
  if(G.shake>0)G.shake=Math.max(0,G.shake-22*dt);
}
// The minimap shows what you have been near.
function reveal(){const tx=Math.floor(P.x/TILE),ty=Math.floor(P.y/TILE),R=8;
  for(let y=ty-R;y<=ty+R;y++)for(let x=tx-R;x<=tx+R;x++){if(x<0||y<0||x>=MW||y>=MH)continue;if((x-tx)**2+(y-ty)**2<=R*R)G.seen[y*MW+x]=1;}}

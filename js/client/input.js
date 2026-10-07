'use strict';
// Blackspire: Canvas sizing, lighting mask, keyboard, mouse, touch, sound.

/* ---------- canvas, input ---------- */
const stage=$('#stage'),cv=$('#game'),ctx=cv.getContext('2d');
// W x H: the view in game pixels; SCALE: CSS pixels per game pixel; RES: canvas pixels per game pixel. RES stays 1
// with the stock art and only goes up to show sprites drawn finer than the grid (SPR_MAX, sprites.js).
let W=320,H=180,SCALE=3,RES=1,light=null,camX=0,camY=0;
function resize(){
  const r=stage.getBoundingClientRect();if(r.width<2||r.height<2)return;
  SCALE=Math.max(2,Math.floor(Math.min(r.width,r.height)/230));
  W=Math.ceil(r.width/SCALE);H=Math.ceil(r.height/SCALE);
  RES=Math.max(1,Math.min(SPR_MAX,Math.floor(SCALE*(window.devicePixelRatio||1))));
  cv.width=W*RES;cv.height=H*RES;cv.style.width=W*SCALE+'px';cv.style.height=H*SCALE+'px';
  ctx.setTransform(RES,0,0,RES,0,0);ctx.imageSmoothingEnabled=false;   // everything is drawn in game pixels
  buildLight();
}
function buildLight(){
  const[c,x]=mk(W,H);const id=x.createImageData(W,H),d=id.data;
  const Rm=Math.min(150,Math.max(W,H)*.56),R0=Rm*.42,B=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],LV=5;
  for(let y=0;y<H;y++)for(let X=0;X<W;X++){
    const dist=hyp(X-W/2,(y-H/2)*1.12);let v=clamp((dist-R0)/(Rm-R0),0,1);
    const q=Math.min(1,Math.floor(v*LV+(B[(y&3)*4+(X&3)]+.5)/16)/LV),i=(y*W+X)*4;
    d[i]=4;d[i+1]=4;d[i+2]=7;d[i+3]=Math.round(q*248);
  }
  x.putImageData(id,0,0);light=c;
}
addEventListener('resize',resize);

const keys={},inp={mx:0,my:0,atk:false,touch:!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),jx:0,jy:0,jid:null,jox:0,joy:0};
// Keys are physical positions (KeyboardEvent.code), so WASD and J/K/H sit in the same place on AZERTY, QWERTZ
// and every other layout. Every binding lives here, which is all a key-rebinding screen would need to change.
const BIND={
  up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],
  attack:['KeyJ'],skill:['KeyK','Space'],block:['KeyH','KeyF'],dodge:['ShiftLeft','ShiftRight','KeyL'],potion:['KeyQ'],
  interact:['KeyE','Enter','NumpadEnter'],gear:['KeyI','Tab'],menu:['Escape'],mute:['KeyM'],debug:['Backquote'],
  respawn:['KeyR','Enter','NumpadEnter'],
};
const is=(action,code)=>BIND[action].includes(code);
const held=action=>BIND[action].some(c=>keys[c]);
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  const c=e.code;if(!c)return;if(e.repeat&&!is('gear',c))return;keys[c]=true;
  if(mode==='play'){
    if(is('attack',c))press('atk');
    if(is('skill',c)){press('skill');e.preventDefault();}
    else if(is('dodge',c))press('dodge');
    else if(is('potion',c))press('potion');
    else if(is('interact',c))interact();
    else if(is('gear',c)){openPanel();e.preventDefault();}
    else if(is('menu',c))openPause();
    else if(is('mute',c))toggleMute();
    else if(is('debug',c))openDebug();
  }else if(mode==='panel'){if(is('menu',c)||is('gear',c)){closePanel();e.preventDefault();}}
  else if(mode==='debug'){if(is('menu',c)||is('debug',c))closeDebug();}
  else if(mode==='ask'){if(is('interact',c))confirmChamber();else if(is('menu',c))closeAsk();}
  else if(mode==='pause'){if(is('menu',c))closePause();}
  else if(mode==='travel'){if(is('menu',c))closeTravel();}
  else if(mode==='dead'){if(is('respawn',c))respawn();}
});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;inp.atk=false;inp.block=false;});
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{
  if(mode!=='play')return;
  if(e.pointerType==='touch'){
    inp.touch=true;
    if(inp.jid===null&&e.clientX<innerWidth*.6){inp.jid=e.pointerId;inp.jox=e.clientX;inp.joy=e.clientY;inp.jx=inp.jy=0;
      const s=$('#stick'),r=stage.getBoundingClientRect();s.hidden=false;s.style.left=(e.clientX-r.left)+'px';s.style.top=(e.clientY-r.top)+'px';s.firstElementChild.style.transform='';}
    return;
  }
  inp.touch=false;setMouse(e);
  if(e.button===0){inp.atk=true;press('atk');}else if(e.button===2)press('skill');
});
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'){
    if(e.pointerId===inp.jid){let dx=e.clientX-inp.jox,dy=e.clientY-inp.joy;const d=hyp(dx,dy),m=44;if(d>m){dx*=m/d;dy*=m/d;}
      inp.jx=d<6?0:dx/m;inp.jy=d<6?0:dy/m;$('#stick').firstElementChild.style.transform=`translate(${dx}px,${dy}px)`;}
    return;
  }
  setMouse(e);
});
const endPtr=e=>{if(e.pointerId===inp.jid){inp.jid=null;inp.jx=inp.jy=0;$('#stick').hidden=true;}if(e.pointerType!=='touch'&&e.button===0)inp.atk=false;};
addEventListener('pointerup',endPtr);addEventListener('pointercancel',endPtr);
function setMouse(e){const r=cv.getBoundingClientRect();inp.mx=(e.clientX-r.left)/SCALE;inp.my=(e.clientY-r.top)/SCALE;}
function holdBtn(el,down,up){
  el.addEventListener('pointerdown',e=>{e.preventDefault();if(e.pointerType==='touch')inp.touch=true;if(mode==='play')down();});
  if(up){el.addEventListener('pointerup',up);el.addEventListener('pointerleave',up);el.addEventListener('pointercancel',up);}
  el.addEventListener('click',e=>e.currentTarget.blur());
}

// What the player is asking for this frame. A press of attack is also remembered for a moment (P.atkBuf), so a
// quick tap always lands and a press just before the last swing ends becomes the next swing.
const moveX=()=>(held('right')?1:0)-(held('left')?1:0)+inp.jx;
const moveY=()=>(held('down')?1:0)-(held('up')?1:0)+inp.jy;
// One-off presses go to the rules directly in single player, and to the server online.
const PRESS={atk:()=>{P.atkBuf=.18;},skill:()=>useSkill(),dodge:()=>dodge(),potion:()=>usePotion()};
function press(a){if(NET.on)NET.press(a);else PRESS[a]();}
const readInput=()=>({mx:moveX(),my:moveY(),atk:inp.atk||held('attack'),block:held('block')||!!inp.block});

/* ---------- sound ---------- */
let AC=null;
const SFX={block:[320,170,.07,'square',.06],swing:[220,90,.06,'triangle',.05],hit:[170,60,.08,'square',.05],crit:[520,140,.12,'square',.06],hurt:[110,40,.18,'sawtooth',.09],
  pick:[660,990,.08,'square',.035],lvl:[440,880,.35,'triangle',.08],skill:[330,660,.16,'sawtooth',.05],kill:[200,50,.14,'square',.045],boss:[70,38,.7,'sawtooth',.1],gate:[300,900,.5,'triangle',.07],
  cast:[720,420,.07,'sine',.04],boom:[150,40,.32,'sawtooth',.09],heal:[520,1040,.42,'sine',.07],rare:[620,1480,.5,'triangle',.08],lock:[95,45,.5,'square',.07]};
const sfxLast={};
function sfx(k){
  if(muted)return;const d=SFX[k];if(!d)return;
  const now=performance.now();if((k==='hit'||k==='crit')&&now-(sfxLast[k]||0)<45)return;sfxLast[k]=now;   // a wide swing is one sound, not ten
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=d[3];
    o.frequency.setValueAtTime(d[0],t);o.frequency.exponentialRampToValueAtTime(d[1],t+d[2]);
    g.gain.setValueAtTime(d[4],t);g.gain.exponentialRampToValueAtTime(.0001,t+d[2]);
    o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d[2]+.02);}catch(e){}
}
function toggleMute(){muted=!muted;$('#pMute').textContent='Sound: '+(muted?'off':'on');}

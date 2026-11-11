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

const keys={},inp={mx:0,my:0,cx:0,cy:0,mouse:false,atk:false,block:false,touch:!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),jx:0,jy:0,jid:null,jox:0,joy:0};
// Keys are physical positions (KeyboardEvent.code), so WASD and Q/E/C/X sit in the same place on AZERTY, QWERTZ
// and every other layout. Every binding lives here, which is all a key-rebinding screen would need to change.
// The layout is Valorant's (docs/design/combat.md#keys): the mouse aims, the left button attacks and the right blocks
// (a tap just before a blow parries); the four skills on Q, E, C, X; quick slots 1 to 4; interact on F.
const BIND={
  up:['KeyW','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','ArrowLeft'],right:['KeyD','ArrowRight'],
  skill1:['KeyQ'],skill2:['KeyE'],skill3:['KeyC'],skill4:['KeyX'],dodge:['Space','ShiftLeft','ShiftRight'],
  slot1:['Digit1','Numpad1'],slot2:['Digit2','Numpad2'],slot3:['Digit3','Numpad3'],slot4:['Digit4','Numpad4'],
  interact:['KeyF','Enter','NumpadEnter'],gear:['KeyI','Tab'],tree:['KeyP'],menu:['Escape'],mute:['KeyM'],debug:['Backquote'],
  respawn:['KeyR','Enter','NumpadEnter'],
};
// The skill keys are the four slots (js/sim/skills.js); the quick slots, a potion, mana, food and water.
const SKILL_KEYS=['skill1','skill2','skill3','skill4'],SLOT_KEYS={slot1:'potion',slot2:'mana',slot3:'eat',slot4:'drink'};
const is=(action,code)=>BIND[action].includes(code);
const held=action=>BIND[action].some(c=>keys[c]);
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  const c=e.code;if(!c)return;if(e.repeat&&!is('gear',c))return;keys[c]=true;
  if(mode==='play'){
    const sk=SKILL_KEYS.findIndex(a=>is(a,c)),slot=Object.keys(SLOT_KEYS).find(a=>is(a,c));
    if(sk>=0)press('skill',SLOTS[sk]);
    else if(slot)press(SLOT_KEYS[slot]);
    else if(is('dodge',c)){press('dodge');e.preventDefault();}
    else if(is('interact',c))interact();
    else if(is('gear',c)){openPanel();e.preventDefault();}
    else if(is('tree',c))openTree();
    else if(is('menu',c))openPause();
    else if(is('mute',c))toggleMute();
    else if(is('debug',c))openDebug();
  }else if(mode==='panel'){if(is('menu',c)||is('gear',c)){closePanel();e.preventDefault();}}
  else if(mode==='tree'){if(is('menu',c)||is('tree',c))closeTree();}
  else if(mode==='room'){if(is('menu',c))leaveRoom();}
  else if(mode==='debug'){if(is('menu',c)||is('debug',c))closeDebug();}
  else if(mode==='ask'){if(is('interact',c))confirmChamber();else if(is('menu',c))closeAsk();}
  else if(mode==='pause'){if(is('menu',c))closePause();}
  else if(mode==='travel'){if(is('menu',c))closeTravel();}
  else if(mode==='guild'){if(is('menu',c))closeGuild();}
  else if(mode==='fields'){if(is('menu',c))closeFields();}
  else if(mode==='dead'){if(is('respawn',c))respawn();}
});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;inp.atk=false;inp.block=false;});
// The mouse: the game is drawn on the 2D canvas or, in 3D, on its own canvas laid over it, so both count as the game.
const onGame=e=>e.target===cv||(e.target&&e.target.id==='game3d');
stage.addEventListener('contextmenu',e=>{if(onGame(e))e.preventDefault();});
addEventListener('mousedown',e=>{
  if(mode!=='play'||!onGame(e)||inp.touch)return;setMouse(e);
  if(e.button===0){inp.atk=true;press('atk');}else if(e.button===2){inp.block=true;e.preventDefault();}
});
addEventListener('mouseup',e=>{if(e.button===0)inp.atk=false;else if(e.button===2)inp.block=false;});
stage.addEventListener('pointerdown',e=>{
  if(mode!=='play'||!onGame(e))return;
  if(e.pointerType==='touch'){
    inp.touch=true;
    if(inp.jid===null&&e.clientX<innerWidth*.6){inp.jid=e.pointerId;inp.jox=e.clientX;inp.joy=e.clientY;inp.jx=inp.jy=0;
      const s=$('#stick'),r=stage.getBoundingClientRect();s.hidden=false;s.style.left=(e.clientX-r.left)+'px';s.style.top=(e.clientY-r.top)+'px';s.firstElementChild.style.transform='';}
    return;
  }
  inp.touch=false;setMouse(e);
});
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'){
    if(e.pointerId===inp.jid){let dx=e.clientX-inp.jox,dy=e.clientY-inp.joy;const d=hyp(dx,dy),m=44;if(d>m){dx*=m/d;dy*=m/d;}
      inp.jx=d<6?0:dx/m;inp.jy=d<6?0:dy/m;$('#stick').firstElementChild.style.transform=`translate(${dx}px,${dy}px)`;}
    return;
  }
  setMouse(e);
});
const endPtr=e=>{if(e.pointerId===inp.jid){inp.jid=null;inp.jx=inp.jy=0;$('#stick').hidden=true;}};
addEventListener('pointerup',endPtr);addEventListener('pointercancel',endPtr);
function setMouse(e){const r=cv.getBoundingClientRect();inp.mx=(e.clientX-r.left)/SCALE;inp.my=(e.clientY-r.top)/SCALE;inp.cx=e.clientX;inp.cy=e.clientY;inp.mouse=true;}
// Where the mouse points, as an angle from the player: through the 3D camera onto the floor, or on the 2D view.
// Without a mouse (touch), null: attacks then go the way you walk.
function aimPoint(){
  if(!inp.mouse||inp.touch||!P)return null;
  let q=null;if(R3.use())q=R3.pick(inp.cx,inp.cy);
  if(!q)q={x:camX+inp.mx,y:camY+inp.my};
  return q;
}
function aimAngle(){const q=aimPoint();return q?Math.atan2(q.y-P.y,q.x-P.x):null;}
// how far the mouse points from the player: skills that land somewhere land there (within their reach)
function aimDist(){const q=aimPoint();return q?Math.round(Math.hypot(q.x-P.x,q.y-P.y)):null;}
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
const PRESS={atk:()=>{P.atkBuf=.18;},skill:s=>useSkill(s),dodge:()=>dodge(),potion:()=>usePotion(),mana:()=>useMana(),eat:()=>eat(),drink:()=>drink()};
function press(a,s){
  // aim first, so a press acts toward the mouse even between two input reports
  if(P&&!P.dead){const a=aimAngle();if(a!=null){P.in.aim=a;P.aim=a;P.dir=dirOf(a);}P.aimD=aimDist();}
  if(NET.on)NET.press(a,s);else PRESS[a](s);
}
const readInput=()=>({mx:moveX(),my:moveY(),atk:!!inp.atk,block:!!inp.block,aim:aimAngle()});

/* ---------- sound ---------- */
let AC=null,NOISE=null;
const SFX={block:[320,170,.07,'square',.06],swing:[220,90,.06,'triangle',.05,[.08,.05,1200,3600]],hurt:[110,40,.18,'sawtooth',.09],
  pick:[660,990,.08,'square',.035],lvl:[440,880,.35,'triangle',.08],skill:[330,660,.16,'sawtooth',.05],kill:[200,50,.14,'square',.045],boss:[70,38,.7,'sawtooth',.1],gate:[300,900,.5,'triangle',.07],
  // (a sixth entry: a burst of noise under the tone, [seconds, loudness, low-pass from, to])
  hit:[190,70,.09,'square',.05,[.07,.09,2600,500]],hitSoft:[240,120,.06,'triangle',.04,[.05,.05,3000,900]],hitHeavy:[120,36,.22,'sawtooth',.09,[.2,.16,1800,160]],crit:[560,150,.13,'square',.06,[.1,.12,5000,700]],
  hitFire:[200,70,.16,'sawtooth',.05,[.22,.11,1400,300]],hitCold:[1500,700,.1,'sine',.04,[.1,.07,7000,3000]],hitZap:[900,180,.09,'square',.04,[.07,.08,8000,2500]],
  heavy:[90,30,.35,'sawtooth',.12,[.3,.2,1200,90]],glint:[1900,2600,.28,'sine',.05],chain:[420,90,.2,'square',.05,[.22,.1,4200,600]],blink:[700,180,.22,'sine',.06,[.2,.06,2400,6000]],
  thrust:[500,140,.1,'triangle',.06,[.12,.1,6000,1200]],whoosh:[260,110,.2,'triangle',.04,[.24,.12,900,3200]],roar:[130,60,.5,'sawtooth',.09,[.45,.1,700,250]],
  boom:[150,40,.32,'sawtooth',.09,[.3,.18,1500,120]],
  cast:[720,420,.07,'sine',.04],heal:[520,1040,.42,'sine',.07],rare:[620,1480,.5,'triangle',.08],lock:[95,45,.5,'square',.07]};
const sfxLast={};
function sfx(k){
  if(muted)return;const d=SFX[k];if(!d)return;
  const now=performance.now();if((k.startsWith('hit')||k==='crit')&&now-(sfxLast[k]||0)<45)return;sfxLast[k]=now;   // a wide swing is one sound, not ten
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=d[3];
    o.frequency.setValueAtTime(d[0],t);o.frequency.exponentialRampToValueAtTime(d[1],t+d[2]);
    g.gain.setValueAtTime(d[4],t);g.gain.exponentialRampToValueAtTime(.0001,t+d[2]);
    o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d[2]+.02);
    if(d[5]){const[len,vol,f0,f1]=d[5];NOISE=NOISE||(()=>{const b=AC.createBuffer(1,AC.sampleRate,AC.sampleRate),c=b.getChannelData(0);for(let i=0;i<c.length;i++)c[i]=Math.random()*2-1;return b;})();
      const n=AC.createBufferSource(),f=AC.createBiquadFilter(),ng=AC.createGain();n.buffer=NOISE;f.type='lowpass';f.frequency.setValueAtTime(f0,t);f.frequency.exponentialRampToValueAtTime(f1,t+len);
      ng.gain.setValueAtTime(vol,t);ng.gain.exponentialRampToValueAtTime(.0001,t+len);n.connect(f);f.connect(ng);ng.connect(AC.destination);n.start(t,Math.random()*.5,len+.02);}
    }catch(e){}
}
function toggleMute(){muted=!muted;$('#pMute').textContent='Sound: '+(muted?'off':'on');}

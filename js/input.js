'use strict';
// Blackspire: Canvas sizing, lighting mask, keyboard, mouse, touch, sound.

/* ---------- canvas, input ---------- */
const stage=$('#stage'),cv=$('#game'),ctx=cv.getContext('2d');
let W=320,H=180,SCALE=3,light=null,camX=0,camY=0;
function resize(){
  const r=stage.getBoundingClientRect();if(r.width<2||r.height<2)return;
  SCALE=Math.max(2,Math.floor(Math.min(r.width,r.height)/230));
  W=Math.ceil(r.width/SCALE);H=Math.ceil(r.height/SCALE);
  cv.width=W;cv.height=H;cv.style.width=W*SCALE+'px';cv.style.height=H*SCALE+'px';ctx.imageSmoothingEnabled=false;
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

// A press of attack is remembered for a moment, so a quick tap always lands and a press just before the
// last swing ends becomes the next swing.
let atkBuf=0;
const keys={},inp={mx:0,my:0,atk:false,touch:!!(window.matchMedia&&matchMedia('(pointer:coarse)').matches),jx:0,jy:0,jid:null,jox:0,joy:0};
addEventListener('keydown',e=>{
  if(e.target&&e.target.tagName==='INPUT')return;
  const k=e.key.toLowerCase();if(e.repeat&&k!=='tab')return;keys[k]=true;
  if(mode==='play'){
    if(k==='j')atkBuf=.18;
    if(k===' '||k==='k'){useSkill();e.preventDefault();}
    else if(k==='shift'||k==='l')dodge();
    else if(k==='q')usePotion();
    else if(k==='e'||k==='enter')interact();
    else if(k==='i'||k==='tab'||k==='escape'){openPanel();e.preventDefault();}
    else if(k==='m')toggleMute();
    else if(k==='`')openDebug();
  }else if(mode==='panel'){if(k==='escape'||k==='i'||k==='tab'){closePanel();e.preventDefault();}}
  else if(mode==='debug'){if(k==='escape'||k==='`')closeDebug();}
  else if(mode==='ask'){if(k==='e'||k==='enter')enterChamber();else if(k==='escape')closeAsk();}
});
addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
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
  if(e.button===0){inp.atk=true;atkBuf=.18;}else if(e.button===2)useSkill();
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

/* ---------- sound ---------- */
let AC=null,lastHit=0;
const SFX={block:[320,170,.07,'square',.06],swing:[220,90,.06,'triangle',.05],hit:[170,60,.08,'square',.05],crit:[520,140,.12,'square',.06],hurt:[110,40,.18,'sawtooth',.09],
  pick:[660,990,.08,'square',.035],lvl:[440,880,.35,'triangle',.08],skill:[330,660,.16,'sawtooth',.05],kill:[200,50,.14,'square',.045],boss:[70,38,.7,'sawtooth',.1],gate:[300,900,.5,'triangle',.07],
  cast:[720,420,.07,'sine',.04],boom:[150,40,.32,'sawtooth',.09],heal:[520,1040,.42,'sine',.07],rare:[620,1480,.5,'triangle',.08],lock:[95,45,.5,'square',.07]};
function sfx(k){
  if(muted)return;const d=SFX[k];if(!d)return;
  try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();
    const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=d[3];
    o.frequency.setValueAtTime(d[0],t);o.frequency.exponentialRampToValueAtTime(d[1],t+d[2]);
    g.gain.setValueAtTime(d[4],t);g.gain.exponentialRampToValueAtTime(.0001,t+d[2]);
    o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d[2]+.02);}catch(e){}
}
function toggleMute(){muted=!muted;$('#pMute').textContent='Sound: '+(muted?'off':'on');}

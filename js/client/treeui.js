'use strict';
// Blackspire: the skill tree screen (the rules are in js/sim/tree.js). Drag to look around, wheel or pinch to zoom,
// click a lit node to take it. P opens and closes it, as does the Tree button.

const TV={cv:null,x:null,panX:0,panY:0,z:.4,hover:null,drag:null,moved:0,pts:new Map()};
function openTree(){
  if(mode!=='play')return;mode='tree';inp.atk=false;for(const k in keys)keys[k]=false;
  $('#treeView').hidden=false;TV.cv=$('#treeCv');TV.x=TV.cv.getContext('2d');
  const r=TV.cv.getBoundingClientRect(),st=TREE[treeStart(S)];
  TV.z=Math.min(r.width,r.height)/2150;TV.panX=st.x*.25;TV.panY=st.y*.25;TV.hover=null;
  requestAnimationFrame(treeFrame);
}
function closeTree(){if(mode!=='tree')return;$('#treeView').hidden=true;$('#treeTip').hidden=true;mode='play';save();}
// tree units to the screen, and back
const tvS=(x,y,W,H)=>[W/2+(x-TV.panX)*TV.z,H/2+(y-TV.panY)*TV.z];
function treeFrame(){
  if(mode!=='tree')return;
  const cv=TV.cv,c=TV.x,r=cv.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
  if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr);}
  c.setTransform(dpr,0,0,dpr,0,0);const W=r.width,H=r.height,t=performance.now()/1000;
  c.fillStyle='#07060a';c.fillRect(0,0,W,H);
  // a faint ring of old stone behind it all
  const[o0,o1]=tvS(0,0,W,H);c.strokeStyle='rgba(201,164,92,.06)';c.lineWidth=1;for(const R of[230,600,960]){c.beginPath();c.arc(o0,o1,R*TV.z,0,7);c.stroke();}
  const own=new Set(treeOf(S)),start=treeStart(S),has=id=>own.has(id)||id===start,left=treeLeft(S);
  // links: bright when both ends are yours, warm when one is (the way on), faint otherwise
  for(const id in TREE){const q=TREE[id];for(const to of q.to){if(to<id)continue;const p=TREE[to],a=has(id),b=has(to);
    const[x1,y1]=tvS(q.x,q.y,W,H),[x2,y2]=tvS(p.x,p.y,W,H);
    c.strokeStyle=a&&b?'#c9a45c':a||b?'#5e4e30':'#221e1a';c.lineWidth=(a&&b?3:2)*Math.max(.6,TV.z*1.6);
    c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}}
  // nodes
  TV.pts.clear();
  for(const id in TREE){const q=TREE[id],[x,y]=tvS(q.x,q.y,W,H);if(x<-40||y<-40||x>W+40||y>H+40)continue;
    const R=({start:20,notable:15,skill:14,adv:11,small:8}[q.k])*Math.max(.55,TV.z*1.6);TV.pts.set(id,[x,y,R]);
    const mine=has(id),can=treeCanTake(S,id),other=q.k==='start'&&id!==start;
    c.beginPath();
    if(q.k==='skill'||q.k==='adv'){c.moveTo(x,y-R);c.lineTo(x+R,y);c.lineTo(x,y+R);c.lineTo(x-R,y);c.closePath();}   // skills are diamonds
    else c.arc(x,y,R,0,7);
    c.fillStyle=mine?(q.k==='start'?'#e9c87a':'#c9a45c'):q.soon?'#16141a':other?'#1c1814':'#1a1612';c.fill();
    c.lineWidth=q.k==='notable'||q.k==='start'?3:2;
    c.strokeStyle=can?`rgba(233,200,122,${.6+.4*Math.sin(t*4)})`:mine?'#f2dfae':q.soon?'#3a3640':q.k==='notable'?'#7a6436':'#4a4030';c.stroke();
    if(id===TV.hover){c.lineWidth=2;c.strokeStyle='#fff';c.beginPath();c.arc(x,y,R+5,0,7);c.stroke();}
    if(q.name&&(TV.z>.32||q.k==='start')){c.font=`${q.k==='start'?700:600} ${q.k==='start'?14:12}px Cinzel,Georgia,serif`;c.textAlign='center';c.textBaseline='top';
      c.lineWidth=3;c.strokeStyle='#000';c.strokeText(q.name,x,y+R+4);c.fillStyle=q.soon?'#7c7684':mine?'#efe2c2':'#bfae8a';c.fillText(q.name,x,y+R+4);}}
  // the header
  $('#treePts').textContent=`${left} point${left===1?'':'s'} to spend`;
  $('#treeSub').textContent=`${treeOf(S).length} taken · building from the ${TREE_START_NAMES[start].toLowerCase()}`+(treeOf(S).length?'':' (your weapon now: it is fixed by your first point)');
  const cost=treeResetCost(S),rb=$('#treeReset');rb.disabled=!treeOf(S).length||!P.safe||S.shards<cost;
  rb.textContent=treeOf(S).length?`Reset all (${cost} shards)`:'Reset all';rb.title=P.safe?'':'Only in a safe room or the village.';
  requestAnimationFrame(treeFrame);
}
function treePick(cx,cy){let best=null,bd=1e9;for(const[id,[x,y,R]]of TV.pts){const d=hyp(cx-x,cy-y);if(d<R+6&&d<bd){bd=d;best=id;}}return best;}
function treeTip(id,cx,cy){
  const tip=$('#treeTip');if(!id){tip.hidden=true;return;}const q=TREE[id],own=treeOf(S).includes(id)||id===treeStart(S);
  const kind={start:'Start',small:'Passive',notable:'Notable',skill:'Skill',adv:'Advanced skill'}[q.k];
  const state=own?'Yours':q.soon?'Cannot be taken yet':q.k==='start'?'Another weapon’s start':treeCanTake(S,id)?'Click to take':treeLeft(S)<1?'No points to spend':'Not connected to your nodes yet';
  tip.innerHTML=`<b>${esc(q.name||kind)}</b>${kind&&q.name?`<i>${kind}</i>`:''}<p>${esc(treeDesc(q))}</p><small>${state}</small>`;
  tip.hidden=false;const r=$('#treeView').getBoundingClientRect();tip.style.left=Math.min(cx+16,r.width-260)+'px';tip.style.top=Math.min(cy+16,r.height-110)+'px';
}
(()=>{
  const cv=$('#treeCv'),pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];},ptrs=new Map();
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,pos(e));TV.drag=pos(e);TV.moved=0;});
  cv.addEventListener('pointermove',e=>{const p=pos(e);
    if(ptrs.has(e.pointerId)){const old=ptrs.get(e.pointerId);ptrs.set(e.pointerId,p);
      if(ptrs.size===2){const[a,b]=[...ptrs.values()],d=hyp(a[0]-b[0],a[1]-b[1]);   // two fingers: pinch to zoom
        if(TV.pinch)TV.z=clamp(TV.z*d/TV.pinch,.15,1.6);TV.pinch=d;TV.moved=99;return;}
      TV.panX-=(p[0]-old[0])/TV.z;TV.panY-=(p[1]-old[1])/TV.z;TV.moved+=Math.abs(p[0]-old[0])+Math.abs(p[1]-old[1]);}
    TV.hover=treePick(...p);treeTip(TV.hover,...p);});
  const up=e=>{if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);TV.pinch=0;if(TV.moved<6){const id=treePick(...pos(e));if(id&&treeCanTake(S,id))act('treeTake',[id],r=>{if(r)sfx('lvl');});}};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',e=>{ptrs.delete(e.pointerId);TV.pinch=0;});
  cv.addEventListener('pointerleave',()=>{TV.hover=null;$('#treeTip').hidden=true;});
  cv.addEventListener('wheel',e=>{e.preventDefault();const[x,y]=pos(e),r=cv.getBoundingClientRect(),k=e.deltaY>0?1/1.12:1.12,nz=clamp(TV.z*k,.15,1.6);
    // zoom toward the pointer
    TV.panX+=(x-r.width/2)*(1/TV.z-1/nz);TV.panY+=(y-r.height/2)*(1/TV.z-1/nz);TV.z=nz;},{passive:false});
  $('#treeClose').onclick=closeTree;
  $('#treeReset').onclick=()=>act('treeReset',[],r=>{if(r)log('The skill tree is reset. Your next point picks where you build from.');});
  $('#btnTree').addEventListener('click',e=>{e.currentTarget.blur();openTree();});
})();

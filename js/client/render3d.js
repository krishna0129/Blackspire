'use strict';
// Blackspire: drawing the tower floors in 3D, with three.js (js/vendor/three.js) and KayKit's CC0 models
// (js/vendor/models.js). Nothing here changes the game: the rules still run on the same flat map, in game pixels, and
// this only draws what G and P say, in single player and online alike. The village is still drawn by render.js.
//
// One tile (TILE game pixels) is 2 world units here, KayKit's small floor tile. The game's x is x, the game's y (down
// the screen) is z (toward the camera), and height is y. The camera hangs high in the south, looking north and down.
// Everything is in one closure; outside it there is only R3 (state and settings), use3d() and render3d().
const R3=(()=>{
const U=2/TILE;                                   // world units per game pixel
const wx=px=>px*U,wz=py=>py*U;
const Q={off:false,low:false};                    // graphics setting: 3D (high), 3D (low: no shadows or bloom), or 2D
try{const v=localStorage.getItem('blackspire.gfx');Q.off=v==='2d';Q.low=v==='low';}catch(e){}
// The look. soft: KayKit as it comes. The others harden it: a colour grade, ink outlines, faceted shading.
const STYLES=[{name:'soft'},{name:'gritty',grade:[1.18,.68,1,.05,.045]},{name:'ink',grade:[1.18,.68,1,.05,.045],ink:true},{name:'ink, faceted',grade:[1.18,.68,1,.05,.045],ink:true,flat:true}];
let STYLE=STYLES[2];
const me={ready:false,failed:false,Q,g:null,cycle,label:()=>Q.off?'2D':Q.low?'3D (fast)':'3D'};

/* ---------- start-up: the renderer and the models ---------- */
let renderer,scene,camera,composer,bloom,grade,canvas,over,octx,moon,hemi,lantern;
let PROTO={},CHARS={},CLIP={},TOP={},FLOOR=null,DYN=null;
const T={};   // three.js classes, looked up once
// A KayKit body comes in ten parts (head, arms, legs...), each its own draw call. They share one skeleton and one
// material, so they are joined into one mesh; the eyes (which glow) and anything held (shown or hidden) stay apart.
function joinBody(root){
  root.updateMatrixWorld(true);
  const parts=[];root.traverse(c=>{if(c.isSkinnedMesh&&!/_Eyes$/.test(c.name))parts.push(c);});
  const groups=new Map();for(const p of parts){const k=p.material.uuid+p.skeleton.uuid;(groups.get(k)||groups.set(k,[]).get(k)).push(p);}
  for(const list of groups.values()){if(list.length<2)continue;const first=list[0];
    const geos=list.map(p=>{const g=new THREE.BufferGeometry(),M=new THREE.Matrix4().multiplyMatrices(first.bindMatrixInverse,p.bindMatrix),src=p.geometry;
      for(const[name,n,Type]of[['position',3,Float32Array],['normal',3,Float32Array],['uv',2,Float32Array],['skinIndex',4,Uint16Array],['skinWeight',4,Float32Array]]){
        const a=src.attributes[name];if(!a)return null;const arr=new Type(a.count*n);
        for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)arr[i*n+j]=a.getComponent(i,j);
        g.setAttribute(name,new THREE.BufferAttribute(arr,n));}
      if(src.index)g.setIndex(Array.from(src.index.array));
      g.applyMatrix4(M);return g;});
    if(geos.includes(null))continue;
    const merged=THREE.mergeGeometries(geos);if(!merged)continue;
    const body=new THREE.SkinnedMesh(merged,first.material);body.name='Body';body.bind(first.skeleton,first.bindMatrix);
    first.parent.add(body);for(const p of list)p.parent.remove(p);}
  return root;
}
function b64(s){const bin=atob(s),n=bin.length,a=new Uint8Array(n);for(let i=0;i<n;i++)a[i]=bin.charCodeAt(i);return a.buffer;}
me.init=async function(){
  if(typeof THREE==='undefined'||typeof MODELS==='undefined'){me.failed=true;return;}
  try{
    canvas=document.createElement('canvas');canvas.id='game3d';canvas.hidden=true;
    over=document.createElement('canvas');over.id='over';over.hidden=true;octx=over.getContext('2d');
    const hurt=$('#hurt');stage.insertBefore(canvas,hurt);stage.insertBefore(over,hurt);
    renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  }catch(e){console.warn('3D is not available here, drawing in 2D',e);me.failed=true;return;}
  renderer.shadowMap.type=THREE.PCFShadowMap;renderer.info.autoReset=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
  scene=new THREE.Scene();scene.background=new THREE.Color('#030304');scene.fog=new THREE.FogExp2('#05060a',.016);
  camera=new THREE.PerspectiveCamera(30,1,.5,400);
  hemi=new THREE.HemisphereLight('#4a5a80','#0b0806',.42);scene.add(hemi);
  moon=new THREE.DirectionalLight('#8aa0d8',.42);moon.castShadow=true;moon.shadow.mapSize.set(2048,2048);
  Object.assign(moon.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:120});moon.shadow.bias=-.0008;scene.add(moon,moon.target);
  lantern=new THREE.PointLight('#ffe2b8',22,19,1.6);scene.add(lantern);   // the light you carry
  for(let i=0;i<LIGHTS;i++){const l=new THREE.PointLight('#ff9440',0,11,1.8);scene.add(l);POOL_L.push(l);}
  // the models: props (one node per prop), the clips, and each character
  const loader=new THREE.GLTFLoader();loader.setMeshoptDecoder(THREE.MeshoptDecoder);
  const parse=k=>loader.parseAsync(b64(MODELS[k]),'');
  try{
    const [props,anims]=await Promise.all([parse('props'),parse('anims')]);
    props.scene.updateMatrixWorld(true);
    for(const h of props.scene.children){const parts=[];h.traverse(c=>{if(c.isMesh)parts.push({geo:c.geometry,mat:c.material,m:c.matrixWorld.clone()});});PROTO[h.name]={node:h,parts};}
    for(const c of anims.animations)CLIP[c.name]=c;
    for(const k in PROTO){const b=new THREE.Box3();for(const p of PROTO[k].parts){p.geo.computeBoundingBox();b.union(p.geo.boundingBox.clone().applyMatrix4(p.m));}TOP[k]=b.max.y;}
    for(const k of Object.keys(MODELS))if(k!=='props'&&k!=='anims')CHARS[k]=joinBody((await parse(k)).scene);
  }catch(e){console.warn('3D models failed to load, drawing in 2D',e);me.failed=true;return;}
  // post: bloom on everything hot, a vignette, then tone mapping
  composer=new THREE.EffectComposer(renderer,new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:4}));
  composer.addPass(new THREE.RenderPass(scene,camera));
  bloom=new THREE.UnrealBloomPass(new THREE.Vector2(4,4),.5,.5,.9);composer.addPass(bloom);
  composer.addPass(new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},k:{value:.62}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;uniform float k;varying vec2 v;void main(){vec4 c=texture2D(tDiffuse,v);vec2 d=v-.5;d.x*=1.6;float f=smoothstep(.95,.25,length(d));c.rgb*=mix(1.-k,1.,f);gl_FragColor=c;}'}));
  composer.addPass(new THREE.OutputPass());
  // the grade, on the finished picture: harder contrast, drained colour, cold shadows, a little film grain
  grade=new THREE.ShaderPass({uniforms:{tDiffuse:{value:null},con:{value:1},sat:{value:1},cold:{value:0},grain:{value:0},lift:{value:0},seed:{value:0}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float con,sat,cold,grain,lift,seed;varying vec2 v;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
      void main(){vec3 c=texture2D(tDiffuse,v).rgb;float l=dot(c,vec3(.299,.587,.114));
        c=mix(vec3(l),c,sat);c=(c-.5)*con+.5;
        c=max(c,0.)*(1.-lift)+lift*vec3(.55,.65,1.);   // the darkest dark is a deep blue-grey, never black: things in it still have a shape
        c=mix(c,c*vec3(.86,.96,1.08),cold*(1.-smoothstep(.0,.45,l)));   // shadows lean cold, light stays warm
        c+=(h(v*1000.)-.5)*grain;gl_FragColor=vec4(clamp(c,0.,1.),1.);}`});
  composer.addPass(grade);
  // the 3D canvas covers the 2D one, so it takes the mouse too
  canvas.addEventListener('pointerdown',e=>cv.dispatchEvent(new PointerEvent('pointerdown',e)));
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{if(mode!=='play')return;zoom=clamp(zoom*(e.deltaY>0?1.08:1/1.08),.75,1.45);e.preventDefault();},{passive:false});
  applyStyle();me.ready=true;
};
// The graphics setting, in turn: 3D, 3D (fast), 2D. Kept in this browser.
function cycle(){const next=Q.off?'3d':Q.low?'2d':'low';Q.off=next==='2d';Q.low=next==='low';
  try{localStorage.setItem('blackspire.gfx',next);}catch(e){}sized='';return me.label();}

/* ---------- sizes ---------- */
let sized='',zoom=1,VW=1,VH=1;
function fit(){
  const r=stage.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,Q.low?1:1.5),key=r.width+'x'+r.height+'x'+dpr+Q.low;
  if(key===sized)return;sized=key;VW=Math.max(1,r.width);VH=Math.max(1,r.height);
  renderer.setPixelRatio(dpr);renderer.setSize(VW,VH,false);composer.setPixelRatio(dpr);composer.setSize(VW,VH);
  bloom.enabled=!Q.low;renderer.shadowMap.enabled=!Q.low;moon.castShadow=!Q.low;scene.traverse(o=>{if(o.material&&o.material.needsUpdate!==undefined)o.material.needsUpdate=true;});
  over.width=Math.round(VW*dpr);over.height=Math.round(VH*dpr);octx.setTransform(dpr,0,0,dpr,0,0);
  camera.aspect=VW/VH;camera.updateProjectionMatrix();
}

/* ---------- static props: instanced, in chunks so the camera only draws what is near ---------- */
const M4=(x,y,z,ry=0,sx=1,sy=sx,sz=sx)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,ry,0)),new THREE.Vector3(sx,sy,sz));
const CH=32;   // chunk size, world units (16 tiles)
// The cutaway: walls between the camera and you would hide you, so anything tall in the stretch of floor just south
// of you (nearer the camera) is drawn only up to the knee there, the way the old isometric games cut their walls.
const CUT={value:new THREE.Vector3(0,0,-999)},CUTKEYS=/^(wall_|pillar|torch_mounted|banner_)/,cutMats=new Map();
function cutaway(mat){
  if(cutMats.has(mat))return cutMats.get(mat);const m=mat.clone();
  m.onBeforeCompile=sh=>{sh.uniforms.uCut=CUT;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutW;').replace('#include <project_vertex>',
      '#include <project_vertex>\nvec4 cw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ncw=instanceMatrix*cw;\n#endif\nvCutW=(modelMatrix*cw).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutW;uniform vec3 uCut;').replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nfloat cdz=vCutW.z-uCut.z;if(cdz>.6&&cdz<16.&&vCutW.y>1.05&&abs(vCutW.x-uCut.x)<7.+cdz*.5)discard;');};
  m.customProgramCacheKey=()=>'cut';cutMats.set(mat,m);return m;
}
function instance(group,placed){
  const tmp=new THREE.Matrix4();
  for(const[key,list]of placed){const P_=PROTO[key];if(!P_){console.warn('no prop',key);continue;}
    const chunks=new Map();for(const m of list){const c=Math.floor(m.elements[12]/CH)+','+Math.floor(m.elements[14]/CH);(chunks.get(c)||chunks.set(c,[]).get(c)).push(m);}
    const flat=key.startsWith('floor_');
    for(const ms of chunks.values())for(const part of P_.parts){
      const im=new THREE.InstancedMesh(part.geo,CUTKEYS.test(key)?cutaway(part.mat):part.mat,ms.length);ms.forEach((M,i)=>im.setMatrixAt(i,tmp.multiplyMatrices(M,part.m)));
      im.castShadow=!flat;im.receiveShadow=true;im.computeBoundingSphere();group.add(im);
      if(STYLE.ink&&!flat&&!/^(wall_|pillar)/.test(key)){   // outlines on the props, sized to the prop's own (quantized) units
        const sc=new THREE.Vector3().setFromMatrixScale(part.m),o=new THREE.InstancedMesh(part.geo,inkMat(.04/Math.max(sc.x,sc.y,sc.z)),ms.length);
        o.instanceMatrix=im.instanceMatrix;o.boundingSphere=im.boundingSphere;group.add(o);}}
  }
}
// One model placed on its own, to move or change later (chests, the boss gates, a held weapon).
function single(key){const P_=PROTO[key];const o=P_.node.clone(true);o.position.set(0,0,0);o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;if(CUTKEYS.test(key))c.material=cutaway(c.material);}});return o;}

/* ---------- ink: dark outlines, the model drawn again a little larger and inside out ---------- */
const INK=new Map();
function inkMat(w){if(INK.has(w))return INK.get(w);const m=new THREE.MeshBasicMaterial({color:'#07060a',side:THREE.BackSide,fog:true});
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position+normalize(normal)*'+w.toFixed(4)+';');};
  m.customProgramCacheKey=()=>'ink'+w;INK.set(w,m);return m;}
// Gives every mesh under o an outline. Skinned meshes get one that follows the same skeleton.
function ink(o,w){const add=[];o.traverse(c=>{if(!c.isMesh||c.userData.ink||c.userData.eyes)return;
    const m=c.isSkinnedMesh?new THREE.SkinnedMesh(c.geometry,inkMat(w)):new THREE.Mesh(c.geometry,inkMat(w));
    if(c.isSkinnedMesh)m.bind(c.skeleton,c.bindMatrix);m.userData.ink=true;m.castShadow=false;m.frustumCulled=false;add.push([c,m]);});
  for(const[c,m]of add){if(c.isSkinnedMesh)c.parent.add(m);else{m.position.copy(c.position);m.quaternion.copy(c.quaternion);m.scale.copy(c.scale);c.parent.add(m);}m.visible=c.visible;c.userData.inkMesh=m;}}

/* ---------- glows and flames ---------- */
let glowTex=null;
function getGlow(){if(glowTex)return glowTex;const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
  return glowTex=new THREE.CanvasTexture(c);}
// Many glowing points in one draw call (every torch flame on the floor, say).
function points(list,col,size,op=1){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(list,3));
  return new THREE.Points(g,new THREE.PointsMaterial({map:getGlow(),color:col,size,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));}
const add=m=>new THREE.MeshBasicMaterial({color:m.c,transparent:true,opacity:m.o??1,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,side:THREE.DoubleSide,vertexColors:!!m.vc});
function sprite(col,size,op=1){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:getGlow(),color:col,transparent:true,opacity:op,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));s.scale.setScalar(size);return s;}

/* ---------- building a floor ---------- */
const BANNERS=['banner_patternA_red','banner_patternB_red','banner_red','banner_thin_red','banner_shield_red','banner_triple_red'];
function build(){
  if(FLOOR){scene.remove(FLOOR.group);FLOOR.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
  for(const a of ACTORS.values())dropActor(a);ACTORS.clear();for(const a of DYING)dropActor(a);DYING.length=0;
  const g=G,map=g.map,group=new THREE.Group(),placed=new Map(),torches=[],flames={warm:[],green:[],blue:[]},floaters=[],fungi=[];
  const put=(key,x,y,z,ry,sx,sy,sz)=>{(placed.get(key)||placed.set(key,[]).get(key)).push(M4(x,y,z,ry,sx,sy,sz));};
  const at=(x,y)=>x<0||y<0||x>=MW||y>=MH?0:map[y*MW+x],open=(x,y)=>{const v=at(x,y);return v===1||v===3;};
  const inR=(r,x,y)=>x>=r.x&&x<r.x+r.w&&y>=r.y&&y<r.y+r.h;
  const safeR=g.rooms.filter(r=>r.kind==='safe'||r.kind==='start'),theme=floorDef(g.n).theme;
  const rnd=mulberry32((g.seed*31+g.n*7919)>>>0);
  // floor and walls: a wall on every edge between floor and rock. The ones facing the camera are cut down, so they
  // never hide the room (the old isometric trick), and a post stands wherever walls meet at a corner.
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){
    if(!open(x,y))continue;
    const cx=wx(x*TILE)+1,cz=wz(y*TILE)+1,r=rnd(),rot=Math.floor(rnd()*4)*Math.PI/2;
    if(safeR.some(q=>inR(q,x,y)))put('floor_wood_small_dark',cx,0,cz,(x+y)%2?0:Math.PI);
    else if(inR(g.boss,x,y))put(r<.12?'floor_tile_small_broken_A':'floor_tile_small',cx,0,cz,rot);
    else if(g.thorns&&g.thorns[y*MW+x])put(r<.5?'floor_dirt_small_weeds':'floor_dirt_small_A',cx,0,cz,rot);
    else put(r<.72?'floor_tile_small':r<.8?'floor_tile_small_broken_A':r<.86?'floor_tile_small_broken_B':r<.93?'floor_tile_small_decorated':'floor_tile_small_weeds_A',cx,0,cz,rot);
    const X=x*2,Z=y*2;
    if(!open(x,y-1))put('wall_half',X,0,Z,0);
    if(!open(x,y+1))put('wall_half',X,0,Z+2,0,1,.26,1);
    if(!open(x-1,y))put('wall_half',X,0,Z,-Math.PI/2);
    if(!open(x+1,y))put('wall_half',X+2,0,Z,-Math.PI/2);
  }
  for(let y=0;y<=MH;y++)for(let x=0;x<=MW;x++){
    const q=[open(x-1,y-1),open(x,y-1),open(x-1,y),open(x,y)],n=q.filter(Boolean).length;
    if(n===0||n===4)continue;
    if(n===2&&((q[0]&&q[1])||(q[2]&&q[3])||(q[0]&&q[2])||(q[1]&&q[3])))continue;   // a straight run of wall
    const low=(q[2]||q[3])&&!q[0]&&!q[1];
    put('pillar',x*2,0,y*2,0,.62,low?.26:1.02,.62);
  }
  // thorns: dark spikes in the patches (floor 3)
  if(g.thorns){const ms=[];for(let i=0;i<MW*MH;i++)if(g.thorns[i]){const x=i%MW,y=(i/MW)|0;
      for(let k=0;k<5;k++){const h=.25+rnd()*.5;ms.push(M4(x*2+.2+rnd()*1.6,h/2,y*2+.2+rnd()*1.6,rnd()*6,1,h/.5,1));}}
    if(ms.length){const im=new THREE.InstancedMesh(new THREE.ConeGeometry(.07,.5,5),new THREE.MeshStandardMaterial({color:'#3b4a26',roughness:.9}),ms.length);
      ms.forEach((m,i)=>im.setMatrixAt(i,m));im.castShadow=true;im.computeBoundingSphere();group.add(im);}}
  const torch=(x,z,ry,col='#ff9440',int=16,fl='warm')=>{   // a torch on a wall at (x, z), facing ry
    put('torch_mounted',x,2.25,z,ry);const s=Math.sin(ry),c=Math.cos(ry);
    flames[fl].push(x+s*.42,2.95,z+c*.42);torches.push({x:x+s*.6,y:3,z:z+c*.6,col,int,dist:11});};
  // Each floor lights its dark its own way; warm light is kept for the places that are safe (and the boss's fire).
  // floor 1, spirits: pale candles floating at head height, with cold blue flames
  // floor 2, the dead: skull candles burning green
  // floor 3, roots: glowing fungus
  const themed=(x,z,rr)=>{
    if(theme===0){floaters.push({x,z,y:1.6+rr()*.5,ph:rr()*6});torches.push({x,y:2.4,z,col:'#6f9cff',int:10,dist:10});}
    else if(theme===1){put('skull_candle',x,0,z,rr()*6);flames.green.push(x,TOP.skull_candle+.05,z);torches.push({x,y:2.2,z,col:'#5cf07a',int:6,dist:9});}
    else{fungi.push({x,z,n:3+Math.floor(rr()*3)});torches.push({x,y:.9,z,col:'#4ff0c0',int:8,dist:9});}};
  // dressing every room
  for(const[ri,r]of g.rooms.entries()){
    const rr=mulberry32((g.seed+ri*7919+g.n*104729)>>>0),rp=a=>a[Math.floor(rr()*a.length)];
    const safe=r.kind==='safe'||r.kind==='start',boss=r.kind==='boss';
    for(let x=r.x;x<r.x+r.w;x++){   // torches along the north wall, every third tile, banners between some of them
      if(open(x,r.y-1))continue;const k=x-r.x;
      if(k%3===1&&(safe||boss))torch(x*2+1,r.y*2+.5,0,'#ff9440',boss?20:16);
      else if(k%3===1&&theme===1)torch(x*2+1,r.y*2+.5,0,'#5cf07a',7,'green');
      else if(k%3===2&&rr()<(safe?.9:.55))put(safe?rp(['banner_patternA_blue','banner_shield_blue','banner_triple_blue']):theme===2&&rr()<.5?rp(['banner_patternA_green','banner_thin_green']):rp(BANNERS),x*2+1,0,r.y*2,0);
    }
    if(r.h>=6&&!boss)for(const side of[-1,1]){const x=side<0?r.x:r.x+r.w-1,y=r.y+Math.floor(r.h/2);   // and on the side walls of bigger rooms
      if(open(x+side,y)||!(safe||theme===1))continue;torch(side<0?r.x*2+.5:(r.x+r.w)*2-.5,y*2+1,side<0?Math.PI/2:-Math.PI/2,safe?'#ff9440':'#5cf07a',safe?16:7,safe?'warm':'green');}
    if(boss){   // torches down both side walls too, pillars in the far corners, red candles, the bones of the ones before you
      for(let y=r.y+2;y<r.y+r.h-1;y+=3)for(const side of[-1,1]){const x=side<0?r.x:r.x+r.w-1;if(open(x+side,y))continue;
        torch(side<0?r.x*2+.5:(r.x+r.w)*2-.5,y*2+1,side<0?Math.PI/2:-Math.PI/2,'#ff9440',18);}
      for(const[i,j]of[[.6,.6],[r.w-.6,.6]])put('pillar_decorated',(r.x+i)*2,0,(r.y+j)*2,0,.8);
      for(const[i,j]of[[3,3],[r.w-4,3],[3,r.h-4],[r.w-4,r.h-4]]){put('ribcage',(r.x+i)*2+1,0,(r.y+j)*2+1,rr()*6);put(rp(['bone_A','bone_B','bone_C']),(r.x+i)*2+1.8,0,(r.y+j)*2+.4,rr()*6);put('skull',(r.x+i)*2+.2,0,(r.y+j)*2+1.6,rr()*6);}
      for(const[i,j]of[[1,1],[r.w-2,1]]){put('candle_triple',(r.x+i)*2+1,0,(r.y+j)*2+1,0);torches.push({x:(r.x+i)*2+1,y:1.4,z:(r.y+j)*2+1,col:'#ff3a24',int:18,dist:9});flames.warm.push((r.x+i)*2+1,1.2,(r.y+j)*2+1);}
      continue;
    }
    if(safe){   // a camp: shelves and barrels along the walls; in a safe room, the fire the rules keep (g.fires), to rest by
      put('shelf_large',(r.x+r.w/2)*2,0,r.y*2+.9,0);put('barrel_large',r.x*2+1.1,0,(r.y+r.h-1)*2+.6,0);put('barrel_small_stack',r.x*2+1,0,(r.y+r.h-2)*2+.6,.4);
      put('crates_stacked',(r.x+r.w-1)*2+.6,0,(r.y+r.h-1)*2+.6,-.3);
      if(r.kind==='safe'){const fi=g.rooms.filter(q=>q.kind==='safe').indexOf(r),fp=(g.fires||[])[fi]||{x:(r.x+r.w/2)*TILE,y:(r.y+r.h/2)*TILE},fx=wx(fp.x),fz=wz(fp.y);camp(group,fx,fz);flames.warm.push(fx,.55,fz);torches.push({x:fx,y:1.3,z:fz,col:'#ff9a48',int:34,dist:16,fire:true});}
      continue;
    }
    // an ordinary room: its floor's lights near the walls, clutter in a corner or two, the dead's leftovers
    for(const[i,j]of[[1,1],[r.w-2,1],[1,r.h-2],[r.w-2,r.h-2],[Math.floor(r.w/2),1]].slice(0,r.w*r.h>50?5:3))if(rr()<.85)themed((r.x+i+.5)*2,(r.y+j+.5)*2,rr);
    for(const[i,j,c]of[[0,0,'n'],[r.w-1,0,'n'],[0,r.h-1,'s'],[r.w-1,r.h-1,'s']]){if(rr()<.45)continue;const x=(r.x+i)*2+1,z=(r.y+j)*2+1,k=rr();
      if(k<.3)put(rp(['barrel_large','barrel_small_stack','keg']),x,0,z,rr()*6);
      else if(k<.55)put(rp(['crates_stacked','box_stacked','box_large']),x,0,z,rr()*6);
      else if(k<.8&&theme>0)put(rp(['coffin','coffin_decorated']),x,0,z,c==='n'?0:Math.PI);
      else put('rubble_half',x,0,z,rr()*6);}
    const bones=theme===0?1+Math.floor(rr()*2):3+Math.floor(rr()*4);
    for(let k=0;k<bones;k++)put(rp(['bone_A','bone_B','bone_C','skull','ribcage']),(r.x+1+rr()*(r.w-2))*2,0,(r.y+1+rr()*(r.h-2))*2,rr()*6,.9);
    if(theme===2&&rr()<.5)put(rp(['gravestone','grave_A_destroyed']),(r.x+.6)*2,0,(r.y+.7)*2,0);
  }
  {const lit=torches.map(L=>[L.x,L.z]),inRoom=(x,y)=>g.rooms.some(r=>x>=r.x-1&&x<=r.x+r.w&&y>=r.y-1&&y<=r.y+r.h);
    const cr=mulberry32((g.seed*13+g.n)>>>0);
    for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){if(at(x,y)!==1||inRoom(x,y))continue;const X=x*2+1,Z=y*2+1;
      if(lit.some(([a,b])=>Math.abs(a-X)+Math.abs(b-Z)<12))continue;   // one every six tiles or so
      if(cr()<.2){lit.push([X,Z]);continue;}                               // and now and then a stretch left dark
      themed(X,Z,cr);lit.push([X,Z]);}}
  instance(group,placed);
  const FLAMES={warm:[['#ff8a2a',1.7,.85],['#ffcf6a',.65,1],[new THREE.Color('#fff0c0').multiplyScalar(2),.22,1]],
    green:[['#2fd05a',.9,.55],['#a8ffa0',.35,.8],[new THREE.Color('#e8ffe0').multiplyScalar(1.5),.14,1]],
    blue:[['#3a6cff',1.6,.9],['#9cc0ff',.7,1],[new THREE.Color('#eef4ff').multiplyScalar(2.5),.26,1]]};
  for(const k in flames)if(flames[k].length)for(const[col,size,op]of FLAMES[k]){const p=points(flames[k],col,size,op);p.material=cutaway(p.material);group.add(p);}
  // the floating candles: one instanced candle each, moved every frame (frame3d), with a blue flame above it
  let floatSet=null;
  if(floaters.length){const parts=PROTO.candle_thin.parts.map(pt=>{const im=new THREE.InstancedMesh(pt.geo,pt.mat,floaters.length);im.castShadow=true;im.frustumCulled=false;group.add(im);return{im,m:pt.m};});
    const fl=[];for(const q of floaters)fl.push(q.x,q.y,q.z);const pts=FLAMES.blue.map(([col,size,op])=>{const p=points(fl,col,size,op);p.frustumCulled=false;group.add(p);return p;});
    floatSet={list:floaters,parts,pts};}
  // the fungus: stems and glowing caps, instanced
  if(fungi.length){const cap=[],stem=[];
    for(const q of fungi)for(let i=0;i<q.n;i++){const a=rnd()*TAU,d=rnd()*.7,h=.25+rnd()*.5,s=.6+rnd()*.7,x=q.x+Math.cos(a)*d,z=q.z+Math.sin(a)*d;
      stem.push(M4(x,h/2,z,0,s,h/.5*s,s));cap.push(M4(x,h,z,rnd()*6,s*(1+rnd()*.4),s,s*(1+rnd()*.4)));}
    const mk=(geo,mat,ms)=>{const im=new THREE.InstancedMesh(geo,mat,ms.length);ms.forEach((m,i)=>im.setMatrixAt(i,m));im.computeBoundingSphere();group.add(im);};
    mk(new THREE.CylinderGeometry(.04,.06,.5,6),new THREE.MeshStandardMaterial({color:'#b8c4b0',roughness:.8,emissive:'#1a3a30',emissiveIntensity:.6}),stem);
    mk(new THREE.SphereGeometry(.18,10,6,0,TAU,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#1e5a52',roughness:.5,emissive:'#3ff0c0',emissiveIntensity:1.6}),cap);}
  // the boss chamber's gates: a portcullis, glowing red while sealed
  const gates=g.gates.map(q=>{const[a,b]=q.tiles,hz=a[1]===b[1],o=single('wall_gated');o.position.set(((a[0]+b[0])/2+.5)*2,0,((a[1]+b[1])/2+.5)*2);o.rotation.y=hz?0:Math.PI/2;
    if(hz&&a[1]>=g.boss.y+g.boss.h)o.scale.y=.3;   // the south gate faces the camera: cut down like the walls
    group.add(o);return o;});
  const chests=g.chests.map(c=>{const o=single('chest');o.position.set(wx(c.x),0,wz(c.y));o.rotation.y=rnd()*.6-.3;group.add(o);return o;});
  const stashes=(g.stashes||[]).map(q=>{const o=single('chest_gold');o.position.set(wx(q.x),0,wz(q.y));group.add(o);return o;});
  scene.add(group);
  FLOOR={g,group,torches,gates,chests,stashes,floatSet,born:performance.now()};me.g=g;
  scene.fog.density=.016;
}
// a campfire: logs, a ring of stones (the flame is a glow point and a light)
function camp(group,x,z){
  const wood=new THREE.MeshStandardMaterial({color:'#3b2516',roughness:1}),stone=new THREE.MeshStandardMaterial({color:'#4a4a52',roughness:1});
  for(let i=0;i<5;i++){const a=i/5*TAU,lg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.3,8),wood);lg.rotation.z=Math.PI/2;lg.rotation.y=a;lg.position.set(x+Math.cos(a)*.25,.15,z+Math.sin(a)*.25);lg.castShadow=true;group.add(lg);}
  for(let i=0;i<8;i++){const a=i/8*TAU,st=new THREE.Mesh(new THREE.DodecahedronGeometry(.2,0),stone);st.position.set(x+Math.cos(a)*.85,.1,z+Math.sin(a)*.85);group.add(st);}
  const s=sprite('#ffb050',2.6,.9);s.position.set(x,.7,z);group.add(s);
}

/* ---------- characters ---------- */
// Who you look like, by weapon: KayKit's adventurers and what they hold. atk: the swing clips, taken in turn.
const HERO={
  sword:{m:'Knight',hold:['1H_Sword','Round_Shield'],atk:['1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal']},
  mace:{m:'Barbarian',hold:['1H_Axe','Barbarian_Round_Shield'],atk:['1H_Melee_Attack_Chop','1H_Melee_Attack_Slice_Diagonal']},
  great:{m:'Barbarian',hold:['2H_Axe'],atk:['2H_Melee_Attack_Slice','2H_Melee_Attack_Chop'],idle:'2H_Melee_Idle'},
  spear:{m:'Knight',hold:['2H_Sword'],atk:['2H_Melee_Attack_Stab'],idle:'2H_Melee_Idle'},
  dagger:{m:'Rogue_Hooded',hold:['Knife','Knife_Offhand'],atk:['Dualwield_Melee_Attack_Slice','Dualwield_Melee_Attack_Stab']},
  bow:{m:'Rogue',hold:['2H_Crossbow'],atk:['2H_Ranged_Shoot']},
  grimoire:{m:'Mage',hold:['1H_Wand','Spellbook_open'],atk:['Spellcast_Shoot']},
};
const HELD=['1H_Sword_Offhand','Badge_Shield','Rectangle_Shield','Round_Shield','Spike_Shield','1H_Sword','2H_Sword','Spellbook','Spellbook_open','1H_Wand','2H_Staff',
  'Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable','1H_Axe_Offhand','Barbarian_Round_Shield','1H_Axe','2H_Axe','Mug'];
// The tower's creatures. m: model, r/l: what each hand holds, s: size, ghost: a spirit, pale and glowing that colour,
// tint: a colour laid over the model, two: swings two-handed, caster: casts instead of swinging. The bosses go by their
// sprite name. Floors 1 and 3 borrow skeletons for now; their own models come later.
const FOE={
  skel:{m:'Skeleton_Warrior',r:'Skeleton_Blade'},
  skelarcher:{m:'Skeleton_Rogue',r:'Skeleton_Crossbow',bow:true},
  skelknight:{m:'Skeleton_Warrior',r:'Skeleton_Axe',l:'Skeleton_Shield_Large_A',s:1.15},
  shade:{m:'Skeleton_Rogue',ghost:'#4a6ad0',r:'Skeleton_Blade'},
  skitter:{m:'Skeleton_Minion',ghost:'#b89a48',s:.7},
  brute:{m:'Skeleton_Warrior',ghost:'#b04a3e',s:1.35,r:'Skeleton_Axe',two:true},
  wisp:{orb:'#6fd6e6'},
  thrall:{m:'Skeleton_Minion',tint:'#8f9a5e',s:1.08},
  gravecaller:{m:'Skeleton_Mage',r:'Skeleton_Staff',caster:true},
  thornroot:{prop:'tree_dead_medium',s:.7},
  bloodbloom:{bloom:true},
  hermit:{m:'Skeleton_Warrior',tint:'#a08a62',s:1.3,r:'Skeleton_Axe',l:'Skeleton_Shield_Large_A'},
  dummy:{m:'Skeleton_Minion'},
  boss:{m:'Skeleton_Warrior',ghost:'#b85a4a',s:2.5,r:'Skeleton_Axe',l:'Skeleton_Shield_Large_A',two:true},
  boneboss:{m:'Skeleton_Warrior',s:2.7,r:'Skeleton_Axe',two:true},
  collector:{m:'Skeleton_Mage',tint:'#d8d4e6',s:2.5,r:'Skeleton_Staff',caster:true},
};
const ACTORS=new Map(),DYING=[],FREE=new Map();
// KayKit's people are drawn chibi: a big head on a short body. After the animation poses a skeleton each frame, the
// head is shrunk, the body narrowed, and the legs and spine lengthened (the joint after each lengthened bone is scaled
// back), so the figures stand taller and leaner. A model is lifted by what its legs gained (makeActor).
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const BUILD=typeof THREE==='undefined'?[]:[['hips',V3(.8,1,.84)],['spine',V3(.92,1.2,.92)],['chest',V3(1,1/1.2,1)],
  ['head',V3(.58/(.8*.92),.58,.58/(.84*.92))],['upperleg.l',V3(1,1.2,1)],['upperleg.r',V3(1,1.2,1)],['foot.l',V3(1,1/1.2,1)],['foot.r',V3(1,1/1.2,1)]];
// (The change is taken back before each update: a clip without a scale track for a bone leaves the scale alone, and
// it would otherwise compound frame after frame.)
function upd(a,dt){if(!a.mixer)return;if(a.build&&a.built)for(const[b,v]of a.build)b.scale.divide(v);
  a.mixer.update(dt);if(a.build){for(const[b,v]of a.build)b.scale.multiply(v);a.built=true;}}
const bone=(root,n)=>root.getObjectByName(n)||root.getObjectByName(n.replace('.',''));
// A character model, ready to animate. key: what it is (for reuse), o: {m, hold, r, l, s, ghost, tint, eyes}
function makeActor(key,o){
  const free=FREE.get(key);if(free&&free.length){const a=free.pop();a.root.visible=true;scene.add(a.root);a.cur=null;a.curName='';for(const x of Object.values(a.acts))x.stop();return a;}
  let root,mats=[];
  if(o.orb){   // a wisp: a small skull adrift in a cold flame, not a ball of light
    root=new THREE.Group();const sk=single('skull');sk.scale.setScalar(.55);sk.position.y=1.15;
    sk.traverse(c=>{if(c.isMesh){c.castShadow=false;c.material=c.material.clone();c.material.color=new THREE.Color('#b8e6ee');c.material.emissive=new THREE.Color(o.orb);c.material.emissiveIntensity=.35;mats.push(c.material);}});
    root.add(sk);root.userData.flame=[];
    for(let i=0;i<3;i++){const f=sprite(o.orb,.6-i*.14,.5-i*.1);f.position.y=1.45+i*.2;root.add(f);root.userData.flame.push(f);}
    const halo=sprite(o.orb,1.1,.2);halo.position.y=1.2;root.add(halo);}
  else if(o.bloom){root=new THREE.Group();const stem=new THREE.MeshStandardMaterial({color:'#2f3d22',roughness:.9}),pet=new THREE.MeshStandardMaterial({color:'#7a1424',roughness:.6,emissive:'#3a0610'});
    const st=new THREE.Mesh(new THREE.CylinderGeometry(.06,.1,1,6),stem);st.position.y=.5;root.add(st);
    for(let i=0;i<6;i++){const p=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6),pet);p.scale.set(1,.35,.55);const a=i/6*TAU;p.position.set(Math.cos(a)*.32,1.05,Math.sin(a)*.32);p.rotation.y=-a;p.rotation.z=.5;root.add(p);}
    const core=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshBasicMaterial({color:new THREE.Color('#ff5a6a').multiplyScalar(2)}));core.position.y=1.1;root.add(core);mats=[pet];}
  else if(o.prop){root=new THREE.Group();const t=single(o.prop);root.add(t);t.traverse(c=>{if(c.isMesh){c.material=c.material.clone();mats.push(c.material);}});}
  else{
    root=THREE.SkeletonUtils.clone(CHARS[o.m]);
    root.traverse(c=>{
      if(HELD.includes(c.name))c.visible=(o.hold||[]).includes(c.name);
      if(!c.isMesh)return;c.castShadow=true;c.receiveShadow=true;c.frustumCulled=false;
      c.material=c.material.clone();mats.push(c.material);
      if(/_Eyes$/.test(c.name)){c.material.emissive=new THREE.Color(o.eyes||'#8cf07a');c.material.emissiveIntensity=4;c.userData.eyes=true;return;}
      if(o.ghost){c.material.color=new THREE.Color(o.ghost).lerp(new THREE.Color('#ffffff'),.45);c.material.emissive=new THREE.Color(o.ghost);c.material.emissiveIntensity=.35;}
      if(o.tint)c.material.color=new THREE.Color(o.tint);
      if(o.rim)rim(c.material);
    });
    for(const[slot,w]of[['handslot.r',o.r],['handslot.l',o.l]])if(w){const b=bone(root,slot);if(b){const wm=single(w);if(o.ghost)wm.traverse(c=>{if(c.isMesh){c.material=c.material.clone();c.material.emissive=new THREE.Color(o.ghost);c.material.emissiveIntensity=.35;}});b.add(wm);}}
  }
  for(const m of mats){m.userData.base=[m.emissive?m.emissive.clone():null,m.emissiveIntensity||0];if(STYLE.flat){m.flatShading=true;m.needsUpdate=true;}}
  let model=null,build=null;
  if(o.m){   // a person or a skeleton: wrapped, so it can be lifted onto its longer legs
    model=root;root=new THREE.Group();root.add(model);
    build=(me.chibi?[]:BUILD).map(([n,v])=>[bone(model,n),v]).filter(q=>q[0]);
    model.updateMatrixWorld(true);const toe=bone(model,'toes.l'),y0=toe?toe.getWorldPosition(new THREE.Vector3()).y:0;
    for(const[b,v]of build)b.scale.multiply(v);model.updateMatrixWorld(true);
    const y1=toe?toe.getWorldPosition(new THREE.Vector3()).y:0;for(const[b,v]of build)b.scale.divide(v);
    model.position.y=y0-y1;}
  if(STYLE.ink)ink(root,o.s&&o.s>2?.02:.045);
  root.scale.setScalar(o.s||1);scene.add(root);
  const a={key,root,model,build,mats,mixer:model?new THREE.AnimationMixer(model):null,acts:{},cur:null,curName:'',face:0,o,lock:0,swT:-1,st:'',n:0,x:0,z:0,alpha:1,seen:0};
  return a;
}
// A faint pale edge on enemies, brightest where a surface turns away from the camera, so a skeleton standing in the
// dark still shows its outline: the room can be dark, but a threat is never invisible.
function rim(m){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',
  '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.16,.2,.3)*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.5);');};
  m.customProgramCacheKey=()=>'rim';}
function dropActor(a){scene.remove(a.root);a.root.visible=false;if(a.mixer)a.mixer.stopAllAction();a.cur=null;a.curName='';a.dead=false;a.alpha=1;fade(a,1);
  (FREE.get(a.key)||FREE.set(a.key,[]).get(a.key)).push(a);}
function fade(a,al){if(a.alpha===al)return;a.alpha=al;a.root.traverse(c=>{if(c.userData.inkMesh)c.userData.inkMesh.visible=c.visible&&al>=1;});for(const m of a.mats){m.transparent=al<1;m.opacity=al;}}
// Plays a clip: loops by default; once: plays through and holds the last frame. A new clip fades in over `fade` s.
function play(a,name,o={}){
  if(!a.mixer||!CLIP[name])return null;
  const act=a.acts[name]||(a.acts[name]=a.mixer.clipAction(CLIP[name]));
  act.timeScale=o.speed||1;
  if(a.cur===act&&!o.restart)return act;
  act.reset();act.setLoop(o.once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);act.clampWhenFinished=!!o.once;act.play();
  if(a.cur&&a.cur!==act)act.crossFadeFrom(a.cur,o.fade??.15,false);
  a.cur=act;a.curName=name;return act;
}
const turn=(a,to,dt,k=14)=>{a.face+=angDiff(to,a.face)*Math.min(1,k*dt);a.root.rotation.y=a.face;};
const faceOf=ang=>Math.atan2(Math.cos(ang),Math.sin(ang));   // a game angle as the model's turn (models face +z)
function flash(a,on,col,k=.9){for(const m of a.mats){const b=m.userData.base;if(!b||!b[0])continue;
  if(on){m.emissive.set(col||'#ffffff');m.emissiveIntensity=k;}else if(m.emissiveIntensity!==b[1]||!m.emissive.equals(b[0])){m.emissive.copy(b[0]);m.emissiveIntensity=b[1];}}}

// A player: you, or someone in your party online. wt: their weapon type.
function heroActor(id,wt){
  const h=HERO[wt]||HERO.sword,key='hero:'+wt;let a=ACTORS.get(id);
  if(a&&a.key!==key){dropActor(a);a=null;}
  if(!a){a=makeActor(key,h);ACTORS.set(id,a);}
  return a;
}
function animHero(a,pl,wt,dt){
  const h=HERO[wt]||HERO.sword;a.root.position.set(wx(pl.x),0,wz(pl.y));a.root.visible=pl.x>-900;
  if(pl.dead){if(a.curName!=='Death_A')play(a,'Death_A',{once:true,fade:.1});upd(a,dt);return;}
  const sw=pl.swing;let ang=DIR_ANGLE[pl.dir||0];
  if(sw){ang=sw.a??ang;if(a.swT<0||sw.t<a.swT-1e-3){   // a new swing
      const clip=h.atk[(a.n++)%h.atk.length],dur=Math.max(.36,sw.d*2.4);a.lock=dur*.85;
      play(a,clip,{once:true,restart:true,fade:.06,speed:CLIP[clip].duration/dur});}
    a.swT=sw.t;}else a.swT=-1;
  a.lock-=dt;
  if(a.lock<=0){
    if(pl.dash)play(a,'Dodge_Forward',{once:true,speed:1.6,fade:.08});
    else if(pl.blocking)play(a,'Blocking',{fade:.1});
    else if(pl.moving)play(a,'Running_A',{speed:1.05});
    else play(a,h.idle||'Idle',{fade:.2});
  }
  turn(a,faceOf(ang),dt);
  flash(a,pl.inv>0&&!pl.dash&&Math.floor(G.time*12)%2,'#ff3a2a',.3);
  upd(a,dt);
}

// An enemy: picks its model and its clip from its state.
function foeDef(e){return FOE[e.boss?e.sprite:e.type]||FOE.skel;}
function foeActor(e){
  let a=ACTORS.get('e'+e.id);if(a)return a;
  const d=foeDef(e),T_=ETYPES[e.type]||{},key=(e.boss?e.sprite:e.type)+(e.elite?'*':'');
  const eyes=e.boss?'#ff3b2a':e.elite?'#ffd45c':T_.eye;
  a=makeActor(key,Object.assign({},d,{eyes,rim:true,s:(d.s||1)*(e.elite?1.12:1)}));ACTORS.set('e'+e.id,a);
  a.x=wx(e.x);a.z=wz(e.y);a.face=Math.random()*TAU;
  // something that arrived after the floor was built climbs out of the ground (raised, called, summoned)
  if(performance.now()-FLOOR.born>1500&&!d.orb&&!d.prop&&!d.bloom&&!e.boss)play(a,'Skeletons_Awaken_Floor',{once:true,speed:1.6}),a.lock=1.1;
  return a;
}
const ATK=d=>d.two?'2H_Melee_Attack_Chop':'1H_Melee_Attack_Chop';
function animFoe(a,e,dt){
  const d=a.o,nx=wx(e.x),nz=wz(e.y),mx=nx-a.x,mz=nz-a.z,moved=Math.hypot(mx,mz)/Math.max(dt,1e-3);
  a.x=nx;a.z=nz;let y=0;
  if(d.orb){y=Math.sin(G.time*3+(e.ph||0))*.18;   // it drifts, and its flame licks upward
    a.root.userData.flame.forEach((f,i)=>{f.position.x=Math.sin(G.time*7+i*1.7)*.06*(i+1);f.material.opacity=(.45-i*.1)*(.75+.25*Math.sin(G.time*11+i));});}
  a.root.position.set(nx,y,nz);
  // where it looks: at whoever is nearest while it attacks, else where it walks
  const st=e.state,fighting=st==='windup'||st==='strike'||st==='draw'||st==='cast'||st==='channel'||st==='charge'||st==='shell';
  if(fighting){const t=nearestHero(e);if(t)turn(a,Math.atan2(wx(t.x)-nx,wz(t.y)-nz),dt,10);}
  else if(moved>.4)turn(a,Math.atan2(mx,mz),dt,10);
  if(st==='channel'&&e.cx!=null)turn(a,Math.atan2(wx(e.cx)-nx,wz(e.cy)-nz),dt,10);
  a.root.visible=!e.burrowed;
  flash(a,e.flash>0,'#ffffff');
  if(d.prop||d.bloom){   // rooted things sway, and lean in when they strike
    const k=st==='windup'?.12*Math.sin(G.time*30):st==='strike'?.25:Math.sin(G.time*1.3+(e.ph||0))*.04;a.root.rotation.z=k;return;}
  if(!a.mixer)return;
  a.lock-=dt;
  if(a.st!==st){const was=a.st;a.st=st;
    if(st==='windup')play(a,d.caster?'Spellcast_Shoot':ATK(d),{once:true,restart:true,speed:.4,fade:.08});
    else if(st==='strike'){if(a.curName===ATK(d))a.cur.timeScale=1.7;else play(a,ATK(d),{once:true,speed:1.7,fade:.05});a.lock=.35;}
    else if(was==='draw'){play(a,'2H_Ranged_Shoot',{once:true,speed:1.4,fade:.05});a.lock=.4;}
    else if(st==='cast'&&!e.boss)play(a,'Spellcast_Shoot',{once:true,restart:true,fade:.08});
    else if(st==='hop'){play(a,'Dodge_Forward',{once:true,speed:1.8,fade:.05});a.lock=.3;}
    else if(st==='exposed')play(a,'Hit_B',{fade:.08});
    else if(st==='emerge'){play(a,'Spawn_Ground',{once:true,fade:.05});a.lock=.8;}
  }
  if(a.lock>0&&st!=='windup'){upd(a,dt);return;}
  if(st==='windup'||st==='strike'){}
  else if(st==='draw')play(a,'2H_Ranged_Aiming',{fade:.1});
  else if(st==='cast')play(a,e.boss?'Spellcasting':'Spellcast_Shoot',{fade:.1});
  else if(st==='channel')play(a,'Spellcast_Summon',{fade:.15});
  else if(st==='shell')play(a,'Blocking',{fade:.1});
  else if(st==='charge')play(a,'Running_B',{speed:1.5,fade:.1});
  else if(e.stun>0)play(a,'Hit_A',{fade:.05});
  else if(moved>.6)play(a,moved>7?'Running_A':'Walking_A',{speed:clamp(moved/(moved>7?9:4),.6,1.8),fade:.15});
  else play(a,st==='idle'?'Idle':'Idle_Combat',{fade:.25});
  upd(a,dt);
}
function nearestHero(e){let best=null,bd=1e9;for(const q of[P,...(NET.on?NET.others:[])]){if(!q||q.dead||q.x<-900)continue;const d=hyp(q.x-e.x,q.y-e.y);if(d<bd){bd=d;best=q;}}return best;}

/* ---------- things that come and go: a pool of each kind, handed out afresh every frame ---------- */
const POOLS=[],POOL_L=[],LIGHTS=12;
function pool(make){const p={items:[],n:0,make};POOLS.push(p);return p;}
function take(p){let o=p.items[p.n];if(!o){o=p.make();p.items.push(o);scene.add(o);}o.visible=true;p.n++;return o;}
function endPools(){for(const p of POOLS){for(let i=p.n;i<p.items.length;i++)p.items[i].visible=false;p.n=0;}}
const ground=(geo,o)=>()=>{const g=new THREE.Group(),m=new THREE.Mesh(geo,add(o));m.rotation.x=-Math.PI/2;g.add(m);g.userData.m=m;return g;};
const unitCircle=new THREE.CircleGeometry(1,48),unitRing=new THREE.RingGeometry(.9,1,64),unitPlane=new THREE.PlaneGeometry(1,1).translate(.5,0,0);
const P_DISC=pool(ground(unitCircle,{c:'#ff2a1a',o:.25})),P_RING=pool(ground(unitRing,{c:'#ff2a1a',o:.8})),P_LANE=pool(ground(unitPlane,{c:'#ff2a1a',o:.25}));
const SECTORS=new Map();
const P_CONE=pool(()=>{const g=new THREE.Group(),m=new THREE.Mesh(unitCircle,add({c:'#ff2a1a',o:.25}));m.rotation.x=-Math.PI/2;g.add(m);g.userData.m=m;return g;});
const sector=half=>{const k=Math.round(half*100);if(!SECTORS.has(k))SECTORS.set(k,new THREE.CircleGeometry(1,32,-half,half*2));return SECTORS.get(k);};
const P_GLOW=pool(()=>sprite('#ffffff',1,1)),P_ORB=pool(()=>new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:'#ffffff',fog:false})));
const P_ARROW=pool(()=>{const g=new THREE.Group(),a=single('arrow');a.rotation.y=Math.PI/2;g.add(a);return g;});
const P_GEM=pool(()=>{const m=new THREE.Mesh(new THREE.OctahedronGeometry(.22,0),new THREE.MeshStandardMaterial({color:'#ffffff',emissive:'#ffffff',emissiveIntensity:.8,roughness:.3,metalness:.2}));m.castShadow=true;return m;});
const P_BEAM=pool(()=>new THREE.Mesh(new THREE.CylinderGeometry(.06,.18,3,8,1,true).translate(0,1.5,0),add({c:'#ffffff',o:.5})));
const P_PILE=pool(()=>{const g=new THREE.Group(),a=single('ribcage'),b=single('skull');b.position.set(.5,0,.3);g.add(a,b);return g;});
const P_SPIKE=pool(()=>{const m=new THREE.Mesh(new THREE.ConeGeometry(.13,1,6).translate(0,.5,0),new THREE.MeshStandardMaterial({color:'#d9d4c4',roughness:.8}));m.castShadow=true;return m;});
const P_MOUND=pool(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,10,6,0,TAU,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#3a3022',roughness:1}));m.scale.set(1,.35,1);return m;});
// lines through the air (a Gravecaller's channel, a bolt): N points each, rewritten every frame
const P_LINE=pool(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(17*3),3));
  return new THREE.Line(g,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,blending:THREE.AdditiveBlending,fog:false,depthWrite:false}));});
function line(fn,col,op=1){const l=take(P_LINE),a=l.geometry.attributes.position;for(let i=0;i<=16;i++){const v=fn(i/16);a.setXYZ(i,v[0],v[1],v[2]);}a.needsUpdate=true;l.geometry.computeBoundingSphere();
  l.material.color.set(col).multiplyScalar(3);l.material.opacity=op;return l;}
// slashes: arcs in the air, from their tail to their lead, brightest at the lead; a few kept per frame
const P_ARC=pool(()=>{const n=33,g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*2*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*2*3),3));
  const idx=[];for(let i=0;i<n-1;i++){const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2);}g.setIndex(idx);
  return new THREE.Mesh(g,add({c:'#ffffff',o:.9,vc:true}));});
function arc(x,z,h,r,w,a0,a1,col,op=.9){const m=take(P_ARC),p=m.geometry.attributes.position,c=m.geometry.attributes.color;
  for(let i=0;i<33;i++){const u=i/32,a=a0+(a1-a0)*u,k=Math.pow(u,1.6),cs=Math.cos(a),sn=Math.sin(a);
    p.setXYZ(i*2,x+cs*(r-w/2),h,z+sn*(r-w/2));p.setXYZ(i*2+1,x+cs*(r+w/2),h,z+sn*(r+w/2));c.setXYZ(i*2,k,k,k);c.setXYZ(i*2+1,k,k,k);}
  p.needsUpdate=c.needsUpdate=true;m.geometry.computeBoundingSphere();m.material.color.set(col).multiplyScalar(1.6);m.material.opacity=op;return m;}
function disc(x,z,r,col,op){const g=take(P_DISC);g.position.set(x,.08,z);g.scale.setScalar(Math.max(r,.01));g.userData.m.material.color.set(col);g.userData.m.material.opacity=op;return g;}
function ring(x,z,r,col,op,y=.09){const g=take(P_RING);g.position.set(x,y,z);g.scale.setScalar(Math.max(r,.01));g.userData.m.material.color.set(col);g.userData.m.material.opacity=op;return g;}
function glow(x,y,z,col,size,op=1){const s=take(P_GLOW);s.position.set(x,y,z);s.scale.setScalar(size);s.material.color.set(col);s.material.opacity=op;return s;}
function orb(x,y,z,col,size,lit){const o=take(P_ORB);o.position.set(x,y,z);o.scale.setScalar(size);o.material.color.set(col).multiplyScalar(4);glow(x,y,z,col,size*9,.75);glow(x,y,z,'#fff3d0',size*3.5,.9);
  if(lit)DLIGHTS.push({x,y,z,col,int:lit,dist:10,pri:6});return o;}

/* ---------- lights: a few real lights, moved to the torches nearest you ---------- */
let DLIGHTS=[],lightT=0,chosen=[];
function placeLights(dt,cx,cz){
  const F=FLOOR;lightT-=dt;
  if(lightT<=0){lightT=.25;chosen=F.torches.map(L=>({L,d:Math.hypot(L.x-cx,L.z-cz)-(L.fire?6:0)})).filter(q=>q.d<34).sort((a,b)=>a.d-b.d).slice(0,LIGHTS).map(q=>q.L);}
  const dyn=DLIGHTS.sort((a,b)=>b.pri-a.pri).slice(0,3),list=[...dyn,...chosen].slice(0,LIGHTS);
  POOL_L.forEach((l,i)=>{const L=list[i];if(!L){l.intensity=0;return;}
    const fl=L.fire||L.dist>=11?(.9+.1*Math.sin(G.time*9+L.x*3)*Math.sin(G.time*5.3+L.z)):1;
    l.position.set(L.x,L.y,L.z);l.color.set(L.col);l.distance=L.dist;
    const far=Math.hypot(L.x-cx,L.z-cz),fadeOut=clamp((34-far)/8,0,1);l.intensity=L.int*fl*fadeOut;});
  DLIGHTS=[];
}

/* ---------- each frame ---------- */
const tmpV=new THREE.Vector3(),camT=new THREE.Vector3(),seenIds=new Set(),tmp3=new THREE.Vector3(),qt=new THREE.Quaternion(),eu=new THREE.Euler(),one3=new THREE.Vector3(1.6,1.6,1.6);
let lastT=0;
function frame3d(){
  fit();renderer.info.reset();
  if(me.g!==G||!FLOOR)build();
  const now=performance.now(),dt=Math.min(.05,lastT?(now-lastT)/1000:0);lastT=now;
  const F=FLOOR,t=G.time;
  // the camera: high in the south, looking down at you. Wider screens see more; tall ones step back.
  const px=wx(P.x),pz=wz(P.y),tgt=tmpV.set(px,.8,pz);
  if(camT.lengthSq()===0||camT.distanceTo(tgt)>30)camT.copy(tgt);else camT.lerp(tgt,Math.min(1,dt*9));
  const pitch=55*Math.PI/180,need=30/(2*Math.tan(15*Math.PI/180)*camera.aspect),dist=clamp(Math.max(30,need),24,64)*zoom;
  const sh=G.shake?G.shake*.03:0;
  camera.position.set(camT.x+rand(-sh,sh),camT.y+dist*Math.sin(pitch),camT.z+dist*Math.cos(pitch));camera.lookAt(camT.x,camT.y,camT.z);
  // the moon's shadows follow you; snapped to its texels so they do not shimmer
  const snap=52/2048;moon.target.position.set(Math.round(camT.x/snap)*snap,0,Math.round(camT.z/snap)*snap);moon.position.set(moon.target.position.x-18,40,moon.target.position.z-6);
  CUT.value.set(px,0,pz);
  lantern.position.set(px,5,pz+1.2);lantern.intensity=P.dead?6:24;
  // the floating candles drift up and down
  if(F.floatSet){const fs=F.floatSet,m=new THREE.Matrix4(),tmp=new THREE.Matrix4(),arr=fs.pts[0].geometry.attributes.position;
    fs.list.forEach((q,i)=>{const y=q.y+Math.sin(t*1.3+q.ph)*.14;m.compose(tmp3.set(q.x,y,q.z),qt.setFromEuler(eu.set(Math.sin(t+q.ph)*.08,0,Math.cos(t*.8+q.ph)*.08)),one3);
      for(const p of fs.parts)p.im.setMatrixAt(i,tmp.multiplyMatrices(m,p.m));arr.setXYZ(i,q.x,y+TOP.candle_thin*1.6+.1,q.z);});
    for(const p of fs.parts)p.im.instanceMatrix.needsUpdate=true;
    for(const p of fs.pts){if(p.geometry.attributes.position!==arr){p.geometry.attributes.position.copy(arr);}p.geometry.attributes.position.needsUpdate=true;}}
  // the boss gates, chests and stashes
  F.gates.forEach((o,i)=>{o.visible=!G.gatesOpen;if(!G.gatesOpen){const q=G.gates[i];DLIGHTS.push({x:wx(q.x),y:1.4,z:wz(q.y),col:'#ff2a1a',int:8,dist:7,pri:1});glow(wx(q.x),1.6,wz(q.y),'#ff2a1a',3,.35+.1*Math.sin(t*3));}});
  const opened=floorState(G.n).chests;
  F.chests.forEach((o,i)=>{const lid=o.getObjectByName('chest_lid');if(lid)lid.rotation.x=opened.includes(i)?-1.9:0;});
  // you and your party
  const wt=S.equip&&S.equip.weapon?S.equip.weapon.type:'sword';
  seenIds.clear();npcs(dt);
  const mine=heroActor('me',wt);seenIds.add('me');animHero(mine,P,wt,dt);
  if(!P.dead){ring(px,pz,.75,'#e9c87a',.35,.06);disc(px,pz,.75,'#e9c87a',.06);}   // a faint ring under you, so you never lose yourself in a crowd
  if(NET.on)for(const q of NET.others){if(q.x<-900)continue;const a=heroActor('p'+q.id,q.wtype||'sword');seenIds.add('p'+q.id);animHero(a,q,q.wtype||'sword',dt);
    DLIGHTS.push({x:wx(q.x),y:3.2,z:wz(q.y),col:'#ffe2b8',int:14,dist:11,pri:2});}
  // enemies near enough to matter
  const reachX=dist*.27*camera.aspect+5,reachZ=dist*.62+4;   // about what the camera sees, and a little more
  for(const e of G.enemies){if(Math.abs(wx(e.x)-camT.x)>reachX||Math.abs(wz(e.y)-camT.z)>reachZ)continue;
    const a=foeActor(e);seenIds.add('e'+e.id);a.last=e;a.seen=now;animFoe(a,e,dt);
    if(a.o.orb)DLIGHTS.push({x:a.x,y:1.4,z:a.z,col:a.o.orb,int:3,dist:5,pri:0});
    if(e.boss)DLIGHTS.push({x:a.x,y:5.5*(a.o.s||1)/2.7,z:a.z+1,col:'#ff3020',int:40,dist:16,pri:9});
    if(e.burrowed){const m=take(P_MOUND);m.position.set(wx(e.x),0,wz(e.y));m.scale.set(1+.1*Math.sin(t*8),.35,1);}
    if(e.state==='channel'&&e.cx!=null){const sx=a.x,sz=a.z,ex=wx(e.cx),ez=wz(e.cy);
      line(u=>[sx+(ex-sx)*u,2.2*(1-u)+.5*u+Math.sin(u*Math.PI)*.8+Math.sin(u*18+t*8)*.06,sz+(ez-sz)*u],'#8cf07a');
      ring(ex,ez,1.1,'#8cf07a',.9);disc(ex,ez,1.1,'#8cf07a',.15);DLIGHTS.push({x:ex,y:.9,z:ez,col:'#8cf07a',int:14,dist:7,pri:3});}
  }
  // the ones gone since last frame: the dead fall and fade; the rest just leave
  // (one still on the floor has only walked out of view; online, one gone from the server's list near you has died)
  const present=new Set();for(const e of G.enemies)present.add('e'+e.id);
  for(const[id,a]of ACTORS)if(!seenIds.has(id)){ACTORS.delete(id);
    const e=a.last,dead=e&&!present.has(id)&&(e.dead||(NET.on&&!e.boss&&hyp(e.x-P.x,e.y-P.y)<VIEW_DEAD));
    if(id.startsWith('e')&&dead&&a.mixer){play(a,a.o.m&&a.o.m.startsWith('Skeleton')&&!a.o.ghost?'Death_C_Skeletons':'Death_A',{once:true,fade:.05,speed:1.2});a.dead=1.8;DYING.push(a);}
    else dropActor(a);}
  for(let i=DYING.length-1;i>=0;i--){const a=DYING[i];a.dead-=dt;upd(a,dt);if(a.dead<.6)fade(a,Math.max(0,a.dead/.6));if(a.dead<=0){DYING.splice(i,1);dropActor(a);}}
  // the floor gate home (amber) and the way up (cyan)
  for(const[q,col,hi]of[[G.home,'#e2b93b','#f5e2a8'],[G.gate,'#6fd6e6','#c8f3fa']]){if(!q)continue;const x=wx(q.x),z=wz(q.y),pu=Math.sin(t*3)*.08;
    ring(x,z,1.5+pu,col,.9);ring(x,z,1.05,hi,.6);disc(x,z,1.5,col,.18);glow(x,.4,z,col,3.6,.55);
    const b=take(P_BEAM);b.position.set(x,0,z);b.scale.set(6,1.4,6);b.material.color.set(col);b.material.opacity=.18+.05*Math.sin(t*4);
    DLIGHTS.push({x,y:1.2,z,col,int:16,dist:9,pri:4});}
  // telegraphs: red on the floor, filling as the blow comes
  for(const q of G.tele){const p=clamp(q.t/q.d,0,1),x=wx(q.x),z=wz(q.y);
    if(q.cone){for(const[r,op]of[[q.len,.18],[q.len*p,.32]]){const g=take(P_CONE);g.userData.m.geometry=sector(q.half);g.position.set(x,.08+op*.01,z);g.rotation.y=-q.a;g.scale.setScalar(wx(Math.max(r,.1)));g.userData.m.material.color.set('#ff2a1a');g.userData.m.material.opacity=op;}}
    else if(q.line){for(const[l,op]of[[q.len,.22],[q.len*p,.3]]){const g=take(P_LANE);g.position.set(x,.08+op*.01,z);g.rotation.y=-q.a;g.scale.set(wx(Math.max(l,.1)),1,wx(26));g.userData.m.material.color.set('#ff2a1a');g.userData.m.material.opacity=op;}}
    else{disc(x,z,wx(q.r),'#ff2a1a',.16);disc(x,z,wx(q.r)*p,'#ff2a1a',.3);ring(x,z,wx(q.r),'#ff4a2a',.9);}}
  // the Pale Collector's lantern sweep
  if(G.beams)for(const B of G.beams){const L=beamReach(B.x,B.y,B.a,B.len),g=take(P_LANE);g.position.set(wx(B.x),.1,wz(B.y));g.rotation.y=-B.a;g.scale.set(wx(L),1,wx(12));g.userData.m.material.color.set('#e2b93b');g.userData.m.material.opacity=.55;
    const c=take(P_LANE);c.position.set(wx(B.x),.11,wz(B.y));c.rotation.y=-B.a;c.scale.set(wx(L),1,wx(4));c.userData.m.material.color.set('#ffe9a8');c.userData.m.material.opacity=.8;
    DLIGHTS.push({x:wx(B.x+Math.cos(B.a)*L*.6),y:1,z:wz(B.y+Math.sin(B.a)*L*.6),col:'#ffd27a',int:20,dist:12,pri:5});}
  // bodies on the floor (floor 3)
  if(G.corpses)for(const c of G.corpses){const g=take(P_PILE);g.position.set(wx(c.x),0,wz(c.y));g.rotation.y=(c.x*7+c.y)%TAU;}
  // shots
  for(const p of G.proj){const x=wx(p.x),z=wz(p.y);if(p.arrow){const a=take(P_ARROW);a.position.set(x,1.4,z);a.rotation.y=-(p.a??Math.atan2(p.vy,p.vx));}else orb(x,1.4,z,p.c||'#6fd6e6',.12,8);}
  for(const p of G.pproj){const x=wx(p.x),z=wz(p.y);
    if(p.k==='fire')orb(x,1.5,z,'#ff8a2a',.22,22);
    else if(p.k==='arrow'){const a=take(P_ARROW);a.position.set(x,1.4,z);a.rotation.y=-(p.a??Math.atan2(p.vy,p.vx));}
    else orb(x,1.5,z,'#b9a8ff',.11,6);}
  // what you can pick up: a gem of its colour, bobbing; good gear casts a beam
  for(const d of G.drops){if(d.owner!==P.id)continue;const m=take(P_GEM),x=wx(d.x),z=wz(d.y);
    const col=d.k==='shard'?'#6fd6e6':d.k==='mat'?(MATS[d.id]?MATS[d.id].color:'#cccccc'):d.k==='potion'?'#d9534f':d.k==='ration'?'#d9a441':d.k==='flask'?'#5aa7e6':RARITY[d.item.rarity].color;
    m.position.set(x,.45+Math.sin(d.t*4)*.1,z);m.rotation.y=d.t*2;m.material.color.set(col);m.material.emissive.set(col);m.scale.setScalar(d.k==='shard'?.8:d.k==='item'?1.3:1);
    if(d.k==='item'&&d.item.rarity>=2){const b=take(P_BEAM);b.position.set(x,0,z);b.scale.set(1,1,1);b.material.color.set(col);b.material.opacity=.45;}}
  // effects
  for(const f of G.fx){const p=f.t/f.d,x=wx(f.x),z=wz(f.y),al=1-p*p;
    if(f.k==='slash'||f.k==='eslash'){const half=(f.arc||120)/2*Math.PI/180,r=wx(f.r);
      if(f.k==='slash'&&f.arc>=360){const a=f.a+p*TAU;arc(x,z,1.15,r,.5,a-2.6,a,'#bfe9ff',al);}
      else if(f.k==='slash'){const s=Math.min(1,p*1.6),a0=f.a+(f.dir>0?-half:half),a1=f.a+(f.dir>0?-half+2*half*s:half-2*half*s);arc(x,z,1.15,r,.45,a0,a1,'#cfe8ff',al);}
      else arc(x,z,1.2,r,.35,f.a-1,f.a-1+2*Math.min(1,p*1.8),'#d9d4c4',al*.8);}
    else if(f.k==='line'){const g=take(P_LANE);g.position.set(x,1.1,z);g.rotation.y=-f.a;g.scale.set(wx(f.len),1,f.w?.5:.18);g.userData.m.material.color.set('#cfe8ff');g.userData.m.material.opacity=al*.8;}
    else if(f.k==='ring'){ring(x,z,wx(f.r)*p,'#cfe8ff',al*.9,.15);}
    else if(f.k==='pulse'){ring(x,z,wx(f.r)*Math.min(1,.3+p*1.2),f.c||'#9be08a',al*.9,.15);}
    else if(f.k==='boom'){const r=wx(f.r)*Math.min(1,p*1.8);disc(x,z,r,'#f08a3c',(1-p)*.45);ring(x,z,r,'#ffe9a8',al);glow(x,1,z,'#ff8a2a',r*3,(1-p)*.8);DLIGHTS.push({x,y:1.5,z,col:'#ff8a2a',int:40*(1-p),dist:14,pri:8});}
    else if(f.k==='heal'){const r=wx(6+(f.r-6)*Math.min(1,p*1.7));ring(wx(P.x),wz(P.y),r,'#9be08a',al);disc(wx(P.x),wz(P.y),r,'#9be08a',(1-p)*.2);
      for(let i=0;i<6;i++){const a=i*1.05+.4;glow(wx(P.x)+Math.cos(a)*.8,.4+p*2.6+(i%3)*.3,wz(P.y)+Math.sin(a)*.8,i%2?'#ffe9a8':'#9be08a',.5,al);}
      DLIGHTS.push({x:wx(P.x),y:1.5,z:wz(P.y),col:'#9be08a',int:20*(1-p),dist:9,pri:7});}
    else if(f.k==='spikes'){for(let i=0;i<8;i++){const a=i*.85,r=wx(3+(i%3)*6),s=take(P_SPIKE);s.position.set(x+Math.cos(a)*r,0,z+Math.sin(a)*r*.8);s.scale.set(1,(1-p)*(.9+(i%3)*.5),1);}}
    else if(f.k==='raise'){const x2=wx(f.x2),z2=wz(f.y2);line(u=>[x+(x2-x)*u,2.2*(1-u)+.5*u+Math.sin(u*Math.PI)*.8,z+(z2-z)*u],'#9be08a',al);}
    else if(f.k==='bolt'){const x2=wx(f.x2),z2=wz(f.y2);line(u=>[x+(x2-x)*u+(u>0&&u<1?rand(-.15,.15):0),1.4+(u>0&&u<1?rand(-.15,.15):0),z+(z2-z)*u],'#6fd6e6',al);}
  }
  placeLights(dt,camT.x,camT.z);
  endPools();
  parts();
  grade.uniforms.seed.value=(t*7.13)%10;composer.render(dt);
  overlay();
}
const VIEW_DEAD=300;
// the sparks and dust of hits and deaths (G.parts), all in one draw call
let PARTS=null;
function parts(){
  if(!PARTS){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(900*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(900*3),3));
    PARTS=new THREE.Points(g,new THREE.PointsMaterial({size:.16,map:getGlow(),vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false}));PARTS.frustumCulled=false;scene.add(PARTS);}
  const p=PARTS.geometry.attributes.position,c=PARTS.geometry.attributes.color,n=Math.min(900,G.parts.length),col=new THREE.Color();
  for(let i=0;i<n;i++){const q=G.parts[i],k=1-q.t/q.d;p.setXYZ(i,wx(q.x),1+q.t*2.2,wz(q.y));col.set(q.c).multiplyScalar(2*k);c.setXYZ(i,col.r,col.g,col.b);}
  PARTS.geometry.setDrawRange(0,n);p.needsUpdate=c.needsUpdate=true;
}

/* ---------- the overlay: numbers, health bars and names, drawn flat over the 3D view ---------- */
const NUMCOL={crit:'#ffd45c',hurt:'#ff5a52',bleed:'#d0607a',heal:'#9be08a',evade:'#6fd6e6',mana:'#7fa8ff',resist:'#8e97b5',bane:'#f2a03c'};
function scr(x,h,z){tmpV.set(x,h,z).project(camera);return tmpV.z>1?null:[(tmpV.x+1)/2*VW,(1-tmpV.y)/2*VH];}
function overlay(){
  const c=octx;c.clearRect(0,0,VW,VH);c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
  const label=(s,x,h,z,col,font)=>{const p=scr(x,h,z);if(!p)return;c.font=font;c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.85)';c.strokeText(s,p[0],p[1]);c.fillStyle=col;c.fillText(s,p[0],p[1]);};
  const bar=(x,h,z,w,f,col,edge)=>{const p=scr(x,h,z);if(!p)return;const X=Math.round(p[0]-w/2),Y=Math.round(p[1]);
    c.fillStyle='#000';c.fillRect(X-2,Y-2,w+4,9);if(edge){c.fillStyle=edge;c.fillRect(X-1,Y-1,w+2,7);}c.fillStyle='#160b0b';c.fillRect(X,Y,w,5);c.fillStyle=col;c.fillRect(X,Y,Math.ceil(w*clamp(f,0,1)),5);};
  // enemy health, once hurt; elites and bosses by name
  for(const e of G.enemies){const a=ACTORS.get('e'+e.id);if(!a||e.burrowed)continue;const top=2.6*(a.o.s||1)*(e.elite?1.12:1);
    if(e.hurtT>0&&!e.boss&&e.type!=='dummy')bar(a.x,top,a.z,e.elite?74:58,e.hp/e.maxHp,e.elite?'#e8b24a':'#d24b47',e.elite?'#7a6436':null);
    if(e.elite&&!e.boss&&hyp(e.x-P.x,e.y-P.y)<200)label((ETYPES[e.type].name||'')+', elite',a.x,top+.55,a.z,'#e9c87a','600 13px Cinzel,Georgia,serif');}
  // your party: name and health
  if(NET.on)for(const q of NET.others){if(q.x<-900||q.dead)continue;label(q.name||'',wx(q.x),2.9,wz(q.y),'#e9dfc8','600 13px Cinzel,Georgia,serif');bar(wx(q.x),2.55,wz(q.y),46,q.hp/q.maxHp,'#7fc24a');}
  // the people and things you can use, when you are near
  const near=(q,r=110)=>q&&hyp(q.x-P.x,q.y-P.y)<r;
  for(const q of G.traders||[])if(near(q))label(q.name||'Trader',wx(q.x),2.85,wz(q.y),'#e9c87a','600 13px Cinzel,Georgia,serif');
  for(const q of G.stashes||[])if(near(q,80))label('Stash',wx(q.x),1.6,wz(q.y),'#e9c87a','600 13px Cinzel,Georgia,serif');
  if(near(G.home,90))label('Floor gate',wx(G.home.x),2.2,wz(G.home.y),'#f5e2a8','600 13px Cinzel,Georgia,serif');
  if(near(G.gate,120))label('The way up',wx(G.gate.x),2.2,wz(G.gate.y),'#c8f3fa','600 13px Cinzel,Georgia,serif');
  // the numbers
  for(const n of G.nums){const al=n.t>NUM_LIFE-.15?(NUM_LIFE-n.t)/.15:1;c.globalAlpha=clamp(al,0,1);
    const big=n.kind==='crit'?26:n.kind==='hurt'?18:20;label(n.v,wx(n.x),2.4+n.t*2.4,wz(n.y),NUMCOL[n.kind]||'#f3ead6',`700 ${big}px Cinzel,Georgia,serif`);}
  c.globalAlpha=1;
}

/* ---------- the traders in the tower ---------- */
// Traders stand in the start room and the safe rooms: hooded, idle, facing the room.
function npcs(dt){
  (G.traders||[]).forEach((q,i)=>{const id='n'+i;let a=ACTORS.get(id);if(!a){a=makeActor('npc',{m:'Rogue_Hooded',hold:[]});ACTORS.set(id,a);a.face=0;play(a,'Idle');}
    seenIds.add(id);a.root.position.set(wx(q.x),0,wz(q.y));const d=hyp(P.x-q.x,P.y-q.y);
    turn(a,d<90?Math.atan2(wx(P.x-q.x),wz(P.y-q.y)):0,dt,4);upd(a,dt);});
}

me.info=()=>renderer&&Object.assign({},renderer.info.render,{geometries:renderer.info.memory.geometries,actors:ACTORS.size});
function applyStyle(){const g=STYLE.grade||[1,1,0,0,0],u=grade.uniforms;u.con.value=g[0];u.sat.value=g[1];u.cold.value=g[2];u.grain.value=g[3];u.lift.value=g[4]||0;
  for(const k in PROTO)for(const p of PROTO[k].parts)if(p.mat.flatShading!==!!STYLE.flat){p.mat.flatShading=!!STYLE.flat;p.mat.needsUpdate=true;}}
me.style=i=>{if(i!=null){STYLE=STYLES[i];applyStyle();me.g=null;for(const a of ACTORS.values())dropActor(a);ACTORS.clear();FREE.clear();}return STYLE.name;};
me.debug=()=>({floaters:FLOOR&&FLOOR.floatSet?FLOOR.floatSet.list.slice(0,3):null,torches:FLOOR&&FLOOR.torches.length,top:TOP.skull_candle,candle:TOP.candle_thin});
me.zoom=z=>{if(z)zoom=z;return zoom;};
me.use=()=>me.ready&&!Q.off&&!!G&&!G.village&&!!P;
me.draw=function(){
  canvas.hidden=false;over.hidden=false;cv.style.visibility='hidden';
  try{frame3d();}catch(e){console.error('3D drawing failed, drawing in 2D from now on',e);me.failed=true;me.ready=false;me.hide();}
};
me.hide=function(){if(!canvas||canvas.hidden)return;canvas.hidden=true;over.hidden=true;cv.style.visibility='';lastT=0;};
return me;
})();

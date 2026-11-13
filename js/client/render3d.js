'use strict';
// Blackspire: drawing the tower floors in 3D, with three.js (js/vendor/three.js) and KayKit's CC0 models
// (js/vendor/models.js). Nothing here changes the game: the rules still run on the same flat map, in game pixels, and
// this only draws what G and P say, in single player and online alike. The village is still drawn by render.js.
//
// One tile (TILE game pixels) is 2 world units here, KayKit's small floor tile. The game's x is x, the game's y (down
// the screen) is z (toward the camera), and height is y. The camera hangs high in the south, looking north and down.
// Everything is in one closure; outside it there is only R3 (state and settings), use3d() and render3d().
const VILLAGE_W=VW,VILLAGE_H=VH;   // the village's size in tiles (village.js); inside, VW and VH are the screen's
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
let PROTO={},CHARS={},CLIP={},TOP={},FOOT={},FLOOR=null,DYN=null;
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
    for(const k in PROTO){const b=new THREE.Box3();for(const p of PROTO[k].parts){p.geo.computeBoundingBox();b.union(p.geo.boundingBox.clone().applyMatrix4(p.m));}TOP[k]=b.max.y;
      FOOT[k]=Math.hypot(b.max.x-b.min.x,b.max.z-b.min.z);}   // the footprint's diagonal: how wide it can get when turned
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
  canvas.addEventListener('wheel',e=>{if(mode!=='play')return;zoom=clamp(zoom*(e.deltaY>0?1.08:1/1.08),.75,1.8);e.preventDefault();},{passive:false});
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
// The cutaway: what stands in the line of sight just south of you drawn only up to the knee. Nothing is cut any more,
// in the tower or the village: a cut opens a house or a wall and shows its hollow inside. Whoever something hides shows
// through it as a silhouette instead (xray, below). Kept, matching nothing, should a prop ever need it again.
const CUT={value:new THREE.Vector3(0,0,-999)},CUTKEYS=/^$^/,cutMats=new Map();
function cutaway(mat){
  if(cutMats.has(mat))return cutMats.get(mat);const m=mat.clone();
  m.onBeforeCompile=sh=>{sh.uniforms.uCut=CUT;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vCutW;').replace('#include <project_vertex>',
      '#include <project_vertex>\nvec4 cw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\ncw=instanceMatrix*cw;\n#endif\nvCutW=(modelMatrix*cw).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vCutW;uniform vec3 uCut;').replace('#include <clipping_planes_fragment>',
      '#include <clipping_planes_fragment>\nfloat cdz=vCutW.z-uCut.z;if(cdz>.3&&cdz<16.&&vCutW.y>max(1.05,1.43*cdz-1.2)&&abs(vCutW.x-uCut.x)<2.4+cdz*.15)discard;');};
  m.customProgramCacheKey=()=>'cut';cutMats.set(mat,m);return m;
}
// Grit: the tower's walls and pillars worn by age, in the shader, no new models. Grime and stains from noise, damp
// darkening toward the floor, cracks in patches (the edges of a cellular pattern, only where a second noise allows),
// and a few pale chips. All from the surface's world position, so no two stretches of wall look alike.
const GRITKEYS=/^(wall_half|wall_gated|pillar|pillar_decorated)$/,gritMats=new Map();
const GRIT_GLSL=`
float gH(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 gH2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float gN(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gH(i),gH(i+vec2(1,0)),f.x),mix(gH(i+vec2(0,1)),gH(i+vec2(1,1)),f.x),f.y);}
float gF(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*gN(p);p*=2.03;a*=.5;}return v;}
float gCrack(vec2 p){vec2 i=floor(p),f=fract(p);float d1=8.,d2=8.;
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(x,y),r=o+gH2(i+o)-f;float d=dot(r,r);if(d<d1){d2=d1;d1=d;}else if(d<d2)d2=d;}
  return sqrt(d2)-sqrt(d1);}
`;
function grit(mat){
  if(gritMats.has(mat))return gritMats.get(mat);const m=mat.clone();
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGW;varying vec3 vGN;').replace('#include <project_vertex>',
      '#include <project_vertex>\nvec4 gw=vec4(transformed,1.);vec3 gn=objectNormal;\n#ifdef USE_INSTANCING\ngw=instanceMatrix*gw;gn=mat3(instanceMatrix)*gn;\n#endif\nvGW=(modelMatrix*gw).xyz;vGN=normalize(mat3(modelMatrix)*gn);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGW;varying vec3 vGN;'+GRIT_GLSL).replace('#include <color_fragment>',
      `#include <color_fragment>
      {vec3 an=abs(vGN);vec2 uv=an.y>.6?vGW.xz:(an.x>an.z?vGW.zy:vGW.xy);
       float g=mix(.5,1.12,gF(uv*1.4))*mix(.62,1.,smoothstep(.3,.62,gF(uv*.45+3.)));   // grime, and big dark stains
       float low=1.-smoothstep(0.,1.6,vGW.y);g*=1.-low*.45;                 // damp toward the floor
       diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.8,.88,.68),low*.75);
       vec2 cu=uv*1.1+vec2(gF(uv*2.1),gF(uv*2.1+9.))*.8;
       float cd=gCrack(cu),crack=(1.-smoothstep(.0,.07,cd))*smoothstep(.4,.52,gF(uv*.33+17.));   // cracks, in patches
       float lip=(smoothstep(.07,.1,cd)-smoothstep(.1,.14,cd))*smoothstep(.4,.52,gF(uv*.33+17.));   // a pale broken edge beside each
       g*=1.-crack*.88;g+=lip*.1;
       g+=step(.975,gH(floor(uv*11.)))*.16*(1.-crack);                     // pale chips
       diffuseColor.rgb*=g;}`);};
  m.customProgramCacheKey=()=>'grit';gritMats.set(mat,m);return m;
}
function instance(group,placed){
  const tmp=new THREE.Matrix4();
  for(const[key,list]of placed){const P_=PROTO[key];if(!P_){console.warn('no prop',key);continue;}
    const chunks=new Map();for(const m of list){const c=Math.floor(m.elements[12]/CH)+','+Math.floor(m.elements[14]/CH);(chunks.get(c)||chunks.set(c,[]).get(c)).push(m);}
    const flat=key.startsWith('floor_');
    for(const ms of chunks.values())for(const part of P_.parts){
      const im=new THREE.InstancedMesh(part.geo,CUTKEYS.test(key)?cutaway(part.mat):GRITKEYS.test(key)?grit(part.mat):part.mat,ms.length);ms.forEach((M,i)=>im.setMatrixAt(i,tmp.multiplyMatrices(M,part.m)));
      im.castShadow=!flat;im.receiveShadow=true;im.computeBoundingSphere();group.add(im);
      if(STYLE.ink&&!flat&&!G.village&&!/^(wall_|pillar)/.test(key)){   // (no ink outlines in the village: at its buildings' size they break into loose strokes)   // outlines on the props, sized to the prop's own (quantized) units
        const sc=new THREE.Vector3().setFromMatrixScale(part.m),o=new THREE.InstancedMesh(part.geo,inkMat(.04/Math.max(sc.x,sc.y,sc.z)),ms.length);
        o.instanceMatrix=im.instanceMatrix;o.boundingSphere=im.boundingSphere;group.add(o);}}
  }
}
// One model placed on its own, to move or change later (chests, the boss gates, a held weapon).
function single(key){const P_=PROTO[key];const o=P_.node.clone(true);o.position.set(0,0,0);o.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;if(CUTKEYS.test(key))c.material=cutaway(c.material);else if(GRITKEYS.test(key))c.material=grit(c.material);}});return o;}

/* ---------- ink: dark outlines, the model drawn again a little larger and inside out ---------- */
const INK=new Map();
function inkMat(w){if(INK.has(w))return INK.get(w);const m=new THREE.MeshBasicMaterial({color:'#07060a',side:THREE.BackSide,fog:true});
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','vec3 transformed=position+normalize(normal)*'+w.toFixed(4)+';');};
  m.customProgramCacheKey=()=>'ink'+w;INK.set(w,m);return m;}
// Gives every mesh under o an outline. Skinned meshes get one that follows the same skeleton.
function ink(o,w){const add=[];o.traverse(c=>{if(!c.isMesh||c.userData.ink||c.userData.eyes||c.userData.noInk)return;const ig=c.userData.inkGeo||c.geometry,iw=c.userData.inkGeo?.016:w;   // (a figure brings its own rounded copy, and is drawn finer)
    const m=c.isSkinnedMesh?new THREE.SkinnedMesh(ig,inkMat(iw)):new THREE.Mesh(ig,inkMat(iw));
    if(c.isSkinnedMesh)m.bind(c.skeleton,c.bindMatrix);m.userData.ink=true;m.castShadow=false;m.frustumCulled=false;add.push([c,m]);});
  for(const[c,m]of add){if(c.isSkinnedMesh)c.parent.add(m);else{m.position.copy(c.position);m.quaternion.copy(c.quaternion);m.scale.copy(c.scale);c.parent.add(m);}m.visible=c.visible;c.userData.inkMesh=m;}}

/* ---------- xray: who a wall hides shows through it ---------- */
// Each actor gets a twin of its meshes in one flat colour, drawn after the world (renderOrder 1) but before any actor
// (renderOrder 2), and only where the depth already there is nearer: where a wall stands in front. Dithered, so it
// reads as a see-through ghost. Heroes in gold, enemies in red.
const XRAY=new Map();
function xrayMat(col){if(XRAY.has(col))return XRAY.get(col);
  const m=new THREE.MeshBasicMaterial({color:col,depthFunc:THREE.GreaterDepth,depthWrite:false,fog:false});
  m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <clipping_planes_fragment>',
    '#include <clipping_planes_fragment>\nif(mod(floor(gl_FragCoord.x)+floor(gl_FragCoord.y),2.)<1.)discard;');};
  m.customProgramCacheKey=()=>'xray';XRAY.set(col,m);return m;}
function xray(root,col){const add=[];
  root.traverse(c=>{c.renderOrder=2;if(!c.isMesh||c.userData.ink||c.userData.eyes||c.userData.xray)return;
    const m=c.isSkinnedMesh?new THREE.SkinnedMesh(c.geometry,xrayMat(col)):new THREE.Mesh(c.geometry,xrayMat(col));
    if(c.isSkinnedMesh)m.bind(c.skeleton,c.bindMatrix);m.userData.xray=true;m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;m.renderOrder=1;add.push([c,m]);});
  for(const[c,m]of add){if(c.isSkinnedMesh)c.parent.add(m);else{m.position.copy(c.position);m.quaternion.copy(c.quaternion);m.scale.copy(c.scale);c.parent.add(m);}
    m.visible=c.visible;c.userData.xrayMesh=m;}}

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
  if(G.village)return buildVillage();
  mood(false);
  if(FLOOR){scene.remove(FLOOR.group);FLOOR.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
  for(const a of ACTORS.values())dropActor(a);ACTORS.clear();for(const a of DYING)dropActor(a);DYING.length=0;
  const g=G,map=g.map,group=new THREE.Group(),placed=new Map(),torches=[],flames={warm:[],green:[],blue:[]},floaters=[],fungi=[];
  const put=(key,x,y,z,ry,sx,sy,sz)=>{(placed.get(key)||placed.set(key,[]).get(key)).push(M4(x,y,z,ry,sx,sy,sz));};
  const at=(x,y)=>x<0||y<0||x>=MW||y>=MH?0:map[y*MW+x],open=(x,y)=>{const v=at(x,y);return v===1||v===3||v===4;};
  const front=(x,y)=>!open(x,y)&&open(x,y-1);   // a block of rock with floor right behind it
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
    // every face of a block of rock that has floor right behind it (north, farther from the camera) is knee-high, so
    // it never hides that floor: the faces toward the camera, and the side faces of the same block where a corridor
    // bends (they used to stand full height there, a stub of wall in front of the way on)
    const X=x*2,Z=y*2,h=(vx,vy)=>front(vx,vy)?.26:1;
    if(!open(x,y-1))put('wall_half',X,0,Z,0,1,h(x,y-1),1);
    if(!open(x,y+1))put('wall_half',X,0,Z+2,0,1,.26,1);
    if(!open(x-1,y))put('wall_half',X,0,Z,-Math.PI/2,1,h(x-1,y),1);
    if(!open(x+1,y))put('wall_half',X+2,0,Z,-Math.PI/2,1,h(x+1,y),1);
  }
  for(let y=0;y<=MH;y++)for(let x=0;x<=MW;x++){
    const q=[open(x-1,y-1),open(x,y-1),open(x-1,y),open(x,y)],n=q.filter(Boolean).length;
    if(n===0||n===4)continue;
    if(n===2&&((q[0]&&q[1])||(q[2]&&q[3])||(q[0]&&q[2])||(q[1]&&q[3])))continue;   // a straight run of wall
    // a post is as tall as the tallest wall it joins: knee-high when every block of rock around it is a low one
    const low=[[x-1,y-1],[x,y-1],[x-1,y],[x,y]].every(([a,b],i)=>q[i]||front(a,b));
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
      {const fi=r.kind==='safe'?1+g.rooms.filter(q=>q.kind==='safe').indexOf(r):0,fp=(g.fires||[])[fi]||{x:(r.x+r.w/2)*TILE,y:(r.y+r.h/2)*TILE},fx=wx(fp.x),fz=wz(fp.y);camp(group,fx,fz);flames.warm.push(fx,.55,fz);torches.push({x:fx,y:1.3,z:fz,col:'#ff9a48',int:34,dist:16,fire:true});}
      continue;
    }
    // an ordinary room: its floor's lights near the walls, clutter in a corner or two, the dead's leftovers
    for(const[i,j]of[[1,1],[r.w-2,1],[1,r.h-2],[r.w-2,r.h-2],[Math.floor(r.w/2),1]].slice(0,r.w*r.h>50?5:3))if(rr()<.85)themed((r.x+i+.5)*2,(r.y+j+.5)*2,rr);
    for(const q of g.clutter||[]){if(q.room!==ri)continue;const x=q.x*2+1,z=q.y*2+1,k=q.k,pick=a=>a[Math.floor(q.rot/6*a.length)%a.length];   // the rules chose these tiles and made them solid
      const key=k<.3?pick(['barrel_large','barrel_small_stack','keg']):k<.55?pick(['crates_stacked','box_stacked','box_large']):k<.8&&theme>0?pick(['coffin','coffin_decorated']):'rubble_half';
      put(key,x,0,z,key.startsWith('coffin')?(q.c==='n'?0:Math.PI):q.rot,Math.min(1,2.3/(FOOT[key]||2.3)));}   // shrunk to its one solid tile, however it is turned
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
  const FLAMES=FLAME_SETS;
  for(const k in flames)if(flames[k].length)for(const[col,size,op]of FLAMES[k])group.add(points(flames[k],col,size,op));
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
}
// a campfire: logs, a ring of stones (the flame is a glow point and a light)
function camp(group,x,z){
  const wood=new THREE.MeshStandardMaterial({color:'#3b2516',roughness:1}),stone=new THREE.MeshStandardMaterial({color:'#4a4a52',roughness:1});
  for(let i=0;i<5;i++){const a=i/5*TAU,lg=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,1.3,8),wood);lg.rotation.z=Math.PI/2;lg.rotation.y=a;lg.position.set(x+Math.cos(a)*.25,.15,z+Math.sin(a)*.25);lg.castShadow=true;group.add(lg);}
  for(let i=0;i<8;i++){const a=i/8*TAU,st=new THREE.Mesh(new THREE.DodecahedronGeometry(.2,0),stone);st.position.set(x+Math.cos(a)*.85,.1,z+Math.sin(a)*.85);group.add(st);}
  const s=sprite('#ffb050',2.6,.9);s.position.set(x,.7,z);group.add(s);
}

/* ---------- the root village ---------- */
// The tower is night and torchlight; the village, at the foot of the great tree, is a long golden evening.
function mood(village){
  if(village){const[bg,fog,sky,gnd,hi,sun,si]={   // by the village's hour: an overcast day, the long golden evening, night
      day:['#7d8794','#7d8794','#dfe6f0','#5a5444',2.1,'#fff1dc',3.1],evening:['#2a2e3a','#2a2e3a','#c8d0e8','#3a3020',1.3,'#ffd2a0',2.1],night:['#0c1018','#0c1018','#6f86b8','#141210',.7,'#9fb4e0',1]}[VILLAGE_HOUR]||[];
    scene.background.set(bg);scene.fog.color.set(fog);scene.fog.density=.0065;hemi.color.set(sky);hemi.groundColor.set(gnd);hemi.intensity=hi;moon.color.set(sun);moon.intensity=si;}
  else{scene.background.set('#030304');scene.fog.color.set('#05060a');scene.fog.density=.016;hemi.color.set('#4a5a80');hemi.groundColor.set('#0b0806');hemi.intensity=.42;
    moon.color.set('#8aa0d8');moon.intensity=.42;}
  MOOD.village=village;
}
const MOOD={village:false};
const VT=(x,y)=>[(VOX+x)*2,(VOY+y)*2];   // village tiles (village.js) to world units
function buildVillage(){
  mood(true);
  if(FLOOR){scene.remove(FLOOR.group);FLOOR.group.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}
  for(const a of ACTORS.values())dropActor(a);ACTORS.clear();for(const a of DYING)dropActor(a);DYING.length=0;
  const g=G,group=new THREE.Group(),placed=new Map(),torches=[],flames={warm:[],green:[],blue:[]},rnd=mulberry32(4242);
  const put=(key,tx,ty,ry=0,s=1)=>{const[x,z]=VT(tx,ty);(placed.get(key)||placed.set(key,[]).get(key)).push(M4(x,0,z,ry,s,s,s));};
  // the ground: one painted plane over the village, and dark grass beyond it
  group.add(villageGround());
  {const far=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshStandardMaterial({color:'#24321e',roughness:1}));far.rotation.x=-Math.PI/2;far.position.set(VT(VILLAGE_W/2,VILLAGE_H/2)[0],-.03,VT(VILLAGE_W/2,VILLAGE_H/2)[1]);far.receiveShadow=true;group.add(far);}
  // the town's edge: wooded hills all the way round, a little outside its wall
  const hill=['mountain_A_grass_trees','mountain_B_grass_trees','mountain_C_grass_trees','hills_A_trees','hills_B_trees'];
  for(let x=-2;x<=VILLAGE_W+2;x+=5)for(const y of[-3,VILLAGE_H+3]){if(y<0&&x>27&&x<53)continue;put(hill[Math.floor(rnd()*5)],x+rnd()*2,y+rnd()*1.5,rnd()*6,5.5+rnd()*2);}
  for(let y=2;y<=VILLAGE_H;y+=5)for(const x of[-3,VILLAGE_W+3])put(hill[Math.floor(rnd()*5)],x+rnd()*1.5,y+rnd()*2,rnd()*6,5.5+rnd()*2);
  for(const[x,y,k,sc]of[[-6,56,'building_windmill_yellow',7],[-5,10,'building_home_A_red',6],[85,14,'building_home_B_blue',6],[84,40,'building_home_A_yellow',6]])put(k,x,y,rnd()*.6-.3,sc);
  // the great tree's trunk, rising behind the town
  group.add(trunk(...VT(40,-1)));
  const T=townBuilder(),lamp=(x,y,h,col,int,dist,fire)=>{const[X,Z]=VT(x,y);flames.warm.push(X,h,Z);torches.push({x:X,y:h+.3,z:Z,col,int,dist,fire});};
  // the town wall: tall behind and at the sides, knee-high along the south so it hides nothing; towers at the far corners
  {const[x0,z0]=VT(2.5,2.5),[x1,z1]=VT(VILLAGE_W-2.5,VILLAGE_H-2.5),[ta,]=VT(30.5,0),[tb,]=VT(49.5,0),st='#6f6b62|s',st2='#5e5a52|s';
    const run=(xa,za,xb,zb,h)=>{const len=Math.hypot(xb-xa,zb-za),ry=Math.atan2(-(zb-za),xb-xa),n=Math.floor(len/1.5);T.box((xa+xb)/2,h/2,(za+zb)/2,len,h,1.3,st,0,ry);T.box((xa+xb)/2,h*.12,(za+zb)/2,len+.2,h*.24,1.6,st2,0,ry);
      if(h>2)for(let i=0;i<n;i+=2){const u=(i+.5)/n;T.box(xa+(xb-xa)*u,h+.3,za+(zb-za)*u,.8,.6,1.3,st,0,ry);}};
    run(x0,z0,ta,z0,5);run(tb,z0,x1,z0,5);run(x0,z0,x0,z1,5);run(x1,z0,x1,z1,5);
    const[ga,]=VT(38,0),[gb,]=VT(42,0);run(x0,z1,ga,z1,1.3);run(gb,z1,x1,z1,1.3);
    for(const gx of[ga,gb]){T.box(gx,1.6,z1,1.6,3.2,1.6,st);T.box(gx,3.35,z1,1.9,.3,1.9,st2);flames.warm.push(gx,3.9,z1);torches.push({x:gx,y:4.2,z:z1,col:'#ffc070',int:14,dist:12});}
    for(const tx of[x0,x1]){T.box(tx,4.2,z0,4.2,8.4,4.2,st);T.box(tx,8.5,z0,4.8,.5,4.8,st2);for(let i=0;i<8;i++){const a=i/8*TAU;T.box(tx+Math.cos(a)*2.1,9.05,z0+Math.sin(a)*2.1,.9,.7,.9,st);}
      T.prism(tx,8.75,z0,3.6,2.8,3.6,'#39444c|r');T.box(tx,3,z0+2.12,.5,1,.06,'#15100c');}}
  // the houses, row on row
  for(const h of g.houses||[])T.house(h);
  // the landmarks, built the way the houses are (townBuilder): the inn, the guild hall, the well, the market's stalls,
  // the smithy, the arcanist's study. Each blocks exactly its tiles (village.js).
  const WOOD='#4a3422',DARKW='#2e2118',ST='#6f6b62|s',ST2='#5e5a52|s',GOLD='#c8962e';
  // the inn: two wings round a courtyard. The main wing is three storeys, the tallest house in town; the short wing
  // turns its gable to the street; a porch runs along the courtyard side, a stable leans on the lane side.
  {const M=INN.main,Wg=INN.wing,Y=INN.yard,Sb=INN.stable,pl='#b9a47c|p',rf='#6b2f26';
    const I=T.house({x:M.x,y:M.y,w:M.w,h:M.h,floors:3,seed:4242,plaster:pl,roof:rf,wide:true,stone:1,doorAt:6}),f=I.front;
    T.house({x:Wg.x,y:Wg.y-1,w:Wg.w,h:Wg.h+1,floors:2,seed:4243,plaster:pl,roof:rf,stone:1,doorAt:-1,gable:true});
    const[px0,pz]=VT(Y.x,Y.y),[px1]=VT(Y.x+Y.w,Y.y),pw=px1-px0;   // the porch: posts, a tiled lean-to, lanterns that are always lit
    for(let i=0;i<=3;i++){const x=px0+.3+i*(pw-.6)/3;T.box(x,1.5,pz+1.7,.22,3,.22,WOOD);T.lit(x,2.5,pz+1.9,.2,.28,.2,'#e8a850');}
    T.box(px0+pw/2,3.1,pz+1.7,pw,.2,.2,DARKW);T.box(px0+pw/2,3.5,pz+.85,pw+.3,.16,2.2,rf+'|r',.38);
    T.box(px1-.6,4.8,pz+1.2,.12,.12,1.8,DARKW);T.box(px1-.6,4.1,pz+1.9,.08,1.1,1.1,WOOD);T.box(px1-.6,4.1,pz+1.9,.1,.5,.45,GOLD);   // its sign
    {const[sx,sz]=VT(Sb.x+Sb.w/2,Sb.y+Sb.h/2),sw=Sb.w*2,sd=Sb.h*2;for(const dz of[-sd/2+.3,sd/2-.3])T.box(sx-sw/2+.3,1.3,sz+dz,.22,2.6,.22,WOOD);   // the stable: a lean-to, a trough, hay
      T.box(sx,2.9,sz,sw+.4,.16,sd+.3,'#54402a|r',0,0,-.3);T.box(sx+.2,.4,sz-1.6,1.6,.8,.9,'#5a4028');T.box(sx+.2,.76,sz-1.6,1.4,.08,.7,'#1c2a3a');
      for(const[dx,dz]of[[0,1.2],[.5,.4]])T.box(sx+dx,.45,sz+dz,1.3,.9,1,'#b89a4a',0,dx);}
    const[lx,lz]=VT(INN.door.x,INN.door.y);torches.push({x:lx,y:2.6,z:lz,col:'#ffc070',int:16,dist:11});}
  // the guild hall, at the head of the avenue before the tree: three tiers stepping up, each with its own skirt of
  // orange tiles, a tower rising from the top with the guild's banner down its face, great doors between braziers
  {const[X,Zb]=VT(GUILD.x+GUILD.w/2,GUILD.y),W=GUILD.w*2-.6,D=GUILD.h*2-1,zc=Zb+.3+D/2,RF='#b5532a|r',RD='#7a3418|r',PL='#b3a688|p',BL='#2b3350';
    const skirt=(y,w,d,z,o=1.2,drop=.8)=>{const L=Math.hypot(o,drop),th=Math.atan2(drop,o);   // a pent roof all the way round a tier
      for(const sd of[-1,1]){T.box(X,y-drop/2,z+sd*(d/2+o/2),w+o*2,.18,L,RF,sd*th);T.box(X+sd*(w/2+o/2),y-drop/2,z,L,.18,d+o*2,RF,0,0,-sd*th);}
      T.box(X,y+.06,z,w+.3,.2,d+.3,RD);};
    const h1=4.4,w2=W-5,d2=D-4,h2=3.4,w3=w2-5,d3=d2-2.6,h3=2.8,z2=zc-.4,f1=zc+D/2;
    T.box(X,.3,zc,W+.4,.6,D+.4,ST2);T.box(X,h1/2+.4,zc,W,h1,D,ST);skirt(h1+.4,W,D,zc);
    for(const sx of[-W/2+.2,-W/4,W/4,W/2-.2])T.box(X+sx,h1/2+.4,f1+.06,.5,h1,.3,ST2);   // buttresses on the front
    const y2=h1+.4;T.box(X,y2+h2/2,z2,w2,h2,d2,PL);skirt(y2+h2,w2,d2,z2,1,.7);
    for(let i=0;i<=6;i++)T.box(X-w2/2+.1+i*(w2-.2)/6,y2+h2/2,z2+d2/2+.03,.18,h2,.1,DARKW);T.box(X,y2+.1,z2+d2/2+.03,w2,.2,.1,DARKW);
    for(const i of[0,1,4,5])T.box(X-w2/2+.1+(i+.5)*(w2-.2)/6,y2+h2*.55,z2+d2/2+.05,.9,1.2,.08,'#1d242c');
    const y3=y2+h2;T.box(X,y3+h3/2,z2,w3,h3,d3,PL);for(const sx of[-w3/2+.1,w3/2-.1])T.box(X+sx,y3+h3/2,z2+d3/2+.03,.18,h3,.1,DARKW);
    {const half=d3/2+.6,rise=2.2,L=Math.hypot(half,rise),th=Math.atan2(rise,half),top=y3+h3;T.prism(X,top,z2,w3,rise,d3,PL);
      for(const sd of[-1,1])T.box(X,top+rise/2+.06,z2+sd*half/2,w3+.9,.2,L+.1,RF,sd*th);T.box(X,top+rise+.1,z2,w3+1,.22,.3,RD);}
    const yt=y3+h3,tw=3,ht=5.2;T.box(X,yt+ht/2,z2,tw,ht,tw,ST);T.box(X,yt+ht+.15,z2,tw+.5,.3,tw+.5,ST2);   // the tower and its pointed cap
    {const o=tw/2+.35,rise=3.4,L=Math.hypot(o,rise),th=Math.atan2(rise,o),top=yt+ht+.3;for(const sd of[-1,1]){T.box(X,top+rise/2,z2+sd*o/2,tw+.7,.16,L,RF,sd*th);T.box(X+sd*o/2,top+rise/2,z2,L,.16,tw+.7,RF,0,0,-sd*th);}
      T.box(X,top+rise+.8,z2,.12,1.8,.12,DARKW);T.box(X+.75,top+rise+1.3,z2,1.4,.8,.05,BL);}
    T.box(X,yt+ht-2.4,z2+tw/2+.06,1.5,4.2,.06,BL);T.box(X,yt+ht-1.6,z2+tw/2+.1,.8,.8,.05,GOLD,0,0,.785);T.box(X,yt+ht-2.9,z2+tw/2+.1,.16,1.3,.05,GOLD);T.box(X,yt+ht-.25,z2+tw/2+.1,1.8,.14,.14,DARKW);
    T.box(X,1.9,f1+.08,3.2,3,.16,'#3b2616');T.box(X,1.9,f1+.12,.1,3,.1,DARKW);T.box(X,3.5,f1+.1,3.8,.3,.24,DARKW);   // the doors, the emblem over them, the steps, the braziers
    T.box(X,4.15,f1+.1,1.1,1.1,.1,GOLD,0,0,.785);T.box(X,4.15,f1+.16,.2,1.5,.06,BL);
    T.box(X,.16,f1+1.3,6,.32,2,ST2);T.box(X,.36,f1+.8,5,.36,1.1,ST);
    for(const sx of[-2.6,2.6]){T.box(X+sx,.8,f1+.9,.5,1.6,.5,ST2);T.box(X+sx,1.7,f1+.9,.8,.2,.8,'#2a2a30');T.lit(X+sx,1.95,f1+.9,.5,.3,.5,'#ff8a2a');flames.warm.push(X+sx,2.3,f1+.9);torches.push({x:X+sx,y:2.6,z:f1+.9,col:'#ff9a48',int:22,dist:12,fire:true});}
    for(const sx of[-W/2+.4,W/2-.4]){T.box(X+sx,h1+2,f1-.2,.1,3,.1,DARKW);T.box(X+sx+.6,h1+3,f1-.2,1.1,.7,.05,BL);}}
  {const[X,Z]=VT(36,24.5);for(let i=0;i<10;i++){const a=i/10*TAU;T.box(X+Math.cos(a)*.95,.5,Z+Math.sin(a)*.95,.62,1,.4,i%2?ST:ST2,0,-a+Math.PI/2);}   // the well: a stone ring under a little roof
    T.box(X,.55,Z,1.5,.1,1.5,'#1c2a3a');for(const sx of[-1.15,1.15])T.box(X+sx,1.5,Z,.18,3,.18,WOOD);T.box(X,2.5,Z,2.5,.14,.14,DARKW);T.box(X,1.9,Z,.06,1.1,.06,'#8a8474');T.box(X,1.3,Z,.4,.4,.4,WOOD);
    for(const sd of[-1,1])T.box(X,3.3,Z+sd*.55,3,.12,1.5,'#54402a|r',sd*.6);}
  for(const[x,y]of[[36,26],[43,26],[36,33],[43,33]])put('pillar_decorated',x+.5,y+.5,0,.75);
  group.add(noticeBoard(...VT(45,34.6)));
  // the market: each stall a timber frame with a striped awning in its colour over the back, its trader in front of
  // that, the counter and its goods in front of the trader
  for(const st of STALLS){const[X,Zb]=VT(st.x+2.5,st.y),cream='#cfc4a4',n=9,wA=9.4/n;
    for(const sx of[-4.4,4.4]){T.box(X+sx,1.35,Zb+.3,.26,2.7,.26,WOOD);T.box(X+sx,1.75,Zb+2.5,.26,3.5,.26,WOOD);T.box(X+sx,3.05,Zb+1.4,.16,.16,2.5,DARKW,-.33);}
    T.box(X,1.2,Zb+.22,8.8,2.4,.14,'#5a4028');for(const sy of[1.1,1.9])T.box(X,sy,Zb+.5,8.2,.1,.5,'#6b4e30');
    for(let i=0;i<n;i++)T.box(X-4.7+wA*(i+.5),3.12,Zb+1.4,wA+.02,.1,2.7,i%2?cream:st.awning,-.33);
    T.box(X,3.56,Zb+2.66,9.5,.34,.08,st.awning);
    const Zc=Zb+4;T.box(X,.55,Zc,8.6,1.1,.8,'#5a4028');T.box(X,1.14,Zc,9,.1,1,'#7a5a38');T.lit(X+4.4,3,Zb+2.72,.2,.28,.2,'#e8a850');
    const g=(dx,c,sx=.5,sy=.3,sz=.5,ry=0)=>T.box(X+dx,1.19+sy/2,Zc+((dx*7)%1)*.2,sx,sy,sz,c,0,ry);
    if(st.kind==='weapons'){for(let i=0;i<4;i++){g(-3.2+i*1.1,'#9aa0aa',.14,.06,1,.3-i*.2);g(-3.2+i*1.1,'#4a3422',.2,.08,.26,.3-i*.2);}g(2,'#7a8088',.9,.1,.9,.5);g(3.2,'#5a4028',.2,.1,1,.2);for(let i=0;i<3;i++)T.box(X-3+i*3,1.9,Zb+.4,.12,1.5,.1,'#9aa0aa',0,0,.15*(i-1));}
    else if(st.kind==='gear'){for(const[dx,c]of[[-3.2,'#6b4a2c'],[-2.2,'#2b3350'],[-1.1,'#8a8474'],[.2,'#5a2630'],[1.4,'#3c2c52']])g(dx,c,.8,.24,.7);g(2.8,'#8a8f98',.6,.5,.6);g(3.6,'#4a3422',.5,.4,.7,.3);for(let i=0;i<3;i++)T.box(X-2.6+i*2.6,1.9,Zb+.4,1.2,1.2,.1,['#6b4a2c','#8a8474','#2f4a3a'][i]);}
    else if(st.kind==='potions'){for(let i=0;i<9;i++){const dx=-3.6+i*.9;g(dx,'#3a3a44',.22,.1,.22);T.lit(X+dx,1.5,Zc+((dx*7)%1)*.2,.2,.34,.2,['#b03030','#3050b0','#3a9a50'][i%3]);}for(let i=0;i<6;i++)T.lit(X-3+i*1.2,2.08,Zb+.5,.18,.3,.18,['#3a9a50','#b03030','#7a3aa0'][i%3]);}
    else{for(const[dx,c,sx]of[[-3.4,'#b8894a',.8],[-2.4,'#a03a2a',.5],[-1.7,'#a03a2a',.5],[-.6,'#c8a040',.9],[.6,'#5a8a3a',.7],[1.8,'#8a5a30',.8],[3,'#d8c8a0',.6]])g(dx,c,sx,.3,.5);for(let i=0;i<4;i++)T.box(X-3.3+i*2.2,2.15,Zb+.5,.5,.4,.4,['#b8894a','#8a5a30','#c8a040','#a03a2a'][i]);}}
  // the smithy: a stone forge and its chimney under one end of a lean-to, the anvil under the other
  {const[X,Zb]=VT(FORGE.x+2,FORGE.y),fx=X+2.1;
    T.box(fx,1.1,Zb+1.9,3.4,2.2,3,ST);T.box(fx,2.45,Zb+1.9,2.8,.5,2.4,ST2);T.box(fx+.6,4,Zb+1.1,1.4,3.6,1.4,ST);T.box(fx+.6,5.9,Zb+1.1,1.7,.24,1.7,ST2);
    T.box(fx,1.05,Zb+3.42,1.9,1.2,.1,'#15100c');T.lit(fx,.8,Zb+3.46,1.5,.5,.08,'#ff7a2a');T.lit(fx,.62,Zb+3.5,.9,.2,.1,'#ffd27a');
    for(const sx of[-3.7,.2])T.box(X+sx,1.6,Zb+3.5,.26,3.2,.26,WOOD);T.box(X-1.8,3.7,Zb+1.9,4.6,.16,4,'#4a3d36|r',-.22);T.box(X-1.75,3.25,Zb+3.75,4.4,.2,.2,DARKW);
    T.box(X-3.7,1.4,Zb+.3,.26,2.8,.26,WOOD);T.box(X-1.8,1.3,Zb+.2,4,2.6,.14,'#5a4028');
    T.box(X-1.6,.35,Zb+2.9,.7,.7,.7,'#4a3422');T.box(X-1.6,.82,Zb+2.9,1.3,.26,.5,'#2a2a30');T.box(X-1,.86,Zb+2.9,.5,.16,.3,'#2a2a30');   // the anvil on its block
    T.box(X-3,.4,Zb+2.6,.9,.8,1.6,'#5a4028');T.box(X-3,.78,Zb+2.6,.7,.06,1.4,'#1c2a3a');   // the quench trough
    for(let i=0;i<4;i++)T.box(X-3+i*.7,1.9,Zb+.34,.1,1.3,.08,i%2?'#9aa0aa':'#4a3422',0,0,(i-1.5)*.08);
    lamp(FORGE.x+4.1,FORGE.y+1.9,1,'#ff8a3a',26,12,true);}
  // the arcanist's study: a narrow stone house under a steep indigo roof, a lit rune over its door and in its round
  // window, a crystal on its spire, books on a shelf outside, and the cauldron before it
  {const[X,Zb]=VT(WITCH.x+2.5,WITCH.y),zc=Zb+1.9,f=zc+1.7,ind='#3a3560|r',vio='#a070ff',cy='#60d0e0';
    T.box(X,1.5,zc,5.4,3,3.4,ST);T.box(X,3.05,zc,5.6,.2,3.6,DARKW);T.box(X,4.2,zc+.15,5.2,2.2,3.5,'#6a6078|p');T.box(X,5.35,zc+.15,5.4,.2,3.7,DARKW);
    for(const sx of[-2.6,-.9,.9,2.6])T.box(X+sx,4.2,f+.2,.16,2.2,.1,DARKW);
    const half=2.3,rise=4.2,L=Math.hypot(half,rise),th=Math.atan2(rise,half),top=5.45,zr=zc+.15;T.prism(X,top,zr,5.2,rise,3.5,'#6a6078|p');
    for(const sd of[-1,1]){T.box(X,top+rise/2+.06,zr+sd*half/2,5.36,.2,L+.1,ind,sd*th);for(const e of[-1,1])T.box(X+e*2.72,top+rise/2+.02,zr+sd*half/2,.1,.26,L+.16,'#1c1a30',sd*th);}
    T.box(X,top+rise+.9,zr,.14,1.8,.14,DARKW);T.lit(X,top+rise+2,zr,.42,.6,.42,vio,.6,.8,.6);
    T.box(X,1.05,f+.05,1.2,2.1,.12,'#231a14');T.box(X,2.2,f+.05,1.5,.16,.16,DARKW);T.lit(X,2.62,f+.06,.44,.44,.06,vio,0,0,.785);
    T.lit(X,4.3,f+.22,1,1,.06,vio,0,0,.785);T.box(X,4.3,f+.24,.08,1.5,.06,DARKW);T.box(X,4.3,f+.24,1.5,.08,.06,DARKW);
    T.box(X+1.85,1,f+.24,1.4,2,.4,WOOD);for(let j=0;j<3;j++)for(let i=0;i<5;i++)T.box(X+1.33+i*.26,.42+j*.62,f+.3,.2,.44+((i*j)%3)*.04,.3,['#5a2630','#2b3350','#2f4a3a','#6b4a2c','#3c2c52'][(i+j*2)%5]);
    T.box(X-1.9,2.5,f+.08,.9,2.2,.05,'#3c2c52');T.box(X-1.9,2.9,f+.11,.4,.4,.04,GOLD,0,0,.785);T.box(X-1.9,3.66,f+.1,1.1,.1,.1,DARKW);
    for(const[dx,h,c,rz]of[[-2.5,.9,vio,.2],[-2.2,.6,cy,-.3],[-2.75,.5,cy,.4]])T.lit(X+dx,h/2,f+.35,.22,h,.22,c,0,.6,rz);
    put('pot_large',WITCH.x+2.5,WITCH.y+2.5,0,.75);const[x,z]=VT(WITCH.x+2.5,WITCH.y+2.5);flames.green.push(x,.8,z,x+.3,.75,z+.2,x-.3,.7,z-.1);torches.push({x,y:1.4,z,col:'#7cf07a',int:14,dist:9});
    torches.push({x:X,y:3,z:f+1,col:vio,int:10,dist:8});}
  {const[X,Z]=VT(EXCHANGE.x+2.5,EXCHANGE.y+.5);put('table_medium_long',EXCHANGE.x+2.5,EXCHANGE.y+.5,0,1.3);   // the exchange: a desk under a board of the day's prices
    for(const sx of[-4.2,4.2])T.box(X+sx,1.8,Z-.8,.24,3.6,.24,'#4a3422');T.box(X,2.6,Z-.8,8.4,1.7,.14,'#2a2622');T.box(X,3.55,Z-.8,9,.22,.3,'#4a3422');
    for(let i=0;i<5;i++)T.box(X-3+i*1.5,2.6+(i%2?.2:-.15),Z-.71,.9,.12,.04,'#c9c2a8');}
  // the kingdoms' camps: a palisade with a gate, a command tent in each kingdom's colour with its banner, a fire in the middle
  {const[cx,cy,cw,ch]=VILLAGE.camp,[g0,g1]=VILLAGE.campGate,wood=['#5a4028','#4e3722','#664a2e'];
    const stake=(x,y)=>{const[X,Z]=VT(x,y),hh=2.3+rnd()*.7;T.box(X,hh/2,Z,.36,hh,.36,wood[Math.floor(rnd()*3)],0,rnd());T.box(X,hh+.12,Z,.2,.3,.2,'#3a2a1a');};
    for(let x=cx;x<cx+cw;x+=.24)if(x<g0||x>g1)stake(x,cy+.5);for(let y=cy+.6;y<cy+ch;y+=.24)stake(cx+cw-.5,y);
    for(const gx of[g0,g1]){const[X,Z]=VT(gx,cy+.5);T.box(X,2,Z,.5,4,.5,'#4a3422');}
    {const[X,Z]=VT((g0+g1)/2,cy+.5);T.box(X,3.9,Z,(g1-g0)*2+.8,.36,.4,'#4a3422');KINGDOMS.forEach((k,i)=>T.box(X-1.6+i*1.6,3.1,Z,.9,1.3,.06,k.color));}}
  for(const k of KINGDOMS){const[X,Z]=VT(k.x,k.y-1),dark=new THREE.Color(k.color).multiplyScalar(.55).getStyle();
    T.prism(X,0,Z,3.6,3.3,5.6,k.color,Math.PI/2);T.box(X,3.3,Z,.16,.16,4,dark);T.box(X,.95,Z+1.82,1.3,1.9,.08,'#1c1612');   // the tent, its ridge, its open door
    for(const sx of[-1.9,1.9])T.box(X+sx,.9,Z+1.84,.5,1.8,.06,dark,0,0,sx>0?.5:-.5);
    for(const sx of[-2.9,2.9])for(const sz of[-1.2,1.2])T.box(X+sx,.25,Z+sz,.14,.5,.14,'#4a3422');
    const[fx,fz]=VT(k.x+2.4,k.y-.1);T.box(fx,2.6,fz,.16,5.2,.16,'#4a3422');T.box(fx+.75,4.3,fz,1.4,1.5,.06,k.color);T.box(fx+.75,4.3,fz+.04,.5,.5,.04,dark);}
  // the training yard: its ground is marked; the scarecrows are drawn as enemies (targets)
  // the fields: a fence along the lane with a gate, the barn, the windmill, a signpost
  {const[fx,fy,fw]=VILLAGE.fields,[g0,g1]=VILLAGE.fieldGate;
    for(let x=fx;x<=fx+fw-3;x+=1){if(x>=g0&&x<=g1&&x!==g0&&x!==g1)continue;const[X,Z]=VT(x,fy+.5);T.box(X,.7,Z,.22,1.4,.22,'#5a4028');
      if(!(x>=g0&&x<g1)){T.box(X+1,1.05,Z,2,.14,.1,'#6b4e30');T.box(X+1,.55,Z,2,.14,.1,'#6b4e30');}}
    for(const[px,py]of VILLAGE.plots){const[X,Z]=VT(px+1.5,py+1);for(const[sx,sz,w,d]of[[0,-2,6,.2],[0,2,6,.2],[-3,0,.2,4.2],[3,0,.2,4.2]])T.box(X+sx,.12,Z+sz,w,.24,d,'#5a4028');}
    T.house({x:66,y:49,w:4,h:3,floors:1,seed:77,barn:true});
    {const[X,Z]=VT(72.5,54.5),hub=7.2,zf=Z+1.9;   // the windmill: a stone tower narrowing as it rises, a timber cap, four sails
      [4.8,4.4,4,3.6].forEach((w,i)=>T.box(X,1+i*2,Z,w,2,w,i%2?'#77736a|s':'#6f6b62|s'));T.prism(X,8,Z,3.9,2,3.9,'#54402a|r',Math.PI/2);T.box(X,8.05,Z,4,.14,4,'#2e2118');
      T.box(X,1,Z+2.42,1,2,.1,'#231a14');T.box(X,4.6,Z+2.12,.7,.9,.08,'#1d242c');T.box(X,hub,zf+.2,.5,.5,.9,'#2e2118');
      for(let k=0;k<4;k++){const a=.35+k*Math.PI/2,c=Math.cos(a),sn=Math.sin(a);T.box(X+c*2.6,hub+sn*2.6,zf+.6,5,.14,.1,'#4a3422',0,0,a);T.box(X+c*3-sn*.45,hub+sn*3+c*.45,zf+.62,3.6,.8,.04,'#b9a888',0,0,a);}}
    group.add(signpost(...VT(...VILLAGE.fieldSign)));}
  // what stands about: the camps' fire and gear, the fields' barrows and crates, tables by the inn
  for(const[k,x,y,sc,ry]of VILLAGE.decor){
    if(k==='campfire'){const[X,Z]=VT(x,y);for(let i=0;i<8;i++){const a=i/8*TAU;T.box(X+Math.cos(a)*.75,.14,Z+Math.sin(a)*.75,.4,.28,.34,'#6f6c64',0,a);}
      for(let i=0;i<3;i++)T.box(X,.3,Z,1.2,.2,.22,'#3a2616',.25,i*1.05);lamp(x,y,.7,'#ff8a3a',30,14,true);flames.warm.push(X+.2,.9,Z+.1,X-.2,1.1,Z-.1);}
    else put(k,x,y,ry||0,sc);}
  // trees and street lamps
  for(const[x,y,v]of VILLAGE.trees)put(v==='a'?'tree_single_A':'tree_single_B',x,y-.4,rnd()*6,4.2+rnd()*.8);
  for(const[x,y]of VILLAGE.lamps){put('post_lantern',x,y,rnd()*6,1.1);const[X,Z]=VT(x,y);flames.warm.push(X,3.1,Z);torches.push({x:X,y:3.4,z:Z,col:'#ffc070',int:14,dist:12});}
  for(const[k,x,y,sc,ry]of g.extras||[])put(k,x,y-(k.startsWith('tree')?.4:0),ry,sc);
  const tm=T.meshes();group.add(...tm);
  // grass and stones on the open ground
  group.add(...villageTufts());
  instance(group,placed);
  for(const k in flames)if(flames[k].length)for(const[col,size,op]of FLAME_SETS[k])group.add(points(flames[k],col,size,op));
  // all of that is the town; each inside is its own group, shown only while you stand in it (indoors(), each frame)
  const town=new THREE.Group();for(const c of[...group.children])town.add(c);group.add(town);
  const stashes=[],areas=(g.inside||[]).map(R=>{const ig=interior(R,g,torches,stashes);ig.visible=false;group.add(ig);return{k:R.k,group:ig};});
  scene.add(group);
  FLOOR={g,group,town,areas,areaK:null,torches,gates:[],chests:[],stashes,floatSet:null,born:performance.now(),village:true};me.g=g;
}
// One inside (G.inside, village.js): a floor, three full walls and a low one toward the camera, and its furniture
// (G.furn) from the same boxes the town is built of. Lit by its hearth and candles; its windows show the day.
function interior(R,g,torches,stashes){
  const ig=new THREE.Group(),B=townBuilder(),placed=new Map(),fl=[],[X0,Z0]=VT(R.x,R.y),W=R.w*2,D=R.h*2,cx=X0+W/2,cz=Z0+D/2,H=4.4;
  const WOOD='#4a3422',DARKW='#2e2118',ST='#6f6b62|s',ST2='#5e5a52|s',GOLD='#c8962e',BL='#2b3350',PL=R.k==='hall'?'#a39478|p':'#b9a47c|p',hall=R.k==='hall';
  const put=(key,tx,ty,ry=0,sc=1)=>{const[x,z]=VT(tx,ty);(placed.get(key)||placed.set(key,[]).get(key)).push(M4(x,0,z,ry,sc,sc,sc));};
  const fire=(x,y,z,int=30,dist=13)=>{fl.push(x,y,z,x+.2,y+.25,z+.1,x-.2,y+.15,z-.1);torches.push({x,y:y+.6,z,col:'#ff9a48',int,dist,fire:true});};
  const candle=(x,y,z)=>{B.box(x,y+.12,z,.08,.24,.08,'#d8d0b8');B.lit(x,y+.3,z,.07,.12,.07,'#ffd27a');torches.push({x,y:y+.6,z,col:'#ffc070',int:7,dist:7});};
  // the floor (flagstones in the hall, boards elsewhere), the walls, the windows in the back wall
  B.box(cx,-.15,cz,W+1.2,.3,D+1.2,hall?'#625e56|s':'#5a4028');if(!hall)for(let x=X0+1;x<X0+W;x+=1)B.box(x,.005,cz,.04,.02,D,'#2e2118');
  B.box(cx,H/2,Z0-.3,W+1.2,H,.6,PL);B.box(cx,.6,Z0+.02,W,1.2,.1,WOOD);B.box(cx,H-.1,Z0+.02,W,.24,.14,DARKW);
  for(const sd of[-1,1]){B.box(cx+sd*(W/2+.3),H/2,cz,.6,H,D+1.2,PL);B.box(cx+sd*(W/2-.02),.6,cz,.1,1.2,D,WOOD);}
  for(let x=X0;x<=X0+W+.01;x+=4)B.box(x,H/2,Z0+.06,.26,H,.16,DARKW);
  for(const sd of[-1,1]){const len=W/2-1.4;B.box(cx+sd*(1.4+len/2),.5,Z0+D+.3,len+.6,1,.6,hall?ST:WOOD);B.box(cx+sd*1.3,1.3,Z0+D+.3,.3,2.6,.5,DARKW);}   // the wall toward you is low; the door is the gap in it
  B.box(cx,.02,Z0+D-.5,2,.04,1,'#5a2630');
  for(let i=0;i<Math.floor(R.w/4);i++){const x=X0+W*(i+.5)/Math.floor(R.w/4)+(hall&&Math.abs(X0+W*(i+.5)/Math.floor(R.w/4)-cx)<1?2.4:0);B.lit(x,2.9,Z0+.03,1.1,1.4,.06,'#a8bcc8');B.box(x,2.9,Z0+.06,.08,1.4,.06,DARKW);B.box(x,2.9,Z0+.06,1.1,.08,.06,DARKW);B.box(x,2.14,Z0+.1,1.4,.1,.2,DARKW);}
  if(hall){for(const sx of[-4.6,4.6]){B.box(cx+sx,2.9,Z0+.06,1.2,2.4,.05,BL);B.box(cx+sx,3.2,Z0+.1,.6,.6,.04,GOLD,0,0,.785);}B.box(cx,3.3,Z0+.08,1.5,1.5,.08,GOLD,0,0,.785);B.box(cx,3.3,Z0+.14,.26,2,.05,BL);}
  for(const f of g.furn||[]){if(f.x<R.x||f.x>=R.x+R.w||f.y<R.y||f.y>=R.y+R.h)continue;const[x,z]=VT(f.x+f.w/2,f.y+f.h/2),w=f.w*2,d=f.h*2;
    if(f.k==='desk'||f.k==='bar'){B.box(x,.55,z+.2,w-.2,1.1,1.2,'#5a4028');B.box(x,1.14,z+.2,w,.1,1.4,'#7a5a38');B.box(x,2,Z0+.3,w-.4,.1,.5,WOOD);B.box(x,2.8,Z0+.3,w-.4,.1,.5,WOOD);
      for(let i=0;i<w-1;i+=.6){const bx=x-w/2+.6+i;if(f.k==='bar'){B.lit(bx,2.26,Z0+.34,.16,.4,.16,['#7a3a1a','#3a6a2a','#8a6a1a'][Math.round(i/.6)%3]);B.box(bx,3.02,Z0+.34,.3,.34,.3,'#6b4e30');}else B.box(bx,2.25,Z0+.34,.14,.4,.34,['#5a2630','#2b3350','#2f4a3a','#6b4a2c'][Math.round(i/.6)%4]);}
      candle(x-w/2+.5,1.19,z+.2);candle(x+w/2-.5,1.19,z+.2);if(f.k==='desk'){B.box(x,1.22,z+.2,.9,.06,.6,'#d8d0b8');B.box(x+1.4,1.3,z+.1,.5,.22,.4,'#5a2630');}
      else for(let i=0;i<3;i++)B.box(x-2+i*2,1.33,z+.3,.22,.28,.22,'#8a6a40');}
    else if(f.k==='ltable'){B.box(x,.95,z,w-.4,.12,1.2,'#6b4e30');for(const sx of[-w/2+.7,w/2-.7])B.box(x+sx,.45,z,.2,.9,1,WOOD);for(const sz of[-.95,.95])B.box(x,.5,z+sz,w-.8,.1,.36,WOOD);
      candle(x,1.01,z);for(let i=0;i<w/2;i++)B.box(x-w/2+1+i*1.7,1.14,z+((i%2)-.5)*.5,.2,.26,.2,'#8a6a40');}
    else if(f.k==='rtable'){B.box(x,.95,z,1.5,.12,1.5,'#6b4e30',0,.785);B.box(x,.45,z,.3,.9,.3,WOOD);for(let i=0;i<3;i++){const a=i*2.1+.4;B.box(x+Math.cos(a)*1.15,.3,z+Math.sin(a)*1.15,.5,.6,.5,WOOD,0,a);}candle(x,1.01,z);}
    else if(f.k==='hearth'){const sd=x<cx?-1:1,hx=cx+sd*(W/2-.7);B.box(hx,1.5,z,1.5,3,d-.2,ST);B.box(hx,3.7,z,1.1,1.5,d-1.2,ST2);B.box(hx-sd*.72,.8,z,.1,1.3,d-1.4,'#120c08');
      B.lit(hx-sd*.76,.42,z,.1,.4,d-1.8,'#ff7a2a');B.box(hx-sd*.9,.2,z,.5,.2,d-1.6,'#3a2616');fire(hx-sd*.95,.6,z,34,15);}
    else if(f.k==='board'){B.box(X0+.16,2,z,.14,2.4,d-.4,'#5a4028');B.box(X0+.2,3.3,z,.2,.16,d-.2,DARKW);for(let i=0;i<7;i++)B.box(X0+.26,1.4+(i%3)*.75,z-d/2+.7+((i*37)%10)/10*(d-1.4),.03,.5,.4,i%3?'#d8d0b8':'#c8b890',0,0,0);}
    else if(f.k==='shelf'){B.box(x,1.5,Z0+.45,w-.2,3,.8,WOOD);for(let j=0;j<3;j++){B.box(x,.5+j*.95,Z0+.5,w-.3,.08,.86,'#6b4e30');for(let i=0;i<w/.32-1;i++)B.box(x-w/2+.35+i*.32,.75+j*.95,Z0+.6,.24,.42,.5,['#5a2630','#2b3350','#2f4a3a','#6b4a2c','#3c2c52'][(i+j)%5]);}}
    else if(f.k==='stairs'){for(let i=0;i<7;i++)B.box(x,.22*(i+1),z+d/2-.3-i*.5,1.8,.44*(i+1),.5,i%2?'#5a4028':'#6b4e30');B.box(x-.95,1.6,z,.12,3.2,d,WOOD);}
    else if(f.k==='bed'){B.box(x,.35,z,w-.3,.5,1.7,WOOD);B.box(x-w/2+.2,.8,z,.2,1.4,1.8,DARKW);B.box(x+.1,.68,z,w-.7,.3,1.5,'#d8d0b8');B.box(x+.6,.74,z,w-1.8,.3,1.56,'#5a2630');B.box(x-w/2+.8,.86,z,.7,.2,1.1,'#efe8d4');}
    else if(f.k==='stand'){B.box(x-.3,.5,z-.2,1,1,1,WOOD);candle(x-.3,1,z-.2);}
    else if(f.k==='wardrobe'){B.box(x,1.6,z-.2,1.8,3.2,1.3,WOOD);B.box(x,1.6,z+.47,.06,3,.04,DARKW);B.box(x,3.26,z-.2,2,.14,1.5,DARKW);}
    else if(f.k==='chest'){const o=single('chest_gold');o.position.set(x,0,z);ig.add(o);stashes.push(o);}
    else if(f.k==='barrel')put('barrel',f.x+.5,f.y+.5,f.x*1.7,3.5);
    else if(f.k==='crate')put('crate_A_big',f.x+.5,f.y+.5,.3,3.5);}
  if(R.k==='room'){B.box(cx,.02,cz+.4,4,.04,2.6,'#3c2c52');B.box(cx,.03,cz+.4,3.4,.04,2,'#5a4a72');}
  else B.box(cx,.02,cz+.6,5,.04,3,hall?BL:'#5a2630');
  torches.push({x:cx,y:3.4,z:cz,col:'#ffd8a0',int:18,dist:20});
  ig.add(...B.meshes());instance(ig,placed);if(fl.length)for(const[col,size,op]of FLAME_SETS.warm)ig.add(points(fl,col,size,op));
  return ig;
}
// Out of doors or in: which of the village's groups shows, and the light to see it by.
function indoors(k){
  FLOOR.areaK=k;FLOOR.town.visible=!k;for(const a of FLOOR.areas)a.group.visible=a.k===k;
  if(!k){mood(true);return;}
  scene.background.set('#090706');scene.fog.color.set('#090706');scene.fog.density=.012;hemi.color.set('#ffe2b8');hemi.groundColor.set('#2a1c10');hemi.intensity=1.75;moon.color.set('#ffe6c4');moon.intensity=1.1;
}
const areaKey=q=>{const R=G.village?insideOf(q.x,q.y):null;return R?R.k:null;};
const FLAME_SETS={warm:[['#ff8a2a',1.7,.85],['#ffcf6a',.65,1],[null,.22,1]],green:[['#2fd05a',.9,.55],['#a8ffa0',.35,.8],[null,.14,1]],blue:[['#3a6cff',1.6,.9],['#9cc0ff',.7,1],[null,.26,1]]};
for(const k in FLAME_SETS)FLAME_SETS[k][2][0]=typeof THREE==='undefined'?'#fff':new THREE.Color(k==='warm'?'#fff0c0':k==='green'?'#e8ffe0':'#eef4ff').multiplyScalar(2);
// What the town is made of, drawn into each surface by where it is in the world (no textures): s stone laid in
// courses with dark mortar, each block its own shade; p old plaster, stained, streaked by rain and damp at the foot;
// r roof tiles in overlapping rows, some darker, moss where it gathers; w wood, weathered.
const TOWN_MATS={};
function townMat(k){
  if(TOWN_MATS[k])return TOWN_MATS[k];const m=new THREE.MeshStandardMaterial({roughness:k==='r'?.85:.97});
  const body={
    s:`vec2 b=uv/vec2(.7,.34);b.x+=.5*mod(floor(b.y),2.);vec2 id=floor(b),f=fract(b);
       float mo=smoothstep(0.,.07,f.x)*smoothstep(0.,.07,1.-f.x)*smoothstep(0.,.13,f.y)*smoothstep(0.,.13,1.-f.y);
       float g=mix(.38,.7+.45*gH(id),mo)*mix(.7,1.08,gF(uv*2.2));g*=1.-.25*step(.93,gH(id+7.));   // mortar, each block its own shade, a few blackened
       float low=1.-smoothstep(0.,1.4,vGW.y);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,.86,.6),low*.6*smoothstep(.35,.6,gF(uv*.6+4.)));
       diffuseColor.rgb*=g*1.35;`,
    p:`float g=mix(.66,1.08,gF(uv*1.3))*mix(.7,1.,smoothstep(.28,.6,gF(uv*.4+3.)));                    // grime, and big stains
       g*=mix(.72,1.,smoothstep(.3,.62,gF(vec2(uv.x*5.,uv.y*.3+2.))));                                 // rain streaks, running down
       float low=1.-smoothstep(.3,2.4,vGW.y);g*=1.-low*.4;diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.78,.86,.66),low*.6);
       vec2 cu=uv*.9+vec2(gF(uv*2.1),gF(uv*2.1+9.))*.8;float cd=gCrack(cu),patchy=smoothstep(.42,.55,gF(uv*.3+17.));
       g*=1.-(1.-smoothstep(0.,.06,cd))*patchy*.8;                                                      // cracks, in patches
       float bare=smoothstep(.66,.7,gF(uv*.8+31.));                                                     // plaster fallen away: the brick under it
       vec2 b=uv/vec2(.5,.22);b.x+=.5*mod(floor(b.y),2.);vec2 f=fract(b);float mo=smoothstep(0.,.1,f.x)*smoothstep(0.,.18,f.y);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.3,.16,.11)*(.7+.5*gH(floor(b)))*mix(.5,1.,mo),bare);
       diffuseColor.rgb*=g*1.6;`,
    r:`float across=abs(vGN.z)>abs(vGN.x)?vGW.x:vGW.z,v=vGW.y/.24;across=across/.36+.5*mod(floor(v),2.);
       vec2 id=vec2(floor(across),floor(v)),f=vec2(fract(across),fract(v));
       float g=mix(.42,1.,smoothstep(0.,.3,f.y))*mix(.55,1.,smoothstep(0.,.1,f.x)*smoothstep(0.,.1,1.-f.x))*(.68+.5*gH(id));   // each tile laps the row below
       g*=1.-.45*step(.94,gH(id+3.));g*=mix(.7,1.05,gF(vGW.xz*.9));                                     // slipped and blackened tiles; soot
       float moss=smoothstep(.56,.72,gF(vGW.xz*.45+7.))*smoothstep(.2,.6,f.y);
       diffuseColor.rgb=mix(diffuseColor.rgb*g*1.55,vec3(.2,.25,.11)*(.7+.5*gH(id)),moss*.55);`,
    w:`float g=mix(.7,1.1,gF(uv*vec2(2.,7.)))*mix(.8,1.,gF(uv*.7+5.));float low=1.-smoothstep(0.,1.2,vGW.y);g*=1.-low*.25;diffuseColor.rgb*=g*1.25;`}[k];
  m.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vGW;varying vec3 vGN;').replace('#include <project_vertex>',
      '#include <project_vertex>\nvec4 gw=vec4(transformed,1.);vec3 gn=objectNormal;\n#ifdef USE_INSTANCING\ngw=instanceMatrix*gw;gn=mat3(instanceMatrix)*gn;\n#endif\nvGW=(modelMatrix*gw).xyz;vGN=normalize(mat3(modelMatrix)*gn);');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vGW;varying vec3 vGN;'+GRIT_GLSL).replace('#include <color_fragment>',
      '#include <color_fragment>\n{vec3 an=abs(vGN);vec2 uv=an.y>.75?vGW.xz:(an.x>an.z?vGW.zy:vGW.xy);\n'+body+'}');};
  m.customProgramCacheKey=()=>'town-'+k;return TOWN_MATS[k]=m;
}
// The town's own carpentry: boxes and gable ends by the thousand, in two draws, each with its own colour. A house is
// stone footings, plaster walls in a timber frame, a door, windows (most of them lit), a pitched roof and a chimney.
function townBuilder(){
  const boxes=[],prisms=[],glows=[],shine=[];
  const mat=(x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz,'YXZ')),new THREE.Vector3(sx,sy,sz));
  let cur=null;const emit=(list,M,c)=>{const i=typeof c==='string'?c.indexOf('|'):-1;list.push([cur?M.premultiply(cur):M,i<0?c:c.slice(0,i),i<0?'w':c[i+1]]);};   // a colour may name its stuff: '#777|s' stone, p plaster, r roof tiles, w wood (the default)   // cur: where the house being built stands, and how it is turned
  const box=(x,y,z,sx,sy,sz,c,rx,ry,rz)=>emit(boxes,mat(x,y,z,sx,sy,sz,rx,ry,rz),c),prism=(x,y,z,sx,sy,sz,c,ry)=>emit(prisms,mat(x,y,z,sx,sy,sz,0,ry),c);
  const lit=(x,y,z,sx,sy,sz,c,rx,ry,rz)=>emit(shine,mat(x,y,z,sx,sy,sz,rx,ry,rz),c);   // something that glows by its own light, whatever the hour
  const PLASTER=['#b3a688','#a6997b','#9a8e76','#ad9d80','#8f8672','#a39478'],ROOF=['#6e3328','#5e2c24','#743a2a','#4a3d36','#39444c','#54402a','#414832','#63302b'],SHUT=['#33473a','#532823','#2c4052','#4a3d24'],TIMBER='#2e2118',STONE='#6f6b62|s';
  function house(h){
    const r=mulberry32(h.seed),pick=a=>a[Math.floor(r()*a.length)],[X0,Zb]=VT(h.x+h.w/2,h.y),turned=Math.abs(h.rot||0)>.02;
    const ar=Math.abs(h.rot||0),W=h.w*2-.24-ar*h.h*2.2,D=h.h*2-.8-ar*h.w*1.1,X=0,zc=0,st=2.7,fl=h.floors,plaster=h.plaster||(h.barn?'#663c2c|w':pick(PLASTER)+'|p'),roofB=h.roof||(h.barn?'#40332b':pick(ROOF)),roof=roofB+'|r',timber=h.barn?'#40261c':TIMBER;
    const stoneLow=h.stone||(!h.barn&&fl===2&&r()<.35),jet=h.stone===2?0:fl===2&&r()<.55?.5:0,H=st*fl,y0=.4+r()*.5,top=y0+H,pitch=.42+r()*.2;   // (no two eaves at one height, no two roofs at one pitch)
    cur=mat(X0+(h.dx||0),0,Zb+.25+(h.h*2-.8)/2,1,1,1,0,h.rot||0);
    box(X,y0/2+.02,zc,W+.2,y0+.04,D+.2,'#625e56|s');
    for(let f=0;f<fl;f++){const j=f?jet:0,zF=zc+D/2+j,yb=y0+f*st,col=(f===0&&stoneLow)||h.stone===2?STONE:plaster;
      box(X,yb+st/2,zc+j/2,W,st,D+j,col);
      box(X,yb+st-.1,zc+j/2,W+.08,.2,D+j+.08,timber);if(f)box(X,yb+.08,zc+j/2,W+.1,.2,D+j+.1,timber);
      const n=Math.max(2,Math.round(W/2)),pw=(W-.2)/n,door=f===0?(h.doorAt!=null?h.doorAt:Math.floor(r()*n)):-1,wins=new Set();
      {const free=[];for(let i=0;i<n;i++)if(i!==door)free.push(i);for(let k=Math.min(free.length,h.w>=5?3:2,1+Math.floor(r()*3));k>0;k--)wins.add(free.splice(Math.floor(r()*free.length),1)[0]);}   // three windows a floor at most
      if(!(f===0&&stoneLow))for(let i=0;i<=n;i++)box(X-W/2+.1+i*pw,yb+st/2,zF+.02,.18,st,.1,timber);
      for(let i=0;i<n;i++){const px=X-W/2+.1+(i+.5)*pw;
        if(i===door){const dw=h.barn?1.8:h.wide?1.5:1;box(px,y0+.95,zF+.05,dw,1.9,.12,h.barn?'#3a241a':'#3b2616');box(px,y0+1.96,zF+.05,dw+.24,.14,.16,timber);box(px,y0/2,zF+.4,dw+.5,y0,.7,STONE);
          if(!h.barn&&r()<.5){emit(glows,mat(px+dw/2+.35,y0+1.75,zF+.2,.16,.2,.16),0);box(px+dw/2+.35,y0+1.95,zF+.12,.06,.06,.3,timber);}continue;}
        if(h.barn||!wins.has(i)){if(!(f===0&&stoneLow)&&r()<.6)box(px,yb+st/2,zF+.03,.14,st*1.12,.08,timber,0,0,r()<.5?.5:-.5);continue;}
        const wy=yb+1.5,lit=r()<.45;emit(lit?glows:boxes,mat(px,wy,zF+.04,.8,.95,.08),lit?Math.floor(r()*3):'#1d242c');
        box(px,wy,zF+.07,.06,.95,.06,timber);box(px,wy,zF+.07,.8,.06,.06,timber);box(px,wy-.56,zF+.1,1,.1,.22,timber);
        if(r()<.45){const sc=pick(SHUT);for(const sx of[-.53,.53])box(px+sx,wy,zF+.05,.24,.95,.06,sc);}
        else if(r()<.4){box(px,wy-.7,zF+.2,.9,.2,.26,'#5a3a22');box(px,wy-.55,zF+.2,.8,.16,.2,pick(['#b8405a','#d8b040','#c86a8a','#5a8a3a']));}}}
    // the roof: mostly eaves to the street; on some narrow houses the gable faces it
    const jz=jet/2,Dr=D+jet,gable=h.gable!=null?h.gable:(!h.barn&&h.w<=5&&r()<.3),dark='#'+new THREE.Color(roofB).multiplyScalar(.55).getHexString()+'|r',lite='#'+new THREE.Color(roofB).multiplyScalar(1.12).getHexString()+'|r',board='#'+new THREE.Color(roofB).multiplyScalar(.4).getHexString();
    if(gable){const half=W/2+.3,rise=Math.min(3.8,W*pitch*1.05),L=Math.hypot(half,rise),th=Math.atan2(rise,half);
      prism(X,top,zc+jz,Dr,rise,W,plaster,Math.PI/2);
      for(const sd of[-1,1]){box(X+sd*half/2,top+rise/2+.06,zc+jz,L+.1,.2,Dr+.7,sd<0?roof:lite,0,0,-sd*th);
        for(const e of[-1,1])box(X+sd*half/2,top+rise/2+.02,zc+jz+e*(Dr/2+.37),L+.16,.26,.1,board,0,0,-sd*th);}   // bargeboards: each roof ends in its own dark edge
      box(X,top+rise+.1,zc+jz,.26,.2,Dr+.74,dark);if(r()<.5)emit(glows,mat(X,top+rise*.38,zc+jz+Dr/2+.03,.6,.7,.06),Math.floor(r()*3));else box(X,top+rise*.38,zc+jz+Dr/2+.03,.6,.7,.06,'#1d242c');
      box(X,top+.05,zc+jz+Dr/2+.03,W,.16,.08,timber);}
    else{const half=Dr/2+.45,rise=Math.min(3.5,Dr*pitch),L=Math.hypot(half,rise),th=Math.atan2(rise,half);
      prism(X,top,zc+jz,W,rise,Dr,plaster);
      for(const sd of[-1,1]){box(X,top+rise/2+.06,zc+jz+sd*half/2,W+.16,.2,L+.1,sd>0?lite:roof,sd*th);   // (the roof stops at the house's own walls: next door's is another roof)
        for(const e of[-1,1])box(X+e*(W/2+.1),top+rise/2+.02,zc+jz+sd*half/2,.1,.26,L+.16,board,sd*th);}
      box(X,top+rise+.1,zc+jz,W+.2,.2,.26,dark);
      if(!h.barn&&h.w>=5&&r()<.4){const dx=X+(r()-.5)*(W-3);   // a dormer in the roof
        box(dx,top+rise*.55,zc+jz+half*.45,1.3,1.1,1.2,plaster);if(r()<.5)emit(glows,mat(dx,top+rise*.55,zc+jz+half*.45+.62,.7,.7,.06),Math.floor(r()*3));else box(dx,top+rise*.55,zc+jz+half*.45+.62,.7,.7,.06,'#1d242c');box(dx,top+rise*.55+.66,zc+jz+half*.45,1.6,.16,1.5,roof);}}
    if(!h.barn){const rise=gable?Math.min(3.8,W*pitch*1.05):Math.min(3.5,Dr*pitch);box(X+(r()<.5?-1:1)*(W/2-1),top+rise*.5+.5,zc-D*.15,.62,rise+1.2,.62,'#5f5b54|s');}
    cur=null;return{X:X0,Z:Zb+.25+(h.h*2-.8)/2,W,D,top,front:Zb+.25+(h.h*2-.8)/2+D/2,jet};
  }
  function meshes(){
    const out=[],col=new THREE.Color(),unit=new THREE.BoxGeometry(1,1,1);
    const pg=new THREE.BufferGeometry();   // a gable: a triangle (apex up) pulled along x
    pg.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-.5,0,.5, .5,0,.5, .5,1,0, -.5,0,.5, .5,1,0, -.5,1,0,  .5,0,-.5, -.5,0,-.5, -.5,1,0, .5,0,-.5, -.5,1,0, .5,1,0,
      -.5,0,-.5, -.5,0,.5, -.5,1,0,  .5,0,.5, .5,0,-.5, .5,1,0]),3));pg.computeVertexNormals();
    const make=(list,geo,m,shadow)=>{if(!list.length)return;const im=new THREE.InstancedMesh(geo,m,list.length);list.forEach(([M,c],i)=>{im.setMatrixAt(i,M);im.setColorAt(i,col.set(c));});
      im.instanceColor.needsUpdate=true;im.castShadow=shadow;im.receiveShadow=shadow;im.computeBoundingSphere();im.frustumCulled=false;out.push(im);};
    for(const k of'sprw'){make(boxes.filter(q=>q[2]===k),unit,townMat(k),true);make(prisms.filter(q=>q[2]===k),pg,townMat(k),true);}
    // the panes: dark glass by day; in the evening and at night a dim, steady candlelight (VILLAGE_HOUR, village.js)
    const dayTime=VILLAGE_HOUR==='day';
    make(glows.map(q=>[q[0],dayTime?'#1d242c':q[1]===0?'#5a3414':q[1]===1?'#4e2c12':'#633a18']),unit,dayTime?new THREE.MeshStandardMaterial({roughness:.4}):new THREE.MeshBasicMaterial({}),false);
    if(shine.length){const sm=new THREE.MeshBasicMaterial({});make(shine,unit,sm,false);}
    return out;
  }
  return{box,prism,lit,house,meshes};
}
// The village's ground, painted once into a canvas: grass with its lighter and darker patches, the worn paths, the
// square's flagstones, the market's cobbles, the fields' tilled earth and the training yard's packed dirt.
const GP=24;   // canvas pixels a tile
let GROUND=null;
function groundCanvas(){
  if(GROUND)return GROUND;const c=document.createElement('canvas');c.width=VILLAGE_W*GP;c.height=VILLAGE_H*GP;const x=c.getContext('2d'),r=mulberry32(77),T=v=>v*GP;
  x.fillStyle='#3f5b2f';x.fillRect(0,0,c.width,c.height);
  for(let i=0;i<5200;i++){const px=r()*c.width,py=r()*c.height,rr=4+r()*22;x.fillStyle=['#456634','#3a5429','#4c6e38','#36502a','#52733c'][Math.floor(r()*5)];x.globalAlpha=.35+r()*.4;x.beginPath();x.ellipse(px,py,rr,rr*.6,r()*3,0,7);x.fill();}
  x.globalAlpha=1;
  // the border, where the roots and the woods begin
  for(let y=0;y<VILLAGE_H;y++)for(let X=0;X<VILLAGE_W;X++)if(Math.min(X,y,VILLAGE_W-1-X,VILLAGE_H-1-y)<3){x.fillStyle='rgba(28,38,22,.75)';x.fillRect(T(X)-2,T(y)-2,GP+4,GP+4);}
  const soft=(draw,col,w,al)=>{x.save();x.globalAlpha=al;x.strokeStyle=col;x.lineWidth=w;x.lineCap='round';draw();x.restore();};
  // packed earth round the houses and in the camps and the yard
  const earth=(X,Y,W,H,c='#6b5a3e',al=.8)=>{x.globalAlpha=al;x.fillStyle=c;x.beginPath();x.roundRect(T(X),T(Y),T(W),T(H),GP*.6);x.fill();x.globalAlpha=1;for(let i=0;i<W*H*3;i++){x.fillStyle=r()<.5?'rgba(0,0,0,.07)':'rgba(255,240,200,.05)';x.fillRect(T(X)+r()*T(W),T(Y)+r()*T(H),5,3);}};
  for(const[x0,x1,base,depth]of VILLAGE.rows)earth(x0-.4,base-depth-.4,x1-x0+.8,depth+1.5,'#5e5038',.7);
  {const[cx,cy,cw,ch]=VILLAGE.camp;earth(cx-2,cy+.6,cw+1.4,ch,'#6e5c40',.95);const[yx,yy,yw,yh]=VILLAGE.yard;earth(yx,yy,yw,yh,'#76664a',.9);
    x.strokeStyle='#4a3c28';x.lineWidth=3;x.setLineDash([10,8]);x.strokeRect(T(yx)+4,T(yy)+4,T(yw)-8,T(yh)-8);x.setLineDash([]);}
  for(const[a,b,cc,d]of VILLAGE.paths){const path=()=>{x.beginPath();x.moveTo(T(a[0]),T(a[1]));x.bezierCurveTo(T(b[0]),T(b[1]),T(cc[0]),T(cc[1]),T(d[0]),T(d[1]));x.stroke();};
    soft(path,'#5e4c30',T(2.4),.45);soft(path,'#7a6440',T(1.6),.9);soft(path,'#8c7650',T(.8),.5);}
  // the streets: cobbles between two kerbs, laid in rows across the way
  const cob=['#74706a','#67635c','#6e6a62','#7b776f','#5f5b55'];
  for(const[sx,sy,sw,sh]of VILLAGE.streets){x.fillStyle='#4c4944';x.fillRect(T(sx)-3,T(sy)-3,T(sw)+6,T(sh)+6);}
  for(const[sx,sy,sw,sh]of VILLAGE.streets){x.fillStyle='#57534d';x.fillRect(T(sx),T(sy),T(sw),T(sh));const along=sw>sh,s=GP*.42;
    for(let j=0;j*s<T(sh);j++)for(let i=0;i*s<T(sw);i++){const ox=along?0:(j%2)*s/2,oy=along?(i%2)*s/2:0;x.fillStyle=cob[Math.floor(r()*5)];x.beginPath();x.roundRect(T(sx)+i*s+ox+1,T(sy)+j*s+oy+1,s-2,s-2,3);x.fill();}
    x.fillStyle='rgba(0,0,0,.14)';if(along)x.fillRect(T(sx),T(sy)+T(sh)/2-2,T(sw),4);else x.fillRect(T(sx)+T(sw)/2-2,T(sy),4,T(sh));}   // the gutter down the middle
  // the plaza: flagstones in rings round the Teleport Gate
  {const sq=VILLAGE.square,cx=T(sq.x),cy=T(sq.y),R0=T(sq.r);x.fillStyle='#4c4944';x.beginPath();x.arc(cx,cy,R0+4,0,7);x.fill();x.fillStyle='#7d7a70';x.beginPath();x.arc(cx,cy,R0,0,7);x.fill();
    x.strokeStyle='#4e4c46';x.lineWidth=2;for(let rr=GP*.9;rr<R0;rr+=GP*.9){x.beginPath();x.arc(cx,cy,rr,0,7);x.stroke();const n=Math.max(6,Math.floor(rr/GP*3.2));
      for(let i=0;i<n;i++){const a=i/n*TAU+rr;x.beginPath();x.moveTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);x.lineTo(cx+Math.cos(a)*Math.min(R0,rr+GP*.9),cy+Math.sin(a)*Math.min(R0,rr+GP*.9));x.stroke();}}
    for(let i=0;i<700;i++){const a=r()*TAU,d=r()*R0;x.fillStyle=r()<.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.08)';x.fillRect(cx+Math.cos(a)*d,cy+Math.sin(a)*d,8,6);}
    x.strokeStyle='#8fb8c0';x.globalAlpha=.3;x.lineWidth=4;x.beginPath();x.arc(cx,cy,T(2.4),0,7);x.stroke();x.lineWidth=2;x.beginPath();x.arc(cx,cy,T(4.6),0,7);x.stroke();x.globalAlpha=1;}
  // the fields: tilled earth, and each plot's rows
  {const[fx,fy,fw,fh]=VILLAGE.fields;x.fillStyle='#63502f';x.fillRect(T(fx),T(fy)+GP/2,T(fw),T(fh));for(let i=0;i<900;i++){x.fillStyle=r()<.5?'rgba(0,0,0,.08)':'rgba(255,235,190,.06)';x.fillRect(T(fx)+r()*T(fw),T(fy)+r()*T(fh),6,3);}
    for(const[px,py]of VILLAGE.plots){x.fillStyle='#3e2f1d';x.fillRect(T(px)+3,T(py)+3,T(3)-6,T(2)-6);x.fillStyle='#5a4730';for(let k=0;k<4;k++)x.fillRect(T(px)+6,T(py)+8+k*GP*.45,T(3)-12,3);}}
  return GROUND=c;
}
function villageGround(){
  const c=groundCanvas(),tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(VILLAGE_W*2,VILLAGE_H*2),new THREE.MeshStandardMaterial({map:tex,roughness:1}));
  m.rotation.x=-Math.PI/2;const[x,z]=VT(VILLAGE_W/2,VILLAGE_H/2);m.position.set(x,0,z);m.receiveShadow=true;return m;
}
// Tufts of grass and a few stones wherever the ground is grass (the canvas is green there).
function villageTufts(){
  const c=groundCanvas(),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data,r=mulberry32(91),blades=[],stones=[];
  for(let y=0;y<VILLAGE_H;y++)for(let x=0;x<VILLAGE_W;x++){if(G.map[(VOY+y)*MW+VOX+x]!==1)continue;
    const i=((y*GP+GP/2)*c.width+x*GP+GP/2)*4;if(!(d[i+1]>d[i]+12&&d[i+1]>d[i+2]+12))continue;   // grass only
    const n=Math.floor(r()*4);for(let k=0;k<n;k++){const[X,Z]=VT(x+r(),y+r());for(let b=0;b<3;b++)blades.push(M4(X+(r()-.5)*.3,.18,Z+(r()-.5)*.3,r()*6,1,.6+r()*.8,1));}
    if(r()<.04){const[X,Z]=VT(x+r(),y+r());stones.push(M4(X,.05,Z,r()*6,.6+r()*.8,.4+r()*.4,.6+r()*.8));}}
  const out=[];
  if(blades.length){const im=new THREE.InstancedMesh(new THREE.ConeGeometry(.05,.4,3),new THREE.MeshStandardMaterial({color:'#5a7f3a',roughness:.9}),blades.length);blades.forEach((m,i)=>im.setMatrixAt(i,m));im.computeBoundingSphere();out.push(im);}
  if(stones.length){const im=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.25,0),new THREE.MeshStandardMaterial({color:'#7a7a74',roughness:1}),stones.length);stones.forEach((m,i)=>im.setMatrixAt(i,m));im.castShadow=true;im.computeBoundingSphere();out.push(im);}
  return out;
}
// The Blackspire itself: the trunk of the great tree, far too big to see the top of, with roots spread at its foot.
function trunk(x,z){
  const g=new THREE.Group(),bark=new THREE.MeshStandardMaterial({color:'#3b2c22',roughness:1,flatShading:true});
  const geo=new THREE.CylinderGeometry(15,19,90,18,10);const p=geo.attributes.position,r=mulberry32(5);
  for(let i=0;i<p.count;i++){const a=Math.atan2(p.getZ(i),p.getX(i)),k=1+.08*Math.sin(a*7+p.getY(i)*.08)+.05*(r()-.5);p.setX(i,p.getX(i)*k);p.setZ(i,p.getZ(i)*k);}
  geo.computeVertexNormals();const t=new THREE.Mesh(geo,bark);t.position.set(x,45,z-18);t.castShadow=true;t.receiveShadow=true;g.add(t);
  for(let i=0;i<9;i++){const a=Math.PI*(.15+.7*i/8),root=new THREE.Mesh(new THREE.ConeGeometry(3.2,22,7),bark);
    root.position.set(x+Math.cos(a)*19,1.5,z-18+Math.sin(a)*14);root.rotation.set(Math.sin(a)*1.25,0,-Math.cos(a)*1.25);root.castShadow=true;g.add(root);}
  return g;
}
// The square's notice board, and the fields' signpost: posts and boards.
function noticeBoard(x,z){const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:'#5a3f26',roughness:1}),paper=new THREE.MeshStandardMaterial({color:'#e6dcc0',roughness:1});
  for(const s of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.2,2.6,.2),wood);p.position.set(x+s*1.6,1.3,z);p.castShadow=true;g.add(p);}
  const b=new THREE.Mesh(new THREE.BoxGeometry(3.6,1.6,.12),wood);b.position.set(x,1.8,z);b.castShadow=true;g.add(b);
  for(const[i,j]of[[-1.1,.3],[-.2,.1],[.8,.35],[.4,-.35],[-.8,-.3]]){const q=new THREE.Mesh(new THREE.PlaneGeometry(.6,.7),paper);q.position.set(x+i,1.8+j,z+.07);q.rotation.z=(i*7%3-1)*.08;g.add(q);}
  return g;}
function signpost(x,z){const g=new THREE.Group(),wood=new THREE.MeshStandardMaterial({color:'#5a3f26',roughness:1});
  const p=new THREE.Mesh(new THREE.BoxGeometry(.18,2.2,.18),wood);p.position.set(x,1.1,z);p.castShadow=true;g.add(p);
  const b=new THREE.Mesh(new THREE.BoxGeometry(1.6,.5,.1),wood);b.position.set(x+.5,1.8,z);b.rotation.y=.2;b.castShadow=true;g.add(b);return g;}

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
  dummy:{prop:'target',s:6},
  boss:{m:'Skeleton_Warrior',ghost:'#b85a4a',s:2.5,r:'Skeleton_Axe',l:'Skeleton_Shield_Large_A',two:true},
  boneboss:{m:'Skeleton_Warrior',s:2.8,tint:'#e6d8a8',eyes:'#ffd060',r:'Skeleton_Blade',l:'Skeleton_Shield_Large_A',crown:true},   // the Bone Regent: gilded bone, a crown, a tower shield until it breaks
  collector:{m:'Skeleton_Mage',tint:'#d8d4e6',s:2.5,r:'Skeleton_Staff',caster:true},
};
const ACTORS=new Map(),DYING=[],FREE=new Map();
// KayKit's people are drawn chibi: a big head on a short body. After the animation poses a skeleton each frame, the
// head is shrunk, the body narrowed, and the legs and spine lengthened (the joint after each lengthened bone is scaled
// back), so the figures stand taller and leaner. A model is lifted by what its legs gained (makeActor).
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const BUILD=typeof THREE==='undefined'?[]:[['hips',V3(.8,1,.84)],['spine',V3(.92,1.2,.92)],['chest',V3(1,1/1.2,1)],
  ['head',V3(.58/(.8*.92),.58,.58/(.84*.92))],['upperleg.l',V3(1,1.2,1)],['upperleg.r',V3(1,1.2,1)],['foot.l',V3(1,1/1.2,1)],['foot.r',V3(1,1/1.2,1)]];
// People (heroes, townsfolk, traders) go further: legs about two and a half times longer, arms longer to match, a
// small head, narrow hips and shoulders, so a figure stands about six heads tall and gear has room to show (a coat's
// tails, a belt at the waist). Skeletons keep the build above. Each lengthened bone's child takes the stretch back.
const TALL=typeof THREE==='undefined'?[]:(()=>{const hx=.74,hz=.76,sx=.8,sy=1.3,cy=.88,head=.42,leg=2.55,arm=1.58,ax=hx*sx,ay=sy*cy,az=hz*sx;
  return[['hips',V3(hx,1,hz)],['spine',V3(sx,sy,sx)],['chest',V3(1,cy,1)],['head',V3(head/ax,head/ay,head/az)],
    ['upperleg.l',V3(1.05,leg,1.05)],['upperleg.r',V3(1.05,leg,1.05)],['foot.l',V3(1/1.05,1/leg,1/1.05)],['foot.r',V3(1/1.05,1/leg,1/1.05)],
    ['upperarm.l',V3(.95,arm,.95)],['upperarm.r',V3(.95,arm,.95)],['wrist.l',V3(1/.95,1/arm,1/.95)],['wrist.r',V3(1/.95,1/arm,1/.95)]];})();
// The height of a person's head, and of what floats over it (names, bars, speech), in world units.
const PERSON_TOP=2.8;   // a person stands about 2.5 tall, a helmet a little more
// (The change is taken back before each update: a clip without a scale track for a bone leaves the scale alone, and
// it would otherwise compound frame after frame.)
function upd(a,dt){if(!a.mixer)return;if(a.build&&a.built)for(const[b,v]of a.build)b.scale.divide(v);
  if(a.fig&&a.propOn){for(const[b,f]of a.fig.prop)b.position.divide(f);for(const[b,,qi]of a.fig.turn)b.quaternion.premultiply(qi);}   // a person's proportions: each bone's place, stretched (figure.js)
  a.mixer.update(dt);if(a.build){for(const[b,v]of a.build)b.scale.multiply(v);a.built=true;}
  if(a.fig){for(const[b,f]of a.fig.prop)b.position.multiply(f);for(const[b,q]of a.fig.turn)b.quaternion.premultiply(q);a.propOn=true;}
  // The sidestep clips turn the hips 58 degrees toward the way they go and twist the chest back. With the arms' own
  // clip over those legs (a swing, a guard) nothing twists back, so the spine is turned by hand to face the front.
  if(a.twist){const sp=a.spine||(a.spine=bone(a.root,'spine'));if(sp)sp.quaternion.premultiply(TWQ.setFromAxisAngle(UP,a.twist));}
  if(a.fig&&a.fig.cloth)FIGURE.step(a.fig,a.root,dt);}
const TWQ=new THREE.Quaternion(),UP=new THREE.Vector3(0,1,0);
const bone=(root,n)=>root.getObjectByName(n)||root.getObjectByName(n.replace('.',''));
// A character model, ready to animate. key: what it is (for reuse), o: {m, hold, r, l, s, ghost, tint, eyes}
function makeActor(key,o){
  const free=FREE.get(key);if(free&&free.length){const a=free.pop();a.root.visible=true;scene.add(a.root);a.cur=null;a.curName='';a.up=null;a.px=null;a.twist=0;a.root.rotation.x=a.root.rotation.z=0;for(const x of Object.values(a.acts))x.stop();return a;}
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
    if(o.crown){const hb=bone(root,'head');if(hb){const gold=new THREE.MeshStandardMaterial({color:'#d9a441',roughness:.35,metalness:.7,emissive:'#5a3a08',emissiveIntensity:.5}),g=new THREE.Group();   // a crown: a band and its points
        const band=new THREE.Mesh(new THREE.CylinderGeometry(.36,.36,.14,10,1,true),gold);band.material.side=THREE.DoubleSide;g.add(band);
        for(let i=0;i<6;i++){const a=i/6*TAU,p=new THREE.Mesh(new THREE.ConeGeometry(.08,.3,4),gold);p.position.set(Math.cos(a)*.36,.2,Math.sin(a)*.36);g.add(p);}
        g.position.y=.72;hb.add(g);mats.push(gold);}}
    for(const[slot,w]of[['handslot.r',o.r],['handslot.l',o.l]])if(w){const b=bone(root,slot);if(b){const wm=single(w);if(o.ghost)wm.traverse(c=>{if(c.isMesh){c.material=c.material.clone();c.material.emissive=new THREE.Color(o.ghost);c.material.emissiveIntensity=.35;}});b.add(wm);}}
  }
  for(const m of mats){m.userData.base=[m.emissive?m.emissive.clone():null,m.emissiveIntensity||0];if(STYLE.flat){m.flatShading=true;m.needsUpdate=true;}}
  let model=null,build=null,fig=null;
  if(o.m){   // a person or a skeleton: wrapped, so it can be lifted onto its longer legs
    model=root;root=new THREE.Group();root.add(model);
    if(o.hero&&FIGURE){fig=FIGURE.dress(model,o.hero,specKey(o.hero));mats.push(...fig.mats);if(STYLE.flat)for(const m of fig.mats){m.flatShading=true;}}   // a person: built in figure.js, on these bones
    build=fig?[]:(me.chibi?[]:/^Skeleton/.test(o.m)?BUILD:TALL).map(([n,v])=>[bone(model,n),v]).filter(q=>q[0]);
    model.updateMatrixWorld(true);const toe=bone(model,'toes.l'),y0=toe?toe.getWorldPosition(new THREE.Vector3()).y:0;
    for(const[b,v]of build)b.scale.multiply(v);model.updateMatrixWorld(true);
    const y1=toe?toe.getWorldPosition(new THREE.Vector3()).y:0;for(const[b,v]of build)b.scale.divide(v);
    if(!fig)model.position.y=y0-y1;}
  if(STYLE.ink)ink(root,o.s&&o.s>2?.02:.045);
  if(o.xray)xray(root,o.xray);
  if(fig&&fig.cloth)root.add(fig.cloth.mesh);   // (after the outline and the silhouette are made: the cloth has neither)
  root.scale.setScalar(o.s||1);root.rotation.order='YXZ';scene.add(root);   // (turn first, then lean: the lean follows the facing)
  const a={key,root,model,build,fig,propOn:false,mats,mixer:model?new THREE.AnimationMixer(model):null,acts:{},cur:null,curName:'',face:0,o,lock:0,swT:-1,st:'',n:0,x:0,z:0,alpha:1,seen:0};
  return a;
}
// A faint pale edge on enemies, brightest where a surface turns away from the camera, so a skeleton standing in the
// dark still shows its outline: the room can be dark, but a threat is never invisible.
function rim(m){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',
  '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(.16,.2,.3)*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),2.5);');};
  m.customProgramCacheKey=()=>'rim';}
function dropActor(a){scene.remove(a.root);a.root.visible=false;if(a.mixer)a.mixer.stopAllAction();a.cur=null;a.curName='';a.dead=false;fade(a,1);   // (fade before anything marks it opaque: it skips when alpha is already 1)
  (FREE.get(a.key)||FREE.set(a.key,[]).get(a.key)).push(a);}
function fade(a,al){if(a.alpha===al)return;a.alpha=al;a.root.traverse(c=>{if(c.userData.inkMesh)c.userData.inkMesh.visible=c.visible&&al>=1;});for(const m of a.mats){m.transparent=al<1;m.opacity=al;}}
// Plays a clip: loops by default; once: plays through and holds the last frame. A new clip fades in over `fade` s.
/* ---------- gait: the ground speed each walking clip was drawn for ---------- */
// The clips walk on the spot. A planted foot slides back under the body at exactly the speed the body should travel,
// so that speed is measured once for each kind of actor (its own legs, its own size): the clip is stepped through
// and each foot timed while it is on the ground (the low part of its path). Moving, the clip nearest the true speed
// is played at (true speed / its speed), and the feet hold the floor instead of skating over it.
// What touches the ground is the heel as a foot lands and the toes as it leaves, so each foot is followed at both
// (the ankle and the toe bones): the lower of the two is the contact, planted while it is in the lowest part of its path.
const PLANTED=.18,FWD=['Walking_A','Running_A','Running_C'],LOCO=[...FWD,'Running_Strafe_Left','Running_Strafe_Right','Walking_Backwards'],GAIT=new Map();
const footBones=a=>['l','r'].map(s_=>[bone(a.root,'foot.'+s_),bone(a.root,'toes.'+s_)].filter(Boolean)).filter(f=>f.length);
// frames: [per foot][per bone][per sample] = [x,y,z]; dt between samples. The speeds over the floor of each planted contact.
function plantedSpeeds(frames,dt){
  const out=[];
  for(const foot of frames){const rng=foot.map(b=>{const ys=b.map(q=>q[1]),lo=Math.min(...ys);return[lo,Math.max(...ys)-lo];}),n=foot[0].length;
    for(let i=0;i<n-1;i++){let k=0;for(let j=1;j<foot.length;j++)if(foot[j][i][1]-rng[j][0]<foot[k][i][1]-rng[k][0])k=j;   // the bone nearest the floor
      const b=foot[k],cut=rng[k][0]+rng[k][1]*PLANTED;if(b[i][1]<=cut&&b[i+1][1]<=cut)out.push(Math.hypot(b[i+1][0]-b[i][0],b[i+1][2]-b[i][2])/dt);}}
  return out;
}
function gaitOf(a){
  if(GAIT.has(a.key))return GAIT.get(a.key);
  const g={},feet=footBones(a),inv=new THREE.Matrix4(),v=new THREE.Vector3();
  if(a.mixer&&feet.length)for(const name of LOCO){if(!CLIP[name])continue;
    a.mixer.stopAllAction();const act=a.mixer.clipAction(CLIP[name]);act.reset();act.setLoop(THREE.LoopRepeat,Infinity);act.play();
    const N=96,D=CLIP[name].duration,fr=feet.map(f=>f.map(()=>[]));
    for(let i=0;i<=N;i++){act.time=Math.min(D*i/N,D-1e-4);upd(a,0);a.root.updateMatrixWorld(true);inv.copy(a.root.matrixWorld).invert();
      feet.forEach((f,j)=>f.forEach((b,k)=>{b.getWorldPosition(v).applyMatrix4(inv);fr[j][k].push([v.x,v.y,v.z]);}));}
    const sp=plantedSpeeds(fr,D/N).sort((x,y)=>x-y);g[name]=sp.length?sp[sp.length>>1]*a.root.scale.x:0;act.stop();}   // the middle speed: the one that slides least
  if(a.mixer){a.mixer.stopAllAction();a.cur=null;a.curName='';a.up=null;}
  GAIT.set(a.key,g);return g;
}
// The body's parts, to move them apart: the legs can run while the arms swing or hold a guard. A clip cut down to
// the upper body (spine up, and the arms) or to the rest (hips and legs).
const UPPER=/^(spine|chest|head|upperarm|lowerarm|wrist|hand|elbowIK|handIK)/,PART={up:{},lo:{}};
function partClip(name,part){
  const c=PART[part][name];if(c)return c;const src=CLIP[name];if(!src)return null;
  return PART[part][name]=new THREE.AnimationClip(name+'|'+part,src.duration,src.tracks.filter(t=>UPPER.test(t.name)===(part==='up')));
}
// The upper body's own clip, over whatever the legs do (a swing, a guard).
function playUp(a,name,o={}){
  const clip=partClip(name,'up');if(!a.mixer||!clip)return null;
  const act=a.acts[name+'|up']||(a.acts[name+'|up']=a.mixer.clipAction(clip));act.timeScale=o.speed||1;
  if(a.up===act&&!o.restart)return act;
  if(a.up&&a.up!==act)a.up.fadeOut(o.fade??.08);
  act.reset();act.setLoop(o.once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);act.clampWhenFinished=!!o.once;act.fadeIn(o.fade??.08);act.play();
  a.up=act;a.upName=name;return act;
}
function stopUp(a,fade=.14){if(a.up){a.up.fadeOut(fade);a.up=null;a.upName='';}}
// Walking, running, sidestepping or backing away, by how the body truly moves (vx, vz: world units a second) against
// the way it faces. Picks the clip whose own ground speed is nearest, and plays it at the rate that plants the feet.
// part 'lo': the legs alone (the upper body is doing something else). Returns false when it is standing.
function loco(a,vx,vz,part){
  const sp=Math.hypot(vx,vz);if(sp<.5)return false;
  const g=gaitOf(a),rel=angDiff(Math.atan2(vx,vz),a.face),ar=Math.abs(rel);
  const set=ar<1?FWD:ar>2.2?['Walking_Backwards']:[rel>0?'Running_Strafe_Left':'Running_Strafe_Right'];
  // nearest in pace; hurried legs look sillier than slow ones, so a clip that must be sped up counts as a worse fit
  // (a huge thing runs in slow motion rather than patter along); it keeps the clip it has unless another fits clearly better
  let best=null,bc=1e9;for(const c of set){if(!g[c])continue;const r=sp/g[c],cost=Math.abs(Math.log(r))*(r>1.25?1.4:1)*(a.gaitClip===c?.75:1);if(cost<bc){bc=cost;best=c;}}
  if(!best)return false;a.gaitClip=best;
  play(a,best,{speed:clamp(sp/g[best],.5,(best==='Walking_Backwards'?2:1.6)/Math.min(1,a.root.scale.x)),fade:.16,part,sync:true});return true;   // (small things may scuttle; backing off is quick short steps)
}
function play(a,name,o={}){
  const clip=o.part?partClip(name,o.part):CLIP[name];if(!a.mixer||!clip)return null;
  const key=o.part?name+'|'+o.part:name,act=a.acts[key]||(a.acts[key]=a.mixer.clipAction(clip));
  act.timeScale=o.speed||1;
  if(a.cur===act&&!o.restart)return act;
  act.reset();act.setLoop(o.once?THREE.LoopOnce:THREE.LoopRepeat,Infinity);act.clampWhenFinished=!!o.once;act.play();
  if(o.sync&&a.cur&&a.gaitOn)act.time=a.cur.time/a.cur.getClip().duration*clip.duration;   // one stride into another, in step
  if(a.cur&&a.cur!==act)act.crossFadeFrom(a.cur,o.fade??.15,false);
  a.cur=act;a.curName=key;a.gaitOn=!!o.sync;return act;
}
const turn=(a,to,dt,k=14)=>{a.face+=angDiff(to,a.face)*Math.min(1,k*dt);a.root.rotation.y=a.face;};
const faceOf=ang=>Math.atan2(Math.cos(ang),Math.sin(ang));   // a game angle as the model's turn (models face +z)
function flash(a,on,col,k=.9){for(const m of a.mats){const b=m.userData.base;if(!b||!b[0])continue;
  if(on){m.emissive.set(col||'#ffffff');m.emissiveIntensity=k;}else if(m.emissiveIntensity!==b[1]||!m.emissive.equals(b[0])){m.emissive.copy(b[0]);m.emissiveIntensity=b[1];}}}

// When a clip's blow lands: the moment the weapon hand moves fastest (measured once per clip, on whoever asks first).
const HITT=new Map();
function hitT(a,name){
  if(HITT.has(name))return HITT.get(name);const clip=CLIP[name],h=bone(a.root,'handslot.r')||bone(a.root,'hand.r');
  if(!clip||!a.mixer||!h){return clip?clip.duration*.4:.3;}
  a.mixer.stopAllAction();const act=a.mixer.clipAction(clip);act.reset();act.play();
  const N=60,D=clip.duration,inv=new THREE.Matrix4(),v=new THREE.Vector3(),pts=[];
  for(let i=0;i<=N;i++){act.time=Math.min(D*i/N,D-1e-4);upd(a,0);a.root.updateMatrixWorld(true);inv.copy(a.root.matrixWorld).invert();h.getWorldPosition(v).applyMatrix4(inv);pts.push([v.x,v.y,v.z]);}
  let best=0,bi=N>>1;for(let i=2;i<N-1;i++){const d=Math.hypot(pts[i+1][0]-pts[i-1][0],pts[i+1][1]-pts[i-1][1],pts[i+1][2]-pts[i-1][2]);if(d>best){best=d;bi=i;}}
  act.stop();a.mixer.stopAllAction();a.cur=null;a.curName='';a.up=null;
  const t=D*bi/N;HITT.set(name,t);return t;
}
// Each skill's own motion. [clip, speed, lead]: lead is how long before the clip's blow it starts (skills land at once,
// so the body is already most of the way through the swing when the effect shows).
const SKILL_ANIM={circle:['2H_Melee_Attack_Spin',1.5,.16],sunder:['2H_Melee_Attack_Chop',1.3,.14],pierce:['2H_Melee_Attack_Stab',1.2,.1],storm:['2H_Melee_Attack_Stab',1.9,.07],
  heavy:['2H_Melee_Attack_Chop',1,.3],riposte:['Block_Attack',1.3,.3],double:['Dualwield_Melee_Attack_Slice',1.4,.12],cuts:['Dualwield_Melee_Attack_Stab',2.2,.06],dance:['Dualwield_Melee_Attack_Chop',1.8,.08],
  blink:['Dualwield_Melee_Attack_Chop',1.3,.1],vortex:['2H_Melee_Attack_Spinning',1.6,.15],viper:['Dualwield_Melee_Attack_Stab',1.2,.12],quake:['1H_Melee_Attack_Jump_Chop',1.3,.14],
  volley:['2H_Ranged_Shoot',1.3,.1],lightarrow:['2H_Ranged_Shoot',1.3,.1],caustic:['2H_Ranged_Shoot',1.3,.1],split:['2H_Ranged_Shoot',1.3,.1],tornado:['2H_Ranged_Shoot',1.1,.12],rain:['2H_Ranged_Shoot',1,.15],
  fireball:['Spellcast_Shoot',1.3,.14],frostbolt:['Spellcast_Shoot',1.5,.12],arc:['Spellcast_Shoot',1.5,.12],smite:['Spellcast_Shoot',1.3,.14],
  icenova:['Spellcast_Raise',1.4,.2],heal:['Spellcast_Raise',1.3,.25],renewal:['Spellcast_Raise',1.3,.25],aegis:['Spellcast_Raise',1.3,.25],guard:['Block_Attack',1,.4],
  meteor:['Spellcast_Long',1.4,.5],blizzard:['Spellcast_Long',1.4,.5],judgement:['Spellcast_Long',1.4,.5],partyheal:['Spellcast_Long',1.5,.5],massheal:['Spellcast_Long',1.5,.5],resurrect:['Spellcast_Long',1.2,.6],
  raise:['Spellcast_Summon',1.3,.4],revive:['Spellcast_Summon',1.3,.4],pool:['Spellcast_Summon',1.4,.3],cry:['Taunt_Longer',1.6,.3],challenge:['Taunt_Longer',1.6,.3],berserk:['Taunt_Longer',1.6,.3],
  smoke:['Throw',1.4,.2],deathmark:['Throw',1.4,.2],ballista:['Throw',1.2,.25],vanish:['Dodge_Backward',1.5,.1]};
// The Gate Warden's moves (js/sim/warden.js: e.act, since e.actAt, landing after e.actD, facing e.aimA).
// timed: the clip is drawn out so its blow lands exactly when the rules say (raise, hold, strike).
const WACT={sweep:{c:'2H_Melee_Attack_Slice',timed:1},back:{c:'1H_Melee_Attack_Slice_Horizontal',timed:1},cleave:{c:'2H_Melee_Attack_Chop',timed:1},whirl:{c:'2H_Melee_Attack_Spinning',timed:1,loop:1},
  leap:{c:'1H_Melee_Attack_Jump_Chop',timed:1},brace:{c:'Blocking'},charge:{c:'Running_B',sp:1.7},summon:{c:'Spellcast_Summon'},chains:{c:'Spellcast_Raise',sp:.8},vanish:{c:'Spellcast_Raise',sp:1.6},
  appear:{c:'Idle_Combat'},roar:{c:'Taunt_Longer',sp:.75},reel:{c:'Hit_B',sp:.6},
  bash:{c:'Block_Attack',timed:1},volley:{c:'Throw',timed:1},spikes:{c:'Spellcast_Long',sp:.9},slam:{c:'1H_Melee_Attack_Jump_Chop',timed:1}};   // (the Bone Regent's own)
function animWarden(a,e,dt,nx,nz){
  const W=e.act==='reel'&&!(e.stun>0)?null:WACT[e.act],age=G.time-(e.actAt||0),D=Math.max(.05,e.actD||.3);let y=0,alpha=e.echo&&Math.sin(G.time*1.7+e.id)>.93?.35:1;   // (the echo flickers, now and then: the tell)
  a.root.visible=!e.gone;
  if(W){turn(a,faceOf(e.aimA||0),dt,e.act==='charge'?30:9);
    if(a.wAct!==e.act||a.wAt!==e.actAt){a.wAct=e.act;a.wAt=e.actAt;a.wHit=W.timed?hitT(a,W.c):0;stopUp(a,.05);const c=play(a,W.c,{once:!!W.timed,restart:true,speed:W.sp||1,fade:.12});if(c&&W.timed)c.timeScale=0;}
    if(W.timed&&a.cur){const u=clamp(age/D,0,1),f=u<.8?.6*(u/.8)*(u/.8)*(3-2*u/.8):.6+.4*((u-.8)/.2)**2,dur=a.cur.getClip().duration;
      let t=age<D?a.wHit*f:a.wHit+(age-D)*1.1;if(W.loop&&t>dur-.05)t=a.wHit*.6+((t-a.wHit*.6)%(dur-a.wHit*.6-.05));a.cur.time=Math.min(t,dur-.02);}
    if(e.act==='leap'&&age<D){const u=clamp((age/D-.25)/.75,0,1);y=Math.sin(u*Math.PI)*4.2;}
    if(e.act==='vanish')alpha=1-clamp(age/D,0,1);else if(e.act==='appear')alpha=clamp(age/D,0,1);
    if(e.act==='cleave'&&age<D){const u=age/D,b=bone(a.root,'handslot.r');if(b){b.getWorldPosition(tmpV);glow(tmpV.x,tmpV.y+.6,tmpV.z,'#fff3c0',.6+2.4*u,.35+.5*u);DLIGHTS.push({x:tmpV.x,y:tmpV.y,z:tmpV.z,col:'#ffe9a8',int:30*u,dist:10,pri:9});}}
    a.root.rotation.x=e.act==='charge'?.28:e.act==='brace'?-.1:0;
  }else{a.wAct=null;a.root.rotation.x=0;
    if(e.guard!==undefined)turn(a,faceOf(e.aimA||0),dt,10);   // (the Regent faces where its shield does: no faster than the rules turn it)
    if(e.guard&&!(e.stun>0)){playUp(a,'Blocking',{fade:.15});}else if(a.up)stopUp(a,.15);
    if(e.stun>0||e.staggerT>0)play(a,'Hit_B',{speed:.6,fade:.1});
    else if(!loco(a,a.vx,a.vz,e.guard?'lo':undefined)){const t=nearestHero(e);if(e.guard===undefined&&t&&G.bossAwake)turn(a,Math.atan2(wx(t.x)-nx,wz(t.y)-nz),dt,6);play(a,G.bossAwake?'Idle_Combat':'Idle',{fade:.25});}
    else if(e.guard===undefined&&Math.hypot(a.vx,a.vz)>.4)turn(a,Math.atan2(a.vx,a.vz),dt,8);
  }
  if(e.shield===false&&!a.noShield){a.noShield=true;const hs=bone(a.root,'handslot.l');if(hs)hs.visible=false;}   // the shield has shattered
  else if(e.shield!==false&&a.noShield){a.noShield=false;const hs=bone(a.root,'handslot.l');if(hs)hs.visible=true;}
  if((e.stun>0||e.staggerT>0)&&Math.random()<.5)glow(nx+rand(-1,1),4.6+rand(-.3,.3),nz+rand(-.6,.6),'#ffe9a8',.5,.8);   // reeling: stars about its head
  a.root.position.y=y;fade(a,alpha);
  const hit=e.flash>0;flash(a,hit||e.immune||e.enraged,hit?'#ffffff':e.immune?'#3fd0c0':'#ff3020',hit?.9:e.immune?.5:.25+.15*Math.sin(G.time*9));
  a.root.rotation.z=0;   // (the recoil adds to the pose: it must start from upright every frame)
  recoil(a,e,.35);
  upd(a,dt);
}
// A blow shows on the one struck: knocked along the blow and bent back by it for a moment (e.hitA, e.hitW, e.hitAt).
function recoil(a,e,k=1){
  const age=G.time-(e.hitAt??-9);if(!(age>=0&&age<.2)||!e.hitW)return;
  const u=Math.sin(age/.2*Math.PI),w=Math.min(2.6,e.hitW)*k,dx=Math.cos(e.hitA),dz=Math.sin(e.hitA),f=dx*Math.sin(a.face)+dz*Math.cos(a.face),r=dx*Math.cos(a.face)-dz*Math.sin(a.face);
  a.root.position.x+=dx*u*.14*w;a.root.position.z+=dz*u*.14*w;a.root.rotation.x+=f*u*.22*w;a.root.rotation.z+=-r*u*.22*w;
}

// A player: you, or someone in your party online. wt: their weapon type.
// sp: what they wear and how they look (heroSpec); the model is rebuilt when any of it changes.
const heroSpec=pl=>pl&&pl.other?(pl.spec||{}):{look:S.char.look,armor:S.equip.armor&&{type:S.equip.armor.type,tint:S.equip.armor.tint},boots:S.equip.boots&&{type:S.equip.boots.type}};
const specKey=sp=>{const l=sp.look||{},a=sp.armor||{},b=sp.boots||{};return[a.type,a.tint,b.type,l.skin,l.hair,l.style,l.eyes].join(',');};
function heroActor(id,wt,sp={}){
  const h=HERO[wt]||HERO.sword,key='hero:'+wt+':'+specKey(sp);let a=ACTORS.get(id);
  if(a&&a.key!==key){dropActor(a);a=null;}
  if(!a){a=makeActor(key,Object.assign({xray:'#f0cf7a',hero:sp},h));ACTORS.set(id,a);}
  return a;
}
// What skills leave on a player: an Aegis (a pale shield around them), an empowered weapon (a gold glow in hand),
// healing over time (green motes rising)
function auras(pl){
  if(pl.dead)return;const x=wx(pl.x),z=wz(pl.y),t=performance.now()/1000;
  if(pl.shield>0){ring(x,z,.95,'#cfe4ff',.55+.2*Math.sin(t*4),.08);glow(x,1.4,z,'#cfe4ff',1.6,.18);}
  if(pl.emp){const a=typeof pl.aim==='number'?pl.aim:0;glow(x+Math.cos(a)*.7,1.3,z+Math.sin(a)*.7,'#ffe9a8',.9,.6+.2*Math.sin(t*9));}
  if(pl.hot){for(let i=0;i<3;i++){const k=(t*.8+i/3)%1;glow(x+Math.cos(i*2.1)*.5,.3+k*2.4,z+Math.sin(i*2.1)*.5,'#9be08a',.35,(1-k)*.7);}}
}
// How an actor truly moves, from where it was a frame ago: its velocity (world units a second, smoothed), and from
// that the lean of its body: forward as it gathers speed, back as it brakes, into a turn. What loco() walks by.
function motion(a,nx,nz,dt){
  if(a.px==null||dt<=0||Math.hypot(nx-a.px,nz-a.pz)>4){a.px=nx;a.pz=nz;a.vx=a.vz=0;a.sp=0;a.fwd=0;a.lean=a.roll=0;a.pface=a.face;return;}   // just made, or it jumped (a door, a blink)
  const k=Math.min(1,16*dt);a.vx+=((nx-a.px)/dt-a.vx)*k;a.vz+=((nz-a.pz)/dt-a.vz)*k;a.px=nx;a.pz=nz;a.sp=Math.hypot(a.vx,a.vz);
}
function lean(a,dt){
  const f=a.vx*Math.sin(a.face)+a.vz*Math.cos(a.face),acc=(f-(a.fwd||0))/Math.max(dt,1e-3),spin=angDiff(a.face,a.pface??a.face)/Math.max(dt,1e-3);a.fwd=f;a.pface=a.face;
  // the sprint clip pitches the whole body forward by itself, more than reads well from above: most of that is taken back
  const k=Math.min(1,7*dt),sprint=a.sp>.5&&a.gaitClip==='Running_C'&&a.curName.startsWith('Running_C')?-.11:0;
  a.lean+=(clamp(acc*.005,-.09,.09)+sprint-a.lean)*k;a.roll+=(clamp(-spin*.022,-.1,.1)*Math.min(1,a.sp/3)-a.roll)*k;
  a.root.rotation.x=a.lean;a.root.rotation.z=a.roll;
}
function animHero(a,pl,wt,dt){
  const h=HERO[wt]||HERO.sword,nx=wx(pl.x),nz=wz(pl.y);motion(a,nx,nz,dt);a.root.position.set(nx,0,nz);a.root.visible=pl.x>-900;
  if(pl.dead){stopUp(a,.05);a.root.rotation.x=a.root.rotation.z=0;if(a.curName!=='Death_A')play(a,'Death_A',{once:true,fade:.1});upd(a,dt);return;}
  // Facing: toward the mouse's aim only while fighting (a swing, a block, a skill just cast, and a moment after);
  // otherwise the way you run, so running reads as running. Without an aim (touch), the four-way facing.
  const aim=typeof pl.aim==='number'?pl.aim:DIR_ANGLE[pl.dir||0],sw=pl.swing;
  let cast=0;if(pl.cds)for(const k in pl.cds){const v=pl.cds[k]||0;if(v>((a.cdSeen||{})[k]||0)+.05)cast=1;}a.cdSeen=Object.assign({},pl.cds||{});
  if(sw||pl.blocking||pl.parrying||cast)a.fight=.5;else a.fight=(a.fight||0)-dt;
  if(a.sp>1.2&&(pl.moving||pl.dash))a.run=Math.atan2(a.vz,a.vx);   // (a game angle: x east, y south)
  let ang=a.fight>0||a.run==null?aim:a.run;
  // (nobody sprints backward: in the moment after a cast, still at a run and heading away from the aim, you look where you run)
  if(a.fight>0&&!sw&&!pl.blocking&&!pl.parrying&&a.run!=null&&a.sp>(gaitOf(a).Running_Strafe_Left||4.5)*1.3&&Math.abs(angDiff(aim,a.run))>1.9)ang=a.run;
  // a skill just used: its own motion, begun just before its blow
  if(pl.castAt!=null&&pl.castAt!==a.castSeen){const first=a.castSeen===undefined;a.castSeen=pl.castAt;const K=SKILL_ANIM[pl.castId];
    if(K&&!first&&G.time-pl.castAt<.3&&CLIP[K[0]]){const ht=hitT(a,K[0]),t0=Math.max(0,ht-K[2]*K[1]);a.fight=.6;a.lock=(CLIP[K[0]].duration-t0)/K[1]*.8;a.atk=K[0];a.atkSp=K[1];a.atkNew=true;
      const u=playUp(a,K[0],{once:true,restart:true,fade:.05,speed:K[1]});if(u)u.time=t0;a.swT=sw?sw.t:-1;}}
  if(sw){ang=sw.a??aim;if(a.swT<0||sw.t<a.swT-1e-3){   // a new swing: the arms take it at once, whatever the legs are doing
      const clip=h.atk[(a.n++)%h.atk.length],dur=Math.max(.36,sw.d*2.4);a.lock=dur*.85;a.atk=clip;a.atkSp=CLIP[clip].duration/dur;a.atkNew=true;
      playUp(a,clip,{once:true,restart:true,fade:.06,speed:a.atkSp});}
    a.swT=sw.t;}else a.swT=-1;
  a.lock-=dt;
  turn(a,faceOf(ang),dt);
  const moving=a.sp>.7&&(pl.moving||Math.abs(pl.kx||0)+Math.abs(pl.ky||0)>1);
  const leaping=pl.dash&&(pl.dash.leap||pl.dash===2);a.leapT=leaping?(a.leapT||0)+dt:0;
  if(leaping){   // Leap Slam: up and over, the axe coming down as you land
    stopUp(a,.05);a.atk=null;const act=play(a,'1H_Melee_Attack_Jump_Chop',{once:true,fade:.05}),u=clamp(a.leapT/.32,0,1);
    if(act)act.timeScale=0,act.time=hitT(a,'1H_Melee_Attack_Jump_Chop')*(.25+.75*u);a.root.position.y=Math.sin(u*Math.PI)*1.7;a.lock=.25;a.atk='1H_Melee_Attack_Jump_Chop';a.atkSp=1.1;a.landed=1;}
  else if(pl.dash){   // the dodge, the way it goes against the way you face
    stopUp(a,.05);a.atk=null;const D=pl.dash,rel=angDiff(Math.atan2(D.vx,D.vy),a.face),ar=Math.abs(rel);
    play(a,ar<.8?'Dodge_Forward':ar>2.35?'Dodge_Backward':rel>0?'Dodge_Left':'Dodge_Right',{once:true,speed:1.6,fade:.08});}
  else if(pl.restT>0&&!moving){stopUp(a,.15);a.atk=null;a.lock=0;play(a,'Sit_Floor_Idle',{fade:.3});}   // resting by a fire
  else if(a.landed&&a.lock>0){if(a.cur)a.cur.timeScale=1.1;}   // the landing plays out
  else if(a.lock>0&&a.atk){   // swinging: the legs keep running under it if you move, else the whole body swings
    a.landed=0;if(!(moving&&loco(a,a.vx,a.vz,'lo'))){const was=a.cur,act=play(a,a.atk,{part:'lo',once:true,speed:a.atkSp,fade:.1,restart:a.atkNew});
      if(act&&(a.atkNew||was!==act))act.time=a.up?a.up.time:0;}
    a.atkNew=false;}
  else{a.atk=null;a.landed=0;
    if(pl.blocking||pl.parrying){   // the guard stays up while the legs walk
      if(moving&&loco(a,a.vx,a.vz,'lo'))playUp(a,'Blocking',{fade:.08});else{stopUp(a,.08);play(a,'Blocking',{fade:.06});}}
    else{stopUp(a);if(!(moving&&loco(a,a.vx,a.vz)))play(a,h.idle||'Idle',{fade:.18});}
  }
  const tw=a.up&&a.curName.endsWith('|lo')&&a.curName.startsWith('Running_Strafe_')?(a.curName.includes('Left')?-1.01:1.01):0;a.twist=(a.twist||0)+(tw-(a.twist||0))*Math.min(1,12*dt);if(Math.abs(a.twist)<.01)a.twist=0;
  lean(a,dt);
  flash(a,pl.inv>0&&!pl.dash&&Math.floor(G.time*12)%2,'#ff3a2a',.3);
  upd(a,dt);
}

// An enemy: picks its model and its clip from its state.
function foeDef(e){return FOE[e.boss?e.sprite:e.type]||FOE.skel;}
function foeActor(e){
  let a=ACTORS.get('e'+e.id);if(a)return a;
  const d=foeDef(e),T_=ETYPES[e.type]||{},key=(e.boss?e.sprite:e.type)+(e.elite?'*':'');
  const eyes=e.boss?'#ff3b2a':e.elite?'#ffd45c':T_.eye;
  a=makeActor(key,Object.assign({},d,{eyes,rim:true,xray:'#e0503f',s:(d.s||1)*(e.elite?1.12:1)}));ACTORS.set('e'+e.id,a);
  a.x=wx(e.x);a.z=wz(e.y);a.face=Math.random()*TAU;
  // something that arrived after the floor was built climbs out of the ground (raised, called, summoned)
  if(performance.now()-FLOOR.born>1500&&!d.orb&&!d.prop&&!d.bloom&&!e.boss&&!e.echo)play(a,'Skeletons_Awaken_Floor',{once:true,speed:1.6}),a.lock=1.1;
  return a;
}
const ATK=d=>d.two?'2H_Melee_Attack_Chop':'1H_Melee_Attack_Chop';
function animFoe(a,e,dt){
  const d=a.o,nx=wx(e.x),nz=wz(e.y),mx=nx-a.x,mz=nz-a.z,moved=Math.hypot(mx,mz)/Math.max(dt,1e-3);
  a.x=nx;a.z=nz;let y=0;motion(a,nx,nz,dt);
  if(d.orb){y=Math.sin(G.time*3+(e.ph||0))*.18;   // it drifts, and its flame licks upward
    a.root.userData.flame.forEach((f,i)=>{f.position.x=Math.sin(G.time*7+i*1.7)*.06*(i+1);f.material.opacity=(.45-i*.1)*(.75+.25*Math.sin(G.time*11+i));});}
  a.root.position.set(nx,y,nz);
  if(e.act!==undefined&&a.mixer){animWarden(a,e,dt,nx,nz);return;}
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
  else if(!loco(a,a.vx,a.vz))play(a,st==='idle'?'Idle':'Idle_Combat',{fade:.25});   // walking, running, or backing off, in step with the ground
  lean(a,dt);
  recoil(a,e,e.boss?.35:e.elite?.7:1);
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
const P_CROP=pool(()=>{const m=new THREE.Mesh(new THREE.ConeGeometry(.16,.5,6),new THREE.MeshStandardMaterial({color:'#3d6b30',roughness:.8}));m.castShadow=true;return m;});
const P_SIGN=pool(()=>{const g=new THREE.Group(),w=new THREE.MeshStandardMaterial({color:'#5a3f26',roughness:1}),pp=new THREE.MeshStandardMaterial({color:'#d9c9a0',roughness:1});
  const p=new THREE.Mesh(new THREE.BoxGeometry(.12,1.2,.12),w);p.position.y=.6;const b=new THREE.Mesh(new THREE.BoxGeometry(.9,.5,.06),pp);b.position.y=1.1;g.add(p,b);return g;});
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
const DONUTS=new Map(),P_DONUT=pool(ground(unitRing,{c:'#ff2a1a',o:.25}));
function donut(x,z,r,k,col,op){const g=take(P_DONUT),key=Math.round(k*50);if(!DONUTS.has(key))DONUTS.set(key,new THREE.RingGeometry(key/50,1,64));
  g.userData.m.geometry=DONUTS.get(key);g.position.set(x,.08+op*.01,z);g.scale.setScalar(Math.max(r,.01));g.userData.m.material.color.set(col);g.userData.m.material.opacity=op;return g;}
function lane(x,z,a,len,w,col,op,h=1.1){const g=take(P_LANE);g.position.set(x,h,z);g.rotation.y=-a;g.scale.set(Math.max(len,.01),1,w);g.userData.m.material.color.set(col);g.userData.m.material.opacity=op;return g;}
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
  const now=performance.now(),dt=me.fixedDt??Math.min(.05,lastT?(now-lastT)/1000:0);lastT=now;   // (fixedDt: a test steps the drawing by hand)
  const F=FLOOR,t=G.time;
  // the camera: high in the south, looking down at you. Wider screens see more; tall ones step back.
  const px=wx(P.x),pz=wz(P.y),tgt=tmpV.set(px,.8,pz);
  if(camT.lengthSq()===0||camT.distanceTo(tgt)>30)camT.copy(tgt);else camT.lerp(tgt,Math.min(1,dt*9));
  const pitch=55*Math.PI/180,need=30/(2*Math.tan(15*Math.PI/180)*camera.aspect),dist=clamp(Math.max(17,need*.56),14,64)*zoom;   // (close enough to read a face and a coat)
  const sh=G.shake?G.shake*.03:0;
  camera.position.set(camT.x+rand(-sh,sh),camT.y+dist*Math.sin(pitch),camT.z+dist*Math.cos(pitch));camera.lookAt(camT.x,camT.y,camT.z);
  // the moon's shadows follow you; snapped to its texels so they do not shimmer
  const snap=52/2048;moon.target.position.set(Math.round(camT.x/snap)*snap,0,Math.round(camT.z/snap)*snap);moon.position.set(moon.target.position.x-18,40,moon.target.position.z-6);
  CUT.value.set(px,0,pz);
  if(FLOOR.areas){const k=areaKey(P);if(k!==FLOOR.areaK)indoors(k);}
  lantern.position.set(px,5,pz+1.2);lantern.intensity=MOOD.village?6:P.dead?6:24;
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
  const mine=heroActor('me',wt,heroSpec(P));seenIds.add('me');animHero(mine,P,wt,dt);auras(P);
  if(!P.dead){ring(px,pz,.75,'#e9c87a',.35,.06);disc(px,pz,.75,'#e9c87a',.06);   // a faint ring under you, so you never lose yourself in a crowd
    disc(px+Math.cos(P.aim)*.98,pz+Math.sin(P.aim)*.98,.13,'#ffe9a8',.55);}   // and a mark on it where you aim
  bagMesh();
  if(NET.on)for(const q of NET.others){if(q.x<-900||(FLOOR.areas&&areaKey(q)!==FLOOR.areaK))continue;const a=heroActor('p'+q.id,q.wtype||'sword',heroSpec(q));seenIds.add('p'+q.id);animHero(a,q,q.wtype||'sword',dt);auras(q);
    DLIGHTS.push({x:wx(q.x),y:3.2,z:wz(q.y),col:'#ffe2b8',int:14,dist:11,pri:2});}
  // enemies near enough to matter
  const reachX=dist*.27*camera.aspect+5,reachZ=dist*.62+4;   // about what the camera sees, and a little more
  for(const e of G.enemies){if(Math.abs(wx(e.x)-camT.x)>reachX||Math.abs(wz(e.y)-camT.z)>reachZ)continue;
    const a=foeActor(e);seenIds.add('e'+e.id);a.last=e;a.seen=now;animFoe(a,e,dt);
    if(a.o.orb)DLIGHTS.push({x:a.x,y:1.4,z:a.z,col:a.o.orb,int:3,dist:5,pri:0});
    if(e.boss&&!e.gone)DLIGHTS.push({x:a.x,y:5.5*(a.o.s||1)/2.7,z:a.z+1,col:e.guard!==undefined?'#ffd890':e.phase>1?'#40c0b0':'#ff3020',int:e.guard!==undefined?22:40,dist:16,pri:9});
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
  for(const[q,col,hi]of[[G.home,G.village?'#6fd6e6':'#e2b93b',G.village?'#c8f3fa':'#f5e2a8'],[G.gate,'#6fd6e6','#c8f3fa']]){if(!q)continue;const x=wx(q.x),z=wz(q.y),pu=Math.sin(t*3)*.08,k=G.village&&q===G.home?2.2:1;
    ring(x,z,(1.5+pu)*k,col,.9);ring(x,z,1.05*k,hi,.6);disc(x,z,1.5*k,col,.18);glow(x,.4,z,col,3.6*k,.55);
    const b=take(P_BEAM);b.position.set(x,0,z);b.scale.set(6,1.4,6);b.material.color.set(col);b.material.opacity=.18+.05*Math.sin(t*4);
    DLIGHTS.push({x,y:1.2,z,col,int:16,dist:9,pri:4});}
  // the fields: each plot's crops as this player has them, by how far they have grown
  if(G.village&&typeof myPlot==='function'){const now=Date.now();VILLAGE.plots.forEach(([px,py],i)=>{const p=myPlot(i);
    if(!p){const sg=take(P_SIGN);const[X,Z]=VT(px+1.5,py+1);sg.position.set(X,0,Z);return;}
    if(!p.crop)return;const g=cropGrowth(p,now),glowy=p.crop==='glowcap',ready=g>=1;
    for(let r=0;r<2;r++)for(let c=0;c<5;c++){const m=take(P_CROP);const[X,Z]=VT(px+.35+c*.58+(r%2)*.25,py+.6+r*.8);const h=.15+g*.75;
      m.position.set(X,h/2,Z);m.scale.set(.6+g*.6,h/.5,.6+g*.6);m.material.color.set(glowy?'#4a8a8a':'#3d6b30');m.material.emissive.set(glowy?'#3ff0c0':'#000000');m.material.emissiveIntensity=glowy?(ready?1.4:.4):0;}
    if(ready){const[X,Z]=VT(px+1.5,py+1);glow(X,1.2,Z,glowy?'#7ff0d0':'#d9ffb0',2.2,.25+.1*Math.sin(t*3+i));}});}
  // telegraphs: red on the floor, filling as the blow comes
  for(const q of G.tele){const p=clamp(q.t/q.d,0,1),x=wx(q.x),z=wz(q.y);
    if(q.cone){for(const[r,op]of[[q.len,.18],[q.len*p,.32]]){const g=take(P_CONE);g.userData.m.geometry=sector(q.half);g.position.set(x,.08+op*.01,z);g.rotation.y=-q.a;g.scale.setScalar(wx(Math.max(r,.1)));g.userData.m.material.color.set('#ff2a1a');g.userData.m.material.opacity=op;}}
    else if(q.line){for(const[l,op]of[[q.len,.22],[q.len*p,.3]]){const g=take(P_LANE);g.position.set(x,.08+op*.01,z);g.rotation.y=-q.a;g.scale.set(wx(Math.max(l,.1)),1,wx(q.w?q.w*2:26));g.userData.m.material.color.set('#ff2a1a');g.userData.m.material.opacity=op;}}
    else if(q.inner){const R_=wx(q.r),k=q.inner/q.r;donut(x,z,R_,k,'#ff2a1a',.18);donut(x,z,R_,k,'#ff2a1a',.3*p);ring(x,z,R_,'#ff4a2a',.9);ring(x,z,wx(q.inner),'#ff4a2a',.7);}
    else{disc(x,z,wx(q.r),'#ff2a1a',.16);disc(x,z,wx(q.r)*p,'#ff2a1a',.3);ring(x,z,wx(q.r),'#ff4a2a',.9);}}
  // your side's skills that land later (Judgement): a gold mark that fills as the strike comes
  for(const q of G.pfx||[]){const p=clamp(q.t/q.d,0,1),x=wx(q.x),z=wz(q.y),r=wx(q.r||8),tt=performance.now()/1000;
    if(q.mark){const fire=q.k==='meteor';disc(x,z,r*p,fire?'#ff6a2a':'#d9b24a',.22);ring(x,z,r,fire?'#ff8a2a':'#e8c060',.45,.05);
      if(fire)orb(x,1+14*(1-p),z,'#ff8a2a',.5,30);continue;}
    if(!q.vis)continue;const fade=Math.min(1,(q.d-q.t)*2);
    if(q.k==='pool'){disc(x,z,r,'#5aa040',.3*fade);ring(x,z,r,'#8fe060',.5*fade);if(Math.random()<.3)glow(x+rand(-r,r)*.6,.2,z+rand(-r,r)*.6,'#8fe060',.3,.6);}
    else if(q.k==='rain'){ring(x,z,r,'#c3c0b0',.4*fade);disc(x,z,r,'#c3c0b0',.08*fade);}
    else if(q.k==='smoke'){for(let i=0;i<6;i++){const a=i*1.05+tt*.3;glow(x+Math.cos(a)*r*.5,.8+.3*Math.sin(tt+i),z+Math.sin(a)*r*.5,'#5a5a66',r*1.1,.45*fade);}disc(x,z,r,'#2a2a33',.4*fade);}
    else if(q.k==='blizzard'){disc(x,z,r,'#9fd8ff',.14*fade);ring(x,z,r,'#cfe8ff',.5*fade);for(let i=0;i<5;i++)glow(x+rand(-r,r)*.8,rand(.5,3),z+rand(-r,r)*.8,'#ffffff',.25,.8*fade);}
    else if(q.k==='vortex'){for(let i=0;i<4;i++){const a=tt*9+i*Math.PI/2;arc(x,z,1.1,r,.35,a,a+.7,'#cfe8ff',.8*fade);}}
    else if(q.k==='ballista'){const b=take(P_ARROW);b.position.set(x,.7,z);b.rotation.y=-(q.a||0);ring(x,z,r*1.5,'#c9a46a',.6);orb(x,.5,z,'#8a6a3a',.25,0);}
    else if(q.k==='minion'){glow(x,1.1,z,'#9be08a',1.4,.7*fade);orb(x,1.1,z,'#cfffc8',.18,8);ring(x,z,.45,'#9be08a',.5*fade);}
  }
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
    else if(p.k==='frost')orb(x,1.5,z,'#9fd8ff',.16,16);
    else if(p.k==='arrow'){const a=take(P_ARROW);a.position.set(x,1.4,z);a.rotation.y=-(p.a??Math.atan2(p.vy,p.vx));
      const c={light:'#8fd0ff',caustic:'#8fe060',split:'#e8e8f0',tornado:'#ffffff'}[p.f];if(c)glow(x,1.4,z,c,.8,.7);}
    else orb(x,1.5,z,'#b9a8ff',.11,6);}
  // what you can pick up: a gem of its colour, bobbing; good gear casts a beam
  for(const d of G.drops){if(d.owner!==P.id)continue;const m=take(P_GEM),x=wx(d.x),z=wz(d.y);
    const col=d.k==='shard'?'#6fd6e6':d.k==='mat'?(MATS[d.id]?MATS[d.id].color:'#cccccc'):SUPPLIES[d.k]?SUPPLIES[d.k].color:RARITY[d.item.rarity].color;
    m.position.set(x,.45+Math.sin(d.t*4)*.1,z);m.rotation.y=d.t*2;m.material.color.set(col);m.material.emissive.set(col);m.scale.setScalar(d.k==='shard'?.8:d.k==='item'?1.3:1);
    if(d.k==='item'&&d.item.rarity>=2){const b=take(P_BEAM);b.position.set(x,0,z);b.scale.set(1,1,1);b.material.color.set(col);b.material.opacity=.45;}}
  // effects
  for(const f of G.fx){const p=f.t/f.d,x=wx(f.x),z=wz(f.y),al=1-p*p;
    if(f.k==='slash'||f.k==='eslash'){const half=(f.arc||120)/2*Math.PI/180,r=wx(f.r);
      if(f.k==='slash'&&f.arc>=360){const a=f.a+p*TAU;arc(x,z,1.15,r,.5,a-2.6,a,f.c||'#bfe9ff',al);arc(x,z,1.2,r*.8,.25,a-1.6,a,'#ffffff',al*.7);}
      else if(f.k==='slash'){const s=Math.min(1,.3+p*1.6),a0=f.a+(f.dir>0?-half:half),a1=f.a+(f.dir>0?-half+2*half*s:half-2*half*s);arc(x,z,1.15,r,f.c?.7:.45,a0,a1,f.c||'#cfe8ff',al);
        if(f.c){arc(x,z,1.2,r*.86,.22,a0,a1,'#ffffff',al*.8);glow(x+Math.cos(a1)*r,1.2,z+Math.sin(a1)*r,f.c,1.6,al*.7);}}
      else if(f.big){const s=Math.min(1,p*1.5),d=f.dir<0?-1:1,a0=f.a-d*half,a1=a0+d*2*half*s,h=2.2;   // the Warden's blade: a wide red wake at its own height
        arc(x,z,h,r*.78,r*.44,a0,a1,f.c||'#ff9a7a',al*.75);arc(x,z,h+.05,r*.97,.3,a0,a1,'#ffffff',al);DLIGHTS.push({x:x+Math.cos(a1)*r*.8,y:h,z:z+Math.sin(a1)*r*.8,col:f.c||'#ff9a7a',int:30*al,dist:10,pri:8});}
      else arc(x,z,1.2,r,.35,f.a-1,f.a-1+2*Math.min(1,p*1.8),'#d9d4c4',al*.8);}
    else if(f.k==='hit'){const w=f.w||.5,cs=Math.cos(f.a),sn=Math.sin(f.a),h=1.25,k=1-p;   // a blow landing: a burst of light and streaks flying on along the blow
      glow(x,h,z,'#ffffff',(.25+.25*w)*(1+p),k*.45);glow(x,h,z,f.c,(.7+.6*w)*(1+p),k*.25);
      const n=Math.min(6,2+Math.round(w*1.5));for(let i=0;i<n;i++){const sp=((i*.618)%1-.5)*(1.3+.3*w),c2=Math.cos(f.a+sp),s2=Math.sin(f.a+sp),L=(.35+.5*w)*(.6+((i*.37)%1)*.6),r0=.2+p*L*1.4;
        line(u=>[x+c2*(r0+L*u*(1-p*.5)),h+(((i*.77)%1)-.4)*(.5+u*.8)*(1+p),z+s2*(r0+L*u*(1-p*.5))],i%2?'#ffffff':f.c,k*.8).material.color.multiplyScalar(.3);}
      if(w>=1){ring(x-cs*.2,z-sn*.2,(.4+.9*w)*(.3+p),f.c,k*.8,.14);DLIGHTS.push({x,y:h,z,col:f.c,int:7*w*k,dist:6,pri:7});}}
    else if(f.k==='thrust'){const L=wx(f.len)*Math.min(1,.4+p*(f.small?5:4)),c=f.c||'#cfe8ff',wd=f.big?.95:f.small?.3:.6,k=al,cs=Math.cos(f.a),sn=Math.sin(f.a);   // a lance of light down the line
      lane(x,z,f.a,L,wd*(1-p*.6),c,k*.55);lane(x,z,f.a,L,wd*.3*(1-p*.5),'#ffffff',k,1.14);
      glow(x+cs*L,1.15,z+sn*L,'#ffffff',f.small?.5:.9,k*.8);if(!f.small){glow(x+cs*L,1.15,z+sn*L,c,f.big?2.4:1.6,k*.4);
        for(const sd of[-1,1])line(u=>[x+cs*L*u-sn*sd*(wd*.5+.25*Math.sin(u*Math.PI)),1.15,z+sn*L*u+cs*sd*(wd*.5+.25*Math.sin(u*Math.PI))],c,k*.8);
        ring(x+cs*L*.3,z+sn*L*.3,.3+p*(f.big?2.2:1.4),c,k*.6,.14);DLIGHTS.push({x:x+cs*L*.6,y:1.2,z:z+sn*L*.6,col:c,int:9*k,dist:8,pri:6});}}
    else if(f.k==='cut'){const L=wx(f.len),c=f.c||'#e8f4ff',s=Math.min(1,.45+p*3),cs=Math.cos(f.a),sn=Math.sin(f.a),x0=x-cs*L/2,z0=z-sn*L/2;   // one cut across a body
      lane(x0,z0,f.a,L*s,.34*(1-p),c,al*.7,1.25);lane(x0,z0,f.a,L*s,.1,'#ffffff',al,1.28);glow(x0+cs*L*s,1.25,z0+sn*L*s,'#ffffff',.6,al*.7);}
    else if(f.k==='quake'){const r=wx(f.r),c=f.c||'#c9a46a',g=Math.min(1,.35+p*2.4),n=f.big?11:7;   // the floor breaks: cracks run out, dust rises
      disc(x,z,r*g,'#0a0806',(1-p)*.5);ring(x,z,r*Math.min(1.25,.3+p*1.6),c,al*.9,.12);ring(x,z,r*Math.min(1,.2+p*1.1),'#ffffff',al*.5,.13);
      for(let i=0;i<n;i++){const a=i/n*TAU+(f.x*.13+f.y*.07)%1,j1=((i*.618)%1-.5)*.5,j2=((i*.33)%1-.5)*.6,L=r*(.7+((i*.41)%1)*.55)*g;
        line(u=>[x+Math.cos(a+j1*u+j2*u*u)*L*u,.12,z+Math.sin(a+j1*u+j2*u*u)*L*u],c,al);}
      for(let i=0;i<n;i++){const a=i/n*TAU+1,rr=r*(.4+((i*.53)%1)*.6);glow(x+Math.cos(a)*rr,.3+p*(1.2+(i%3)*.6),z+Math.sin(a)*rr,'#8a7a66',.9+p*1.4,(1-p)*.45);}
      DLIGHTS.push({x,y:1,z,col:c,int:10*(1-p),dist:9,pri:7});}
    else if(f.k==='pillar'){const c=f.c||'#ffe9a8',r=wx(f.r),k=1-p;const b=take(P_BEAM);b.position.set(x,0,z);b.scale.set(r*6*(1-p*.5),4,r*6*(1-p*.5));b.material.color.set(c);b.material.opacity=k*.75;   // light from above
      glow(x,.6,z,'#ffffff',r*2.4,k);glow(x,3,z,c,r*3,k*.5);DLIGHTS.push({x,y:2,z,col:c,int:60*k,dist:16,pri:9});}
    else if(f.k==='glint'){const k=Math.sin(Math.min(1,p*1.2)*Math.PI),h=5.4;glow(x,h,z,'#ffffff',1+3*k,k);glow(x,h,z,'#ffe9a8',2+6*k,k*.5);   // the blade catches the light: parry this one
      for(let i=0;i<4;i++){const a=i*Math.PI/4+p*1.5,L=(i%2?1.2:2.4)*k;line(u=>[x+Math.cos(a)*L*(u*2-1),h+Math.sin(a)*L*(u*2-1),z],'#fff3c0',k);}}
    else if(f.k==='chain'){const L=wx(f.len),w=wx((f.w||10)*2),k=1-p,cs=Math.cos(f.a),sn=Math.sin(f.a);   // a chain tears along its lane
      lane(x,z,f.a,L,w*(1+p*.4),'#40d0b8',k*.5,.12);lane(x,z,f.a,L,w*.3,'#ffffff',k*.9,.14);
      line(u=>[x+cs*L*u-sn*Math.sin(u*40+p*20)*.25,.5+.5*Math.abs(Math.sin(u*31+p*9))*k,z+sn*L*u+cs*Math.sin(u*40+p*20)*.25],'#7fe0d0',k);
      for(let i=0;i<5;i++){const u=(i+.5)/5;glow(x+cs*L*u,.6+p,z+sn*L*u,'#7fe0d0',w*1.6,k*.4);}}
    else if(f.k==='frost'){const r=wx(f.r),g=Math.min(1,p*6),k=p>.7?(1-p)/.3:1;for(let i=0;i<12;i++){const a=i/12*TAU+.2,rr=r*(.55+(i%3)*.2),sp=take(P_SPIKE);   // ice stands where the nova passed
        sp.position.set(x+Math.cos(a)*rr,0,z+Math.sin(a)*rr);sp.scale.set(1.3,g*k*(1+(i%3)*.5),1.3);sp.material.color.set('#bfe6ff');sp.material.emissive.set('#3a7ab0');}
      disc(x,z,r,'#9fd8ff',.14*k);}
    else if(f.k==='line'){lane(x,z,f.a,wx(f.len)*Math.min(1,p*4),.5,'#cfe8ff',al*.6);}
    else if(f.k==='oldline'){const g=take(P_LANE);g.position.set(x,1.1,z);g.rotation.y=-f.a;g.scale.set(wx(f.len),1,f.w?.5:.18);g.userData.m.material.color.set('#cfe8ff');g.userData.m.material.opacity=al*.8;}
    else if(f.k==='ring'){ring(x,z,wx(f.r)*p,f.c||'#cfe8ff',al*.9,.15);}
    else if(f.k==='pulse'){ring(x,z,wx(f.r)*Math.min(1,.3+p*1.2),f.c||'#9be08a',al*.9,.15);}
    else if(f.k==='boom'){const r=wx(f.r)*Math.min(1,p*1.8),c=f.c||'#ff8a2a';disc(x,z,r,f.c||'#f08a3c',(1-p)*.45);ring(x,z,r,'#ffe9a8',al);glow(x,1,z,c,r*3,(1-p)*.8);DLIGHTS.push({x,y:1.5,z,col:c,int:40*(1-p),dist:14,pri:8});}
    else if(f.k==='heal'){const r=wx(6+(f.r-6)*Math.min(1,p*1.7));ring(x,z,r,'#9be08a',al);disc(x,z,r,'#9be08a',(1-p)*.2);   // where the heal lands
      for(let i=0;i<6;i++){const a=i*1.05+.4;glow(x+Math.cos(a)*.8,.4+p*2.6+(i%3)*.3,z+Math.sin(a)*.8,i%2?'#ffe9a8':'#9be08a',.5,al);}
      DLIGHTS.push({x,y:1.5,z,col:'#9be08a',int:20*(1-p),dist:9,pri:7});}
    else if(f.k==='spikes'){for(let i=0;i<8;i++){const a=i*.85,r=wx(3+(i%3)*6),s=take(P_SPIKE);s.position.set(x+Math.cos(a)*r,0,z+Math.sin(a)*r*.8);s.scale.set(1,(1-p)*(.9+(i%3)*.5),1);s.material.color.set('#d9d4c4');s.material.emissive.set('#000000');}}
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

// Your sleeping bag, once laid out: a rolled-out bedroll on the floor.
let BAG=null;
function bagMesh(){
  if(!BAG){BAG=new THREE.Group();const cloth=new THREE.MeshStandardMaterial({color:'#5b6b4a',roughness:.95}),roll=new THREE.MeshStandardMaterial({color:'#7d8a62',roughness:.95});
    const pad=new THREE.Mesh(new THREE.BoxGeometry(.9,.08,2),cloth);pad.position.y=.05;pad.receiveShadow=true;BAG.add(pad);
    const pil=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,.9,10),roll);pil.rotation.z=Math.PI/2;pil.position.set(0,.18,-.85);pil.castShadow=true;BAG.add(pil);scene.add(BAG);}
  BAG.visible=!!(P&&P.bag);if(BAG.visible)BAG.position.set(wx(P.bag.x),0,wz(P.bag.y));
}
// Where a point on the screen (in page pixels) falls on the floor, at about chest height so aiming at an enemy's body
// lands on it: game coordinates, or null.
const pickRay=typeof THREE==='undefined'?null:new THREE.Raycaster(),pickPlane=typeof THREE==='undefined'?null:new THREE.Plane(new THREE.Vector3(0,1,0),-.9),pickHit=typeof THREE==='undefined'?null:new THREE.Vector3();
me.pick=function(cx,cy){
  if(!canvas||canvas.hidden||!camera)return null;const r=canvas.getBoundingClientRect();if(r.width<2)return null;
  pickRay.setFromCamera({x:(cx-r.left)/r.width*2-1,y:-(cy-r.top)/r.height*2+1},camera);
  return pickRay.ray.intersectPlane(pickPlane,pickHit)?{x:pickHit.x/U,y:pickHit.z/U}:null;
};
// The other way: where a game position (at a height in world units) shows on the page, in page pixels, or null.
me.screenOf=function(x,y,h=1){if(!canvas||canvas.hidden||!camera)return null;const p=scr(wx(x),h,wz(y)),r=canvas.getBoundingClientRect();return p?{x:r.left+p[0]*r.width/VW,y:r.top+p[1]*r.height/VH}:null;};
/* ---------- the overlay: numbers, health bars and names, drawn flat over the 3D view ---------- */
const NUMCOL={crit:'#ffd45c',hurt:'#ff5a52',bleed:'#d0607a',heal:'#9be08a',evade:'#6fd6e6',mana:'#7fa8ff',resist:'#8e97b5',bane:'#f2a03c'};
function scr(x,h,z){tmpV.set(x,h,z).project(camera);return tmpV.z>1?null:[(tmpV.x+1)/2*VW,(1-tmpV.y)/2*VH];}
function overlay(){
  const c=octx;c.clearRect(0,0,VW,VH);c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';
  const label=(s,x,h,z,col,font)=>{const p=scr(x,h,z);if(!p)return;c.font=font;c.lineWidth=3;c.strokeStyle='rgba(0,0,0,.85)';c.strokeText(s,p[0],p[1]);c.fillStyle=col;c.fillText(s,p[0],p[1]);};
  const bar=(x,h,z,w,f,col,edge)=>{const p=scr(x,h,z);if(!p)return;const X=Math.round(p[0]-w/2),Y=Math.round(p[1]);
    c.fillStyle='#000';c.fillRect(X-2,Y-2,w+4,9);if(edge){c.fillStyle=edge;c.fillRect(X-1,Y-1,w+2,7);}c.fillStyle='#160b0b';c.fillRect(X,Y,w,5);c.fillStyle=col;c.fillRect(X,Y,Math.ceil(w*clamp(f,0,1)),5);};
  // under an enemy's health, its poise: worn down by blows; it flashes white while the enemy reels
  const poiseBar=(x,h,z,w,f,broken)=>{const p=scr(x,h,z);if(!p)return;const X=Math.round(p[0]-w/2),Y=Math.round(p[1])+8;
    c.fillStyle='#000';c.fillRect(X-1,Y-1,w+2,4);c.fillStyle=broken?(Math.floor(G.time*10)%2?'#ffffff':'#ffe9a8'):'#e8d9a8';c.fillRect(X,Y,Math.ceil(w*clamp(f,0,1)),2);};
  // enemy health, once hurt; elites and bosses by name
  for(const e of G.enemies){const a=ACTORS.get('e'+e.id);if(!a||e.burrowed)continue;const top=2.6*(a.o.s||1)*(e.elite?1.12:1);
    if(e.split&&!e.gone&&e.maxPoise)poiseBar(a.x,top+.3,a.z,90,e.staggerT>0?1:e.poise/e.maxPoise,e.staggerT>0);   // split: the true Warden is the one whose poise shows
    if(e.hurtT>0&&!e.boss&&!e.echo&&e.type!=='dummy'){const w=e.elite?74:58;bar(a.x,top,a.z,w,e.hp/e.maxHp,e.elite?'#e8b24a':'#d24b47',e.elite?'#7a6436':null);
      if(e.maxPoise)poiseBar(a.x,top,a.z,w,e.staggerT>0?1:e.poise/e.maxPoise,e.staggerT>0);}
    if(e.elite&&!e.boss&&hyp(e.x-P.x,e.y-P.y)<200)label((ETYPES[e.type].name||'')+', elite',a.x,top+.55,a.z,'#e9c87a','600 13px Cinzel,Georgia,serif');}
  // your party: name and health
  if(NET.on)for(const q of NET.others){if(q.x<-900||q.dead)continue;label(q.name||'',wx(q.x),PERSON_TOP+.8,wz(q.y),'#e9dfc8','600 13px Cinzel,Georgia,serif');bar(wx(q.x),PERSON_TOP+.45,wz(q.y),46,q.hp/q.maxHp,'#7fc24a');}
  // the people and things you can use, when you are near
  const near=(q,r=110)=>q&&hyp(q.x-P.x,q.y-P.y)<r;
  for(const q of[...(G.traders||[]),...(G.talkers||[]),...(G.guild?[G.guild]:[]),...(G.smiths||[]).filter(q=>q.name)])if(near(q,G.village?70:110)&&!(q.sayUntil>G.time))label(q.name||'Trader',wx(q.x),PERSON_TOP+.8,wz(q.y),'#e9c87a','600 13px Cinzel,Georgia,serif');
  // what a villager says when you talk to them: a box over their head
  for(const q of G.talkers||[])if(q.sayUntil>G.time){const p=scr(wx(q.x),PERSON_TOP+.7,wz(q.y));if(!p)continue;
    c.font="600 16px 'Cormorant Garamond',Georgia,serif";const words=String(q.line).split(' '),lines=[];let cur='';
    for(const w of words){if(c.measureText(cur+' '+w).width>260&&cur){lines.push(cur);cur=w;}else cur=cur?cur+' '+w:w;}lines.push(cur);
    const bw=Math.ceil(Math.max(...lines.map(l=>c.measureText(l).width)))+20,bh=lines.length*19+14,X=Math.round(p[0]-bw/2),Y=Math.round(p[1]-bh-6);
    c.globalAlpha=Math.min(1,(q.sayUntil-G.time)*2);c.fillStyle='rgba(14,11,8,.94)';c.fillRect(X,Y,bw,bh);c.strokeStyle='#7a6436';c.lineWidth=1;c.strokeRect(X+.5,Y+.5,bw-1,bh-1);
    c.fillStyle='#e9dfc8';c.textAlign='left';c.textBaseline='top';lines.forEach((l,i)=>c.fillText(l,X+10,Y+8+i*19));c.textAlign='center';c.textBaseline='middle';c.globalAlpha=1;}
  // the crowd indoors: now and then one of them says a line, in a bubble over their head
  if(FLOOR.areas&&FLOOR.areaK)for(const q of G.crowd||[]){if(areaKey(q)!==FLOOR.areaK)continue;const tt=(G.time+q.at)%q.every;if(tt>4.4)continue;
    const p=scr(wx(q.x),2.75,wz(q.y));if(!p)continue;const s=q.lines[Math.floor((G.time+q.at)/q.every)%q.lines.length],al=Math.min(1,tt/.25,(4.4-tt)/.4);q.sayUntil=G.time+.2;
    c.font='500 13px Georgia,serif';const w=c.measureText(s).width+16,X=Math.round(p[0]-w/2),Y=Math.round(p[1]-26);c.globalAlpha=al;
    c.fillStyle='rgba(20,14,10,.9)';c.beginPath();c.roundRect(X-1,Y-1,w+2,24,7);c.fill();c.fillStyle='#efe6d2';c.beginPath();c.roundRect(X,Y,w,22,6);c.fill();
    c.beginPath();c.moveTo(p[0]-5,Y+21);c.lineTo(p[0],Y+29);c.lineTo(p[0]+5,Y+21);c.fill();c.fillStyle='#2a1c12';c.textAlign='center';c.textBaseline='middle';c.fillText(s,p[0],Y+12);c.globalAlpha=1;}
  for(const q of G.stashes||[])if(near(q,80))label('Stash',wx(q.x),1.6,wz(q.y),'#e9c87a','600 13px Cinzel,Georgia,serif');
  if(near(G.home,90))label(G.village?'Teleport Gate':'Floor gate',wx(G.home.x),2.2,wz(G.home.y),'#f5e2a8','600 13px Cinzel,Georgia,serif');
  if(near(G.gate,120))label('The way up',wx(G.gate.x),2.2,wz(G.gate.y),'#c8f3fa','600 13px Cinzel,Georgia,serif');
  // the numbers
  for(const n of G.nums){const al=n.t>NUM_LIFE-.15?(NUM_LIFE-n.t)/.15:1;c.globalAlpha=clamp(al,0,1);
    const big=n.kind==='crit'?26:n.kind==='hurt'?18:20;label(n.v,wx(n.x),2.4+n.t*2.4,wz(n.y),NUMCOL[n.kind]||'#f3ead6',`700 ${big}px Cinzel,Georgia,serif`);}
  c.globalAlpha=1;
}

/* ---------- the traders in the tower ---------- */
// Traders stand in the start room and the safe rooms: hooded, idle, facing the room.
// Who the townsfolk look like, by name (the tower's traders are hooded); held: what is in their hands.
// (each is then dressed as the village made them: their own skin, hair and clothes, like a player: dress())
function npcLook(q){const L=npcModel(q);if(q.look)L.hero={look:q.look,armor:q.eq&&q.eq.armor,boots:{type:'boots'}};return L;}
function npcModel(q){const n=q.name||'';
  if(q.crowd)return{m:'Knight',hold:[]};
  if(/Blacksmith/.test(n))return{m:'Barbarian',hold:[]};
  if(/Innkeeper|Barkeep|Farmhand/.test(n))return{m:'Barbarian',hold:/Farmhand/.test(n)?[]:['Mug']};
  if(/Weapons/.test(n))return{m:'Knight',hold:['1H_Sword']};
  if(/Armour/.test(n))return{m:'Knight',hold:['Round_Shield']};
  if(/Potion/.test(n))return{m:'Mage',hold:['Spellbook_open']};
  if(/Arcanist/.test(n))return{m:'Mage',hold:['2H_Staff']};
  if(/Guild/.test(n))return{m:'Mage',hold:['Spellbook']};
  if(/Iron Crown/.test(n))return{m:'Knight',hold:['1H_Sword','Badge_Shield']};
  if(/Sun Choir/.test(n))return{m:'Mage',hold:['1H_Wand']};
  if(/Gilded/.test(n))return{m:'Rogue',hold:['Knife']};
  if(/Food|Crop/.test(n))return{m:'Rogue',hold:[]};
  return{m:'Rogue_Hooded',hold:[]};}
function npcs(dt){
  const list=[...(G.traders||[]),...(G.talkers||[]),...(G.guild?[G.guild]:[]),...(G.smiths||[]).filter(q=>q.name),...(G.crowd||[])];
  list.forEach((q,i)=>{if(FLOOR.areas&&areaKey(q)!==FLOOR.areaK)return;const id='n'+i;let a=ACTORS.get(id);if(!a){const L=npcLook(q);a=makeActor('npc:'+L.m+L.hold.join()+(L.hero?specKey(L.hero):''),L);ACTORS.set(id,a);a.face=0;play(a,'Idle');a.npc=q;}
    seenIds.add(id);a.root.position.set(wx(q.x),0,wz(q.y));const d=hyp(P.x-q.x,P.y-q.y);
    turn(a,q.crowd?q.face:d<90?Math.atan2(wx(P.x-q.x),wz(P.y-q.y)):0,dt,4);
    if(q.sayUntil>G.time&&a.curName!=='Interact')play(a,'Interact',{once:true,fade:.2});else if(!(q.sayUntil>G.time)&&a.curName==='Interact'&&!a.cur.isRunning())play(a,'Idle',{fade:.3});
    upd(a,dt);});
}

/* ---------- the character preview: your model, turning slowly, in the Gear panel and the creator ---------- */
// One small renderer per canvas. wt: the weapon type it holds (the model follows it), the save's by default.
const PVS=new Map();
me.preview=function(cv,wt,school,sp){
  if(!me.ready||Q.off)return false;
  let PV=PVS.get(cv);
  if(!PV){const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true});r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(28,1,.1,50);cam.position.set(0,1.7,6.9);cam.lookAt(0,1.3,0);
    sc.add(new THREE.HemisphereLight('#c8d0e8','#2a2016',1.4));const k=new THREE.DirectionalLight('#ffe2c0',2.2);k.position.set(2,4,5);sc.add(k);
    const rim=new THREE.DirectionalLight('#8aa0ff',1.6);rim.position.set(-3,3,-4);sc.add(rim);
    const disc=new THREE.Mesh(new THREE.CircleGeometry(1.1,40),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:.45}));disc.rotation.x=-Math.PI/2;sc.add(disc);
    PV={r,sc,cam,a:null,key:'',cv,t:0,last:0};PVS.set(cv,PV);}
  if(!wt){wt=S.equip.weapon.type;school=S.equip.weapon.school;}
  sp=sp||heroSpec();const key='pv:'+wt+':'+school+':'+specKey(sp);
  if(PV.key!==key){let rot=0;if(PV.a){rot=PV.a.root.rotation.y;PV.sc.remove(PV.a.root);}const h=HERO[wt]||HERO.sword;const a=makeActor(key,Object.assign({hero:sp},h));scene.remove(a.root);
    a.root.position.set(0,0,0);a.root.rotation.y=rot;PV.sc.add(a.root);play(a,h.idle||'Idle');PV.a=a;PV.key=key;
    if(PV.wt0&&PV.wt0!==wt){play(a,h.atk[0],{once:true,restart:true});a.lock=1;}PV.wt0=wt;}   // a new weapon: a swing to show it off
  const w=cv.clientWidth||180,hh=cv.clientHeight||220;PV.r.setSize(w,hh,false);PV.cam.aspect=w/hh;PV.cam.updateProjectionMatrix();
  if(!PV.loop){PV.loop=true;const step=now=>{if(!PV.cv.isConnected||PV.cv.offsetParent===null){PV.loop=false;PV.last=0;return;}
      const dt=PV.last?Math.min(.05,(now-PV.last)/1000):0;PV.last=now;PV.a.root.rotation.y+=dt*.5;
      if(PV.a.lock>0){PV.a.lock-=dt;if(PV.a.lock<=0){const h=HERO[PV.key.split(':')[1]]||HERO.sword;play(PV.a,h.idle||'Idle',{fade:.25});}}
      upd(PV.a,dt);PV.r.render(PV.sc,PV.cam);requestAnimationFrame(step);};
    requestAnimationFrame(step);}
  return true;
};
me.actors=ACTORS;
me.info=()=>renderer&&Object.assign({},renderer.info.render,{geometries:renderer.info.memory.geometries,actors:ACTORS.size});
function applyStyle(){const g=STYLE.grade||[1,1,0,0,0],u=grade.uniforms;u.con.value=g[0];u.sat.value=g[1];u.cold.value=g[2];u.grain.value=g[3];u.lift.value=g[4]||0;
  for(const k in PROTO)for(const p of PROTO[k].parts)if(p.mat.flatShading!==!!STYLE.flat){p.mat.flatShading=!!STYLE.flat;p.mat.needsUpdate=true;}}
me.style=i=>{if(i!=null){STYLE=STYLES[i];applyStyle();me.g=null;for(const a of ACTORS.values())dropActor(a);ACTORS.clear();FREE.clear();}return STYLE.name;};
me.feet=id=>{const a=ACTORS.get(id);if(!a)return null;a.root.updateMatrixWorld(true);const v=new THREE.Vector3();return['foot.l','foot.r'].map(n=>{bone(a.root,n).getWorldPosition(v);return[v.x,v.y,v.z];}).concat([[a.curName,a.cur?+a.cur.timeScale.toFixed(2):0,+(a.sp||0).toFixed(2)]]);};
me.ids=()=>[...ACTORS.keys()];
// A check, for the tests and the tuning: walk an actor in a line at a speed (world units a second) facing a way
// (relative to its travel: 0 ahead, PI/2 its left side leading...), and report how fast its planted feet slide over
// the floor (0: they hold it), with the clip it chose. old: the way it was before (the jog at one fixed rate).
me.slip=(id,speed,rel=0,old=false,force=null)=>{
  const a=ACTORS.get(id);if(!a||!a.mixer)return null;const save=[a.root.position.clone(),a.face,a.root.visible];
  const feet=footBones(a),v=new THREE.Vector3(),dt=1/60,fr=feet.map(f=>f.map(()=>[]));let x=0;
  a.px=null;a.face=Math.PI/2-rel;a.root.rotation.set(0,a.face,0);a.gaitClip=null;stopUp(a,0);a.lock=0;   // travelling along +x
  for(let i=0;i<220;i++){x+=speed*dt;motion(a,x,0,dt);a.root.position.set(x,0,0);
    if(force)play(a,force,{speed:speed/gaitOf(a)[force]});else if(old)play(a,'Running_A',{speed:1.05});else if(!loco(a,a.vx,a.vz))play(a,'Idle');
    upd(a,dt);if(i<60)continue;a.root.updateMatrixWorld(true);
    feet.forEach((f,j)=>f.forEach((b,k)=>{b.getWorldPosition(v);fr[j][k].push([v.x,v.y,v.z]);}));}
  const sp=plantedSpeeds(fr,dt),out={clip:a.curName,rate:+a.cur.timeScale.toFixed(2),slide:+(sp.reduce((p,q)=>p+q,0)/Math.max(1,sp.length)).toFixed(2)};
  a.root.visible=save[2];
  a.root.position.copy(save[0]);a.face=save[1];a.root.rotation.y=a.face;a.px=null;return out;};
me.debug=()=>({foot:FOOT,gait:Object.fromEntries([...ACTORS.values()].map(a=>[a.key,gaitOf(a)])),floaters:FLOOR&&FLOOR.floatSet?FLOOR.floatSet.list.slice(0,3):null,torches:FLOOR&&FLOOR.torches.length,top:TOP.skull_candle,candle:TOP.candle_thin});
me.zoom=z=>{if(z)zoom=z;return zoom;};
// The village's hour, to look at it by day, in the evening or at night (its windows for now): R3.hour('night').
me.hour=h=>{if(h){VILLAGE_HOUR=h;if(G&&G.village)buildVillage();}return VILLAGE_HOUR;};
me.use=()=>me.ready&&!Q.off&&!!G&&!!P;
me.draw=function(){
  canvas.hidden=false;over.hidden=false;cv.style.visibility='hidden';
  try{frame3d();}catch(e){console.error('3D drawing failed, drawing in 2D from now on',e);me.failed=true;me.ready=false;me.hide();}
};
me.hide=function(){if(!canvas||canvas.hidden)return;canvas.hidden=true;over.hidden=true;cv.style.visibility='';lastT=0;};
return me;
})();

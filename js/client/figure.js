'use strict';
// Blackspire: the people. A hero, a townsman or a face in the crowd is built here from plain shapes onto the
// adventurers' skeleton (so every animation still plays), in grown-up proportions: about seven and a half heads
// tall, long legs, narrow hips, square shoulders. What they wear is part of the build: a tunic, a leather jerkin, a
// longcoat or plate over the body, boots by their kind, the face and hair they were made with.
//   FIGURE.dress(model, sp)  takes the adventurer's own meshes off `model` and builds the figure on its bones;
//                            sp = {armor:{type,tint}, boots:{type}, look:{skin,hair,style,eyes}}
//   FIGURE.step(fig, root, dt)  swings the cloth (coat tails, a tunic's skirt, a tabard) after the bones have moved
// The whole body is one skinned mesh, each vertex held by one bone, coloured by vertex; the cloth is a second mesh
// of strips hanging from the waist, simulated: it trails when you run, swings when you turn, and settles.
const FIGURE=typeof THREE==='undefined'?null:(()=>{
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2,SCALE=1.28;
  // How far each bone sits from its parent, against the adventurers' own stubby build (x, y, z of its place).
  const PROP={hips:[1.8,2.29,1.8],upperlegl:[.76,1,1],upperlegr:[.76,1,1],lowerlegl:[2,2,2],lowerlegr:[2,2,2],footl:[3.1,3.1,3.1],footr:[3.1,3.1,3.1],
    chest:[1,.76,1],head:[1,.85,1],upperarml:[.95,1.36,1],upperarmr:[.95,1.36,1],lowerarml:[1.25,1.25,1.25],lowerarmr:[1.25,1.25,1.25]};
  const shade=(c,k)=>'#'+new THREE.Color(c).multiplyScalar(k).getHexString(),mixc=(a,b,t)=>'#'+new THREE.Color(a).lerp(new THREE.Color(b),t).getHexString();
  const LEATHER='#4a3524',DLEATHER='#2c2018',STEEL='#8d949c',DSTEEL='#5a6068',TROUSERS='#26262c',BUCKLE='#b8a05a';

  // A body under construction: shapes added in the model's own space, each bound whole to one bone.
  function maker(index){
    const P=[],C=[],SI=[],FINE=[],col=new THREE.Color(),m4=new THREE.Matrix4(),q=new THREE.Quaternion();let fineOn=false;
    const fine=fn=>{fineOn=true;fn();fineOn=false;};   // small detail (a face, a buckle): drawn, but given no outline of its own
    const add=(geo,m,c,bone)=>{const g=geo.index?geo.toNonIndexed():geo;g.applyMatrix4(m);const p=g.attributes.position,bi=index[bone];col.set(c);
      for(let i=0;i<p.count;i++){P.push(p.getX(i),p.getY(i),p.getZ(i));C.push(col.r,col.g,col.b);SI.push(bi,0,0,0);FINE.push(fineOn);}};
    // a limb: a tapered tube from A to B (radius rA at A, rB at B), its cross-section squeezed by sx, sz
    const limb=(A,B,rA,rB,c,bone,o={})=>{const d=V().subVectors(B,A),len=d.length()||.001,y=d.clone().normalize();let rx=o.ref||V(1,0,0);if(Math.abs(y.dot(rx))>.9)rx=V(0,0,1);
      const x=rx.clone().addScaledVector(y,-y.dot(rx)).normalize(),z=V().crossVectors(x,y);
      m4.makeBasis(x.multiplyScalar(o.sx||1),y,z.multiplyScalar(o.sz||1)).setPosition(A.x+d.x/2,A.y+d.y/2,A.z+d.z/2);add(new THREE.CylinderGeometry(rB,rA,len,o.n||8,1),m4,c,bone);};
    const ball=(p,r,c,bone,s=[1,1,1],rot)=>{m4.compose(p,rot?q.setFromEuler(new THREE.Euler(...rot)):q.identity(),V(s[0]*r,s[1]*r,s[2]*r));add(new THREE.IcosahedronGeometry(1,1),m4,c,bone);};
    const box=(p,s,c,bone,rot)=>{m4.compose(p,rot?q.setFromEuler(new THREE.Euler(...rot)):q.identity(),V(s[0],s[1],s[2]));add(new THREE.BoxGeometry(1,1,1),m4,c,bone);};
    const cone=(p,r,h,c,bone,rot,n=4)=>{m4.compose(p,rot?q.setFromEuler(new THREE.Euler(...rot)):q.identity(),V(r,h,r));add(new THREE.ConeGeometry(1,1,n),m4,c,bone);};
    const cap=(p,s,c,bone,rot,arc=.5)=>{m4.compose(p,rot?q.setFromEuler(new THREE.Euler(...rot)):q.identity(),V(s[0],s[1],s[2]));add(new THREE.SphereGeometry(1,9,5,0,TAU,0,Math.PI*arc),m4,c,bone);};
    const done=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));
      g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));const w=new Float32Array(SI.length);for(let i=0;i<w.length;i+=4)w[i]=1;g.setAttribute('skinWeight',new THREE.BufferAttribute(w,4));
      g.computeVertexNormals();return g;};
    // the same body with its corners rounded off (normals shared by every vertex at one place): what the ink outline is pushed out along
    const round=g0=>{const keep=[];for(let i=0;i<FINE.length;i+=3)if(!FINE[i])keep.push(i,i+1,i+2);const g=new THREE.BufferGeometry();
      for(const nm of['position','normal','skinIndex','skinWeight']){const a=g0.attributes[nm],n=a.itemSize,arr=new a.array.constructor(keep.length*n);keep.forEach((v,j)=>{for(let c=0;c<n;c++)arr[j*n+c]=a.array[v*n+c];});g.setAttribute(nm,new THREE.BufferAttribute(arr,n));}
      const o=g,p=o.attributes.position,n=o.attributes.normal,acc=new Map(),k=i=>Math.round(p.getX(i)*500)+','+Math.round(p.getY(i)*500)+','+Math.round(p.getZ(i)*500);
      for(let i=0;i<p.count;i++){const a=acc.get(k(i))||acc.set(k(i),[0,0,0]).get(k(i));a[0]+=n.getX(i);a[1]+=n.getY(i);a[2]+=n.getZ(i);}
      const nn=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const a=acc.get(k(i)),l=Math.hypot(a[0],a[1],a[2])||1;nn[i*3]=a[0]/l;nn[i*3+1]=a[1]/l;nn[i*3+2]=a[2]/l;}
      o.setAttribute('normal',new THREE.BufferAttribute(nn,3));return o;};
    return{limb,ball,box,cone,cap,done,round,fine};
  }

  // The body and what is on it. J: the joints, in the model's space, standing with arms out.
  function body(M,J,sp){
    const look=sp.look||{},arm=sp.armor||{type:'tunic'},kind={tunic:'tunic',leather:'leather',coat:'coat',plate:'plate'}[arm.type]||'tunic',boots=(sp.boots&&sp.boots.type)||'boots';
    const skin=look.skin||'#e0b08a',hair=look.hair||'#3a2a1e',eyes=look.eyes||'#3a4a5a',tint=arm.tint||{tunic:'#5a2630',leather:'#6b4a2c',coat:'#1e1e26',plate:'#5a2630'}[kind];
    const main={tunic:tint,leather:LEATHER,coat:tint,plate:STEEL}[kind],dark=shade(main,.62),trim={tunic:shade(tint,1.5),leather:DLEATHER,coat:mixc(tint,'#b8bcc4',.4),plate:mixc(STEEL,'#ffffff',.25)}[kind];
    const up=(p,dx,dy,dz)=>V(p.x+dx,p.y+dy,p.z+dz),S=[-1,1];
    /* --- head: skull, jaw, a stern brow, eyes of their own colour, the hair --- */
    const Hc=up(J.neck,0,.175,.012);
    M.limb(up(J.neck,0,-.03,0),up(J.neck,0,.09,.005),.05,.044,skin,'head');
    M.ball(Hc,1,skin,'head',[.104,.126,.118]);M.ball(up(Hc,0,-.062,.018),1,skin,'head',[.084,.074,.094]);
    M.fine(()=>{M.box(up(Hc,0,-.03,.118),[.02,.045,.03],shade(skin,.92),'head',[-.25,0,0]);M.box(up(Hc,0,-.085,.106),[.04,.007,.012],shade(skin,.55),'head');
    for(const s of S){M.box(up(Hc,s*.04,-.002,.106),[.034,.016,.012],'#e8e4da','head');M.box(up(Hc,s*.04,-.002,.11),[.016,.016,.012],eyes,'head');M.box(up(Hc,s*.04,-.002,.114),[.007,.008,.008],'#0c0c10','head');
      M.box(up(Hc,s*.042,.022,.11),[.05,.011,.016],shade(hair,.7),'head',[0,0,-s*.2]);M.box(up(Hc,s*.106,-.01,.005),[.014,.045,.03],shade(skin,.95),'head');}});
    {const st=look.style||0,hc=hair,hd=shade(hair,.75),top=(k=1,arc=.5)=>M.cap(up(Hc,0,.012,-.012),[.106*k,.13*k,.123*k],hc,'head',[-.3,0,0],arc);
      const bangs=(n,len)=>{for(let i=0;i<n;i++){const u=n>1?i/(n-1)*2-1:0;M.cone(up(Hc,u*.078,.07-len/2+Math.abs(u)*.012,.102-Math.abs(u)*.03),.03,len,i%2?hd:hc,'head',[Math.PI+.3,0,-u*.5]);}};
      const locks=len=>{for(const s of S)M.cone(up(Hc,s*.102,.03-len/2,.03),.028,len,hd,'head',[Math.PI,0,s*.12]);};
      if(st===5)top(.985,.46);                                                                              // buzz: close to the skull
      else if(st===1){top(1.02);bangs(3,.06);for(let i=0;i<11;i++){const a=i/11*TAU,r=i%2?.062:.03;M.cone(up(Hc,Math.sin(a)*r,.135+(i%2?0:.02),-.02+Math.cos(a)*r),.03,.11,i%2?hc:hd,'head',[Math.cos(a)*.6-.25,0,-Math.sin(a)*.6]);}}   // spiked
      else if(st===2){top(1.04);bangs(5,.09);locks(.2);M.box(up(Hc,0,-.12,-.105),[.2,.3,.05],hc,'head',[.1,0,0]);for(const s of S)M.box(up(Hc,s*.085,-.14,-.07),[.05,.26,.07],hd,'head',[.06,0,s*.05]);}   // long: down past the shoulders
      else if(st===3){top(1.03);bangs(4,.075);locks(.1);M.ball(up(Hc,0,.06,-.125),.036,hd,'head');M.cone(up(Hc,0,-.09,-.165),.04,.3,hc,'head',[Math.PI-.22,0,0],5);}   // tail
      else if(st===4){top(1.06,.56);bangs(5,.07);M.box(up(Hc,0,-.045,-.06),[.225,.17,.13],hc,'head');for(const s of S)M.box(up(Hc,s*.1,-.06,.02),[.03,.16,.1],hd,'head');}   // bob: to the jaw
      else{top(1.03);bangs(5,.085);locks(.11);for(let i=0;i<5;i++){const u=i/4*2-1;M.cone(up(Hc,u*.07,-.045,-.1+Math.abs(u)*.03),.03,.09,i%2?hc:hd,'head',[Math.PI-.35,0,u*.3]);}}   // short: a fringe over the brow, ragged at the neck
    }
    /* --- torso, by what is worn: the trunk in three pieces (hips, waist, chest), then the garment's own detail --- */
    const g=kind==='plate'?.02:.012,wY=J.spine.y,cY=J.chest.y,sY=J.shL.y,front=.108;
    M.limb(up(J.hips,0,-.1,0),up(J.spine,0,.02,0),.118,.116,kind==='plate'?DSTEEL:TROUSERS,'hips',{sz:.72});
    M.limb(up(J.spine,0,-.03,0),up(J.chest,0,.03,0),.116+g,.15+g,main,'spine',{sz:.66,n:10});
    M.limb(up(J.chest,0,-.03,0),V(0,sY-.005,0),.15+g,.172+g,main,'chest',{sz:.63,n:10});M.ball(V(0,sY-.01,0),1,main,'chest',[.172+g,.05,.108+g*.6]);
    const belt=(c=LEATHER)=>{M.limb(up(J.spine,0,-.04,0),up(J.spine,0,.02,0),.128+g,.126+g,c,'spine',{sz:.69,n:10});M.box(V(0,wY-.01,.092+g),[.05,.05,.018],BUCKLE,'spine');};
    const arms=(upC,foreC,handC,o={})=>{for(const s of S){const sh=s<0?J.shR:J.shL,el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL,ha=s<0?J.haR:J.haL,n=s<0?'r':'l',t=o.thick||0;
      M.ball(sh,.074+t,upC,'upperarm'+n);M.limb(sh,el,.062+t,.05+t+(o.flare||0),upC,'upperarm'+n);M.ball(el,.05+t,o.elbow||foreC,'lowerarm'+n);
      M.limb(el,wr,.048+(o.fore||0),.036+(o.fore||0),foreC,'lowerarm'+n);if(o.cuff)M.limb(V().lerpVectors(el,wr,.78),wr,.042,.04,o.cuff,'lowerarm'+n);
      M.box(V((wr.x+ha.x)/2+s*.045,wr.y,wr.z),[.13,.036,.078],handC,'wrist'+n);M.box(V(wr.x+s*.02,wr.y,wr.z+.045),[.05,.03,.03],handC,'wrist'+n);}};
    let cloth=null;
    if(kind==='tunic'){
      M.box(V(0,sY-.07,front+.012),[.075,.075,.02],skin,'chest',[0,0,.785]);M.limb(V(0,sY-.02,0),V(0,sY+.02,0),.075,.06,trim,'chest',{sz:.85});   // an open neck, a trimmed collar
      for(const s of S)M.box(V(s*.05,cY+.05,front+.004),[.012,.2,.012],dark,'chest',[0,0,-s*.12]);
      belt();arms(main,skin,skin,{flare:.014,thick:.006,elbow:skin});for(const s of S){const el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL;M.limb(V().lerpVectors(el,wr,.62),wr,.04,.035,LEATHER,'lowerarm'+(s<0?'r':'l'));}
      cloth={len:.3,rows:3,gap:0,vent:false,c:main,hem:trim,rx:.142,rz:.104,flare:.07,stiff:.12};
    }else if(kind==='leather'){
      M.box(V(0,cY+.04,front+.006),[.03,.3,.014],DLEATHER,'chest');for(let i=0;i<4;i++)M.box(V(0,cY-.05+i*.07,front+.014),[.07,.012,.01],'#b8a888','chest');   // laced down the front
      M.box(V(0,cY+.09,front+.004),[.4,.04,.016],DLEATHER,'chest',[0,0,.42]);M.ball(up(J.shL,.01,.03,0),1,DLEATHER,'upperarml',[.1,.06,.095]);M.ball(up(J.shL,.05,-.01,0),1,LEATHER,'upperarml',[.085,.05,.085]);
      M.limb(V(0,sY-.02,0),V(0,sY+.03,0),.078,.066,DLEATHER,'chest',{sz:.85});
      belt(DLEATHER);M.box(V(-.125,wY-.07,.05),[.07,.09,.05],LEATHER,'hips');M.box(V(.13,wY-.09,.02),[.03,.16,.03],DLEATHER,'hips',[.15,0,.1]);
      arms(tint,LEATHER,skin,{fore:.006,elbow:tint});
      cloth={len:.24,rows:3,gap:0,vent:false,c:DLEATHER,hem:LEATHER,rx:.144,rz:.106,flare:.07,stiff:.22,flaps:4};
    }else if(kind==='coat'){
      M.box(V(0,cY+.03,front+.004),[.035,.34,.012],shade(tint,.4),'chest');for(const s of S){M.box(V(s*.045,cY+.1,front+.01),[.03,.2,.012],trim,'chest',[0,0,-s*.2]);M.box(V(s*.03,cY-.08,front+.008),[.012,.16,.012],trim,'spine');}   // lapels, edged
      for(let i=0;i<5;i++){const a=(i-2)*.62+Math.PI;M.box(V(Math.sin(a)*.072,sY+.05,Math.cos(a)*.062-.004),[.075,.1,.014],i%2?dark:main,'chest',[.22,a,0]);}                // a high collar, open at the throat
      for(const s of S)M.box(V(s*.07,sY+.04,.052),[.05,.09,.014],main,'chest',[-.1,s*.6,s*.1]);
      for(const y of[cY+.12,cY+.02]){M.box(V(0,y,front+.012),[.3,.028,.014],DLEATHER,'chest');M.box(V(.06,y,front+.02),[.035,.04,.012],BUCKLE,'chest');}                  // straps across the chest
      belt(DLEATHER);for(const s of S){M.ball(up(s<0?J.shR:J.shL,0,.02,0),1,dark,'upperarm'+(s<0?'r':'l'),[.078,.03,.08]);}
      arms(main,main,DLEATHER,{thick:.006,fore:.008,cuff:trim});
      cloth={len:.8,rows:6,gap:.5,vent:true,c:main,hem:trim,rx:.15,rz:.112,flare:.14,stiff:.05};
    }else{
      M.box(V(0,cY+.06,front+.016),[.04,.24,.04],trim,'chest',[0,.785,0]);M.box(V(0,cY+.11,front+.01),[.3,.1,.03],mixc(STEEL,'#ffffff',.12),'chest');   // a keeled breastplate
      M.limb(V(0,sY-.03,0),V(0,sY+.045,0),.09,.068,DSTEEL,'chest',{sz:.9});M.limb(up(J.spine,0,-.06,0),up(J.spine,0,.03,0),.14,.136,DSTEEL,'spine',{sz:.7,n:10});
      M.box(V(0,wY-.012,.1),[.3,.03,.014],tint,'spine');
      for(const s of S){const n=s<0?'r':'l',sh=s<0?J.shR:J.shL;M.ball(up(sh,s*.01,.035,0),1,STEEL,'upperarm'+n,[.115,.065,.11]);M.ball(up(sh,s*.065,.0,0),1,trim,'upperarm'+n,[.09,.05,.095]);M.ball(up(sh,s*.105,-.03,0),1,STEEL,'upperarm'+n,[.07,.04,.08]);}
      for(let i=0;i<6;i++){const a=[-.45,.45,-1.4,1.4,Math.PI-.5,Math.PI+.5][i];M.box(V(Math.sin(a)*.135,wY-.14,Math.cos(a)*.1),[.11,.19,.018],i<2?STEEL:DSTEEL,'hips',[.16,a,0]);}   // tassets round the hips
      arms(STEEL,STEEL,DSTEEL,{thick:.008,fore:.01,elbow:trim});
      cloth={len:.46,rows:4,c:tint,hem:shade(tint,1.5),rx:.12,rz:.088,flare:.03,stiff:.05,tabard:true};
    }
    /* --- legs: trousers (or cuisses), then the boots by their kind --- */
    const legC=kind==='plate'?DSTEEL:kind==='leather'?'#3a3026':TROUSERS,bk=kind==='plate'?'greaves':boots;
    for(const s of S){const n=s<0?'r':'l',hj=s<0?J.hjR:J.hjL,kn=s<0?J.knR:J.knL,an=s<0?J.anR:J.anL,to=s<0?J.toR:J.toL,mid=V().lerpVectors(kn,an,.38);
      M.limb(hj,kn,.096,.068,legC,'upperleg'+n);M.ball(hj,.096,legC,'upperleg'+n);if(kind==='plate')M.box(V().lerpVectors(hj,kn,.5).add(V(0,0,.075)),[.11,.26,.03],STEEL,'upperleg'+n);
      if(bk==='greaves'){M.ball(up(kn,0,0,.012),.076,STEEL,'lowerleg'+n);M.limb(kn,an,.074,.052,STEEL,'lowerleg'+n);M.box(V().lerpVectors(kn,an,.5).add(V(0,0,.058)),[.05,.3,.02],mixc(STEEL,'#ffffff',.2),'lowerleg'+n);
        M.box(V(an.x,.055,(an.z+to.z)/2+.035),[.105,.09,.23],DSTEEL,'foot'+n);M.box(V(an.x,.04,to.z+.05),[.09,.05,.08],STEEL,'foot'+n);}
      else if(bk==='striders'){M.ball(kn,.068,legC,'lowerleg'+n);M.limb(kn,an,.066,.044,legC,'lowerleg'+n);for(let i=0;i<4;i++){const a=V().lerpVectors(kn,an,.35+i*.16),b=V().lerpVectors(kn,an,.42+i*.16);M.limb(a,b,.064-i*.005,.062-i*.005,i%2?'#8a7a5a':'#a39478','lowerleg'+n);}
        M.box(V(an.x,.045,(an.z+to.z)/2+.03),[.09,.075,.21],'#5a4a36','foot'+n);}
      else{M.ball(kn,.068,legC,'lowerleg'+n);M.limb(kn,mid,.066,.06,legC,'lowerleg'+n);M.limb(mid,an,.07,.052,DLEATHER,'lowerleg'+n);M.limb(up(mid,0,.012,0),up(mid,0,-.03,0),.076,.074,LEATHER,'lowerleg'+n);
        M.box(V().lerpVectors(mid,an,.5).add(V(0,0,.062)),[.03,.03,.012],BUCKLE,'lowerleg'+n);M.box(V(an.x,.05,(an.z+to.z)/2+.03),[.1,.085,.22],DLEATHER,'foot'+n);M.box(V(an.x,.02,(an.z+to.z)/2+.03),[.105,.03,.23],'#15100c','foot'+n);}}
    return cloth;
  }

  /* ---------- the cloth: chains of points hanging from the waist, strips of cloth between them ---------- */
  // Each chain hangs from an anchor on the hips. The points fall under their own weight, are held to their length and
  // to their neighbours, lean a little toward how the garment is cut (stiff: how much), and are pushed off the legs.
  function hang(model,bones,J,cp,mats){
    const hips=bones.hips,ang=[],strips=[],N=cp.rows+1,seg=cp.len/cp.rows;
    if(cp.tabard){for(const c of[0,Math.PI]){const i=ang.length;for(const d of[-.42,0,.42])ang.push(c+d);strips.push([i,i+1,i+2]);}}
    else if(cp.flaps){const w=TAU/cp.flaps;for(let f=0;f<cp.flaps;f++){const i=ang.length,c=f*w+w/2;for(const d of[-.4,0,.4])ang.push(c+d*w);strips.push([i,i+1,i+2]);}}
    else if(cp.gap||cp.vent){const a0=cp.gap/2,a1=Math.PI-(cp.vent?.05:0),n=5;   // a coat: two halves, open at the front, split up the back
      for(const s of[1,-1]){const i=ang.length,st=[];for(let k=0;k<n;k++){ang.push(s*(a0+(a1-a0)*k/(n-1)));st.push(i+k);}strips.push(st);}}
    else{const n=10,st=[];for(let k=0;k<n;k++){ang.push(k/n*TAU);st.push(k);}st.push(0);strips.push(st);}   // a skirt, all the way round
    const C=ang.length,anchors=ang.map(a=>{const o=new THREE.Object3D();o.position.set(Math.sin(a)*cp.rx,J.spine.y-.03,Math.cos(a)*cp.rz);model.add(o);return o;});
    model.updateMatrixWorld(true);for(const o of anchors)hips.attach(o);
    // rest shape, in the hips' own space: down, and out a little with each row
    const rest=ang.map(a=>{const r=[];for(let k=0;k<N;k++)r.push(V(Math.sin(a)*(cp.rx+cp.flare*k/cp.rows),-seg*k,Math.cos(a)*(cp.rz+cp.flare*k/cp.rows)).sub(V(Math.sin(a)*cp.rx,0,Math.cos(a)*cp.rz)));return r;});
    // the mesh: a grid of vertices per strip
    const idx=[],vmap=[],col=[],cA=new THREE.Color(cp.c),cH=new THREE.Color(cp.hem||cp.c);let nv=0;
    for(const st of strips){const base=nv;for(let j=0;j<st.length;j++)for(let k=0;k<N;k++){vmap.push([st[j],k]);const c=k===N-1?cH:cA;col.push(c.r,c.g,c.b);nv++;}
      for(let j=0;j<st.length-1;j++)for(let k=0;k<N-1;k++){const a=base+j*N+k,b=base+(j+1)*N+k;idx.push(a,b,a+1,b,b+1,a+1);}}
    const geo=new THREE.BufferGeometry(),pos=new Float32Array(nv*3);geo.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));geo.setIndex(idx);
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,side:THREE.DoubleSide,flatShading:true});mat.userData.base=[mat.emissive.clone(),0];mats.push(mat);
    const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;mesh.castShadow=true;mesh.name='Cloth';mesh.renderOrder=2;
    const pts=ang.map(()=>Array.from({length:N},()=>({p:V(),o:V()})));
    const pairs=[];for(const st of strips)for(let j=0;j<st.length-1;j++)pairs.push([st[j],st[j+1]]);
    return{cp,mesh,geo,pos,vmap,anchors,rest,pts,pairs,N,seg,hips,legs:['upperlegl','lowerlegl','footl','upperlegr','lowerlegr','footr'].map(n=>bones[n]),fresh:true,model};
  }
  const tA=V(),tB=V(),tC=V(),tD=V(),qH=new THREE.Quaternion(),sH=V(),m4=new THREE.Matrix4();
  function step(fig,root,dt){
    const cl=fig&&fig.cloth;if(!cl)return;root.updateMatrixWorld(true);
    const{pts,anchors,rest,N,cp}=cl;cl.hips.matrixWorld.decompose(tA,qH,sH);const sc=sH.y,seg=cl.seg*sc,rad=.105*sc;
    // the hips' frame without their tilt would let a coat stand out from a bow; keep the turn, drop most of the lean
    const target=(c,k,out)=>out.copy(rest[c][k]).multiplyScalar(sc).applyQuaternion(qH).add(tB.setFromMatrixPosition(anchors[c].matrixWorld));
    const A0=tC.setFromMatrixPosition(anchors[0].matrixWorld);
    if(cl.fresh||pts[0][0].p.distanceToSquared(A0)>9*sc*sc){cl.fresh=false;for(let c=0;c<pts.length;c++)for(let k=0;k<N;k++){target(c,k,pts[c][k].p);pts[c][k].o.copy(pts[c][k].p);}}
    const L=cl.legs.map(b=>V().setFromMatrixPosition(b.matrixWorld)),h=Math.min(dt,.034)/2;
    if(dt>0)for(let it=0;it<2;it++){
      for(let c=0;c<pts.length;c++){const ch=pts[c];ch[0].p.setFromMatrixPosition(anchors[c].matrixWorld);ch[0].o.copy(ch[0].p);
        for(let k=1;k<N;k++){const n=ch[k];tA.subVectors(n.p,n.o).multiplyScalar(.965);n.o.copy(n.p);n.p.add(tA);n.p.y-=16*sc*h*h;
          target(c,k,tD);n.p.lerp(tD,cp.stiff*(1-.35*k/N));}}
      for(let r=0;r<3;r++){
        for(let c=0;c<pts.length;c++)for(let k=1;k<N;k++){const a=pts[c][k-1].p,b=pts[c][k].p;tA.subVectors(b,a);const d=tA.length()||1e-6;b.addScaledVector(tA,(seg-d)/d);}
        for(const[i,j]of cl.pairs)for(let k=1;k<N;k++){const a=pts[i][k].p,b=pts[j][k].p,w=tB.subVectors(rest[j][k],rest[i][k]).add(tC.subVectors(cl.anchorRest[j],cl.anchorRest[i])).length()*sc;
          tA.subVectors(b,a);const d=tA.length()||1e-6,f=(w-d)/d*.5;if(d>w||d<w*.6){a.addScaledVector(tA,-f*.5);b.addScaledVector(tA,f*.5);}}
        // off the legs: thigh and shin, each a rod with some thickness
        for(let c=0;c<pts.length;c++)for(let k=1;k<N;k++){const p=pts[c][k].p;for(const s of[0,3])for(let e=0;e<2;e++){const a=L[s+e],b=L[s+e+1];tA.subVectors(b,a);const t=Math.max(0,Math.min(1,tB.subVectors(p,a).dot(tA)/tA.lengthSq()));
          tB.copy(a).addScaledVector(tA,t);tC.subVectors(p,tB);const d=tC.length();if(d<rad&&d>1e-5)p.addScaledVector(tC,(rad-d)/d);}
          if(p.y<root.position.y+.03*sc)p.y=root.position.y+.03*sc;}}
    }
    m4.copy(root.matrixWorld).invert();const pos=cl.pos;for(let i=0;i<cl.vmap.length;i++){const[c,k]=cl.vmap[i];tA.copy(pts[c][k].p).applyMatrix4(m4);pos[i*3]=tA.x;pos[i*3+1]=tA.y;pos[i*3+2]=tA.z;}
    cl.geo.attributes.position.needsUpdate=true;cl.geo.computeVertexNormals();
  }

  const GEO=new Map();   // one body geometry per look and outfit, shared by everyone who has it
  function dress(model,sp,key){
    const bones={},own=[];model.traverse(c=>{if(c.isBone)bones[c.name]=c;else if(c.isSkinnedMesh||/_(Helmet|Hat|Cape)$/.test(c.name))own.push(c);});
    for(const c of own){if(c.isSkinnedMesh)c.parent.remove(c);else c.visible=false;}
    const prop=[];for(const n in PROP){const b=bones[n];if(b){const f=V(...PROP[n]);b.position.multiply(f);prop.push([b,f]);}}
    // the adventurers hold their arms wide of a round body; on a lean one they come in to the sides
    const turn=[];for(const[n,a]of[['upperarml',-.5],['upperarmr',.5]]){const b=bones[n];if(b){const q=new THREE.Quaternion().setFromAxisAngle(V(0,0,1),a);turn.push([b,q,q.clone().invert()]);}}
    for(const n of['handslotl','handslotr']){const b=bones[n];if(b)for(const c of b.children)c.scale.multiplyScalar(.6);}   // (their weapons were made for big hands)
    model.scale.setScalar(SCALE);model.position.set(0,0,0);model.updateMatrixWorld(true);
    const inv=new THREE.Matrix4().copy(model.matrixWorld).invert(),at=n=>V().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(inv);
    const J={hips:at('hips'),spine:at('spine'),chest:at('chest'),neck:at('head'),shL:at('upperarml'),shR:at('upperarmr'),elL:at('lowerarml'),elR:at('lowerarmr'),wrL:at('wristl'),wrR:at('wristr'),haL:at('handl'),haR:at('handr'),
      hjL:at('upperlegl'),hjR:at('upperlegr'),knL:at('lowerlegl'),knR:at('lowerlegr'),anL:at('footl'),anR:at('footr'),toL:at('toesl'),toR:at('toesr')};
    const list=Object.values(bones),index={};list.forEach((b,i)=>{index[b.name]=i;});
    let G=GEO.get(key);if(!G){const M=maker(index),cp=body(M,J,sp);G={geo:M.done(),cp};G.ink=M.round(G.geo);GEO.set(key,G);}
    const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,flatShading:true});mat.userData.base=[mat.emissive.clone(),0];
    const mesh=new THREE.SkinnedMesh(G.geo,mat);mesh.name='Figure';mesh.userData.inkGeo=G.ink;mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;model.add(mesh);mesh.bind(new THREE.Skeleton(list));
    const mats=[mat];let cloth=null;
    if(G.cp){cloth=hang(model,bones,J,G.cp,mats);cloth.anchorRest=cloth.anchors.map(o=>o.position.clone());}   // (each anchor's place in the hips' space, for the width between neighbouring chains)
    model.position.y=-J.toL.y*SCALE+.03;   // stood on its own feet
    for(const[b,f]of prop)b.position.divide(f);   // (back as the clips will write them: upd() stretches them every frame)
    return{mats,prop,turn,cloth,mesh};
  }
  return{dress,step,SCALE};
})();

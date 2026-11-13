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
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),TAU=Math.PI*2,SCALE=1.36;
  // How far each bone sits from its parent, against the adventurers' own stubby build (x, y, z of its place).
  const PROP={hips:[1.8,2.29,1.8],upperlegl:[.76,1,1],upperlegr:[.76,1,1],lowerlegl:[2,2,2],lowerlegr:[2,2,2],footl:[3.1,3.1,3.1],footr:[3.1,3.1,3.1],
    chest:[1,.76,1],head:[1,.85,1],upperarml:[1.04,1.36,1],upperarmr:[1.04,1.36,1],lowerarml:[1.25,1.25,1.25],lowerarmr:[1.25,1.25,1.25]};
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
    const main={tunic:tint,leather:LEATHER,coat:tint,plate:STEEL}[kind],dark=shade(main,.62),lite=mixc(main,'#ffffff',.14),trim={tunic:shade(tint,1.5),leather:DLEATHER,coat:mixc(tint,'#b8bcc4',.4),plate:mixc(STEEL,'#ffffff',.25)}[kind];
    const up=(p,dx,dy,dz)=>V(p.x+dx,p.y+dy,p.z+dz),S=[-1,1],mid=(a,b,t)=>V().lerpVectors(a,b,t);
    // a muscle: a limb that swells between its ends (radius r[0] at A, r[1] at the belly a share t along, r[2] at B)
    const musc=(A,B,r,t,c,bone,o)=>{const m=mid(A,B,t);if(o&&o.back)m.z-=o.back;M.limb(A,m,r[0],r[1],c,bone,o);M.limb(m,B,r[1],r[2],c,bone,o);};
    const ring=(A,B,t0,t1,r,c,bone)=>M.limb(mid(A,B,t0),mid(A,B,t1),r,r*.97,c,bone);
    const stud=(p,c,bone,s=.016)=>M.fine(()=>M.box(p,[s,s,s],c,bone,[.6,.6,0]));
    /* --- head: skull, jaw, a stern brow, eyes of their own colour, the hair --- */
    const Hc=up(J.neck,0,.175,.012);
    M.limb(up(J.neck,0,-.04,0),up(J.neck,0,.09,.005),.066,.054,skin,'head');
    M.ball(Hc,1,skin,'head',[.104,.126,.118]);M.ball(up(Hc,0,-.062,.018),1,skin,'head',[.084,.074,.094]);
    M.fine(()=>{M.box(up(Hc,0,-.03,.118),[.02,.045,.03],shade(skin,.92),'head',[-.25,0,0]);M.box(up(Hc,0,-.085,.106),[.04,.007,.012],shade(skin,.55),'head');
    for(const s of S){M.box(up(Hc,s*.04,-.002,.106),[.034,.016,.012],'#e8e4da','head');M.box(up(Hc,s*.04,-.002,.11),[.016,.016,.012],eyes,'head');M.box(up(Hc,s*.04,-.002,.114),[.007,.008,.008],'#0c0c10','head');
      M.box(up(Hc,s*.042,.022,.11),[.05,.011,.016],shade(hair,.7),'head',[0,0,-s*.2]);M.box(up(Hc,s*.106,-.01,.005),[.014,.045,.03],shade(skin,.95),'head');}});
    {const st=look.style||0,hc=hair,hd=shade(hair,.75),top=(k=1,arc=.5)=>M.cap(up(Hc,0,.012,-.012),[.112*k,.134*k,.129*k],hc,'head',[-.3,0,0],arc);
      const bangs=(n,len)=>{for(let i=0;i<n;i++){const u=n>1?i/(n-1)*2-1:0;M.cone(up(Hc,u*.082,.07-len/2+Math.abs(u)*.012,.108-Math.abs(u)*.03),.03,len,i%2?hd:hc,'head',[Math.PI+.3,0,-u*.5]);}};
      const locks=len=>{for(const s of S)M.cone(up(Hc,s*.108,.03-len/2,.03),.028,len,hd,'head',[Math.PI,0,s*.12]);};
      if(st===5)top(.985,.46);
      else if(st===1){top(1.02);bangs(3,.06);for(let i=0;i<11;i++){const a=i/11*TAU,r=i%2?.062:.03;M.cone(up(Hc,Math.sin(a)*r,.135+(i%2?0:.02),-.02+Math.cos(a)*r),.03,.11,i%2?hc:hd,'head',[Math.cos(a)*.6-.25,0,-Math.sin(a)*.6]);}}
      else if(st===2){top(1.04);bangs(5,.09);locks(.2);M.box(up(Hc,0,-.12,-.11),[.2,.3,.05],hc,'head',[.1,0,0]);for(const s of S)M.box(up(Hc,s*.09,-.14,-.07),[.05,.26,.07],hd,'head',[.06,0,s*.05]);}
      else if(st===3){top(1.03);bangs(4,.075);locks(.1);M.ball(up(Hc,0,.06,-.13),.036,hd,'head');M.cone(up(Hc,0,-.09,-.17),.04,.3,hc,'head',[Math.PI-.22,0,0],5);}
      else if(st===4){top(1.06,.56);bangs(5,.07);M.box(up(Hc,0,-.045,-.06),[.235,.17,.135],hc,'head');for(const s of S)M.box(up(Hc,s*.106,-.06,.02),[.03,.16,.1],hd,'head');}
      else{top(1.03);bangs(5,.085);locks(.11);for(let i=0;i<5;i++){const u=i/4*2-1;M.cone(up(Hc,u*.07,-.045,-.105+Math.abs(u)*.03),.03,.09,i%2?hc:hd,'head',[Math.PI-.35,0,u*.3]);}}
    }
    /* --- the trunk: hips, a waist, a chest that widens to the shoulders, with the muscle under the cloth --- */
    const g=kind==='plate'?.022:.012,wY=J.spine.y,cY=J.chest.y,sY=J.shL.y,front=.128,under=kind==='plate'?DSTEEL:kind==='leather'?'#3a3026':TROUSERS;
    M.limb(up(J.hips,0,-.12,0),up(J.spine,0,.02,0),.142,.132,under,'hips',{sz:.74,n:10});for(const s of S)M.ball(up(J.hips,s*.07,-.06,-.07),1,under,'hips',[.085,.09,.075]);   // hips, and a seat
    M.limb(up(J.spine,0,-.03,0),up(J.chest,0,.03,0),.13+g,.172+g,main,'spine',{sz:.68,n:10});
    M.limb(up(J.chest,0,-.03,0),V(0,sY-.01,0),.172+g,.192+g,main,'chest',{sz:.66,n:10});M.ball(V(0,sY-.015,0),1,main,'chest',[.192+g,.06,.124+g*.6]);
    for(const s of S){if(kind!=='plate')M.box(V(s*.078,cY+.1,.098),[.135,.1,.05],main,'chest',[-.12,s*.22,0]);                 // the chest's two plates of muscle
      M.ball(V(s*.15,cY+.02,-.03),1,main,'chest',[.07+g,.13,.085+g]);                                                          // the back's breadth
      M.ball(V(s*.115,sY+.012,-.012),1,kind==='plate'?DSTEEL:main,'chest',[.085,.05,.075]);}                                   // the slope from neck to shoulder
    const belt=(c=LEATHER)=>{M.limb(up(J.spine,0,-.045,0),up(J.spine,0,.02,0),.143+g,.14+g,c,'spine',{sz:.7,n:10});M.box(V(0,wY-.012,.103+g),[.06,.06,.02],BUCKLE,'spine');M.fine(()=>M.box(V(0,wY-.012,.114+g),[.03,.03,.01],shade(BUCKLE,.5),'spine'));
      M.box(V(.075,wY-.07,.094+g),[.03,.11,.012],c,'hips',[0,0,.12]);};
    // arms: a shoulder, an upper arm and a forearm with their bellies, a hand with a thumb
    const arms=(upC,foreC,handC,o={})=>{for(const s of S){const sh=s<0?J.shR:J.shL,el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL,ha=s<0?J.haR:J.haL,n=s<0?'r':'l',t=o.thick||0;
      M.ball(up(sh,s*.01,.005,0),1,upC,'upperarm'+n,[.082+t,.08+t,.084+t]);musc(sh,el,[.07+t,.08+t,.056+t+(o.flare||0)],.42,upC,'upperarm'+n);M.ball(el,.056+t,o.elbow||foreC,'lowerarm'+n);
      musc(el,wr,[.056+(o.fore||0),.064+(o.fore||0),.04+(o.fore||0)],.3,foreC,'lowerarm'+n);if(o.cuff){ring(el,wr,.76,1,.052,o.cuff,'lowerarm'+n);}
      M.box(V((wr.x+ha.x)/2+s*.05,wr.y,wr.z),[.15,.046,.092],handC,'wrist'+n);M.box(V(wr.x+s*.03,wr.y,wr.z+.055),[.06,.036,.036],handC,'wrist'+n);}};
    let cloth=null;
    if(kind==='tunic'){
      M.box(V(0,sY-.075,front+.008),[.085,.085,.02],skin,'chest',[0,0,.785]);M.limb(V(0,sY-.02,0),V(0,sY+.025,0),.092,.074,trim,'chest',{sz:.85});   // an open neck, laced, under a trimmed collar
      M.fine(()=>{for(let i=0;i<3;i++)M.box(V(0,sY-.1+i*.03,front+.02),[.06,.008,.008],'#d8cdb4','chest',[0,0,i%2?.5:-.5]);});
      for(const s of S){M.box(V(s*.062,cY+.03,front+.004),[.012,.24,.012],dark,'chest',[0,0,-s*.1]);M.box(V(s*.15,sY-.03,0),[.02,.03,.2],dark,'chest');}   // seams
      M.limb(up(J.spine,0,.03,0),up(J.spine,0,.05,0),.146,.15,trim,'spine',{sz:.68,n:10});
      belt();M.box(V(-.14,wY-.08,.05),[.075,.095,.055],LEATHER,'hips');M.box(V(-.14,wY-.05,.08),[.08,.03,.012],DLEATHER,'hips');stud(V(-.14,wY-.08,.082),BUCKLE,'hips');   // a pouch
      arms(main,skin,skin,{flare:.01,thick:.004,elbow:skin});
      for(const s of S){const sh=s<0?J.shR:J.shL,el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL,n=s<0?'r':'l';ring(sh,el,.9,1,.086,trim,'upperarm'+n);ring(el,wr,.55,1,.05,LEATHER,'lowerarm'+n);ring(el,wr,.62,.68,.054,DLEATHER,'lowerarm'+n);ring(el,wr,.86,.92,.049,DLEATHER,'lowerarm'+n);}
      cloth={len:.32,rows:3,gap:0,vent:false,c:main,hem:trim,rx:.158,rz:.116,flare:.07,stiff:.12};
    }else if(kind==='leather'){
      M.box(V(0,cY+.04,front+.004),[.034,.32,.014],DLEATHER,'chest');M.fine(()=>{for(let i=0;i<5;i++)M.box(V(0,cY-.08+i*.065,front+.014),[.08,.012,.01],'#b8a888','chest',[0,0,i%2?.25:-.25]);});   // laced down the front
      for(const s of S){for(let i=0;i<3;i++)M.box(V(s*(.075+i*.004),cY-.06+i*.085,front-.002+g),[.085,.075,.014],i%2?LEATHER:shade(LEATHER,1.2),'chest',[.05,0,s*.06]);   // overlapping panels, each riveted
        for(let i=0;i<3;i++)stud(V(s*.11,cY-.03+i*.085,front+.012),'#9aa0aa','chest');}
      M.box(V(0,cY+.1,front+.012),[.46,.045,.016],DLEATHER,'chest',[0,0,.42]);stud(V(.02,cY+.11,front+.024),BUCKLE,'chest',.03);                                 // the shoulder guard's strap
      M.ball(up(J.shL,.01,.04,0),1,DLEATHER,'upperarml',[.125,.07,.12]);M.ball(up(J.shL,.06,.0,0),1,LEATHER,'upperarml',[.105,.06,.11]);M.ball(up(J.shL,.1,-.045,0),1,DLEATHER,'upperarml',[.085,.05,.095]);
      for(let i=0;i<3;i++)stud(up(J.shL,.03+i*.035,.085-i*.04,.07),'#9aa0aa','upperarml');
      M.limb(V(0,sY-.02,0),V(0,sY+.035,0),.094,.08,DLEATHER,'chest',{sz:.85});
      belt(DLEATHER);M.box(V(-.145,wY-.08,.05),[.075,.1,.055],LEATHER,'hips');stud(V(-.145,wY-.07,.082),BUCKLE,'hips');M.box(V(.15,wY-.1,.02),[.032,.2,.032],DLEATHER,'hips',[.15,0,.1]);M.box(V(.146,wY+.01,.03),[.05,.02,.05],'#9aa0aa','hips');   // a pouch; a knife in its sheath
      arms(tint,LEATHER,skin,{fore:.008,elbow:tint});for(const s of S){const el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL,n=s<0?'r':'l';for(const t of[.2,.5,.8])ring(el,wr,t,t+.07,.071-t*.02,DLEATHER,'lowerarm'+n);}
      cloth={len:.26,rows:3,gap:0,vent:false,c:DLEATHER,hem:LEATHER,rx:.16,rz:.118,flare:.07,stiff:.22,flaps:4};
    }else if(kind==='coat'){
      M.box(V(0,cY+.03,front+.002),[.04,.36,.012],shade(tint,.4),'chest');                                                                                                 // open down the front, over a dark shirt
      for(const s of S){M.box(V(s*.055,cY+.11,front+.012),[.04,.22,.014],trim,'chest',[0,0,-s*.22]);M.box(V(s*.072,cY+.11,front+.008),[.05,.24,.012],main,'chest',[0,0,-s*.22]);   // lapels, edged
        M.box(V(s*.034,cY-.09,front+.004),[.014,.2,.012],trim,'spine');for(let i=0;i<4;i++)stud(V(s*.06,cY-.13+i*.06,front+.006),BUCKLE,'spine',.018);                     // two rows of buttons
        M.box(V(s*.125,wY+.06,.085),[.07,.012,.03],dark,'spine');                                                                                                         // pocket flaps
        M.box(V(s*.185,sY+.012,0),[.11,.02,.07],dark,'chest');stud(V(s*.215,sY+.026,0),BUCKLE,'chest',.02);}                                                              // shoulder tabs
      M.box(V(0,cY+.05,-.126),[.012,.38,.012],dark,'chest');                                                                                                               // the back seam
      for(let i=0;i<5;i++){const a=(i-2)*.62+Math.PI;M.box(V(Math.sin(a)*.09,sY+.062,Math.cos(a)*.078-.004),[.095,.13,.016],i%2?dark:main,'chest',[.24,a,0]);M.fine(()=>M.box(V(Math.sin(a)*.096,sY+.122,Math.cos(a)*.084-.004),[.095,.014,.018],trim,'chest',[.24,a,0]));}   // a high collar, edged, open at the throat
      for(const s of S)M.box(V(s*.085,sY+.05,.062),[.06,.11,.016],main,'chest',[-.1,s*.6,s*.1]);
      for(const y of[cY+.13,cY+.03]){M.box(V(0,y,front+.02),[.36,.032,.014],DLEATHER,'chest');M.box(V(.07,y,front+.03),[.042,.048,.012],BUCKLE,'chest');M.fine(()=>M.box(V(.07,y,front+.037),[.022,.026,.008],DLEATHER,'chest'));}   // straps across the chest
      belt(DLEATHER);
      arms(main,main,DLEATHER,{thick:.008,fore:.01,cuff:trim});for(const s of S){const el=s<0?J.elR:J.elL,wr=s<0?J.wrR:J.wrL,n=s<0?'r':'l';ring(el,wr,.7,.76,.056,dark,'lowerarm'+n);stud(mid(el,wr,.86).add(V(0,.05,0)),BUCKLE,'lowerarm'+n,.018);}
      cloth={len:.82,rows:6,gap:.5,vent:true,c:main,hem:trim,rx:.166,rz:.126,flare:.15,stiff:.05};
    }else{
      M.box(V(0,cY+.07,front+.03),[.05,.26,.05],trim,'chest',[0,.785,0]);                                                                                                   // a keeled breastplate, fluted
      M.fine(()=>{for(const s of S)for(let i=0;i<2;i++)M.box(V(s*(.05+i*.045),cY+.06,front+.03-i*.012),[.008,.2,.01],DSTEEL,'chest',[0,0,-s*.12]);});
      M.limb(V(0,sY-.03,0),V(0,sY+.05,0),.108,.082,DSTEEL,'chest',{sz:.9});M.limb(V(0,sY+.03,0),V(0,sY+.05,0),.088,.086,trim,'chest',{sz:.9});                                // the gorget
      M.limb(up(J.spine,0,-.07,0),up(J.spine,0,.035,0),.158,.152,DSTEEL,'spine',{sz:.7,n:10});M.limb(up(J.spine,0,.03,0),up(J.spine,0,.045,0),.158,.158,trim,'spine',{sz:.7,n:10});
      M.box(V(0,wY-.02,.112),[.34,.034,.014],tint,'spine');M.box(V(0,wY-.02,.122),[.06,.06,.016],BUCKLE,'spine');
      for(const s of S){const n=s<0?'r':'l',sh=s<0?J.shR:J.shL;M.ball(up(sh,s*.01,.045,0),1,STEEL,'upperarm'+n,[.14,.08,.135]);M.ball(up(sh,s*.075,.005,0),1,trim,'upperarm'+n,[.115,.062,.12]);M.ball(up(sh,s*.125,-.035,0),1,STEEL,'upperarm'+n,[.09,.05,.1]);
        for(let i=0;i<3;i++)stud(up(sh,s*(.02+i*.05),.1-i*.045,.09),DSTEEL,'upperarm'+n);M.ball(V(s*.15,sY-.07,.1),1,trim,'chest',[.045,.045,.016]);                          // rivets; a disc at the armpit
        const el=s<0?J.elR:J.elL;M.cone(up(el,0,0,-.06),.03,.07,trim,'lowerarm'+n,[-1.57,0,0]);}                                                                              // a point at the elbow
      for(let i=0;i<6;i++){const a=[-.45,.45,-1.4,1.4,Math.PI-.5,Math.PI+.5][i],x=Math.sin(a),z=Math.cos(a);M.box(V(x*.152,wY-.15,z*.114),[.125,.2,.02],i<2?STEEL:DSTEEL,'hips',[.16,a,0]);
        M.box(V(x*.158,wY-.245,z*.12),[.125,.02,.024],trim,'hips',[.16,a,0]);stud(V(x*.158,wY-.1,z*.122),DSTEEL,'hips');}                                                      // tassets, edged and riveted
      arms(STEEL,STEEL,DSTEEL,{thick:.01,fore:.012,elbow:trim,cuff:trim});
      cloth={len:.48,rows:4,c:tint,hem:shade(tint,1.5),rx:.136,rz:.1,flare:.03,stiff:.05,tabard:true};
    }
    /* --- legs: a thigh and a calf with their bellies, trousers or steel, then the boots by their kind --- */
    const legC=under,bk=kind==='plate'?'greaves':boots;
    for(const s of S){const n=s<0?'r':'l',hj=s<0?J.hjR:J.hjL,kn=s<0?J.knR:J.knL,an=s<0?J.anR:J.anL,to=s<0?J.toR:J.toL,m=mid(kn,an,.36),fz=(an.z+to.z)/2+.03;
      musc(hj,kn,[.12,.128,.086],.32,legC,'upperleg'+n);M.ball(hj,.12,legC,'upperleg'+n);
      if(kind==='plate'){M.box(mid(hj,kn,.5).add(V(0,0,.09)),[.13,.28,.03],STEEL,'upperleg'+n);M.box(mid(hj,kn,.5).add(V(0,0,.108)),[.02,.26,.012],trim,'upperleg'+n);}
      if(bk==='greaves'){M.ball(up(kn,0,0,.016),.09,STEEL,'lowerleg'+n);M.ball(up(kn,0,0,.06),1,trim,'lowerleg'+n,[.05,.06,.03]);musc(kn,an,[.082,.092,.06],.3,STEEL,'lowerleg'+n,{back:.012});
        M.box(mid(kn,an,.5).add(V(0,0,.07)),[.03,.32,.02],trim,'lowerleg'+n);for(const t of[.25,.75])ring(kn,an,t,t+.05,.092-t*.03,DSTEEL,'lowerleg'+n);
        M.box(V(an.x,.06,fz),[.12,.1,.25],DSTEEL,'foot'+n);M.box(V(an.x,.045,to.z+.05),[.1,.06,.09],STEEL,'foot'+n);M.box(V(an.x,.105,fz-.02),[.1,.02,.14],trim,'foot'+n);}
      else if(bk==='striders'){M.ball(kn,.078,legC,'lowerleg'+n);musc(kn,an,[.074,.084,.05],.3,legC,'lowerleg'+n,{back:.012});for(let i=0;i<5;i++)ring(kn,an,.3+i*.13,.37+i*.13,.082-i*.007,i%2?'#8a7a5a':'#a39478','lowerleg'+n);
        M.box(V(an.x,.05,fz),[.1,.08,.23],'#5a4a36','foot'+n);M.box(V(an.x,.018,fz),[.105,.026,.24],'#2a2018','foot'+n);M.fine(()=>M.box(V(an.x,.09,fz+.02),[.104,.012,.03],'#a39478','foot'+n));}
      else{M.ball(kn,.078,legC,'lowerleg'+n);M.limb(kn,m,.076,.082,legC,'lowerleg'+n);musc(m,an,[.088,.084,.06],.35,DLEATHER,'lowerleg'+n,{back:.01});ring(m,an,-.08,.08,.094,LEATHER,'lowerleg'+n);   // a boot to below the knee, its top turned down
        for(const t of[.35,.7]){ring(m,an,t,t+.07,.09-t*.03,LEATHER,'lowerleg'+n);M.box(mid(m,an,t+.035).add(V(s*.02,0,.085-t*.03)),[.034,.034,.012],BUCKLE,'lowerleg'+n);}             // two straps, buckled
        M.box(V(an.x,.055,fz),[.115,.095,.24],DLEATHER,'foot'+n);M.box(V(an.x,.02,fz),[.12,.03,.25],'#15100c','foot'+n);M.box(V(an.x,.06,to.z+.055),[.1,.07,.07],LEATHER,'foot'+n);}}  // a sole, a toe cap
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
    const{pts,anchors,rest,N,cp}=cl;cl.hips.matrixWorld.decompose(tA,qH,sH);const sc=sH.y,seg=cl.seg*sc,rad=.125*sc;
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
    for(const n of['handslotl','handslotr']){const b=bones[n];if(b)for(const c of b.children)c.scale.multiplyScalar(.46);}   // (their weapons were made for big hands)
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

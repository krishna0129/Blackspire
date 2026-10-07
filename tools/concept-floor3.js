#!/usr/bin/env node
'use strict';
// Concept art for floor 3 (docs/design/floor-3.md). Not game assets: nothing here is loaded by the game.
// The sprites are drawn as character maps in the same style as tools/make_sprites.py (dark body, bone highlights,
// eyes on their own layer so they glow), then put through the game's own sprite and drawing code in a headless
// browser: a line-up of the new cast, and two staged scenes.
//
//   node tools/concept-floor3.js        writes docs/design/img/floor3-*.png   (needs Playwright, as wiki-images.js)

const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'docs','design','img');

// ---- the cast. '.' is empty; o, O and L also go on the eye layer, so they glow through the dark.
const PAL={'#':'#0d0d13','+':'#6f6a5a','B':'#b9b4a6','g':'#4f5b3a','G':'#6c7a4a','r':'#2b2238','R':'#463a5c','v':'#2f3d22','V':'#4d6233',
  't':'#b9b4a6','p':'#6b1f2a','P':'#a83a46','y':'#d9a441','W':'#b8b4c4','w':'#6b4a2c','l':'#8a6a2a','o':'#0d0d13','O':'#2f3d22','L':'#8a6a2a'};
const CAST={
  thrall:{name:'Rotting thrall',eye:'#c8e06a',glow:{},line:'#56603d',r:6,scale:1,map:[
    '....++++.....',
    '...++++++....',
    '...+o++o+....',
    '...++#+#+....',
    '....+++B.....',
    '..ggg##ggg...',
    '.gG######gg..',
    '.g.#gg###.g..',
    '.g.##g###.G..',
    '.G.######..g.',
    'GG..####...gG',
    '....#gg#.....',
    '...##..##....',
    '...g#..#g....',
    '...##..##....',
    '..###..###...']},
  gravecaller:{name:'Gravecaller',eye:'#9be08a',glow:{O:'#9be08a'},line:'#4d4066',r:6,scale:1,map:[
    '.........O...',
    '........OOO..',
    '....rrr..O...',
    '...rrrrr.w...',
    '..rr###rrw...',
    '..r#o#o#rw...',
    '..r#+++#rw...',
    '..rr#+#rrw...',
    '.rrRrrrRrw...',
    'rrRrrrrrRw...',
    'r.rRrrrRrw...',
    '..rrRrRrrw...',
    '..rrrRrrrw...',
    '..rrrrrrrw...',
    '.rrrrrrrrr...',
    'rrrr.rrrrrr..']},
  thornroot:{name:'Thornroot',eye:'#f08a3c',glow:{},line:'#3b4a2a',r:8,scale:1,map:[
    'vv..............',
    'vVv...........t.',
    '.vVv.......t.vv.',
    '..vVvv...t.vvVv.',
    '...vVVvvvvvVv...',
    '..t.vvVVVVvv....',
    '.....vVppPVv.t..',
    '....vVpPPPpVv...',
    '...tvVpPoPpVvt..',
    '....vVpPPPpVv...',
    '.....vVpppVv....',
    '..t..vvVVVvv.t..',
    '....vv.vv.vv....',
    '...v...v...v....']},
  bloodbloom:{name:'Bloodbloom',eye:'#9be08a',glow:{},line:'#5a2630',r:6,scale:1,map:[
    '....pPPp....',
    '..pPp..pPp..',
    '.pP.pPPp.Pp.',
    '.P.pPyyPp.P.',
    'pP.PyooyP.Pp',
    'pP.PyooyP.Pp',
    '.P.pPyyPp.P.',
    '.pP.pPPp.Pp.',
    '..pPp..pPp..',
    '.V..pVVp..V.',
    '..VV.VV.VV..',
    '....vVVv....']},
  collector:{name:'The Pale Collector',eye:'#9be08a',glow:{L:'#ffe9a8'},line:'#9a95aa',r:15,scale:2,map:[
    '.....+.++.+.....',
    '.....++++++.....',
    '....+WWWWWW+....',
    '....WWoWWoWW....',
    '....WWWWWWWW....',
    '.....W#WW#W.....',
    '......WWWW......',
    '....########....',
    '...##########...',
    '..###r####r###..',
    '..#.##r##r##.#..',
    '.W#.########.#W.',
    '.W..##r##r##..W.',
    '.W..########..l.',
    '.W..##r##r##.lLl',
    '.W...######..LLL',
    '.....######..lLl',
    '.....##r##r#....',
    '....########....',
    '....##.##.##....',
    '...###.##.###...',
    '..####....####..']},
  corpse:{name:'Corpse',eye:'#000000',glow:{},line:'#4a4638',r:5,scale:1,map:[
    '..++++........',
    '.+#++#+.#####.',
    '.++++++######+',
    '..+#+#..#####.',
    '.........+..+.']},
};

(async()=>{
  const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
  const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
    if(!f.startsWith(ROOT)){res.writeHead(404).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}).end(d);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const exe=process.env.CHROMIUM||(fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined);
  const browser=await chromium.launch(exe?{executablePath:exe}:{});
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>typeof mode!=='undefined'&&mode==='title'&&!!AV);
  fs.mkdirSync(OUT,{recursive:true});

  // ---- teach the page the new cast and the floor 3 look (in this page only)
  await page.evaluate(([CAST,PAL])=>{
    for(const [type,c] of Object.entries(CAST)){
      const w=c.map[0].length*c.scale+2,h=c.map.length*c.scale+2,[b,bx]=mk(w,h),[e,ex]=mk(w,h);
      c.map.forEach((row,y)=>[...row].forEach((ch,x)=>{if(ch==='.')return;
        bx.fillStyle=PAL[ch];bx.fillRect(1+x*c.scale,1+y*c.scale,c.scale,c.scale);
        const glow=ch==='o'?c.eye:c.glow[ch];if(glow){ex.fillStyle=glow;ex.fillRect(1+x*c.scale,1+y*c.scale,c.scale,c.scale);}}));
      IMG['enemies/'+type]=b;IMG['enemies/'+type+'_eyes']=e;
      ETYPES[type]={name:c.name,hp:1,dmg:1,speed:1,r:c.r,xp:1,eye:c.eye,line:c.line};
    }
    // carrion beetle: the skitter, recoloured
    {const s=IMG['enemies/skitter'],[b,bx]=mk(s.width,s.height);bx.filter='hue-rotate(95deg) saturate(1.6) brightness(1.15)';bx.drawImage(s,0,0);
      IMG['enemies/beetle']=b;IMG['enemies/beetle_eyes']=IMG['enemies/skitter_eyes'];ETYPES.beetle=Object.assign({},ETYPES.skitter,{name:'Carrion beetle',line:'#4f3a3a'});}
    // the floor 3 stone: older, rootbound
    THEMES[2]={f:['#1b1a15','#1d1c16','#191812'],grid:'#14130f',speck:'#2b2a20',crack:'#0d0c09',face:'#2c2a20',brick:'#211f17',top:'#4a4433',wall:'#1a1913',edge:'#29271d',bones:'#55513f'};
  },[CAST,PAL]);

  // ---- 1. the line-up
  const lineup=await page.evaluate(()=>{
    const order=[['thrall',6],['gravecaller',6],['thornroot',6],['bloodbloom',6],['beetle',6],['collector',4]],pad=24,gap=26,top=56;
    const items=order.map(([t,s])=>{const sp=enemySprite(t,false,null);const[c,x]=mk(sp.fw,sp.fh);x.drawImage(sp.c,0,0);if(sp.eyes)x.drawImage(sp.eyes,0,0);return{t,s,c,w:sp.fw*s,h:sp.fh*s};});
    const W=pad*2+items.reduce((a,i)=>a+i.w+gap,-gap),H=top+Math.max(...items.map(i=>i.h))+58;
    const [cv,x]=mk(W,H);x.fillStyle='#0d0d12';x.fillRect(0,0,W,H);
    x.font='600 16px system-ui,Segoe UI,Helvetica,Arial,sans-serif';x.fillStyle='#e6e1d3';x.fillText('Floor 3 cast (concept)',pad,30);
    x.font='12px system-ui,Segoe UI,Helvetica,Arial,sans-serif';x.fillStyle='#8d8b98';x.fillText('Drawn in the game’s sprite style and outlined by its own code. Eyes and glows show through the dark.',pad,48);
    let px=pad;const base=top+Math.max(...items.map(i=>i.h));
    for(const i of items){x.imageSmoothingEnabled=false;x.drawImage(i.c,px,base-i.h,i.w,i.h);
      x.font='600 12px system-ui,Segoe UI,Helvetica,Arial,sans-serif';x.fillStyle='#e6e1d3';x.textAlign='center';x.fillText(ETYPES[i.t].name,px+i.w/2,base+22);
      x.font='11px system-ui,Segoe UI,Helvetica,Arial,sans-serif';x.fillStyle='#8d8b98';
      x.fillText({thrall:'slow tank, rises again',gravecaller:'raises the dead',thornroot:'grows from walls',bloodbloom:'heals its allies',beetle:'swarm (recolour)',collector:'floor 3 boss'}[i.t],px+i.w/2,base+38);
      x.textAlign='left';px+=i.w+gap;}
    return cv.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT,'floor3-cast.png'),Buffer.from(lineup.split(',')[1],'base64'));

  // ---- 2 and 3. staged scenes in the real renderer
  async function scene(file,setup){
    await page.evaluate(setup);await page.waitForTimeout(250);
    await page.screenshot({path:path.join(OUT,file)});
  }
  const common=`
    S=newState('Wanderer',{skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0]},'sword',OUTFITS[2]);S.char.level=14;
    S.equip.armor=makeArmor('leather',3,2,OUTFITS[5]);S.equip.weapon=makeWeapon('great',3,3);
    // the game's frame loop redraws the canvas every frame: pause it while a shot is staged, and draw it ourselves
    window.__render=window.__render||render;render=()=>{};const draw=window.__render;
    startWorld(3);refreshSprites();refreshHudStatic();mode='shot';
    for(const id of['#title','#banner','#toasts','#prompt'])$(id).hidden=true;$('#hud').hidden=false;
    // roots creep in from the walls, and thorn patches gather at the edges of rooms
    {const x=G.mapCv.getContext('2d');
      for(let ty=1;ty<MH-1;ty++)for(let tx=1;tx<MW-1;tx++){if(G.map[ty*MW+tx]!==1)continue;const h=hash2(tx,ty,33);
        const nearWall=G.map[(ty-1)*MW+tx]===2||G.map[ty*MW+tx-1]===2||G.map[ty*MW+tx+1]===2;
        if(nearWall&&h<.35){x.fillStyle=h<.17?'#2f3d22':'#3b4a2a';const px=tx*TILE,py=ty*TILE;
          for(let i=0;i<9;i++)x.fillRect(px+((h*97+i*5)%14|0),py+((h*53+i*3)%6|0)+i,1+(i%3===0),1);
          if(h<.08){x.fillStyle='#b9b4a6';x.fillRect(px+(h*700%12|0),py+5,1,1);}}}}
    G.thorns=(tx,ty,w,h)=>{const x=G.mapCv.getContext('2d');for(let j=0;j<h*TILE;j+=2)for(let i=0;i<w*TILE;i+=2){const q=hash2(tx*16+i,ty*16+j,7);
      if(q<.45){x.fillStyle=q<.2?'#2f3d22':'#4d6233';x.fillRect(tx*TILE+i,ty*TILE+j,2,1);}else if(q>.93){x.fillStyle='#b9b4a6';x.fillRect(tx*TILE+i,ty*TILE+j,1,1);}}};
    const E=(type,dx,dy,o={})=>{const e=Object.assign(makeEnemy(type==='beetle'?'skitter':'skitter',P.x+dx,P.y+dy,1,1,!!o.elite),{type,r:ETYPES[type].r,state:o.state||'chase',face:o.face||-1,dir:0,ph:o.ph||0},o);G.enemies.push(e);return e;};
  `;
  // a floor 3 room: thralls in front, a Gravecaller raising a corpse behind them, a Bloodbloom healing, a Thornroot lashing from the wall
  await scene('floor3-scene-room.png',new Function(common+`
    const r=G.rooms.filter(q=>q.kind==='room').sort((a,b)=>b.w*b.h-a.w*a.h)[0];
    P.x=(r.x+2.5)*TILE;P.y=(r.y+r.h/2)*TILE;P.dir=3;P.aim=0;P.safe=false;G.enemies=[];G.drops=[];
    G.thorns(r.x+r.w-3,r.y+r.h-2,2,1);G.thorns(r.x,r.y,2,1);
    const c=E('corpse',62,26,{state:'idle',face:1});
    const g=E('gravecaller',86,-6,{face:-1,state:'windup'});
    E('thrall',30,-10);E('thrall',38,16,{ph:1});E('thrall',58,-30,{ph:2,elite:true});
    E('bloodbloom',72,50,{state:'idle'});E('beetle',-22,34,{face:1});E('beetle',-34,24,{face:1,ph:2});
    const t=E('thornroot',-6,-((r.h/2-0.5)*TILE)+2,{state:'idle'});
    G.tele=[{line:true,x:t.x,y:t.y+6,a:Math.PI/2+.12,len:52,t:.55,d:1}];
    draw();reveal();drawMini();updateHud();
    // magic drawn over the dark: the Gravecaller's channel into the corpse, the Bloodbloom's healing pulse
    const sx=x=>Math.round(x-camX),sy=y=>Math.round(y-camY);
    for(let i=0;i<=16;i++){const u=i/16;ctx.fillStyle=i%2?'#9be08a':'#d8f5c8';ctx.fillRect(sx(g.x-6+(c.x-g.x+6)*u),sy(g.y-14+(c.y-g.y+14)*u+Math.sin(u*9)*2),1,1);}
    dotArc(sx(c.x),sy(c.y),9,0,TAU,'#9be08a');dotArc(sx(c.x),sy(c.y),5,1,4,'#d8f5c8');
    const b=G.enemies.find(e=>e.type==='bloodbloom');dotArc(sx(b.x),sy(b.y),26,0,TAU,'#9be08a');dotArc(sx(b.x),sy(b.y),22,.5,3.5,'#5f9e55');
    for(const e of G.enemies)if(e.type==='thrall'&&Math.hypot(e.x-b.x,e.y-b.y)<60){ctx.fillStyle='#9be08a';ctx.fillRect(sx(e.x)+5,sy(e.y)-14,1,3);ctx.fillRect(sx(e.x)+4,sy(e.y)-13,3,1);}
  `));
  // the Pale Collector's chamber, phase 2: the lantern sweep, thralls walking in to feed it
  await scene('floor3-scene-boss.png',new Function(common+`
    const r=G.boss;P.x=(r.x+r.w/2-2)*TILE;P.y=(r.y+r.h/2+3)*TILE;P.dir=1;P.aim=-Math.PI/2;P.safe=false;P.locked=true;G.enemies=[];G.drops=[];
    const bx=(r.x+r.w/2)*TILE,by=(r.y+r.h/2)*TILE;
    const b=E('collector',bx-P.x,by-P.y,{boss:true,state:'cast',face:1});
    for(const [i,j] of[[2,2],[r.w-3,2],[2,r.h-3],[r.w-3,r.h-3],[r.w-2,r.h/2|0]])E('corpse',(r.x+i)*TILE-P.x,(r.y+j)*TILE-P.y,{state:'idle'});
    E('thrall',(r.x+3)*TILE-P.x,(r.y+3.5)*TILE-P.y,{face:1});E('thrall',(r.x+r.w-4)*TILE-P.x,(r.y+r.h-4)*TILE-P.y,{face:-1,ph:1});
    G.tele=[{line:true,x:bx,y:by,a:-.35,len:150,t:.6,d:1}];G.bossAwake=true;G.bossEnt=b;b.hp=b.maxHp*.58;b.name='The Pale Collector';bossBar('The Pale Collector');
    draw();reveal();drawMini();updateHud();
    const sx=x=>Math.round(x-camX),sy=y=>Math.round(y-camY);
    // where the thralls are heading, and the lantern's glow
    for(const e of G.enemies)if(e.type==='thrall')for(let i=2;i<14;i+=2){const u=i/16;ctx.fillStyle='#9be08a';ctx.globalAlpha=.6;ctx.fillRect(sx(e.x+(bx-e.x)*u),sy(e.y+(by-e.y)*u),1,1);}
    ctx.globalAlpha=1;ctx.globalCompositeOperation='lighter';ctx.fillStyle='#e2b93b';for(const [rr,al] of[[30,.05],[18,.08],[9,.12]]){ctx.globalAlpha=al;ctx.beginPath();ctx.arc(sx(bx+14),sy(by+2),rr,0,TAU);ctx.fill();}
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  `));
  await browser.close();server.close();
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  console.log('wrote docs/design/img/floor3-cast.png, floor3-scene-room.png, floor3-scene-boss.png');
})();

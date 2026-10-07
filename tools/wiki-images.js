#!/usr/bin/env node
'use strict';
// Renders the wiki's game images (docs/wiki/img/*.png) with the game's own drawing code, in a headless browser, so
// the pictures always look like the game. Run it after changing sprites or anything the pictures show:
//
//   npm install                  (Playwright is a dev dependency)
//   npx playwright install chromium   (once, unless a Chromium is already set up)
//   node tools/wiki-images.js
//
// Charts are not made here: tools/wiki.js writes those as SVG alongside the pages.

const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'docs','wiki','img'),DESIGN=path.join(ROOT,'docs','design','img');

(async()=>{
  const exe=process.env.CHROMIUM||(fs.existsSync('/opt/pw-browsers/chromium')?'/opt/pw-browsers/chromium':undefined);
  const browser=await chromium.launch(exe?{executablePath:exe}:{});
  // served over http: a canvas that has drawn images from file:// cannot be read back
  const http=require('node:http'),TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
  const server=http.createServer((req,res)=>{const f=path.join(ROOT,decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'')||'index.html');
    if(!f.startsWith(ROOT)){res.writeHead(404).end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'}).end(d);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const page=await browser.newPage({viewport:{width:960,height:540}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(()=>typeof mode!=='undefined'&&mode==='title'&&!!AV);
  fs.mkdirSync(OUT,{recursive:true});fs.mkdirSync(DESIGN,{recursive:true});
  const save=(dir,name,dataUrl)=>fs.writeFileSync(path.join(dir,name),Buffer.from(dataUrl.split(',')[1],'base64'));

  // ---- portraits and icons, drawn into an offscreen canvas and scaled up with crisp pixels
  const art=await page.evaluate(()=>{
    const BG='#0d0d12',out={};
    const frame=(src,sx,sy,w,h,scale,pad=3,extra)=>{const c=document.createElement('canvas');c.width=(w+pad*2)*scale;c.height=(h+pad*2)*scale;
      const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.fillStyle=BG;x.fillRect(0,0,c.width,c.height);
      x.drawImage(src,sx,sy,w,h,pad*scale,pad*scale,w*scale,h*scale);if(extra)extra(x);return c.toDataURL('image/png');};
    const enemy=(type,elite,skin,scale)=>{const s=enemySprite(type,elite,skin);
      const c=document.createElement('canvas');c.width=s.fw;c.height=s.fh;const x=c.getContext('2d');x.drawImage(s.c,0,0,s.fw,s.fh,0,0,s.fw,s.fh);if(s.eyes)x.drawImage(s.eyes,0,0,s.fw,s.fh,0,0,s.fw,s.fh);
      return frame(c,0,0,s.fw,s.fh,scale);};
    for(const t of Object.keys(ETYPES))if(t!=='boss'){out['enemy-'+t]=enemy(t,false,null,6);out['enemy-'+t+'-elite']=enemy(t,true,null,6);}
    out['boss-warden']=enemy('boss',false,'boss',5);out['boss-regent']=enemy('boss',false,'boneboss',5);out['boss-collector']=enemy('boss',false,'collector',5);
    // item icons, as the bag shows them
    const icon=it=>{const c=document.createElement('canvas');c.width=c.height=24;drawItemIcon(c,it);return frame(c,0,0,24,24,4,0);};
    for(const t of Object.keys(WTYPES))if(t!=='grimoire')out['item-'+t]=icon({slot:'weapon',type:t,tint:WTYPES[t].ranged?BOWS[0]:BLADES[0],rarity:0});
    out['item-grimoire-magic']=icon({slot:'weapon',type:'grimoire',tint:GRIM.magic.tint,school:'magic',rarity:0});
    out['item-grimoire-faith']=icon({slot:'weapon',type:'grimoire',tint:GRIM.faith.tint,school:'faith',rarity:0});
    for(const t of Object.keys(ATYPES))out['item-armor-'+t]=icon({slot:'armor',type:t,tint:OUTFITS[1],rarity:0});
    for(const t of Object.keys(BTYPES))out['item-boots-'+t]=icon({slot:'boots',type:t,tint:'#4a3524',rarity:0});
    out['item-trinket']=icon({slot:'trinket',type:'ring',tint:'#dcb65c',rarity:0});
    RARITY.forEach((r,i)=>{out['rarity-'+i]=icon({slot:'weapon',type:'sword',tint:i>=2?BLADES[i+1]:BLADES[0],rarity:i});});
    // what lies on the ground, drawn the way render.js draws drops
    const ground=(draw)=>{const c=document.createElement('canvas');c.width=c.height=9;const x=c.getContext('2d');draw(x,4,4);return frame(c,0,0,9,9,8,1);};
    out['drop-shard']=ground((x,X,Y)=>{x.fillStyle='#6fd6e6';x.fillRect(X,Y-1,1,3);x.fillRect(X-1,Y,3,1);});
    out['drop-potion']=ground((x,X,Y)=>{x.fillStyle='#050508';x.fillRect(X-2,Y-3,5,6);x.fillStyle='#d9534f';x.fillRect(X-1,Y-1,3,3);x.fillStyle='#e6e1d3';x.fillRect(X,Y-2,1,1);});
    for(const k of Object.keys(MATS))out['drop-'+k]=ground((x,X,Y)=>{x.fillStyle='#050508';x.fillRect(X-2,Y-2,4,4);x.fillStyle=MATS[k].color;x.fillRect(X-1,Y-1,2,2);});
    out['drop-item']=ground((x,X,Y)=>{x.fillStyle='#050508';x.fillRect(X-3,Y-1,7,3);x.fillRect(X-1,Y-3,3,7);x.fillStyle=RARITY[2].color;x.fillRect(X-2,Y,5,1);x.fillRect(X,Y-2,1,5);x.fillRect(X-1,Y-1,3,3);x.fillStyle='#fff';x.fillRect(X,Y,1,1);});
    return out;
  });
  for(const [k,v] of Object.entries(art))save(OUT,k+'.png',v);

  // ---- boss attacks: set up a fight, force one attack, stop while its red warning is on screen, and photograph it
  // frames: how long to let it play on after the warning appears (for attacks shown in flight rather than as a warning)
  async function bossShot(name,floor,setup,frames=0){
    await page.evaluate(([floor,setup,frames])=>{
      mode='shot';for(const id of['#title','#hud','#banner','#toasts'])$(id).hidden=true;
      S=newState('Wiki',{skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0]},'sword',OUTFITS[0]);S.char.level=20;
      startWorld(floor);god=true;const b=G.bossEnt,r=G.boss;
      G.enemies=[b];P.x=(r.x+r.w/2)*TILE;P.y=(r.y+r.h/2)*TILE;P.locked=true;P.safe=false;
      b.x=P.x;b.y=P.y-20;G.bossAwake=true;b.state='chase';b.atkT=0;b.lastAtk=null;
      const lit=document.createElement('canvas');lit.width=W;lit.height=H;light=lit;   // no darkness, so the whole warning shows
      new Function('b','P',setup)(b,P);
      const real=Math.random;Math.random=()=>window.__r;
      for(let i=0;i<3&&!G.tele.length;i++)simUpdate(1/60);
      Math.random=real;
      for(let i=0;i<200&&G.tele.length&&G.tele[0].t<G.tele[0].d*.6;i++){simUpdate(1/60);}
      for(let i=0;i<frames;i++)simUpdate(1/60);
      G.parts=[];G.nums=[];render();
    },[floor,setup,frames]);
    // the player is at the centre of the view: keep the chamber around them, not the void past the map's edge
    await page.screenshot({path:path.join(OUT,name+'.png'),clip:{x:250,y:40,width:460,height:440}});
  }
  // Bone Regent (floor 2): boneAttack picks by distance and a random number
  await bossShot('attack-regent-slam',2,'window.__r=.1;P.y=b.y+30;');
  await bossShot('attack-regent-cross',2,'window.__r=.5;P.y=b.y+30;');
  await bossShot('attack-regent-spikes',2,'window.__r=.8;P.y=b.y+30;');
  await bossShot('attack-regent-fan',2,'window.__r=.2;P.y=b.y+90;');
  // Gate Warden (floor 1): close = slam, far = targeted burst or charge
  await bossShot('attack-warden-slam',1,'window.__r=.1;P.y=b.y+30;');
  await bossShot('attack-warden-burst',1,'window.__r=.1;P.y=b.y+90;');
  await bossShot('attack-warden-charge',1,'window.__r=.9;P.y=b.y+90;');
  // The Pale Collector (floor 3): bolts and the beam are shown in flight; raising is shown during its channel
  await bossShot('attack-collector-bolts',3,'window.__r=.9;b.raiseT=99;P.y=b.y+80;',22);
  await bossShot('attack-collector-raise',3,'window.__r=.9;b.raiseT=0;P.y=b.y+60;',30);
  await bossShot('attack-collector-sweep',3,'window.__r=.1;b.raiseT=99;b.hp=b.maxHp*.5;P.y=b.y+70;',70);
  await browser.close();server.close();
  if(errors.length){console.error(errors.join('\n'));process.exit(1);}
  console.log('wrote',Object.keys(art).length+10,'images to docs/wiki/img and docs/design/img');
})();

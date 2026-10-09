'use strict';
// Blackspire: sprites. Nothing in this file paints a character, weapon, piece of gear or enemy in code.
// Every sprite is a PNG file under assets/sprites/ (assets/README.md explains the layout), loaded once at start-up.
//
// Pixel ratio. All sizes and positions in the game are in game pixels. A sprite file may be drawn finer than that:
// its ratio is how many file pixels make one game pixel (SPRITE_RATIO below, 1 when not listed). Every image and
// canvas here carries its ratio as .r, mk() makes canvases whose context draws in game pixels, and put()/cut() draw
// any of them at their game size. So finer art drops in without touching a position, and the screen renders finer
// (RES in input.js) only when some art needs it.

/* ---------- sprites ---------- */
const SPRITE_DIR='assets/sprites/';
const SPRITE_NAMES=[
  'character/base', 'character/eyes_tint', 'character/hair_bob_tint', 'character/hair_buzz_tint', 'character/hair_long_tint',
  'character/hair_short_tint', 'character/hair_spiked_tint', 'character/hair_tail_tint', 'character/skin_tint', 'enemies/boneboss',
  'enemies/boneboss_eyes', 'enemies/boss', 'enemies/boss_eyes', 'enemies/brute', 'enemies/brute_eyes',
  'enemies/shade', 'enemies/shade_eyes', 'enemies/skel', 'enemies/skel_eyes', 'enemies/skelarcher',
  'enemies/skelarcher_eyes', 'enemies/skelknight', 'enemies/skelknight_eyes', 'enemies/skitter', 'enemies/skitter_eyes',
  'enemies/wisp', 'enemies/wisp_eyes', 'gear/armor_coat_tint', 'gear/armor_leather_tint', 'gear/armor_plate',
  'gear/armor_plate_tint', 'gear/armor_tunic_tint', 'gear/boots_boots_tint', 'gear/boots_greaves', 'gear/boots_greaves_tint',
  'gear/boots_striders_tint', 'icons/potion', 'icons/trinket_tint', 'npc/smith', 'npc/trader', 'props/anvil',
  'props/brazier', 'props/chest', 'weapons/bow', 'weapons/bow_over', 'weapons/bow_tint',
  'weapons/dagger', 'weapons/dagger_tint', 'weapons/great', 'weapons/great_tint', 'weapons/grimoire_faith',
  'weapons/grimoire_magic', 'weapons/grimoire_tint', 'weapons/mace', 'weapons/mace_tint', 'weapons/buckler',
  'weapons/shield', 'weapons/spear', 'weapons/spear_tint', 'weapons/sword', 'weapons/sword_tint',
  // floor 3
  'enemies/thrall', 'enemies/thrall_eyes', 'enemies/gravecaller', 'enemies/gravecaller_eyes', 'enemies/thornroot', 'enemies/thornroot_eyes',
  'enemies/bloodbloom', 'enemies/bloodbloom_eyes', 'enemies/hermit', 'enemies/hermit_eyes', 'enemies/collector', 'enemies/collector_eyes', 'enemies/corpse',
  // the root village
  'village/tree_a', 'village/tree_b', 'village/inn', 'village/guild', 'village/stall', 'village/stall_tint', 'village/counter', 'village/forge',
  'village/witch', 'village/cauldron', 'village/tent_tint', 'village/flag_tint', 'village/well', 'village/pillar', 'village/board', 'village/lamp',
  'village/scarecrow', 'village/sign', 'village/trunk', 'village/goods_weapons', 'village/goods_gear', 'village/goods_potions', 'village/goods_food'
];
// Sprites drawn finer than the game's pixel grid: 'enemies/thrall':4 means thrall.png is 4 file pixels per game pixel
// (a 72 x 80 file for an 18 x 20 enemy). Whole numbers from 1 to MAX_RATIO. A sprite's _tint and _eyes files share its
// ratio unless they are listed themselves.
const SPRITE_RATIO={};
function ratioFor(n){const own=SPRITE_RATIO[n];if(own)return own;const base=n.replace(/_(tint|eyes)$/,'');return SPRITE_RATIO[base]||1;}
let SPR_MAX=1;   // the finest ratio among the loaded art (and an uploaded character sheet)
const IMG={};   // sprite name -> loaded image, or null if the file is missing
// window.SPRITE_DATA exists only in the single-file build, where the PNGs are embedded as data URLs.
function loadSprites(){
  return Promise.all(SPRITE_NAMES.map(n=>new Promise(res=>{const im=new Image();
    im.onload=()=>{const r=Math.round(ratioFor(n));
      if(r>=1&&r<=MAX_RATIO&&im.naturalWidth%r===0&&im.naturalHeight%r===0){im.r=r;SPR_MAX=Math.max(SPR_MAX,r);}
      else{im.r=1;console.warn(`Sprite ${n}: ratio ${r} does not divide its ${im.naturalWidth} x ${im.naturalHeight} file; drawing it at ratio 1`);}
      IMG[n]=im;res();};im.onerror=()=>{IMG[n]=null;console.warn('Missing sprite: '+SPRITE_DIR+n+'.png');res();};
    im.src=(window.SPRITE_DATA&&window.SPRITE_DATA[n])||SPRITE_DIR+n+'.png';})));
}
function loadImage(url){return new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=url;});}
// A canvas w x h game pixels at ratio r: its context draws in game pixels.
function mk(w,h,r=1){const c=document.createElement('canvas');c.width=Math.round(w*r);c.height=Math.round(h*r);c.r=r;
  const x=c.getContext('2d');x.setTransform(r,0,0,r,0,0);x.imageSmoothingEnabled=false;return[c,x];}
const rat=im=>im&&im.r||1, gw=im=>im.width/rat(im), gh=im=>im.height/rat(im);
// put: the whole image at (dx,dy), at its game size or dw x dh. cut: a part of it, given in game pixels.
function put(x,im,dx,dy,dw,dh){x.drawImage(im,dx,dy,dw==null?gw(im):dw,dh==null?gh(im):dh);}
function cut(x,im,sx,sy,sw,sh,dx,dy,dw=sw,dh=sh){const r=rat(im);x.drawImage(im,sx*r,sy*r,sw*r,sh*r,dx,dy,dw,dh);}
// the finest ratio among some sprite files, for a canvas that layers them
const ratioOf=(...names)=>Math.max(1,...names.map(n=>rat(IMG[n])));
// A small interface canvas (item icons, previews) that is w x h game pixels, drawn at the finest art's ratio. Its CSS size stays.
function uiCtx(cv,w,h){const r=SPR_MAX;if(cv.width!==w*r||cv.height!==h*r){cv.width=w*r;cv.height=h*r;}
  const x=cv.getContext('2d');x.setTransform(r,0,0,r,0,0);x.imageSmoothingEnabled=false;x.clearRect(0,0,w,h);return x;}

// Colouring. A file ending in _tint is grey; grey 128 becomes exactly `tint`, darker greys shade it, lighter ones highlight it.
// Everything below uses canvas blending only and never reads pixels back, so the game also runs straight from disk.
const TINTED={};
function tinted(name,tint){
  const im=IMG[name];if(!im)return null;const key=name+'|'+tint;if(TINTED[key])return TINTED[key];
  const[c,x]=mk(gw(im),gh(im),rat(im));put(x,im,0,0);
  x.globalCompositeOperation='hard-light';x.fillStyle=tint;x.fillRect(0,0,gw(im),gh(im));
  x.globalCompositeOperation='destination-in';put(x,im,0,0);x.globalCompositeOperation='source-over';
  return TINTED[key]=c;
}
// Draws sprite `name` onto x: its _tint file coloured with `tint`, then its plain file over that. Either file may be absent.
function layer(x,name,tint,sx,sy,w,h){
  for(const im of[tint?tinted(name+'_tint',tint):null,IMG[name]])if(im){if(w)cut(x,im,sx,sy,w,h,0,0);else put(x,im,0,0);}
}
// The dark outline every sprite gets, one game pixel wide whatever the art's ratio, so fine and coarse art match.
// cw/ch is the frame size, so one frame never bleeds into its neighbour.
function outlined(src,color,cw,ch){
  const w=gw(src),h=gh(src),r=rat(src),[s,sx]=mk(w,h,r),[c,x]=mk(w,h,r);cw=cw||w;ch=ch||h;
  put(sx,src,0,0);sx.globalCompositeOperation='source-in';sx.fillStyle=color;sx.fillRect(0,0,w,h);
  for(let fy=0;fy<h;fy+=ch)for(let fx=0;fx<w;fx+=cw){x.save();x.beginPath();x.rect(fx,fy,cw,ch);x.clip();
    put(x,s,-1,0);put(x,s,1,0);put(x,s,0,-1);put(x,s,0,1);x.restore();}
  put(x,src,0,0);return c;
}
function whiten(c){const w=gw(c),h=gh(c),[o,x]=mk(w,h,rat(c));put(x,c,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#fff';x.fillRect(0,0,w,h);return o;}

// Character sheet: 88 x 78 = four 22 x 26 frames across (stand, step A, step B, attack), three rows down
// (facing down, facing up, facing right). Facing left is the right-facing row mirrored.
const FRAME_W=22,FRAME_H=26;   // SHEET_W, SHEET_H: data.js
const HAIR_FILES=['short','spiked','long','tail','bob','buzz'];
const DIR_ROW=[0,1,2,2];   // sheet row for facing down, up, left, right
let CUSTOM=null;           // the player's own uploaded character sheet, when they have one
function buildAvatar(look,eq,custom){
  const ar=eq.armor,bt=eq.boots,hair='character/hair_'+(HAIR_FILES[look.style]||'short'),
    files=['character/skin','character/base','character/eyes','gear/boots_'+(bt?bt.type:'boots'),'gear/armor_'+(ar?ar.type:'tunic'),hair],
    [c,x]=mk(SHEET_W,SHEET_H,custom?rat(custom):ratioOf(...files.flatMap(f=>[f,f+'_tint'])));
  if(custom)put(x,custom,0,0);                  // an uploaded sheet replaces every layer
  else{
    layer(x,'character/skin',look.skin);layer(x,'character/base');layer(x,'character/eyes',look.eyes);
    layer(x,'gear/boots_'+(bt?bt.type:'boots'),bt?bt.tint:'#2a211b');
    layer(x,'gear/armor_'+(ar?ar.type:'tunic'),ar?ar.tint:'#3a3a44');
    layer(x,hair,look.hair);}
  const o=outlined(c,'#050508',FRAME_W,FRAME_H);o.raw=c;return o;
}
// An uploaded sheet with its ratio set, or null when its size doesn't fit. A finer sheet makes the screen render finer.
function sheetImage(im){const r=im?sheetRatio(im.naturalWidth,im.naturalHeight):0;if(!r)return null;
  im.r=r;if(r>SPR_MAX){SPR_MAX=r;resize();}return im;}
async function useCustom(url){
  const im=url?await loadImage(url):null;
  CUSTOM=sheetImage(im);
  if(S&&G)refreshSprites();
}

// Weapons: 31 x 11, pointing right, grip at (4,5). Bows: three 16 x 17 frames, grip at (9,8).
const WCACHE={};
function bowFrames(tint){
  const key='bowframes|'+tint;if(WCACHE[key])return WCACHE[key];const out=[];
  const k=ratioOf('weapons/bow','weapons/bow_tint','weapons/bow_over');
  for(let f=0;f<3;f++){const[r,x]=mk(16,17,k);layer(x,'weapons/bow',tint,f*16,0,16,17);const o=outlined(r,'#050508');
    if(IMG['weapons/bow_over'])cut(o.getContext('2d'),IMG['weapons/bow_over'],f*16,0,16,17,0,0);   // string and arrow stay thin: no outline
    o.ox=9;o.oy=8;out.push(o);}
  return WCACHE[key]=out;
}
function buildWeapon(type,tint,school){
  if(type==='bow')return bowFrames(tint)[0];
  if(type==='grimoire'&&!school)school=tint===GRIM.faith.tint?'faith':'magic';
  const key=type+'|'+tint+'|'+(school||'');if(WCACHE[key])return WCACHE[key];
  const n='weapons/'+type,[r,x]=mk(31,11,ratioOf(n,n+'_tint','weapons/grimoire_'+school));layer(x,n,tint);
  if(type==='grimoire'&&IMG['weapons/grimoire_'+school])put(x,IMG['weapons/grimoire_'+school],0,0);
  const c=outlined(r,'#050508');c.ox=4;c.oy=5;return WCACHE[key]=c;
}
let BOWF=null;   // bow animation frames when a bow is equipped
function refreshSprites(){
  const w=S.equip.weapon;AV=buildAvatar(S.char.look,S.equip,S.char.custom?CUSTOM:null);
  WSPR=buildWeapon(w.type,w.tint,w.school);BOWF=w.type==='bow'?bowFrames(w.tint):null;
}

// The blacksmith and his props
let SMITH=null;
function smithSprites(){
  if(SMITH)return SMITH;const o=n=>IMG[n]?outlined(IMG[n],'#050508'):mk(1,1)[0];
  return SMITH={c:o('npc/smith'),anvil:o('props/anvil'),brazier:o('props/brazier'),hammer:buildWeapon('mace','#8d93a0')};
}
function drawFlame(x,y,t){for(let i=0;i<4;i++){const h=1+((Math.floor(t*9)+i*3)%3);ctx.fillStyle=i%2?'#ffe9a8':'#f08a3c';ctx.fillRect(x+i*2,y-h,2,h);}}
function drawSmith(q,t){
  const sp=smithSprites(),x=Math.round(q.x-camX),y=Math.round(q.y-camY);
  put(ctx,sp.brazier,x+11,y+3);drawFlame(x+13,y+6,t);
  put(ctx,sp.anvil,x-25,y+2);
  ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.fillRect(x-5,y+9,10,2);ctx.globalAlpha=1;
  ctx.save();ctx.translate(x,0);ctx.scale(-1,1);put(ctx,sp.c,-12,y-13);ctx.restore();   // faces the anvil
  ctx.save();ctx.translate(x-6,y+3);ctx.rotate(Math.PI+.9-Math.abs(Math.sin(t*2.6))*1.05);put(ctx,sp.hammer,-4,-5);ctx.restore();
}
// The village's props (js/sim/village.js): buildings, stalls, trees and the rest, outlined like every sprite.
// A stall is its frame, its awning in the stall's colour and its goods; a tent is the kingdom's colour with its flag.
const PROPS={};
function propSprite(q){
  const key=q.s+'|'+(q.tint||'');if(PROPS[key])return PROPS[key];
  let src=IMG[q.s];
  if(q.s==='village/stall'||q.s==='village/tent'){const base=q.s==='village/tent'?tinted('village/tent_tint',q.tint):IMG[q.s];if(base){
    const[c,x]=mk(gw(base),gh(base),ratioOf(q.s,q.s+'_tint',q.goods||''));put(x,base,0,0);
    if(q.s==='village/stall'){const a=tinted('village/stall_tint',q.tint);if(a)put(x,a,0,0);if(IMG[q.goods])put(x,IMG[q.goods],0,0);}
    else{const f=tinted('village/flag_tint',q.tint);if(f)put(x,f,0,0);}
    src=c;}}
  return PROPS[key]=src?outlined(src,'#050508'):mk(1,1)[0];
}
function drawProp(q,t){
  const c=propSprite(q),w=gw(c),h=gh(c),x=Math.round(q.x-camX-w/2),y=Math.round(q.y-camY-h);
  if(x>W||y>H||x+w<0||y+h<0)return;
  put(ctx,c,x,y);
  if(q.brew){for(let i=0;i<3;i++){const p=(t*.8+i/3)%1;ctx.globalAlpha=1-p;ctx.fillStyle='#9be08a';ctx.fillRect(Math.round(q.x-camX-5+i*5),Math.round(q.y-camY-h+2-p*12),2,2);}ctx.globalAlpha=1;}
}
// People in the village (stall keepers, the arcanist, the captains) are built from the character layers, standing
// facing you. q.look and q.eq are a character's look and gear, as in a save.
const NPCAV={};
function drawNpc(q){
  const key=JSON.stringify([q.look,q.eq]),av=NPCAV[key]||(NPCAV[key]=buildAvatar(q.look,q.eq,null));
  const x=Math.round(q.x-camX),y=Math.round(q.y-camY);
  if(!q.stall){ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.fillRect(x-5,y+9,10,2);ctx.globalAlpha=1;}
  cut(ctx,av,0,0,FRAME_W,FRAME_H,x-12,y-13);
}
// The trader: a travelling merchant under a pack almost as big as they are. They sway a little as they wait.
// Village stall keepers are ordinary people (drawNpc).
let TRADER=null;
function drawTrader(q,t){
  if(q.look){drawNpc(q);return;}
  const c=TRADER||(TRADER=IMG['npc/trader']?outlined(IMG['npc/trader'],'#050508'):mk(1,1)[0]),w=gw(c),h=gh(c);
  const x=Math.round(q.x-camX),y=Math.round(q.y-camY),sway=Math.floor(t*1.5+q.x)%2;
  ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.fillRect(x-7,y+9,14,2);ctx.globalAlpha=1;
  put(ctx,c,x-Math.floor(w/2),y+11-h-sway);
}
// Supplies in the trader's pack and the HUD: drawn in code, 24 x 24.
function supplyIcon(cv,k){
  const x=uiCtx(cv,24,24),f=(c,a,b,w,h)=>{x.fillStyle=c;x.fillRect(a,b,w,h);};
  f('#262630',0,0,24,24);
  if(k==='potion'){f('#050508',8,3,8,3);f('#050508',6,6,12,13);f('#e6e1d3',10,4,4,2);f('#d9534f',7,9,10,9);f('#f1b0a8',8,10,2,3);}
  else if(k==='ration'){f('#050508',3,8,18,11);f('#8a5a2a',4,9,16,9);f('#b07a3a',5,9,14,6);f('#e0b36a',6,10,5,2);f('#e0b36a',13,10,4,2);f('#6a2f2a',4,15,16,2);f('#c05a4a',6,15,4,1);}
  else{f('#050508',8,2,8,4);f('#c9b48a',10,3,4,2);f('#050508',5,6,14,15);f('#7a5a3a',6,7,12,13);f('#5aa7e6',7,12,10,7);f('#9fd0f5',8,13,3,2);f('#4a3420',6,9,12,1);}
}
let CHESTS=null;
function chestSheet(){return CHESTS||(CHESTS=IMG['props/chest']?outlined(IMG['props/chest'],'#050508',14,11):mk(28,11)[0]);}

const SHSPR={};
function shieldSprite(kind){return SHSPR[kind]||(SHSPR[kind]=IMG['weapons/'+kind]?outlined(IMG['weapons/'+kind],'#050508'):mk(33,13)[0]);}

// Enemies: a body file plus an _eyes file. The eyes are redrawn after the darkness so they glow.
const ESPR={};
// sprite: a boss's own sprite file (FLOORS[].boss.sprite); ordinary enemies use their type's file
function enemySprite(type,elite,sprite){
  const key=type+(elite?'E':'')+(sprite||'');if(ESPR[key])return ESPR[key];
  const boss=type==='boss',name='enemies/'+(boss?(sprite||'boss'):type),T=ETYPES[type],B=boss&&FLOORS.find(f=>f.boss.sprite===(sprite||'boss'));
  let src=IMG[name];if(!src){const[p,px]=mk(12,12);px.fillStyle='#f0f';px.fillRect(1,1,10,10);src=p;}   // loud placeholder for a missing file
  const c=outlined(src,elite?'#c9a24a':boss?(B?B.boss.line:'#7a4a52'):(T.line||'#4f4f66')),white=whiten(c);
  let eyes=IMG[name+'_eyes']||null;
  if(eyes&&elite){const[e,ex]=mk(gw(eyes),gh(eyes),rat(eyes));put(ex,eyes,0,0);ex.globalCompositeOperation='source-in';ex.fillStyle='#ffd86a';ex.fillRect(0,0,gw(eyes),gh(eyes));eyes=e;}
  if(eyes)put(c.getContext('2d'),eyes,0,0);
  // fw, fh: one frame. Most enemies are a single frame; the floor 2 skeletons are sheets (see ETYPES).
  const sheet=!boss&&T.fw;
  return ESPR[key]={c,white,eyes,w:gw(c),h:gh(c),fw:sheet?T.fw:gw(c),fh:sheet?T.fh:gh(c),sheet:!!sheet};
}

// Item icons are cut from the sprites themselves, so new art shows up in the bag without separate icon files.
function drawItemIcon(cv,it){
  const x=uiCtx(cv,24,24);
  if(!it)return;
  x.fillStyle='#262630';x.fillRect(0,0,24,24);x.fillStyle=RARITY[it.rarity].color;x.globalAlpha=.16;x.fillRect(0,0,24,24);x.globalAlpha=1;
  x.fillRect(0,22,24,2);
  if(it.slot==='weapon'){const s=buildWeapon(it.type,it.tint,it.school);
    if(it.type==='grimoire')cut(x,s,1,0,10,11,2,0,20,22);
    else if(it.type==='bow')put(x,s,4,3);
    else{x.save();x.translate(12,11);x.rotate(-Math.PI/4);const len={sword:16,dagger:11,great:21,mace:17,spear:25}[it.type]||16;put(x,s,-Math.round(len/2)-1,-5);x.restore();}}
  else if(it.slot==='armor'||it.slot==='boots'){
    const n='gear/'+(it.slot==='armor'?'armor_':'boots_')+it.type,[r,rx]=mk(FRAME_W,FRAME_H,ratioOf(n,n+'_tint'));layer(rx,n,it.tint,0,0,FRAME_W,FRAME_H);const o=outlined(r,'#050508');
    if(it.slot==='armor')cut(x,o,6,11,12,11,0,0,24,22);else cut(x,o,8,18,8,6,0,2,24,18);}
  else{const t=tinted('icons/trinket_tint',it.tint);if(t)put(x,t,0,0);x.fillStyle=RARITY[it.rarity].color;x.fillRect(10,4,4,3);x.fillStyle='#fff';x.fillRect(11,5,1,1);}
}

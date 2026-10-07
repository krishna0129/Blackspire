'use strict';
// Blackspire: sprites. Nothing in this file paints a character, weapon, piece of gear or enemy in code.
// Every sprite is a PNG file under assets/sprites/ (assets/README.md explains the layout), loaded once at start-up.

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
  'gear/boots_striders_tint', 'icons/potion', 'icons/trinket_tint', 'npc/smith', 'props/anvil',
  'props/brazier', 'props/chest', 'weapons/bow', 'weapons/bow_over', 'weapons/bow_tint',
  'weapons/dagger', 'weapons/dagger_tint', 'weapons/great', 'weapons/great_tint', 'weapons/grimoire_faith',
  'weapons/grimoire_magic', 'weapons/grimoire_tint', 'weapons/mace', 'weapons/mace_tint', 'weapons/buckler',
  'weapons/shield', 'weapons/spear', 'weapons/spear_tint', 'weapons/sword', 'weapons/sword_tint'
];
const IMG={};   // sprite name -> loaded image, or null if the file is missing
// window.SPRITE_DATA exists only in the single-file build, where the PNGs are embedded as data URLs.
function loadSprites(){
  return Promise.all(SPRITE_NAMES.map(n=>new Promise(res=>{const im=new Image();
    im.onload=()=>{IMG[n]=im;res();};im.onerror=()=>{IMG[n]=null;console.warn('Missing sprite: '+SPRITE_DIR+n+'.png');res();};
    im.src=(window.SPRITE_DATA&&window.SPRITE_DATA[n])||SPRITE_DIR+n+'.png';})));
}
function loadImage(url){return new Promise(res=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>res(null);im.src=url;});}
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.imageSmoothingEnabled=false;return[c,x];}

// Colouring. A file ending in _tint is grey; grey 128 becomes exactly `tint`, darker greys shade it, lighter ones highlight it.
// Everything below uses canvas blending only and never reads pixels back, so the game also runs straight from disk.
const TINTED={};
function tinted(name,tint){
  const im=IMG[name];if(!im)return null;const key=name+'|'+tint;if(TINTED[key])return TINTED[key];
  const[c,x]=mk(im.width,im.height);x.drawImage(im,0,0);
  x.globalCompositeOperation='hard-light';x.fillStyle=tint;x.fillRect(0,0,c.width,c.height);
  x.globalCompositeOperation='destination-in';x.drawImage(im,0,0);x.globalCompositeOperation='source-over';
  return TINTED[key]=c;
}
// Draws sprite `name` onto x: its _tint file coloured with `tint`, then its plain file over that. Either file may be absent.
function layer(x,name,tint,sx,sy,w,h){
  for(const im of[tint?tinted(name+'_tint',tint):null,IMG[name]])if(im){if(w)x.drawImage(im,sx,sy,w,h,0,0,w,h);else x.drawImage(im,0,0);}
}
// The one-pixel dark outline every sprite gets. cw/ch is the frame size, so one frame never bleeds into its neighbour.
function outlined(src,color,cw,ch){
  const w=src.width,h=src.height,[s,sx]=mk(w,h),[c,x]=mk(w,h);cw=cw||w;ch=ch||h;
  sx.drawImage(src,0,0);sx.globalCompositeOperation='source-in';sx.fillStyle=color;sx.fillRect(0,0,w,h);
  for(let fy=0;fy<h;fy+=ch)for(let fx=0;fx<w;fx+=cw){x.save();x.beginPath();x.rect(fx,fy,cw,ch);x.clip();
    x.drawImage(s,-1,0);x.drawImage(s,1,0);x.drawImage(s,0,-1);x.drawImage(s,0,1);x.restore();}
  x.drawImage(src,0,0);return c;
}
function whiten(c){const[o,x]=mk(c.width,c.height);x.drawImage(c,0,0);x.globalCompositeOperation='source-in';x.fillStyle='#fff';x.fillRect(0,0,o.width,o.height);return o;}

// Character sheet: 88 x 78 = four 22 x 26 frames across (stand, step A, step B, attack), three rows down
// (facing down, facing up, facing right). Facing left is the right-facing row mirrored.
const FRAME_W=22,FRAME_H=26,SHEET_W=88,SHEET_H=78;
const HAIR_FILES=['short','spiked','long','tail','bob','buzz'];
const DIR_ROW=[0,1,2,2];   // sheet row for facing down, up, left, right
let CUSTOM=null;           // the player's own uploaded character sheet, when they have one
function buildAvatar(look,eq,custom){
  const[c,x]=mk(SHEET_W,SHEET_H);
  if(custom)x.drawImage(custom,0,0);            // an uploaded sheet replaces every layer
  else{const ar=eq.armor,bt=eq.boots;
    layer(x,'character/skin',look.skin);layer(x,'character/base');layer(x,'character/eyes',look.eyes);
    layer(x,'gear/boots_'+(bt?bt.type:'boots'),bt?bt.tint:'#2a211b');
    layer(x,'gear/armor_'+(ar?ar.type:'tunic'),ar?ar.tint:'#3a3a44');
    layer(x,'character/hair_'+(HAIR_FILES[look.style]||'short'),look.hair);}
  const o=outlined(c,'#050508',FRAME_W,FRAME_H);o.raw=c;return o;
}
async function useCustom(url){
  const im=url?await loadImage(url):null;
  CUSTOM=im&&im.naturalWidth===SHEET_W&&im.naturalHeight===SHEET_H?im:null;
  if(S&&G)refreshSprites();
}

// Weapons: 31 x 11, pointing right, grip at (4,5). Bows: three 16 x 17 frames, grip at (9,8).
const WCACHE={};
function bowFrames(tint){
  const key='bowframes|'+tint;if(WCACHE[key])return WCACHE[key];const out=[];
  for(let f=0;f<3;f++){const[r,x]=mk(16,17);layer(x,'weapons/bow',tint,f*16,0,16,17);const o=outlined(r,'#050508');
    if(IMG['weapons/bow_over'])o.getContext('2d').drawImage(IMG['weapons/bow_over'],f*16,0,16,17,0,0,16,17);   // string and arrow stay thin: no outline
    o.ox=9;o.oy=8;out.push(o);}
  return WCACHE[key]=out;
}
function buildWeapon(type,tint,school){
  if(type==='bow')return bowFrames(tint)[0];
  if(type==='grimoire'&&!school)school=tint===GRIM.faith.tint?'faith':'magic';
  const key=type+'|'+tint+'|'+(school||'');if(WCACHE[key])return WCACHE[key];
  const[r,x]=mk(31,11);layer(x,'weapons/'+type,tint);
  if(type==='grimoire'&&IMG['weapons/grimoire_'+school])x.drawImage(IMG['weapons/grimoire_'+school],0,0);
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
  ctx.drawImage(sp.brazier,x+11,y+3);drawFlame(x+13,y+6,t);
  ctx.drawImage(sp.anvil,x-25,y+2);
  ctx.globalAlpha=.4;ctx.fillStyle='#000';ctx.fillRect(x-5,y+9,10,2);ctx.globalAlpha=1;
  ctx.save();ctx.translate(x,0);ctx.scale(-1,1);ctx.drawImage(sp.c,-12,y-13);ctx.restore();   // faces the anvil
  ctx.save();ctx.translate(x-6,y+3);ctx.rotate(Math.PI+.9-Math.abs(Math.sin(t*2.6))*1.05);ctx.drawImage(sp.hammer,-4,-5);ctx.restore();
}
let CHESTS=null;
function chestSheet(){return CHESTS||(CHESTS=IMG['props/chest']?outlined(IMG['props/chest'],'#050508',14,11):mk(28,11)[0]);}

const SHSPR={};
function shieldSprite(kind){return SHSPR[kind]||(SHSPR[kind]=IMG['weapons/'+kind]?outlined(IMG['weapons/'+kind],'#050508'):mk(33,13)[0]);}

// Enemies: a body file plus an _eyes file. The eyes are redrawn after the darkness so they glow.
const ESPR={};
function enemySprite(type,elite,skin){   // skin marks the floor 2 boss
  const key=type+(elite?'E':'')+(skin||'');if(ESPR[key])return ESPR[key];
  const boss=type==='boss',name='enemies/'+(boss?(skin?'boneboss':'boss'):type),T=ETYPES[skin||type]||ETYPES[type];
  let src=IMG[name];if(!src){const[p,px]=mk(12,12);px.fillStyle='#f0f';px.fillRect(1,1,10,10);src=p;}   // loud placeholder for a missing file
  const c=outlined(src,elite?'#c9a24a':boss?(skin?'#9a8f6a':'#7a4a52'):(T.line||'#4f4f66')),white=whiten(c);
  let eyes=IMG[name+'_eyes']||null;
  if(eyes&&elite){const[e,ex]=mk(eyes.width,eyes.height);ex.drawImage(eyes,0,0);ex.globalCompositeOperation='source-in';ex.fillStyle='#ffd86a';ex.fillRect(0,0,e.width,e.height);eyes=e;}
  if(eyes)c.getContext('2d').drawImage(eyes,0,0);
  // fw, fh: one frame. Most enemies are a single frame; the floor 2 skeletons are sheets (see ETYPES).
  const sheet=!boss&&T.fw;
  return ESPR[key]={c,white,eyes,w:c.width,h:c.height,fw:sheet?T.fw:c.width,fh:sheet?T.fh:c.height,sheet:!!sheet};
}

// Item icons are cut from the sprites themselves, so new art shows up in the bag without separate icon files.
function drawItemIcon(cv,it){
  const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,24,24);
  if(!it)return;
  x.fillStyle='#262630';x.fillRect(0,0,24,24);x.fillStyle=RARITY[it.rarity].color;x.globalAlpha=.16;x.fillRect(0,0,24,24);x.globalAlpha=1;
  x.fillRect(0,22,24,2);
  if(it.slot==='weapon'){const s=buildWeapon(it.type,it.tint,it.school);
    if(it.type==='grimoire')x.drawImage(s,1,0,10,11,2,0,20,22);
    else if(it.type==='bow')x.drawImage(s,4,3);
    else{x.save();x.translate(12,11);x.rotate(-Math.PI/4);const len={sword:16,dagger:11,great:21,mace:17,spear:25}[it.type]||16;x.drawImage(s,-Math.round(len/2)-1,-5);x.restore();}}
  else if(it.slot==='armor'||it.slot==='boots'){
    const[r,rx]=mk(FRAME_W,FRAME_H);layer(rx,'gear/'+(it.slot==='armor'?'armor_':'boots_')+it.type,it.tint,0,0,FRAME_W,FRAME_H);const o=outlined(r,'#050508');
    if(it.slot==='armor')x.drawImage(o,6,11,12,11,0,0,24,22);else x.drawImage(o,8,18,8,6,0,2,24,18);}
  else{const t=tinted('icons/trinket_tint',it.tint);if(t)x.drawImage(t,0,0);x.fillStyle=RARITY[it.rarity].color;x.fillRect(10,4,4,3);x.fillStyle='#fff';x.fillRect(11,5,1,1);}
}

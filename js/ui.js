'use strict';
// Blackspire: HUD, title flow, character creator, gear panel, debug menu.

/* ---------- HUD ---------- */
const hc={};
function setTxt(id,v){if(hc[id]!==v){hc[id]=v;$('#'+id).textContent=v;}}
function setStyle(key,el,prop,v){if(hc[key]!==v){hc[key]=v;el.style[prop]=v;}}
const elHp=$('#hpFill'),elXp=$('#xpFill'),elBoss=$('#bossFill'),cdSk=$('#slSkill .cd'),elMp=$('#mpFill'),elSk=$('#slSkill'),cdDo=$('#slDodge .cd'),cdPo=$('#slPot .cd'),elPrompt=$('#prompt');
function updateHud(){
  const hp=clamp(P.hp/ST.maxHp,0,1);
  setStyle('hpw',elHp,'width',(hp*100).toFixed(1)+'%');
  setStyle('hpc',elHp,'background',hp>.5?'var(--hp)':hp>.25?'var(--amber)':'var(--red)');
  setTxt('hpTxt',Math.ceil(Math.max(0,P.hp))+' / '+ST.maxHp);
  setStyle('xpw',elXp,'width',(S.char.xp/xpNeed(S.char.level)*100).toFixed(1)+'%');
  setTxt('hLv','Level '+S.char.level+(S.char.pts?' (+'+S.char.pts+')':''));
  setTxt('hShards',String(S.shards));setTxt('potN',String(S.potions));
  setStyle('cds',cdSk,'height',(P.skillMax?P.skillCd/P.skillMax*100:0).toFixed(0)+'%');
  setStyle('mpw',elMp,'width',(clamp(P.mp/ST.maxMp,0,1)*100).toFixed(1)+'%');setTxt('mpTxt',Math.floor(P.mp)+' / '+ST.maxMp);
  const lack=P.mp<SKILLS[ST.skill].mp||P.safe;if(hc.lack!==lack){hc.lack=lack;elSk.classList.toggle('lack',lack);}
  if(hc.safe!==P.safe){hc.safe=P.safe;$('#slAtk').classList.toggle('lack',!!P.safe);}
  setTxt('hFloor','Floor '+G.n+(P.safe?', safe room':''));
  setStyle('cdd',cdDo,'height',(P.dodgeCd/.9*100).toFixed(0)+'%');
  setStyle('cdp',cdPo,'height',(P.potCd/1.2*100).toFixed(0)+'%');
  if(G.bossEnt&&G.bossAwake&&!G.bossEnt.dead)setStyle('bw',elBoss,'width',(clamp(G.bossEnt.hp/G.bossEnt.maxHp,0,1)*100).toFixed(1)+'%');
  const near=G.gate&&hyp(G.gate.x-P.x,G.gate.y-P.y)<20?'up':nearGate()?'boss':nearSmith()?'smith':'';
  if(hc.near!==near){hc.near=near;elPrompt.hidden=!near;
    if(near==='up')elPrompt.innerHTML='Climb to floor '+(G.n+1)+'<kbd>E</kbd>';
    else if(near==='boss')elPrompt.innerHTML='Boss chamber gate<kbd>E</kbd>';
    else if(near==='smith')elPrompt.innerHTML='Blacksmith<kbd>E</kbd>';}
}
function refreshHudStatic(){
  $('#hName').textContent=S.char.name;setTxt('hFloor','Floor '+G.n);
  $('#skName').textContent=SKILLS[ST.skill].name;$('#skCost').textContent=SKILLS[ST.skill].mp;
  drawItemIcon($('#slAtk canvas'),S.equip.weapon);$('#slBlock').hidden=!ST.shield;
}

// pickup notice: shows above the character, bigger for rare and better
function toast(it){
  const el=$('#toasts'),d=document.createElement('div'),R=RARITY[it.rarity];
  d.className='toast'+(it.rarity>=2?' big':'');d.style.borderColor=R.color;
  const c=document.createElement('canvas');c.width=c.height=24;drawItemIcon(c,it);d.appendChild(c);
  const n=document.createElement('span');n.style.color=R.color;n.textContent=it.name;d.appendChild(n);
  if(isUpgrade(it)){const u=document.createElement('small');u.textContent='\u25B2 upgrade';d.appendChild(u);}
  el.appendChild(d);while(el.children.length>3)el.firstChild.remove();setTimeout(()=>d.remove(),2800);
}
function bagBadge(){const n=S.inv.filter(i=>i.isNew).length;$('#bagNew').textContent=n?n+' new':'';$('#btnBag').classList.toggle('has',n>0);}

/* ---------- flow ---------- */
function save(){S.floor=G?G.n:S.floor;if(P&&!P.dead)S.hp=Math.round(P.hp);saveOk=Store.save(S);}
function newPlayer(){
  const s=G.start,cp=S.cpFloor===G.n&&S.cp>0&&G.smiths[S.cp]?G.smiths[S.cp]:null;
  return{x:cp?cp.x:(s.x+s.w/2)*TILE,y:cp?cp.y+24:(s.y+s.h/2)*TILE,safe:true,r:5,cr:4,hp:ST.maxHp,aim:0,face:1,atkCd:0,skillCd:0,skillMax:0,dodgeCd:0,potCd:0,inv:0,
    dir:0,lunge:0,swing:null,dash:null,mom:0,momT:0,walk:0,moving:false,dead:false,mp:ST.maxMp,guard:0,hot:null,ward:0};
}
// Floors start a beat after the click or key press that asked for them, not inside it.
let starting=false;
function startFloor(n){if(starting)return;starting=true;setTimeout(()=>{starting=false;enterFloor(n);},60);}
function enterFloor(n){
  S.floor=n;S.best=Math.max(S.best||1,n);
  if(S.chestFloor!==n){S.chestFloor=n;S.chestsOpen=[];}
  G=genFloor(n);calcStats();P=newPlayer();
  // Shops keep their stock and potions for as long as you are on this floor, through deaths and reloads,
  // and restock when you reach a new floor. The stock itself is made the first time you open a smith's counter.
  if(!S.shops||S.shops.floor!==n)S.shops={floor:n,list:[]};
  G.smiths.forEach((q,i)=>{q.shop=S.shops.list[i]||(S.shops.list[i]={stock:null,potions:5});});
  if(S.hp!=null&&S.hp>0)P.hp=Math.min(ST.maxHp,S.hp);
  refreshSprites();refreshHudStatic();reveal();drawMini();
  for(const k in hc)delete hc[k];
  $('#boss').hidden=true;$('#dead').hidden=true;$('#ask').hidden=true;$('#debug').hidden=true;$('#pause').hidden=true;$('#hud').hidden=false;$('#toasts').innerHTML='';bagBadge();
  mode='play';inp.atk=false;
  banner('Floor '+n,n===1?'Find the boss chamber. It is somewhere to the east.':n===2?'The dead here shrug off magic. Bring steel.':'The air is colder here.',n===2?4200:2800);
  save();
}
function showTitle(){
  mode='title';
  const sv=Store.load();
  S=sv||newState('Wanderer',{skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0]},'sword',OUTFITS[0]);
  G=genFloor(S.floor||1);G.enemies=[];G.bossEnt=null;calcStats();P=newPlayer();CUSTOM=null;refreshSprites();useCustom(S.char.custom||null);
  atSmith=null;
  $('#hud').hidden=true;$('#panel').hidden=true;$('#creator').hidden=true;$('#dead').hidden=true;$('#ask').hidden=true;$('#debug').hidden=true;$('#pause').hidden=true;$('#title').hidden=false;
  const b=$('#btnContinue');b.hidden=!sv;
  if(sv)b.textContent=`Continue as ${sv.char.name}, level ${sv.char.level}, floor ${sv.floor}`;
  $('#btnNew').className=sv?'btn':'btn primary';
}

/* ---------- character creator ---------- */
let armed=false;
const draft={skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0],outfit:OUTFITS[0],weapon:'sword'};
function drawPreview(cv,look,eq,custom){
  const x=cv.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,cv.width,cv.height);
  const w=buildWeapon(eq.weapon.type,eq.weapon.tint,eq.weapon.school),av=buildAvatar(look,eq,custom);
  x.fillStyle='rgba(0,0,0,.45)';x.fillRect(11,28,12,2);
  x.drawImage(av,0,0,FRAME_W,FRAME_H,5,5,FRAME_W,FRAME_H);   // the front-facing standing frame
  if(eq.weapon.type==='grimoire')x.drawImage(w,19,11);
  else if(eq.weapon.type==='bow')x.drawImage(w,15,11);
  else{x.save();x.translate(22,19);x.rotate(-1.05);x.drawImage(w,-4,-5);x.restore();}
}
const START=[...Object.keys(WTYPES).filter(k=>!WTYPES[k].magic),'grimoire:magic','grimoire:faith'];
function draftEquip(){const[t,sc]=draft.weapon.split(':');return{weapon:{type:t,tint:sc?GRIM[sc].tint:BLADES[0]},armor:{type:'tunic',tint:draft.outfit},boots:{type:'boots',tint:'#2a211b'}};}
function buildCreator(){
  const sw=(id,list,key)=>{const el=$(id);el.innerHTML='';list.forEach(c=>{const b=document.createElement('button');b.style.background=c;b.title=c;b.className=draft[key]===c?'on':'';
    b.onclick=()=>{draft[key]=c;buildCreator();};el.appendChild(b);});};
  sw('#cSkin',SKINS,'skin');sw('#cHair',HAIRS,'hair');sw('#cEyes',EYES,'eyes');sw('#cOutfit',OUTFITS,'outfit');
  const st=$('#cStyle');st.innerHTML='';STYLES.forEach((n,i)=>{const b=document.createElement('button');b.textContent=n;b.className=draft.style===i?'on':'';b.onclick=()=>{draft.style=i;buildCreator();};st.appendChild(b);});
  const wp=$('#cWeapon');wp.innerHTML='';
  for(const k of START){const[t,sc]=k.split(':'),T=WTYPES[t],b=document.createElement('button');b.className=draft.weapon===k?'on':'';
    const c=document.createElement('canvas');c.width=c.height=24;drawItemIcon(c,{slot:'weapon',type:t,tint:sc?GRIM[sc].tint:BLADES[0],rarity:0});
    b.appendChild(c);
    const cls=sc==='faith'?'Healer':T.cls,sk=SKILLS[sc==='faith'?'heal':T.skill].name;
    b.insertAdjacentHTML('beforeend',sc?`<span>Grimoire of ${GRIM[sc].label}</span><small>${cls}. Ranged bolts, scales with ${sc==='faith'?'faith':'intelligence'}. Skill: ${sk}</small>`
      :`<span>${T.name}</span><small>${cls}. ${T.blurb}. Skill: ${sk}</small>`);
    b.onclick=()=>{draft.weapon=k;buildCreator();};wp.appendChild(b);}
  drawPreview($('#cPrev'),draft,draftEquip(),draftImg);
  $('#cCustomDel').hidden=!draft.custom;
}
$('#btnNew').onclick=()=>{armed=false;$('#cGo').textContent='Enter floor 1';$('#title').hidden=true;$('#creator').hidden=false;mode='creator';buildCreator();};
$('#cBack').onclick=()=>showTitle();
$('#cGo').onclick=()=>{
  const old=Store.load();
  if(old&&!armed){armed=true;$('#cGo').textContent='Replace '+old.char.name+' and start over';return;}
  armed=false;
  const name=($('#cName').value.trim()||'Wanderer').slice(0,14);
  S=newState(name,{skin:draft.skin,hair:draft.hair,style:draft.style,eyes:draft.eyes},draft.weapon,draft.outfit);
  S.char.custom=draft.custom||null;CUSTOM=draft.custom?draftImg:null;
  $('#creator').hidden=true;startFloor(1);
};
/* ---------- your own character sheet ----------
   One PNG, exactly 88 x 78, replaces the layered avatar. It is kept inside the save. */
let draftImg=null;
async function readSheet(file){
  if(!/\.png$/i.test(file.name)&&file.type!=='image/png')throw new Error(`${file.name} is not a PNG file.`);
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('The file could not be read.'));r.readAsDataURL(file);});
  const im=await loadImage(url);if(!im)throw new Error(`${file.name} could not be read as a PNG image.`);
  if(im.naturalWidth!==SHEET_W||im.naturalHeight!==SHEET_H)throw new Error(`That image is ${im.naturalWidth} × ${im.naturalHeight}. A character sheet must be exactly ${SHEET_W} × ${SHEET_H}: four ${FRAME_W} × ${FRAME_H} frames across and three rows down.`);
  return{url,im};
}
let DL=null;(async()=>{try{DL=window.claude&&window.claude.use?await window.claude.use('downloads'):null;}catch(e){DL=null;}})();
async function saveFile(filename,blob,fallbackUrl){
  if(DL){try{await DL.save({filename,data:blob});return`Saved ${filename}.`;}catch(e){return e&&e.code==='declined'?'Save cancelled.':'The file could not be saved here.';}}
  const a=document.createElement('a');a.href=blob?URL.createObjectURL(blob):fallbackUrl;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  return`Saved ${filename} to your downloads.`;
}
// The template is the current look as a full-colour sheet, ready to repaint in any pixel editor.
function saveTemplate(look,eq,say){
  const c=buildAvatar(look,eq,null).raw,stat='assets/templates/character-template.png';
  try{c.toBlob(b=>saveFile('character-sheet.png',b,stat).then(say));}
  catch(e){saveFile('character-sheet.png',null,stat).then(say);}   // opened straight from disk: browsers will not export a canvas, so hand over the stock file
}
const SHEET_HELP='Optional. A PNG of exactly 88 × 78 pixels replaces the look on the right, whatever gear you wear. Four frames across (stand, step, step, attack), three rows down (facing down, up, right).';
$('#cCustomMsg').textContent=SHEET_HELP;
$('#cCustomUp').onclick=()=>$('#cCustomFile').click();
$('#cCustomFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const r=await readSheet(f);draft.custom=r.url;draftImg=r.im;$('#cCustomMsg').textContent=`Using ${f.name} as your character.`;}catch(err){$('#cCustomMsg').textContent=err.message;}
  buildCreator();};
$('#cCustomDel').onclick=()=>{draft.custom=null;draftImg=null;$('#cCustomMsg').textContent=SHEET_HELP;buildCreator();};
$('#cCustomTpl').onclick=()=>saveTemplate(draft,draftEquip(),m=>{$('#cCustomMsg').textContent=m+' Repaint it, keep the size, and upload it here.';});
$('#pCustomUp').onclick=()=>$('#pCustomFile').click();
$('#pCustomFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const r=await readSheet(f);S.char.custom=r.url;CUSTOM=r.im;$('#pCustomMsg').textContent=`Using ${f.name} as your character.`;refreshSprites();save();}catch(err){$('#pCustomMsg').textContent=err.message;}
  renderPanel();};
$('#pCustomDel').onclick=()=>{S.char.custom=null;CUSTOM=null;$('#pCustomMsg').textContent='';refreshSprites();save();renderPanel();};
$('#pCustomTpl').onclick=()=>saveTemplate(S.char.look,S.equip,m=>{$('#pCustomMsg').textContent=m;});
$('#btnContinue').onclick=()=>{$('#title').hidden=true;startFloor(S.floor||1);};
// Only once the "You fell" dialog is showing, so a key still held from the fight does not skip it.
function respawn(){if(mode!=='dead'||$('#dead').hidden)return;S.hp=null;$('#dead').hidden=true;startFloor(G.n);}
$('#btnRespawn').onclick=respawn;

/* ---------- pause menu ---------- */
function openPause(){
  if(mode!=='play')return;mode='pause';inp.atk=false;inp.block=false;for(const k in keys)keys[k]=false;save();
  $('#pauseTxt').textContent=`${S.char.name}, level ${S.char.level}, floor ${G.n}. `+(saveOk?'Progress is saved.':'This browser is blocking storage, so progress will not survive a reload.');
  $('#pause').hidden=false;
}
function closePause(){if(mode!=='pause')return;$('#pause').hidden=true;mode='play';}
function quitToTitle(){save();showTitle();}
$('#btnResume').onclick=closePause;
$('#btnSaveQuit').onclick=quitToTitle;
$('#btnMenu').addEventListener('click',e=>{e.currentTarget.blur();openPause();});

/* ---------- gear panel ---------- */
let sel=null; // {from:'bag',i} | {from:'eq',slot}
// The same panel serves as the blacksmith's counter: opened next to a smith it also shows the stock and allows enhancing.
let atSmith=null;   // the open smith's shop: {stock:[{it,price}], potions}, stored in S.shops
function makeStock(){   // one weapon of your own class, then five random pieces, all at this floor's level
  const rar=()=>{const r=Math.random();return r<.03?3:r<.2?2:r<.55?1:0;};   // a shop sells mostly ordinary gear: 45% common, 35% uncommon, 17% rare, 3% epic, never legendary
  const w=S.equip.weapon,st=[makeWeapon(w.type,G.n,Math.max(1,rar()),w.school)];
  for(let i=0;i<5;i++){const it=randomItem(G.n,0),q=rar();st.push(it.slot==='weapon'?makeWeapon(it.type,G.n,q,it.school):it.slot==='armor'?makeArmor(it.type,G.n,q):it.slot==='boots'?makeBoots(it.type,G.n,q):makeTrinket(it.type,G.n,q));}
  return st.map(it=>({it,price:buyPrice(it)}));
}
function openPanel(smith){
  if(mode!=='play')return;mode='panel';inp.atk=false;for(const k in keys)keys[k]=false;sel=null;
  atSmith=smith?smith.shop:null;if(atSmith&&!atSmith.stock)atSmith.stock=makeStock();
  $('#panel').hidden=false;renderPanel();
}
function closePanel(){if(mode!=='panel')return;atSmith=null;for(const it of S.inv)delete it.isNew;bagBadge();$('#panel').hidden=true;mode='play';save();}
function cell(it,on,label,bag){
  const b=document.createElement('button');b.className='cell'+(on?' on':'')+(it?'':' empty');
  if(it){const c=document.createElement('canvas');c.width=c.height=24;drawItemIcon(c,it);b.appendChild(c);b.style.borderColor=RARITY[it.rarity].color;b.title=it.name;
    if(it.plus){const e=document.createElement('em');e.textContent='+'+it.plus;b.appendChild(e);}
    if(bag&&it.isNew)b.appendChild(document.createElement('u'));
    if(bag&&isUpgrade(it)){const a=document.createElement('s');a.textContent='\u25B2';b.appendChild(a);b.title=it.name+' (better than equipped)';}}
  else{b.dataset.l=label||'';b.tabIndex=-1;}
  return b;
}
const SLOTL={weapon:'Weapon',armor:'Armor',boots:'Boots',trinket:'Trinket'};
function selItem(){if(!sel||sel.from==='potion')return null;if(sel.from==='shop')return atSmith&&atSmith.stock[sel.i]?atSmith.stock[sel.i].it:null;return sel.from==='bag'?S.inv[sel.i]:S.equip[sel.slot];}
function renderPanel(){
  calcStats();const c=S.char;
  $('#pTitle').textContent=c.name;$('#pSub').textContent=`Level ${c.level} ${classOf(S.equip.weapon).toLowerCase()}, floor ${G.n}. ${c.xp} / ${xpNeed(c.level)} experience`;
  drawPreview($('#pPrev'),c.look,S.equip,c.custom?CUSTOM:null);
  $('#pCustomDel').hidden=!c.custom;
  const eq=$('#pEquip');eq.innerHTML='';
  for(const s of['weapon','armor','boots','trinket']){const it=S.equip[s],b=cell(it,sel&&sel.from==='eq'&&sel.slot===s,SLOTL[s]);if(it)b.onclick=()=>{sel={from:'eq',slot:s};renderPanel();};eq.appendChild(b);}
  $('#pPts').textContent=c.pts?`Attributes, ${c.pts} points to spend`:'Attributes';
  const at=$('#pAttrs');at.innerHTML='';
  [['str','Strength','+4% melee damage'],['agi','Agility','move and attack speed'],['dex','Dexterity','crit, evade, +3% bow damage'],['vit','Vitality','+14 health, regen'],['int','Intelligence','+4% mage damage'],['fai','Faith','+5% healing, +4% healer damage'],['mnd','Mind','+10 max mana'],['spr','Spirit','+0.25 mana per second']].forEach(([k,n,d])=>{
    const row=document.createElement('div');row.className='attr';const bonus=k==='int'?ST.int-c.int:k==='fai'?ST.fai-c.fai:0;
    row.innerHTML=`<b>${n} ${c[k]}${bonus?` <i>+${bonus}</i>`:''}</b><span>${d}</span>`;
    const b=document.createElement('button');b.className='btn small';b.textContent='+';b.disabled=!c.pts;b.setAttribute('aria-label','Add a point to '+n);
    b.onclick=()=>{if(c.pts>0){c.pts--;c[k]++;const full=P.hp>=ST.maxHp;calcStats();if(full||k==='vit')P.hp=Math.min(ST.maxHp,P.hp+14);if(k==='mnd')P.mp=Math.min(ST.maxMp,P.mp+10);renderPanel();}};
    row.appendChild(b);at.appendChild(row);});
  const dps=ST.dmg*ST.aspd*(1+ST.crit/100*(ST.critDmg/100-1));
  $('#pStats').innerHTML=[['Health',ST.maxHp],['Damage per hit',ST.dmg.toFixed(1)],['Attacks per second',ST.aspd.toFixed(2)],['Damage per second',dps.toFixed(1)],
    ['Critical chance',ST.crit.toFixed(0)+'%'],['Critical damage',ST.critDmg+'%'],['Defense',ST.def+' ('+Math.round(100-10000/(100+ST.def))+'% less damage)'],
    ['Evade chance',ST.evade.toFixed(0)+'% (30% at most)'],['Move speed',Math.round(ST.move)],
    ['Mana',ST.maxMp],['Mana per second',ST.mpRegen.toFixed(2)],
    ...(ST.skill==='fireball'?[['Fireball damage',(ST.dmg*2.6).toFixed(0)]]:ST.skill==='heal'?[['Heal restores',healAmount()]]:[]),['Kills',S.kills],['Deaths',S.deaths]].map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
  $('#bagN').textContent=`Bag ${S.inv.length} / ${BAG_SIZE}`;$('#pShards').textContent=S.shards;
  $('#pTitle').textContent=atSmith?'Blacksmith':c.name;
  $('#shopBox').hidden=!atSmith;
  if(atSmith){const sg=$('#sGrid');sg.innerHTML='';
    atSmith.stock.forEach((e,i)=>{const b=cell(e.it,sel&&sel.from==='shop'&&sel.i===i,'',true);b.dataset.p=e.price;b.title=e.it.name+', '+e.price+' shards';b.onclick=()=>{sel={from:'shop',i};renderPanel();};sg.appendChild(b);});
    const pb=document.createElement('button');pb.className='cell'+(sel&&sel.from==='potion'?' on':'');pb.dataset.p=potionPrice();pb.title='Potion';
    const pc=document.createElement('canvas');pc.width=pc.height=24;const px=pc.getContext('2d');
    px.fillStyle='#262630';px.fillRect(0,0,24,24);px.fillStyle='#050508';px.fillRect(8,3,8,3);px.fillRect(6,6,12,13);px.fillStyle='#e6e1d3';px.fillRect(10,4,4,2);px.fillStyle='#d9534f';px.fillRect(7,9,10,9);px.fillStyle='#f1b0a8';px.fillRect(8,10,2,3);
    pb.appendChild(pc);const pe=document.createElement('em');pe.textContent='x'+atSmith.potions;pb.appendChild(pe);pb.onclick=()=>{sel={from:'potion'};renderPanel();};sg.appendChild(pb);}
  const g=$('#pGrid');g.innerHTML='';
  for(let i=0;i<BAG_SIZE;i++){const it=S.inv[i],b=cell(it,sel&&sel.from==='bag'&&sel.i===i,'',true);if(it){b.onclick=()=>{sel={from:'bag',i};delete it.isNew;renderPanel();};b.ondblclick=()=>{sel={from:'bag',i};equipSel();};}g.appendChild(b);}
  renderDetail();
  $('#saveNote').textContent=saveOk?'Progress saves in this browser every 20 seconds and when you close this panel.':'This browser is blocking storage, so progress will not survive a reload.';
}
function cmp(a,b,dec=0){const d=a-b;if(Math.abs(d)<(dec?.05:.5))return'';return`<i class="${d>0?'up':'down'}">${d>0?'+':''}${d.toFixed(dec)}</i>`;}
function renderDetail(){
  const el=$('#pDetail'),it=selItem();
  if(sel&&sel.from==='potion'&&atSmith){const pr=potionPrice();
    el.innerHTML=`<h4>Potion</h4><div class="sub">Restores 45% of your health. You carry ${S.potions}. The smith has ${atSmith.potions} left.</div>`;
    const a=document.createElement('div');a.className='acts';const b=document.createElement('button');b.className='btn small primary';b.textContent=`Buy for ${pr} shards`;
    b.disabled=S.shards<pr||atSmith.potions<=0;b.onclick=()=>{if(S.shards>=pr&&atSmith.potions>0){S.shards-=pr;atSmith.potions--;S.potions++;sfx('pick');renderPanel();}};
    a.appendChild(b);el.appendChild(a);return;}
  if(!it&&atSmith){el.innerHTML='<p class="muted">Pick something from the stock to see it against what you are wearing, or pick one of your own pieces to enhance it. Prices are in shards.</p>';return;}
  if(!it){el.innerHTML=`<p class="muted">${S.inv.length?'Select an item to compare it with what you are wearing. Double-click an item in the bag to equip it.':'Your bag is empty. Enemies and chests drop weapons, armor, boots and trinkets.'}</p>`;return;}
  const R=RARITY[it.rarity],cur=S.equip[it.slot],other=(sel.from==='bag'||sel.from==='shop')&&cur?cur:null,m=itemMult(it);
  let h=`<h4 style="color:${R.color}">${esc(it.name)}${it.plus?' +'+it.plus:''}</h4>`;
  const kind=it.slot==='weapon'?(it.school?'Grimoire of '+GRIM[it.school].label:WTYPES[it.type].name)+' ('+classOf(it).toLowerCase()+')':it.slot==='armor'?ATYPES[it.type].name:it.slot==='boots'?BTYPES[it.type].name:TTYPES[it.type].name;
  h+=`<div class="sub">${R.name} ${kind.toLowerCase()}, item level ${it.ilvl}${sel.from==='eq'?', equipped':sel.from==='shop'?', for sale':''}</div>`;
  const ln=(l,v,d='')=>`<div class="ln"><span>${l}</span><span>${v}${d}</span></div>`;
  if(it.slot==='weapon'){
    const T=WTYPES[it.type],d=it.base.dmg*m,od=other?other.base.dmg*itemMult(other):0,oT=other?WTYPES[other.type]:null;
    const shot=T.magic||T.ranged,sk=SKILLS[skillOf(it)];
    h+=ln(T.magic?'Magic damage':'Damage',d.toFixed(1),other?cmp(d,od,1):'');
    h+=ln(T.magic?'Casts per second':T.ranged?'Shots per second':'Attacks per second',T.aspd.toFixed(2),other?cmp(T.aspd,oT.aspd,2):'');
    h+=ln('Damage per second',(d*T.aspd).toFixed(1),other?cmp(d*T.aspd,od*oT.aspd,1):'');
    h+=ln(shot?'Range':'Reach',T.range+(shot?'':T.arc<50?', thrust':', '+T.arc+'\u00b0 arc'));
    if(T.crit)h+=ln('Critical chance','+'+T.crit+'%');
    if(T.def)h+=ln('Defense','+'+T.def);
    if(T.shield){const SH=SHIELDS[T.shield];h+=ln('Off hand',SH.name);h+=`<div class="pas" style="color:var(--bone)">Block: hold H to stop ${Math.round(SH.cut*100)}% of each blow from the front, for ${SH.cost} mana a blow. <span class="muted">${T.shield==='buckler'?'Raise it just as a blow lands and it is turned completely.':'You move slowly behind it.'}</span></div>`;}
    h+=`<div class="pas" style="color:var(--bone)">Skill: ${sk.name}, ${sk.mp} mana, ${sk.cd}s cooldown. <span class="muted">${sk.desc}</span></div>`;
    if(T.magic)h+=`<div class="pas" style="color:var(--dim)">A grimoire of ${GRIM[it.school].label} only ever carries bonuses to ${GRIM[it.school].attr}.</div>`;
    for(const a of it.aff)h+=`<div class="pas">${affDef(it,a.id).fmt(a.v)}</div>`;
  }else{
    const om=other?itemMult(other):1;
    if(it.base.def!=null)h+=ln('Defense',Math.round(it.base.def*m),other?cmp(it.base.def*m,(other.base.def||0)*om):'');
    if(it.base.hp)h+=ln('Health','+'+Math.round(it.base.hp*m),other?cmp(it.base.hp*m,(other.base.hp||0)*om):'');
    if(it.base.move)h+=ln('Move speed',(it.base.move>0?'+':'')+it.base.move+'%',other?cmp(it.base.move,other.base.move||0):'');
    for(const a of it.aff)h+=`<div class="pas">${GEAR_AFFIX[a.id].fmt(a.v)}</div>`;
    if(sel.from==='bag'||sel.from==='shop')h+=equipDiff(it);
  }
  el.innerHTML=h;
  const acts=document.createElement('div');acts.className='acts';
  const btn=(t,cls,fn,dis)=>{const b=document.createElement('button');b.className='btn small '+cls;b.textContent=t;b.disabled=!!dis;b.onclick=fn;acts.appendChild(b);};
  if(sel.from==='shop'){const e=atSmith.stock[sel.i],full=S.inv.length>=BAG_SIZE;
    btn(full?'Bag is full':`Buy for ${e.price} shards`,'primary',()=>{if(S.shards>=e.price&&S.inv.length<BAG_SIZE){S.shards-=e.price;S.inv.push(e.it);atSmith.stock.splice(sel.i,1);sel={from:'bag',i:S.inv.length-1};sfx('pick');renderPanel();}},full||S.shards<e.price);
    el.appendChild(acts);return;}
  if(sel.from==='bag')btn('Equip','primary',equipSel);
  if(it.slot!=='trinket'&&!atSmith){const n=document.createElement('span');n.className='muted';n.style.alignSelf='center';n.textContent='Enhancing is done at a blacksmith.';acts.appendChild(n);}
  if(it.slot!=='trinket'&&atSmith){const cost=enhanceCost(it);
    if((it.plus||0)>=10)btn('Fully enhanced','',()=>{},true);
    else btn(`Enhance to +${(it.plus||0)+1} for ${cost} shards`,'',()=>{if(S.shards>=cost){S.shards-=cost;it.plus=(it.plus||0)+1;sfx('lvl');afterGearChange();}},S.shards<cost);}
  if(sel.from==='bag')btn(`Salvage for ${salvageValue(it)} shards`,'',()=>{S.shards+=salvageValue(it);S.inv.splice(sel.i,1);sel=null;sfx('pick');renderPanel();});
  if(sel.from==='eq'&&it.slot==='trinket')btn('Unequip','',()=>{if(S.inv.length<BAG_SIZE){S.inv.push(it);S.equip.trinket=null;sel=null;afterGearChange();}},S.inv.length>=BAG_SIZE);
  el.appendChild(acts);
}
// For armor, boots and trinkets: every total that would change if you wore this instead, affixes included.
const DIFF=[['Health',s=>s.maxHp,0],['Defense',s=>s.def,0],['Evade chance',s=>s.evade,0,'%'],['Move speed',s=>s.move,0],['Critical chance',s=>s.crit,0,'%'],
  ['Health per second',s=>s.regen,1],['Mana',s=>s.maxMp,0],['Mana per second',s=>s.mpRegen,2],['Skill recharge',s=>s.cdr,0,'% faster'],
  ['Damage reflected',s=>s.g.thorns||0,0,'%'],['Experience',s=>s.g.xp||0,0,'% more']];
function equipDiff(it){
  const now=computeStats(S.char,S.equip),alt=computeStats(S.char,{...S.equip,[it.slot]:it});
  const rows=DIFF.filter(([,f,dec])=>Math.abs(f(alt)-f(now))>=(dec?.05:.5)).map(([l,f,dec,u=''])=>`<div class="ln"><span>${l}</span><span>${f(alt).toFixed(dec)}${u}${cmp(f(alt),f(now),dec)}</span></div>`);
  return`<div class="sub" style="margin-top:8px">${S.equip[it.slot]?'If you wear this instead':'If you wear this'}</div>`+(rows.join('')||'<div class="muted">No change to your totals.</div>');
}
function equipSel(){
  const it=selItem();if(!it||sel.from!=='bag')return;
  const old=S.equip[it.slot];S.equip[it.slot]=it;
  if(old)S.inv[sel.i]=old;else S.inv.splice(sel.i,1);
  sel={from:'eq',slot:it.slot};sfx('pick');afterGearChange();
}
function afterGearChange(){calcStats();refreshSprites();refreshHudStatic();renderPanel();}
$('#pClose').onclick=closePanel;
/* ---------- debug menu ----------
   Off for players. Open the game with ?debug in the address (index.html?debug, or localhost:8000/?debug)
   and the ` key and the Debug button in Gear open it. */
const DEBUG=new URLSearchParams(location.search).has('debug');
function openDebug(){
  if(!DEBUG||mode!=='play')return;mode='debug';inp.atk=false;for(const k in keys)keys[k]=false;
  const el=$('#dbgBtns');el.innerHTML='';
  const add=(t,fn,stay)=>{const b=document.createElement('button');b.className='btn small';b.textContent=t;b.onclick=()=>{fn();if(stay)openDebugRefresh();else closeDebug();};el.appendChild(b);};
  const jump=n=>{S.hp=null;S.cp=0;S.cpFloor=0;startFloor(n);};
  for(const n of[1,2,3])add('Play floor '+n,()=>jump(n));
  const lvl=k=>{const c=S.char;c.level+=k;c.pts+=3*k;calcStats();P.hp=ST.maxHp;P.mp=ST.maxMp;};
  add('Level +1 (now '+S.char.level+')',()=>lvl(1),true);add('Level +5',()=>lvl(5),true);
  add('Shards +500 (now '+S.shards+')',()=>{S.shards+=500;},true);
  add('Full heal',()=>{P.hp=ST.maxHp;P.mp=ST.maxMp;});
  add('God mode: '+(god?'on':'off'),()=>{god=!god;},true);
  add('Go to the boss gate',()=>{const q=G.gates[1];P.x=q.x-18;P.y=q.y;P.dash=null;});
  add('Go to the next blacksmith',()=>{const i=(Math.max(0,G.smiths.findIndex(q=>hyp(q.x-P.x,q.y-P.y)<60))+1)%G.smiths.length,q=G.smiths[i];P.x=q.x;P.y=q.y+24;P.dash=null;});
  add('Close',()=>{});
  $('#debug').hidden=false;
}
function openDebugRefresh(){mode='play';openDebug();}
function closeDebug(){if(mode!=='debug')return;$('#debug').hidden=true;mode='play';}
$('#pDebug').hidden=!DEBUG;
$('#pDebug').onclick=()=>{closePanel();openDebug();};
$('#pMute').onclick=toggleMute;
$('#pQuit').onclick=quitToTitle;
$('#btnBag').addEventListener('click',e=>{e.currentTarget.blur();openPanel();});
holdBtn($('#slAtk'),()=>{inp.atk=true;atkBuf=.18;},()=>{inp.atk=false;});
holdBtn($('#slSkill'),useSkill);holdBtn($('#slBlock'),()=>{inp.block=true;},()=>{inp.block=false;});
$('#askGo').onclick=enterChamber;$('#askNo').onclick=closeAsk;holdBtn($('#slDodge'),dodge);holdBtn($('#slPot'),usePotion);
elPrompt.addEventListener('click',e=>{e.currentTarget.blur();interact();});
// Save whenever the page goes away mid-run, whatever menu is open. Hiding the tab during play also pauses the game.
const inRun=()=>!!G&&mode!=='title'&&mode!=='creator';
addEventListener('pagehide',()=>{if(inRun())save();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;if(mode==='play')openPause();else if(inRun())save();});

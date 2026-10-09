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
  setTxt('hShards',String(S.shards));setTxt('potN',String(S.potions));setTxt('foodN',String(S.rations||0));setTxt('drinkN',String(S.flasks||0));setTxt('emptyN',S.empties?S.empties+' empty':'');
  setTxt('hBuff',P.buff?`${BUFFS[P.buff.id].name}, ${Math.max(1,Math.ceil(P.buff.t/60))} min`:'');
  for(const k of['food','drink']){const v=clamp((P[k]==null?100:P[k])/100,0,1);setStyle(k+'w',$('#'+k+'Fill'),'width',(v*100).toFixed(1)+'%');
    const low=v*100<NEED_LOW;if(hc[k+'low']!==low){hc[k+'low']=low;$('#'+k+'Fill').parentNode.classList.toggle('low',low);}}
  setStyle('cds',cdSk,'height',(P.skillMax?P.skillCd/P.skillMax*100:0).toFixed(0)+'%');
  setStyle('mpw',elMp,'width',(clamp(P.mp/ST.maxMp,0,1)*100).toFixed(1)+'%');setTxt('mpTxt',Math.floor(P.mp)+' / '+ST.maxMp);
  const lack=P.mp<SKILLS[ST.skill].mp||P.safe;if(hc.lack!==lack){hc.lack=lack;elSk.classList.toggle('lack',lack);}
  if(hc.safe!==P.safe){hc.safe=P.safe;$('#slAtk').classList.toggle('lack',!!P.safe);}
  setTxt('hFloor',G.village?'The root village'+(NET.on?', channel '+NET.ch:''):'Floor '+G.n+(P.safe?', safe room':''));
  setStyle('cdd',cdDo,'height',(P.dodgeCd/.9*100).toFixed(0)+'%');
  setStyle('cdp',cdPo,'height',(P.potCd/1.2*100).toFixed(0)+'%');
  if(G.bossEnt&&G.bossAwake&&!G.bossEnt.dead)setStyle('bw',elBoss,'width',(clamp(G.bossEnt.hp/G.bossEnt.maxHp,0,1)*100).toFixed(1)+'%');
  const tr=nearTrader(),tk=nearTalker(),wl=nearWell();
  const near=G.gate&&hyp(G.gate.x-P.x,G.gate.y-P.y)<20?'up':nearHome()?'home':nearGate()?'boss':tr?'trader:'+tr.name:nearStash()?'stash':nearSmith()?'smith':
    nearGuild()?'guild':nearBoard()?'board':plotAt()>=0?'plot'+plotAt()+plotState(plotAt()):
    wl?'well'+(S.empties>0?S.empties:''):tk?'talk:'+tk.name:'';
  if(hc.near!==near){hc.near=near;elPrompt.hidden=!near;
    if(near.startsWith('trader:'))elPrompt.innerHTML=esc(tr.name)+'<kbd>E</kbd>';
    else if(near.startsWith('talk:'))elPrompt.innerHTML='Talk to the '+esc(tk.name.toLowerCase().startsWith('captain')?tk.name.replace('Captain','captain'):tk.name.toLowerCase())+'<kbd>E</kbd>';
    if(near==='up')elPrompt.innerHTML='Climb to floor '+(G.n+1)+'<kbd>E</kbd>';
    else if(near==='boss')elPrompt.innerHTML='Boss chamber gate<kbd>E</kbd>';
    else if(near==='home')elPrompt.innerHTML=(G.village?'Teleport Gate':'Floor gate')+'<kbd>E</kbd>';
    else if(near==='smith')elPrompt.innerHTML='Blacksmith<kbd>E</kbd>';
    else if(near==='stash')elPrompt.innerHTML='Stash<kbd>E</kbd>';
    else if(near==='guild')elPrompt.innerHTML='Adventurers\u2019 Guild<kbd>E</kbd>';
    else if(near==='board')elPrompt.innerHTML='Notice board<kbd>E</kbd>';
    else if(near.startsWith('plot'))elPrompt.innerHTML=plotPrompt(plotAt())+'<kbd>E</kbd>';
    else if(near.startsWith('well'))elPrompt.innerHTML=(S.empties>0?`Fill ${S.empties} empty flask${S.empties>1?'s':''} at the well`:'The well')+'<kbd>E</kbd>';
}
}
function refreshHudStatic(){
  $('#hName').textContent=S.char.name;setTxt('hFloor',G.village?'The root village':'Floor '+G.n);
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
function save(){if(NET.on)return;   // online, the server keeps the character
  S.floor=G?G.n:S.floor;if(P&&!P.dead)S.hp=Math.round(P.hp);if(P&&P.S===S)storeNeeds(P);saveOk=Store.save(S);}
// Floors start a beat after the click or key press that asked for them, not inside it.
let starting=false;
// cp: arrive at that safe point of floor n (0 is its entrance); left out, you arrive where you last stood on it.
function startFloor(n,cp){if(starting)return;starting=true;setTimeout(()=>{starting=false;enterFloor(n,cp);},60);}
// Single player: build floor n with you as its only player.
// Floor 0 is the root village.
function startWorld(n){G=n===0?genVillage():genFloor(n,S.seed);G.mapCv=G.village?paintVillage(G):paintMap(G);P=makePlayer(1,S);G.players=[P];setPlayer(P);}
const placeName=n=>n===0?'the root village':'floor '+n;
function enterFloor(n,cp){
  if(P&&P.S===S)storeNeeds(P);   // hunger and thirst carry over from the floor you leave
  if(cp!=null){S.cp=cp;S.cpFloor=n;}
  S.floor=n;S.best=Math.max(S.best||1,n);
  startWorld(n);
  if(S.hp!=null&&S.hp>0)P.hp=Math.min(ST.maxHp,S.hp);
  refreshSprites();refreshHudStatic();reveal();drawMini();
  for(const k in hc)delete hc[k];
  $('#boss').hidden=true;$('#dead').hidden=true;$('#ask').hidden=true;$('#debug').hidden=true;$('#pause').hidden=true;$('#travel').hidden=true;$('#hud').hidden=false;$('#toasts').innerHTML='';bagBadge();
  mode='play';inp.atk=false;
  if(n===0)banner('The root village','Home, at the foot of the Blackspire. Step into the Teleport Gate to climb.',3400);
  else{const FL=floorDef(n);banner('Floor '+n,FL.intro,FL.introMs);}
  save();
}
// The title screen: Single player or Online. msg, if given, says why you are back here (a lost connection).
function showTitle(msg){
  if(NET.on||NET.ws)NET.close();
  mode='title';
  const sv=Store.load();
  S=sv||newState('Wanderer',{skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0]},'sword',OUTFITS[0]);
  startWorld(S.floor==null?1:S.floor);G.enemies=[];G.bossEnt=null;CUSTOM=null;refreshSprites();useCustom(S.char.custom||null);
  atSmith=atWho=null;
  for(const id of['#hud','#panel','#creator','#dead','#ask','#debug','#pause','#travel','#online','#boss'])$(id).hidden=true;
  $('#title').hidden=false;
  const b=$('#btnContinue');b.hidden=!sv;
  if(sv)b.textContent=`Continue as ${sv.char.name}, level ${sv.char.level}, ${sv.floor===0?'in the root village':'floor '+sv.floor}`;
  $('#btnNew').className=sv?'btn':'btn primary';
  $('#titleMsg').hidden=!msg;$('#titleMsg').textContent=msg||'';
  $('#modeBtns').hidden=false;$('#soloBtns').hidden=true;
}
$('#btnSolo').onclick=()=>{$('#modeBtns').hidden=true;$('#soloBtns').hidden=false;$('#titleMsg').hidden=true;};
$('#btnSoloBack').onclick=()=>{$('#modeBtns').hidden=false;$('#soloBtns').hidden=true;};
$('#btnOnline').onclick=()=>openOnline();

/* ---------- online: log in, then play ---------- */
const onSay=t=>{$('#onTxt').textContent=t;};
let onChar=null;   // the account's online character, if it has one: {name, level, floor}
function openOnline(){
  mode='online';$('#title').hidden=true;$('#online').hidden=false;
  const sv=NET.saved();$('#onUrl').value=sv.url||NET.defaultUrl();$('#onName').value=sv.name||'';$('#onPw').value='';
  showLogin('Play with others. Online characters live on the server, separate from your single-player save.');
  if(sv.token&&sv.url){onSay('Logging in as '+(sv.name||'')+'\u2026');onConnect(sv.url).then(()=>NET.send({t:'resume',token:sv.token})).catch(e=>showLogin(e.message));}
}
function showLogin(t){$('#onLogin').hidden=false;$('#onChar').hidden=true;onSay(t);}
async function onConnect(url){await NET.connect(url);NET.remember({url});}
function onAuthAsk(kind){
  const url=$('#onUrl').value.trim(),name=$('#onName').value.trim(),pw=$('#onPw').value;
  if(!name||!pw){onSay('Enter a name and a password.');return;}
  onSay(kind==='login'?'Logging in\u2026':'Creating your account\u2026');
  onConnect(url).then(()=>NET.send({t:kind,name,pw})).catch(e=>onSay(e.message));
}
NET.onMsg=o=>{
  if(o.t==='auth'){
    if(!o.ok){NET.remember({token:null});NET.close();showLogin(o.error);return;}
    NET.remember({token:o.token,name:o.name});$('#onPw').value='';onChar=o.char;
    $('#onLogin').hidden=true;$('#onChar').hidden=false;
    $('#onPlay').textContent=onChar?`Enter as ${onChar.name}, level ${onChar.level}`:'Create your online character';
    onSay(`Logged in as ${o.name}.`+(onChar?'':' This account has no character yet.'));
  }else if(o.t==='created'){
    if(!o.ok){$('#cMsg').textContent=o.error;return;}
    onChar=o.char;NET.send({t:'play'});
  }
};
$('#onLoginBtn').onclick=()=>onAuthAsk('login');
$('#onRegBtn').onclick=()=>onAuthAsk('register');
$('#onPw').addEventListener('keydown',e=>{if(e.key==='Enter')onAuthAsk('login');});
$('#onPlay').onclick=()=>{if(onChar)NET.send({t:'play'});else openCreator('online');};
$('#onLogout').onclick=()=>{const t=NET.saved().token;if(t)NET.send({t:'logout',token:t});NET.remember({token:null});NET.close();showLogin('Logged out.');};
$('#onBack').onclick=$('#onBack2').onclick=()=>showTitle();

/* ---------- character creator ---------- */
let armed=false;
const draft={skin:SKINS[1],hair:HAIRS[0],style:0,eyes:EYES[0],outfit:OUTFITS[0],weapon:'sword'};
function drawPreview(cv,look,eq,custom){
  const x=uiCtx(cv,34,34);
  const w=buildWeapon(eq.weapon.type,eq.weapon.tint,eq.weapon.school),av=buildAvatar(look,eq,custom);
  x.fillStyle='rgba(0,0,0,.45)';x.fillRect(11,28,12,2);
  cut(x,av,0,0,FRAME_W,FRAME_H,5,5);   // the front-facing standing frame
  if(eq.weapon.type==='grimoire')put(x,w,19,11);
  else if(eq.weapon.type==='bow')put(x,w,15,11);
  else{x.save();x.translate(22,19);x.rotate(-1.05);put(x,w,-4,-5);x.restore();}
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
let creatorFor='solo';   // solo: a new local save; online: a character on the server
function openCreator(kind){
  creatorFor=kind;armed=false;$('#cMsg').textContent='';$('#cGo').textContent=kind==='online'?'Create and enter':'Enter the village';
  $('#title').hidden=true;$('#online').hidden=true;$('#creator').hidden=false;mode='creator';buildCreator();
}
$('#btnNew').onclick=()=>openCreator('solo');
$('#cBack').onclick=()=>{if(creatorFor==='online'){$('#creator').hidden=true;$('#online').hidden=false;mode='online';}else showTitle();};
$('#cGo').onclick=()=>{
  if(creatorFor==='online'){
    $('#cMsg').textContent='';
    NET.send({t:'create',name:($('#cName').value.trim()||'Wanderer').slice(0,14),look:{skin:draft.skin,hair:draft.hair,style:draft.style,eyes:draft.eyes},
      weapon:draft.weapon,outfit:draft.outfit,custom:draft.custom||null});
    return;
  }
  const old=Store.load();
  if(old&&!armed){armed=true;$('#cGo').textContent='Replace '+old.char.name+' and start over';return;}
  armed=false;
  const name=($('#cName').value.trim()||'Wanderer').slice(0,14);
  S=newState(name,{skin:draft.skin,hair:draft.hair,style:draft.style,eyes:draft.eyes},draft.weapon,draft.outfit);
  S.char.custom=draft.custom||null;CUSTOM=draft.custom?draftImg:null;
  $('#creator').hidden=true;startFloor(0);   // everyone starts in the root village
};
/* ---------- your own character sheet ----------
   One PNG of 88 x 78 game pixels replaces the layered avatar: 88 x 78, or a whole multiple of it for finer art
   (176 x 156 is drawn at ratio 2). It is kept inside the save. */
let draftImg=null;
async function readSheet(file){
  if(!/\.png$/i.test(file.name)&&file.type!=='image/png')throw new Error(`${file.name} is not a PNG file.`);
  const url=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('The file could not be read.'));r.readAsDataURL(file);});
  const im=await loadImage(url);if(!im)throw new Error(`${file.name} could not be read as a PNG image.`);
  if(!sheetImage(im))throw new Error(`That image is ${im.naturalWidth} × ${im.naturalHeight}. A character sheet must be ${SHEET_W} × ${SHEET_H} (four ${FRAME_W} × ${FRAME_H} frames across, three rows down), or a whole multiple of that up to ×${MAX_RATIO} for finer art.`);
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
const SHEET_HELP='Optional. A PNG of 88 × 78 pixels (or 176 × 156, 264 × 234, 352 × 312 for finer art) replaces the look on the right, whatever gear you wear. Four frames across (stand, step, step, attack), three rows down (facing down, up, right).';
$('#cCustomMsg').textContent=SHEET_HELP;
$('#cCustomUp').onclick=()=>$('#cCustomFile').click();
$('#cCustomFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const r=await readSheet(f);draft.custom=r.url;draftImg=r.im;$('#cCustomMsg').textContent=`Using ${f.name} as your character.`;}catch(err){$('#cCustomMsg').textContent=err.message;}
  buildCreator();};
$('#cCustomDel').onclick=()=>{draft.custom=null;draftImg=null;$('#cCustomMsg').textContent=SHEET_HELP;buildCreator();};
$('#cCustomTpl').onclick=()=>saveTemplate(draft,draftEquip(),m=>{$('#cCustomMsg').textContent=m+' Repaint it, keep the size, and upload it here.';});
$('#pCustomUp').onclick=()=>$('#pCustomFile').click();
$('#pCustomFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const r=await readSheet(f);CUSTOM=r.im;$('#pCustomMsg').textContent=`Using ${f.name} as your character.`;act('custom',[r.url],()=>{refreshSprites();save();renderPanel();});}catch(err){$('#pCustomMsg').textContent=err.message;}
  renderPanel();};
$('#pCustomDel').onclick=()=>{CUSTOM=null;$('#pCustomMsg').textContent='';act('custom',[null],()=>{refreshSprites();save();renderPanel();});};
$('#pCustomTpl').onclick=()=>saveTemplate(S.char.look,S.equip,m=>{$('#pCustomMsg').textContent=m;});
$('#btnContinue').onclick=()=>{$('#title').hidden=true;startFloor(S.floor==null?1:S.floor);};
// Only once the "You fell" dialog is showing, so a key still held from the fight does not skip it.
function respawn(){if(mode!=='dead'||$('#dead').hidden)return;$('#dead').hidden=true;if(NET.on){NET.send({t:'respawn'});return;}S.hp=null;startFloor(G.n);}
$('#btnRespawn').onclick=respawn;

/* ---------- pause menu ---------- */
function openPause(){
  if(mode!=='play')return;mode='pause';inp.atk=false;inp.block=false;for(const k in keys)keys[k]=false;save();
  $('#pauseH').textContent=NET.on?'Menu':'Paused';
  $('#pauseTxt').textContent=`${S.char.name}, level ${S.char.level}, ${placeName(G.n)}. `+(NET.on?'Online, the fight goes on while this is open. Your character is saved on the server.':saveOk?'Progress is saved.':'This browser is blocking storage, so progress will not survive a reload.');
  $('#btnSaveQuit').textContent=NET.on?'Leave to title':'Save and quit to title';
  $('#partyBox').hidden=!NET.on;$('#partyMsg').textContent='';if(NET.on)renderParty();
  $('#pause').hidden=false;
}
// Online: your party, its code, and joining someone else's.
function renderParty(){
  const p=NET.party;if(!p)return;const solo=p.members.length<2;
  $('#partyTxt').textContent=solo?`Your party code is ${p.code}. Share it so others can join you, or enter theirs below.`:`Party code ${p.code}. The leader chooses the floor at the floor gate.`;
  const ul=$('#partyList');ul.innerHTML='';
  for(const m of p.members){const li=document.createElement('li'),n=document.createElement('span'),i=document.createElement('small');
    n.textContent=m.name+(m.id===P.id?' (you)':'');i.textContent=`Level ${m.level}`+(m.id===p.leader?', leader':'');li.append(n,i);ul.appendChild(li);}
  $('#partyLeave').hidden=solo;
}
$('#partyJoin').onclick=()=>{const c=$('#partyCode').value.trim().toUpperCase();if(c.length===6){$('#partyMsg').textContent='Joining\u2026';NET.send({t:'join',code:c});}else $('#partyMsg').textContent='Party codes are 6 letters and digits.';};
$('#partyCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('#partyJoin').click();});
$('#partyLeave').onclick=()=>NET.send({t:'leave'});
function closePause(){if(mode!=='pause')return;$('#pause').hidden=true;mode='play';}
function quitToTitle(){save();showTitle();}   // online, showTitle disconnects

/* ---------- E: gates, the floor gate, blacksmiths ---------- */
function interact(){
  if(mode!=='play'||P.dead)return;
  if(G.gate&&hyp(G.gate.x-P.x,G.gate.y-P.y)<20){if(NET.on)NET.send({t:'climb'});else{S.hp=null;startFloor(G.n+1);}return;}
  if(nearHome()){openTravel();return;}
  const q=nearGate();if(q){askChamber(q);return;}
  const tr=nearTrader();if(tr){openPanel(tr,'trader');return;}
  const st=nearStash();if(st){openPanel(st,'stash');return;}
  const sm=nearSmith();if(sm){openPanel(sm,'smith');return;}
  if(nearGuild()){openGuild(true);return;}
  if(nearBoard()){openGuild(false);return;}
  if(plotAt()>=0){openPlot();return;}
  if(nearWell()){act('fillFlasks',[],n=>{if(n){sfx('pick');log(`Filled ${n} flask${n>1?'s':''} at the well.`);}
    else log('You have no empty flasks to fill. The food and drink stall sells water flasks; drink one and the flask is yours to refill.');hc.near=null;});return;}
  const tk=nearTalker();if(tk){tk.sayUntil=G.time+6;sfx('pick');}
}
// The boss chamber asks first: once inside, the gate seals until the boss dies.
let askGate=null;
function askChamber(q){
  askGate=q;mode='ask';inp.atk=false;for(const k in keys)keys[k]=false;
  $('#askTxt').textContent=`The gate seals behind you. The only ways out are killing ${G.bossEnt.name} or dying. You have ${Math.ceil(P.hp)} of ${ST.maxHp} health and ${S.potions} potion${S.potions===1?'':'s'}.`;
  $('#ask').hidden=false;
}
function closeAsk(){if(mode!=='ask')return;$('#ask').hidden=true;mode='play';askGate=null;}
function confirmChamber(){
  if(mode!=='ask'||!askGate)return;const q=askGate;closeAsk();
  if(NET.on)NET.send({t:'chamber',g:G.gates.indexOf(q)});else enterChamber(q);
}

/* ---------- the fields ----------
   The plot you stand on: buy it, plant it, harvest it (js/sim/fields.js). Each player sees only their own plots. */
const fmtLeft=ms=>{const m=Math.ceil(ms/60000);return m>=60?Math.floor(m/60)+' h '+(m%60)+' min':m+' min';};
function plotState(i){const p=myPlot(i);return!p?'sale':!p.crop?'empty':cropReady(p)?'ready':'growing'+Math.ceil((CROPS[p.crop].grow-(Date.now()-p.t))/60000);}
function plotPrompt(i){const p=myPlot(i);
  if(!p)return`Field plot for sale, ${plotPrice((S.plots||[]).length)} shards`;
  if(!p.crop)return'Your plot: plant it';
  const C=CROPS[p.crop];return cropReady(p)?`Harvest the ${C.plural}`:`${C.name} plot: ${fmtLeft(C.grow-(Date.now()-p.t))} to go`;}
function openPlot(){if(mode!=='play')return;mode='plot';inp.atk=false;for(const k in keys)keys[k]=false;$('#plotbox').hidden=false;renderPlot();}
function closePlot(){if(mode!=='plot')return;$('#plotbox').hidden=true;mode='play';hc.near=null;}
$('#plClose').onclick=closePlot;
function renderPlot(){
  if(mode!=='plot')return;const i=plotAt(),p=myPlot(i),el=$('#plBtns');el.innerHTML='';
  if(i<0){closePlot();return;}
  const btn=(html,cls,fn,dis)=>{const b=document.createElement('button');b.className='btn '+cls;b.innerHTML=html;b.disabled=!!dis;b.onclick=fn;el.appendChild(b);};
  const again=()=>{renderPlot();hc.near=null;};
  if(!p){const pr=plotPrice(S.plots.length);
    $('#plTitle').textContent='Field plot';
    $('#plTxt').textContent=`The soil under the tree is rich in what ${G.crops.map(c=>CROPS[c].plural).join(' and ')} need, and little else. This plot can be yours: ${S.plots.length?'each plot costs twice the last.':'your first costs '+pr+' shards.'}`;
    btn(`Buy this plot<small>${pr} shards</small>`,'primary',()=>act('buyPlot',[],again),S.shards<pr);return;}
  $('#plTitle').textContent='Your plot';
  if(!p.crop){$('#plTxt').textContent='Freshly turned soil. What will it be?';
    for(const c of G.crops){const C=CROPS[c];btn(`Plant ${C.plural}<small>${C.seed} shards for the seed. ${C.desc}</small>`,'primary',()=>act('plant',[c],again),S.shards<C.seed);}return;}
  const C=CROPS[p.crop];
  if(cropReady(p)){$('#plTxt').textContent=`The ${C.plural} are ready.`;btn(`Harvest<small>${C.yield[0]} to ${C.yield[1]} ${C.plural}</small>`,'primary',()=>act('harvest',[],again));return;}
  $('#plTxt').textContent=`${C.name} growing: ${fmtLeft(C.grow-(Date.now()-p.t))} to go. It keeps growing while you are away, in the tower or offline.`;
}

/* ---------- the Adventurers' Guild ----------
   Quests (js/sim/quests.js) are taken and handed in at the clerk by the guild's door; the notice board in the square
   shows the same board to read. Party notices are online only: the server keeps them. */
let atGuild=false;
function openGuild(clerk){
  if(mode!=='play')return;mode='guild';atGuild=clerk;inp.atk=false;for(const k in keys)keys[k]=false;
  if(NET.on)NET.send({t:'notices'});
  $('#guild').hidden=false;renderGuild();
}
function closeGuild(){if(mode!=='guild')return;$('#guild').hidden=true;mode='play';$('#gNoteTxt').blur();}
$('#gClose').onclick=closeGuild;
const rewardText=r=>`${r.shards} shards, ${r.xp} experience`+(r.mats?Object.keys(r.mats).map(k=>`, ${r.mats[k]} ${MATS[k].name}`).join(''):'');
function questCard(q,btns,extra=''){
  const d=document.createElement('div');d.className='quest'+(extra.includes('ready')?' ready':'');
  d.innerHTML=`<div class="qt"><b>${esc(q.title)}</b><small>${esc(q.desc)}</small><span class="rw">${rewardText(q.reward)}</span>${extra.replace('ready','')}</div>`;
  for(const[t,cls,fn,dis]of btns){const b=document.createElement('button');b.className='btn small '+cls;b.textContent=t;b.disabled=!!dis;b.onclick=fn;d.appendChild(b);}
  return d;
}
function renderGuild(){
  if(mode!=='guild')return;
  const L=questLog(),board=questBoard(questDay()),left=questRefreshIn(),h=Math.floor(left/3600000),mn=Math.floor(left%3600000/60000);
  const taken=Object.keys(L.active).length,again=()=>renderGuild();
  $('#gTitle').textContent=atGuild?'Adventurers\u2019 Guild':'Notice board';
  $('#gTxt').textContent=(atGuild?'Take up to '+QUEST_MAX+' quests and hand them in here when they are done.':'Quests are taken and handed in at the Adventurers\u2019 Guild, south of the square.')+
    ` A new board goes up in ${h} h ${mn} min; anything taken and not handed in by then is lost.`;
  $('#gCount').textContent=`${taken} / ${QUEST_MAX}`;
  const mine=$('#gMine');mine.innerHTML='';
  for(const id of Object.keys(L.active)){const q=board.find(x=>x.id===id);if(!q)continue;const[have,need]=questProgress(q),ready=have>=need;
    mine.appendChild(questCard(q,[
      ...(atGuild?[[ready?'Hand in':'Not done yet','primary',()=>act('handIn',[id],again),!ready]]:[]),
      ['Give up','',()=>act('dropQuest',[id],again)]],
      `<span class="pg">${q.kind==='deliver'?'You have':'Progress:'} ${have} / ${need}</span>`+(ready?'ready':'')));}
  if(!taken){const n=document.createElement('div');n.className='none';n.textContent='None taken.';mine.appendChild(n);}
  const bd=$('#gBoard');bd.innerHTML='';
  for(const q of board){if(q.id in L.active)continue;const done=L.done.includes(q.id);
    bd.appendChild(questCard(q,done?[['Handed in','',()=>{},true]]:atGuild?[['Take','primary',()=>act('takeQuest',[q.id],again),taken>=QUEST_MAX]]:[]));}
  // party notices
  const nl=$('#gNotes');nl.innerHTML='';const post=$('#gPostRow');
  if(!NET.on){nl.innerHTML='<div class="none">Party notices are for online play: post one to find party mates, or join someone else\u2019s party from theirs.</div>';post.hidden=true;return;}
  const list=NET.notices||[],leader=NET.party&&NET.party.leader===P.id;
  for(const n of list){const d=document.createElement('div');d.className='quest';
    d.innerHTML=`<div class="qt"><b>${esc(n.name)}, level ${n.level} ${esc(n.cls.toLowerCase())}</b><small>\u201c${esc(n.text)}\u201d</small><span class="pg">Party of ${n.size} / 4, reached floor ${n.best}. Posted ${n.mins?n.mins+' min ago':'just now'}.</span></div>`;
    const b=document.createElement('button');b.className='btn small primary';b.textContent=n.own?'Your party':'Join';b.disabled=n.own;
    b.onclick=()=>{NET.send({t:'join',code:n.code});closeGuild();};d.appendChild(b);nl.appendChild(d);}
  if(!list.length)nl.innerHTML='<div class="none">No notices up. Post one to find party mates.</div>';
  post.hidden=!atGuild||!leader;$('#gUnpost').hidden=!list.some(n=>n.own);
}
$('#gPost').onclick=()=>{const t=$('#gNoteTxt').value.trim();if(!t)return;NET.send({t:'notice',text:t});$('#gNoteTxt').value='';};
$('#gUnpost').onclick=()=>NET.send({t:'unnotice'});

/* ---------- floor gate ----------
   Stands in every start room. It takes you to any floor up to the highest you have unlocked. Enemies and the boss
   are back when you arrive; opened chests stay empty. */
function openTravel(){
  if(mode!=='play')return;mode='travel';inp.atk=false;for(const k in keys)keys[k]=false;
  const el=$('#travelList');el.innerHTML='';
  $('#travel h2').textContent=G.village?'Teleport Gate':'Floor gate';
  const go=(n,cp)=>{closeTravel();if(NET.on)NET.send({t:'travel',n,cp});else{S.hp=null;startFloor(n,cp);}};
  // online the party travels together: up to the highest floor anyone in it has reached, and only the leader chooses
  const best=NET.on?NET.party.best:S.best,leader=!NET.on||NET.party.leader===P.id;
  if(!G.village){const b=document.createElement('button');b.className='btn primary';b.disabled=!leader;
    b.innerHTML='The root village<small>The market, the forge, the inn</small>';b.onclick=()=>go(0);el.appendChild(b);}
  for(let n=1;n<=best;n++){
    const row=document.createElement('div');row.className='trow';
    const b=document.createElement('button');b.className='btn'+(n===G.n?'':' primary');b.disabled=n===G.n||!leader;
    const beaten=floorState(n).boss>0;
    b.innerHTML=`Floor ${n}<small>${n===G.n?'You are here':beaten?'Boss beaten'+(floorState(n).boss>1?' '+floorState(n).boss+' times':''):'Boss not yet beaten'}</small>`;
    b.onclick=()=>go(n,0);row.appendChild(b);
    // single player: the safe points you have visited on that floor, by their place in it
    const pts=leader&&n!==G.n&&S.points&&S.points[n]||[];
    if(pts.length){const count=genFloor(n,S.seed).safe.length;
      for(const i of[...pts].sort((a,c)=>a-c)){const s=document.createElement('button');s.className='btn small';
        s.textContent=i===count-1?'By the boss':'Safe room '+i;s.title='Teleport to this safe point on floor '+n;
        s.onclick=()=>go(n,i);row.appendChild(s);}}
    el.appendChild(row);
  }
  const lead=NET.on&&NET.party.members.find(m=>m.id===NET.party.leader);
  if(!leader){$('#travelTxt').textContent=`The party travels together. Only the leader, ${lead?lead.name:'someone else'}, chooses the floor.`;$('#travel').hidden=false;return;}
  $('#travelTxt').textContent=G.village?'Step through to any floor you have reached, or to a safe point you have visited on it.':
    best>1?'Step through to any floor you have reached. Enemies and the boss will be back; chests you opened stay empty.':'This gate leads to every floor you reach. Beat this floor\u2019s boss to unlock the next one.';
  $('#travel').hidden=false;
}
function closeTravel(){if(mode!=='travel')return;$('#travel').hidden=true;mode='play';}
$('#travelClose').onclick=closeTravel;
$('#btnResume').onclick=closePause;
$('#btnSaveQuit').onclick=quitToTitle;
$('#btnMenu').addEventListener('click',e=>{e.currentTarget.blur();openPause();});

/* ---------- gear panel ---------- */
let sel=null; // {from:'bag',i} | {from:'eq',slot}
// The same panel serves as the trader's pack and the blacksmith's counter: next to a trader it shows the stock and
// supplies; next to a blacksmith it allows enhancing.
let atSmith=null,atWho=null;   // index of the safe room whose trader or blacksmith is open, and which ('trader', 'smith')
const shopNow=()=>atSmith==null||atWho!=='trader'?null:shopOf(atSmith);
const atForge=()=>atSmith!=null&&atWho==='smith';
// Runs a player action (js/sim/actions.js). Single player: right here. Online: on the server, which answers with the
// result and the updated save (net.js), and then done(result) runs.
function act(name,args,done){if(NET.on)return NET.act(name,args,done);const r=runAction(name,args);if(done)done(r);}
function openPanel(npc,who){
  if(mode!=='play')return;mode='panel';inp.atk=false;for(const k in keys)keys[k]=false;sel=null;
  atWho=npc?who:null;atSmith=npc?(who==='trader'?G.traders:who==='stash'?G.stashes:G.smiths).indexOf(npc):null;
  $('#panel').hidden=false;renderPanel();if(atWho==='trader')act('openShop',[atSmith],()=>{if(mode==='panel')renderPanel();});
}
function closePanel(){if(mode!=='panel')return;atSmith=atWho=null;act('seen');bagBadge();$('#panel').hidden=true;mode='play';save();}
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
const atStash=()=>atSmith!=null&&atWho==='stash';
function selItem(){if(!sel||sel.from==='supply'||sel.from==='meal'||sel.from==='pack')return null;if(sel.from==='stash')return S.stash[sel.i]||null;if(sel.from==='shop'){const sh=shopNow();return sh&&sh.stock&&sh.stock[sel.i]?sh.stock[sel.i].it:null;}return sel.from==='bag'?S.inv[sel.i]:S.equip[sel.slot];}
function renderPanel(){
  calcStats();const c=S.char;
  $('#pTitle').textContent=c.name;$('#pSub').textContent=`Level ${c.level} ${classOf(S.equip.weapon).toLowerCase()}, ${placeName(G.n)}. ${c.xp} / ${xpNeed(c.level)} experience`;
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
    b.onclick=()=>act('spend',[k],()=>renderPanel());
    row.appendChild(b);at.appendChild(row);});
  const dps=ST.dmg*ST.aspd*(1+ST.crit/100*(ST.critDmg/100-1));
  $('#pStats').innerHTML=[['Health',ST.maxHp],['Damage per hit',ST.dmg.toFixed(1)],['Attacks per second',ST.aspd.toFixed(2)],['Damage per second',dps.toFixed(1)],
    ['Critical chance',ST.crit.toFixed(0)+'%'],['Critical damage',ST.critDmg+'%'],['Defense',ST.def+' ('+Math.round(100-10000/(100+ST.def))+'% less damage)'],
    ['Evade chance',ST.evade.toFixed(0)+'% (30% at most)'],['Move speed',Math.round(ST.move)],
    ['Mana',ST.maxMp],['Mana per second',ST.mpRegen.toFixed(2)],
    ...(ST.skill==='fireball'?[['Fireball damage',(ST.dmg*2.6).toFixed(0)]]:ST.skill==='heal'?[['Heal restores',healAmount()]]:[]),['Kills',S.kills],['Deaths',S.deaths]].map(r=>`<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('');
  $('#bagN').textContent=`Bag ${S.inv.length} / ${BAG_SIZE}`;$('#pShards').textContent=S.shards;
  $('#pMats').innerHTML=Object.keys(MATS).map(k=>`<span title="${MATS[k].name}"><i class="mat" style="background:${MATS[k].color}"></i> ${S.mats[k]||0}</span>`).join('')+
    Object.keys(CROPS).filter(k=>S.crops&&S.crops[k]).map(k=>`<span title="${CROPS[k].plural}"><i class="mat" style="background:${CROPS[k].color};border-radius:50%"></i> ${S.crops[k]}</span>`).join('');
  const shop=shopNow();
  $('#pTitle').textContent=shop?G.traders[atSmith].name:atForge()?'Blacksmith':atStash()?'Stash':c.name;
  $('#shopBox h3').textContent=atStash()?`Stash ${S.stash.length} / ${STASH_SIZE}`:shop&&G.traders[atSmith].stall?'For sale':'Trader\u2019s pack';
  $('#shopBox').hidden=!shop&&!atStash();$('#sGrid').classList.toggle('tall',atStash());
  if(shop&&TRADER_SELLS[G.traders[atSmith].sells].meals){$('#shopBox h3').textContent='Today\u2019s menu';const sg=$('#sGrid');sg.innerHTML='';
    for(const k in MEALS){const b=document.createElement('button');b.className='cell'+(sel&&sel.from==='meal'&&sel.k===k?' on':'');b.dataset.p=mealPrice(k);b.title=MEALS[k].name;
      const c=document.createElement('canvas');mealIcon(c,k);b.appendChild(c);b.onclick=()=>{sel={from:'meal',k};renderPanel();};sg.appendChild(b);}
    const rb=document.createElement('button');rb.className='cell'+(sel&&sel.from==='pack'?' on':'');rb.title='Packed ration';
    const rc=document.createElement('canvas');supplyIcon(rc,'ration');rb.appendChild(rc);rb.onclick=()=>{sel={from:'pack'};renderPanel();};sg.appendChild(rb);}
  if(atStash()){const sg=$('#sGrid');sg.innerHTML='';
    for(let i=0;i<STASH_SIZE;i++){const it=S.stash[i],b=cell(it,sel&&sel.from==='stash'&&sel.i===i,'',false);
      if(it){b.onclick=()=>{sel={from:'stash',i};renderPanel();};b.ondblclick=()=>act('unstash',[i],r=>{if(r!==false){sel={from:'bag',i:r};sfx('pick');}renderPanel();});}sg.appendChild(b);}}
  if(shop&&!TRADER_SELLS[G.traders[atSmith].sells].meals){const sg=$('#sGrid');sg.innerHTML='';
    (shop.stock||[]).forEach((e,i)=>{const b=cell(e.it,sel&&sel.from==='shop'&&sel.i===i,'',true);b.dataset.p=e.price;b.title=e.it.name+', '+e.price+' shards';b.onclick=()=>{sel={from:'shop',i};renderPanel();};sg.appendChild(b);});
    for(const k of TRADER_SELLS[G.traders[atSmith].sells||'all'].supplies){const s=SUPPLIES[k],pb=document.createElement('button');pb.className='cell'+(sel&&sel.from==='supply'&&sel.k===k?' on':'');pb.dataset.p=supplyPrice(k);pb.title=s.name;
      const pc=document.createElement('canvas');supplyIcon(pc,k);
      pb.appendChild(pc);const pe=document.createElement('em');pe.textContent='x'+shop[s.key];pb.appendChild(pe);pb.onclick=()=>{sel={from:'supply',k};renderPanel();};sg.appendChild(pb);}}
  const g=$('#pGrid');g.innerHTML='';
  for(let i=0;i<BAG_SIZE;i++){const it=S.inv[i],b=cell(it,sel&&sel.from==='bag'&&sel.i===i,'',true);if(it){b.onclick=()=>{sel={from:'bag',i};delete it.isNew;renderPanel();};b.ondblclick=()=>{sel={from:'bag',i};equipSel();};}g.appendChild(b);}
  renderDetail();
  $('#pDebug').hidden=!DEBUG||NET.on;
  $('#saveNote').textContent=NET.on?'Your character is saved on the server.':saveOk?'Progress saves in this browser every 20 seconds and when you close this panel.':'This browser is blocking storage, so progress will not survive a reload.';
}
function cmp(a,b,dec=0){const d=a-b;if(Math.abs(d)<(dec?.05:.5))return'';return`<i class="${d>0?'up':'down'}">${d>0?'+':''}${d.toFixed(dec)}</i>`;}
function renderDetail(){
  const el=$('#pDetail'),it=selItem(),shop=shopNow();
  if(sel&&sel.from==='meal'&&shop){const k=sel.k,m=MEALS[k],pr=mealPrice(k),B=BUFFS[m.buff];
    const fills=[m.food&&`${m.food}% of your hunger`,m.drink&&`${m.drink}% of your thirst`].filter(Boolean).join(' and ');
    el.innerHTML=`<h4>${m.name}</h4><div class="sub">${m.desc} Fills ${fills}.</div><div class="pas" style="color:var(--cyan)">${B.name} for ${BUFF_TIME/60} minutes: ${B.desc.toLowerCase()}</div>`+
      (P.buff?`<div class="muted">It replaces ${BUFFS[P.buff.id].name.toLowerCase()} (${Math.ceil(P.buff.t/60)} min left).</div>`:'');
    const a=document.createElement('div');a.className='acts';const b=document.createElement('button');b.className='btn small primary';b.textContent=`Eat for ${pr} shards`;
    b.disabled=S.shards<pr;b.onclick=()=>act('eatMeal',[atSmith,k],r=>{renderPanel();});a.appendChild(b);
    if(m.cook){const need=Object.keys(m.cook).map(c=>`${m.cook[c]} ${CROPS[c].plural}`).join(', '),can=Object.keys(m.cook).every(c=>(S.crops[c]||0)>=m.cook[c]);
      const o=document.createElement('button');o.className='btn small';o.textContent=`Cook it from your own ${need}`;o.disabled=!can;
      o.onclick=()=>act('eatMeal',[atSmith,k,true],r=>{renderPanel();});a.appendChild(o);}
    el.appendChild(a);return;}
  if(sel&&sel.from==='pack'&&shop){const have=S.crops.potato||0;
    el.innerHTML=`<h4>Packed ration</h4><div class="sub">${RATION_POTATOES} of your potatoes, cooked and wrapped to take into the tower. A ration fills 40% of your hunger. You have ${have} potato${have===1?'':'es'} and ${S.rations||0} ration${S.rations===1?'':'s'}.</div>`;
    const a=document.createElement('div');a.className='acts';const b=document.createElement('button');b.className='btn small primary';b.textContent=`Pack one (${RATION_POTATOES} potatoes)`;
    b.disabled=have<RATION_POTATOES;b.onclick=()=>act('packRation',[atSmith],r=>{renderPanel();});a.appendChild(b);el.appendChild(a);return;}
  if(sel&&sel.from==='supply'&&shop){const k=sel.k,s=SUPPLIES[k],pr=supplyPrice(k),left=shop[s.key];
    el.innerHTML=`<h4>${s.name}</h4><div class="sub">${s.desc} You carry ${S[s.key]||0}. The trader has ${left} left${left?'':': it comes back when this floor\u2019s boss falls'}.</div>`;
    const a=document.createElement('div');a.className='acts';const b=document.createElement('button');b.className='btn small primary';b.textContent=`Buy for ${pr} shards`;
    b.disabled=S.shards<pr||left<=0;b.onclick=()=>act('buySupply',[atSmith,k],r=>{if(r)sfx('pick');renderPanel();});
    a.appendChild(b);el.appendChild(a);return;}
  if(!it&&shop&&TRADER_SELLS[G.traders[atSmith].sells].meals){el.innerHTML='<p class="muted">Pick a meal. You eat it here, it fills you up, and it leaves you with a buff for 20 minutes.</p>';return;}
  if(!it&&shop){el.innerHTML='<p class="muted">Pick something for sale to see it, or to compare it with what you are wearing. Prices are in shards.</p>';return;}
  if(!it&&atForge()){el.innerHTML='<p class="muted">Pick one of your own pieces to enhance it.</p>';return;}
  if(!it&&atStash()){el.innerHTML='<p class="muted">The same stash waits behind every stash chest: in the inn and in every safe room. Pick something to move it between your bag and the stash, or double-click it.</p>';return;}
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
  if(sel.from==='shop'){const e=shop.stock[sel.i],full=S.inv.length>=BAG_SIZE;
    btn(full?'Bag is full':`Buy for ${e.price} shards`,'primary',()=>act('buy',[atSmith,sel.i],r=>{if(r!==false){sel={from:'bag',i:r};sfx('pick');}renderPanel();}),full||S.shards<e.price);
    el.appendChild(acts);return;}
  if(sel.from==='stash'){btn(S.inv.length>=BAG_SIZE?'Bag is full':'Take it','primary',()=>act('unstash',[sel.i],r=>{if(r!==false){sel={from:'bag',i:r};sfx('pick');}renderPanel();}),S.inv.length>=BAG_SIZE);
    el.appendChild(acts);return;}
  if(sel.from==='bag')btn('Equip','primary',equipSel);
  if(sel.from==='bag'&&atStash())btn(S.stash.length>=STASH_SIZE?'Stash is full':'Put in the stash','',()=>act('stash',[sel.i],r=>{if(r!==false){sel={from:'stash',i:r};sfx('pick');}renderPanel();}),S.stash.length>=STASH_SIZE);
  if(it.slot!=='trinket'&&!atForge()){const n=document.createElement('span');n.className='muted';n.style.alignSelf='center';n.textContent='Enhancing is done at the forge, in the root village.';acts.appendChild(n);}
  if(it.slot!=='trinket'&&atForge()){
    if((it.plus||0)>=ENH_MAX)btn('Fully enhanced','',()=>{},true);
    else{const r=enhanceRecipe(it),can=S.shards>=r.shards&&hasMats(S.mats,r.mats),pct=Math.round(r.chance*100);
      btn(`Enhance to +${r.to}`+(pct<100?` (${pct}%)`:''),'',()=>act('enhance',sel.from==='eq'?['eq',sel.slot]:['bag',sel.i],res=>{
        if(res==='up')sfx('lvl');else if(res==='fail')sfx('lock');save();afterGearChange();}),!can);
      const need=document.createElement('div');need.className='muted';need.style.width='100%';
      need.innerHTML=`Costs ${r.shards} shards and ${matsText(r.mats)}.`+(pct<100?` From +6 an attempt can fail: the level stays, the cost is spent, and each failure adds 10% to the next try.`:'')+
        (it.pity?` <span style="color:var(--cyan)">+${Math.round(it.pity*100)}% from earlier failures.</span>`:'');
      acts.appendChild(need);}}
  if(sel.from==='bag')btn(`Salvage for ${salvageValue(it)} shards, ${matsText(salvageMats(it))}`,'',()=>act('salvage',[sel.i],r=>{sel=null;if(r)sfx('pick');renderPanel();}));
  if(sel.from==='eq'&&it.slot==='trinket')btn('Unequip','',()=>act('unequip',['trinket'],r=>{if(r)sel=null;afterGearChange();}),S.inv.length>=BAG_SIZE);
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
  act('equip',[sel.i],slot=>{if(slot){sel={from:'eq',slot};sfx('pick');}afterGearChange();});
}
function afterGearChange(){calcStats();refreshSprites();refreshHudStatic();renderPanel();}
$('#pClose').onclick=closePanel;
/* ---------- debug menu ----------
   Off for players. Open the game with ?debug in the address (index.html?debug, or localhost:8000/?debug)
   and the ` key and the Debug button in Gear open it. */
const DEBUG=new URLSearchParams(location.search).has('debug');
function openDebug(){
  if(!DEBUG||mode!=='play'||NET.on)return;mode='debug';inp.atk=false;for(const k in keys)keys[k]=false;
  const el=$('#dbgBtns');el.innerHTML='';
  const add=(t,fn,stay)=>{const b=document.createElement('button');b.className='btn small';b.textContent=t;b.onclick=()=>{fn();if(stay)openDebugRefresh();else closeDebug();};el.appendChild(b);};
  const jump=n=>{S.hp=null;S.cp=0;S.cpFloor=0;startFloor(n);};
  for(const n of[1,2,3])add('Play floor '+n,()=>jump(n));
  const lvl=k=>{const c=S.char;c.level+=k;c.pts+=3*k;calcStats();P.hp=ST.maxHp;P.mp=ST.maxMp;};
  add('Level +1 (now '+S.char.level+')',()=>lvl(1),true);add('Level +5',()=>lvl(5),true);
  add('Shards +500 (now '+S.shards+')',()=>{S.shards+=500;},true);
  add('Full heal',()=>{P.hp=ST.maxHp;P.mp=ST.maxMp;P.food=P.drink=100;});
  add('God mode: '+(god?'on':'off'),()=>{god=!god;},true);
  add('Go to the boss gate',()=>{const q=G.gates[1];P.x=q.x-18;P.y=q.y;P.dash=null;});
  add('Go to the next safe room',()=>{const pts=G.points||[];if(!pts.length)return;const i=(Math.max(0,pts.findIndex(q=>hyp(q.x-P.x,q.y-P.y)<60))+1)%pts.length,q=pts[i];P.x=q.x;P.y=q.y+24;P.dash=null;});
  add('Close',()=>{});
  $('#debug').hidden=false;
}
function openDebugRefresh(){mode='play';openDebug();}
function closeDebug(){if(mode!=='debug')return;$('#debug').hidden=true;mode='play';}
$('#pDebug').hidden=!DEBUG;   // and hidden online: see renderPanel
$('#pDebug').onclick=()=>{closePanel();openDebug();};
$('#pMute').onclick=toggleMute;
$('#pQuit').onclick=quitToTitle;
$('#btnBag').addEventListener('click',e=>{e.currentTarget.blur();openPanel();});
holdBtn($('#slAtk'),()=>{inp.atk=true;press('atk');},()=>{inp.atk=false;});
holdBtn($('#slSkill'),()=>press('skill'));holdBtn($('#slBlock'),()=>{inp.block=true;},()=>{inp.block=false;});
$('#askGo').onclick=confirmChamber;$('#askNo').onclick=closeAsk;holdBtn($('#slDodge'),()=>press('dodge'));holdBtn($('#slPot'),()=>press('potion'));holdBtn($('#slFood'),()=>press('eat'));holdBtn($('#slDrink'),()=>press('drink'));
elPrompt.addEventListener('click',e=>{e.currentTarget.blur();interact();});
// Save whenever the page goes away mid-run, whatever menu is open. Hiding the tab during play also pauses the game.
const inRun=()=>!!G&&mode!=='title'&&mode!=='creator';
addEventListener('pagehide',()=>{if(inRun())save();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)return;if(mode==='play')openPause();else if(inRun())save();});

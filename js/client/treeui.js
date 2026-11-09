'use strict';
// Blackspire: the skill board screen (the rules are in js/sim/tree.js). Your class's board as a flowchart: five
// tiers down a spine, each opening when enough points are spent, its nodes on a rail. A node is picked to see it in
// the inspector beside the board; points are placed there (or by clicking a picked node again) and only spent on
// Confirm. Above the inspector, the four skill slots. P opens and closes it, as does the Tree button; it will not open
// in the middle of a fight.

let boardPend={};   // {node id: ranks placed, not yet confirmed}
let selNode=null;   // the node shown in the inspector
let pickSlot=null;  // a skill slot being chosen (Q, E, C, X), shown in the inspector instead
const pendCount=()=>Object.values(boardPend).reduce((a,b)=>a+b,0);
// The confirmed ranks plus whatever placed ranks still fit, in tier order; anything that no longer fits (a tier that
// closed when a point was taken back) is dropped from what is placed.
function boardTidy(){
  const t=Object.assign({},treeOf(S)),keep={};
  for(const id of Object.keys(boardPend).sort((a,b)=>TREE[a].tier-TREE[b].tier))for(let i=0;i<boardPend[id];i++){if(!treeCanRank(S,id,t))break;t[id]=(t[id]||0)+1;keep[id]=(keep[id]||0)+1;}
  boardPend=keep;return t;
}
function openTree(){
  if(mode!=='play')return;
  if(!outOfCombat()){log('There is no time to study your skills in the middle of a fight.');return;}
  mode='tree';inp.atk=false;for(const k in keys)keys[k]=false;boardPend={};selNode=null;pickSlot=null;
  $('#treeView').hidden=false;renderBoard();
}
function closeTree(){
  if(mode!=='tree')return;const n=pendCount();
  if(n)return askPending(n,commitBoard,()=>{boardPend={};},()=>closeTree());
  $('#treeView').hidden=true;mode='play';save();
}
function commitBoard(done){
  const o=boardPend;boardPend={};if(!Object.keys(o).length){if(done)done(true);return;}
  act('boardCommit',[JSON.stringify(o)],r=>{if(r)sfx('lvl');else log('Those points could not be spent: are you still in a fight?');renderBoard();if(done)done(r);});
}

/* ---------- glyphs: one small line drawing per kind of skill or passive ---------- */
const GLYPH={
  sword:'M14.5 3.5H20.5V9.5L9.5 20.5 3.5 14.5Z M3 21l3-3 M5 13l6 6',
  arrow:'M4 20L19 5 M19 5h-6 M19 5v6 M4 20l1.5-5 M4 20l5-1.5',
  flame:'M12 2.5c1 4 6.5 6 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3 2-4.5 2-7.5 2 1.2 3 3.2 3 5.2 1.4-2 1.5-5.5 1.5-9.2z',
  snow:'M12 2.5v19 M3.8 7.2l16.4 9.6 M3.8 16.8l16.4-9.6 M9.4 4.2 12 5.8l2.6-1.6 M9.4 19.8 12 18.2l2.6 1.6',
  bolt:'M13.5 2 5 13.5h6.2L10 22l8.5-12h-6.2z',
  cross:'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6z',
  shield:'M12 2.8l8 3v6.4c0 5-3.6 8.2-8 9.4-4.4-1.2-8-4.4-8-9.4V5.8z',
  burst:'M12 2v5 M12 17v5 M2 12h5 M17 12h5 M4.9 4.9l3.6 3.6 M15.5 15.5l3.6 3.6 M4.9 19.1l3.6-3.6 M15.5 8.5l3.6-3.6 M12 9.2a2.8 2.8 0 1 0 0 5.6a2.8 2.8 0 0 0 0-5.6',
  dash:'M3 12h12 M3 7h7 M3 17h7 M14 5.5 20.5 12 14 18.5',
  drop:'M12 2.8c3.2 4.8 6.5 8 6.5 12a6.5 6.5 0 0 1-13 0c0-4 3.3-7.2 6.5-12z',
  skull:'M12 3a8 8 0 0 0-8 8c0 3 1.8 4.8 3 5.2V20h10v-3.8c1.2-.4 3-2.2 3-5.2a8 8 0 0 0-8-8z M9 11.5h.5 M14.5 11.5h.5 M10.5 20v-2.5 M13.5 20v-2.5',
  heart:'M12 20.5s-8.5-5-8.5-11.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.7c0 6.2-8.5 11.2-8.5 11.2z',
  target:'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15 M12 1.5v6 M12 16.5v6 M1.5 12h6 M16.5 12h6',
  speed:'M4.5 5.5 11 12l-6.5 6.5 M12 5.5 18.5 12 12 18.5',
  eye:'M2 12s3.8-6.8 10-6.8S22 12 22 12s-3.8 6.8-10 6.8S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 0 0 0-6',
  star:'M12 2.2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.4l-6.2 3.7 1.6-7L2 9.4l7.1-.6z',
  leaf:'M4.5 19.5C4.5 10.5 10.5 4.5 20 4.5c0 9.5-6 15-15.5 15z M4.5 19.5l8.5-8.5',
  clock:'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16 M12 7.5V12l3 2',
  horn:'M3.5 9.5h4l8-5v15l-8-5h-4z M18.5 8.5c1.3 1 1.3 6 0 7',
};
// a skill's glyph and colour: its own when it has one, else by its element or kind
const SKILL_GLYPH={guard:'shield',aegis:'shield',riposte:'shield',heal:'cross',partyheal:'cross',massheal:'cross',renewal:'leaf',revive:'star',resurrect:'star',
  smite:'star',cry:'horn',challenge:'horn',berserk:'heart',double:'speed',dance:'speed',viper:'drop',smoke:'eye',vanish:'eye',deathmark:'target',raise:'skull',
  blink:'dash',leap:'dash',ballista:'arrow',vortex:'burst',quake:'burst',icenova:'snow'};
const ELEM_COL={fire:'#f39a52',cold:'#9fd8ff',lightning:'#efe27c',rot:'#9ad86a',physical:'#e2d3b2',heal:'#ffe9a8'};
function skillLook(id){
  const sk=SKILLS[id]||{tags:[]},t=sk.tags||[],el=['fire','cold','lightning','rot'].find(x=>t.includes(x));
  const g=SKILL_GLYPH[id]||(el==='fire'?'flame':el==='cold'?'snow':el==='lightning'?'bolt':el==='rot'?'drop':t.includes('projectile')?'arrow':t.includes('area')?'burst':t.includes('movement')?'dash':'sword');
  const healing=['heal','partyheal','massheal','renewal','revive','resurrect','aegis','smite'].includes(id);
  return{g,c:healing?ELEM_COL.heal:ELEM_COL[el]||ELEM_COL.physical};
}
function passiveLook(q){
  if(q.k==='key')return{g:'star',c:'#f0cf7a'};
  const f=q.fx||{},k=Object.keys(f)[0];
  if(k==='inc'){const t=Object.keys(f.inc)[0];
    return t==='fire'?{g:'flame',c:ELEM_COL.fire}:t==='cold'?{g:'snow',c:ELEM_COL.cold}:t==='lightning'?{g:'bolt',c:ELEM_COL.lightning}:t==='rot'?{g:'drop',c:ELEM_COL.rot}
      :t==='projectile'||t==='bow'?{g:'arrow',c:ELEM_COL.physical}:t==='area'?{g:'burst',c:ELEM_COL.physical}:{g:'sword',c:ELEM_COL.physical};}
  return{hp:{g:'heart',c:'#e57a6e'},hpPct:{g:'heart',c:'#e57a6e'},def:{g:'shield',c:'#b9c4d6'},defPct:{g:'shield',c:'#b9c4d6'},res:{g:'shield',c:'#9fd8ff'},
    crit:{g:'target',c:'#f0cf7a'},critDmg:{g:'target',c:'#e57a6e'},aspd:{g:'speed',c:'#e2d3b2'},move:{g:'dash',c:'#e2d3b2'},evade:{g:'eye',c:'#b9c4d6'},
    cdr:{g:'clock',c:'#cfe4ff'},mana:{g:'drop',c:'#8fa0ff'},mregen:{g:'drop',c:'#8fa0ff'},regen:{g:'leaf',c:'#9ad86a'},heal:{g:'cross',c:ELEM_COL.heal}}[k]||{g:'star',c:'#e2d3b2'};
}
const glyphSvg=(L,size=26)=>`<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${L.c}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${GLYPH[L.g]}"/></svg>`;
const ROMAN=['I','II','III','IV','V'];

/* ---------- the board ---------- */
function renderBoard(){
  const cls=S.char.cls,C=CLASSES[cls],t=boardTidy(),spent=Object.values(t).reduce((a,b)=>a+b,0),left=treeEarned(S)-spent,pend=pendCount();
  $('#treePts').textContent=`${C.name}: ${left} point${left===1?'':'s'} to spend`;
  $('#treeSub').textContent=pend?`${pend} placed, waiting to be confirmed`:`${treeSpent(S)} spent`+(ST.offClass?' · your weapon is not a '+C.name.toLowerCase()+'’s, so it brings no skill':'');
  $('#treeConfirm').hidden=$('#treeDiscard').hidden=!pend;
  const cost=treeResetCost(S),rb=$('#treeReset');rb.disabled=!treeSpent(S)||pend>0||S.shards<cost;rb.textContent=treeSpent(S)?`Reset all (${cost} shards)`:'Reset all';
  const B=$('#board');B.innerHTML='';
  const flow=document.createElement('div');flow.className='flow';
  BOARD_PLAN[cls].forEach((row,tier)=>{
    const open=tierOpen(spent,tier),sec=document.createElement('section');sec.className='ftier'+(open?' open':' shut');
    sec.innerHTML=`<div class="gate"><i><em>${ROMAN[tier]}</em></i><span>${open?(tier?'Open':'Open from the start'):`Opens at ${TIERS[tier]} points · ${TIERS[tier]-spent} more`}</span></div>`;
    const rail=document.createElement('div');rail.className='frow';
    for(const q of boardOf(cls).filter(q=>q.tier===tier).sort((a,b)=>a.col-b.col))rail.appendChild(flowNode(q,t,open));
    sec.appendChild(rail);flow.appendChild(sec);});
  const side=document.createElement('aside');side.className='insp';
  side.appendChild(loadout());side.appendChild(pickSlot?slotPicker():selNode&&TREE[selNode]?inspect(TREE[selNode],t,spent):overview(t,left));
  B.appendChild(flow);B.appendChild(side);
}
function flowNode(q,t,open){
  const have=treeOf(S)[q.id]||0,pk=boardPend[q.id]||0,r=have+pk,can=treeCanRank(S,q.id,t),skill=q.k==='skill';
  const slotted=skill&&SLOTS.find(k=>tidySlots(S.char)[k]===q.now);
  const b=document.createElement('button');b.type='button';
  b.className=`fn ${q.k}`+(r?' some':'')+(r&&r>=q.max&&!skill?' full':'')+(can?' can':'')+(skill&&q.now?' known':'')+(selNode===q.id?' sel':'')+(open||skill?'':' locked');
  const L=skill?skillLook(q.now):passiveLook(q);
  const pips=skill?(slotted?`<span class="tagk">${slotted.toUpperCase()}</span>`:''):`<span class="pips">${Array.from({length:q.max},(_,i)=>`<i class="${i<have?'on':i<r?'pend':''}"></i>`).join('')}</span>`;
  b.innerHTML=`<span class="sock">${glyphSvg(L,skill?30:24)}</span>${pips}<b>${esc(q.name)}</b>`;
  b.title=q.name+(skill?'':` · ${r} / ${q.max}`);
  b.onclick=()=>{
    pickSlot=null;
    if(selNode===q.id&&can){boardPend[q.id]=(boardPend[q.id]||0)+1;sfx('pick');}   // a picked node clicked again: one more rank
    selNode=q.id;renderBoard();};
  return b;
}
// The inspector, for one node: what it does, its ranks and the buttons to place them; for a skill, its forms.
function inspect(q,t,spent){
  const have=treeOf(S)[q.id]||0,pk=boardPend[q.id]||0,can=treeCanRank(S,q.id,t),skill=q.k==='skill',open=tierOpen(spent,q.tier);
  const L=skill?skillLook(q.now):passiveLook(q),sk=skill&&SKILLS[q.now];
  const d=document.createElement('div');d.className='ipane';
  d.innerHTML=`<div class="ihead"><span class="sock big ${q.k}">${glyphSvg(L,34)}</span><div><h3>${esc(q.name)}</h3>
    <small>${skill?(sk&&sk.ult?'Ultimate':'Skill'):q.k==='key'?'Keystone':'Passive'} · tier ${ROMAN[q.tier]}${skill?'':` · ${have+pk} / ${q.max}`}</small></div></div>`;
  if(skill){
    const where=SLOTS.find(k=>tidySlots(S.char)[k]===q.now);
    d.insertAdjacentHTML('beforeend',`<p class="idesc">${esc(sk?sk.desc:'')}</p>${sk?`<p class="istat">${sk.mp} mana · ${sk.cd} s cooldown${where?` · on <kbd>${where.toUpperCase()}</kbd>`:' · not in a slot'}</p>`:''}
      <h4>Forms</h4><p class="muted">Each form opens with its challenge; then choose which one the skill takes.</p>`);
    const active=S.vars[q.id],vl=document.createElement('div');vl.className='vars';
    q.vars.forEach((v,i)=>{const n=progOf(S,q.id,v.ch),done=n>=v.ch.n,e=document.createElement('div');e.className='var'+(done?' open':'')+(active===i?' on':'');
      e.innerHTML=`<b>${esc(v.name)}</b><small>${esc(chDesc(v.ch))}</small><div class="pg"><i style="width:${Math.min(100,n/v.ch.n*100).toFixed(0)}%"></i><span>${Math.min(n,v.ch.n)} / ${v.ch.n}</span></div>`;
      if(done){const b=document.createElement('button');b.className='btn small';b.textContent=active===i?'In use':'Use this form';b.disabled=active===i;
        b.onclick=()=>act('setVar',[q.id,i],()=>renderBoard());e.appendChild(b);}
      vl.appendChild(e);});
    d.appendChild(vl);
    if(!where&&sk){const go=document.createElement('p');go.className='muted';go.textContent=`Put it in a slot above to use it (${sk.ult?'X':'Q, E or C'}).`;d.appendChild(go);}
    return d;
  }
  d.insertAdjacentHTML('beforeend',`<p class="idesc">${esc(treeDesc(q))}</p>
    <div class="ipips">${Array.from({length:q.max},(_,i)=>`<i class="${i<have?'on':i<have+pk?'pend':''}"></i>`).join('')}</div>
    <p class="muted">${!open?`Tier ${ROMAN[q.tier]} opens at ${TIERS[q.tier]} points spent.`:have+pk>=q.max?'Every rank is taken.':treeLeft(S)-pendCount()<=0?'No points left: you earn one a level, and one for each floor’s boss.':'Click it again on the board, or here, to place a point.'}</p>`);
  const bar=document.createElement('div');bar.className='nb';
  if(pk){const m=document.createElement('button');m.className='btn small';m.textContent='− Take back';
    m.onclick=()=>{boardPend[q.id]--;if(!boardPend[q.id])delete boardPend[q.id];renderBoard();};bar.appendChild(m);}
  const plus=document.createElement('button');plus.className='btn small primary';plus.textContent='+ Place a point';plus.disabled=!can;
  plus.onclick=()=>{boardPend[q.id]=(boardPend[q.id]||0)+1;sfx('pick');renderBoard();};bar.appendChild(plus);
  d.appendChild(bar);return d;
}
// With nothing picked: how the board works, and what it adds up to so far.
function overview(t,left){
  const d=document.createElement('div');d.className='ipane';
  const got=boardOf(S.char.cls).filter(q=>q.k!=='skill'&&t[q.id]>0);
  d.innerHTML=`<h3>The ${esc(CLASSES[S.char.cls].name)}’s board</h3>
    <p class="idesc">Pick a node to see it. Points come one a level and one for each floor’s boss; each tier down the spine opens once enough are spent above it. Skills are yours from the start; their forms open with challenges.</p>
    <h4>So far</h4>${got.length?`<ul class="isum">${got.map(q=>`<li><span>${glyphSvg(passiveLook(q),16)}</span><b>${esc(q.name)}</b> ${t[q.id]} / ${q.max}<small>${esc(treeDesc(q))}</small></li>`).join('')}</ul>`:`<p class="muted">No points spent yet${left>0?`: ${left} to spend.`:'.'}</p>`}`;
  return d;
}
// The four skill slots: click one, then choose from the class's pool (everyday skills for Q, E and C, ultimates for X).
// Like the board, only out of combat.
function loadout(){
  const L=document.createElement('div');L.className='loadout';
  L.innerHTML=`<h4>Skills <small>click a slot to change it</small></h4>`;
  const row=document.createElement('div'),slots=tidySlots(S.char);row.className='lslots';
  for(const k of SLOTS){const id=slots[k],sk=SKILLS[id],d=document.createElement('button');d.type='button';d.className='lslot'+(k==='x'?' ult':'')+(pickSlot===k?' on':'');
    d.innerHTML=`<span class="sock">${sk?glyphSvg(skillLook(id),26):''}</span><kbd>${k.toUpperCase()}</kbd><b>${sk?esc(sk.name):'Empty'}</b>`;
    d.title=sk?`${sk.name}: ${sk.mp} mana, ${sk.cd} s`:'Empty';
    d.onclick=()=>{pickSlot=pickSlot===k?null:k;renderBoard();};row.appendChild(d);}
  L.appendChild(row);return L;
}
function slotPicker(){
  const slots=tidySlots(S.char),list=document.createElement('div');list.className='ipane lpick';
  list.innerHTML=`<h3>${pickSlot==='x'?'Your ultimate':'Skill on '+pickSlot.toUpperCase()}</h3>`;
  for(const id of kitOf(S.char.cls,pickSlot)){const sk=SKILLS[id],where=SLOTS.find(k=>slots[k]===id),e=document.createElement('div');
    e.className='lsk'+(where===pickSlot?' on':'');
    e.innerHTML=`<span class="sock">${glyphSvg(skillLook(id),24)}</span><div><b>${esc(sk.name)}</b><small>${sk.mp} mana · ${sk.cd} s${where&&where!==pickSlot?' · now on '+where.toUpperCase():''}</small><p>${esc(sk.desc)}</p></div>`;
    if(where!==pickSlot){e.classList.add('pickable');e.tabIndex=0;
      const put=()=>act('setSlot',[pickSlot,id],r=>{if(!r)log('Skills can only be changed out of combat.');else{pickSlot=null;calcStats();refreshHudStatic();sfx('pick');}renderBoard();});
      e.onclick=put;e.onkeydown=ev=>{if(ev.key==='Enter')put();};}
    list.appendChild(e);}
  const back=document.createElement('button');back.className='btn small';back.textContent='Back';back.onclick=()=>{pickSlot=null;renderBoard();};list.appendChild(back);
  return list;
}
(()=>{
  $('#treeClose').onclick=closeTree;
  $('#treeConfirm').onclick=()=>commitBoard();
  $('#treeDiscard').onclick=()=>{boardPend={};renderBoard();};
  $('#treeReset').onclick=()=>{const cost=treeResetCost(S);act('treeReset',[],r=>{log(r?`Every point is back, for ${cost} shards.`:'No reset now: it needs the shards, and a moment out of the fight.');renderBoard();});};
  $('#btnTree').addEventListener('click',e=>{e.currentTarget.blur();openTree();});
})();

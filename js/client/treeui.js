'use strict';
// Blackspire: the skill board screen (the rules are in js/sim/tree.js). One board, your class's, in tiers. Points are
// placed first (a click on a node, − to take one back) and only spent on Confirm. P opens and closes it, as does the
// Tree button; it will not open in the middle of a fight.

let boardPend={};   // {node id: ranks placed, not yet confirmed}
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
  mode='tree';inp.atk=false;for(const k in keys)keys[k]=false;boardPend={};
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
function renderBoard(){
  const cls=S.char.cls,C=CLASSES[cls],t=boardTidy(),spent=Object.values(t).reduce((a,b)=>a+b,0),left=treeEarned(S)-spent,pend=pendCount();
  $('#treePts').textContent=`${C.name}: ${left} point${left===1?'':'s'} to spend`;
  $('#treeSub').textContent=pend?`${pend} placed, waiting to be confirmed`:`${treeSpent(S)} spent`+(ST.offClass?' · your weapon is not a '+C.name.toLowerCase()+'’s, so it brings no skill':'');
  $('#treeConfirm').hidden=$('#treeDiscard').hidden=!pend;
  const cost=treeResetCost(S),rb=$('#treeReset');rb.disabled=!treeSpent(S)||pend>0||S.shards<cost;rb.textContent=treeSpent(S)?`Reset all (${cost} shards)`:'Reset all';
  const B=$('#board');B.innerHTML='';
  BOARD_PLAN[cls].forEach((row,tier)=>{
    const open=tierOpen(spent,tier),r=document.createElement('div');r.className='tier'+(open?'':' shut');
    r.innerHTML=`<div class="tierHead"><b>${tier?'Tier '+(tier+1):'Tier 1'}</b><small>${open?(tier?'open':'open from the start'):`opens at ${TIERS[tier]} points spent (${TIERS[tier]-spent} more)`}</small></div>`;
    const cells=document.createElement('div');cells.className='cells';
    for(const q of boardOf(cls).filter(q=>q.tier===tier).sort((a,b)=>a.col-b.col))cells.appendChild(q.k==='skill'?skillCard(q):nodeCard(q,t));
    r.appendChild(cells);B.appendChild(r);});
}
function nodeCard(q,t){
  const have=treeOf(S)[q.id]||0,pk=boardPend[q.id]||0,can=treeCanRank(S,q.id,t),d=document.createElement('div');
  d.className='node '+q.k+(have+pk?' some':'')+(can?' can':'');
  d.innerHTML=`<b>${esc(q.name)}</b><span class="rk">${have+pk} / ${q.max}${pk?` <em>(+${pk})</em>`:''}</span><p>${esc(treeDesc(q))}</p>`;
  const plus=document.createElement('button');plus.className='btn small';plus.textContent='+';plus.disabled=!can;plus.setAttribute('aria-label','Place a point in '+q.name);
  plus.onclick=()=>{boardPend[q.id]=(boardPend[q.id]||0)+1;renderBoard();};
  const bar=document.createElement('div');bar.className='nb';
  if(pk){const m=document.createElement('button');m.className='btn small';m.textContent='−';m.setAttribute('aria-label','Take a placed point back from '+q.name);
    m.onclick=()=>{boardPend[q.id]--;if(!boardPend[q.id])delete boardPend[q.id];renderBoard();};bar.appendChild(m);}
  bar.appendChild(plus);d.appendChild(bar);return d;
}
function skillCard(q){
  const d=document.createElement('div');d.className='node skill'+(q.now?' known':'')+(q.soon?' soon':'');
  const active=S.vars[q.id];
  d.innerHTML=`<b>${esc(q.name)}</b><span class="rk">${q.now?'Known':'Coming with the new combat'}</span><p>${esc(treeDesc(q))}</p>`;
  const vl=document.createElement('div');vl.className='vars';
  q.vars.forEach((v,i)=>{const have=progOf(S,q.id,v.ch),open=have>=v.ch.n,e=document.createElement('div');e.className='var'+(open?' open':'')+(active===i?' on':'');
    e.innerHTML=`<b>${esc(v.name)}</b><small>${esc(chDesc(v.ch))}</small><div class="pg"><i style="width:${Math.min(100,have/v.ch.n*100).toFixed(0)}%"></i><span>${Math.min(have,v.ch.n)} / ${v.ch.n}</span></div>`;
    if(open){const b=document.createElement('button');b.className='btn small';b.textContent=active===i?'In use':'Use this form';b.disabled=active===i;
      b.onclick=()=>act('setVar',[q.id,i],()=>renderBoard());e.appendChild(b);}
    vl.appendChild(e);});
  d.appendChild(vl);return d;
}
(()=>{
  $('#treeClose').onclick=closeTree;
  $('#treeConfirm').onclick=()=>commitBoard();
  $('#treeDiscard').onclick=()=>{boardPend={};renderBoard();};
  $('#treeReset').onclick=()=>{const cost=treeResetCost(S);act('treeReset',[],r=>{log(r?`Every point is back, for ${cost} shards.`:'No reset now: it needs the shards, and a moment out of the fight.');renderBoard();});};
  $('#btnTree').addEventListener('click',e=>{e.currentTarget.blur();openTree();});
})();

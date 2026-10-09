'use strict';
// Blackspire: the Adventurers' Guild's quests (docs/design/root-village.md). Each region has one board a day, the same
// for every player: it is built from the day's number, so no server has to hand it out. Quests are taken and handed in
// at the guild. The board refreshes at midnight UTC; whatever you had taken is gone then, finished or not.

const QUEST_MAX=3;                 // quests one player can have taken at once
const QUEST_DAY=86400000;          // ms: the board refreshes once a day
const questDay=(now=Date.now())=>Math.floor(now/QUEST_DAY);
const questRefreshIn=(now=Date.now())=>QUEST_DAY-now%QUEST_DAY;   // ms until the next board

// The root village's board for a day: three hunts, two deliveries and a boss, from floors 1 to the highest that exists.
// kind: 'hunt' (kill n of type), 'deliver' (bring n of a material), 'boss' (beat floor f's boss).
function questBoard(day){
  const rng=mulberry32((Math.imul(day,2654435761)^0x9e3779b9)>>>0),pick=a=>a[Math.floor(rng()*a.length)],ri=(a,b)=>a+Math.floor(rng()*(b-a+1));
  const top=FLOORS.length,out=[],used=new Set(),mult=f=>1+.25*(f-1);
  for(let i=0;i<3;i++){
    let f,type;for(let t=0;t<20;t++){f=ri(1,top);type=pick(FLOORS[f-1].spawns);if(!used.has(type))break;}
    used.add(type);const E=ETYPES[type],n=ri(6,12);
    out.push({kind:'hunt',type,f,n,title:`Hunt: ${E.name}`,desc:`Kill ${n} ${E.name.toLowerCase()}${n>1&&!/s$/.test(E.name)?'s':''}. They are found on floor ${f}.`,
      reward:{shards:Math.round(n*4*mult(f)),xp:Math.round(n*E.xp*1.5*mult(f))}});
  }
  const DELIVER={scrap:[6,12,5],ember:[2,4,22],crystal:[1,2,70]};   // how many to ask for, and what one is worth in shards
  const first=pick(['scrap','scrap','ember']),second=pick(['ember','crystal'].filter(m=>m!==first));
  for(const mat of[first,second]){const[lo,hi,per]=DELIVER[mat],n=ri(lo,hi);
    out.push({kind:'deliver',mat,n,title:`Delivery: ${MATS[mat].name}`,desc:`Bring ${n} ${MATS[mat].name} to the guild. The smiths are running short.`,
      reward:{shards:Math.round(n*per*1.3),xp:n*per}});}
  const f=ri(1,top),B=FLOORS[f-1].boss;
  out.push({kind:'boss',f,n:1,title:`Bounty: ${B.name}`,desc:`Defeat ${B.name}, the boss of floor ${f}.`,reward:{shards:Math.round(150*mult(f)),xp:Math.round(120*mult(f)),mats:{crystal:1}}});
  return out.map((q,i)=>Object.assign(q,{id:day+'-'+i}));
}
// The current player's quest record for today: {day, active:{id: progress}, done:[ids handed in]}. A new day wipes it.
function questLog(){
  const day=questDay();
  if(!S.quests||S.quests.day!==day)S.quests={day,active:{},done:[]};
  return S.quests;
}
const questById=id=>questBoard(questDay()).find(q=>q.id===id)||null;
// How far along a taken quest is: [have, need]. Deliveries count what is in your materials.
function questProgress(q){const L=questLog();return[q.kind==='deliver'?Math.min(q.n,S.mats[q.mat]||0):Math.min(q.n,L.active[q.id]||0),q.n];}
const questReady=q=>{const[h,n]=questProgress(q);return h>=n;};
// The guild clerk (in the village) and the notice board in the square.
const nearGuild=(r=24)=>!!G.guild&&hyp(G.guild.x-P.x,G.guild.y-P.y)<r;
const nearBoard=(r=24)=>!!G.board&&hyp(G.board.x-P.x,G.board.y-P.y)<r;
// Called for every player credited with a kill (killEnemy).
function questKill(e){
  const L=questLog();
  for(const id in L.active){const q=questById(id);if(!q||q.kind==='deliver')continue;
    const hit=q.kind==='hunt'?e.type===q.type:e.boss&&G.n===q.f;if(!hit||L.active[id]>=q.n)continue;
    L.active[id]++;
    log(L.active[id]>=q.n?`<span style="color:var(--cyan)">${q.title}: done. Hand it in at the Adventurers’ Guild.</span>`:`${q.title}: ${L.active[id]} / ${q.n}`);}
}

#!/usr/bin/env node
'use strict';
// Blackspire: the balance runner (docs/design/skills.md). Plays every build through the same scenes, with the game's
// own rules run headless as the server runs them, and writes docs/balance.md.
//
//   npm run balance            write docs/balance.md
//   npm run balance -- --check exit 1 if docs/balance.md is out of date, or a budgeted build is 35% off (npm test)
//
// A build is a start in the skill tree (a weapon) at a level fit for the floor: its attribute points in its main
// attribute and vitality, a common weapon of the floor, nothing from the tree yet. The scenes, on floors 1 to 3:
//   dummy  one target that never fights back, 10 seconds: damage per second, skill included when it does damage
//   room   six of the floor's own enemies around you: seconds to clear (60 at most), health lost, falls
//   boss   the floor's boss alone, 5 minutes at most: seconds to kill, health lost, falls
// Everything is seeded, so the same rules give the same table. A build that falls is stood up again where it fell,
// and the fall is counted, so every scene runs to its end.
// Budgets: until the new combat sets the reference damage R per floor, each build is held against the median of the
// builds on that floor. The runner marks anything 20% off; the 35% failure applies only to builds given a budget in
// BUDGET below (none yet), so today's differences are reported, not failed.

const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {loadRules}=require('../server/game');
const ROOT=path.join(__dirname,'..'),OUT=path.join(ROOT,'docs','balance.md');
const BUILDS=[['sword','sword','str'],['spear','spear','str'],['great','great','str'],['mace','mace','str'],['dagger','dagger','agi'],
  ['bow','bow','dex'],['grimoire','grimoire:magic','int'],['faith','grimoire:faith','fai']];
const FLOORS=[1,2,3],LEVEL=n=>2+4*n,BUDGET={},STEP=1/30;

function scene(floor,start,wkey,attr,kind){
  const R=loadRules(),run=code=>vm.runInContext(code,R);
  run(`Math.random=mulberry32(${floor*7919+kind.length*31+start.length});EID=0;`);   // the same dice every run
  return run(`(()=>{
    const s=newState('B',{},'${wkey}','#222');s.char.level=${LEVEL(floor)};s.char.${attr}=${Math.round((LEVEL(floor)-1)*3*.7)};s.char.vit=${Math.round((LEVEL(floor)-1)*3*.3)};
    s.equip.weapon=makeWeapon('${wkey.split(':')[0]}',${floor},0,${wkey.includes(':')?`'${wkey.split(':')[1]}'`:'undefined'});
    setWorld(genFloor(${floor},4242));const pl=makePlayer(1,s);G.players=[pl];setPlayer(pl);calcStats();P.hp=ST.maxHp;P.mp=ST.maxMp;
    god=false;let lost=0,falls=0,dealt=0,t=0,casts=0;
    const room=G.rooms.filter(r=>r.kind==='room').sort((a,b)=>b.w*b.h-a.w*a.h)[0];
    let foes=[];
    if('${kind}'==='boss'){const b=G.bossEnt;G.enemies=[b];foes=[b];enterChamber(G.gates[1]);}   // in through the west gate, as a player comes
    else{P.x=(room.x+room.w/2)*TILE;P.y=(room.y+room.h/2)*TILE;G.enemies=[];
      if('${kind}'==='dummy'){const e=makeEnemy('dummy',P.x+12,P.y,1,1,false);e.hp=e.maxHp=1e9;G.enemies=[e];foes=[e];}
      else{const bag=floorDef(G.n).spawns.filter(k=>!ETYPES[k].rooted);for(let i=0;i<6;i++){const a=i/6*TAU;
        const e=makeEnemy(bag[i%bag.length],P.x+Math.cos(a)*56,P.y+Math.sin(a)*40,G.hpM,G.dmgM,false);e.state='chase';G.enemies.push(e);foes.push(e);}}}
    const limit='${kind}'==='dummy'?10:'${kind}'==='room'?60:300;
    while(t<limit){
      const live=foes.filter(e=>!e.dead);if(!live.length)break;
      let tg=live[0],bd=1e9;for(const e of live){const d=hyp(e.x-P.x,e.y-P.y);if(d<bd){bd=d;tg=e;}}
      const a=Math.atan2(tg.y-P.y,tg.x-P.x),reach=ST.ranged||ST.magic?ST.range*.6:ST.range*.8;
      const mx=bd>reach?Math.cos(a):0,my=bd>reach?Math.sin(a):0;
      P.dir=dirOf(a);P.in={mx,my,atk:true,block:false};
      const hp=P.hp,before=foes.reduce((n,e)=>n+Math.max(0,e.hp),0);   // before the skill, so its damage counts
      if(P.skillCd<=0&&P.mp>=SKILLS[ST.skill].mp&&SKILLS[ST.skill].tags.some(x=>DTYPES[x])&&!P.swing){P.aim=DIR_ANGLE[P.dir];useSkill();casts++;}
      if(P.hp<ST.maxHp*.35&&P.potCd<=0&&S.potions>0)usePotion();
      simUpdate(${STEP});t+=${STEP};
      dealt+=before-foes.reduce((n,e)=>n+Math.max(0,e.hp),0);lost+=Math.max(0,hp-P.hp);
      if(P.dead){falls++;P.dead=false;P.hp=ST.maxHp;P.inv=1;}
      P.food=P.drink=100;
    }
    const left=foes.filter(e=>!e.dead).length;
    return{t:Math.round(t*10)/10,cleared:!left,dps:Math.round(dealt/Math.max(t,1e-9)),lost:Math.round(lost),hp:ST.maxHp,falls,casts};
  })()`);
}

function rows(){
  const out={};
  for(const n of FLOORS){out[n]={};for(const[start,wkey,attr]of BUILDS)out[n][start]={dummy:scene(n,start,wkey,attr,'dummy'),room:scene(n,start,wkey,attr,'room'),boss:scene(n,start,wkey,attr,'boss')};}
  return out;
}
const median=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
function report(R){
  const names={sword:'Longsword',spear:'Spear',great:'Greatsword',mace:'Mace',dagger:'Dagger',bow:'Bow',grimoire:'Grimoire (magic)',faith:'Grimoire (faith)'};
  let md=`# Balance\n\nGenerated by \`npm run balance\` (tools/balance.js) from the game's own rules: do not edit. What the scenes are,
and how builds are made, is at the top of tools/balance.js; why, in [the skills design](design/skills.md#the-balance-runner).\n
Until the new combat sets a reference damage per floor, each build's damage is held against the **median of the builds on
that floor**. ⚠ marks a build more than 20% from it. Health lost is in the build's own health bars (2.0 = twice its
health), and falls count how often it died and was stood up again.\n`;
  const flags=[];
  for(const n of FLOORS){
    const m=median(Object.values(R[n]).map(r=>r.dummy.dps));
    md+=`\n## Floor ${n} (level ${LEVEL(n)})\n\n| Build | Dummy dps | vs median | Room: clear | Room: health lost | Boss: kill | Boss: health lost | Falls (room, boss) |\n|---|---|---|---|---|---|---|---|\n`;
    for(const[start]of BUILDS){const r=R[n][start],off=(r.dummy.dps-m)/m,warn=Math.abs(off)>.2;
      if(warn)flags.push(`floor ${n}, ${names[start]}: ${off>0?'+':''}${Math.round(off*100)}%`);
      const b=BUDGET[start];if(b&&Math.abs(r.dummy.dps-b[n])/b[n]>.35)flags.push('FAIL '+names[start]);
      md+=`| ${names[start]} | ${r.dummy.dps} | ${warn?'⚠ ':''}${off>=0?'+':''}${Math.round(off*100)}% | ${r.room.cleared?r.room.t+' s':'not cleared'} | ${(r.room.lost/r.room.hp).toFixed(1)} | ${r.boss.cleared?r.boss.t+' s':'not killed in 5 min'} | ${(r.boss.lost/r.boss.hp).toFixed(1)} | ${r.room.falls}, ${r.boss.falls} |\n`;}
  }
  md+=`\n## Marked\n\n${flags.length?flags.map(f=>'- '+f).join('\n'):'Nothing is more than 20% from its floor\'s median.'}\n`;
  return{md,fail:flags.some(f=>f.startsWith('FAIL'))};
}
module.exports={scene,rows,report,OUT};
if(require.main===module){
  const t0=Date.now(),{md,fail}=report(rows());
  if(process.argv.includes('--check')){
    const old=fs.existsSync(OUT)?fs.readFileSync(OUT,'utf8'):'';
    if(old!==md){console.error('docs/balance.md is out of date: run npm run balance');process.exit(1);}
    if(fail){console.error('a build is more than 35% from its budget');process.exit(1);}
    console.log('balance ok');
  }else{fs.writeFileSync(OUT,md);console.log(`docs/balance.md written in ${((Date.now()-t0)/1000).toFixed(1)} s`);}
}

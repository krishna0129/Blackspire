'use strict';
// Blackspire: Save store, character state and derived stats.

/* ---------- save store ----------
   Local save now; set SYNC_URL (same-origin endpoint on your own server)
   and every autosave is also POSTed there as JSON. */
const ATTRS=['str','agi','dex','vit','int','fai','mnd','spr'];
const Store={
  KEY:'blackspire.save.v1',
  SYNC_URL:null,
  lastSync:0,
  load(){try{const r=localStorage.getItem(this.KEY);if(!r)return null;const s=JSON.parse(r);if(!(s&&s.v===1&&s.char&&s.equip&&s.equip.weapon))return null;
    for(const k of ATTRS)if(typeof s.char[k]!=='number')s.char[k]=0;   // saves from before the newer attributes
    // axes were retired: any that exist become greatswords, which took over the axe's skill
    const fix=it=>{if(it&&it.slot==='weapon'&&it.type==='axe'){it.type='great';it.base.dmg=+(it.base.dmg*1.3).toFixed(1);it.name=it.name.replace(/battle axe/i,'greatsword');}
      // rapiers were retired when the tank took their place: any that exist become maces
      if(it&&it.slot==='weapon'&&it.type==='rapier'){it.type='mace';it.base.dmg=+(it.base.dmg*2).toFixed(1);it.name=it.name.replace(/rapier/i,'mace');}};
    fix(s.equip.weapon);if(Array.isArray(s.inv))s.inv.forEach(fix);
    migrateFloors(s);
    s.mats=Object.assign({scrap:0,ember:0,crystal:0},s.mats);
    return s;}catch(e){return null;}},
  save(s){
    s.t=Date.now();let ok=true;
    try{localStorage.setItem(this.KEY,JSON.stringify(s));}catch(e){ok=false;}
    if(this.SYNC_URL&&Date.now()-this.lastSync>15000){this.lastSync=Date.now();
      try{fetch(this.SYNC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(s),keepalive:true}).catch(()=>{});}catch(e){}}
    return ok;
  },
  clear(){try{localStorage.removeItem(this.KEY);}catch(e){}}
};

/* ---------- state ---------- */
let S=null;   // persistent character state (what gets saved)
let ST=null;  // derived combat stats
let G=null;   // current floor runtime
let P=null;   // player runtime
let mode='title'; // title | creator | play | panel | ask | debug | pause | travel | dead
let AV=null, WSPR=null; // the character's outlined sprite sheet, and the equipped weapon's sprite
let muted=false, saveOk=true;

function newState(name,look,wkey,tint){
  const[wt,school]=wkey.split(':');
  return{v:1,seed:(Math.random()*2147483647)|0,
    char:{name,look,custom:null,level:1,xp:0,str:0,agi:0,dex:0,vit:0,int:0,fai:0,mnd:0,spr:0,pts:0},
    equip:{weapon:makeWeapon(wt,1,0,school),armor:makeArmor('tunic',1,0,tint),boots:makeBoots('boots',1,0),trinket:null},
    inv:[],shards:0,mats:{scrap:0,ember:0,crystal:0},potions:3,floor:1,best:1,kills:0,deaths:0,hp:null,
    floors:{}};
}
// What the save remembers about each floor, by floor number: which chests are opened, what each blacksmith sells,
// and how many times its boss has fallen. S.best is the highest floor unlocked (beating a boss unlocks the next).
const floorState=n=>S.floors[n]||(S.floors[n]={chests:[],shops:[],boss:0});
// Saves from before per-floor state kept one floor's chests and shops, and the last cleared floor as a number.
function migrateFloors(s){
  if(s.floors)return;s.floors={};
  const fl=n=>s.floors[n]||(s.floors[n]={chests:[],shops:[],boss:0});
  if(s.chestFloor&&Array.isArray(s.chestsOpen))fl(s.chestFloor).chests=s.chestsOpen;
  if(s.shops&&Array.isArray(s.shops.list))fl(s.shops.floor).shops=s.shops.list;
  s.best=Math.max(s.best||1,s.floor||1,(s.cleared||0)+1);
  for(let n=1;n<s.best;n++)fl(n).boss=1;   // every floor below the highest one reached was beaten to get there
  delete s.chestFloor;delete s.chestsOpen;delete s.shops;delete s.cleared;
}
const xpNeed=l=>Math.round(36+22*Math.pow(l,1.55));

// Derived stats for a character wearing `e`. Pure: it changes nothing, so it can also answer "what if I wore this?".
function computeStats(c,e){
  const w=e.weapon,WT=WTYPES[w.type];
  // strength: melee. dexterity: bows, crit, evade. agility: move + attack speed. vitality: health.
  // intelligence: mage damage. faith: healing and healer damage. mind: max mana. spirit: mana regen.
  const st={maxHp:100+c.vit*14+(c.level-1)*6,def:WT.def||0,movePct:c.agi*.6,crit:5+c.dex*.5+(WT.crit||0),critDmg:175,regen:.4+c.vit*.06,p:{},g:{}};
  for(const a of w.aff)st.p[a.id]=(st.p[a.id]||0)+a.v;
  st.magic=!!WT.magic;st.ranged=!!WT.ranged;st.int=c.int+(st.p.int||0);st.fai=c.fai+(st.p.fai||0);
  const scale=st.magic?(w.school==='faith'?1+st.fai*.04:(1+st.int*.04)*(1+(st.p.mdmg||0)/100)):st.ranged?1+c.dex*.03:1+c.str*.04;
  st.dmg=w.base.dmg*itemMult(w)*scale;
  st.healPow=(1+st.fai*.05)*(1+(st.p.heal||0)/100);
  st.aspd=WT.aspd*(1+c.agi*.012);
  st.shield=WT.shield||null;
  st.range=WT.range;st.arc=WT.arc;st.kb=WT.kb;st.skill=skillOf(w);st.thrust=!st.magic&&!st.ranged&&WT.arc<50;
  for(const k of['armor','boots','trinket']){const it=e[k];if(!it)continue;const m=itemMult(it);
    st.def+=(it.base.def||0)*m;st.maxHp+=(it.base.hp||0)*m;st.movePct+=it.base.move||0;
    for(const a of it.aff)st.g[a.id]=(st.g[a.id]||0)+a.v;}
  st.maxHp+=st.g.hp||0;st.def+=st.g.def||0;st.movePct+=st.g.move||0;
  st.crit+=(st.g.crit||0)+(st.p.keen||0);st.critDmg+=st.p.brutal||0;st.regen+=st.g.regen||0;
  st.evade=Math.min(30,c.dex*.6);
  st.maxMp=Math.round(50+c.mnd*10+(st.g.mana||0));st.mpRegen=(1.5+c.spr*.25)*(1+(st.g.mregen||0)/100);
  if(st.p.reach){st.range*=1+st.p.reach/100;st.arc=Math.min(360,st.arc*(1+st.p.reach/100));}
  st.cdr=Math.min(60,(st.p.focus||0)+(st.g.cdr||0));
  st.move=64*(1+st.movePct/100);
  st.maxHp=Math.round(st.maxHp);st.def=Math.round(st.def);
  return st;
}
function calcStats(){ST=computeStats(S.char,S.equip);if(P){P.hp=Math.min(P.hp,ST.maxHp);P.mp=Math.min(P.mp,ST.maxMp);}}
const healAmount=()=>Math.round((24+ST.maxHp*.1)*ST.healPow);

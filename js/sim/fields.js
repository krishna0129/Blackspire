'use strict';
// Blackspire: the fields by the village (docs/design/root-village.md). Each player buys plots of their own and plants
// them; crops grow in real time, offline too, so a planted plot is something to come home to. Every player sees only
// their own plots: the same six spots, each player's own state (S.plots). Each village grows one or two crops.

// seed: shards to plant one plot; price: what the food and drink stall pays for one; grow: ms from planting to
// harvest; yield: [min, max] picked.
const CROPS={
  potato:{name:'Potato',plural:'potatoes',seed:10,price:4,grow:60*60*1000,yield:[4,6],color:'#c9a46a',
    desc:'Ready in an hour. The innkeeper cooks them into stew, and packs them as rations for the tower.'},
  glowcap:{name:'Glowcap',plural:'glowcaps',seed:20,price:15,grow:3*60*60*1000,yield:[2,3],color:'#9be08a',
    desc:'A mushroom that grows on the tree’s roots. Ready in three hours. Brewed into glowcap tea.'},
};
const plotPrice=owned=>100*2**owned;   // each plot you buy costs twice the last: 100, 200, 400 shards...
const RATION_POTATOES=2;               // a packed ration at the inn
// The plot you are standing on, by its index in VILLAGE.plots (3 x 2 tiles each), or -1.
function plotAt(x=P.x,y=P.y){if(!G.village)return -1;
  return VILLAGE.plots.findIndex(([px,py])=>x>=vx(px)-6&&x<vx(px+3)+6&&y>=vy(py)-6&&y<vy(py+2)+6);}
const myPlot=i=>(S.plots||[]).find(p=>p.i===i)||null;
const cropReady=(p,now=Date.now())=>!!p&&!!p.crop&&now-p.t>=CROPS[p.crop].grow;
// how far a planted plot has grown, 0 to 1
const cropGrowth=(p,now=Date.now())=>p&&p.crop?Math.min(1,(now-p.t)/CROPS[p.crop].grow):0;

// Help on the field. The farmhand brings in ripe crops and replants the same crop (paying the seed from your shards)
// for a daily wage per plot, paid at the start of each 24 hours; if you can't pay, they leave. The crop broker sells
// every harvest (the farmhand's or your own) for you and keeps a cut. Doing it all yourself pays more: harvest by hand
// and sell at the food and drink stall at the full price. Both are switched on and off at your plots.
const FARMHAND_WAGE=40;        // shards per plot you own, per day
const BROKER_CUT=.25;          // the broker's share of what they sell
const FARM_DAY=QUEST_DAY;
const farmLog=()=>S.farm||(S.farm={farmer:false,paid:0,broker:false});
const cropValue=(crop,n)=>n*CROPS[crop].price;
// A harvest, by hand or by the farmhand: into your crops, or sold by the broker. Returns the shards it made.
function takeHarvest(crop,n){
  if(farmLog().broker){const v=Math.floor(cropValue(crop,n)*(1-BROKER_CUT));S.shards+=v;return v;}
  S.crops[crop]=(S.crops[crop]||0)+n;return 0;
}
// Brings the field up to now: wages, and every harvest the farmhand made since. Runs a few times a minute while you
// play (and catches up on everything when you come back), on the server online.
function farmWork(now=Date.now()){
  const F=farmLog();if(!F.farmer)return;
  let wages=0,crops={},sold=0;
  while(F.paid<=now){const w=FARMHAND_WAGE*S.plots.length;
    if(S.shards<w){F.farmer=false;log('<span style="color:var(--red)">Your farmhand has left: there were not enough shards for their wage.</span>');break;}
    S.shards-=w;wages+=w;F.paid+=FARM_DAY;}
  const until=Math.min(now,F.paid);
  for(const p of S.plots){
    for(let k=0;k<2000&&p.crop&&p.t+CROPS[p.crop].grow<=until;k++){const C=CROPS[p.crop],n=Math.round(rand(C.yield[0],C.yield[1]));
      crops[p.crop]=(crops[p.crop]||0)+n;sold+=takeHarvest(p.crop,n);
      if(S.shards>=C.seed){S.shards-=C.seed;p.t+=C.grow;}else{p.crop=null;p.t=0;}}   // replanted, or left empty when the seed can't be paid
  }
  const got=Object.keys(crops).map(c=>`${crops[c]} ${CROPS[c].plural}`).join(' and ');
  if(got)log(`Your farmhand brought in ${got}`+(sold?`; the broker sold them for ${sold} shards.`:'.'));
}

'use strict';
// Blackspire: the fields by the village (docs/design/root-village.md). Each player buys plots of their own and plants
// them; crops grow in real time, offline too, so a planted plot is something to come home to. Every player sees only
// their own plots: the same six spots, each player's own state (S.plots). Each village grows one or two crops.

// grow: ms from planting to harvest; yield: [min, max] picked.
const CROPS={
  potato:{name:'Potato',plural:'potatoes',seed:10,grow:60*60*1000,yield:[4,6],color:'#c9a46a',
    desc:'Ready in an hour. The innkeeper cooks them into stew, and packs them as rations for the tower.'},
  glowcap:{name:'Glowcap',plural:'glowcaps',seed:20,grow:3*60*60*1000,yield:[2,3],color:'#9be08a',
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

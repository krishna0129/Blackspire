'use strict';
// Blackspire: the root village, floor 0 (docs/design/root-village.md). A hand-laid map on the same 120 x 80 grid as
// the floors, with no enemies and no fighting: all of it is a safe zone, and hunger and thirst don't drain here.
// The ground is painted by paintVillage (js/client/paint.js); buildings, trees and people are props, drawn y-sorted.

const VOX=32,VOY=21,VW=56,VH=38;   // where the village sits on the grid, and its size, in tiles
const vx=x=>(VOX+x)*TILE,vy=y=>(VOY+y)*TILE;   // village tiles to world pixels

// Everything below is in village tiles. A prop is drawn with its bottom edge at y and centred on x; foot is the
// rectangle of tiles it blocks [x, y, w, h].
const STALLS=[   // the market: x, y of the stall's top-left tile; 5 x 2 tiles each
  {x:42,y:7,kind:'weapons',name:'Weapons stall',awning:'#8e2a38'},
  {x:48,y:7,kind:'gear',name:'Armour and gear stall',awning:'#2b3350'},
  {x:42,y:14,kind:'potions',name:'Potion stall',awning:'#5a2a6a'},
  {x:48,y:14,kind:'food',name:'Food and drink stall',awning:'#6b4a2c'},
];
const FORGE={x:42,y:21},WITCH={x:48,y:21},EXCHANGE={x:45,y:26};   // the exchange: a desk across the bottom of the market   // rows far enough apart that a stall's roof never hangs over the lane above it
const KINGDOMS=[
  {x:6.5,y:20,name:'Iron Crown',color:'#8e97b5',armor:'plate',line:'The Iron Crown holds floor after floor. We could use another blade.'},
  {x:10.5,y:22,name:'Sun Choir',color:'#e6d9a8',armor:'coat',line:'The Choir prays for every climber. Come back alive and we will pray less.'},
  {x:6.5,y:25,name:'Gilded League',color:'#d9a441',armor:'leather',line:'Everything up there has a price. The League pays the best ones.'},
];
const VILLAGE={
  square:{x:28,y:17,r:5.5},
  market:[40,5,14,24],
  fields:[3,27,13,7],fieldGate:[13,15],fieldSign:[15.7,27],plots:[[4,28],[8,28],[12,28],[4,31],[8,31],[12,31]],
  yard:[38,29,13,6],
  // worn dirt paths, each a cubic curve: start, two control points, end
  paths:[
    [[23.5,15],[19,11],[15,14],[9.5,11.5]],     // to the inn
    [[33.5,17],[36,14],[37,19],[40.5,17.5]],    // to the market
    [[22.5,18.5],[19,21],[16,17],[12.5,22]],    // to the camps
    [[25,22],[24,25],[17,24],[14,27.5]],        // to the fields
    [[26,22.5],[21,25],[20,34],[28,33.5]],      // round to the guild's door
    [[32,21],[35,25],[37,24],[40,29.5]],        // to the training yard
    [[28,11.5],[27,8],[29.5,7],[28,4.5]],       // up to the trunk
  ],
  trees:[[3.5,13.5,'a'],[17.5,5.5,'b'],[37.5,5.2,'a'],[19,23.5,'b'],[36.5,24.2,'a'],[2.8,26,'b'],[34.5,35,'a'],[18,35.2,'b'],
    [37.2,11.6,'b'],[21,8.5,'a'],[34.6,9,'b'],[17.8,33,'a'],[52.5,30,'b'],[14.5,19,'a'],[38.5,20.5,'a'],[3,35,'a'],[53,35.4,'a']],
  lamps:[[20.5,13.5],[35,15.6],[21.2,21.2],[24.5,26.5],[34.5,26.4],[39.6,9],[16.5,25.6]],
  scarecrows:[[41.5,32],[44.5,32],[47.5,32]],
};
function genVillage(){
  const map=new Uint8Array(MW*MH),at=(x,y)=>(VOY+y)*MW+VOX+x;   // 0 void, 1 open ground, 2 blocked
  for(let y=0;y<VH;y++)for(let x=0;x<VW;x++){const edge=Math.min(x,y,VW-1-x,VH-1-y);map[at(x,y)]=edge<2||(edge<3&&hash2(x,y,5)<.35)?2:1;}
  const props=[],block=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<VW&&j<VH)map[at(i,j)]=2;};
  const prop=(s,x,y,o={})=>{props.push(Object.assign({s,x:vx(x),y:vy(y)},o));};
  // the tower's trunk behind the village, and the inn, the guild and the well
  block(20,0,16,4);prop('village/trunk',28,4.4);
  block(5,6,9,5);prop('village/inn',9.5,11);
  block(23,28,10,4);prop('village/guild',28,32);
  block(15,12,2,1);prop('village/well',16,13);
  const wells=[{x:vx(16),y:vy(13.1)}],stashes=[{x:vx(7),y:vy(11.9)}];   // the well, and the inn's stash chest by its door
  // the square: the Teleport Gate's four pillars and the notice board
  for(const[x,y]of[[25,14],[30,14],[25,19],[30,19]]){block(x,y,1,1);prop('village/pillar',x+.5,y+1);}
  block(21,16,2,1);prop('village/board',22,17);
  // the market: four stalls, the forge and the witchcraft room
  const traders=[],smiths=[],talkers=[];
  for(const st of STALLS){block(st.x,st.y,5,2);
    prop('village/stall',st.x+2.5,st.y+.9,{tint:st.awning,goods:'village/goods_'+st.kind});prop('village/counter',st.x+2.5,st.y+2);
    traders.push({x:vx(st.x+2.5),y:vy(st.y+1.25),name:st.name,sells:st.kind,stall:true,
      look:{skin:SKINS[(st.x+st.y)%SKINS.length],hair:HAIRS[(st.x*3+st.y)%HAIRS.length],style:(st.x+st.y)%6,eyes:EYES[0]},eq:{armor:{type:'leather',tint:'#6b4a2c'}}});}
  block(FORGE.x,FORGE.y,5,2);prop('village/forge',FORGE.x+2.5,FORGE.y+1.1);smiths.push({x:vx(FORGE.x+3),y:vy(FORGE.y+1.4)});
  block(WITCH.x,WITCH.y,5,2);prop('village/witch',WITCH.x+2.5,WITCH.y+.9);prop('village/cauldron',WITCH.x+2.5,WITCH.y+2,{brew:true});
  // the arcanist writes grimoires from monster drops, the way the forge makes everything else (ACTIONS.forge)
  talkers.push({x:vx(WITCH.x+4),y:vy(WITCH.y+1.3),name:'Arcanist',arcanist:true,line:'Bring me what the tower’s monsters leave behind and I will write you a grimoire against them.',
    look:{skin:SKINS[5],hair:HAIRS[5],style:2,eyes:EYES[5]},eq:{armor:{type:'coat',tint:'#3c2c52'}}});
  // the exchange: a broker at a desk, with the day's prices chalked up behind (js/sim/market.js). Last in the list of
  // traders but one, so the stalls keep their places in every save's list of shops.
  block(EXCHANGE.x,EXCHANGE.y,5,1);prop('village/exchange',EXCHANGE.x+2.5,EXCHANGE.y+.6);prop('village/counter',EXCHANGE.x+2.5,EXCHANGE.y+1.2);
  const exchange={x:vx(EXCHANGE.x+2.5),y:vy(EXCHANGE.y+.3),name:'Exchange',sells:'market',stall:true,
    look:{skin:SKINS[0],hair:HAIRS[3],style:4,eyes:EYES[3]},eq:{armor:{type:'coat',tint:'#2f4a3a'}}};
  // the kingdom camps, each with its captain out front
  for(const k of KINGDOMS){block(Math.floor(k.x)-1,k.y-2,3,2);prop('village/tent',k.x,k.y,{tint:k.color});
    talkers.push({x:vx(k.x),y:vy(k.y+.8),name:'Captain of the '+k.name,line:k.line,
      look:{skin:SKINS[1+KINGDOMS.indexOf(k)],hair:HAIRS[KINGDOMS.indexOf(k)*2],style:KINGDOMS.indexOf(k)+1,eyes:EYES[0]},eq:{armor:{type:k.armor,tint:k.color}}});}
  traders.push({x:vx(9.5),y:vy(11.7),name:'Innkeeper',sells:'inn',
    look:{skin:SKINS[2],hair:HAIRS[2],style:5,eyes:EYES[0]},eq:{armor:{type:'tunic',tint:'#8a8474'}}});
  traders.push(exchange);
  // the fields' entrance (top right, where the path arrives): a signpost, the farmhand and the crop broker. Any of
  // them, or any plot, opens the fields manager (js/sim/fields.js).
  const[sgx,sgy]=VILLAGE.fieldSign;block(Math.floor(sgx),Math.floor(sgy)-1,1,1);prop('village/signpost',sgx,sgy);
  const farmhand={x:vx(12.2),y:vy(26.5),name:'Farmhand',fields:true,look:{skin:SKINS[3],hair:HAIRS[4],style:1,eyes:EYES[0]},eq:{armor:{type:'tunic',tint:'#5e4620'}}};
  const broker={x:vx(17.4),y:vy(27.7),name:'Crop broker',fields:true,look:{skin:SKINS[1],hair:HAIRS[5],style:3,eyes:EYES[3]},eq:{armor:{type:'coat',tint:'#6b4a2c'}}};
  talkers.push(farmhand,broker);
  const fieldDesk=[{x:vx(sgx),y:vy(sgy-.3),name:'Fields'},farmhand,broker];
  // the Adventurers' Guild's clerk, at its door: quests and party notices (js/sim/quests.js)
  const guild={x:vx(28),y:vy(32.8),name:'Guild clerk',look:{skin:SKINS[0],hair:HAIRS[3],style:4,eyes:EYES[1]},eq:{armor:{type:'coat',tint:'#2b3350'}}};
  // scenery
  for(const[x,y,v]of VILLAGE.trees){block(Math.floor(x),Math.floor(y)-1,1,1);prop('village/tree_'+v,x,y);}
  for(const[x,y]of VILLAGE.lamps)prop('village/lamp',x,y,{lamp:true});
  // the training yard's scarecrows are enemies that never fight back or fall (ETYPES.dummy); fighting is allowed there
  // (their tiles stay open: a hit needs a clear line to its target)
  const enemies=VILLAGE.scarecrows.map(([x,y])=>makeEnemy('dummy',vx(x),vy(y-.6),1,1,false));
  const[yx,yy,yw,yh]=VILLAGE.yard,spar={x0:vx(yx),y0:vy(yy),x1:vx(yx+yw),y1:vy(yy+yh)};
  // the fields' plots: drawn by render() from each player's own S.plots (a "for sale" sign on the ones you don't own)
  const all={x0:vx(0),y0:vy(0),x1:vx(VW),y1:vy(VH)},spawn=VILLAGE.square;
  return{n:0,village:true,map,rooms:[],start:{x:VOX+27,y:VOY+21,w:2,h:2},boss:{x:0,y:0,w:0,h:0},gates:[],gatesOpen:true,locked:false,
    enemies,spar,chests:[],drops:[],proj:[],pproj:[],fx:[],nums:[],parts:[],tele:[],timers:[],players:[],did:0,seen:new Uint8Array(MW*MH).fill(1),
    gate:null,bossAwake:false,bossEnt:null,shake:0,time:0,hpM:1,dmgM:1,corpses:[],
    safe:[all],points:[],smiths,traders,talkers,props,wells,stashes,guild,board:{x:vx(22),y:vy(17.3)},fieldDesk,crops:['potato','glowcap'],home:{x:vx(spawn.x),y:vy(spawn.y)}};
}
const nearArcanist=(r=24)=>{for(const q of G.talkers||[])if(q.arcanist&&hyp(q.x-P.x,q.y-P.y)<r)return q;return null;};
const nearTalker=()=>{for(const q of G.talkers||[])if(hyp(q.x-P.x,q.y-P.y)<24)return q;return null;};

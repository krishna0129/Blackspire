'use strict';
// Blackspire: the root village, floor 0 (docs/design/root-village.md). A hand-laid town of 80 x 60 tiles on the same 120 x 80 grid as
// the floors, with no enemies and no fighting: all of it is a safe zone, and hunger and thirst don't drain here.
// The ground is painted by paintVillage (js/client/paint.js); buildings, trees and people are props, drawn y-sorted.

const VW=80,VH=60,VOX=(MW-VW)>>1,VOY=(MH-VH)>>1;   // the village's size in tiles, and where it sits on the grid
const vx=x=>(VOX+x)*TILE,vy=y=>(VOY+y)*TILE;   // village tiles to world pixels

// Everything below is in village tiles, north up, the tower's trunk at the north edge. The town is a grid of cobbled
// streets round a central plaza with the Teleport Gate in it: the avenue (north to south), the high street (west to
// east, the shops along its north side), two lanes and two side streets, and between them rows of houses. Everyone
// you can talk to stands on the north side of a street, facing south, where no roof hides them.
// A prop is drawn with its bottom edge at y and centred on x; block() takes the tiles a thing stands on.
const STALLS=[   // the market, along the high street east of the plaza: x, y of the stall's top-left tile; 5 x 2 each
  {x:47,y:25,kind:'weapons',name:'Weapons stall',awning:'#8e2a38'},
  {x:53,y:25,kind:'gear',name:'Armour and gear stall',awning:'#2b3350'},
  {x:61,y:25,kind:'potions',name:'Potion stall',awning:'#5a2a6a'},
  {x:67,y:25,kind:'food',name:'Food and drink stall',awning:'#6b4a2c'},
];
const FORGE={x:44,y:40},WITCH={x:50,y:40},EXCHANGE={x:62,y:41};   // the craftsmen, on the south lane
const INN={x:24,y:22,w:9,h:5},GUILD={x:8,y:23,w:10,h:4};
const KINGDOMS=[   // the three camps inside the palisade, each a command tent with its captain out front
  {x:8.5,y:51,name:'Iron Crown',color:'#8e97b5',armor:'plate',line:'The Iron Crown holds floor after floor. We could use another blade.'},
  {x:16,y:51,name:'Sun Choir',color:'#e6d9a8',armor:'coat',line:'The Choir prays for every climber. Come back alive and we will pray less.'},
  {x:12.2,y:54.6,name:'Gilded League',color:'#d9a441',armor:'leather',line:'Everything up there has a price. The League pays the best ones.'},
];
const VILLAGE={
  square:{x:40,y:30,r:7},
  // cobbled streets [x, y, w, h]: the avenue, the high street, the north and south lanes, the west and east side streets
  streets:[[38,4,4,53],[3,28,74,4],[5,15,70,2],[5,43,70,2],[20,15,2,30],[58,15,2,30]],
  market:[46,24,28,4],
  camp:[5,47,15,10],campGate:[11,14],
  fields:[45,47,30,10],fieldGate:[52,54],fieldSign:[51.3,47],plots:[[47,49],[52,49],[57,49],[47,53],[52,53],[57,53]],
  yard:[23,48,13,7],
  paths:[   // worn dirt, each a cubic curve: start, two control points, end
    [[53,45],[53,47],[53,50],[53,56]],          // down through the fields
    [[46,52],[52,51.6],[58,52.4],[66,51.5]],    // across them, to the windmill
    [[12.5,45],[12.5,46],[12.5,47],[12.5,53]],  // into the camps
    [[29.5,45],[29.5,46],[29.5,47],[29.5,48.5]],// to the training yard
  ],
  trees:[[49,23,'a'],[55.5,22.5,'b'],[63.5,23,'a'],[70.5,22.6,'b'],[74.5,26.5,'a'],[6,26.5,'b'],[19,24.5,'a'],[34.5,25,'b'],[23,26.8,'a'],
    [34.5,35.5,'a'],[45.5,35.2,'b'],[45.5,24.6,'a'],[4.5,46.2,'b'],[21.5,50,'a'],[21.3,55,'b'],[36.8,56.5,'a'],[43.5,48,'b'],[43.4,54,'a'],
    [76,48,'a'],[76.2,54,'b'],[69,56.5,'a'],[4.5,12,'b'],[75.5,12,'a'],[36,6.5,'b'],[44,6.5,'a'],[57,38.5,'b'],[76,38,'a'],[4,35,'b']],
  lamps:[[37.4,10],[42.6,10],[37.4,20],[42.6,20],[37.4,40],[42.6,40],[37.4,50],[42.6,50],[42.6,56.5],
    [8,32.5],[16,32.5],[25,32.5],[31,32.5],[49,32.5],[56,32.5],[64,32.5],[72,32.5],[22.5,27.4],[46.2,27.4],[59.5,27.6],
    [12,17.4],[28,17.4],[52,17.4],[68,17.4],[10,45.4],[19.5,45.4],[36,45.4],[49.5,45.4],[57,45.4],[68,45.4],[33.4,22.6],[46.6,37.4]],
  scarecrows:[[26.5,52.5],[29.5,52.5],[32.5,52.5]],
  // things that stand in the way, one tile each [model, x, y, size, turn]: the camps' and the fields' gear, a few crates
  decor:[['campfire',12.5,49.6],['weaponrack',6.5,49.4,4,0],['weaponrack',18.4,52.5,4,1.57],['target',17.6,55.6,4.5,-.5],['crate_A_big',6.4,55.5,3.5,.3],['barrel',7.5,56.3,3.5,0],
    ['sack',16,56.4,4,1],['pallet',9.6,56.3,3.5,.2],['tent',5.9,53.4,3.6,.5],['tent',18,49.6,3.6,-.4],
    ['wheelbarrow',63.5,50.5,3.5,.6],['crate_potatoes',62.5,54.5,.5,0],['crate_carrots',63.6,54.6,.5,.4],['sack',64.5,53.6,4,2],['resource_lumber',70.5,48.6,3.5,.2],
    ['crate_A_big',52.5,22.6,3.5,.2],['barrel',66.4,22.6,3.5,0],['barrel',67.2,23.1,3.5,1],['crate_B_small',57.3,23.4,4,.5],['weaponrack',35.5,49.5,4,1.57],
    ['table_round_A',34.4,27.3,1.25,0],['barrel',33.6,26.3,3.5,0]],
  // rows of houses [x0, x1, the row's south edge, depth, tall]: a row with a street at its back is low and set back from it
  rows:[[5,37,9,4,1],[43,75,9,4,1],[5,37,15,4,1],[43,75,15,4,1],
    [5,20,21,3,0],[22,37,21,3,0],[43,58,21,3,0],[60,75,21,3,0],
    [5,20,37,4,0],[22,33,37,4,0],[47,58,37,4,0],[60,75,37,4,0],
    [5,20,43,4,1],[22,37,43,4,1],[69,75,43,4,1]],
};
// The houses: rows only loosely. Each is 3 to 6 tiles wide and stands a little forward or back of its neighbours, turned
// a few degrees its own way; between some there is a gap with a tree, a cart's worth of crates or a woodpile in it, or
// just room to slip through. shift: a row's houses step away from the street they keep clear (-1 north, 1 south).
function villageHouses(){
  const r=mulberry32(1907),out=[],extras=[],FILL=['tree_single_A','tree_single_B','barrel','crate_A_big','resource_lumber','sack','crate_B_small','pallet'];
  for(const[x0,x1,base,depth,tall]of VILLAGE.rows){let x=x0;const shift=tall?-1:1;
    while(x1-x>=3){let w=3+Math.floor(r()*4);if(w>x1-x||x1-x-w<3)w=x1-x;if(w>7)w=Math.ceil(w/2);
      const d=Math.max(3,depth-(depth>3&&r()<.35?1:0)),off=r()<.45?shift:0;
      out.push({x,y:base-d+off,w,h:d,floors:tall?(r()<.65?2:1):1,seed:Math.floor(r()*1e6),rot:(r()<.25?0:(r()-.5)*.5),dx:(r()-.5)*.5});x+=w;
      if(r()<.45&&x1-x>=4){if(r()<.7){const k=FILL[Math.floor(r()*FILL.length)],tree=k.startsWith('tree');extras.push([k,x+.5,base-(tall?1.5:d-.5)+r(),tree?4.2+r()*.8:k==='crate_B_small'?4:3.5,r()*6]);}x+=1;}}}
  return{houses:out,extras};
}
function genVillage(){
  const map=new Uint8Array(MW*MH),at=(x,y)=>(VOY+y)*MW+VOX+x;   // 0 void, 1 open ground, 2 blocked
  for(let y=0;y<VH;y++)for(let x=0;x<VW;x++){const edge=Math.min(x,y,VW-1-x,VH-1-y);map[at(x,y)]=edge<3?2:1;}   // the town wall
  const props=[],block=(x,y,w,h)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)if(i>=0&&j>=0&&i<VW&&j<VH)map[at(i,j)]=2;};
  const prop=(s,x,y,o={})=>{props.push(Object.assign({s,x:vx(x),y:vy(y)},o));};
  // the tower's trunk behind the town, the houses, and the inn, the guild and the well
  block(31,0,18,4);prop('village/trunk',40,4.4);
  const{houses,extras}=villageHouses();for(const h of houses)block(h.x,h.y,h.w,h.h);for(const[,x,y]of extras)block(Math.floor(x),Math.floor(y),1,1);
  block(INN.x,INN.y,INN.w,INN.h);prop('village/inn',INN.x+INN.w/2,INN.y+INN.h);
  block(GUILD.x,GUILD.y,GUILD.w,GUILD.h);prop('village/guild',GUILD.x+GUILD.w/2,GUILD.y+GUILD.h);
  block(35,24,2,1);prop('village/well',36,25);
  const wells=[{x:vx(36),y:vy(25.1)}],stashes=[{x:vx(INN.x+2),y:vy(INN.y+INN.h+.9)}];   // the well, and the inn's stash chest by its door
  // the plaza: the Teleport Gate's four pillars and the notice board
  for(const[x,y]of[[36,26],[43,26],[36,33],[43,33]]){block(x,y,1,1);prop('village/pillar',x+.5,y+1);}
  block(44,34,2,1);prop('village/board',45,35);
  // the market: four stalls on the high street; the forge and the witchcraft room on the south lane
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
  // the kingdoms' camps, inside their palisade (open at the gate on the south lane), each captain out front
  {const[cx,cy,cw,ch]=VILLAGE.camp,[g0,g1]=VILLAGE.campGate;
    for(let x=cx;x<cx+cw;x++){if(x<g0||x>=g1)block(x,cy,1,1);}for(let y=cy;y<cy+ch;y++){block(cx+cw-1,y,1,1);}}
  for(const k of KINGDOMS){block(Math.floor(k.x)-1,Math.floor(k.y)-2,3,2);block(Math.floor(k.x+1.9),Math.floor(k.y-.6),1,1);prop('village/tent',k.x,k.y,{tint:k.color});
    talkers.push({x:vx(k.x),y:vy(k.y+.8),name:'Captain of the '+k.name,line:k.line,
      look:{skin:SKINS[1+KINGDOMS.indexOf(k)],hair:HAIRS[KINGDOMS.indexOf(k)*2],style:KINGDOMS.indexOf(k)+1,eyes:EYES[0]},eq:{armor:{type:k.armor,tint:k.color}}});}
  traders.push({x:vx(INN.x+INN.w/2),y:vy(INN.y+INN.h+.7),name:'Innkeeper',sells:'inn',
    look:{skin:SKINS[2],hair:HAIRS[2],style:5,eyes:EYES[0]},eq:{armor:{type:'tunic',tint:'#8a8474'}}});
  traders.push(exchange);
  // the fields' gate on the south lane: a signpost, the farmhand and the crop broker. Any of them, or any plot, opens
  // the fields manager (js/sim/fields.js). A fence runs along the lane; the windmill and the barn stand at the far end.
  {const[fx,fy,fw]=VILLAGE.fields,[g0,g1]=VILLAGE.fieldGate;for(let x=fx;x<fx+fw;x++)if(x<g0||x>=g1)block(x,fy,1,1);}
  block(66,49,4,3);block(71,53,3,3);
  const[sgx,sgy]=VILLAGE.fieldSign;prop('village/signpost',sgx,sgy);
  const farmhand={x:vx(50.4),y:vy(45.8),name:'Farmhand',fields:true,look:{skin:SKINS[3],hair:HAIRS[4],style:1,eyes:EYES[0]},eq:{armor:{type:'tunic',tint:'#5e4620'}}};
  const broker={x:vx(55.6),y:vy(45.8),name:'Crop broker',fields:true,look:{skin:SKINS[1],hair:HAIRS[5],style:3,eyes:EYES[3]},eq:{armor:{type:'coat',tint:'#6b4a2c'}}};
  talkers.push(farmhand,broker);
  talkers.push({x:vx(INN.x+INN.w/2+2.4),y:vy(INN.y+INN.h+1.2),name:'Barkeep',rumours:true,line:'Pull up a stool. I hear things.',look:{skin:SKINS[2],hair:HAIRS[1],style:5,eyes:EYES[0]},eq:{armor:{type:'tunic',tint:'#7a3a2a'}}});   // rumours (RUMOURS, data.js)
  const fieldDesk=[{x:vx(sgx),y:vy(sgy-.3),name:'Fields'},farmhand,broker];
  // the Adventurers' Guild's clerk, at its door: quests and party notices (js/sim/quests.js)
  const guild={x:vx(GUILD.x+GUILD.w/2),y:vy(GUILD.y+GUILD.h+.8),name:'Guild clerk',look:{skin:SKINS[0],hair:HAIRS[3],style:4,eyes:EYES[1]},eq:{armor:{type:'coat',tint:'#2b3350'}}};
  // scenery
  for(const[x,y,v]of VILLAGE.trees){block(Math.floor(x),Math.floor(y)-1,1,1);prop('village/tree_'+v,x,y);}
  for(const[x,y]of VILLAGE.lamps)prop('village/lamp',x,y,{lamp:true});
  for(const[,x,y]of VILLAGE.decor)block(Math.floor(x),Math.floor(y),1,1);
  // the training yard's scarecrows are enemies that never fight back or fall (ETYPES.dummy); fighting is allowed there
  // (their tiles stay open: a hit needs a clear line to its target)
  const enemies=VILLAGE.scarecrows.map(([x,y])=>makeEnemy('dummy',vx(x),vy(y-.6),1,1,false));
  const[yx,yy,yw,yh]=VILLAGE.yard,spar={x0:vx(yx),y0:vy(yy),x1:vx(yx+yw),y1:vy(yy+yh)};
  // the fields' plots: drawn by render() from each player's own S.plots (a "for sale" sign on the ones you don't own)
  const all={x0:vx(0),y0:vy(0),x1:vx(VW),y1:vy(VH)},spawn=VILLAGE.square;
  return{n:0,village:true,map,rooms:[],start:{x:VOX+39,y:VOY+33,w:2,h:2},boss:{x:0,y:0,w:0,h:0},gates:[],gatesOpen:true,locked:false,
    enemies,spar,chests:[],drops:[],proj:[],pproj:[],pfx:[],fx:[],nums:[],parts:[],tele:[],timers:[],players:[],did:0,seen:new Uint8Array(MW*MH).fill(1),
    gate:null,bossAwake:false,bossEnt:null,shake:0,time:0,hpM:1,dmgM:1,corpses:[],houses,extras,
    safe:[all],points:[],smiths,traders,talkers,props,wells,stashes,guild,board:{x:vx(45),y:vy(35.3)},fieldDesk,crops:['potato','glowcap'],home:{x:vx(spawn.x),y:vy(spawn.y)}};
}
const nearArcanist=(r=24)=>{for(const q of G.talkers||[])if(q.arcanist&&hyp(q.x-P.x,q.y-P.y)<r)return q;return null;};
const nearTalker=()=>{for(const q of G.talkers||[])if(hyp(q.x-P.x,q.y-P.y)<24)return q;return null;};

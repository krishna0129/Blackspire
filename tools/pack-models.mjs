// Blackspire: packs the 3D models the tower floors are drawn with into js/vendor/models.js.
//
// The models are KayKit's (Kay Lousberg, kaylousberg.com), released under CC0. The source packs are on GitHub:
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0
//   git clone --depth 1 https://github.com/KayKit-Game-Assets/KayKit-Halloween-Bits-1.0
// Clone them side by side, then:  node tools/pack-models.mjs <folder with the four clones>
//
// What comes out, each one a .glb packed as base64 so the game opens from a plain file with no server:
//   props   every prop, wall, floor tile and weapon the floors use, one named node each, sharing their textures
//   anims   the animations, once: every character is on the same rig, so one set of clips moves all of them
//   <Name>  each character, mesh and rig only
// Meshes are quantized and meshopt-compressed (GLTFLoader decodes them with MeshoptDecoder).
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,dedup,prune,quantize,meshopt,resample} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import fs from 'node:fs';
// Disposing an animation leaves its samplers holding their keyframes, so those go too (prune then drops the orphaned keyframes).
const dropClip=a=>{for(const c of a.listChannels())c.dispose();for(const s of a.listSamplers())s.dispose();a.dispose();};import path from 'node:path';

const SRC=process.argv[2];if(!SRC){console.error('usage: node tools/pack-models.mjs <folder with the KayKit clones>');process.exit(1);}
const find=(pack,name)=>{   // a model by file name, wherever it sits in a pack
  const root=path.join(SRC,pack);const out=[];
  (function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())walk(p);else if(f.name===name)out.push(p);}})(root);
  const gltf=out.find(p=>p.includes('/gltf/'))||out[0];if(!gltf)throw new Error('missing '+pack+' '+name);return gltf;};
const DUN='KayKit-Dungeon-Remastered-1.0',ADV='KayKit-Character-Pack-Adventures-1.0',SKL='KayKit-Character-Pack-Skeletons-1.0',HAL='KayKit-Halloween-Bits-1.0';

// key: [pack, file]
const PROPS={};
for(const n of['floor_tile_small','floor_tile_small_broken_A','floor_tile_small_broken_B','floor_tile_small_decorated','floor_tile_small_weeds_A',
  'floor_wood_small_dark','floor_dirt_small_A','floor_dirt_small_weeds','wall_half','wall_gated','pillar','pillar_decorated','torch_mounted',
  'banner_patternA_red','banner_patternB_red','banner_red','banner_thin_red','banner_shield_red','banner_triple_red',
  'banner_patternA_blue','banner_shield_blue','banner_triple_blue','banner_patternA_green','banner_thin_green',
  'shelf_large','barrel_large','barrel_small_stack','keg','crates_stacked','box_stacked','box_large','table_medium_decorated_A',
  'candle_lit','candle_triple','candle_thin','candle_thin_lit','rubble_half','rubble_large','coin_stack_small','sword_shield','trunk_medium_A'])
  PROPS[n]=[DUN,n+'.gltf.glb'];
PROPS.chest=[DUN,'chest.glb'];PROPS.chest_gold=[DUN,'chest_gold.glb'];
for(const n of['ribcage','bone_A','bone_B','bone_C','skull','coffin','coffin_decorated','tree_dead_small','tree_dead_medium','tree_dead_large',
  'gravestone','grave_A_destroyed','lantern_standing','skull_candle','shrine_candles','lantern_hanging','post_skull','post_lantern','candle_melted'])PROPS[n]=[HAL,n+'.gltf'];
for(const n of['Skeleton_Blade','Skeleton_Axe','Skeleton_Crossbow','Skeleton_Staff','Skeleton_Shield_Large_A','Skeleton_Shield_Small_A','Skeleton_Arrow'])PROPS[n]=[SKL,n+'.gltf'];
for(const n of['arrow','spellbook_open'])PROPS[n]=[ADV,n+'.gltf'];
// the root village: KayKit Medieval Hexagon (buildings, trees, camps), Restaurant Bits and Furniture Bits
const MED='KayKit-Medieval-Hexagon-Pack-1.0',RES='KayKit-Restaurant-Bits-1.0',FUR='KayKit-Furniture-Bits-1.0';
for(const n of['building_tavern_red','building_blacksmith_red','building_church_blue','building_market_red','building_market_blue','building_market_green',
  'building_market_yellow','building_well_blue','building_windmill_yellow','building_home_A_red','building_home_B_blue','building_home_A_yellow','building_grain',
  'building_archeryrange_red','building_tower_A_blue','tent','flag_red','flag_blue','flag_yellow','flag_green','target','trees_A_large','trees_A_medium','trees_B_large',
  'trees_B_medium','tree_single_A','tree_single_B','rock_single_A','rock_single_B','rock_single_C','hills_A_trees','hills_B_trees','mountain_A_grass_trees',
  'mountain_B_grass_trees','mountain_C_grass_trees','fence_wood_straight','barrel','crate_A_big','crate_B_small','sack','wheelbarrow','weaponrack','bucket_water',
  'resource_lumber','pallet'])PROPS[n]=[MED,n+'.gltf'];
for(const n of['pot_large','table_round_A','crate_potatoes','crate_carrots','crate_tomatoes'])PROPS[n]=[RES,n+'.gltf'];
for(const n of['table_medium','table_medium_long','chair_A_wood','lamp_standing'])PROPS[n]=[FUR,n+'.gltf'];
const CHARS={Knight:ADV,Barbarian:ADV,Mage:ADV,Rogue:ADV,Rogue_Hooded:ADV,Skeleton_Warrior:SKL,Skeleton_Mage:SKL,Skeleton_Minion:SKL,Skeleton_Rogue:SKL};
const CLIPS=['Idle','Idle_B','Idle_Combat','Unarmed_Idle','2H_Melee_Idle','Walking_A','Walking_D_Skeletons','Running_A','Running_B',
  '1H_Melee_Attack_Slice_Horizontal','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop','1H_Melee_Attack_Stab',
  '2H_Melee_Attack_Chop','2H_Melee_Attack_Slice','2H_Melee_Attack_Spin','2H_Melee_Attack_Stab','Dualwield_Melee_Attack_Slice','Dualwield_Melee_Attack_Stab',
  '1H_Ranged_Shoot','2H_Ranged_Shoot','2H_Ranged_Aiming','Spellcast_Shoot','Spellcasting','Spellcast_Summon','Spellcast_Raise','Spellcast_Long',
  'Blocking','Block_Hit','Dodge_Forward','Hit_A','Hit_B','Death_A','Death_A_Pose','Death_C_Skeletons','Death_C_Pose',
  'Skeletons_Awaken_Floor','Skeletons_Inactive_Floor_Pose','Spawn_Ground','Taunt','Cheer','Use_Item','Sit_Floor_Idle','Interact','PickUp'];

await MeshoptEncoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder});
const squeeze=async(doc,anim,plain)=>{
  await doc.transform(...(anim?[resample({tolerance:1e-4})]:[]),dedup(),prune({keepLeaves:true}),...(anim||plain?[]:[quantize()]),meshopt({encoder:MeshoptEncoder,level:'medium'}));
  return Buffer.from(await io.writeBinary(doc));};
const out={};

// props: every model's nodes under one node named after it, in one scene
{
  const doc=new (await import('@gltf-transform/core')).Document();doc.createBuffer();
  const scene=doc.createScene('props');
  for(const[k,[pack,file]]of Object.entries(PROPS)){
    const src=await io.read(find(pack,file)),roots=src.getRoot().listScenes()[0].listChildren();
    const map=mergeDocuments(doc,src),holder=doc.createNode(k);
    for(const n of roots)holder.addChild(map.get(n));
    scene.addChild(holder);
  }
  for(const s of doc.getRoot().listScenes())if(s!==scene)s.dispose();
  for(const b of doc.getRoot().listBuffers().slice(1))b.dispose();
  for(const a of doc.getRoot().listAccessors())a.setBuffer(doc.getRoot().listBuffers()[0]);
  doc.getRoot().setDefaultScene(scene);
  {const {getBounds}=await import('@gltf-transform/functions');const sz={};for(const h of scene.listChildren()){const b=getBounds(h);sz[h.getName()]=[b.max[0]-b.min[0],b.max[1]-b.min[1],b.max[2]-b.min[2]].map(v=>+v.toFixed(2));}
    fs.writeFileSync('/tmp/claude-0/-home-claude/b2c8b46c-bdce-538a-96a6-f470e8d698c7/scratchpad/sizes.json',JSON.stringify(sz));}
  out.props=await squeeze(doc);
}
// the clips, from one skeleton (every character has the same rig)
{
  const doc=await io.read(find(SKL,'Skeleton_Warrior.glb'));
  for(const a of doc.getRoot().listAnimations())if(!CLIPS.includes(a.getName()))dropClip(a);
  const missing=CLIPS.filter(c=>!doc.getRoot().listAnimations().some(a=>a.getName()===c));if(missing.length)throw new Error('no clip '+missing);
  for(const n of doc.getRoot().listNodes())if(n.getMesh())n.dispose();
  for(const s of doc.getRoot().listSkins())s.dispose();
  out.anims=await squeeze(doc,true);
}
for(const[k,pack]of Object.entries(CHARS)){
  const doc=await io.read(find(pack,k+'.glb'));for(const a of doc.getRoot().listAnimations())dropClip(a);
  out[k]=await squeeze(doc,false,true);   // not quantized: render3d.js joins each body into one mesh, which needs plain vertices
}
let js='\'use strict\';\n// Blackspire: the 3D models, packed by tools/pack-models.mjs from KayKit\'s CC0 packs (kaylousberg.com). Generated: do not edit.\nconst MODELS={\n';
let total=0;for(const[k,b]of Object.entries(out)){total+=b.length;console.log(k.padEnd(18),(b.length/1024).toFixed(0)+' KB');js+=`${JSON.stringify(k)}:${JSON.stringify(b.toString('base64'))},\n`;}
js+='};\n';fs.mkdirSync('js/vendor',{recursive:true});fs.writeFileSync('js/vendor/models.js',js);
console.log('total',(total/1024).toFixed(0)+' KB','→ js/vendor/models.js',(js.length/1024).toFixed(0)+' KB');

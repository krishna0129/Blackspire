# The character, the look and the sound

Status: **decided, not built yet** (except where a line says it is in the game). Part of the road to the first
friends' playtest ([roadmap](../roadmap.md)).

## Decided

### The character

- **The build:** people stand about six heads tall, with long legs ("Longer legs"; in the game).
- **Enemies too:** skeletons get the same tall build as people (today they keep a stockier one).
- **The 3D character creator** offers skin colour, hair style and colour, face and eye colour, and **two body types**
  (broader and slimmer, both on the tall build, so all gear fits both).
- **Uploaded 2D sprite sheets are dropped**: the game is 3D.
- **A new character wears Common gear of its class's weight**: casters a tunic, the Ranger and the Shadow light
  leathers, the Duelist a longcoat, the Marauder and the Templar mail ([gear.md](gear.md), [classes.md](classes.md)).

### Enemies

- **Floor 1's spirits and floor 3's roots and hermits get models of their own** before the playtest, made like the
  gear (built from shapes, baked once), instead of borrowing skeletons.

### The look

- **Style C**: the gritty grade (darker, desaturated, grain) with ink outlines on models. (In the game, as the default;
  now chosen.)
- **Coat tails and capes swing** as you move.
- **Item icons are 128 pixels**, baked once into one sheet.

### Sound

- The playtest has **combat sounds** (hits, blocks, parries, skills, by weapon), **world sounds** (footsteps, enemies,
  doors, chests), **music** (a theme for each floor, a boss theme, the village) and **interface sounds** (clicks,
  loot, level up).
- They come from **free CC0 packs**, credited in the README like the KayKit models. (The workspace can't download from
  most sites, so the owner fetches the chosen packs and hands them over.)

### Story

- **A light touch** in the playtest: an opening line at the gate, the guild's bounties, a few villagers' lines.

## Open

- Which sound and music packs.
- The hair styles and faces themselves.
- The slowest computer the game must run well on, measured once friends try it.

## People, as built

Built (js/client/figure.js): heroes, townsfolk and the crowd are no longer the adventurer models. Each is built
from plain shapes onto the adventurers' skeleton, so every animation still plays.

- **The build:** about seven and a half heads tall, long legs, narrow hips, square shoulders, arms at the sides.
  The skeleton's proportions are stretched bone by bone (PROP); held weapons are scaled down to fit real hands.
- **The face and hair:** a head with a jaw, a brow, eyes in the chosen colour, in the chosen skin; six hair styles
  (short with a fringe, spiked, long, tail, bob, buzz) in the chosen colour.
- **Armour, on the body:**
  - *tunic*: an open-necked tunic in its colour with a trimmed collar, sleeves to the elbow, wrist wraps, a belt,
    and a short skirt of cloth;
  - *leather jerkin*: laced leather, one shoulder guard and its strap, bracers, a pouch, four leather flaps;
  - *longcoat*: a fitted coat in its colour, a high collar open at the throat, edged lapels, two straps across
    the chest, cuffs, gloves, and **tails to the shin, open at the front and split up the back**;
  - *plate*: a keeled breastplate, a gorget, layered pauldrons, tassets, steel arms and legs, a tabard in its colour.
- **Boots:** plain boots (a cuff and a buckle), striders (wrapped shins, light shoes), greaves (steel).
- **Cloth moves.** Coat tails, the tunic's skirt, the jerkin's flaps and the tabard are chains of points hanging
  from the waist, simulated every frame: they trail when you run, swing when you turn and settle when you stop,
  and are pushed off the legs.
- **Outline:** one ink line round the whole figure (drawn along rounded normals, so it does not break up); small
  detail like the face has none of its own.

The body is one skinned mesh coloured by vertex (one draw), the cloth a second. Still to come from the gear plan:
the other five chest types, head and hand slots, the rarity looks, each set's colours and emblem, two body types.


### Scale and build (second pass)

- The camera sits closer by default (about 17 units out, was 30), so a person stands roughly a fifth of the screen tall. The wheel pulls back as far as the old view.
- People are a little taller (scale 1.36) and built with muscle under the clothes: a chest that widens to the shoulders, a back, shoulder caps, upper arms, forearms, thighs and calves that swell between the joints.
- Held weapons are drawn at 46% of the KayKit size so a sword is in proportion to the arm.
- Gear carries finer parts: lacing, seams, pouch and bracers on the tunic; riveted panels, strap, sheathed knife on leather; lapels, two button rows, pocket flaps, shoulder tabs, cuffs on the coat; fluting, gorget, layered pauldrons, edged tassets, elbow points on plate; strapped and buckled boots.

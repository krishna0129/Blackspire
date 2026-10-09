# The root village

Status: proposal, with the owner's ideas folded in. Part of [world.md](world.md): the first village, at the roots of
the tree, where every character starts and comes home to. Nothing here is built yet.

![Plan of the root village: the Teleport Gate glowing in the middle of the square under the tower's trunk; winding paths lined with trees, shrubs, flowers and lamps lead to the inn and well, the market of six stalls including the forge and the witchcraft room, the kingdom camps, the fields of plots for sale, and the training yard with scarecrow dummies](img/root-village.svg)

## What it is

A small, hand-made village of about 56 × 38 tiles, walled in by the tower's roots, with the trunk rising behind it.
There is no fighting anywhere in it: weapons stay sheathed, as in a safe room. Hunger and thirst don't drain here.

It should feel lived in: paths that wander instead of running straight, trees and shrubs along them, flowers in the
grass, lamps at the corners, smoke from the forge and bubbles from the witchcraft room.

### The square and the Teleport Gate

- The **Teleport Gate** stands in the middle of the square, glowing, so it is the first thing you see on arrival.
  It is the way into the tower (the Tower Gate), like the teleport gates of SAO's towns.
- Step in and pick **any floor you have reached**, and on that floor **any safe point** you have been to, or its
  entrance. So going back to where you left off takes one step, not a walk across the floor.
- The **notice board** at the square's edge lists **every quest in this region**. The whole board **refreshes once
  every 24 hours**, whether or not a quest is in progress, so the board always shows how long until the next refresh.

### The market

The blacksmith and the arcanist don't have their own corners of the village. They are **stalls in the market**,
alongside the traders. Six stalls:

| Stall | Who | What |
|---|---|---|
| **Weapons** | a trader | weapons for every class |
| **Armour and gear** | a trader | armour, boots, trinkets |
| **Potions** | a trader | health potions, and later what the witchcraft room brews |
| **Food and drink** | a trader | rations, water flasks, cooked meals |
| **The forge** | the **blacksmith** | enhancing now; forging from monster drops later. An anvil, a glowing hearth, sparks |
| **The witchcraft room** | the **arcanist** | mutations, skills, gear passives later; **alchemy and potion crafting**. A cauldron, shelves of jars, green light |

Each stall has its own striped awning and its goods on show, so you can tell them apart from across the market.
All six count as NPC stock for the region's prices ([world.md](world.md#the-market-one-pricing-rule-from-what-the-npcs-hold)).

### Elsewhere

| Place | What's there |
|---|---|
| **Inn** | meals (fill hunger), and the **stash**. The **well** stands outside it: drink to fill thirst, free |
| **Training yard** | **scarecrow dummies** to test skills on. They take hits and show the damage numbers, like enemies do, and never die |
| **Kingdom camps** | the three companies' tents and banners; their captains say a line or two now and give quests later |
| **Fields** | plots of farmland that players **buy** to grow crops (below) |

### Fields

- Fields are divided into **plots you buy** with shards. An owned plot is yours alone; nobody else can enter your
  field (decided in world.md).
- **Each village's soil is rich in one or two nutrients, so only one or two crops grow there.** That's the lore; the
  rule is simply one or two crops per village. Players who want other crops go to other villages, which gives
  every village something of its own to trade.
- **Suggested** for the roots, damp and dark under the tree: **potatoes** and **glowcaps**, a mushroom that grows on
  the roots. Potatoes feed (rations, meals); glowcaps go into potions at the witchcraft room.

## How it changes the loop

- **New characters start in the square**, not on floor 1.
- **The floor gate** in each floor's start room gains **"Root village"** at the top of its list.
- **Dying** still wakes you in the last safe room on the floor.
- **The blacksmith leaves the tower** (decided in world.md): enhancing happens only at the forge. Safe rooms keep a
  trader and gain the **stash**.
- **The stash** is the same everywhere: the inn, and every safe room. 60 slots to start.
- Saves remember the village as floor 0, so "continue" puts you back where you were.

## Online

The village is where online players meet. Two ways to run it:

1. **Shared (recommended):** everyone online is in the same village, split into copies of about 30 players when it
   gets busy, the way MMOs open a second channel. Parties form there and leave together through the Teleport Gate.
2. **Per party:** each party gets its own copy, like the floors today. Simplest, but you never see anyone else.

## Art

- **Tiles:** grass, worn dirt paths, the square's flagstones, root walls, the trunk, water for the well.
- **Scenery:** trees, shrubs, flowers, lamps; crop rows and plot signs.
- **Buildings and stalls** as large sprites: the inn, six stalls with awnings, the forge's hearth, the witchcraft
  room's cauldron, three tents, the Teleport Gate.
- **People:** the blacksmith and trader exist. New: an arcanist, two more traders, an innkeeper, three captains.
- **Scarecrows** that wobble when hit.

All of it drawn by `tools/make_sprites.py` like the rest of the art, and swappable for finer art through the pixel
ratio.

## Order of work

1. The map, tiles, scenery and buildings, single player: arrive, walk, use the Teleport Gate (floors and safe points),
   come back through the floor gate.
2. The market: the four trader stalls, the forge (the blacksmith moves here), the witchcraft room (shut until the
   arcanist's features exist).
3. The inn's meals, the well, the stash in the inn and every safe room.
4. The training yard's scarecrows.
5. Online: the village as a shared world (or per party).
6. Later, with their own features: the notice board's quests, the fields, the captains' quests.

## Open questions

1. Online village: **shared** with channels of about 30 (recommended), or **per party**?
2. The 24-hour refresh drops quests that are in progress. Should a quest you have **already finished** but not handed
   in still pay out after the refresh? Suggested: yes, so nobody loses a finished quest to the clock.
3. Teleporting to a safe point: only safe points **you have visited** (suggested), or any on a floor you've reached?
4. Is a **free well** for thirst all right? Flasks still matter, since you can't take the well into the tower.

# The root village

Status: being built. Part of [world.md](world.md): the first village, at the roots of the tree, where every character
starts and comes home to.

**In the game, single player and online:** the map and its art, the Teleport Gate (floors and visited safe points),
the floor gate's way home, the four trader stalls, the forge (the only blacksmith: the tower's safe rooms keep a trader
and a stash chest), the stash chest by the inn, the well and empty flasks, the arcanist, captains, innkeeper and guild
clerk (who talk, for now), and no hunger or thirst at home. Online, the village is **shared**: everyone is in a
channel of up to 30, sees the others there, and parties form and leave through the Teleport Gate together. The
inn serves meals, the training yard's scarecrows take hits, the Adventurers' Guild runs its quest board and party
notices, and the fields grow potatoes and glowcaps (below). The whole village plan is in.

## What it is

A walled medieval town of 80 × 60 tiles at the foot of the tree, the trunk rising behind its north wall, in the spirit
of SAO's Town of Beginnings: dense rows of timber-framed houses, cobbled streets, and a round plaza in the middle.
There is no fighting anywhere in it: weapons stay sheathed, as in a safe room. Hunger and thirst don't drain here.

**The plan** (js/sim/village.js; north is up):

- **The plaza** in the centre, flagstones in rings round the **Teleport Gate**; the well and the notice board at its edge.
- **The avenue** runs north to south through the plaza, from the trunk to the south gate. **The high street** crosses
  it west to east. Two lanes (north and south) and two side streets make the rest of the grid.
- **The high street, west:** the **inn** (innkeeper, barkeep, the stash chest) and the **Adventurers' Guild**.
- **The high street, east:** the **market**, four stalls in a row (weapons, gear, potions, food).
- **The south lane, east:** the craftsmen: the **forge**, the **arcanist**, the **exchange**.
- **South-west:** the **kingdom camps** inside a palisade with a gate: a command tent in each kingdom's colour with
  its banner and captain, a fire, racks and a target. Beside it the **training yard** and its scarecrows.
- **South-east:** the **fields** behind a fence: six plots, a barn, the windmill; the farmhand and the crop broker
  stand at the gate.
- **Everywhere else:** about fifty **houses** in rows. Nobody lives in them yet (they can't be entered); they are
  the town. Rows with a street behind them are one storey and set back, so they never hide the street.

**The hour.** The village has an hour (`VILLAGE_HOUR` in village.js): `day` (an overcast daylight, windows dark),
`evening` (golden dusk, windows lit dim and steady) or `night`. It is fixed at day for now; a real cycle is still to
come. To look at the others, type `R3.hour('evening')` or `R3.hour('night')` in the browser's console.

**Surfaces** are drawn by shaders, not textures: stone in courses with dark mortar, old plaster with stains, rain
streaks, cracks and patches fallen away to the brick, roof tiles in lapping rows with moss, weathered wood. Each
house has its own roof, ending in dark bargeboards at its own walls.

Everyone you can talk to stands on the north side of a street, facing south, where no roof covers them. Houses are
built in the renderer from boxes (footings, plaster, a timber frame, doors, lit windows, pitched roofs, chimneys),
each different by its own seed. The old flat renderer still works but draws no houses.

### The square and the Teleport Gate

- The **Teleport Gate** stands in the middle of the square, glowing, so it is the first thing you see on arrival.
  It is the way into the tower (the Tower Gate), like the teleport gates of SAO's towns.
- Step in and pick **any floor you have reached**, and on that floor **any safe point** you have been to, or its
  entrance. So going back to where you left off takes one step, not a walk across the floor.
- The **notice board** at the square's edge lists **every quest in this region**. The whole board **refreshes once
  every 24 hours**, whether or not a quest is in progress, so the board always shows how long until the next refresh.
  Quests are taken and handed in at the guild (below).
- **Teleporting** goes to **safe points you have visited** (decided), plus each floor's entrance.

### The Adventurers' Guild

**In the game.** How it works now:

- **One board a day per region**, the same for every player, built from the date (it needs no server). The root
  village's board has three hunts (kill a number of one enemy, on the floor it lives on), two deliveries (bring iron
  scrap, Emberstone or Spire crystal) and a bounty (beat one floor's boss). Rewards are shards and experience; the
  bounty adds a Spire crystal.
- Up to **three quests** taken at once, at the guild clerk by the door. Kills count from when you take a quest;
  deliveries count what you carry and take it when you hand in. Giving a quest up frees its place.
- The notice board in the square shows the same board, to read; taking and handing in happen at the guild.
- The board refreshes at **midnight UTC**, and shows how long until then.
- **Party notices (online):** a party leader in the village posts one line; anyone online sees it at the guild, with
  the leader's name, level and class, the party's size and furthest floor, and joins with one click. A notice comes
  down when the party fills, breaks up, its leader takes it down, or after 30 minutes.

**Decided:** the village has an adventurers' guild, on the square's south side. There players:

- **accept quests** from the region's board;
- **hand in** quest items and **collect rewards**. A finished quest must be handed in at the guild, or to the NPC who
  gave it, **before the board refreshes**; at the refresh it is gone, finished or not (decided);
- **post notices for party mates**: "two for floor 3, healer wanted". Online, notices are seen by everyone in the
  village.

### The market

The blacksmith and the arcanist don't have their own corners of the village. They are **stalls in the market**,
alongside the traders. Six stalls, and the exchange's desk across the bottom:

| Stall | Who | What |
|---|---|---|
| **Weapons** | a trader | weapons for every class |
| **Armour and gear** | a trader | armour, boots, trinkets |
| **Potions** | a trader | health potions, and later what the witchcraft room brews |
| **Food and drink** | a trader | rations, water flasks, cooked meals |
| **The forge** | the **blacksmith** | enhancing, and forging weapons, armour and boots from monster drops (in the game). An anvil, a glowing hearth, sparks |
| **The witchcraft room** | the **arcanist** | grimoires from monster drops (in the game); mutations, skills, gear passives later; **brewing buff potions from monster drops** (decided, not built: [world.md](world.md#brewing-potions-from-monster-drops)). A cauldron, shelves of jars, green light |
| **The exchange** | a broker | buys and sells materials and monster drops at prices that move with its stock (in the game: [world.md](world.md#the-market-one-pricing-rule-from-what-the-npcs-hold)). A desk, crates, and the day's prices chalked on a board |

Each stall has its own striped awning and its goods on show, so you can tell them apart from across the market.
**In the game:** the stalls restock whenever you beat any floor's boss, and once a day, when the guild's board
refreshes. Their gear is always at the level of the highest floor you have reached.

**Decided:** only the exchange's prices move with its stock; the six stalls keep fixed prices ([world.md](world.md#the-market-one-pricing-rule-from-what-the-npcs-hold)).

### Elsewhere

| Place | What's there |
|---|---|
| **Inn** | meals (fill hunger), and the **stash**. The **well** stands outside it (below) |
| **Training yard** | **scarecrow dummies** to test skills on. They take hits and show the damage numbers, like enemies do, and never die |
| **Kingdom camps** | the three companies' tents and banners; their captains say a line or two now and give quests later |
| **Fields** | plots of farmland that players **buy** to grow crops (below) |

### The inn's meals

**In the game.** The innkeeper serves three meals, eaten on the spot. Each fills the meters and leaves one buff for
20 minutes; a new meal replaces the old buff, and falling in the tower loses it.

| Meal | Price | Fills | Buff |
|---|---|---|---|
| Root stew | 15 | hunger 100%, thirst 20% | **Well fed:** hunger and thirst drain half as fast |
| Roast boar and bread | 30 | hunger 100% | **Hearty:** natural healing 50% faster |
| Glowcap tea | 10 | thirst 100% | **Clear-headed:** mana comes back 25% faster |

Prices rise 25% for each floor past the first that you have reached, like the market's.

### The training yard

**In the game.** The yard is the one place in the village where weapons come out. Its three scarecrows take hits,
show the damage numbers, rock when struck and never fall; left alone for a few seconds they are whole again. They
never move or strike back, give nothing, and online every player in the channel shares them.

### Water and the well

**Decided:** water from the well is free, but you need a **flask** to take it. Water flasks are bought from traders
and market stalls; once drunk, a flask becomes an **empty flask**, which the well fills again for nothing. So a
player who keeps their flasks only pays for them once, and the well is a reason to come home.

### Fields

**In the game.** Everything is done from the **fields manager**, one screen showing every plot in the village's
fields: buy, plant, harvest, and switch the farmhand and the crop broker. It opens at the field's entrance (top
right, where the path arrives) from the signpost or either of the two people standing there, or from any plot.

- **Buy it:** the first plot costs 100 shards and each one after costs twice the last (200, 400...).
- **Plant it:** potatoes (10 shards of seed, ready in an hour, 4 to 6 a harvest) or glowcaps (20 shards, three hours,
  2 or 3). Crops grow in real time, offline too. Only your own plots show your crops; the ones you don't own show a
  "for sale" sign, so every player sees just their own field.
- **Harvest it**, and take the crops to the inn: the innkeeper cooks root stew from three potatoes and glowcap tea
  from two glowcaps instead of charging shards, and packs two potatoes into a ration to take into the tower.
- Glowcaps going into potions waits for the arcanist's witchcraft room.

**Help on the field (decided, in the game).** Two people by the fields, both switched on and off at any of your plots:

- The **farmhand** brings in ripe crops and replants the same crop, paying the seed from your shards. Their wage is
  **40 shards a plot each day**, paid at the start of every 24 hours; if you can't pay, they leave. They work while
  you are in the tower or offline, and catch up the moment you are back.
- The **crop broker** sells every harvest for you, the farmhand's or your own, and keeps **a quarter**.
- Doing it yourself pays more: harvest by hand and sell at the food and drink stall at the full price (potatoes 4
  shards, glowcaps 15). Early on that is the better deal; later, the farmhand and the broker turn the fields into
  passive income while you spend your time in the tower.

With both hired, one potato plot nets about 80 shards a day and six about 480: a steady side income, below a good
run in the tower. Easy to tune with the wage, the cut and the crop prices.

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
6. Later, with their own features: the guild and its quests and party notices, the fields, the captains' quests.

## Decided

1. Online, the village is **shared**, in copies (channels) of about 30 players.
2. Quests are handed in at the guild or to their NPC, and a refresh removes them, finished or not.
3. Teleporting reaches visited safe points only.
4. The well is free; water needs a flask, and drunk flasks become empty flasks to refill.

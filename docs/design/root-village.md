# The root village

Status: proposal. Part of [world.md](world.md): the first village, at the roots of the tree, where every character
starts and comes home to. Nothing here is built yet.

![Plan of the root village: the Tower Gate in the roots to the north, the square with the well and notice board in the middle, the inn and stash to the north-west, the market stalls to the north-east, the forge to the east, the arcanist's hut to the west, the kingdom camps to the south-west, the training yard to the south-east and the closed fields gate to the south](img/root-village.svg)

## What it is

A small, hand-made village of about 48 × 32 tiles (three screens wide), walled in by the tower's roots. There is no
fighting anywhere in it: weapons stay sheathed, as in a safe room. Hunger and thirst don't drain here.

| Place | What's there | When |
|---|---|---|
| **Tower Gate** | the way into the tower: pick any floor you have reached | first |
| **The square** | where you arrive; the **well** (drink to fill your thirst, free) and the **notice board** | first |
| **Forge** | the **blacksmith**: enhancing now, forging from drops later | first |
| **Market stalls** | the **trader**: gear, potions, food and water; the regional market later | first |
| **Inn** | **meals** (fill hunger), and the **stash** | first |
| **Training yard** | dummies that show your damage per second, so you can test gear without risk | first |
| **Kingdom camps** | the three companies' tents; their captains say a line or two now and give quests later | first, as scenery |
| **Arcanist's hut** | shut, with a sign, until the arcanist's features exist | later |
| **Fields gate** | closed until farming exists | later |

## How it changes the loop

- **New characters start in the square**, not on floor 1. A short line from the notice board says where to go.
- **The Tower Gate** opens the same floor list as today's floor gate.
- **The floor gate** in each floor's start room gains **"Root village"** at the top of its list. Getting home is one
  step from any floor's entrance, which is where the return gate already takes you.
- **Dying** still wakes you in the last safe room on the floor, so a death doesn't cost the walk.
- **The blacksmith leaves the tower** (decided in world.md): enhancing happens only at the forge. Safe rooms keep
  the trader and gain the **stash**.
- **The stash** is the same everywhere: the inn, and every safe room. 60 slots to start.
- Saves remember the village as floor 0, so "continue" puts you back where you were.

## Online

The village is where online players meet, so it should feel like a town, not an empty room. Two ways to run it:

1. **Shared (recommended):** everyone online is in the same village, split into copies of about 30 players when it
   gets busy (the way MMOs open a second "channel"). Parties form there and leave together through the Tower Gate.
2. **Per party:** each party gets its own copy, like the floors do today. Simplest, but you never see anyone outside
   your party.

The server already runs every floor as its own world for one party. A shared village is one more kind of world that
holds many players and no enemies, so the work is mostly in sending each player only the people near them.

## Art

Everything in the floors is stone. The village needs its own set:

- **Tiles:** grass, dirt paths, the square's flagstones, root walls, water for the well.
- **Buildings** as large sprites: the inn, the forge, the market stalls, the arcanist's hut, three tents, the
  Tower Gate in the roots.
- **People:** the blacksmith and trader exist; an innkeeper and three captains are new.

All of it can be drawn by `tools/make_sprites.py` like the rest of the art, and swapped for finer art later through
the pixel ratio.

## Order of work

1. The map, its tiles and buildings, single player only: arrive, walk, enter the tower through the gate, come
   back through the floor gate.
2. The blacksmith moves there; enhancing becomes village-only; the inn's meals and the well.
3. The stash, in the inn and in every safe room.
4. Online: the village as a shared world (or per party).
5. The training yard and the kingdom camps' lines.

## Open questions

1. Online village: **shared** with channels of about 30 (recommended), or **per party**?
2. Should the arcanist's hut be **in the village now, shut**, or added only when the arcanist arrives?
3. Is a **free well** for thirst all right? Flasks still matter, since you can't take the well into the tower.

# The world: the tree, its villages, the economy and the story

Status: proposal. The owner's decisions are marked **Decided**. Everything else is a suggestion, open to change.
Nothing here is in the game yet. It changes where some existing things live (the blacksmith moves out of the
tower's safe rooms), so it should be settled before more floors are built.

## The picture

The Blackspire is a **world tree**. Its trunk is a dungeon of 100 floors. Villages sit on its leaves and branches,
one every 10 floors (**Decided**). The first village is at the roots, where everyone starts.

```
  floor 100   the crown: the Demon King
     ...
  floor 20    ── branch village 2 ── fields
     │ floors 11–19
  floor 10    ── branch village 1 ── fields
     │ floors 1–9
  floor 0     ── the root village ── fields         (start here)
```

The loop is **village → climb → bring home → forge, trade, cook, quest → climb higher**. The tower is where you get
things; the villages are where things turn into power or money.

The boss on every 10th floor is a **branch warden**. Beating it opens that floor's village and drops the
**runestone** for a skill slot ([class-trees.md](class-trees.md#skill-slots-and-the-ultimate)), so both milestones
land at the same moment.

## Places

### Villages (one per 10 floors)

| Who | What | |
|---|---|---|
| **Blacksmith** | forges gear from monster drops; enhancement; family gear (below) | **Decided** |
| **Arcanist** | mutations, skills and skill ranks, special passives on gear; forges grimoires | **Decided** |
| **Market** | buys and sells materials, drops and crops at prices that move | **Decided** |
| **Auction house** | players list gear for other players to bid on | **Decided** |
| **Quest board** | fixed quests and refreshing ones that ask for monster drops | **Decided** |
| **Stash** | the universal stash, reachable from every village and safe point | **Decided** |
| **Cook** | turns crops into food | suggested |
| **Kingdom camps** | the three kingdoms' companies: story, and quests | suggested |

Each village sells and buys a little differently: higher villages carry the recipes, seeds and stock for their
part of the tree. A return gate can take you to any village you have reached.

### Fields: safe ground for farming

**Decided:** fields around each village are safe zones where players grow crops, then cook or craft with them.

- **Suggested:** each player has their **own plots** in a field. Other players can walk through and see them, but
  only the owner plants and harvests, so nobody can grief anyone's farm online.
- Crops grow in **real time** (an hour to a day), including while you are offline or in the tower. That gives a
  reason to come home without forcing it.
- Each village's fields grow different crops, so higher villages give better food.
- **Food** gives a timed buff, one at a time: for example +5% health regeneration for 30 minutes. Food helps you
  climb, but you can climb without it.
- **Suggested:** potions become craftable from field herbs, with the trader's stock as the fallback. That gives
  farming a use for every player, not only those who enjoy it.

### Safe points inside the tower

**Decided:** they stay, limited to lower-level services: potions, buying and selling gear, and the universal
stash. Forging, the arcanist and the market are village-only, which is what makes going home worth it.

- **Suggested:** the stash is **per character**, with a shared tab between your own characters later.

## Economy

**Decided:** the game is free-to-play with **no microtransactions**.

### Two currencies

| | What it is | Where it comes from | What it's for |
|---|---|---|---|
| **Shards** | the everyday money of the whole world | every enemy, chests, selling | everything ordinary |
| **Heartstone** (suggested name) | a rare ore: sap the tree has hardened over centuries | quests, branch wardens, red gates, secret bosses | forging the rarest gear |

- Heartstone is not sold by NPCs. **Suggested:** players can trade and auction it, so it ends up with a price in
  shards, but the only way it enters the world is by playing.
- This replaces "premium currency": it's rare because of where it comes from, not because anyone pays for it.

### The market: commodities with moving prices

**Decided:** one shared market, simulated by the server, and it works the same in single player.

- **Suggested split:**
  - the **market** trades stackable things: materials, monster drops, crops, heartstone;
  - the **auction house** handles gear, because every piece rolls differently and has no single price.
- **Suggested price model.** Each commodity has a base price and a **demand index**:

  ```
  price      = base × clamp(1 + demand, 0.4, 2.5)
  sell price = 80% of the buy price         (the spread stops instant buy-low, sell-high loops)
  ```

  - Players selling a commodity push its demand down; players buying push it up.
  - Every hour, demand drifts back toward 0, plus a small random wobble, so a crashed price recovers.
  - **Events** move whole groups of goods for a few days, and the quest board explains them. For example, "The
    Iron Crown is arming for a push: iron and leather +40% this week."
  - Each village shows a 7-day price chart, which is the "like stocks" part.
- **Single player** runs the same model in your own save, with simulated traders moving the prices. Single player
  and online characters are already separate, so an offline market can't be manipulated from outside.

### Trading between players (online)

**Decided:** both direct trades and an auction house.

- **Direct trade:**
  - both players see both offers;
  - any change resets both confirmations;
  - both confirm, then the server swaps the items in one step.
- **Auction house:**
  - listings run for 12, 24 or 48 hours, with a starting bid and an optional buyout;
  - a **5% fee** when an item sells.
- **Against bots and abuse** (suggested):
  - trading opens at level 10;
  - every trade is logged on the server;
  - there's a cap on how many active listings one player can have.
- **Shard sinks** stop inflation, which is the usual way MMO economies die: the auction fee, enhancement, forging,
  class changes, respecs, stash upgrades, and the market spread.

## Enemies: families, and gear forged against them

**Decided:** drops from a family of monsters forge weapons and armour that deal more damage to that family, or take
less damage from it.

- Every enemy gets a **family** tag: undead, plant, spirit, beast, beast-man, greenskin, elf, knight, mage, dragon.
- **Suggested family gear:**
  - a **weapon** made from a family's drops gives **+15–25% damage** against that family;
  - **armour** from the same drops gives **10–20% less damage** from that family.
  - Both are worthless against everyone else, so they're tools you bring for a branch, not your main build.
- This gives lower floors' drops value long after you've left those floors.

**Suggested family ladder**, one or two families per branch. Floors 1–10 keep what's already built:

| Floors | Branch | Families |
|---|---|---|
| 1–10 | the Roots: crypts the tree grew over | undead, spirits, plants |
| 11–20 | the Wildwood | beasts: boars, wolves, giant insects |
| 21–30 | the Hollow | beast-men: werewolves, lizardmen |
| 31–40 | the Warrens | goblins, orcs |
| 41–50 | the Heartwood | ogres and giants; the story's midpoint |
| 51–60 | the Shade branches | dark elves |
| 61–70 | the Fallen Camps | knights and mages: the kingdoms' lost companies |
| 71–80 | the Ossuary | armoured skeletons: partly armoured at first, fully armoured above |
| 81–90 | the Bright branches | **heavenly** versions of lower families: light elves, gilded beasts |
| 91–100 | the Crown | dragons, and the Demon King |

Heavenly versions are a recolour plus one new mechanic each. That's cheap to make and reads well ("I know this
wolf, but it's glowing").

## Arcanist: gear passives

**Decided:** the arcanist handles mutations, skills and special passives for all gear. Gear is forged by the
blacksmith, except grimoires, which the arcanist makes.

- **Suggested:**
  - Rare and better gear comes with **sealed passive slots**: 1 for rare and epic, 2 for legendary.
  - The arcanist unseals a slot with the gear's family drops and shards, or heartstone for legendary gear. The
    passive is rolled from a list for that gear type, for example "+10% damage for 2 seconds after a dodge".
  - Unsealing again rerolls the passive.
- This moves skill ranks, respecs and class changes from the blacksmith to the arcanist in
  [class-trees.md](class-trees.md).

## Red gates and secret bosses

**Decided:** a red gate is a locked, harder version of a floor (a "double dungeon"). It opens when certain conditions
are met, not at random.

- **Suggested conditions**, a different one per red gate, hinted at by quests and notes found in the tower:
  - beat a floor's boss without drinking a potion;
  - clear every elite on a floor before entering the boss chamber;
  - carry a sigil forged from a secret boss's drop.
- **Inside:**
  - the return gate is sealed until the red boss dies;
  - online, it holds only your party;
  - it guarantees heartstone and has a chance at unique gear.
- **Secret bosses** live behind red gates. Their mutagens are the undiscovered rank 5 material from
  [class-trees.md](class-trees.md).

## Later

- **Transmog:** on hold until there's enough gear to dress up in. It's a natural job for the arcanist or a tailor.
  Keep it earned, from achievements and rare drops.
- **The dual-wield secret:** on hold (**Decided**).

## Story (draft)

Simple to tell, delivered in small pieces: a short intro, branch wardens' lines, quests from the kingdom camps,
and notes found in the tower. None of it blocks play.

> Every kingdom lives in the shade of the World Tree. Its roots drink from the deep, its leaves carry villages, and
> its hardened sap, heartstone, makes the finest steel there is.
>
> Thirty years ago its crown went black. Something took the top of the tree. The few knights who came back called
> it the Demon King, and since then the blight has crept down the trunk. Where it passes, the tree's own guardians
> twist into monsters. Two leaves have already withered and fallen, villages and all.
>
> The kingdoms answer the way kingdoms do: every day they send knights up the trunk, and every day they race each
> other. The old songs say the gear at the crown was made by gods. Whoever brings it home rules what's left.
>
> The tree has its own answer. When it is dying, it calls people from other worlds. You wake among its roots with a
> name and nothing else.

**The arc** (one act per few branches):

1. **The Roots (1–10).** You learn the tower beside three kingdoms' companies:
   - the **Iron Crown** (soldiers),
   - the **Sun Choir** (priests and healers),
   - the **Gilded League** (merchants and mercenaries).

   Each camp gives quests and has a captain who is always a floor or two ahead of you.
2. **The race (11–50).** The companies thin out. You find their camps abandoned, then their dead. Climbers who
   carry too many mutagens start to change, and mutations are the blight working through you: power with a cost.
3. **The fallen (51–90).** The knights and mages of floors 61–70 are the lost companies, turned. One of the
   captains you climbed beside is a branch warden.
4. **The crown (91–100).** The Demon King is the **first person the tree ever called**. Thirty years ago they
   reached the crown and took the tree's heart, and the power made them what they are. The tree has been calling
   again ever since, and you are its second attempt.

   At the top, the gear made by gods is the heart itself. Kill the Demon King and you hold it. What you do with it
   is the ending, and the endgame.

The twist ties the systems together: god-level gear, mutagens and the blight are the same thing, and climbing is
how the tree tests whether the next person can carry it.

## Priority

Recommended order, with reasons:

1. **The root village as a hub.**
   - A walkable village map, the tower entrance, and travel by return gate.
   - The blacksmith moves there; safe points become trader and stash.
   - The universal stash.
   - Every other system lives in a village, so building them before it means moving them later.
2. **Forging from drops, and enemy families.**
   - Recipes at the blacksmith, family tags on the existing enemies, the first family gear.
   - Forging is the core verb of the pitch ("use monster drops to forge powerful gear"), and today gear only
     drops or is bought.
3. **The market and the quest board.**
   - Drops become worth shards and heartstone, and the quest board explains market events.
   - Works the same in single player and online.
4. **The arcanist.**
   - Skill ranks, class trees and mutations (already designed), and gear passives.
5. **Floors 4–10, the first branch warden, and the first branch village.**
   - Act 1 of the story goes in here. New floors can be built alongside steps 2–4 whenever content is needed.
6. **Player trading and the auction house.**
   - Online only. It needs a working economy and its anti-abuse rules first.
7. **Fields, farming and cooking.**
   - A full second loop. Valuable, but separate from climbing, so it waits until the climb is solid.
8. **Red gates, secret bosses, transmog, and later branches.**

## Open questions

1. Should the rarest gear (heartstone gear) be **tradeable, or bound to you once equipped**? Bound keeps it meaning
   "I earned this" and stops a few rich players from buying out the top. Tradeable is freer.
2. Personal plots in shared fields, as suggested, or fully shared fields?
3. Should a character's online and single player progress stay separate (as today), with separate markets?

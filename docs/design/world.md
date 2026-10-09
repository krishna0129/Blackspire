# The world: the tree, its villages, the economy and the story

Status: proposal. The owner's decisions are marked **Decided**. Everything else is a suggestion, open to change.
**In the game** so far: the trader, hunger and thirst, and trader stock limits. Everything else here is not built
yet. It changes where some existing things live (the blacksmith moves out of the tower's safe rooms), so it should be
settled before more floors are built.

**Decided, platform:** the game targets **web browsers on a computer** (keyboard and mouse) for now. Phones and
tablets are not a goal yet, so new features don't need touch controls or small-screen layouts.

**Decided, characters:** online and single player characters stay **separate**. An online character can be
**imported into single player** to save time, never the other way, so nothing made offline can reach the online
world.

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
| **Adventurers' guild** | take and hand in quests, collect rewards, post notices for party mates | **Decided** |
| **Quest board** | every quest in the region; the whole board refreshes once every 24 hours | **Decided** |
| **Stash** | the universal stash, reachable from every village and safe point | **Decided** |
| **Cook** | turns crops into food | suggested |
| **Kingdom camps** | the three kingdoms' companies: story, and quests | suggested |

Each village sells and buys a little differently: higher villages carry the recipes, seeds and stock for their
part of the tree. A return gate can take you to any village you have reached.

### Fields: safe ground for farming

**Decided:** fields around each village are safe zones where players grow crops, then cook or craft with them.

- **Decided:** fields are **personal**. Everyone has and sees only their own plots, and nobody can enter anyone
  else's field. Online, a field is a private copy per player, the way a red gate is a private copy per party.
- **Decided:** plots are **bought**, and each village grows only **one or two crops** (its soil is rich in one or two
  nutrients). See [root-village.md](root-village.md#fields).
- Crops grow in **real time** (an hour to a day), including while you are offline or in the tower. That gives a
  reason to come home without forcing it.
- Each village's fields grow different crops, so higher villages give better food.
- **Cooked food** fills the hunger and thirst meters (below), and better dishes also give a timed buff, one at a time:
  for example +5% health regeneration for 30 minutes. Field food is how a player stops depending on the trader's
  small stock.
- **Suggested:** potions become craftable from field herbs, with the trader's stock as the fallback. That gives
  farming a use for every player, not only those who enjoy it.

### Safe points inside the tower

**Decided:** they stay, limited to lower-level services: potions, buying and selling gear, and the universal
stash. Forging, the arcanist and the market are village-only, which is what makes going home worth it.

- **The trader (decided, in the game):** a travelling merchant under a pack almost as big as they are. They sell gear,
  potions, food and water. Each supply is limited to **5–10** per trader in single player, refilled when the floor's
  boss falls; online numbers come later.
- Until villages exist, the blacksmith stays in safe rooms next to the trader, for enhancing only.
- **Suggested:** the stash is **per character**, with a shared tab between your own characters later.

### Hunger and thirst

**Decided, in the game:** survival meters as in Minecraft or Rust. Health still comes back with potions; food and
water keep the meters up.

- Both meters run from full to empty while you are on a floor: hunger in about **25 minutes**, thirst in about **15**.
- **Below 25%:** hungry means no natural healing and 10% slower; thirsty means half mana regeneration. The meter
  flashes on the HUD and the log says what to do.
- **Empty:** each empty meter costs 1% of your max health every second, so starving is a slow death, not a sudden one.
- **Rations** (R) fill 40% of hunger; **water flasks** (T) fill 50% of thirst. They come from traders, enemies,
  chests and bosses. New characters carry 2 of each.
- Dying wakes you at least half fed and half watered, so nobody gets stuck starving in a loop.
- Later, cooked food from the fields replaces rations as the main source.

## Economy

**Decided:** the game is free-to-play with **no microtransactions**.

### Two currencies

| | What it is | Where it comes from | What it's for |
|---|---|---|---|
| **Shards** | the everyday money of the whole world | every enemy, chests, selling | everything ordinary |
| **Mythril ore** (decided) | the rarest ore, found deep in the tree | quests, branch wardens, red gates, secret bosses | forging the rarest gear |

- **Decided:** mythril ore can be traded and auctioned, so it ends up with a price in shards. NPCs never sell it: the
  only way it enters the world is by playing.
- **Decided:** **mythril-grade gear needs level 50** to use. It isn't meant to arrive any time soon, so early players
  can hold or trade the ore, but not wear what it makes.
- This replaces "premium currency": it's rare because of where it comes from, not because anyone pays for it.

### The market: one pricing rule, from what the NPCs hold

**Decided:** keep it simple. One general rule sets every price, and it is the same code in single player and online.
Anti-abuse rules go in before anything else.

- **Decided:** a price depends only on how much of a good the **NPCs** hold: every blacksmith, arcanist and trader,
  added together. What players carry in their bags or stash, or list at auction, doesn't count.
- **Decided:** prices move **while players trade**, like villager trades in Minecraft. Every purchase takes from the
  NPCs' total, so the next one costs a little more; every sale adds to it, so the next sale pays a little less.
- **Decided:** stock is pooled **per region** (a village and its part of the tree), so prices differ between villages
  and players can choose where to sell for the most.
- **Suggested rule**, per good, per region:

  ```
  NPC stock  = what all the blacksmiths, arcanists and traders in the region hold together
  price      = base × clamp(normal stock / NPC stock, 0.5, 2)
  sell price = 80% of the buy price         (the spread stops instant buy-low, sell-high loops)
  ```

  For example, if the region's traders normally hold 100 water flasks and players have bought 50 of them, flasks
  cost twice the base price until the traders restock.
  - Every hour each NPC's stock drifts back toward normal (they use some and make some), so prices recover.
  - The same good can cost different amounts in different villages: goods from the Wildwood are cheap near the
    Wildwood and dear at the roots.
  - The price shown is always the price paid: the screen updates after every purchase or sale, so a player buying
    ten of something sees it climb as they go.
- Single player keeps the NPCs' stock in the save. Online, the server keeps one shared stock for everyone, which means
  players compete for what a trader holds; the online stock sizes are still to be set.
- **Anti-abuse, first:**
  - the spread, and the 0.5–2× clamp, so no single sale or purchase can swing a price far;
  - a per-player limit on how much of one good the NPCs of a region take from them each hour;
  - everything goes through the server online (it already decides every action), and every sale is logged.
- The **auction house** handles gear, because every piece rolls differently and has no single price. The market
  takes stackable things: materials, monster drops, crops, mythril ore.

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
  - The arcanist unseals a slot with the gear's family drops and shards, or mythril ore for legendary gear. The
    passive is rolled from a list for that gear type, for example "+10% damage for 2 seconds after a dodge".
  - Unsealing again rerolls the passive.
- This moves skill ranks, respecs and class changes from the blacksmith to the arcanist in
  [class-trees.md](class-trees.md).

## Red gates and secret bosses

**Decided:** a red gate is a locked, harder version of a floor (a "double dungeon"). It opens when certain conditions
are met, not at random.

- **Decided:** the next floor has a **40% chance** to be a red gate when a player clears a floor too easily, in one of
  two ways:

  | Condition | What it takes | Red gate |
  |---|---|---|
  | **Untouched boss** | you may be hit on the floor, but you kill its boss without being hit once in the fight | red gate boss A |
  | **Untouched floor** | you kill **every enemy on the floor**, boss included, without being hit once | red gate boss B |

  Killing every enemy matters for the second: skipping rooms doesn't count.
- **Decided:** the condition that opened a red gate decides **which boss** waits inside. The untouched-floor boss
  should be the harder one, with the better loot, since it asks far more.
- **Decided:** in a party, both conditions are **party-wide**: one hit on anyone breaks it for everyone. They are
  meant as solo feats, and a solo player has the easiest time meeting them. Conditions built around a whole party
  come later.
- How "hit" is counted: any damage that reaches you. A dodged, evaded or fully blocked blow is not a hit. Thorns,
  hunger and thirst don't count either, since nothing attacked you.
- **Suggested conditions for later**, hinted at by quests and notes found in the tower:
  - beat a floor's boss without drinking a potion;
  - clear every elite on a floor before entering the boss chamber;
  - carry a sigil forged from a secret boss's drop.
- **Inside:**
  - the return gate is sealed until the red boss dies;
  - online, it holds only your party;
  - it guarantees mythril ore and has a chance at unique gear.
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
> its heartwood holds mythril, the finest ore there is.
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
   - Drops become worth shards and mythril ore, and the quest board gives them a second use.
   - Works the same in single player and online.
4. **The arcanist.**
   - Skill ranks, class trees and mutations (already designed), and gear passives.
5. **Floors 4–10, the first branch warden, and the first branch village.** (**Decided:** agreed.)
   - Act 1 of the story goes in here. New floors can be built alongside steps 2–4 whenever content is needed.
6. **Player trading and the auction house.**
   - Online only. It needs a working economy and its anti-abuse rules first.
7. **Fields, farming and cooking.**
   - A full second loop. Valuable, but separate from climbing, so it waits until the climb is solid.
8. **Red gates, secret bosses, transmog, and later branches.**

## Open questions

1. Online stock sizes for traders, now that online stock is shared between players (to set when online gets its pass).

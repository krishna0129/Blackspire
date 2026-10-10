# The world: the tree, its villages, the economy and the story

Status: proposal. The owner's decisions are marked **Decided**. Everything else is a suggestion, open to change.
**In the game** so far: the root village, the trader and the stash, hunger and thirst, the fields, enemy families
and forging, and the exchange. Each section says what of it is built; everything else is not built yet.

**Decided, platform:** the game targets **web browsers on a computer** (keyboard and mouse) for now. Phones and
tablets are not a goal yet, so new features don't need touch controls or small-screen layouts.

**Decided, characters:** online and single player characters stay **separate**. An online character can be
**imported into single player** to save time, never the other way, so nothing made offline can reach the online
world.

**Decided, scope:** the target for now is a game for **3 or 4 friends on one server**. It is not being published
for now; that is a question for later, if the game turns out well. So rules against abuse by strangers are not a
priority, and what exists (village channels, the exchange's selling limit) stays as it is.

**Decided, order of work:** adding systems is **paused**. The **visual overhaul comes first**; movement and combat
are to be redesigned after it (the playstyle is still being chosen). The **skill system will be redesigned from
scratch** once the playstyle is settled, so [skill-trees.md](skill-trees.md) and [class-trees.md](class-trees.md)
are on hold, and mutagens may not be part of the new one. Single player is built first, and every rule
keeps running on the server so the online game follows.

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
  else's field. Online, a field is a private copy per player.
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
  boss falls; online numbers come later. The village's stalls refill whenever any floor's boss falls, and once a day.
- **In the game:** the blacksmith has left the tower for the village's forge. Each safe room holds a trader and a
  **stash chest**; the stash (60 slots) is one store, the same behind every chest, the inn's included.
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

## What happens once, and what comes back

**Decided, not built yet.** The world follows the anime: it is one shared place, and some things in it happen once.
Today's game does the opposite in several places (listed at the end of this section), so this is a change to make
when work on systems resumes.

- **Floor bosses never respawn.** A boss is killed once for the whole world, and the next floor opens for everyone.
  - **First-kill rewards belong to the team that cleared it**, and to nobody else, ever.
- **Monsters respawn** after a regular window. There is **no protection against camping** a spawn or a hunting
  ground: whoever is there hunts it.
- **Limited-time events** (later) bring bosses back to be fought for their **monster drops only**: no first-kill
  rewards. A player can fight a boss they have already beaten, or one they have not, if they meet its level
  requirement.
- **Chests:** no chest stands in the open. They are found only **deep inside dungeons** and in **hidden or secret
  rooms**, which also leaves room for trapped chests later.
  - A chest is **shared by all players: opened once for the whole world**. Opened by someone in a party, its
    contents are given to every member of the party.
- **Rewards come from quests**, for now. **Weapons and gear are crafted** from monster drops.
  - Finished gear can still drop, rarely: **under about 5% from common monsters, under about 15–20% from bosses**.
- **Hidden bosses** are **never part of the limited-time events**. Some floors have one, in a chamber under the
  boss room; it gives a one-of-a-kind item and comes back only about once in six months: see
  [Hidden bosses](#hidden-bosses).

**What this replaces in today's game**, to be reworked together:

- Each party gets a fresh copy of a floor, and enemies and the boss are back on every arrival. Floors become
  persistent: one copy for the world, which remembers its dead boss, its opened chests and its respawn timers.
- Chests stand in about 40% of ordinary rooms, and every player opens each one for themselves.
- Monsters drop finished gear 13% of the time, elites 70%, and a boss always drops three pieces.
- Forging only makes Rare gear against one family. As the main source of gear it needs plain gear, tiers by floor
  and a way to better rarities.
- The guild's daily bounty ("defeat the boss of floor N") cannot exist once bosses stay dead.
- The village stalls restock when any boss falls; only the daily restock remains.
- Spire crystals come almost only from bosses and are needed to enhance past +6. With one kill per boss they need
  another source: the events, the exchange, or something new.

**Open:**

- The gear-drop chance for elites, between the two figures above.
- What a floor boss's first-kill reward is. Decided so far: the party that lands the last hit gets more than the
  others ([Bosses are for parties](#bosses-are-for-parties)).

## Economy

**Decided:** the game is free-to-play with **no microtransactions**.

### Two currencies

| | What it is | Where it comes from | What it's for |
|---|---|---|---|
| **Shards** | the everyday money of the whole world | every enemy, chests, selling | everything ordinary |
| **Mythril ore** (decided) | the rarest ore, found deep in the tree | quests, branch wardens, hidden bosses | forging the rarest gear |

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
  takes stackable things: materials, monster drops, mythril ore.
- **Decided:** only the exchange's prices move. **Crops are not traded on it**: they are sold to the inn and the
  food stall for income, or cooked. The **other stalls keep fixed prices**.

**In the game** (`MARKET` in `js/sim/data.js`, the rules in `js/sim/market.js`; the numbers are on
[the wiki's market page](../wiki/market.md)):

- **The exchange**, a desk at the bottom of the root village's market, buys and sells the three enhancement
  materials and the four monster drops. The rule is the one above: `base × clamp(normal stock / stock, 0.5, 2)`,
  selling at 80%, one unit at a time, so a bulk trade walks the price as it goes.
- Each hour a stock moves a tenth of its normal size back toward normal.
- One seller can sell half a good's normal stock per hour. The count is kept per character.
- Single player keeps the stock in the save. Online, one server keeps one stock for the root village, shared by
  every channel and kept in its database, so players move each other's prices. A trade names the price the player's
  screen showed, and the server refuses it if the price has moved against them since.
- The guild's daily board now asks for one enhancement material and one monster drop, and pays 30% over the usual
  price, where the exchange usually pays 80% of it.

- **Decided:** these prices and stock sizes are fine for a first version.

Not built yet:

- **A second region**, and so prices that differ between villages, waits for the first branch village.
- **A log of sales** for the server's owner, and **mythril ore**, which nothing drops yet.

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
- **Decided, PvP with stakes:** a fight between players can carry a **deal**. Players bet on who wins, and choose
  which loot they are willing to stake.
  - *Suggested:* the server holds every stake from the moment both sides accept until the fight ends, then hands
    the lot to the winner, so nobody can back out or log off with it.
  - *Suggested:* duels use the anime's modes (first clean hit, or first to half health), so a wager never needs
    anyone to die.
  - A one-of-a-kind item can be staked like anything else, and changes hands if lost.
  - *Open:* whether onlookers can bet on a fight they are not in.
- **Shard sinks** stop inflation, which is the usual way MMO economies die: the auction fee, enhancement, forging,
  class changes, respecs, stash upgrades, and the market spread.

## Enemies: families, and gear forged against them

**Decided:** drops from a family of monsters forge weapons and armour that deal more damage to that family, or take
less damage from it.

**In the game** (`FAMILIES` and `FORGING` in `js/sim/data.js`; the numbers are on
[the wiki's forging page](../wiki/forging.md)):

- Four families so far: **spirits** (floor 1's shades, skitters, brutes and wisps, and the Gate Warden), the
  **undead** (the skeletons, thralls and Gravecallers, the Bone Regent and the Pale Collector), **plants** (Thornroot,
  Bloodbloom) and **beasts** (only the Ossuary hermit until the Wildwood). A new family is one row in `FAMILIES`, one
  in `MATS`, and a `fam` on its monsters.
- Each family has one drop: Shade essence, Old bone, Thornwood, Chitin plate. Ordinary monsters drop it 30% of the
  time, elites 2–3, bosses 6–8. Monsters that are tough and rare for their family roll better (Thornroot, hermit).
- The **blacksmith** forges weapons (+15–25% damage to the family), armour (10–20% less damage from it) and boots
  (5–10%, adding to the armour's). The **arcanist** makes the grimoires. A forged piece is always Rare at the item
  level of the highest floor reached, costs 12 / 10 / 6 drops plus scrap and shards, and returns a third of the drops
  when salvaged. Trinkets are not forged.
- All "% more damage" now adds in one bucket (the fix skill-trees.md asked for), so a family weapon does not multiply
  with Giant-slaying, Executioner's or Sunder.

Still open: whether the bonus should grow with enhancement, family gear above Rare (mythril ore for the rarest), and
whether beasts need a second floor-1-to-3 monster before the Wildwood.

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

### Brewing potions from monster drops

**Decided, not built yet:** monster drops can also be brewed into potions by the arcanist, at the witchcraft room's
cauldron. This gives every family's drop a third use, after forging and selling.

- Brewed potions give **buffs**, not health. The first ideas:
  - **physical defence** for a while;
  - **magical defence** for a while;
  - a temporary **physical damage** or **magic damage** boost;
  - and others in the same spirit: a wider variety is the point.
- Still to work out when this is built:
  - which family's drop makes which potion (the natural link is by family: a potion against, or from, what the drop
    came from), and what else a recipe needs: shards, glowcaps from the fields, emberstone;
  - how long a buff lasts, and whether it shares the one buff slot the inn's meals use or gets its own;
  - how many you can carry, and whether the potion stall sells any ready-made;
  - "magical defence" needs enemy attacks to be marked physical or magical first. Today only the player's own magic
    is told apart (enemies' `mres`).

## Bosses are for parties

**Decided:** bosses become **much harder**. Today one player can beat a floor boss alone in three or four minutes;
the game is meant to push players to **form parties** to take bosses on. The numbers and mechanics are set with the
new combat.

- **Decided:** when a boss falls, **the party that lands the last hit gets more than the others**, and **the player
  who lands the last hit gets the one-of-a-kind item**, where there is one. It does not go to the whole party.
- *Suggested:* make the difficulty come from mechanics that need more than one player, not from a bigger health
  bar alone, which only makes a fight longer:
  - something to intercept while someone else holds the boss (the Pale Collector's thralls already work this way);
  - openings that only a second player can use (the anime's "switch");
  - a way to get a fallen ally back on their feet inside the fight, so one death is a setback and not the end;
  - a time limit after which the boss hits much harder, sized for a full party's damage.
- **Open: single player.** If bosses need a party, a lone player cannot climb. *Suggested:* in single player, and
  when friends are offline, fighters can be hired from the kingdom camps to fill the party. The story already puts
  the three companies in the tower beside you.
- **Known consequence:** a prize for the last hit means players will hold back their strongest blow for the end,
  and healers and shield-bearers will rarely win it. That is true to the anime; it is noted so it is a choice.

## Hidden bosses

**Decided. This replaces everything decided earlier about red gates and secret bosses** (the 40% chance, the two
"untouched" conditions and their two bosses, a private copy per party, and the later 20% chance after an untouched
floor). Red gates and hidden bosses are now **one and the same thing**.

- A **secret, optional boss sleeps in a hidden chamber** under the floor's boss room. **Only some floors have one.**
- The way in is a **trapdoor in the boss room**. It stays **sealed until the floor's boss has been defeated**. After
  that, when a player steps on it, their **whole party is taken into the secret chamber**.
- **There is no exit.** Either the hidden boss dies or you do, and dying there costs **some of the loot you carry**.
- If **everyone inside dies, the boss heals to full**.
- **Respawn:** a hidden boss comes back about **once every six months**. It gives its drops once, then goes back on
  its timer. (This replaces "killed once, gone for good", so that an item whose holder stops playing is not lost to
  the world for ever.)
- It gives **unique gear**. The **player who lands the last hit** gets it.
- **A unique item is one of a kind.** It cannot be replicated: not forged, not copied.
  - It can be **traded** or **auctioned**, and **staked** in a duel.
  - It is **dropped on death** if its holder was carrying or wearing it.
  - It **cannot be salvaged or destroyed**.
  - It **can be enhanced, but not without limit**, and the **chance of failure rises in step with the number of
    enhancements already on it**. The aim is a unique that stays worth using for **about the next ten floors**
    (an estimate).
- Hidden bosses are never part of the limited-time events (decided earlier, still true).

**The trapdoor: suggestions** (asked for; none decided):

- **Hard to see, not invisible.** Before the boss dies it looks like any other flagstone. Afterwards it has one
  small tell (a hairline seam, dust that falls now and then, a faint draught). First-timers walk onto it; players
  who know what to look for can choose to.
- **Who goes down:** party members who are **in the boss room** when it opens. A member in the village or elsewhere
  on the floor is not pulled in, and cannot follow.
- **A few seconds of warning.** The floor cracks and shakes for two or three seconds before it gives way, so the
  rest of the party can step on, or the one who triggered it knows what is about to happen. Stepping off does not
  stop it.
- **The boss sleeps until someone comes close or strikes it.** The party lands at the far end of the chamber and
  gets a moment to see what they have walked into, heal and set up. There is still no way out.
- **One party at a time.** While a party is inside, the trapdoor is sealed to everyone else.
- **Leaving the game inside counts as dying there.** Otherwise logging out is the exit.
- **Tuned well above its floor**, about as far above as its reward: if the item is worth ten floors, the fight
  should be a floor-plus-ten fight. A party that finds it early will probably die; one that comes back many floors
  later wins an item that is merely level with what they already have. That keeps the reward honest without any
  level cap on who may enter.
- **Which floors:** no pattern a player could count (not "every fifth"), and never the same spot in the room, so
  knowing one floor's secret does not give away the next.
- **What a death there costs:** *suggested* a share of the materials and monster drops carried, plus any unique
  being carried. What is lost **stays in the chamber**, and the party that finally kills the boss takes it. That is
  where a dropped unique goes when its holder dies down there.

**Open, to settle before it is built:**

1. **Six-month respawn against "one of a kind".** If a respawned boss drops the same unique while the first still
   exists, there are two. *Suggested:* each hidden boss has one item. It drops it again only if the item has left
   the world (its holder has not played for those six months, and the item returns to the boss). Otherwise the
   rematch pays in rare materials.
2. **How strong a unique is.** "Worth using for the next ten floors" now sets it: about the strength of gear ten
   floors on. With today's item levels that is about 3 times a forged piece of its own floor in base stats on
   floor 1, 2.5 times on floor 3 and 1.7 times on floor 10, plus one effect nothing else has. This replaces "orders of magnitude" unless that was meant literally.
3. **Dying with a unique outside a hidden chamber:** where it falls, and who may pick it up.
4. **Several parties** are implied by "the party that lands the last hit". Parties are four players today and each
   fights alone; boss fights that take more than one party are a feature of their own.

**No longer a question:** the skill system is to be redesigned from scratch once the playstyle is chosen, and
mutagens may not survive it, so the "rank 5 needs a hidden boss's mutagen" problem is dropped (see the notes at the
top of [class-trees.md](class-trees.md) and [skill-trees.md](skill-trees.md)).

## Later

- **Transmog:** on hold until there's enough gear to dress up in. It's a natural job for the arcanist or a tailor.
  Keep it earned, from achievements and rare drops.
- **The dual-wield secret:** on hold (**Decided**).
- **Records:** fastest floor clear and fastest boss kill, per character and, online, per server, in the spirit of
  The King's Avatar. **On hold (decided)** until every gameplay feature is in: a record only means something once
  the classes, skills and gear it was set with have stopped changing.

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

**Paused (decided):** no new systems until the visual overhaul and the new movement and combat are in. The order
below is for when that work is done, and the arcanist's trees wait for the new combat in any case.

Recommended order, with reasons:

1. **The root village as a hub.**
   - A walkable village map, the tower entrance, and travel by return gate.
   - The blacksmith moves there; safe points become trader and stash.
   - The universal stash.
   - Every other system lives in a village, so building them before it means moving them later.
2. **Forging from drops, and enemy families.** (**In the game.**)
   - Recipes at the blacksmith, family tags on the existing enemies, the first family gear.
   - Forging is the core verb of the pitch ("use monster drops to forge powerful gear"), and today gear only
     drops or is bought.
3. **The market and the quest board.** (**In the game:** the exchange for materials and monster drops, and
   deliveries of monster drops at the guild. Mythril ore is still to join.)
   - Drops become worth shards and mythril ore, and the quest board gives them a second use.
   - Works the same in single player and online.
4. **The arcanist.**
   - Skill ranks, class trees and mutations (already designed), gear passives, and brewing buff potions from
     monster drops.
5. **Floors 4–10, the first branch warden, and the first branch village.** (**Decided:** agreed.)
   - Act 1 of the story goes in here. New floors can be built alongside steps 2–4 whenever content is needed.
6. **Player trading and the auction house.**
   - Online only. It needs a working economy and its anti-abuse rules first.
7. **Fields, farming and cooking.**
   - A full second loop. Valuable, but separate from climbing, so it waits until the climb is solid.
8. **Hidden bosses, transmog, and later branches.**

## Open questions

1. Online stock sizes for traders, now that online stock is shared between players (to set when online gets its pass).

# Roadmap: what is still to be decided

This lists the **decisions** still open on features that exist or are designed, not the building work. The design
documents hold the detail ([docs/design](design)); this is the list to work through, in order.

## The milestone

**First friends' playtest:** 3 or 4 players on a hosted server, floors 1 to 3 polished, the new combat, two or three
skills per class, chest and boots gear on the hero with weight. No new systems are started until it is reached. New
ideas go into the backlog (end of this file) the moment they come up, and are looked at after the playtest.

**Done** means, for this milestone: a friend plays floor 1 for twenty minutes and wants to go on.

Each item below is marked **Before** (needed for the playtest) or **After**.

## 1. Combat and movement (decided: [combat.md](design/combat.md))

Decided: mouse aiming, slower while attacking; the dash without invulnerability (no roll); stamina for dashing and
blocking; parries with shields and swords; hit reactions; poise (from armour weight) and focus (from Mind), and a
poise bar on enemies; mana for every skill, a free basic attack, skills that empower it, mana potions; potions in
sizes; quick slots 1 to 4 by category; four skill slots on Q E C X (Valorant's keys), interact on F; ground markers for area attacks only; death loses everything carried but
equipped gear, with no grave.

Still open:

- Class balancing: decided ([classes.md](design/classes.md)): roles, base health, mana, stamina, dash, who parries
  (shields, swords and daggers), gear healing at most 10% of a Templar's; starting attributes in detail later.
- **Before:** the numbers (parry window, stamina, poise, focus, stagger), through the balance runner.

## 2. Skills and the boards

Decided ([skills.md](design/skills.md#the-playtests-skills-decided)): four slots on Q E C X, X the ultimate; each class
picks three of 4 to 7 everyday skills and one of three ultimates; empowered attacks for the melee classes and the
Templar; the Templar's full healing kit (heal, party heal, healing over time, a shield, revive); variations at full
counts, shown in the playtest through debug mode.

- **After:** whether forged gear can carry a skill of its family.
- **After:** the class and weapon proficiency.
- **After:** holy damage as a new type, and the faith skills that deal it.

## 3. Gear ([gear.md](design/gear.md))

Decided for the playtest: all five armour slots (one type per weight for head, hands, legs and feet, all nine chest
types), all 37 sets (type looks with each set's colours and emblem), drop rates, today's gear growth, and a wipe of
characters. Weight is now 1.5% faster fatigue per point above 4.

- **Before:** approve the rarity look ladder on one type (the longcoat) before the rest are made.
- **After:** a bonus at three pieces of a set, or full set only.
- **After:** more types per slot; weapon types beyond one per weapon kind; what trinkets do.
- **After:** the super-rare boss drops' rates, and a pity rule or none ([floor-3.md](design/floor-3.md)).
- **After:** lighter gear from rarity and materials.

## 4. Multiplayer for 3 or 4 (decided: [multiplayer.md](design/multiplayer.md))

Decided: the server on the home PC over Tailscale (online down when it's off), a real-internet test with one friend
first; ordinary drops personal, Epic, Legendary and boss drops first to grab; experience shared within a screen;
ordinary enemies +50% health per extra player; falling is death, undone only by a Templar's Revive within about 15 s;
no friendly fire outside agreed duels; party bars, allies on the minimap, pings, chat on Discord.

- **Before:** the ping's key, how duels are offered, the Revive's reach.

## 5. Bosses and floors

Decided ([bosses.md](design/bosses.md)): 5 to 8 minute fights alone, 8 to 10 in a party; phases per boss (three for
each of the playtest's three); every boss reads, marks, must be parried (or dashed) and has a poise bar; an enrage per
boss; a wipe resets the boss; +80% health per extra player, and a party-splitting mechanic from three players; a safe
room with a stash and a trader before every boss; the three bosses' phases.

- Decided: floor 1's spirits and floor 3's roots and hermits get models of their own ([look.md](design/look.md)).
- **After** ([world.md](design/world.md), open questions): a floor boss's first-kill reward; how often a rematch can
  be fought; whether a newcomer must beat a boss to go up; what limited-time events are for.
- **After:** floors 4 to 10 and the first branch village.
- **After:** the hidden bosses' open points.

## 6. The character (decided: [look.md](design/look.md))

Decided: a 3D creator (skin, hair style and colour, face and eyes, two body types); uploaded sprite sheets dropped;
Common starting gear of the class's weight; skeletons get the tall build too.

## 7. The look and the sound (decided: [look.md](design/look.md))

Decided: style C (gritty grade and ink outlines); coat tails and capes swing; 128-pixel icons; combat, world,
interface sounds and music from free CC0 packs.

- **Before:** which sound packs (the owner fetches them).
- **After:** the slowest computer the game must run well on, measured on friends' machines.

## 7b. Settings (After)

- A settings screen: key bindings players can change, plus the graphics and sound choices that today sit in the Gear
  panel.

## 8. Economy and the village (After)

- Mythril ore, the second currency, still to join.
- Online trader stock sizes.
- Trading between players and the auction house.
- The arcanist's gear passives and brewing (decided, not built).
- Held: the bard, inn room upgrades and the trophy shelf, a mailbox.

## 9. Story and quests

- Decided: a light touch in the playtest: an opening line at the gate, the guild's bounties, a few villagers' lines.
- **After:** how much more of the story draft the game tells, and how.

## Suggested order of the talks

1. ~~Combat and movement (1)~~ and ~~the bosses (5)~~ (decided).
2. ~~Class balancing (1)~~ and ~~skills (2)~~ (decided).
3. ~~Multiplayer for 3 or 4 (4)~~ (decided).
4. ~~Gear for the playtest (3)~~ (decided).
5. ~~The character creator, the look and the sound (6, 7)~~ (decided).

**Everything needed before the playtest is decided**, apart from small details listed above, which are settled as
the [build plan](build-plan.md) reaches them.

## Backlog

Ideas that come up before the playtest go here, untouched until after it.

- An invulnerable dash, as a set bonus.

# Combat and movement

Status: **decided, not built yet** (except where a line says it is in the game). Bosses are designed next; the
numbers wait for the balance runner ([skills.md](skills.md#the-balance-runner)). Part of the road to the first
friends' playtest ([roadmap](../roadmap.md)).

## Decided

### Aiming and moving

- **Attacks and skills go toward the mouse.** WASD moves, the mouse aims, the left button attacks. (Today attacks go
  the way you face, which means moving to aim.)
- **Attacking slows you**: you keep moving while you swing, slower.

### The dash

- The dodge is the **dash** (Shift). There is no roll; the gear design's "roll" penalty is a shorter dash.
- **No invulnerability** while dashing: it moves you out of the way, nothing more. Invulnerable dashes may come later
  as a set bonus.
- **Mages and healers dash shorter.** How far each class dashes is part of the class balancing (below).

### Stamina, blocking and parrying

- A new bar, **stamina**. Dashing and blocking cost it. It comes back quickly while you walk or stand, and slower
  while you do anything else (attack, cast, block).
- **Blocking**: hold block to take less from blows in front of you, paying stamina for each blow (today it costs
  mana, and needs a shield).
- **Parrying**: block just before a blow lands (about 0.2 s, to tune) and it does nothing, and the attacker is
  staggered: about a second for ordinary enemies, much less for bosses.
- **Who can parry**: shields (bucklers and heavy shields) and swords (longswords and greatswords). Daggers, spears,
  maces without a shield, bows and grimoires cannot.

### Hits, poise and focus

- **What a hit does to you**:

  | Hit | Reaction |
  |---|---|
  | physical | a slight knockback |
  | heavy physical | knockback and a stagger |
  | magic | knockback |

- **Any hit can interrupt** what you are doing (a swing, a cast) unless you resist it:
  - **Poise** resists physical interruption. It comes from **armour weight**: the heavier the gear, the more poise
    ([gear.md](gear.md#weight)), one more reason to carry weight and its fatigue.
  - **Focus** resists a spell or a channel being interrupted. It comes from **Mind** (today Mind only adds max mana).
  - Not strength: strength already lifts armour's burden.
- **Enemies have a poise bar.** Your hits wear it down; when it breaks they are **staggered** and take more damage
  for a moment. Heavy weapons break poise faster. Bosses have a large poise bar that a party breaks together.

### Mana

- **Mana is everyone's resource**: every skill, ability and spell costs it. Attacks and healing spells cost the
  most, the rest less.
- **Casters and healers** have the most max mana and regen, the Templar less, the martial classes least.
- **The basic attack is free.**
- **Skills that empower the basic attack** for a while, of two kinds:
  - pay on activation: one larger cost, then empowered for a short time;
  - pay as you go: a small cost on activation, then mana for every empowered hit.
- **Mana potions** join health potions.

### Potions in sizes

- Potions are sold in sizes by how much they refill: 10%, 25%, 50% (and perhaps 100%), each priced in proportion to
  what it refills. Health and mana alike.

### Quick slots: 1 to 4

- Four keys, one per **category**: **1** health potion, **2** mana potion, **3** food, **4** water.
- A slot holds whichever item of its category you choose from your bag (a 25% potion, a 50% one, bread, a meal to
  carry): any item whose tag matches the category can be bound to it. The slot belongs to the category, not to one
  item.
- They replace today's keys (Q potion, R eat, T drink).

### Warnings

- **Area attacks** show where they will land (ground markers).
- **Ordinary attacks do not**: no red glow. You read the enemy's wind-up. Boss mechanics follow the same rule.

### Death

- **Falling loses everything you carry** except what you have on: **all equipped gear** (weapon, armour, trinket). Lost: shards, ores
  and materials, monster drops, potions, rations and water flasks, and any gear in the bag.
- **Nothing is left behind**: no grave or corpse to come back to (online, it would only invite players to kill each
  other for the loot).
- So the stash matters: the village, your room at the inn, and **every safe room in the tower** (each safe point
  already has a stash chest, in the game) keep what you put in them. Carrying less is safer: space and trips to the
  stash become part of the game.
- You wake at the inn bed (single player; in the game).

## Open

- The skill keys, now that 1 to 4 are the quick slots and the left button attacks (the right button, Q, E, R?), with
  the number of skill slots ([roadmap](../roadmap.md)).
- **Class balancing**: each class's max mana and regen, stamina, dash length, and who blocks and parries, set
  together, after bosses ([roadmap](../roadmap.md)).
- The numbers: the parry window, stamina costs and regen, poise per weight point, focus per point of Mind, the
  stagger's damage bonus.
- **Bosses**: length, phases and mechanics (next).

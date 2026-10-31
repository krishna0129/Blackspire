# Roadmap: what is still to be decided

This lists the **decisions** still open on features that exist or are designed, not the building work. The design
documents hold the detail ([docs/design](design)); this is the list to work through, in order.

## The milestone

**First friends' playtest:** 3 or 4 players on a hosted server, floors 1 to 3 polished, the new combat, two or three
skills per class, chest and boots gear on the hero with weight. No new systems are started until it is reached. New
ideas go into the backlog (end of this file) the moment they come up, and are looked at after the playtest.

**Done** means, for this milestone: a friend plays floor 1 for twenty minutes and wants to go on.

Each item below is marked **Before** (needed for the playtest) or **After**.

## 1. Combat and movement (Before: everything else waits on this)

The skill numbers, boss fights and gear stats are all set against it, so it comes first.

- **Aiming:** attacks go where you face (today) or toward the mouse? Click to move, or WASD only?
- **Pace:** how long fights should last. Targets for a trash pack, an elite and a boss, alone and in a party of 4.
  These set the reference damage R per floor ([skills.md](design/skills.md#the-power-budget)).
- **The roll:** invulnerable frames or not, a cost (cooldown, stamina, mana), how far.
- **Blocking:** keep it as it is, or add a timed parry?
- **Hit feel:** hit-stop, knockback, stagger, screen shake. How much of each.
- **Resources:** mana for every class, or something of their own (rage for a Marauder, energy for a Shadow)?
- **Enemy telegraphs:** must every elite and boss attack be readable before it lands?
- **Death:** what it costs in single player and online (today: wake at the inn).

## 2. Skills and the boards

- **Before:** how many skills are equipped at once (four slots, or fewer for a slower game).
- **Before:** which two or three skills each class has for the playtest, out of the catalogue.
- **Before:** the healer's kit for a party: a group heal, healing over time, a shield, **reviving a fallen ally**?
- **After:** whether forged gear can carry a skill of its family.
- **After:** the class and weapon proficiency.
- **After:** holy damage as a new type, and the faith skills that deal it.

## 3. Gear ([gear.md](design/gear.md))

- **Before:** the slots. Today there are four (weapon, armour, boots, trinket); the design has five armour slots
  (head, chest, hands, legs, feet). For the playtest: chest and feet only, with head, hands and legs after? And how
  old saves move over.
- **Before:** the rarity look ladder: approve the five steps on one type (the longcoat) before all nine are made.
- **Before:** how fast gear grows with item level (gear ten floors on is about 3 times the strength today).
- **Before:** drop rates by rarity, and the elite gear-drop chance ([world.md](design/world.md)).
- **After:** a bonus at three pieces of a set, or full set only.
- **After:** the types for head, hands and legs; weapon types beyond one per weapon kind; what trinkets do.
- **After:** the super-rare boss drops' rates, and a pity rule or none ([floor-3.md](design/floor-3.md)).
- **After:** lighter gear from rarity and materials; the free weight allowance as slots are added.

## 4. Multiplayer for 3 or 4 (Before: all of it)

- **Hosting:** where the server runs (a small rented server, or a home PC reached over Tailscale), and who keeps it
  up and backs up its save file.
- **Loot:** gear drops for each player separately, or one drop to whoever takes it? (Chests are already decided:
  opened once for the whole world.)
- **Experience:** shared in a party, and how far apart players can be to share it.
- **Difficulty:** how enemy health and damage grow with party size.
- **A fallen player:** revived by allies, or back at a safe point; what happens if the whole party falls.
- **The party on screen:** party health frames, where each player is, pings on the map?
- **Lag:** what is acceptable, tested across a real network before the playtest (it has only run on one machine).

## 5. Bosses and floors

- **Before:** what a boss fight is: its length, its phases, the mechanics a party has to handle (today a boss falls
  in 11 to 25 seconds).
- **Before:** the models of their own for floor 1's spirits and floor 3's roots and hermits, or keep borrowing
  skeletons for the playtest.
- **After** ([world.md](design/world.md), open questions): a floor boss's first-kill reward; how often a rematch can
  be fought; whether a newcomer must beat a boss to go up; what limited-time events are for.
- **After:** floors 4 to 10 and the first branch village.
- **After:** the hidden bosses' open points.

## 6. The character

- **Before:** the character creator in 3D: hair, face, skin, perhaps body types. The 2D choices do nothing on the 3D
  models today, and every hero is the same Knight.
- **Before:** keep or drop uploaded sprite sheets now that the game is 3D.
- **After:** whether enemies get the taller build too.

## 7. The look and the sound

- **Before:** confirm the graphics style. Style C (the gritty grade and ink outlines) is the default, but the choice
  between A, B, C and D was never made.
- **Before:** icon size in the baked sheet (96 or 128 pixels), and whether coat tails and capes swing.
- **Before:** sound and music: what the playtest needs (hits, skills, footsteps, a floor's theme).
- **After:** the slowest computer the game must run well on, measured on real hardware.

## 8. Economy and the village (After)

- Mythril ore, the second currency, still to join.
- Online trader stock sizes.
- Trading between players and the auction house.
- The arcanist's gear passives and brewing (decided, not built).
- Held: the bard, inn room upgrades and the trophy shelf, a mailbox.

## 9. Story and quests (After)

- How much of the story draft the playtest shows: perhaps an opening line at the gate and the guild's bounties only.

## Suggested order of the talks

1. Combat and movement (1), with the bosses (5, Before).
2. Skills for the playtest and the healer's kit (2, Before).
3. Multiplayer for 3 or 4 (4).
4. Gear for the playtest (3, Before).
5. The character creator, the look and the sound (6, 7).

Then the playtest plan, and building.

## Backlog

Ideas that come up before the playtest go here, untouched until after it.

- (empty)

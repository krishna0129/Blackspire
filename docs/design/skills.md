# Skills and the skill tree

Status: **partly in the game** (classes, boards, challenges, tags, the balance runner). It replaces [skill-trees.md](skill-trees.md) and [class-trees.md](class-trees.md), which stay as
a record of earlier thinking. The numbers wait for the new movement and combat
([world.md](world.md)): how fast a fight is decides what a second of damage is worth. The structure, the tags, the
budget rules and the balance runner do not wait, and can be built first.

## Decided

- **Classes, one board each.** The first idea, one shared web after Path of Exile's, looked like a copy of it, so it
  became a board per class. The classes are taken from Path of Exile for now, to be made our own later, and more
  classes or advanced forms of these come later too (there is no Scion for now).
- **No keystones as Path of Exile has them.** A board has **skill nodes** instead, and each skill **diverges into
  variations**.
- **Variations are earned, not bought.** Each one is sealed behind a challenge for its base skill: use it so many
  times, hit a crowd with it so many times, kill so many enemies (or elites, or one family) with it. A met challenge
  opens the variation for free. A character can have both of a skill's variations, and uses one at a time.
- **Off-class weapons**: anyone can carry anything, but only a class weapon brings its skill; the rest give the
  basic attack and nothing more. A weapon or class proficiency, later, will pull players toward their own class.
- **Points wait to be confirmed**, on the board and for attributes alike: a click places a point, − takes a placed
  one back, Confirm spends them all, and leaving with points placed asks to confirm or discard them.
- **The board only opens out of combat**: in a safe room or the village, or five seconds after the last blow struck
  or taken.
- **Resets are full resets only**, at 20 shards for each point spent, so a long-built board is a dear one to undo.
- **Compatibility between skills is not designed for now.** A skill that only works by clashing with the interesting
  ones is left out rather than patched.
- **Every skill on the long list is in scope** (the catalogue below). The work is balancing them, not choosing.

## Classes and boards

| Class | Main attributes | Weapons | Base skills (today's in bold) |
|---|---|---|---|
| Marauder | strength, vitality | greatsword, mace | **Sunder**, **Bulwark**, Heavy Strike, Leap Slam, Enduring Cry |
| Duelist | strength, agility | longsword, spear | **Circular Slash**, **Piercing Line**, Riposte, Double Strike, Spear Throw |
| Ranger | dexterity, agility | bow | **Volley**, Lightning Arrow, Caustic Arrow, Rain of Arrows |
| Shadow | dexterity, intelligence | dagger | **Shadowstep**, Viper Strike, Blade Vortex |
| Witch | intelligence, mind | grimoire of magic | **Fireball**, Frostbolt, Arc, Raise Zombie |
| Templar | strength, faith | mace, grimoire of faith | **Heal**, **Bulwark**, Smite, Essence Drain, Storm Call |

A character picks a class when it is made, then one of its weapons. Characters from before classes took the class of
the weapon they carried.

Each board has **five tiers**. A tier opens once enough points are spent on the board (0, 3, 6, 10, 15); inside an
open tier any node can be taken. Points: one a level, and one for each floor whose boss you were the first to beat.

| Node | What it is |
|---|---|
| Skill | A base skill, with its two variations and their challenges. Today's skills are known from the start, free; the rest come with the new combat. |
| Passive | Ranks (three to five) of a small bonus: a tag's damage, health, defence, a resistance, speed. |
| Capstone | One rank of something big, in the top tier: two per class. |

Bonuses only ever name **tags** ("+6% longsword damage"), never a single skill, so a new skill works with every
board the day it arrives. The boards and their numbers are `BOARD_PLAN` in `js/sim/tree.js`.

### Variations and their challenges

Each base skill has two (the full list is in `BOARD_PLAN`). Some examples:

| Base | Variation | Challenge |
|---|---|---|
| Fireball | Firestorm | Hit 3 or more enemies with one Fireball, 50 times |
| Fireball | Flameblast | Kill 100 enemies with it |
| Circular Slash | Reave | Hit 3 or more enemies with one spin, 60 times |
| Piercing Line | Puncture | Kill 10 elites or bosses with it |
| Viper Strike | Pestilent Strike | Kill 40 spirits with it |
| Raise Zombie | Raise Spectre | Kill 10 elites or bosses with it |

The counts are kept in the save (`S.prog`) and, online, by the server. Today's skills count already; the rest will
count once they exist.

## Tags

Every skill carries tags from this closed list. Nodes, gear affixes and forged-gear bonuses name tags only.

- **How it lands:** melee, projectile, area, chain, channel, totem, trap, mine, minion, aura, warcry, movement, guard.
- **What it deals:** physical, fire, cold, lightning, rot (our name for chaos). Each element has a status: bleed
  (physical), burn (fire), chill and freeze (cold), shock (lightning), wither (rot).
- **When it deals it:** hit, or over time.
- **What it uses:** the weapon it needs (longsword, greatsword, mace, spear, dagger, bow, grimoire), or none.

Cold, lightning and rot are new damage types. Each needs a resistance on enemies and on gear, and enemy families can
be weak or strong against them (spirits weak to fire and lightning, the undead strong against rot, and so on), which
gives the families more to them than a drop table.

## The power budget

Every skill is designed against one number: **the reference damage per second, R**, for a level and a floor. R is
what a plain attack with average gear for that floor should do to one target. A skill spends a budget of 100 points:
what is left after its extras is its share of R, against one target.

| Extra | Cost | Why |
|---|---|---|
| Small area (a cone, a ring close by) | 25 | it hits several enemies at once |
| Large area (the screen, a big ring) | 40 | |
| Chains or pierces (each extra target, up to 3) | 8 | |
| Projectile at range | 10 | you are not in reach of the enemy |
| Movement (a dash, a teleport) | 15 | |
| Slow / stun / freeze | 10 / 15 / 25 | time the enemy does not hurt you |
| Defence (damage taken down, a shield) | 20–40 | by how much and for how long |
| Healing | 30 | |
| Party buff (aura, warcry) | 30 | everyone in the party gets it |

And what a skill **gives back**, because it asks something of the player:

| Drawback | Refund |
|---|---|
| Damage over time instead of on hit | +20 |
| Wind-up, channelling or a delay before it lands | +15 |
| Set up first (totem, trap, mine, a minion to raise) | +20 |
| Costs life, or leaves you open | +15 |
| Long cooldown (8 s or more) | its share of R is paid as one burst instead of over time |

Two examples. **Fireball**: projectile 10, small area 25, so 65 left: against one target it deals 65% of R, and
every enemy in the blast takes that. **Earthquake**: small area 25, then a delay before its second quake (+15): 90%
of R, split between the two quakes. **Minions** together deal 70% of R, because they fight while you do something
else. Mana follows damage: a skill's mana per second at full use is set from its share of R, so a cheap skill is
not also the strongest.

None of this is meant to be exact. It is there so that a new skill starts roughly fair, and the balance runner
finds the ones that are not.

## The balance runner

The rules run on their own (the server already runs them with no page or canvas), so balance can be measured instead
of guessed. `npm run balance` (proposal) plays every skill, with a typical build for it, through set scenes:

- **Dummy:** one target, 10 seconds. Damage per second, against R.
- **Room:** a pack of six of a floor's enemies. Time to clear, health lost.
- **Boss:** each floor's boss, alone, with a time limit. Time to kill, deaths.
- **Mana:** whether the build can keep the skill going.

It writes one table (`docs/balance.md`, generated like the wiki) and marks anything more than 20% from what its
budget says it should do. `npm test` fails at 35%, so a change that breaks a skill is caught the moment it is made.
Tree nodes and gear are measured the same way: the runner adds a node to a build and reports what it changed.

## Order of work

1. **Now, before combat is settled** (**in the game**): tags on today's skills and attacks (`TAGS`, data.js);
   damage types (`DTYPES`), with family resistances to the new ones and resistances from the boards; classes and their
   boards (`js/sim/tree.js`) with today's stats, the challenges, and the board screen (P); the balance runner (`tools/balance.js`,
   [docs/balance.md](../balance.md)) against today's eight weapons and skills. Its first run already says things:
   the greatsword deals 75 to 95% more than the median, the faith grimoire 30 to 40% less, and for most builds each
   floor's boss falls in 11 to 25 seconds at the right level, far short of the mechanic-heavy fights the bosses are
   meant to be.
2. **With the new combat:** set R per floor; the wave 1 skills (24), through the runner.
3. **Wave 2:** the advanced skills (about 50), a start at a time.
4. **Wave 3:** the rest of the catalogue, a few at a time, and masteries.

## Open questions

- Do skills also come from gear, as Path of Exile's gems do? Forging could tie in: a weapon forged from a family's
  drops carrying a skill of that family. Proposal: the board teaches skills, and forged gear can carry one extra
  skill of its family.
- How many skills equipped at once: four slots, or fewer for a slower, more deliberate game?
- The class and weapon proficiency that will reward carrying your own class's weapons.

## The catalogue

The long list, by how a skill fights. All of it is in scope; the tables above place each one in a wave.

- **Melee:** Cyclone, Earthquake, Ground Slam, Sunder, Tectonic Slam, Lacerate, Blade Flurry, Reave, Leap Slam,
  Shield Charge, Boneshatter, Perforate / Bladestorm, Molten Strike, Frost Blades, Smite, Heavy Strike / Infernal
  Blow, Riposte, Flicker Strike, Double Strike.
- **Dagger:** Blade Vortex, Viper Strike, Cobra Lash, Pestilent Strike, Withering Step, Smoke Mine, Blink.
- **Bow:** Tornado Shot, Lightning Arrow, Ice Shot, Rain of Arrows, Barrage, Galvanic Arrow, Explosive Arrow, Toxic
  Rain, Caustic Arrow, Split Arrow, Puncture, Mirror Arrow / Blink Arrow, Ballista towers.
- **Fire:** Fireball, Flameblast, Incinerate, Firestorm, Volatile Dead, Detonate Dead, Righteous Fire, Scorching Ray.
- **Cold:** Freezing Pulse, Ice Nova, Frostbolt, Glacial Cascade, Vortex / Cold Snap, Arctic Armour, Winter Orb,
  Frost Wall.
- **Lightning:** Arc, Spark, Ball Lightning, Storm Call, Orb of Storms, Lightning Tendrils, Shock Nova, Lightning
  Warp.
- **Rot, curses, over time:** Essence Drain, Contagion, Blight, Bane, Soulrend, Hexblast, curses.
- **Minions:** Raise Zombie, Raise Spectre, Summon Skeletons, Summon Raging Spirit, Animate Guardian / Animate
  Weapon, golems, Holy Relic / Absolution, Dominating Blow.
- **Fighting at a remove:** totems, traps, mines, brands.
- **Warcries and auras:** Enduring Cry, Seismic Cry / Intimidating Cry, Battlemage's Cry, auras, heralds, and skills
  charged by kills (their "Vaal" skills).
- **Movement and defence:** Dash / Frostblink / Flame Dash, Phase Run, Steelskin / Molten Shell, Bone Armour, Blood
  Rage, Berserk.
- **From Path of Exile 2:** combo strikes and finishers, weapon-swap stances, the buckler parry, crossbow ammunition,
  spear throw and recall, elemental infusions.

The names above are working names for the ideas. Ours will be named and described as our own before they ship.

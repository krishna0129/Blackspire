# Skills and the skill tree

Status: **proposal**. It replaces [skill-trees.md](skill-trees.md) and [class-trees.md](class-trees.md), which stay as
a record of earlier thinking. Nothing here is in the game yet. The numbers wait for the new movement and combat
([world.md](world.md)): how fast a fight is decides what a second of damage is worth. The structure, the tags, the
budget rules and the balance runner do not wait, and can be built first.

## Decided

- **A passive tree in the manner of Path of Exile**: one shared web of nodes, taken one next to another with points.
  Smaller than theirs, and laid out, named and drawn as our own: the mechanics are borrowed, the content is not.
- **No keystones as Path of Exile has them** (nodes that break a rule, such as "you cannot be critically hit").
  Where their tree has a keystone, ours has a **skill node**: a node that teaches an active skill. A skill node then
  **diverges into advanced skills** further along the tree.
- **Compatibility between skills is not designed for now.** Skill nodes are separate nodes, so two skills that
  would interact badly are simply never on the same build's path. A skill that only works by clashing with the
  interesting ones is left out rather than patched.
- **Every skill on the long list is in scope** (the catalogue below). The work is balancing them, not choosing.

## The tree

### Shape

- **About 200 nodes**, against Path of Exile's 1,300: enough for real choices, few enough that every node can be
  checked by the balance runner.
- **Seven starting points, one per weapon**: longsword, greatsword, mace, spear, dagger, bow and grimoire (with the
  grimoire's start split into its magic and faith sides). There are no classes. Your weapon picks where you start,
  and anyone may walk across the web toward another weapon's skills, paying the points it takes to get there.
- **Points**: one per level, and one per floor boss cleared for the first time (as now). Refunds cost shards, and
  grow dearer with each refund in a week, so a build is a decision and not a toggle.
- **Skills equipped at once**: the basic attack plus **four skill slots** (proposal; the game has one today). A skill
  node teaches a skill; a slot is where you put the ones you use.

### Kinds of node

| Node | What it gives | How many | Example |
|---|---|---|---|
| Small | one tag's number, a little | about 140 | +8% fire damage; +6% area of effect |
| Notable | a bundle, at the end of a short spur | about 30 | +20% projectile damage, projectiles pierce one more enemy |
| Skill node | teaches a base skill | about 24 (wave 1) | Fireball |
| Advanced skill node | teaches an advanced skill, reached through its base skill's node | about 50 | Firestorm, Flameblast |
| Mastery (later) | small choices that shape one skill: more area or more damage, faster or heavier | one per base skill | Fireball: bursts twice, each for 60% |

Small and notable nodes **only ever name tags** ("+8% area damage"), never a single skill. That is what keeps the tree
from needing an edit every time a skill is added: a new skill carries its tags, and every node that names one of them
already works with it.

### Base skills and where they diverge

Each start carries three base skills near it. Each base skill's node leads on to two advanced skills. **Open question:
does taking one advanced branch close the other?** The proposal is no: both stay open, but the second costs the
points to walk there, so most builds will take one.

| Start | Base skill (wave 1) | Advanced skills (wave 2) |
|---|---|---|
| Longsword | Double Strike | Blade Flurry · Flicker Strike |
| | Riposte | Parry (timed, buckler) · Shield Charge |
| | Frost Blades | Molten Strike · Smite |
| Greatsword | Ground Slam | Earthquake · Sunder |
| | Cyclone | Reave · Bladestorm |
| | Heavy Strike | Boneshatter · Tectonic Slam |
| Mace | Leap Slam | Dominating Blow · Animate Guardian |
| | Enduring Cry | Seismic Cry · Battlemage's Cry |
| | Steelskin | Molten Shell · Bone Armour |
| Spear | Spear Lunge | Phase Run · Berserk |
| | Spear Throw (and recall) | Lightning Warp · Storm Call |
| | Lacerate | Puncture (bleed) · Blood Rage |
| Dagger | Viper Strike | Pestilent Strike · Cobra Lash |
| | Blade Vortex | Withering Step · Smoke Mine |
| | Blink | Traps · Mines |
| Bow | Split Arrow | Tornado Shot · Barrage |
| | Lightning Arrow | Galvanic Arrow · Ice Shot |
| | Caustic Arrow | Toxic Rain · Explosive Arrow |
| Grimoire (magic) | Fireball | Firestorm · Flameblast |
| | Frostbolt | Ice Nova · Glacial Cascade |
| | Arc | Spark · Ball Lightning |
| Grimoire (faith) | Heal | Holy Relic · Auras |
| | Raise Zombie | Raise Spectre · Summon Skeletons |
| | Essence Drain | Contagion · Blight |

Everything else on the catalogue is **wave 3**, added a few at a time, each as a further branch of the skill it
grows out of (Incinerate from Flameblast, Winter Orb from Ice Nova, Rain of Arrows from Tornado Shot, and so on).
Today's eight skills map onto the table: Circular slash becomes Cyclone's first form, Shadowstep is Blink, Sunder,
Bulwark (Steelskin), Piercing line (Spear Lunge), Volley (Split Arrow), Fireball and Heal.

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
   damage types (`DTYPES`), with family resistances to the new ones and resistances from the tree; the tree as data
   (`js/sim/tree.js`, 196 nodes) with today's stats; the tree screen (P); the balance runner (`tools/balance.js`,
   [docs/balance.md](../balance.md)) against today's eight weapons and skills. Its first run already says things:
   the greatsword deals 75 to 95% more than the median, the faith grimoire 30 to 40% less, and for most builds each
   floor's boss falls in 11 to 25 seconds at the right level, far short of the mechanic-heavy fights the bosses are
   meant to be.
2. **With the new combat:** set R per floor; the wave 1 skills (24), through the runner.
3. **Wave 2:** the advanced skills (about 50), a start at a time.
4. **Wave 3:** the rest of the catalogue, a few at a time, and masteries.

## Open questions

- Does taking one advanced branch close the other? (Proposal: no, but it costs the points to get there.)
- Do skills also come from gear, as Path of Exile's gems do? Forging could tie in: a weapon forged from a family's
  drops carrying a skill of that family (a Gravecaller-bone staff that raises the dead). Proposal: the tree teaches
  skills, and forged gear can carry one extra skill of its family, so both routes exist.
- Four skill slots, or fewer for a slower, more deliberate game?
- How dear are refunds?

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

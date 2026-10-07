# Class trees: theorycraft

Status: proposal for discussion. Builds on the rules in [skill-trees.md](skill-trees.md): tree nodes only grant
stats the game already has, mutations only change a skill's settings and add riders from a fixed list. Nothing here
is in the game yet.

## How a character grows

Four separate tracks, each with one job, so none of them overshadows gear:

| Track | Improves | Paid with | Where |
|---|---|---|---|
| **Attributes** (exists) | raw stats: Strength, Dexterity… | 3 points per level | Gear panel |
| **Class tree** | numbers, through the existing stat keys | skill points | Gear panel, new tab |
| **Skill rank** | the class skill's own settings (damage, cooldown) | shards + materials, level-gated | blacksmith |
| **Mutation** | how the class skill behaves | a capstone node + a boss mutagen | learned once, swapped at safe rooms |

![The anatomy of a class tree: two class branches and the shared Survival branch, four tiers gated by level, points spent and a key attribute, ending in mutation capstones that need a boss mutagen](img/tree-anatomy.svg)

### Where skill points come from

- **1 every other level** (levels 2, 4, 6 …): 15 by level 30.
- **1 for each floor boss beaten the first time:** 3 today, one per new floor after that.
- At level 30 with floor 3 cleared that's **18 points**. Everything in a class's tree plus Survival costs about 34,
  so **a build fills about half of it**. Choosing what to skip is what makes builds differ.

### Gates

| Tier | Character level | Points already in this class's branches | Extra |
|---|---|---|---|
| 1 | 2 | 0 | – |
| 2 | 8 | 3 | – |
| 3 | 15 | 7 | the class's **key attribute at 15** (see each class) |
| Capstone | 20 | 10 | learning the mutation also takes **one mutagen** of its kind |

Survival points don't count toward these gates. A capstone is reachable by level 20 (13 points by then), but it
takes most of them.

The key-attribute requirement links attributes to the tree. A Swordsman who put everything into Vitality reaches
tier 3 later. That's a real trade-off, but a soft one, because attributes come at 3 per level.

### Trees per class, points per character

- Each class has **its own tree with two class branches**, plus a **Survival branch shared by every class**.
- Points spent in Survival count wherever you go. Points spent in a class branch stay there: switch weapon class
  and that tree waits for you, but the points are not refunded.
- This makes a main class the normal choice and a second class a real investment, without punishing
  experimenting too hard. **Respec** at a blacksmith costs `50 × level` shards, and is free whenever the trees
  change (`TREE_VERSION`, as in skill-trees.md).

### Skill rank: improving the class skill

The active skill itself goes from rank 1 to 5 at a blacksmith. Each rank adds **+8% to the skill's damage or
healing and −4% to its cooldown**. Those are settings in the skills table, so this needs no new mechanics.

| Rank | Level | Shards | Materials |
|---|---|---|---|
| 2 | 5 | 200 | 3 Emberstone |
| 3 | 10 | 500 | 5 Emberstone, 1 Spire crystal |
| 4 | 15 | 1,000 | 3 Spire crystal |
| 5 | 20 | 2,000 | 5 Spire crystal, 1 mutagen of any kind |

This gives materials a second use besides enhancement, and gives every boss a reason to be farmed.

### Mutagens and mutations

- Each floor boss drops its own **mutagen**: **Shadow** (Gate Warden), **Bone** (Bone Regent), **Root** (Pale
  Collector). One is guaranteed on the first kill, then a 20% chance per kill, with a pity counter.
- Each mutation names the mutagen it needs, matching its theme. **Learning** a mutation uses one mutagen.
  After that, switching between learned mutations is free in any safe room.
- One mutation is equipped per skill at a time.

So mutagens also give every floor's boss a reason to be revisited through the floor gate.

## The rider list

Mutations may only use these ten. Each is a small, reviewed piece of code, written once:

| Rider | Effect |
|---|---|
| `pull` | drags enemies hit toward you |
| `bleed` | hits bleed for a share of damage over 3 s |
| `stun` | stuns non-boss enemies hit for a short time |
| `burn` | fire damage over 3 s; counts as fire (burns bodies, double against Thornroots) |
| `chain` | jumps to more targets at reduced effect |
| `extraShots` | more projectiles or strikes |
| `lingers` | leaves an area that keeps working for a few seconds |
| `taunt` | enemies nearby target you for a few seconds |
| `holy` | extra damage to the undead (Bone soldiers, thralls) |
| `delay` | the effect lands after a marked delay, larger |

## The Survival branch (every class)

| Tier | Node | Ranks | Per rank |
|---|---|---|---|
| 1 | Hardy | 3 | +12 health (`hp`) |
| 1 | Light step | 3 | +2% move speed (`move`) |
| 2 | Iron skin | 3 | +3 defense (`def`) |
| 2 | Deep breath | 2 | +10 max mana (`mana`) |
| 3 | Second wind | 2 | +1 health per second (`regen`) |
| 3 | Studious | 2 | +4% experience (`xp`) |

14 points to fill it all. Most builds will take 3 to 6 here, since every point is one less in the class branches.

## Classes

Each class gets two class branches (5 nodes each, 3 tiers) and two capstones. The capstones unlock three mutations
between them; in some classes one capstone holds two. Node values follow the power budget in skill-trees.md: a
tier-1 rank is worth about +2% damage per second or +3% effective health, a tier-3 rank about +6%.

### Swordsman: Longsword and buckler, Circular slash. Key attribute: Strength

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Edge** | Keen edge: +2% crit ×3 · Long reach: +4% reach and arc ×2 | Brutal edge: +8% crit damage ×3 | Serrated: +10% bleed ×1 |
| **Guard** | Warded: +3 defense ×3 · Barbed: +6% reflect ×2 | Steady: +6% stagger chance ×2 | Riposte: +8% skill recharge ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Vortex | knockback −80 | `pull` | Shadow |
| Razor wind | ×1.6 damage | `bleed` | Bone |
| Second spin | spins twice at 60% | `lingers` | Root |

### Rogue: Dagger, Shadowstep. Key attribute: Dexterity

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Shadows** | Keen: +2% crit ×3 · Ruthless: +8% crit damage ×3 | Executioner: +8% damage below 30% health ×3 | Assassin: +10% skill recharge ×1 |
| **Venom** | Serrated: +6% bleed ×3 · Leech: +1% lifesteal ×2 | Quickening: +2% per-hit attack speed ×3 | Arcing: +6% arc chance ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Chain step | jumps to 2 more enemies at 60% | `chain` | Shadow |
| Hamstring | – | `stun` 1.2 s, `bleed` | Bone |
| Smoke step | leaves a smoke cloud | `lingers`, `stun` inside it | Root |

### Slayer: Greatsword, Sunder. Key attribute: Strength

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Ruin** | Giant-slayer: +6% vs elites and bosses ×3 · Brutal: +8% crit damage ×2 | Executioner: +8% below 30% ×3 | Cleave: +8% reach and arc ×1 |
| **Momentum** | Quickening: +2% per-hit attack speed ×3 · Sweeping: +4% reach ×2 | Staggering: +5% stagger ×3 | Unstoppable: +3 defense, +12 health ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Earthsplitter | shape: a 120 px line instead of an arc | – | Shadow |
| Bloodletting | – | `bleed` | Bone |
| Shatter | Sunder's +25% becomes +40% | – | Root |

### Tank: Mace and heavy shield, Bulwark. Key attribute: Vitality

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Bastion** | Stalwart: +12 health ×3 · Warded: +3 defense ×3 | Mending: +1 health per second ×2 | Unbroken: +12% skill recharge ×1 |
| **Retribution** | Barbed: +8% reflect ×3 · Staggering: +5% stagger ×2 | Heavy hand: +8% crit damage ×3 | Shield bash: +6% reach ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Taunt | Bulwark also calls enemies within 80 px | `taunt` | Shadow |
| Thornmail | reflect +50% while Bulwark lasts | – | Bone |
| Shield wall | allies within 40 px also take 30% less | `lingers` | Root |

The Tank is the class that makes party play matter: Taunt and Shield wall only shine with others around.

### Lancer: Spear, Piercing line. Key attribute: Strength

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Reach** | Sweeping: +5% reach ×3 · Keen: +2% crit ×2 | Brutal: +8% crit damage ×3 | Long shadow: +8% skill recharge ×1 |
| **Impale** | Staggering: +5% stagger ×3 · Executioner: +6% below 30% ×2 | Giant-slayer: +6% vs elites and bosses ×3 | Pinning: +10% bleed ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Harpoon | – | `pull` | Shadow |
| Skewer | – | `stun` 1 s | Bone |
| Javelin | thrown: flies 200 px | `extraShots` (a second spear at 50%) | Root |

### Archer: Bow, Volley. Key attribute: Dexterity

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Marksman** | Keen: +2% crit ×3 · Brutal: +8% crit damage ×3 | Focused: +5% skill recharge ×2 | Deadeye: +8% damage below 30% ×1 |
| **Hunter** | Fleet: +2% move ×3 · Arcing: +5% arc chance ×2 | Staggering: +5% stagger ×3 | Leech: +2% lifesteal ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Arrow rain | 9 arrows, wider spread | `extraShots` | Shadow |
| Pinning shot | one arrow at ×4 | `stun` | Bone |
| Fire arrows | – | `burn` (burns bodies, melts Thornroots) | Root |

### Mage: Grimoire of embers, Fireball. Key attribute: Intelligence

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Pyromancy** | Searing: +4% magic damage ×3 · Bursting: +6% blast radius ×2 | Smouldering: +10% burn ×3 | Inferno: +8% magic damage ×1 |
| **Arcana** | Deep: +10 max mana ×3 · Flowing: +8% mana regeneration ×3 | Adept: +4% skill recharge ×2 | Scholar: +3 intelligence ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Meteor | lands after a 0.8 s marked circle, ×1.6 | `delay` | Shadow |
| Twin flame | two smaller orbs at 60% | `extraShots` | Bone |
| Firewall | leaves a burning patch for 3 s | `lingers`, `burn` | Root |

Firewall makes the Mage the answer to floor 3's bodies.

### Healer: Grimoire of grace, Heal. Key attribute: Faith

| Branch | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| **Mercy** | Merciful: +5% healing ×3 · Swift: +5% recharge ×2 | Lingering: +10% heal over time ×3 | Devout: +3 faith ×1 |
| **Sanctuary** | Warding: +4% damage reduction after Heal ×3 · Deep: +10 max mana ×2 | Flowing: +8% mana regeneration ×3 | Mending: +1 health per second ×1 |

| Mutation | Settings | Riders | Mutagen |
|---|---|---|---|
| Sanctuary | heals over 5 s in a circle that stays | `lingers` | Shadow |
| Smite | Heal also strikes the undead nearby | `holy` | Bone |
| Chain heal | jumps to 2 more allies at 70% | `chain` | Root |

## Sanity checks

- **Gear stays king.** Measured with the game's own damage-per-second score (`weaponScore`, level 20, Strength 15),
  a full Swordsman Edge branch adds **+8.9%**; the Slayer's Ruin and Momentum branches add +12.6% and +18.0%.
  Going from a common +0 to a legendary +10 longsword is ×3.8 ([enhancement wiki](../wiki/enhancement.md)).
  Trees shape a build; gear powers it.
- **The branch values above are first drafts.** Momentum is worth twice Edge today, which is exactly what the
  balance report in `npm test` is meant to catch. Expect the numbers to move before anything ships.
- **Every class has a floor 3 answer.** Fire (Fire arrows, Firewall, Fireball) burns bodies; Chain step,
  Harpoon and Taunt pull Gravecallers out of the back line; Smite punishes thralls.
- **Mutations are sidegrades.** None is strictly better than another; each changes what situations the skill is
  for. The balance report in `npm test` (skill-trees.md, step 3) will flag any that are not.
- **The rider list is closed.** All 24 mutations use the same ten riders, plus settings. A new mutation costs a
  table entry and no new code, unless it brings a new rider, which is a deliberate decision.

## Save format

```js
S.skillPts        // unspent
S.tree   = {sword:{edge1:3, guard1:1}, survival:{hardy:2}}
S.rank   = {circle:2}
S.mutagen= {shadow:1, bone:0, root:2}
S.learned= ['circle.vortex']
S.mut    = {circle:'circle.vortex'}   // equipped
S.treeV  = 1                          // a mismatch refunds every point
```

## Order of work

Following skill-trees.md: settings into the skills table first (no behaviour change), then riders with one class's
mutations, then the tree, ranks and mutagens, then the screens, then the remaining classes. The Swordsman goes
first: its three mutations need `pull`, `bleed` and `lingers`, which cover half of what the others need.

## Open questions

1. Should points spent in a class branch be refunded when switching class, or stay put as proposed?
2. Is one guaranteed mutagen per boss's first kill too generous, or about right?
3. Rank 5 asks for a mutagen. Should it be the class's own theme, or any kind as proposed?
4. Do you want a **second active skill** per class? It could be unlocked by a tier-2 node (a third node kind,
   used once per class). It's the biggest addition here, so I left it out of this pass.

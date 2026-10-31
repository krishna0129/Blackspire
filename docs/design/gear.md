# Gear: armour, weight, passives and sets

Status: **design, not in the game yet.** The owner's decisions are marked **Decided**; numbers are first guesses, to
be set by the balance runner ([skills.md](skills.md#the-balance-runner)) when the gear is built. The looks are being
designed now (chest pieces first); the rules wait for them.

## Decided

- **Armour slots:** head, chest, hands, legs, feet. Weapons and trinkets are not armour.
- **Weight classes:** light, medium, heavy. Anyone can wear anything; a class proficiency, later, rewards a class's
  own weight.
- **Burden:** medium and heavy armour slow you, shorten your dash and cut your evade. **Strength** takes away the
  move and dash penalties and **dexterity** the evade penalty, so attribute points have a visible job.
- **Weight and fatigue:** the heavier the whole loadout, the faster fatigue builds. Nothing takes this away: it is
  the price of a tank's defence. Weight also gives **poise**, resistance to being interrupted ([combat.md](combat.md)).
- **Sets:** a set is a **full armour set** (five pieces), and its bonus comes with the full set. Every set has a
  rarity of its own, like Genshin's artifact sets: low rarities give plain stats, Legendary sets change how you
  play. **Every rarity has at least one set made for each class.** No new rarity colour.
- **Where sets come from:** forged, from ores, ordinary enemies' drops and boss drops.
- **Healers matter:** healing has its own pieces and sets, for a front-line healer and a back-line one.
- **The super-rare boss drops** are single pieces with one rule-bending effect. Whether they become a kind of item
  of their own ("uniques") is decided later.
- Rarity changes how a piece **looks** as well as its numbers, five steps for every type, so another player's gear
  can be read at a glance. The pieces are made as 3D models, and baked once into icons and models (never drawn
  live), so a piece looks the same every time.

## Chest types

| Weight | Type | Its own bonus (every one, before random affixes) | Natural fit |
|---|---|---|---|
| Light | Tunic | none: the starter | anyone |
| Light | Robe | + max mana, + mana regen | Witch |
| Light | Shroud | + evade, + crit chance | Shadow, Ranger |
| Light | Vestments | + healing done, + mana regen | healers |
| Medium | Leather jerkin | + health | Ranger, Marauder |
| Medium | Longcoat | + attack speed | Duelist |
| Medium | Brigandine | + defence (and a light burden) | front-liners who still want to move |
| Heavy | Mail hauberk | + defence, + healing received | Templar, the front-line healer |
| Heavy | Plate cuirass | the most defence, + block | Marauder, Templar |

The other slots will get types the same way when they are designed.

## Passives

Every piece carries, before its random affixes:

- **Its weight class's passive.** Light, *Unburdened*: +5% move speed, dashes cost less stamina. Medium, *Steady*: less
  knockback, a little health. Heavy, *Unshaken*: no knockback, critical hits on you do less.
- **Its type's bonus** (the table above), growing with item level.

Random affixes stay as they are: none on Common, one on Uncommon and Rare, two on Epic and Legendary.

## Burden

| Chest | Move | Dash | Evade |
|---|---|---|---|
| Brigandine | −3% | | −10% |
| Mail hauberk | −6% | −10% | −20% |
| Plate cuirass | −10% | −20% | −30% |

Each piece asks for strength and dexterity that grow with its item level (plate, say, 10 + 2 a level of strength).
Below the requirement the penalty shrinks in proportion: half the strength, half the penalty; enough, none. The
tooltip says it outright: *"−10% move speed, needs 24 strength (you have 12): −5% now."*

## Weight

Every item weighs something. Fatigue builds **2% faster for each point of weight above 3**: the first 3 are free, so
light builds never pay.

| | Weight |
|---|---|
| Tunic, robe, shroud, vestments | 1 |
| Jerkin, longcoat | 2 |
| Brigandine | 3 |
| Mail hauberk | 4 |
| Plate cuirass | 5 |
| Striders / boots / greaves | 0.5 / 1 / 2 |
| Dagger, grimoire / longsword, bow / spear, mace / greatsword | 0.5 / 1 / 1.5 / 2.5 |
| Buckler / heavy shield | 0.5 / 2 |

| Loadout | Weight | Fatigue | Fresh to the 7-hour cap |
|---|---|---|---|
| Shroud, striders, dagger | 2 | normal | 7 h |
| Longcoat, boots, longsword and buckler | 4.5 | +3% | about 6 h 48 m |
| Hauberk, boots, mace | 6.5 | +7% | about 6 h 33 m |
| Plate, greaves, mace and heavy shield | 10.5 | +15% | about 6 h 05 m |

(Head, hands and legs add to it when they exist; the free allowance may grow with them.) The Gear panel shows the
load and its rate beside the fatigue bar. Later, perhaps: Legendary pieces a point lighter, chitin-forged armour
lighter, a rare *Featherweight* affix.

## Sets

A set is one weight class, five pieces, and its look is built on one chest type. Bonuses name tags and mechanics
(fire, area, dodge, block, healing), never a single skill, as the skill board does, so new skills work with old sets.

**Where they come from** (all forged):

| Rarity | Forged from |
|---|---|
| Common | iron scrap and any enemy's drops |
| Uncommon | scrap and one family's drops |
| Rare | the family's drops, emberstone and a token from the floor's boss |
| Epic | spire crystal, elite drops and a boss trophy |
| Legendary | a boss core (a rare boss drop), spire crystal and many family drops |

The three enhancing materials stand in for ores until there is mining.

### By class

Seven columns: the six classes, and the back-line healer (in vestments; the Templar's own sets are the front line).

| | Marauder | Duelist | Ranger | Shadow | Witch | Templar | Healer |
|---|---|---|---|---|---|---|---|
| Common | Ironbound | Fencer's | Trapper's | Cutpurse | Apprentice's | Squire's | Acolyte's |
| Uncommon | Brawler's | Sellsword | Pathfinder | Skulker's | Hedge Mage | Vowed | Cantor's |
| Rare | Ironvow | Bladedancer | Thornwatch | Viper's | Emberwake | Gravewarden | Mender's |
| Epic | Warbringer | Duskblade | Galewind | Nightstride | Bonewright | Lightbearer | Mercy's Choir |
| Legendary | Last Bastion | Ashen Tails | Hawkmoor | Hollowstep | Stormcaller | Dawnwarden | Saint's Vigil |

And two Common sets for anyone: **Wayfarer's** and **Militia**.

### The bonuses

**Common**: one plain stat.

| Set | Weight / chest | Full set |
|---|---|---|
| Ironbound | heavy / hauberk | +15% defence |
| Fencer's | medium / longcoat | +6% attack speed |
| Trapper's | medium / jerkin | +8% projectile damage |
| Cutpurse | light / shroud | +5% crit chance |
| Apprentice's | light / robe | +10% max mana |
| Squire's | heavy / hauberk | +8% defence, +5% healing received |
| Acolyte's | light / vestments | +10% healing done |
| Wayfarer's | light / tunic | +8% move speed, fatigue builds 5% slower |
| Militia | medium / jerkin | +10% max health |

**Uncommon**: two stats.

| Set | Weight / chest | Full set |
|---|---|---|
| Brawler's | medium / brigandine | +10% max health, +8% area damage |
| Sellsword | medium / brigandine | +8% melee damage, +5% crit chance |
| Pathfinder | light / shroud | +6% evade, +10% projectile range |
| Skulker's | light / shroud | +6% evade, +15% crit damage |
| Hedge Mage | light / robe | +15% mana regen, skills cost 5% less mana |
| Vowed | heavy / hauberk | +10% healing received, +8% block |
| Cantor's | light / vestments | +10% healing done, +10% mana regen |

**Rare**: a small mechanic.

| Set | Weight / chest | Full set |
|---|---|---|
| Ironvow | heavy / plate | Blocking refunds 4 mana. Below 30% health, +20% damage reduction. |
| Bladedancer | medium / longcoat | After a block or a dodge, +25% melee damage for 3 s. |
| Thornwatch | medium / jerkin | Projectiles pierce one more enemy. Kills leave a thorn patch that slows. |
| Viper's | light / shroud | Critical hits wither (rot over time) for 3 s. |
| Emberwake | light / robe | When a burning enemy dies, the burning spreads to one nearby. |
| Gravewarden | heavy / hauberk | +15% healing received. Your heals also shield for 20% of what they heal. |
| Mender's | light / vestments | Healing over time lasts 50% longer. Heals on anyone under 30% health heal 25% more. |

**Epic**: a strong mechanic.

| Set | Weight / chest | Full set |
|---|---|---|
| Warbringer | heavy / plate | Area hits give Fury: +3% damage for 4 s, up to 10. At 10, no knockback. |
| Duskblade | medium / longcoat | Hits within 2 s of each other stack +4% damage, up to 5. Critical hits shorten area-skill cooldowns. |
| Galewind | light / shroud | Every 5th projectile hit looses two more arrows at enemies nearby. |
| Nightstride | light / shroud | After a dodge, your next hit is critical. Kills reset movement-skill cooldowns. |
| Bonewright | light / robe | One more minion; minions take 30% less damage. |
| Lightbearer | heavy / hauberk | Your heals strike enemies near the one healed for 30% of the amount, as holy damage. |
| Mercy's Choir | light / vestments | Overhealing becomes a shield on the one healed. Healing an ally heals you for 20% of it. |

**Legendary**: changes how you play.

| Set | Weight / chest | Full set |
|---|---|---|
| Last Bastion | heavy / plate | No knockback or slows. Blocking sends out a shockwave. Allies near you take 10% less damage. You cannot dash. |
| Ashen Tails | medium / longcoat | Each dodge leaves an afterimage that draws enemies' attacks for 1.5 s, then bursts into fire. |
| Hawkmoor | medium / jerkin | Arrows pierce every enemy, and deal 2% more for each one already pierced. |
| Hollowstep | light / shroud | Movement skills have a second charge. The first hit after one deals triple damage. |
| Stormcaller | light / robe | Lightning chains to two more enemies. Every 10th lightning hit calls down a strike. |
| Dawnwarden | heavy / hauberk | Above half health, a quarter of the damage allies near you take comes to you instead. +30% healing received. |
| Saint's Vigil | light / vestments | Once every 90 s, a killing blow on you or an ally heals them to 30% instead. |

Holy damage is not a damage type yet (lightning, fire, cold, rot and physical are); it would join `DTYPES` with the
faith skills.

## The super-rare boss drops

Single pieces, no set; each bends one rule, usually at a cost.

| Piece | Type | Effect |
|---|---|---|
| Pilgrim's Tunic | tunic | Weighs nothing; fatigue builds 10% slower. Very little defence. |
| Bellwarden | plate | Blocking sends out a knockback shockwave. You cannot dash. |
| Penitent's Mail | hauberk | 30% of the healing you give heals you too. −10% max health. |
| Cinder Vigil | robe | Out of mana, skills cost health instead. |
| Veil of Quiet | shroud | Enemies lose track of you briefly after a dodge. You take 15% more damage. |
| Vowkeeper Brigandine | brigandine | Your strength counts double toward weight requirements. |

## Balance

- A full set is worth roughly one rarity step of power; a Legendary set's effect is costed against the power budget
  ([skills.md](skills.md#the-power-budget)).
- The balance runner gets a full-set build and a boss-drop build for each, so they are measured before they ship.

## Open

- A small bonus at three pieces, so that a half-built set is worth wearing on the long way to five?
- Mining, and real ores, instead of the enhancing materials.
- The other slots' types (head, hands, legs, feet), and whether the free weight allowance grows with them.
- Holy damage, and the faith skills that would deal it.

## Order of work

1. **Looks**, chest first: all nine types at Rare on the hero (pass 1), then each type's five rarity steps (pass 2).
2. A gear module and a bake tool: every piece made once into an icon sheet and 3D models, committed.
3. The rules: types, weight, burden, passives, then sets, into `data.js` and the rules, through the balance runner.
4. The other slots, then weapons in the hand, then trinkets.

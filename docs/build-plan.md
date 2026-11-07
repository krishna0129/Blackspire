# Build plan: to the first friends' playtest

The order to build what the design documents decided ([roadmap](roadmap.md)). **Each step ends playable**: tests
pass, the single-player build is published, a pull request is opened, and the owner plays it before the next step
starts. Small open details are settled at the step that needs them (marked *Decide*).

## 0. Clear the decks

- Merge PR #11 (classes and boards, fatigue and the inn, the 3D village, taller people, every design document).
  Each step after starts a fresh branch from `main`.

## 1. Controls and the core of combat

[combat.md](design/combat.md)

- Mouse aiming; left button attacks, slower while swinging; right button blocks, a tap just before a hit parries.
- Stamina: the dash and blocking cost it; it comes back slower while doing anything but walking. The dash without
  invulnerability, shorter for casters.
- Keys: skills on Q E C X, quick slots 1 to 4, interact on F (beds and laid-out sleeping bags for sleep).
- Hit reactions (knockback, stagger), interruption, **poise** (from armour weight) and **focus** (from Mind), and a
  **poise bar on enemies** that staggers them when broken.
- Ground markers for area attacks only.

*Playable:* floor 1 with today's skills, under the new controls. *Decide:* the first numbers (parry window, stamina).

## 2. Classes and skills

[classes.md](design/classes.md), [skills.md](design/skills.md)

- Each class's base health, mana, stamina, dash and parrying; a free basic attack.
- Four skill slots and the X ultimate, chosen from each class's pool; empowered attacks.
- The new skills, one class at a time: Templar first (the healing kit and its three ultimates), then Witch, Marauder,
  Duelist, Ranger, Shadow.

*Playable:* each class with its full kit, after each class. *Decide:* starting attribute points.

## 3. Death, potions and stashes

[combat.md](design/combat.md#death)

- Falling loses everything carried but equipped gear.
- Health and mana potions in sizes; the four quick slots bound by category.
- A safe room with a stash and a trader before every boss chamber.

## 4. Bosses

[bosses.md](design/bosses.md)

- The Gate Warden, the Bone Regent and the Pale Collector: three phases each, all four tools, an enrage each, a reset
  on a wipe, party scaling.

*Playable:* each boss, alone and (in the in-process test) with a party.

## 5. Gear rules

[gear.md](design/gear.md)

- Five armour slots; nine chest types and one type per weight for head, hands, legs and feet.
- Weight and fatigue, burden lifted by strength and dexterity, the weight classes' passives, the types' bonuses.
- Drop rates; the 37 sets and their forge recipes; the super-rare boss drops; starting gear; a wipe of characters.
- Through the balance runner.

## 6. Gear on the hero

[gear.md](design/gear.md), [look.md](design/look.md)

- The gear module and the bake tool: every piece made once into 3D models and a 128-pixel icon sheet, committed.
- *Decide:* approve the five rarity looks on the longcoat; then the rest are made.
- Each set's colours and emblem; swinging coat tails and capes.

## 7. The character and the enemies

[look.md](design/look.md)

- The 3D character creator (skin, hair, face and eyes, two body types).
- Skeletons on the tall build; floor 1's spirits and floor 3's roots and hermits get models of their own.

## 8. Multiplayer

[multiplayer.md](design/multiplayer.md)

- Loot (personal, and first to grab for Epic, Legendary and boss drops), shared experience, enemy scaling.
- The Templar's revive window; party bars, allies on the minimap, pings, agreed duels.
- *Decide:* the ping's key, how duels are offered, Revive's reach.
- The server on the home PC over Tailscale, and **a test across the internet with one friend**.

## 9. Sound and story

[look.md](design/look.md)

- *Decide:* the CC0 sound and music packs (fetched by the owner).
- Combat, world and interface sounds; a theme per floor, a boss theme, the village.
- The light touch of story: the gate, the guild's bounties, villagers' lines.

## 10. The playtest

- A balance pass with the runner; debug mode and cheats for showing variations.
- The first friends' playtest. Done when a friend plays floor 1 for twenty minutes and wants to go on.

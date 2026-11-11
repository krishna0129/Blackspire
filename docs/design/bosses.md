# Bosses

Status: **the Gate Warden is built** (js/sim/warden.js); the Bone Regent and the Pale Collector are decided, not built yet.
Fight lengths come from the balance runner ([balance.md](../balance.md), [skills.md](skills.md#the-balance-runner)).
Part of the road to the first friends' playtest ([roadmap](../roadmap.md)); it builds on
[combat.md](combat.md) (parry, poise, markers only for area attacks, the death rule).

Ordinary enemies and elites stay as hard as they are. Only bosses get harder: today each falls in 11 to 25 seconds.

## Decided

- **Length:** a fight lasts about **5 to 8 minutes alone** and **8 to 10 minutes for a party**.
- **Phases:** each boss has its own number. The three playtest bosses have three each.
- **Every boss has all four tools:**
  - **heavy hits to read and dodge**, with no markers (as for ordinary enemies);
  - **area attacks** with ground markers;
  - **an attack to parry or block** (a shield or a sword), which staggers the boss when parried. Classes that can't
    parry (the Ranger and the Witch) **dash clear of it** instead: no hit, but no stagger either;
  - **a poise bar** that, broken, opens a big damage window. A party breaks it together.
- **Enrage:** every boss has one, with its own timer, well past the fight's normal length, so only a fight that is
  being lost enrages. A first guess was 12 minutes alone, 15 for a party; the Warden's is **15 minutes**, since the
  slowest builds alone need about 12.
- **A party wipe:** the boss heals fully and its door opens again. Everyone wakes as the death rule says.
- **With a party:** the boss has **+80% health for each player after the first**, the same damage. With three or more
  players it also gains a mechanic that splits the party (adds to kill elsewhere, or two places to stand).
- **Before every boss chamber:** a safe room with a **stash and a trader**, so a party can bank what it carries and
  restock before the fight.

## The three bosses

### The Gate Warden (floor 1, spirit)

1. **Sweeps and summons:** sweeping sword strikes to read and dodge; calls skitters.
2. **The gate opens (70%):** spectral chains whip across the floor (area markers); it blinks around the room.
3. **The split (35%):** it splits in two. Only the real one has a poise bar, and the party must find and break it.

**As built.** Health is 18 times a common boss's (`hpX` in data.js): the balance runner's bot, which never stops
attacking, takes 3.5 minutes with a greatsword, 5.5 to 7.5 with the other weapons and the Witch, and 11.5 as a lone
Templar; a player who has to dodge takes longer. Its poise is its own: 30% of its health, mending slowly.

| Move | How to read it | Answer |
|---|---|---|
| Sweep, backhand (often one after the other) | no marker: the blade goes back over its shoulder, then a wide arc | step out of reach, dodge through, or block |
| **Overhead cleave** | a long wind-up, and **the blade glints** | **parry it**: the Warden reels for 2.8 s and loses 30% of its poise. Without a parry, dash clear |
| Whirl | a marked circle around it; from phase 2 a second ring rolls outward | get out; for the second ring, stay close at its feet |
| Leap | a marked circle where you stand (when you keep your distance) | move off the mark |
| Charge | a marked lane | sidestep |
| Calls the swarm (at 85% and 55%) | a banner | kill the skitters |
| Chains (phase 2 on) | narrow marked lanes: a rake across the room, or crosses through where you stand | stand between the lanes |
| Blink (phase 2 on) | it fades, then is behind you with a backhand already coming | turn and dodge |
| **The split** (phase 3) | a second Warden, an echo. While the echo stands the true one takes 60% less damage. The true one shows a poise bar over its head, and the echo flickers | break the true one's poise: the echo shatters for good. Killing the echo only buys 18 s |

Each phase begins with a roar of about two seconds during which nothing hurts it. A wipe resets everything.

### The Bone Regent (floor 2, undead)

1. **The shield wall:** blows from the front are blocked. **Parry its overhead strike** to open it up.
2. **The guard (70%):** it calls a guard of skeletons. While it channels the call, its resistance to magic drops.
3. **The broken throne (35%):** its throne breaks; bone spikes burst from the floor (area markers), and it attacks
   faster.

### The Pale Collector (floor 3, undead)

1. **The raising:** it raises the corpses in its chamber. Breaking or burning a corpse first stops it rising.
2. **The drain (70%):** it drains life from what it raised to heal itself. Breaking its poise stops the drain.
3. **The dark (35%):** the light closes in (the light radius shrinks) and it hunts in the dark.

## Open

- Each boss's enrage timer, and what its must-parry attack and its party-splitting mechanic are, as each is built.
- After the playtest ([roadmap](../roadmap.md)): first-kill rewards, how often a rematch can be fought, events.

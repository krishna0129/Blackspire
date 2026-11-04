# Multiplayer for 3 or 4

Status: **decided, not built yet** (the server, accounts and parties of four are in the game). Builds on
[combat.md](combat.md) (the death rule), [bosses.md](bosses.md) and [skills.md](skills.md). Part of the road to the
first friends' playtest ([roadmap](../roadmap.md)).

## Decided

### The server

- It runs on **the owner's home PC**, reached over **Tailscale**: friends install Tailscale and join that network.
- When the PC is off, **online is down**; single player always works.
- Before the playtest, **one short test across the internet with one friend**, for lag and crashes (online has only
  ever run on one machine talking to itself).

### Loot

- **Ordinary drops are personal**: each player gets their own, and nobody can take another's.
- **Epic and Legendary gear and boss drops are first to grab**: one drop for the party, kept by whoever picks it up.
- Chests stay as decided: opened once for the whole world ([world.md](world.md)).

### Experience

- Shared **equally** by the party members **within about a screen** of the kill.

### Enemies with a party

- Ordinary enemies: **+50% health for each player after the first**, and a little more loot.
- Bosses: +80% health for each, as [bosses.md](bosses.md) says.

### Falling

- **Falling is death**; there is no downed state, and allies cannot pick a fallen player up.
- **Except by a Templar:** a fallen player lies dead for **about 15 seconds** before the death counts. In that time,
  a Templar's **Revive** (or the **Resurrection** ultimate, for everyone at once) brings them back where they fell,
  with everything they carried. After it, the death rule applies: what they carried is lost and they wake at the inn.
- The whole party falling: everyone wakes at the inn, and a boss resets ([bosses.md](bosses.md)).

### Players and each other

- **No friendly fire.** Players can only hurt each other in a **duel both agree to**.

### On screen

- **Party health and mana bars** at the side of the screen.
- **Allies on the minimap.**
- **A ping**: mark a spot or an enemy for the party.
- No chat in the game: the party talks on Discord.

## Open

- The ping's key, and how a duel is offered and accepted.
- How far a Templar's Revive reaches.

# Blackspire

A web based MMO RPG pixel game: a dark, pixel-art floor climber that runs in the browser. No build step and no dependencies.

## Run it

The title screen offers **Single player** and **Online**.

- **Single player** needs nothing: open `index.html` in Chrome, Edge or Firefox, or serve this folder with any
  static file server (`python3 -m http.server 8000`, then `http://localhost:8000/`).
- **Online** needs the game server, which also serves the game, so one address does both. It needs Node 22.5 or
  newer:

  ```
  npm install
  npm start            then open http://localhost:8080/
  ```

  `PORT` and `DB` (the database file, default `server/data/blackspire.db`) change where it listens and what it
  writes. `npm test` runs the server's tests.

The only outside request is the pixel font from Google Fonts. Offline, the game falls back to a monospace font.

## Layout

```
index.html            page markup: HUD, menus, overlays
css/style.css         all styling
js/sim/               the game rules. No page, canvas or sound: the browser runs them for single player and the
                      server runs the very same files for online play
  util.js             small helpers
  data.js             tables: floors, weapons, skills, passives, gear, enemies, materials, loot
  items.js            item generation, prices, enhancement, the blacksmith's stock
  rules.js            players, saves, derived stats, and the list of host functions the rules call
  world.js            floor generation
  village.js          the root village (floor 0): its map, stalls, people and scenery
  combat.js           hit detection, damage, skills, spells, loot, the boss chamber
  update.js           one step of a floor: every player, enemy, shot and drop; enemy and boss AI
  floor3.js           floor 3's enemies (Gravecaller, Thornroot, Bloodbloom, Ossuary hermit) and the Pale Collector
  actions.js          gear, attributes and blacksmith actions, run locally or by the server
js/client/            everything on screen, loaded after js/sim in the order index.html lists them
  store.js            the local save store
  host.js             the browser's host functions: particles, numbers, messages, dialogs
  sprites.js          loads the PNG sprites; colouring, outlines, item icons
  paint.js            paints a floor's tiles
  input.js            canvas sizing, light mask, keyboard, mouse, touch, sound
  render.js           drawing the world
  ui.js               HUD, title flow, character creator, gear panel, blacksmith, floor gate, debug menu
  net.js              online play: the connection, snapshots, smoothing other players and enemies
  main.js             start-up and the main loop
assets/sprites/       every sprite, as PNG (see assets/README.md)
assets/templates/     a full-colour character sheet to repaint
tools/make_sprites.py regenerates the default sprite PNGs (needs Pillow)
tools/build.py        optional: packs single player into dist/blackspire.html
tools/wiki.js         writes docs/wiki (pages and charts) from the game's data
tools/wiki-images.js  renders the wiki's game pictures with the game's own drawing code (needs Playwright)
tools/concept-floor3.js  concept art for docs/design/floor-3.md, drawn through the game's renderer (needs Playwright)
server/               the online server (Node): index.js (HTTP and WebSocket), game.js (parties, running floors),
                      db.js (accounts and characters), test/
```

## Controls

Move with WASD or the arrow keys. You attack in the direction you face.

| Action | Keys |
|---|---|
| Attack | J, or a mouse click |
| Skill | K, Space, or a right click |
| Block (longsword and mace classes) | hold H or F |
| Roll | Shift or L |
| Potion | Q |
| Eat a ration / drink water | R / T |
| Interact (gates, the Teleport Gate, traders, blacksmith, villagers) | E |
| Gear | I or Tab |
| Pause menu (resume, save and quit) | Esc, or the Menu button |
| Respawn after a death | R or Enter |
| Debug menu (only with `?debug`, see below) | ` (backquote) |

## Online play

- **Accounts:** a name and a password. Passwords are stored only as salted scrypt hashes. A login lasts 30 days
  in that browser. One account plays from one place at a time.
- **Characters** live on the server and are separate from single-player saves.
- **Parties:** everyone starts in a party of their own, with a 6-letter code in the menu (Esc). Up to 4 players
  join by entering the code. A party shares one copy of the floor: every kill gives everyone experience, while
  loot, chests and shops are each player's own. The party leader picks the floor at the floor gate; anyone can
  take the party up the stairs after a boss. Heal reaches everyone nearby.
- **Who decides what:** the server runs combat, loot, saves, shops and enhancement, using the same rule files as
  single player (`js/sim`). Your browser moves your character so movement answers at once, and the server checks
  every reported position against your speed and the walls.
- The world does not pause online: the menu and the gear panel leave your character standing where it is.

## Floors

Each floor's boss guards the way up. Beating it unlocks the next floor. The amber floor gate in every start room
travels to any floor you have unlocked. Enemies and the boss are back whenever you arrive, so bosses can be fought
again for their loot. Chests you opened stay empty, and a floor's blacksmiths restock each time its boss falls.

## Materials and enhancement

Enemies, chests and bosses drop three materials: Iron scrap (common), Emberstone (mostly elites) and Spire crystal
(bosses). Salvaging gear gives shards and materials back. A blacksmith enhances gear up to +10 for shards plus
materials: scrap for +1 to +3, emberstone from +4, crystals from +7. Up to +5 it always works. From +6 an attempt can
fail (80%, 65%, 50%, 38%, 28%): the level stays, the cost is spent, and each failure adds 10% to that item's next try.

## Docs

- [docs/wiki](docs/wiki/README.md): the player wiki (drops, enhancement, monsters), generated from the game's data
  by `npm run wiki`. `npm test` fails if it is out of date. Its pictures (monsters, items, boss attacks) are
  rendered by the game itself with `npm run wiki:images`, which needs Playwright and a Chromium
  (`npx playwright install chromium`); rerun it after changing sprites.
- [docs/design](docs/design): design proposals: [skill trees and mutations](docs/design/skill-trees.md),
  [class trees and skill ranks](docs/design/class-trees.md),
  [floor 3](docs/design/floor-3.md), [the world, economy and story](docs/design/world.md), [the root village](docs/design/root-village.md).

## Saves

Progress is kept in the browser's local storage, per address. `Store.SYNC_URL` in `js/state.js` is the hook for
posting saves to your own server.

## Debug menu

Testing shortcuts: jump to a floor, add levels or shards, god mode, teleport to the boss gate or a blacksmith.
It is off for players. Add `?debug` to the address to switch it on, for example `index.html?debug` or
`http://localhost:8000/?debug`. The ` key and the Debug button in the Gear panel then open it.

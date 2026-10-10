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
  data.js             tables: floors, weapons, skills, passives, gear, enemies and their families, materials,
                      loot, forging
  items.js            item generation, prices, enhancement, forged gear, the traders' stock
  rules.js            players, saves, derived stats, and the list of host functions the rules call
  world.js            floor generation
  village.js          the root village (floor 0): its map, stalls, people and scenery; online, shared in channels
  quests.js           the Adventurers' Guild's daily quest board
  fields.js           the village fields: plots, crops and growing
  market.js           the exchange: moving prices, buying and selling materials and monster drops
  combat.js           hit detection, damage, skills, spells, loot, the boss chamber
  update.js           one step of a floor: every player, enemy, shot and drop; enemy and boss AI
  floor3.js           floor 3's enemies (Gravecaller, Thornroot, Bloodbloom, Ossuary hermit) and the Pale Collector
  actions.js          gear, attributes, trader, blacksmith and forging actions, run locally or by the server
js/client/            everything on screen, loaded after js/sim in the order index.html lists them
  store.js            the local save store
  host.js             the browser's host functions: particles, numbers, messages, dialogs
  sprites.js          loads the PNG sprites; colouring, outlines, item icons
  paint.js            paints a floor's tiles
  input.js            canvas sizing, light mask, keyboard, mouse, touch, sound
  render.js           drawing the world
  ui.js               HUD, title flow, character creator, gear panel, blacksmith and forging, floor gate, debug menu
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
                      db.js (accounts, characters, the tower's seed and the market's stock), test/
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
| Interact (gates, the Teleport Gate, traders, the stash, the forge, the well, villagers) | E |
| Gear | I or Tab |
| Pause menu (resume, save and quit) | Esc, or the Menu button |
| Respawn after a death | R or Enter |
| Debug menu (only with `?debug`, see below) | ` (backquote) |

## Online play

- **Accounts:** a name and a password. Passwords are stored only as salted scrypt hashes. A login lasts 30 days
  in that browser. One account plays from one place at a time.
- **Characters** live on the server and are separate from single-player saves. New ones start in the root village.
- **The village is shared:** everyone online is in one of its channels (up to 30 players each; another opens when
  one is full) and sees everyone else there. The Teleport Gate takes your party to a floor; each floor's gate
  brings it home.
- **Parties:** everyone starts in a party of their own, with a 6-letter code in the menu (Esc). Up to 4 players
  join by entering the code. A party shares one copy of the floor: every kill gives everyone experience, while
  loot, chests and shops are each player's own. The party leader picks the floor at the Teleport Gate or a floor gate; anyone can
  take the party up the stairs after a boss. Heal reaches everyone nearby.
- **One tower:** a server picks the tower's seed once and keeps it in its database, so floor n has the same rooms
  and the same chests for every party, and after every restart. Each party still fights in its own copy of it.
- **Who decides what:** the server runs combat, loot, saves, shops, the market and enhancement, using the same rule files as
  single player (`js/sim`). Your browser moves your character so movement answers at once, and the server checks
  every reported position against your speed and the walls.
- The world does not pause online: the menu and the gear panel leave your character standing where it is.

## Floors

Each floor's boss guards the way up. Beating it unlocks the next floor. The amber floor gate in every start room
travels to any floor you have unlocked. Enemies and the boss are back whenever you arrive, so bosses can be fought
again for their loot. Chests you opened stay empty. A floor's traders restock each time its boss falls; the village
market restocks whenever any boss falls, and once a day (with the guild's quest board).

## Materials and enhancement

Enemies, chests and bosses drop three materials: Iron scrap (common), Emberstone (mostly elites) and Spire crystal
(bosses). Salvaging gear gives shards and materials back. A blacksmith enhances gear up to +10 for shards plus
materials: scrap for +1 to +3, emberstone from +4, crystals from +7. Up to +5 it always works. From +6 an attempt can
fail (80%, 65%, 50%, 38%, 28%): the level stays, the cost is spent, and each failure adds 10% to that item's next try.

## Families and forging

Every monster belongs to a family, and drops that family's own material on top of its other loot: spirits (floor 1's
shades, skitters, brutes and wisps) drop Shade essence, the undead (the skeletons, thralls and Gravecallers) Old
bone, plants Thornwood, beasts Chitin plate. Bosses and elites always drop some. In the root village the
**blacksmith** forges those into weapons, armor and boots, and the **arcanist** writes grimoires from them:

- a forged weapon deals 15% to 25% more damage to that family;
- forged armor takes 10% to 20% less damage from that family, forged boots 5% to 10%, and the two add up.

A forged piece is always Rare, at the item level of the highest floor you have reached, and costs the family's drops
(12, 10 or 6), some Iron scrap and shards. Against any other family it is an ordinary Rare piece. Every "% more
damage" bonus (a forged weapon's, Giant-slaying, Executioner's, Sunder's mark) adds up and is applied once. The
tables are `FAMILIES` and `FORGING` in `js/sim/data.js`; the [wiki's forging page](docs/wiki/forging.md) has the
numbers.

## The market

The **exchange**, a desk at the bottom of the village market, buys and sells the three enhancement materials and the
four monster drops. One rule sets every price: `base × normal stock ÷ stock now`, held between half and double, and
selling pays 80% of it. Buying makes the next one dearer and selling makes the next one cheaper; each hour the stock
drifts a tenth of the way back to normal. One seller can sell half a good's normal stock per hour. Single player
keeps the stock in the save; online, the server keeps one stock for everybody, so players move each other's prices.
The guild's daily board also asks for monster drops and pays 30% over the usual price. The table is `MARKET` in
`js/sim/data.js`, the rules are `js/sim/market.js`, and the [wiki's market page](docs/wiki/market.md) has the numbers.

## Docs

- [docs/wiki](docs/wiki/README.md): the player wiki (drops, forging, the market, enhancement, monsters), generated from the game's data
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

Testing shortcuts: jump to a floor, add levels, shards or monster drops, god mode, teleport to the boss gate or the
next safe room.
It is off for players. Add `?debug` to the address to switch it on, for example `index.html?debug` or
`http://localhost:8000/?debug`. The ` key and the Debug button in the Gear panel then open it.

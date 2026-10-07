# Blackspire

A web based MMO RPG pixel game: a dark, pixel-art floor climber that runs in the browser. No build step and no dependencies.

## Run it

- **Quickest:** open `index.html` in Chrome, Edge or Firefox.
- **From a server** (needed for other people to reach it): from this folder run
  `python3 -m http.server 8000`, then open `http://localhost:8000/`. Any static file server works.

The only outside request is the pixel font from Google Fonts. Offline, the game falls back to a monospace font.

## Layout

```
index.html            page markup: HUD, menus, overlays
css/style.css         all styling
js/                   plain scripts sharing one global scope, loaded in the order index.html lists them
  util.js             small helpers
  data.js             tables: weapons, skills, passives, gear, enemies
  items.js            item generation and prices
  state.js            save store, character state, derived stats
  sprites.js          loads the PNG sprites; colouring, outlines, item icons
  world.js            floor generation and tile painting
  input.js            canvas sizing, light mask, keyboard, mouse, touch, sound
  combat.js           hit detection, damage, skills, spells, boss chamber
  update.js           per-frame simulation: player, enemies, bosses
  render.js           drawing the world
  ui.js               HUD, title flow, character creator, gear panel, blacksmith, debug menu
  main.js             start-up and the main loop
assets/sprites/       every sprite, as PNG (see assets/README.md)
assets/templates/     a full-colour character sheet to repaint
tools/make_sprites.py regenerates the default sprite PNGs (needs Pillow)
tools/build.py        optional: packs everything into dist/blackspire.html
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
| Interact (gates, floor gate, blacksmith) | E |
| Gear | I or Tab |
| Pause menu (resume, save and quit) | Esc, or the Menu button |
| Respawn after a death | R or Enter |
| Debug menu (only with `?debug`, see below) | ` (backquote) |

## Floors

Each floor's boss guards the way up. Beating it unlocks the next floor. The amber floor gate in every start room
travels to any floor you have unlocked. Enemies and the boss are back whenever you arrive, so bosses can be fought
again for their loot. Chests you opened stay empty, and a floor's blacksmiths restock each time its boss falls.

## Materials and enhancement

Enemies, chests and bosses drop three materials: Iron scrap (common), Emberstone (mostly elites) and Spire crystal
(bosses). Salvaging gear gives shards and materials back. A blacksmith enhances gear up to +10 for shards plus
materials: scrap for +1 to +3, emberstone from +4, crystals from +7. Up to +5 it always works. From +6 an attempt can
fail (80%, 65%, 50%, 38%, 28%): the level stays, the cost is spent, and each failure adds 10% to that item's next try.

## Saves

Progress is kept in the browser's local storage, per address. `Store.SYNC_URL` in `js/state.js` is the hook for
posting saves to your own server.

## Debug menu

Testing shortcuts: jump to a floor, add levels or shards, god mode, teleport to the boss gate or a blacksmith.
It is off for players. Add `?debug` to the address to switch it on, for example `index.html?debug` or
`http://localhost:8000/?debug`. The ` key and the Debug button in the Gear panel then open it.

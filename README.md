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
| Interact (gates, blacksmith) | E |
| Gear | I or Tab |
| Debug menu | ` (backquote) |

## Saves

Progress is kept in the browser's local storage, per address. `Store.SYNC_URL` in `js/state.js` is the hook for
posting saves to your own server.

## Debug menu

`DEBUG` near the bottom of `js/ui.js` switches it on or off.

# Sprites

The game does not draw characters, gear, weapons or enemies in code. It loads the PNG files in `assets/sprites/`.
Replace a file with your own art at the same size and the game uses it. If you add a new file, list its name in
`SPRITE_NAMES` at the top of `js/client/sprites.js`.

## Finer art: the pixel ratio

Every size on this page is in **game pixels**, the grid the whole game is laid out on. A file can be drawn finer than
that grid: draw it at 2, 3 or 4 times the size, and give its ratio in `SPRITE_RATIO` at the top of
`js/client/sprites.js`:

```js
const SPRITE_RATIO={'enemies/thrall':4};   // thrall.png and thrall_eyes.png are 4 file pixels per game pixel
```

- The sprite keeps its place and size in the game; only the detail inside it gets finer. No position, frame size or
  hitbox changes.
- A sprite's `_tint` and `_eyes` files share its ratio, so redraw them at the same ratio (or list them separately).
- Ratios are whole numbers from 1 to 4, and the file's width and height must divide by the ratio. Otherwise the game
  warns in the console and draws the file at ratio 1.
- Frames, grips and pivots are still given in game pixels: a 4× character sheet is 352 x 312, with frames of 88 x 104.
- The dark outline stays one game pixel wide, so fine and coarse sprites sit together.
- The screen only renders finer when some art needs it, and never finer than the display can show. With the stock art
  nothing changes.
- An uploaded character sheet can be 88 x 78 or a whole multiple of it up to 4× (176 x 156, 264 x 234, 352 x 312); the
  game works out the ratio from the size. Online, it has to stay under 88 KB.

## Rules that apply to every sprite

- **Size is fixed.** Each kind of sprite has one grid size (below), in game pixels. A file at another size will not
  line up, unless it is a whole multiple drawn at that ratio (above).
- **Leave the outer one-pixel ring of each frame empty.** The game adds the dark outline itself.
- **`_tint` files are grey.** The game colours them with the item's or character's colour: grey 128 becomes
  exactly that colour, darker greys shade it, lighter greys highlight it.
- **A file without `_tint`** is drawn over the tinted one in its own colours (steel plates, sword hilts).

## Character sheets: 88 x 78

Four 22 x 26 frames across, three rows down. Facing left is the right-facing row mirrored.

|              | stand | step A | step B | attack |
|--------------|-------|--------|--------|--------|
| facing down  |       |        |        |        |
| facing up    |       |        |        |        |
| facing right |       |        |        |        |

The body centre is column 12 of a frame and the feet stand on row 22.

Layers, drawn bottom to top: `character/skin_tint`, `character/base`, `character/eyes_tint`,
`gear/boots_<type>`, `gear/armor_<type>`, `character/hair_<style>_tint`.

### Uploading your own character

In the character creator or the Gear panel, a player can upload one full-colour PNG of 88 x 78, or a whole multiple
of it up to 4× for finer art.
It replaces all of the layers above, so the character looks the same whatever gear is worn.
`assets/templates/character-template.png` is a starting point, and "Save a template" in the game exports the
current look in the same layout.

## Weapons: 31 x 11

Pointing right, with the hand on pixel (4, 5). `weapons/<type>_tint.png` is the blade, `weapons/<type>.png` the hilt.
The bow is three 16 x 17 frames side by side (arrow nocked, drawn back, just loosed) with the grip on (9, 8);
`bow_over.png` holds the string and arrow, which are drawn after the outline so they stay thin.

## Shields

`weapons/buckler.png` (three 9 x 9 frames) and `weapons/shield.png` (three 11 x 13 frames): the shield seen from the
front, from behind, and edge-on, in that order. They are drawn in their own colours.

## Enemies

One frame each, any size, with the one-pixel ring empty. `enemies/<name>_eyes.png` holds only the eyes, at the same
size, so the game can redraw them over the darkness.

The three skeletons (`skel` 20 x 23, `skelarcher` 18 x 21, `skelknight` 24 x 24 per frame) are sheets: three frames
across (step, other step, attack) and three rows down (facing down, up, right). Their `_eyes` files use the same layout.

## Regenerating the defaults

`python3 tools/make_sprites.py` rewrites every file here from the default art.

# Brand

The sources and the build of the Jiro-ikusu identity. The lockups, the banner, the social card and
the icons in [`web/public/`](../web/public/) are generated from the text files in [`src/`](src/)
by [`build.mjs`](build.mjs): never edit an output by hand. [`docs/STYLE_GUIDE.md`](../docs/STYLE_GUIDE.md)
holds the rules; `brand/src/` owns every coordinate, glyph bitmap, palette hex and checksum.

## Commands

```sh
node brand/build.mjs           # writes every output that is missing or stale
node brand/build.mjs --check   # writes nothing, and exits 1 when an output is stale
```

Node 22, built-ins only. Both commands rebuild every output in memory first, and stop with exit
code 1, writing nothing, when any of these fails:

- **Palette.** Every color of `CELL_COLORS` and `ENTITY_COLORS` in `web/src/render.ts`, each a
  quoted 6-digit hex, and every variable named after a token in any `:root` block of
  `web/src/style.css`, with its `var()` aliases followed, equals `palette.txt`. `--accent` must
  equal `claim`, and `--focus` must equal `player`. Colors written elsewhere in `style.css`, such
  as the link color, are not checked.
- **Legality.** Each scene is a legal game state one move before a capture (below).
- **Shelf.** The wordmark's shelf leaves at least one empty cell before any kana or tile.
- **Checksums.** The cell counts of each full-color lockup and of each scene equal its
  `checksum=` line. When a change to `src/` is meant to move a count, the error prints the new value.
- **Strays.** `web/public/brand/` holds only outputs: delete any file that `OUTPUTS` does not name,
  such as the old file of a renamed output. Hidden files are ignored.

`--check` also fails when an output on disk is stale: SVG and ICO byte for byte, PNG by its
decoded pixels. The decoder reads PNGs as this build writes them (8-bit RGB or RGBA, rows filtered
with None or Up, no ancillary chunks), and any other PNG counts as stale. So a zlib update never
makes a PNG stale, but it can make `favicon.ico`, whose entries are deflated PNGs: rerun the
build. CI runs `--check` in the web job. Commit the sources and the outputs in the same pull
request.

## Sources

| File | Holds |
|---|---|
| `palette.txt` | One line per token: `<letter> <token> <#hex> <role>`, hex in lowercase. The letter paints the token in a cell map; `-` marks a token never painted by hand: the computed art tones, the page tokens, and `invulnerable-player`, which only the game uses. SVG paths follow this order. |
| `glyphs-latin.txt` | Jiro Caps: the seven 16 × 20 capitals of the wordmark, J I R O K U S. |
| `glyphs-cjk.txt` | The ten glyphs of the name, ジロイクス and 极络益克司, and the thirteen of the card's Japanese and Chinese taglines, traced from Fusion Pixel (below). |
| `glyphs-pixel.txt` | The card's Latin tagline glyphs, C U T L A I M O and the full stop, traced from the same font. |
| `lockups.txt` | How lockups are colored, then the layout and checksum of each lockup: the wordmark, the primary (double ruby) and the stacked lockup. |
| `monogram.txt` | The 8 × 8 'First Cut' icon, in palette letters. |
| `banner.txt`, `social-card.txt` | The two scenes: a header, a blank line, then the scene's own cells in palette letters (frame, land, trail, player, boss and ghosts), as in `levels/src/`. |

A glyph is a line `= <char> <w>x<h> [advance=<n>] [font=<font> version=<version> lang=<lang>]`,
then `h` rows of `#` (ink) and `.`. Text moves on by `advance` cells, by `w` when it is absent.

`lockups.txt` starts with a paragraph of rules:

- `bands=<first>-<last>:<token>,…`: the color of a Jiro Caps core cell by its row (the lit capitals);
- `shelf=<depth>,<token>`: the wordmark's shelf;
- `hanzi-tile=<size>,<inset>`: the ロ tile each hanzi stands on, and the glyph's offset in it;
- `plate=<margin>`: the field plate's margin, inside its one-cell claim ring.

Then one paragraph per lockup: `lockup=<name>`; `size=<w>,<h>`, the box without the shelf;
placements, each at the top-left of its glyph box: `cap=<letter>,<x>,<y>`, `kana=<char>,<x>,<y>`,
`hanzi=<char>,<x>,<y>` (the tile's top-left), `hyphen=<x>,<y>,<length>` and
`place=<lockup>,<x>,<y>`, which places another lockup's placements; and `checksum=`.

A scene's header has `size=<w>,<h>`, `lockup=<name>,<x>,<y>`, one `text=<x>,<y>,<token>,<glyphs>`
per word (the top-left of the first glyph's box), and `checksum=`. A checksum is
`<token>:<count>,…` in palette order, with `transparent` for the empty cells of a lockup's box.
A paragraph gives each key once, but for the placements and `text=`, which repeat; the build stops
on a key that is unknown, repeated or missing.

## How cells are colored

1. **The capture rule as the type rule.** A glyph's ink cell with an empty 8-neighbour is its line,
   in `player`; its other ink cells are its core. The empty cells that the outside of the glyph
   cannot reach 4-connectedly are counters, in `claim`: README §4.8's fill, with the outside of
   the glyph box playing the boss's region.
2. **Full color.** A Jiro Caps core cell takes its row's band. Kana ink is all `player`. A hanzi
   stands on its tile: a `player` ring, a `claim` interior, the glyph in `player` at the inset. The
   hyphen is `trail`. Then the shelf: for k = 1 to the depth, every still-empty cell at
   (x + k, y + k) of a Jiro Caps or hyphen cell takes the shelf token, and the box grows where it
   reaches.
3. **Mono.** Only the line cells, the tile rings and the hanzi, in `player` (mono white) or `field`
   (mono black). No bands, no shelf.
4. **Plate.** The full-color lockup on a `field` rectangle, `plate` cells larger on every side,
   inside a one-cell `claim` ring.
5. **Scenes.** The cell map, then the full-color lockup and the text over it, then the halo:
   every `field` cell with a `player` cell among its 8 neighbours becomes `claim-deep`, then every
   remaining `field` cell with a `trail` cell among them becomes `trail-deep`.

A scene is legal when:

- its map holds only `field`, `claim`, `trail`, one `player`, the `boss` and its ghosts;
- the trail is one 4-connected line from a cell next to claimed land to the cell next to the
  player, and the player's next move, away from the trail, lands on claimed land;
- with the player counted as trail, the open cells (field, boss and ghosts) form 2 regions: the
  boss and its ghosts are in one, and every lockup cell lies on `field` in the other, the region
  that the closing move captures;
- no scene cell other than `field` lies within 2 cells of the lockup.

## Outputs

`OUTPUTS` in `build.mjs` lists every file with its art and its px per cell, and the canvas of the
two icons centered on claim (`apple-touch-icon.png`, `icon-maskable-512.png`). A file whose name
carries a size, such as `banner-960x240.png` or `icon-512.png`, must have it: the build stops
otherwise.

- **SVG:** a viewBox in cells, width and height at the output's px per cell,
  `shape-rendering="crispEdges"`, `role="img"` and a `<title>`; one `<path>` per color, made of
  rectangles (maximal horizontal runs, merged downward when the next row has the same run).
- **PNG:** painted straight from the cells at a whole number of px per cell, never resampled: 8-bit
  RGB, or RGBA when a cell is transparent.
- **ICO:** `favicon.ico` holds RGBA PNG entries of 16, 32 and 48 px.

## One-time recipes

The kana, the hanzi and the tagline glyphs were traced once from Fusion Pixel 12px Proportional SC
2024.05.12: npm `@fontsource/fusion-pixel-12px-proportional-sc@5.3.0` (tarball sha256
`51ca20a6606b38fe47f741b67fdb6306cee57722f2767ad353022d35b5626271`), file
`files/fusion-pixel-12px-proportional-sc-latin-400-normal.woff2` (602,304 bytes, sha256
`043eae5e616b0d1e75dc746d3d687b4413f9f1c70c1a09bc4ebb705ef1cc8e32`), which holds the whole font
despite its name. The font file is never served.

### Glyph extraction

One font pixel per cell: the font has 1,200 units per em, so 100 units per pixel at 12 px. A pixel
is ink when its center has a nonzero winding number.

- CJK: the 11 pixel rows whose top edges are 10 px down to 0 px above the baseline, and columns 0
  to 10 of the 12-px advance.
- Latin: the 9 cap rows, whose top edges are 9 px down to 1 px above the baseline, and columns 0 to
  the advance minus 1.

With fontTools (and brotli, for woff2), run as `python3 -I extract.py FONT cjk|latin CHARS`:

```python
import sys
from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont

font_path, mode, chars = sys.argv[1:4]
font = TTFont(font_path)
for char in dict.fromkeys(chars):
    name = font.getBestCmap()[ord(char)]
    pen = RecordingPen()
    font.getGlyphSet()[name].draw(pen)
    polygons = []
    for operator, points in pen.value:
        if operator == "moveTo":
            polygons.append([points[0]])
        elif operator == "lineTo":
            polygons[-1].append(points[0])
        elif operator not in ("closePath", "endPath"):
            raise ValueError(f"{char}: {operator}")
    advance = font["hmtx"][name][0] // 100
    tops, width = (range(10, -1, -1), 11) if mode == "cjk" else (range(9, 0, -1), advance)

    def winding(x, y):
        total = 0
        for polygon in polygons:
            for (x0, y0), (x1, y1) in zip(polygon, polygon[1:] + polygon[:1]):
                if (y0 <= y < y1 or y1 <= y < y0) and x0 + (y - y0) * (x1 - x0) / (y1 - y0) > x:
                    total += 1 if y1 > y0 else -1
        return total

    rows = ["".join("#" if winding((c + 0.5) * 100, (top - 0.5) * 100) else "." for c in range(width)) for top in tops]
    print(f"= {char} {width}x{len(rows)} advance={advance}")
    print("\n".join(rows))
```

Then add the `font=fusion-pixel-12px-proportional-sc version=2024.05.12` and `lang=` attributes.
No glyph has ink outside its rows and columns.

### Font subset

For Jiro Pixel 12, the UI's pixel face, which a later pull request ships: a renamed subset of the
same file, renamed because the font reserves its name.

1. Subset it to 106 code points:

   ```sh
   pyftsubset fusion-pixel-12px-proportional-sc-latin-400-normal.woff2 \
     --unicodes=U+0020-007E,U+00B7,U+00D7,U+2013,U+2014,U+2026,U+2190-2193,U+25A0,U+25A1 \
     --flavor=woff2 --layout-features='*' --name-IDs=0,1,2,3,4,5,6,13,14 --output-file=subset.woff2
   ```

2. Rename it with fontTools, keeping name records 0, 13 and 14: records 1 and 4 become
   `Jiro Pixel 12`, record 6 `JiroPixel12-Regular`, and record 3 `JiroPixel12-Regular;2024.05.12;subset`.
3. Save it as `web/public/fonts/jiro-pixel-12.woff2`, next to the package's `LICENSE`, copied whole
   as `web/public/fonts/LICENSE-fusion-pixel.txt`: it holds the licenses and notices of Fusion
   Pixel, of Ark Pixel and of the other fonts that Fusion Pixel draws on (Credits).

## Credits

The kana, the hanzi and the tagline glyphs are traced from
[Fusion Pixel Font](https://github.com/TakWolf/fusion-pixel-font) by TakWolf, which builds on
[Ark Pixel Font](https://github.com/TakWolf/ark-pixel-font) by TakWolf. Both are licensed under the
SIL Open Font License 1.1:

- "Copyright (c) 2022, TakWolf (https://takwolf.com), with Reserved Font Name 'Fusion Pixel'."
- "Copyright (c) 2021, TakWolf (https://takwolf.com), with Reserved Font Name 'Ark Pixel'."

The package's `LICENSE` also carries the notices of the other fonts that Fusion Pixel draws glyphs
from: Galmuri by Minseo Lee, Cubic 11, JF Dot M+H 12 (M+ FONTS PROJECT) and M+ BITMAP FONTS (COZ).

Jiro Caps, the lockups, the scenes and the monogram are project artwork, under the repository's
MIT license ([`LICENSE`](../LICENSE)).

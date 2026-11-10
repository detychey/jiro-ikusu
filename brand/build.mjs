// Builds the brand assets in web/public/ from the text sources in brand/src/ (brand/README.md).
//   node brand/build.mjs           writes every output that is missing or stale
//   node brand/build.mjs --check   writes nothing, and exits 1 when an output is stale
// Both exit 1, writing nothing, when a palette hex disagrees with web/src, a scene breaks a
// legality rule, the shelf touches a kana or a tile, a checksum differs, or web/public/brand/
// holds a file that is not an output. Node 22, built-ins only.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(import.meta.dirname, "src");
const PUBLIC = join(ROOT, "web", "public");
const TITLE = "Jiro-ikusu";

// Every output, at a whole number of px per cell; an SVG's width and height are at its px.
const OUTPUTS = [
  { file: "favicon.svg", art: "monogram", px: 2 },
  { file: "favicon.ico", art: "monogram", px: [2, 4, 6] },
  { file: "favicon-16.png", art: "monogram", px: 2 },
  { file: "favicon-32.png", art: "monogram", px: 4 },
  { file: "apple-touch-icon.png", art: "monogram", px: 22, canvas: 180, ground: "claim" },
  { file: "icon-192.png", art: "monogram", px: 24 },
  { file: "icon-512.png", art: "monogram", px: 64 },
  { file: "icon-maskable-512.png", art: "monogram", px: 36, canvas: 512, ground: "claim" },
  { file: "brand/banner.svg", art: "banner", px: 4 },
  { file: "brand/banner-960x240.png", art: "banner", px: 4 },
  { file: "brand/banner-1920x480.png", art: "banner", px: 8 },
  { file: "brand/social-card.svg", art: "social-card", px: 5, title: "Jiro-ikusu: Cut. Claim. Commit." },
  { file: "brand/social-card-1200x630.png", art: "social-card", px: 5 },
  { file: "brand/lockup-primary.svg", art: "primary", px: 2 },
  { file: "brand/lockup-primary-736x208.png", art: "primary", px: 4 },
  { file: "brand/lockup-primary-mono-white.svg", art: "primary/mono-white", px: 2 },
  { file: "brand/lockup-primary-mono-black.svg", art: "primary/mono-black", px: 2 },
  { file: "brand/lockup-primary-plate.svg", art: "primary/plate", px: 2 },
  { file: "brand/lockup-stacked.svg", art: "stacked", px: 2 },
  { file: "brand/wordmark.svg", art: "wordmark", px: 1 },
  { file: "brand/wordmark-mono-white.svg", art: "wordmark/mono-white", px: 1 },
  { file: "brand/wordmark-mono-black.svg", art: "wordmark/mono-black", px: 1 },
  { file: "brand/monogram.svg", art: "monogram", px: 2 },
  { file: "brand/avatar-400.png", art: "monogram", px: 50 },
];

const MONO_TOKENS = { "mono-white": "player", "mono-black": "field" };
const SCENE_TOKENS = ["field", "claim", "trail", "player", "boss", "boss-ghost-1", "boss-ghost-2"];
const OPEN_TOKENS = ["field", "boss", "boss-ghost-1", "boss-ghost-2"];
// The cell values of web/src/render.ts: EMPTY, CLAIMED, TRAIL, and BOSS_ZONE, which is drawn as EMPTY.
const CELL_COLOR_TOKENS = ["field", "claim", "trail", "field"];
// style.css :root names that alias a palette token.
const CSS_ALIASES = { accent: "claim", focus: "player" };
// The keys of the rules paragraph that opens lockups.txt.
const RULE_KEYS = ["bands", "shelf", "hanzi-tile", "plate"];
// Keys that a paragraph may repeat; any other key appears once.
const REPEATED_KEYS = ["cap", "kana", "hanzi", "hyphen", "place", "text"];
const NEIGHBOURS_4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEIGHBOURS_8 = [...NEIGHBOURS_4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const errors = [];

class Grid {
  constructor(w, h, fill = null) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(fill);
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.cells[y * this.w + x] : null;
  }

  set(x, y, token) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) {
      throw new Error(`cell (${x}, ${y}) is outside the ${this.w} × ${this.h} box`);
    }
    this.cells[y * this.w + x] = token;
  }

  /** The [x, y] of every cell that is not transparent. */
  inked() {
    const cells = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) if (this.get(x, y) !== null) cells.push([x, y]);
    }
    return cells;
  }

  paste(other, ox, oy) {
    for (const [x, y] of other.inked()) this.set(ox + x, oy + y, other.get(x, y));
  }

  /** A copy whose box is w × h, grown wherever an ink cell lies beyond it. */
  cropped(w, h) {
    const ink = this.inked();
    const grid = new Grid(Math.max(w, ...ink.map(([x]) => x + 1)), Math.max(h, ...ink.map(([, y]) => y + 1)));
    grid.paste(this, 0, 0);
    return grid;
  }

  counts() {
    const counts = new Map();
    for (const token of this.cells) counts.set(token ?? "transparent", (counts.get(token ?? "transparent") ?? 0) + 1);
    return counts;
  }
}

// ---- Sources

function readLines(name) {
  return readFileSync(join(SRC, name), "utf8").split(/\r?\n/);
}

function fail(where, message) {
  throw new Error(`${where}: ${message}`);
}

function integers(value, count, where) {
  const numbers = value.split(",").map(Number);
  if (numbers.length !== count || !numbers.every(Number.isInteger)) fail(where, `expected ${count} integers, got "${value}"`);
  return numbers;
}

/** Groups "key=value" lines into paragraphs of [key, value, where] fields; blank lines separate them. */
function paragraphs(name, lines) {
  const result = [[]];
  lines.forEach((line, index) => {
    if (line === "") {
      if (result.at(-1).length > 0) result.push([]);
      return;
    }
    const where = `brand/src/${name}:${index + 1}`;
    const match = /^([a-z-]+)=(.+)$/.exec(line);
    if (!match) fail(where, `expected key=value, got "${line}"`);
    if (!REPEATED_KEYS.includes(match[1]) && result.at(-1).some(([key]) => key === match[1])) {
      fail(where, `${match[1]}= appears twice in one paragraph`);
    }
    result.at(-1).push([match[1], match[2], where]);
  });
  return result.filter((fields) => fields.length > 0);
}

function readPalette() {
  const hex = new Map();
  const letters = new Map();
  readLines("palette.txt").forEach((line, index) => {
    if (line === "") return;
    const where = `brand/src/palette.txt:${index + 1}`;
    const match = /^(\S) ([a-z0-9-]+) (#[0-9a-f]{6}) \S/.exec(line);
    if (!match) fail(where, 'expected "<letter> <token> <#hex in lowercase> <role>"');
    const [, letter, token, value] = match;
    if (hex.has(token) || letters.has(letter)) fail(where, `${token} or ${letter} is listed twice`);
    hex.set(token, value);
    if (letter !== "-") letters.set(letter, token);
  });
  const rgb = new Map([...hex].map(([token, value]) => [token, [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16))]));
  return { hex, letters, rgb, order: [...hex.keys()] };
}

function readGlyphs(name) {
  const lines = readLines(name);
  const glyphs = new Map();
  for (let index = 0; index < lines.length; index++) {
    if (lines[index] === "") continue;
    const where = `brand/src/${name}:${index + 1}`;
    const match = /^= (\S+) (\d+)x(\d+)((?: [a-z]+=\S+)*)$/u.exec(lines[index]);
    if (!match) fail(where, 'expected "= <char> <w>x<h> [key=value]..."');
    const [w, h] = [Number(match[2]), Number(match[3])];
    const rows = lines.slice(index + 1, index + 1 + h);
    if (rows.length !== h || !rows.every((row) => row.length === w && /^[#.]+$/.test(row))) {
      fail(where, `expected ${h} rows of ${w} '#' or '.'`);
    }
    const advance = Number(/ advance=(\d+)/.exec(match[4])?.[1] ?? w);
    glyphs.set(match[1], { w, h, advance, rows });
    index += h;
  }
  return glyphs;
}

/** A cell map of palette letters whose first row is on line firstLine of the file. */
function readMap(name, rows, w, h, firstLine, palette) {
  if (rows.length !== h || !rows.every((row) => row.length === w)) fail(`brand/src/${name}`, `expected ${h} rows of ${w} cells`);
  const grid = new Grid(w, h);
  rows.forEach((row, y) => [...row].forEach((letter, x) => {
    const token = palette.letters.get(letter);
    if (!token) fail(`brand/src/${name}:${firstLine + y}`, `'${letter}' is not a palette letter`);
    grid.set(x, y, token);
  }));
  return grid;
}

function readChecksum(value, where, palette) {
  const counts = new Map();
  for (const entry of value.split(",")) {
    const [token, count] = entry.split(":");
    if ((!palette.hex.has(token) && token !== "transparent") || !/^\d+$/.test(count) || counts.has(token)) {
      fail(where, `bad checksum entry "${entry}"`);
    }
    counts.set(token, Number(count));
  }
  return counts;
}

function readBands(value, where, palette) {
  const bands = [];
  for (const band of value.split(",")) {
    const match = /^(\d+)-(\d+):([a-z0-9-]+)$/.exec(band);
    if (!match || Number(match[1]) !== bands.length || !palette.hex.has(match[3])) fail(where, `bad band "${band}"`);
    for (let row = Number(match[1]); row <= Number(match[2]); row++) bands.push(match[3]);
  }
  return bands;
}

function readLockups(palette) {
  const [ruleFields, ...lockupParagraphs] = paragraphs("lockups.txt", readLines("lockups.txt"));
  for (const [key, , where] of ruleFields) if (!RULE_KEYS.includes(key)) fail(where, `unknown rule ${key}`);
  const rule = (key) => {
    const field = ruleFields.find(([name]) => name === key) ?? fail("brand/src/lockups.txt", `no ${key}= rule`);
    return { value: field[1], where: field[2] };
  };
  const shelf = rule("shelf");
  const [shelfDepth, shelfToken] = shelf.value.split(",");
  if (!palette.hex.has(shelfToken)) fail(shelf.where, `${shelfToken} is not a palette token`);
  const tile = rule("hanzi-tile");
  const [tileSize, tileInset] = integers(tile.value, 2, tile.where);
  const lockups = new Map();
  for (const [[key, name, where], ...fields] of lockupParagraphs) {
    if (key !== "lockup") fail(where, "a lockup paragraph starts with lockup=<name>");
    const lockup = { items: [] };
    for (const [field, value, at] of fields) {
      const parts = value.split(",");
      if (field === "size") [lockup.w, lockup.h] = integers(value, 2, at);
      else if (field === "checksum") lockup.checksum = readChecksum(value, at, palette);
      else if (field === "hyphen") {
        const [x, y, length] = integers(value, 3, at);
        lockup.items.push({ kind: "hyphen", x, y, length });
      } else if (["cap", "kana", "hanzi", "place"].includes(field)) {
        const [x, y] = integers(parts.slice(1).join(","), 2, at);
        lockup.items.push({ kind: field, name: parts[0], x, y });
      } else fail(at, `unknown key ${field}`);
    }
    if (!lockup.w || !lockup.checksum) fail(where, "a lockup needs size= and checksum=");
    lockups.set(name, lockup);
  }
  const bands = rule("bands");
  const plateMargin = rule("plate");
  return {
    lockups,
    bands: readBands(bands.value, bands.where, palette),
    shelf: { depth: integers(shelfDepth, 1, shelf.where)[0], token: shelfToken },
    tile: { size: tileSize, inset: tileInset },
    plateMargin: integers(plateMargin.value, 1, plateMargin.where)[0],
  };
}

function readScene(name, palette) {
  const lines = readLines(`${name}.txt`);
  const blank = lines.indexOf("");
  if (blank < 0) fail(`brand/src/${name}.txt`, "a blank line separates the header from the cell map");
  const [header] = paragraphs(`${name}.txt`, lines.slice(0, blank));
  const scene = { name, texts: [] };
  for (const [key, value, where] of header) {
    const parts = value.split(",");
    if (key === "size") [scene.w, scene.h] = integers(value, 2, where);
    else if (key === "lockup") {
      const [x, y] = integers(parts.slice(1).join(","), 2, where);
      scene.lockup = { name: parts[0], x, y };
    } else if (key === "text") {
      const [x, y] = integers(parts.slice(0, 2).join(","), 2, where);
      const token = parts[2];
      if (!palette.hex.has(token)) fail(where, `${token} is not a palette token`);
      scene.texts.push({ x, y, token, chars: parts.slice(3).join(","), where });
    } else if (key === "checksum") scene.checksum = readChecksum(value, where, palette);
    else fail(where, `unknown key ${key}`);
  }
  if (!scene.w || !scene.lockup || !scene.checksum) fail(`brand/src/${name}.txt`, "a scene needs size=, lockup= and checksum=");
  const rows = lines.slice(blank + 1);
  if (rows.at(-1) === "") rows.pop();
  scene.map = readMap(`${name}.txt`, rows, scene.w, scene.h, blank + 2, palette);
  return scene;
}

function readSources() {
  const palette = readPalette();
  const monogramRows = readLines("monogram.txt");
  if (monogramRows.at(-1) === "") monogramRows.pop();
  return {
    palette,
    caps: readGlyphs("glyphs-latin.txt"),
    fontGlyphs: new Map([...readGlyphs("glyphs-cjk.txt"), ...readGlyphs("glyphs-pixel.txt")]),
    ...readLockups(palette),
    scenes: new Map(["banner", "social-card"].map((name) => [name, readScene(name, palette)])),
    monogram: readMap("monogram.txt", monogramRows, monogramRows[0].length, monogramRows.length, 1, palette),
  };
}

// ---- Glyphs and lockups

function isInk(glyph, x, y) {
  return glyph.rows[y]?.[x] === "#";
}

/** The empty cells of a glyph that the outside cannot reach 4-connectedly: README §4.8's fill, with
 * the outside of the glyph box playing the boss's region. */
function counters(glyph) {
  const w = glyph.w + 2;
  const reached = new Uint8Array(w * (glyph.h + 2));
  const stack = [[0, 0]];
  reached[0] = 1;
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of NEIGHBOURS_4) {
      const [nx, ny] = [x + dx, y + dy];
      if (nx < 0 || ny < 0 || nx >= w || ny >= glyph.h + 2) continue;
      if (reached[ny * w + nx] || isInk(glyph, nx - 1, ny - 1)) continue;
      reached[ny * w + nx] = 1;
      stack.push([nx, ny]);
    }
  }
  const cells = [];
  for (let y = 0; y < glyph.h; y++) {
    for (let x = 0; x < glyph.w; x++) if (!isInk(glyph, x, y) && !reached[(y + 1) * w + x + 1]) cells.push([x, y]);
  }
  return cells;
}

/** The capture rule as the type rule: ink with an empty 8-neighbour is the line; other ink is the
 * core, colored by its row; enclosed empty cells are counters. A null token leaves cells empty. */
function paintGlyph(grid, glyph, x0, y0, { line, core, counter }) {
  for (let y = 0; y < glyph.h; y++) {
    for (let x = 0; x < glyph.w; x++) {
      if (!isInk(glyph, x, y)) continue;
      const token = NEIGHBOURS_8.some(([dx, dy]) => !isInk(glyph, x + dx, y + dy)) ? line : core(y);
      if (token) grid.set(x0 + x, y0 + y, token);
    }
  }
  if (counter) for (const [x, y] of counters(glyph)) grid.set(x0 + x, y0 + y, counter);
}

function paintTile(grid, glyph, x0, y0, { size, inset }, mono) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ring = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      const token = ring ? (mono ?? "player") : mono ? null : "claim";
      if (token) grid.set(x0 + x, y0 + y, token);
    }
  }
  for (let y = 0; y < glyph.h; y++) {
    for (let x = 0; x < glyph.w; x++) if (isInk(glyph, x, y)) grid.set(x0 + inset + x, y0 + inset + y, mono ?? "player");
  }
}

function glyphOf(glyphs, name, where) {
  return glyphs.get(name) ?? fail(where, `no glyph for ${name}`);
}

/** A lockup's placements with nested lockups expanded, in absolute coordinates. */
function placements(lockups, name, ox = 0, oy = 0) {
  const lockup = lockups.get(name) ?? fail("brand/src/lockups.txt", `no lockup ${name}`);
  return lockup.items.flatMap((item) => item.kind === "place"
    ? placements(lockups, item.name, ox + item.x, oy + item.y)
    : [{ ...item, x: ox + item.x, y: oy + item.y }]);
}

/** Full color (mono null): lit Jiro Caps, white kana, hanzi on claimed tiles, the red hyphen, and the
 * wordmark's shelf. Mono: the line cells, the tile rims and the hanzi in one token. */
function paintLockup(sources, name, mono) {
  const { w, h, checksum } = sources.lockups.get(name);
  const where = `brand/src/lockups.txt, lockup ${name}`;
  const word = new Grid(w, h);
  const marks = new Grid(w, h);
  const lit = { line: "player", core: (row) => sources.bands[row] ?? fail(where, `no band for row ${row}`), counter: "claim" };
  const kana = { line: "player", core: () => "player", counter: "claim" };
  const single = { line: mono, core: () => null, counter: null };
  for (const item of placements(sources.lockups, name)) {
    if (item.kind === "cap") paintGlyph(word, glyphOf(sources.caps, item.name, where), item.x, item.y, mono ? single : lit);
    else if (item.kind === "kana") paintGlyph(marks, glyphOf(sources.fontGlyphs, item.name, where), item.x, item.y, mono ? single : kana);
    else if (item.kind === "hanzi") paintTile(marks, glyphOf(sources.fontGlyphs, item.name, where), item.x, item.y, sources.tile, mono);
    else for (let i = 0; i < item.length; i++) word.set(item.x + i, item.y, mono ?? "trail");
  }
  const depth = mono ? 0 : sources.shelf.depth;
  const grid = new Grid(w + depth, h + depth);
  grid.paste(marks, 0, 0);
  grid.paste(word, 0, 0);
  if (mono) return grid;
  addShelf(grid, word, marks, sources.shelf, where);
  const lockup = grid.cropped(w, h);
  checkCounts(where, lockup, checksum, sources.palette);
  return lockup;
}

/** For k = 1 to depth, every still-empty cell at (x + k, y + k) of a wordmark cell joins the shelf,
 * which must leave at least one empty cell before any kana or tile. */
function addShelf(grid, word, marks, { depth, token }, where) {
  let touches = false;
  for (let k = 1; k <= depth; k++) {
    for (const [x, y] of word.inked()) {
      if (grid.get(x + k, y + k) !== null) continue;
      grid.set(x + k, y + k, token);
      touches ||= NEIGHBOURS_8.some(([dx, dy]) => marks.get(x + k + dx, y + k + dy) !== null);
    }
  }
  if (touches) errors.push(`${where}: the shelf touches a kana or a tile`);
}

function plate(lockup, margin) {
  const grid = new Grid(lockup.w + 2 * margin + 2, lockup.h + 2 * margin + 2, "claim");
  for (let y = 1; y < grid.h - 1; y++) for (let x = 1; x < grid.w - 1; x++) grid.set(x, y, "field");
  grid.paste(lockup, margin + 1, margin + 1);
  return grid;
}

// ---- Scenes

function paintScene(sources, scene, lockup) {
  const where = `brand/src/${scene.name}.txt`;
  const art = new Grid(scene.w, scene.h);
  art.paste(scene.map, 0, 0);
  art.paste(lockup, scene.lockup.x, scene.lockup.y);
  for (const text of scene.texts) {
    let pen = text.x;
    for (const char of text.chars) {
      const glyph = glyphOf(sources.fontGlyphs, char, text.where);
      for (let y = 0; y < glyph.h; y++) {
        for (let x = 0; x < glyph.w; x++) if (isInk(glyph, x, y)) art.set(pen + x, text.y + y, text.token);
      }
      pen += glyph.advance;
    }
  }
  addHalo(art);
  checkLegality(where, scene.map, lockup.inked().map(([x, y]) => [scene.lockup.x + x, scene.lockup.y + y]));
  checkCounts(where, art, scene.checksum, sources.palette);
  return art;
}

/** Field cells next to white become claim-deep, then field cells next to red become trail-deep. */
function addHalo(grid) {
  for (const [source, halo] of [["player", "claim-deep"], ["trail", "trail-deep"]]) {
    const marked = grid.inked().filter(([x, y]) => grid.get(x, y) === "field"
      && NEIGHBOURS_8.some(([dx, dy]) => grid.get(x + dx, y + dy) === source));
    for (const [x, y] of marked) grid.set(x, y, halo);
  }
}

/** A scene is a legal game state one move before a capture: the rules are listed in brand/README.md. */
function checkLegality(where, map, lockupCells) {
  const broken = (rule) => errors.push(`${where}: ${rule}`);
  const cellsOf = (...tokens) => map.inked().filter(([x, y]) => tokens.includes(map.get(x, y)));
  if (cellsOf(...SCENE_TOKENS).length !== map.w * map.h) broken(`a scene holds only ${SCENE_TOKENS.join(", ")}`);
  const players = cellsOf("player");
  if (players.length !== 1) return broken("a scene holds one player cell");
  const [[px, py]] = players;
  const isTrail = (x, y) => map.get(x, y) === "trail";
  const trailNext = ([x, y], seen) => NEIGHBOURS_4.map(([dx, dy]) => [x + dx, y + dy])
    .filter(([nx, ny]) => isTrail(nx, ny) && !seen.has(ny * map.w + nx));
  const path = trailNext([px, py], new Set());
  if (path.length !== 1) return broken("the player is not at the end of one trail");
  const seen = new Set([path[0][1] * map.w + path[0][0]]);
  for (let next = trailNext(path[0], seen); next.length > 0; next = trailNext(path.at(-1), seen)) {
    if (next.length > 1) return broken(`the trail branches at (${path.at(-1)})`);
    path.push(next[0]);
    seen.add(next[0][1] * map.w + next[0][0]);
  }
  if (path.length !== cellsOf("trail").length) broken("the trail is not one 4-connected line");
  const [sx, sy] = path.at(-1);
  if (!NEIGHBOURS_4.some(([dx, dy]) => map.get(sx + dx, sy + dy) === "claim")) broken("the trail does not start next to claimed land");
  const [ex, ey] = path[0];
  if (map.get(2 * px - ex, 2 * py - ey) !== "claim") broken("the player's next move does not land on claimed land");

  const region = new Int32Array(map.w * map.h).fill(-1);
  let regions = 0;
  for (const [x0, y0] of cellsOf(...OPEN_TOKENS)) {
    if (region[y0 * map.w + x0] >= 0) continue;
    const stack = [[x0, y0]];
    region[y0 * map.w + x0] = regions;
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      for (const [nx, ny] of NEIGHBOURS_4.map(([dx, dy]) => [x + dx, y + dy])) {
        if (!OPEN_TOKENS.includes(map.get(nx, ny)) || region[ny * map.w + nx] >= 0) continue;
        region[ny * map.w + nx] = regions;
        stack.push([nx, ny]);
      }
    }
    regions++;
  }
  if (regions !== 2) broken(`the open field forms ${regions} region${regions === 1 ? "" : "s"}, not 2`);
  const regionOf = ([x, y]) => region[y * map.w + x];
  const bossRegion = cellsOf("boss").map(regionOf)[0];
  if (bossRegion === undefined || cellsOf("boss", "boss-ghost-1", "boss-ghost-2").some((cell) => regionOf(cell) !== bossRegion)) {
    broken("the boss and its ghosts are not all in the region the boss keeps");
  }
  if (lockupCells.some((cell) => map.get(...cell) !== "field" || regionOf(cell) === bossRegion)) {
    broken("the lockup is not inside the region that the closing move captures");
  }
  const crowded = lockupCells.some(([x, y]) => [-2, -1, 0, 1, 2].some((dy) => [-2, -1, 0, 1, 2]
    .some((dx) => ![null, "field"].includes(map.get(x + dx, y + dy)))));
  if (crowded) broken("the scene comes within 2 cells of the lockup");
}

function formatCounts(counts, palette) {
  return [...palette.order, "transparent"].filter((token) => counts.get(token))
    .map((token) => `${token}:${counts.get(token)}`).join(",");
}

function checkCounts(where, grid, expected, palette) {
  const [actual, wanted] = [formatCounts(grid.counts(), palette), formatCounts(expected, palette)];
  if (actual !== wanted) errors.push(`${where}: the checksum is ${actual}, the source says ${wanted}`);
}

// ---- The palette against web/src

function checkPalette(palette) {
  const compare = (where, value, token) => {
    const expected = palette.hex.get(token);
    if (!expected) errors.push(`${where}: ${token} is not in brand/src/palette.txt`);
    else if (value.toLowerCase() !== expected) errors.push(`${where} is ${value}, brand/src/palette.txt has ${token} ${expected}`);
  };
  // render.ts writes each color as a quoted 6-digit hex; any other value is reported, never skipped.
  const compareLiteral = (where, literal, token) => {
    const hex = /^(["'])(#[0-9a-fA-F]{6})\1$/.exec(literal)?.[2];
    if (hex) compare(where, hex, token);
    else errors.push(`${where} is ${literal}, not a quoted 6-digit hex color`);
  };
  const renderTs = readFileSync(join(ROOT, "web/src/render.ts"), "utf8");
  const cellColors = /CELL_COLORS = \[([^\]]*)\]/.exec(renderTs)?.[1];
  const entityColors = /ENTITY_COLORS = \{([^}]*)\}/.exec(renderTs)?.[1];
  if (cellColors === undefined || entityColors === undefined) fail("web/src/render.ts", "CELL_COLORS or ENTITY_COLORS not found");
  const cells = cellColors.split(",").map((literal) => literal.trim()).filter((literal) => literal !== "");
  if (cells.length !== CELL_COLOR_TOKENS.length) {
    errors.push(`web/src/render.ts: CELL_COLORS has ${cells.length} colors, brand/build.mjs maps ${CELL_COLOR_TOKENS.length}`);
  }
  CELL_COLOR_TOKENS.forEach((token, cell) => {
    if (cell < cells.length) compareLiteral(`web/src/render.ts CELL_COLORS[${cell}]`, cells[cell], token);
  });
  for (const [, key, literal] of entityColors.matchAll(/(\w+)\s*:\s*([^,\n]+)/g)) {
    const token = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    compareLiteral(`web/src/render.ts ENTITY_COLORS.${key}`, literal.trim(), token);
  }
  // Every :root block counts, a later one or one inside a media query included.
  const styleCss = readFileSync(join(ROOT, "web/src/style.css"), "utf8");
  const roots = [...styleCss.matchAll(/:root\b[^{}]*\{([^}]*)\}/g)].map(([, body]) => body);
  if (roots.length === 0) fail("web/src/style.css", ":root not found");
  const declarations = roots.flatMap((body) => [...body.matchAll(/--([\w-]+)\s*:\s*([^;]*?)\s*(?:;|$)/g)]
    .map(([, name, value]) => [name, value]));
  const variables = new Map(declarations);
  // An alias to a missing variable, or a cycle, stays unresolved and is reported as it is.
  const resolve = (value, seen = new Set()) => {
    const alias = /^var\(--([\w-]+)\)$/.exec(value);
    if (!alias || !variables.has(alias[1]) || seen.has(alias[1])) return value;
    seen.add(alias[1]);
    return resolve(variables.get(alias[1]), seen);
  };
  for (const [name, value] of declarations) {
    const token = palette.hex.has(name) ? name : CSS_ALIASES[name];
    if (token) compare(`web/src/style.css --${name}`, resolve(value), token);
  }
}

// ---- Encoders

function svg(grid, px, title, palette) {
  const paths = palette.order.map((token) => {
    const runs = new Map();
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        if (grid.get(x, y) !== token) continue;
        const start = x;
        while (grid.get(x + 1, y) === token) x++;
        runs.set(y * grid.w + start, x - start + 1);
      }
    }
    let d = "";
    for (const [start, width] of runs) {
      let height = 1;
      while (runs.get(start + height * grid.w) === width) runs.delete(start + height++ * grid.w);
      d += `M${start % grid.w} ${Math.floor(start / grid.w)}h${width}v${height}h-${width}z`;
    }
    return d && `<path fill="${palette.hex.get(token)}" d="${d}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid.w} ${grid.h}" width="${grid.w * px}" `
    + `height="${grid.h * px}" shape-rendering="crispEdges" role="img"><title>${title}</title>${paths.join("")}</svg>\n`;
}

/** Paints each cell as a px × px square, centered on a canvas of ground when one is given. RGBA when
 * a cell is transparent, RGB otherwise. */
function raster(grid, px, palette, { canvas, ground, channels } = {}) {
  const [width, height] = [canvas ?? grid.w * px, canvas ?? grid.h * px];
  const [padX, padY] = [(width - grid.w * px) / 2, (height - grid.h * px) / 2];
  if (!Number.isInteger(padX) || !Number.isInteger(padY) || padX < 0 || padY < 0) {
    throw new Error(`a ${grid.w} × ${grid.h} grid at ${px} px per cell does not center on a ${width}-px canvas`);
  }
  const depth = channels ?? (grid.cells.includes(null) ? 4 : 3);
  const data = Buffer.alloc(width * height * depth);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [cx, cy] = [Math.floor((x - padX) / px), Math.floor((y - padY) / px)];
      const inside = x >= padX && y >= padY && cx < grid.w && cy < grid.h;
      const token = inside ? grid.get(cx, cy) : ground;
      if (token === null) continue;
      const offset = (y * width + x) * depth;
      data.set(palette.rgb.get(token), offset);
      if (depth === 4) data[offset + 3] = 255;
    }
  }
  return { width, height, channels: depth, data };
}

function chunk(type, body) {
  const bytes = Buffer.alloc(12 + body.length);
  bytes.writeUInt32BE(body.length, 0);
  bytes.write(type, 4, "latin1");
  body.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, 8 + body.length)), 8 + body.length);
  return bytes;
}

/** Rows after the first use the Up filter: a row that repeats the one above, as most rows of a
 * cell do, becomes zeros. */
function encodePng({ width, height, channels, data }) {
  const stride = width * channels;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const line = y * (stride + 1);
    filtered[line] = y > 0 ? 2 : 0;
    for (let i = 0; i < stride; i++) filtered[line + 1 + i] = data[y * stride + i] - (y > 0 ? data[(y - 1) * stride + i] : 0);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  const compressed = deflateSync(filtered, { level: 9 });
  return Buffer.concat([PNG_SIGNATURE, chunk("IHDR", header), chunk("IDAT", compressed), chunk("IEND", Buffer.alloc(0))]);
}

/** Decodes a PNG as this build writes it: IHDR, IDAT and IEND only, 8-bit RGB or RGBA, rows
 * filtered with None or Up. */
function decodePng(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("no PNG signature");
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const end = offset + 12 + bytes.readUInt32BE(offset);
    if (end > bytes.length) throw new Error("a chunk runs past the end of the file");
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error(`${type} fails its CRC`);
    chunks.push({ type, body: bytes.subarray(offset + 8, end - 4) });
    offset = end;
  }
  const types = chunks.map(({ type }) => type);
  if (types[0] !== "IHDR" || types.at(-1) !== "IEND" || !types.slice(1, -1).every((type) => type === "IDAT")) {
    throw new Error(`unexpected chunks ${types.join(" ")}`);
  }
  const header = chunks[0].body;
  const [width, height] = [header.readUInt32BE(0), header.readUInt32BE(4)];
  if (header.length !== 13 || header[8] !== 8 || ![2, 6].includes(header[9]) || header.readUInt16BE(10) !== 0 || header[12] !== 0) {
    throw new Error("not an 8-bit RGB or RGBA PNG");
  }
  const channels = header[9] === 6 ? 4 : 3;
  const stride = width * channels;
  const filtered = inflateSync(Buffer.concat(chunks.slice(1, -1).map(({ body }) => body)));
  if (filtered.length !== (stride + 1) * height) throw new Error("wrong image data length");
  const data = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = filtered[y * (stride + 1)];
    if (filter !== 0 && filter !== 2) throw new Error(`row ${y} has filter ${filter}`);
    for (let i = 0; i < stride; i++) {
      data[y * stride + i] = filtered[y * (stride + 1) + 1 + i] + (filter === 2 && y > 0 ? data[(y - 1) * stride + i] : 0);
    }
  }
  return { width, height, channels, data };
}

/** An ICO whose entries are PNGs, in the order given. */
function encodeIco(pngs) {
  const directory = Buffer.alloc(6 + 16 * pngs.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(pngs.length, 4);
  let offset = directory.length;
  pngs.forEach(({ size, bytes }, index) => {
    const entry = 6 + 16 * index;
    directory.set([size, size], entry);
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(bytes.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += bytes.length;
  });
  return Buffer.concat([directory, ...pngs.map(({ bytes }) => bytes)]);
}

// ---- Outputs

function artBuilder(sources) {
  const arts = new Map();
  const build = (name) => {
    const [lockup, variant] = name.split("/");
    if (name === "monogram") return sources.monogram;
    if (sources.scenes.has(name)) {
      const scene = sources.scenes.get(name);
      return paintScene(sources, scene, art(scene.lockup.name));
    }
    if (variant === "plate") return plate(art(lockup), sources.plateMargin);
    return paintLockup(sources, lockup, variant ? MONO_TOKENS[variant] ?? fail(name, "unknown variant") : null);
  };
  const art = (name) => {
    if (!arts.has(name)) arts.set(name, build(name));
    return arts.get(name);
  };
  return art;
}

function render(output, art, palette) {
  const grid = art(output.art);
  const path = join(PUBLIC, output.file);
  if (extname(output.file) === ".svg") return { path, bytes: Buffer.from(svg(grid, output.px, output.title ?? TITLE, palette)) };
  if (extname(output.file) === ".ico") {
    const pngs = output.px.map((px) => ({ size: grid.w * px, bytes: encodePng(raster(grid, px, palette, { channels: 4 })) }));
    return { path, bytes: encodeIco(pngs) };
  }
  const image = raster(grid, output.px, palette, output);
  const named = /-(\d+)(?:x(\d+))?\.png$/.exec(output.file);
  if (named && (image.width !== Number(named[1]) || image.height !== Number(named[2] ?? named[1]))) {
    throw new Error(`${output.file} is ${image.width}x${image.height} px: rename it in OUTPUTS`);
  }
  return { path, image };
}

/** Why the file on disk differs from the output, or null when it is up to date: SVG and ICO byte
 * for byte, PNG by decoded pixels, so that a zlib update never makes a PNG stale. */
function staleness({ path, bytes, image }) {
  if (!existsSync(path)) return "missing";
  const disk = readFileSync(path);
  if (bytes) return disk.equals(bytes) ? null : "differs";
  let decoded;
  try {
    decoded = decodePng(disk);
  } catch (error) {
    return `unreadable: ${error.message}`;
  }
  const same = decoded.width === image.width && decoded.height === image.height
    && decoded.channels === image.channels && decoded.data.equals(image.data);
  return same ? null : "differs";
}

/** The files of web/public/brand/ that OUTPUTS does not name, such as a renamed output's old file.
 * Hidden files, which operating systems and editors leave, are not counted. */
function strays() {
  const folder = join(PUBLIC, "brand");
  if (!existsSync(folder)) return [];
  const named = new Set(OUTPUTS.map(({ file }) => file));
  return readdirSync(folder).filter((name) => !name.startsWith(".") && !named.has(`brand/${name}`))
    .map((name) => join(folder, name));
}

function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--check")) throw new Error("usage: node brand/build.mjs [--check]");
  const check = args[0] === "--check";
  const sources = readSources();
  checkPalette(sources.palette);
  const art = artBuilder(sources);
  const outputs = OUTPUTS.map((output) => render(output, art, sources.palette));
  const stale = outputs.map((output) => ({ output, reason: staleness(output) })).filter(({ reason }) => reason);
  for (const path of strays()) errors.push(`${relative(ROOT, path)} is not an output of brand/build.mjs: delete it`);
  if (check) {
    for (const { output, reason } of stale) errors.push(`${relative(ROOT, output.path)} is stale (${reason}): run node brand/build.mjs`);
  }
  if (errors.length > 0) {
    for (const error of errors) console.error(`error: ${error}`);
    process.exit(1);
  }
  for (const { output } of check ? [] : stale) {
    mkdirSync(dirname(output.path), { recursive: true });
    writeFileSync(output.path, output.bytes ?? encodePng(output.image));
    console.log(`wrote ${relative(ROOT, output.path)}`);
  }
  console.log(`brand: ${outputs.length} outputs, ${check || stale.length === 0 ? "all up to date" : `${stale.length} written`}`);
}

main();

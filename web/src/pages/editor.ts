// The level editor (plan M2.5): README §5's levels, painted and edited field by field. The
// editor has no format of its own: the core's codec turns its model into level bytes v1 and
// back, and the core validates the bytes and gives their level id after every change.

import openField from "../../../vectors/format/level-open-field.json";
import { type Core, fromHex, hex } from "../core";
import { describeError } from "../errors";
import {
  type Cell,
  FIELD_CELLS,
  isBorder,
  isObstacle,
  type Level,
  PLAYER_START,
  setObstacle,
  toggleMinion,
} from "../level";
import { element, fitField, loadCore, messageOf } from "../page";
import { cellRect, ENTITY_COLORS, type Rect, Renderer } from "../render";

/** What the core says about level bytes: valid, or the first rule they break (README §5). */
export function levelStatus(core: Core, bytes: Uint8Array): string {
  const code = core.validateLevel(bytes);
  return code === 0 ? "valid" : describeError(code);
}

/** The cell values at level start, row-major: the border and the obstacles CLAIMED (1), the
 *  rest EMPTY (0) (README §4.1). */
export function startCells(level: Level): Uint8Array {
  return Uint8Array.from({ length: FIELD_CELLS * FIELD_CELLS }, (_, i) => {
    const cell = { x: i % FIELD_CELLS, y: Math.floor(i / FIELD_CELLS) };
    return isBorder(cell) || isObstacle(level, cell) ? 1 : 0;
  });
}

const SPAWN_AREA_COLOR = "#ff3cf055";

/** The cells the boss body may cover from its spawn rectangle, the body at its first spawn cell,
 *  the minion spawns and the player start. */
function overlay(level: Level): Rect[] {
  const { bossSize, spawn } = level;
  return [
    cellRect(spawn.x0, spawn.y0, spawn.x1 - spawn.x0 + bossSize, spawn.y1 - spawn.y0 + bossSize, SPAWN_AREA_COLOR),
    cellRect(spawn.x0, spawn.y0, bossSize, bossSize, ENTITY_COLORS.boss),
    ...level.minionSpawns.slice(0, level.minionCount).map(({ x, y }) => cellRect(x, y, 1, 1, ENTITY_COLORS.minion)),
    cellRect(PLAYER_START.x, PLAYER_START.y, 1, 1, ENTITY_COLORS.player),
  ];
}

/** A numeric field of the form: its input's id and name, the largest value its bytes hold
 *  (README §5), and how it reads and writes the model. */
interface NumberField {
  id: string;
  name: string;
  max: number;
  get(level: Level): number;
  set(level: Level, value: number): void;
}

const U8 = 0xff;
const U16 = 0xffff;

const NUMBER_FIELDS: NumberField[] = [
  { id: "boss-size", name: "Body size B", max: U8, get: (l) => l.bossSize, set: (l, v) => void (l.bossSize = v) },
  { id: "spawn-x0", name: "Spawn x0", max: U8, get: (l) => l.spawn.x0, set: (l, v) => void (l.spawn.x0 = v) },
  { id: "spawn-y0", name: "Spawn y0", max: U8, get: (l) => l.spawn.y0, set: (l, v) => void (l.spawn.y0 = v) },
  { id: "spawn-x1", name: "Spawn x1", max: U8, get: (l) => l.spawn.x1, set: (l, v) => void (l.spawn.x1 = v) },
  { id: "spawn-y1", name: "Spawn y1", max: U8, get: (l) => l.spawn.y1, set: (l, v) => void (l.spawn.y1 = v) },
  { id: "boss-period", name: "Boss move period", max: U8, get: (l) => l.bossPeriod, set: (l, v) => void (l.bossPeriod = v) },
  { id: "minion-period", name: "Minion move period", max: U8, get: (l) => l.minionPeriod, set: (l, v) => void (l.minionPeriod = v) },
  { id: "respawn-delay", name: "Respawn delay R", max: U16, get: (l) => l.respawnDelay, set: (l, v) => void (l.respawnDelay = v) },
  { id: "time-limit", name: "Time limit T", max: U16, get: (l) => l.timeLimit, set: (l, v) => void (l.timeLimit = v) },
  { id: "lives", name: "Lives", max: U8, get: (l) => l.lives, set: (l, v) => void (l.lives = v) },
  { id: "target", name: "Target", max: U16, get: (l) => l.targetBp, set: (l, v) => void (l.targetBp = v) },
];

type Tool = "obstacle" | "erase" | "minion";

/** Runs the page: editor.html. */
export function mount(): void {
  const canvas = element<HTMLCanvasElement>("field");
  const status = element<HTMLParagraphElement>("status");
  const message = element<HTMLParagraphElement>("message");
  const hexOut = element<HTMLTextAreaElement>("hex-out");
  const play = element<HTMLAnchorElement>("play");
  const renderer = new Renderer(canvas);
  let core: Core;
  let level: Level;
  let bytes: Uint8Array<ArrayBuffer>;
  let painting = false;

  const tool = () => (element<HTMLFormElement>("tools").elements.namedItem("tool") as RadioNodeList).value as Tool;

  /** Encodes, validates and shows the level after a change. */
  function update(): void {
    bytes = core.encodeLevel(level);
    const cells = startCells(level);
    renderer.drawCells(cells, cells.keys());
    renderer.show(overlay(level));
    const verdict = levelStatus(core, bytes);
    status.textContent = verdict === "valid" ? "Valid level." : `Invalid: ${verdict}.`;
    status.classList.toggle("error", verdict !== "valid");
    element("level-id").textContent = hex(core.levelId(bytes));
    element("minions").textContent =
      level.minionSpawns
        .slice(0, level.minionCount)
        .map(({ x, y }) => `(${x}, ${y})`)
        .join(", ") || "none";
    hexOut.value = hex(bytes);
    play.hidden = verdict !== "valid";
    play.href = `./?hex=${hex(bytes)}&autoplay`;
    showFields();
  }

  function showFields(): void {
    for (const field of NUMBER_FIELDS) element<HTMLInputElement>(field.id).value = String(field.get(level));
  }

  /** Applies a change to a copy of the model. A change its bytes cannot hold leaves the model,
   *  and the form, as they were, and says why. */
  function change(edit: (draft: Level) => void): void {
    const draft = structuredClone(level);
    try {
      edit(draft);
      core.encodeLevel(draft);
    } catch (error) {
      message.textContent = messageOf(error);
      showFields();
      return;
    }
    message.textContent = "";
    level = draft;
    update();
  }

  function cellAt(event: PointerEvent): Cell | undefined {
    const box = canvas.getBoundingClientRect();
    const x = Math.floor(((event.clientX - box.left) / box.width) * FIELD_CELLS);
    const y = Math.floor(((event.clientY - box.top) / box.height) * FIELD_CELLS);
    return x >= 0 && y >= 0 && x < FIELD_CELLS && y < FIELD_CELLS ? { x, y } : undefined;
  }

  function paint(event: PointerEvent): void {
    const cell = cellAt(event);
    if (cell === undefined || tool() === "minion") return;
    const obstacle = tool() === "obstacle";
    if (isObstacle(level, cell) !== obstacle) change((draft) => setObstacle(draft, cell, obstacle));
  }

  function importBytes(imported: Uint8Array): void {
    const decoded = core.decodeLevel(imported);
    if ("code" in decoded) {
      message.textContent = `Not imported: ${describeError(decoded.code)}.`;
      return;
    }
    message.textContent = "";
    level = decoded;
    update();
  }

  function download(): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    link.download = "level.bin";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async function start(): Promise<void> {
    core = await loadCore();
    fitField(renderer);
    window.addEventListener("resize", () => fitField(renderer));
    canvas.addEventListener("pointerdown", (event) => {
      const cell = cellAt(event);
      if (cell === undefined) return;
      if (tool() === "minion") {
        change((draft) => {
          if (!toggleMinion(draft, cell)) throw new Error("a level has at most 3 minions: remove one first");
        });
        return;
      }
      painting = true;
      canvas.setPointerCapture(event.pointerId);
      paint(event);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (painting) paint(event);
    });
    canvas.addEventListener("pointerup", () => {
      painting = false;
    });
    for (const field of NUMBER_FIELDS) {
      const input = element<HTMLInputElement>(field.id);
      input.addEventListener("change", () =>
        change((draft) => {
          const value = input.valueAsNumber;
          if (!Number.isInteger(value) || value < 0 || value > field.max) {
            throw new Error(`${field.name}: a whole number from 0 to ${field.max}`);
          }
          field.set(draft, value);
        }),
      );
    }
    element<HTMLInputElement>("import-file").addEventListener("change", async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file !== undefined) importBytes(new Uint8Array(await file.arrayBuffer()));
    });
    element("import-hex").addEventListener("click", () => {
      try {
        importBytes(fromHex(element<HTMLTextAreaElement>("hex-in").value.trim()));
      } catch (error) {
        message.textContent = messageOf(error);
      }
    });
    element("download").addEventListener("click", download);
    element("new").addEventListener("click", () => importBytes(fromHex(openField.input)));
    importBytes(fromHex(openField.input));
  }

  start().catch((error: unknown) => {
    message.textContent = messageOf(error);
  });
}

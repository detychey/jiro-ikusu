// Training (README §8.1, plan M2.10), the game page: picks a level, plays it in Training mode
// on the tick clock with the bound keys, draws the field and the HUD, and ends on the outcome,
// the state hash, the score and the journal download. The 16 levels are scored as a season
// scores them (README §8.4): the core replays the attempt's journal with the level's weight from
// seasons/calibration-1.json, and each level's best score stays in localStorage. Other levels
// play unscored. Once the engine and the levels have loaded, the page makes no network call. The
// canvas exposes the state hash, the ticks used and the end reason in data attributes, for the
// smoke test.

import calibration from "../../../seasons/calibration-1.json";
import openField from "../../../vectors/format/level-open-field.json";
import wallsAndMinions from "../../../vectors/format/level-walls-and-minions.json";
import { type Core, CoreError, type EndReason, fromHex, hex } from "../core";
import {
  type Bindings,
  type Control,
  CONTROLS,
  HeldKeys,
  loadBindings,
  rebind,
  saveBindings,
} from "../input";
import type { Loop } from "../loop";
import { element, fitField, loadCore, messageOf, percent } from "../page";
import { Renderer } from "../render";
import { runNonce, startSession } from "../session";
import { browserStorage, load, save, type Storage } from "../storage";

const BUNDLED_LEVELS: Record<string, string> = import.meta.glob("../../../levels/*.bin", {
  query: "?url",
  import: "default",
  eager: true,
});

/** The scoring of a calibration file (README §8.4): its rules version, and the level ids and
 *  weights of the 16 levels in index order. */
export interface Calibration {
  rulesVersion: number;
  levelIds: string[];
  weightsBp: number[];
}

/** One of the 16 levels: its name, its bytes, its level id and its weight. */
export interface TrainingLevel {
  name: string;
  level: Uint8Array;
  levelId: string;
  weightBp: number;
}

/** The 16 levels with their weights. `bundled` are the page's levels by name, in index order,
 *  and must be the calibration's under the engine's rules version: otherwise the page would show
 *  scores that no season gives, so it throws. */
export function trainingLevels(core: Core, scoring: Calibration, bundled: [string, Uint8Array][]): TrainingLevel[] {
  if (scoring.rulesVersion !== core.rulesVersion) {
    throw new Error(`the calibration is for rules version ${scoring.rulesVersion}, the engine runs ${core.rulesVersion}`);
  }
  const levels = bundled.map(([name, level], i) => ({
    name,
    level,
    levelId: hex(core.levelId(level)),
    weightBp: scoring.weightsBp[i],
  }));
  const ids = scoring.levelIds;
  if (levels.length !== ids.length || levels.some(({ levelId, weightBp }, i) => levelId !== ids[i] || weightBp === undefined)) {
    throw new Error("the bundled levels are not the calibration's 16 levels");
  }
  return levels as TrainingLevel[];
}

/** An attempt's level score (README §8.4), as the referee computes it: the core replays its
 *  journal with the level's weight. The page recorded the journal, so a rejection throws. */
export function attemptScore(core: Core, level: Uint8Array, journal: Uint8Array, weightBp: number): number {
  const replayed = core.replay(level, journal, weightBp);
  if ("code" in replayed) throw new CoreError("replay", replayed.code);
  return replayed.outcome.levelScore;
}

/** The best score of each level, by `bestKey`. */
export type Bests = Record<string, number>;

const BESTS_KEY = "jiro-ikusu.training-bests";

/** A best counts only under the scoring it was made with: the rules version, the level id and
 *  the weight, so a new calibration or rules version starts every level afresh. */
export function bestKey(rulesVersion: number, levelId: string, weightBp: number): string {
  return `${rulesVersion}/${levelId}/${weightBp}`;
}

function isBests(value: unknown): value is Bests {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((score) => Number.isInteger(score) && score >= 0);
}

/** The stored bests, or none when storage is missing, unreadable or invalid. */
export function loadBests(storage: Storage | undefined): Bests {
  return load(storage, BESTS_KEY, isBests, () => ({}));
}

/** Stores the bests; returns false when storage is missing or refuses, which keeps them for this
 *  page only. */
export function saveBests(storage: Storage | undefined, bests: Bests): boolean {
  return save(storage, BESTS_KEY, bests);
}

/** Whether `score` is a new best: it beats `best`, or is the level's first score. */
export function beats(score: number, best: number | undefined): boolean {
  return best === undefined || score > best;
}

/** The end screen's score line: the level score, against the best before the attempt. */
export function scoreLine(score: number, best: number | undefined): string {
  if (best === undefined) return `Score ${score}, the first on this level.`;
  return beats(score, best) ? `Score ${score}, a new best (was ${best}).` : `Score ${score}. Best ${best}.`;
}

const CONTROL_NAMES: Record<Control, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  a: "A (fast cut)",
  b: "B (shield)",
  x: "X (commit)",
};

/** The picker's name for the level of the `hex` parameter, which the editor's Play button sets. */
const EDITED_LEVEL = "Edited level";

/** The level in play: its name, its bytes, and its weight if it is one of the 16 levels. */
interface Attempt {
  name: string;
  level: Uint8Array;
  levelId: string;
  weightBp: number | undefined;
}

/** Runs the page: index.html. */
export function mount(): void {
  const canvas = element<HTMLCanvasElement>("field");
  const levelSelect = element<HTMLSelectElement>("level");
  const levelFile = element<HTMLInputElement>("level-file");
  const setupError = element<HTMLParagraphElement>("setup-error");
  const endScreen = element<HTMLDivElement>("end");

  const params = new URLSearchParams(location.search);
  const storage = browserStorage();

  let bindings: Bindings = loadBindings(storage);
  const keys = new HeldKeys(bindings);
  const renderer = new Renderer(canvas);
  /** The picker's levels, by name. */
  const levels = new Map<string, () => Uint8Array>();
  let training: TrainingLevel[] = [];
  let bests = loadBests(storage);
  let core: Core;
  let fixedNonce: Uint8Array | undefined;
  let loop: Loop<EndReason> | undefined;
  let attempt: Attempt | undefined;
  let journal = new Uint8Array();
  let rebinding: Control | undefined;

  async function main(): Promise<void> {
    const nonce = params.get("nonce");
    if (nonce !== null) fixedNonce = fromHex(nonce);
    core = await loadCore();
    await listLevels();
    showBindings();
    fitField(renderer);
    window.addEventListener("resize", () => fitField(renderer));
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", (event) => keys.up(event.code));
    window.addEventListener("blur", () => keys.clear());
    levelSelect.addEventListener("change", () => {
      levelFile.value = "";
    });
    element<HTMLFormElement>("setup").addEventListener("submit", (event) => {
      event.preventDefault();
      void play();
    });
    element("again").addEventListener("click", () => void play());
    element("download").addEventListener("click", downloadJournal);
    if (params.has("autoplay")) await play();
  }

  /** Loads the 16 levels, checks them against the calibration, and lists them, then the other
   *  levels, which play unscored. */
  async function listLevels(): Promise<void> {
    const bundled = await Promise.all(
      Object.entries(BUNDLED_LEVELS)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(async ([path, url]): Promise<[string, Uint8Array]> => [path.replace(/^.*\//, "").replace(/\.bin$/, ""), await fetchLevel(url)]),
    );
    training = trainingLevels(core, calibration, bundled);
    const scored = document.createElement("optgroup");
    scored.label = "Training: the 16 levels";
    const others = document.createElement("optgroup");
    others.label = "Other levels, not scored";
    for (const { name, level } of training) {
      levels.set(name, () => level);
      scored.append(new Option(name, name));
    }
    const other = (name: string, input: string) => {
      levels.set(name, () => fromHex(input));
      others.append(new Option(name, name));
    };
    const edited = params.get("hex");
    if (edited !== null) other(EDITED_LEVEL, edited);
    other("Open field", openField.input);
    other("Walls and minions", wallsAndMinions.input);
    levelSelect.append(scored, others);
    showBests();
    const asked = edited !== null ? EDITED_LEVEL : params.get("level");
    if (asked !== null && levels.has(asked)) levelSelect.value = asked;
  }

  async function fetchLevel(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`could not load the level ${url} (${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  /** Each of the 16 levels in the picker, with its best under the current scoring. */
  function showBests(): void {
    for (const { name, levelId, weightBp } of training) {
      const option = Array.from(levelSelect.options).find((candidate) => candidate.value === name);
      const best = bests[bestKey(core.rulesVersion, levelId, weightBp)];
      if (option !== undefined) option.text = best === undefined ? name : `${name} (best ${best})`;
    }
  }

  async function chosenLevel(): Promise<[string, Uint8Array]> {
    const file = levelFile.files?.[0];
    if (file !== undefined) return [file.name.replace(/\.bin$/, ""), new Uint8Array(await file.arrayBuffer())];
    const level = levels.get(levelSelect.value);
    if (level === undefined) throw new Error("choose a level");
    return [levelSelect.value, level()];
  }

  async function play(): Promise<void> {
    setupError.textContent = "";
    try {
      const [name, level] = await chosenLevel();
      const levelId = hex(core.levelId(level));
      const weightBp = training.find((scored) => scored.levelId === levelId)?.weightBp;
      loop = startSession(core, level, runNonce(fixedNonce), keys, () => performance.now());
      attempt = { name, level, levelId, weightBp };
    } catch (error) {
      setupError.textContent = messageOf(error);
      return;
    }
    endScreen.hidden = true;
    keys.clear();
    canvas.dataset.ticksUsed = "0";
    delete canvas.dataset.endReason;
    canvas.focus();
    requestAnimationFrame(frame);
  }

  function frame(): void {
    if (loop === undefined) return;
    const ranBefore = loop.ticksRun;
    const end = loop.pump();
    if (loop.ticksRun !== ranBefore) {
      renderer.drawCells(core.grid(), core.dirtyCells());
      const snapshot = core.snapshot();
      renderer.frame(snapshot);
      showHud(snapshot.claimBp, snapshot.targetBp, snapshot.lives, snapshot.shield, snapshot.ticksLeft);
      canvas.dataset.stateHash = hex(core.stateHash());
      canvas.dataset.ticksUsed = String(snapshot.ticksUsed);
    }
    if (end === undefined) {
      requestAnimationFrame(frame);
    } else {
      showEnd(end);
    }
  }

  function showHud(claimBp: number, targetBp: number, lives: number, shield: number, ticksLeft: number): void {
    element("hud-claim").textContent = `${percent(claimBp)} of ${percent(targetBp)}`;
    element("hud-lives").textContent = String(lives);
    element("hud-shield").textContent = String(shield);
    element("hud-time").textContent = `${Math.ceil(ticksLeft / 15)} s`;
  }

  function showEnd(end: EndReason): void {
    const { claimBp, ticksUsed } = core.snapshot();
    const stateHash = hex(core.stateHash());
    journal = core.journal();
    canvas.dataset.endReason = end;
    element("end-title").textContent = end;
    element("end-detail").textContent = `Claim ${percent(claimBp)} after ${ticksUsed} ticks.`;
    element("end-score").textContent = attempt === undefined ? "" : scoreOf(attempt);
    element("end-hash").textContent = stateHash.slice(0, 18);
    element("end-hash").title = stateHash;
    endScreen.hidden = false;
    loop = undefined;
  }

  /** Scores the attempt that just ended and keeps a new best. */
  function scoreOf({ level, levelId, weightBp }: Attempt): string {
    if (weightBp === undefined) return "Not one of the 16 levels, so not scored.";
    const score = attemptScore(core, level, journal, weightBp);
    const key = bestKey(core.rulesVersion, levelId, weightBp);
    const line = scoreLine(score, bests[key]);
    if (!beats(score, bests[key])) return line;
    bests = { ...bests, [key]: score };
    showBests();
    return saveBests(storage, bests) ? line : `${line} Best kept for this page only.`;
  }

  function downloadJournal(): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([journal], { type: "application/octet-stream" }));
    link.download = `${attempt?.name ?? "level"}.jrn`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function onKey(event: KeyboardEvent): void {
    if (rebinding !== undefined) {
      event.preventDefault();
      finishRebinding(rebinding, event.code);
      return;
    }
    // Bound keys belong to the game only during play, so the form stays usable between games.
    if (loop !== undefined && CONTROLS.some((control) => bindings[control] === event.code)) {
      event.preventDefault();
    }
    keys.down(event.code);
  }

  function showBindings(): void {
    const table = element<HTMLTableElement>("bindings");
    table.replaceChildren();
    for (const control of CONTROLS) {
      const row = table.insertRow();
      row.insertCell().textContent = CONTROL_NAMES[control];
      row.insertCell().textContent = bindings[control];
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = rebinding === control ? "Press a key…" : "Rebind";
      button.addEventListener("click", () => {
        rebinding = control;
        showBindings();
      });
      row.insertCell().append(button);
    }
  }

  function finishRebinding(control: Control, code: string): void {
    rebinding = undefined;
    const result = rebind(bindings, control, code);
    const message = element("bindings-message");
    if (typeof result === "string") {
      message.textContent = result;
    } else {
      bindings = result;
      keys.setBindings(bindings);
      message.textContent = saveBindings(storage, bindings) ? "" : "Bindings kept for this page only.";
    }
    showBindings();
  }

  main().catch((error: unknown) => {
    setupError.textContent = messageOf(error);
  });
}

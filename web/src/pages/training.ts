// Training (README §8.1, plan M2.10), the game page: picks a level, plays it in Training mode
// on the tick clock with the bound keys and, on touchscreens, the touch controls, draws the field and the HUD, and ends on the outcome,
// the state hash, the score and the journal download. The 16 levels are scored as a season
// scores them (README §8.4): the core replays the attempt's journal with the level's weight from
// seasons/calibration-1.json, and each level's best score stays in localStorage. Other levels
// play unscored. Once the engine and the levels have loaded, the page makes no network call. The
// canvas exposes the state hash, the ticks used and the end reason in data attributes, for the
// smoke test.

import calibration from "../../../seasons/calibration-1.json";
import { type Core, CoreError, type EndReason, fromHex, hex } from "../core";
import {
  type Bindings,
  combined,
  type Control,
  CONTROLS,
  defaultBindings,
  HeldKeys,
  type KeyboardLayout,
  keyboardLayout,
  keyLabel,
  loadBindings,
  rebind,
  saveBindings,
} from "../input";
import type { Loop } from "../loop";
import { element, fitField, loadCore, messageOf, percent, showHud } from "../page";
import { Renderer } from "../render";
import { runNonce, startSession } from "../session";
import { shippedLevels, TEST_LEVELS, type TrainingLevel, trainingLevels } from "../shipped";
import { browserStorage, load, save, type Storage } from "../storage";
import { loadTouchSetting, mountTouchControls, saveTouchSetting, showTouchSetting, TOUCH_SETTINGS } from "../touch";

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

/** The bests of both, with the higher score of each level. */
export function mergeBests(bests: Bests, others: Bests): Bests {
  const merged = { ...bests };
  for (const [key, score] of Object.entries(others)) {
    if (beats(score, merged[key])) merged[key] = score;
  }
  return merged;
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

/** The controls panel's note on how it names the keys. */
function layoutNote(layout: KeyboardLayout | undefined): string {
  if (layout !== undefined) return "The default keys and their names follow your keyboard layout.";
  return "Your browser doesn't tell the page your keyboard layout, so keys are named by their place on a QWERTY keyboard: on AZERTY, A (QWERTY) is the key marked Q. Rebind any control below.";
}

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
  const input = combined(keys, mountTouchControls());
  /** The layout the browser reports, or else what the keys pressed on this page printed. */
  let layout: KeyboardLayout | undefined;
  const printedHere = new Map<string, string>();
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
    layout = await keyboardLayout();
    bindings = loadBindings(storage, defaultBindings(layout));
    keys.setBindings(bindings);
    element("layout-note").textContent = layoutNote(layout);
    showBindings();
    showTouchSetting(loadTouchSetting(storage));
    fitField(renderer);
    window.addEventListener("resize", () => fitField(renderer));
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", (event) => keys.up(event.code));
    window.addEventListener("blur", () => keys.clear());
    for (const setting of TOUCH_SETTINGS) {
      element(`touch-${setting}`).addEventListener("change", () => {
        showTouchSetting(setting);
        element("touch-message").textContent = saveTouchSetting(storage, setting) ? "" : "Setting kept for this page only.";
      });
    }
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
    training = trainingLevels(core, calibration, await shippedLevels());
    const scored = document.createElement("optgroup");
    scored.label = "Training: the 16 levels";
    const others = document.createElement("optgroup");
    others.label = "Other levels";
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
    for (const [name, input] of TEST_LEVELS) other(name, input);
    levelSelect.append(scored, others);
    showBests();
    const asked = edited !== null ? EDITED_LEVEL : params.get("level");
    if (asked !== null && levels.has(asked)) levelSelect.value = asked;
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
      loop = startSession(core, level, runNonce(fixedNonce), input, () => performance.now());
      attempt = { name, level, levelId, weightBp };
    } catch (error) {
      setupError.textContent = messageOf(error);
      return;
    }
    endScreen.hidden = true;
    input.clear();
    canvas.dataset.ticksUsed = "0";
    delete canvas.dataset.endReason;
    canvas.focus();
    // focus() only brings the field's bottom into view: Play puts its top at the top of the
    // viewport, past the banner, with no animation (docs/STYLE_GUIDE.md §8, §10).
    canvas.scrollIntoView({ block: "start", behavior: "instant" });
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
      showHud(snapshot);
      canvas.dataset.stateHash = hex(core.stateHash());
      canvas.dataset.ticksUsed = String(snapshot.ticksUsed);
    }
    if (end === undefined) {
      requestAnimationFrame(frame);
    } else {
      showEnd(end);
    }
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
    // Another tab may have stored bests since this page loaded them.
    bests = mergeBests(bests, loadBests(storage));
    const line = scoreLine(score, bests[key]);
    const isBest = beats(score, bests[key]);
    if (isBest) bests = { ...bests, [key]: score };
    showBests();
    return !isBest || saveBests(storage, bests) ? line : `${line} Best kept for this page only.`;
  }

  function downloadJournal(): void {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([journal], { type: "application/octet-stream" }));
    link.download = `${attempt?.name ?? "level"}.jrn`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key.length === 1) printedHere.set(event.code, event.key);
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
      row.insertCell().textContent = keyLabel(bindings[control], layout ?? printedHere);
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
    const result = rebind(bindings, control, code, keyLabel(code, layout ?? printedHere));
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

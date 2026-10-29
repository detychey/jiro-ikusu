// The browser game: picks a level, plays it on the tick clock with the bound keys, draws the
// field and the HUD, and ends on the outcome, the state hash and the journal download. The
// canvas exposes the state hash, the ticks used and the end reason in data attributes, for the
// smoke test.

import openField from "../../vectors/format/level-open-field.json";
import wallsAndMinions from "../../vectors/format/level-walls-and-minions.json";
import { Core, type EndReason, fromHex, hex } from "./core";
import {
  type Bindings,
  type Control,
  CONTROLS,
  HeldKeys,
  loadBindings,
  rebind,
  saveBindings,
} from "./input";
import type { Loop } from "./loop";
import { Renderer } from "./render";
import { runNonce, startSession } from "./session";

const WASM_URL = new URL("../../target/wasm32-unknown-unknown/release/jiro_wasm.wasm", import.meta.url);

const BUNDLED_LEVELS: Record<string, string> = import.meta.glob("../../levels/*.bin", {
  query: "?url",
  import: "default",
  eager: true,
});

const CONTROL_NAMES: Record<Control, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right",
  a: "A (fast cut)",
  b: "B (shield)",
  x: "X (commit)",
};

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

const canvas = element<HTMLCanvasElement>("field");
const levelSelect = element<HTMLSelectElement>("level");
const levelFile = element<HTMLInputElement>("level-file");
const setupError = element<HTMLParagraphElement>("setup-error");
const endScreen = element<HTMLDivElement>("end");

const params = new URLSearchParams(location.search);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
})();

let bindings: Bindings = loadBindings(storage);
const keys = new HeldKeys(bindings);
const renderer = new Renderer(canvas);
const levels = new Map<string, () => Promise<Uint8Array>>();
let core: Core;
let fixedNonce: Uint8Array | undefined;
let loop: Loop<EndReason> | undefined;
let journal = new Uint8Array();
let levelName = "";

async function main(): Promise<void> {
  const nonce = params.get("nonce");
  if (nonce !== null) fixedNonce = fromHex(nonce);
  const response = await fetch(WASM_URL);
  if (!response.ok) throw new Error(`could not load the game engine (${response.status})`);
  core = await Core.load(await response.arrayBuffer());
  listLevels();
  showBindings();
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
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

function listLevels(): void {
  const vectorLevel = (input: string) => async () => fromHex(input);
  levels.set("Open field", vectorLevel(openField.input));
  levels.set("Walls and minions", vectorLevel(wallsAndMinions.input));
  for (const [path, url] of Object.entries(BUNDLED_LEVELS)) {
    const name = path.replace(/^.*\//, "").replace(/\.bin$/, "");
    levels.set(name, async () => new Uint8Array(await (await fetch(url)).arrayBuffer()));
  }
  for (const name of levels.keys()) levelSelect.add(new Option(name, name));
  const asked = params.get("level");
  if (asked !== null && levels.has(asked)) levelSelect.value = asked;
}

async function chosenLevel(): Promise<[string, Uint8Array]> {
  const file = levelFile.files?.[0];
  if (file !== undefined) return [file.name.replace(/\.bin$/, ""), new Uint8Array(await file.arrayBuffer())];
  const load = levels.get(levelSelect.value);
  if (load === undefined) throw new Error("choose a level");
  return [levelSelect.value, await load()];
}

async function play(): Promise<void> {
  setupError.textContent = "";
  try {
    const [name, level] = await chosenLevel();
    levelName = name;
    loop = startSession(core, level, runNonce(fixedNonce), keys, () => performance.now());
  } catch (error) {
    setupError.textContent = error instanceof Error ? error.message : String(error);
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
  element("end-hash").textContent = stateHash.slice(0, 18);
  element("end-hash").title = stateHash;
  endScreen.hidden = false;
  loop = undefined;
}

function percent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

function downloadJournal(): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([journal], { type: "application/octet-stream" }));
  link.download = `${levelName}.jrn`;
  link.click();
  URL.revokeObjectURL(link.href);
}

let rebinding: Control | undefined;

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

function fitCanvas(): void {
  renderer.fit(Math.min(window.innerWidth - 32, 960), window.innerHeight - 160);
}

main().catch((error: unknown) => {
  setupError.textContent = error instanceof Error ? error.message : String(error);
});

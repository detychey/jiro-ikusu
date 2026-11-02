// What the pages of the site share: their elements by id, the engine, the field's size, the HUD,
// a gate for actions that must not overlap, a button's pending action, error messages, claims in
// percent, and downloads.

import { Core, type Snapshot } from "./core";
import type { Renderer } from "./render";

const WASM_URL = new URL("../../target/wasm32-unknown-unknown/release/jiro_wasm.wasm", import.meta.url);

export function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (found === null) throw new Error(`#${id} is missing from the page`);
  return found as T;
}

export async function loadCore(): Promise<Core> {
  const response = await fetch(WASM_URL);
  if (!response.ok) throw new Error(`could not load the game engine (${response.status})`);
  return Core.load(await response.arrayBuffer());
}

/** Sizes the field to the largest integer scale that fits the window, less the page's padding
 *  and header. */
export function fitField(renderer: Renderer): void {
  renderer.fit(Math.min(window.innerWidth - 32, 960), window.innerHeight - 160);
}

/** The HUD of the level in play: the claim against the target, the lives, the shield charges and
 *  the time left. */
export function showHud({ claimBp, targetBp, lives, shield, ticksLeft }: Snapshot): void {
  element("hud-claim").textContent = `${percent(claimBp)} of ${percent(targetBp)}`;
  element("hud-lives").textContent = String(lives);
  element("hud-shield").textContent = String(shield);
  element("hud-time").textContent = `${Math.ceil(ticksLeft / 15)} s`;
}

/** A gate for actions that must not overlap, such as two resumes of one run: a call claims it
 *  before its first await, and returns false, without running its action, while another holds it. */
export function exclusive(): (action: () => Promise<void>) => Promise<boolean> {
  let held = false;
  return async (action) => {
    if (held) return false;
    held = true;
    try {
      await action();
      return true;
    } finally {
      held = false;
    }
  };
}

/** Runs `action` with `button` disabled until it settles, showing its error in the element `errorId`. */
export async function pending(button: HTMLButtonElement, action: () => Promise<void>, errorId: string): Promise<void> {
  button.disabled = true;
  const shown = element(errorId);
  shown.textContent = "";
  try {
    await action();
  } catch (error) {
    shown.textContent = messageOf(error);
    shown.hidden = false;
  } finally {
    button.disabled = false;
  }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function percent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

/** Offers `value` as a JSON file named `name`. */
export function downloadJson(name: string, value: unknown): void {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

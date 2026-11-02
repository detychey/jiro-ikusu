// What the pages of the site share: their elements by id, the engine, the field's size, the HUD,
// error messages, and claims in percent.

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

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function percent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

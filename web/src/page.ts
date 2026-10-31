// What the pages of the site share: their elements by id, the engine, the field's size, error
// messages, and claims in percent.

import { Core } from "./core";
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

/** Sizes the field to the largest integer scale that fits beside the side panel. */
export function fitField(renderer: Renderer): void {
  renderer.fit(Math.min(window.innerWidth - 32, 960), window.innerHeight - 160);
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function percent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

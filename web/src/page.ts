// What the pages of the site share: their elements by id, the engine, and claims in percent.

import { Core } from "./core";

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

export function percent(bp: number): string {
  return `${(bp / 100).toFixed(2)} %`;
}

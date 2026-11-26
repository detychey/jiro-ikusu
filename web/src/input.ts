// Controls and their key bindings (README §2, §6.1, D8). Input produces controls, never keys,
// so the journal does not depend on the bindings.

import { load, save, type Storage } from "./storage";

export const CONTROLS = ["up", "down", "left", "right", "a", "b", "x"] as const;
export type Control = (typeof CONTROLS)[number];
export type Bindings = Record<Control, string>;

/** The input-mask bit of each control (README §6.1). */
export const CONTROL_BITS: Record<Control, number> = {
  up: 1 << 0,
  down: 1 << 1,
  left: 1 << 2,
  right: 1 << 3,
  a: 1 << 4,
  b: 1 << 5,
  x: 1 << 6,
};

/** The controls a mask holds, in the order of CONTROLS. */
export function controlsOf(mask: number): Control[] {
  return CONTROLS.filter((control) => (mask & CONTROL_BITS[control]) !== 0);
}

/** KeyboardEvent.code of each control on a QWERTY keyboard: the arrows, and the keys A, B and X.
 *  A code names a key by its place on a QWERTY keyboard, whatever the layout prints on it. */
export const DEFAULT_BINDINGS: Bindings = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  a: "KeyA",
  b: "KeyB",
  x: "KeyX",
};

const STORAGE_KEY = "jiro-ikusu.bindings";
const ARROWS: Record<string, string> = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** What the player's keyboard layout prints on each key, by KeyboardEvent.code. */
export type KeyboardLayout = ReadonlyMap<string, string>;

/** The player's keyboard layout, from the Keyboard API, which only Chromium browsers offer;
 *  undefined elsewhere. */
export async function keyboardLayout(): Promise<KeyboardLayout | undefined> {
  const { keyboard } = navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<KeyboardLayout> } };
  if (keyboard?.getLayoutMap === undefined) return undefined;
  try {
    return await keyboard.getLayoutMap();
  } catch {
    // The API refuses outside a top-level page, as in an iframe: the layout stays unknown there.
    return undefined;
  }
}

/** The default bindings under `layout`: the arrows, and the keys that print A, B and X. A letter
 *  the layout doesn't print, or an unknown layout, keeps its QWERTY place. */
export function defaultBindings(layout: KeyboardLayout | undefined): Bindings {
  const letterKeys = [...(layout ?? [])].filter(([code]) => /^Key[A-Z]$/.test(code));
  const keyPrinting = (letter: string) => letterKeys.find(([, printed]) => printed.toLowerCase() === letter)?.[0];
  const bindings = { ...DEFAULT_BINDINGS };
  for (const control of ["a", "b", "x"] as const) bindings[control] = keyPrinting(control) ?? DEFAULT_BINDINGS[control];
  return isBindings(bindings) ? bindings : { ...DEFAULT_BINDINGS };
}

/** A key as the controls panel names it: what `layout` prints on it; with no layout, the letter
 *  or digit at its place on a QWERTY keyboard, marked as such; otherwise its code. */
export function keyLabel(code: string, layout: KeyboardLayout | undefined): string {
  const arrow = ARROWS[code];
  if (arrow !== undefined) return arrow;
  const printed = layout?.get(code);
  if (printed !== undefined && printed.trim() !== "") return printed.toUpperCase();
  const qwerty = /^(?:Key|Digit)(.)$/.exec(code)?.[1];
  return qwerty === undefined ? code : `${qwerty} (QWERTY)`;
}

/** The stored bindings, or `defaults` when storage is missing, unreadable or invalid. */
export function loadBindings(storage: Storage | undefined, defaults: Bindings = DEFAULT_BINDINGS): Bindings {
  return load(storage, STORAGE_KEY, isBindings, () => ({ ...defaults }));
}

/** Stores the bindings; returns false when storage is missing or refuses, which leaves the
 *  game playable with the bindings of this page. */
export function saveBindings(storage: Storage | undefined, bindings: Bindings): boolean {
  return save(storage, STORAGE_KEY, bindings);
}

/** Binds `control` to `code`, or refuses, with a message that names the key `name`, a key
 *  already bound to another control. */
export function rebind(bindings: Bindings, control: Control, code: string, name = code): Bindings | string {
  const holder = CONTROLS.find((other) => other !== control && bindings[other] === code);
  if (holder !== undefined) return `${name} is already bound to ${holder}`;
  return { ...bindings, [control]: code };
}

function isBindings(value: unknown): value is Bindings {
  if (typeof value !== "object" || value === null) return false;
  const codes = CONTROLS.map((control) => (value as Record<string, unknown>)[control]);
  return codes.every((code) => typeof code === "string") && new Set(codes).size === CONTROLS.length;
}

/** A source of controls (docs/PHONE.md §3.4): the keyboard's held keys, the touch controls. */
export interface InputSource {
  /** The tick's input sample, taken once per tick. */
  sample(): number;
  /** Releases every control. */
  clear(): void;
}

/** One source whose sample is the OR of the samples of `sources`, each sampled exactly once. */
export function combined(...sources: InputSource[]): InputSource {
  return {
    sample: () => sources.reduce((mask, source) => mask | source.sample(), 0),
    clear: () => {
      for (const source of sources) source.clear();
    },
  };
}

/** The keys held now, as an input mask under `bindings`. */
export class HeldKeys implements InputSource {
  private readonly held = new Set<string>();
  /** Keys pressed since the last sample: a tap shorter than a tick still counts once. */
  private readonly tapped = new Set<string>();

  constructor(private bindings: Bindings) {}

  setBindings(bindings: Bindings): void {
    this.bindings = bindings;
  }

  /** A key goes down; an auto-repeat of a key already held is not a new press. */
  down(code: string): void {
    if (!this.held.has(code)) this.tapped.add(code);
    this.held.add(code);
  }

  up(code: string): void {
    this.held.delete(code);
  }

  /** Releases every key, for example when the page loses focus. */
  clear(): void {
    this.held.clear();
    this.tapped.clear();
  }

  /** The mask of the keys held now. */
  mask(): number {
    return this.maskOf((code) => this.held.has(code));
  }

  /** The tick's input sample: the keys held now or pressed since the last sample. */
  sample(): number {
    const mask = this.maskOf((code) => this.held.has(code) || this.tapped.has(code));
    this.tapped.clear();
    return mask;
  }

  private maskOf(pressed: (code: string) => boolean): number {
    return CONTROLS.reduce(
      (mask, control) => (pressed(this.bindings[control]) ? mask | CONTROL_BITS[control] : mask),
      0,
    );
  }
}

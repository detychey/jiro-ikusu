// Controls and their key bindings (README §2, §6.1, D8). Input produces controls, never keys,
// so the journal does not depend on the bindings.

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

/** KeyboardEvent.code of each control by default: the arrows, and the keys A, B and X. */
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

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The stored bindings, or the defaults when storage is missing, unreadable or invalid. */
export function loadBindings(storage: Storage | undefined): Bindings {
  try {
    const stored: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "null");
    return isBindings(stored) ? stored : { ...DEFAULT_BINDINGS };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

/** Stores the bindings; returns false when storage is missing or refuses, which leaves the
 *  game playable with the bindings of this page. */
export function saveBindings(storage: Storage | undefined, bindings: Bindings): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(bindings));
    return storage !== undefined;
  } catch {
    return false;
  }
}

/** Binds `control` to `code`, or refuses, with a message, a key already bound to another
 *  control. */
export function rebind(bindings: Bindings, control: Control, code: string): Bindings | string {
  const holder = CONTROLS.find((other) => other !== control && bindings[other] === code);
  if (holder !== undefined) return `${code} is already bound to ${holder}`;
  return { ...bindings, [control]: code };
}

function isBindings(value: unknown): value is Bindings {
  if (typeof value !== "object" || value === null) return false;
  const codes = CONTROLS.map((control) => (value as Record<string, unknown>)[control]);
  return codes.every((code) => typeof code === "string") && new Set(codes).size === CONTROLS.length;
}

/** The keys held now, as an input mask under `bindings`. */
export class HeldKeys {
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

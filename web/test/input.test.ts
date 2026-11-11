import { describe, expect, it } from "vitest";
import {
  type Bindings,
  type Control,
  combined,
  CONTROLS,
  DEFAULT_BINDINGS,
  defaultBindings,
  HeldKeys,
  type InputSource,
  type KeyboardLayout,
  keyLabel,
  loadBindings,
  rebind,
  saveBindings,
} from "../src/input";

function masksFor(bindings: Bindings, script: Control[][]): number[] {
  const keys = new HeldKeys(bindings);
  return script.map((held) => {
    keys.clear();
    for (const control of held) keys.down(bindings[control]);
    return keys.mask();
  });
}

const script: Control[][] = [[], ["up"], ["up", "a"], ["left", "b"], ["right", "down"], ["x"]];

describe("input", () => {
  it("gives the README §6.1 bits for the default bindings", () => {
    expect(masksFor(DEFAULT_BINDINGS, script)).toEqual([0, 0x01, 0x11, 0x24, 0x0a, 0x40]);
  });

  it("gives the same masks after every control is rebound to other keys", () => {
    let bindings: Bindings = DEFAULT_BINDINGS;
    for (const [index, control] of CONTROLS.entries()) {
      const rebound = rebind(bindings, control, `Digit${index}`);
      if (typeof rebound === "string") throw new Error(rebound);
      bindings = rebound;
    }
    expect(masksFor(bindings, script)).toEqual(masksFor(DEFAULT_BINDINGS, script));
  });

  it("refuses a key already bound to another control, with a message", () => {
    expect(rebind(DEFAULT_BINDINGS, "a", "ArrowUp")).toBe("ArrowUp is already bound to up");
  });

  it("falls back to the default bindings when reading storage throws", () => {
    const failing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
    };
    expect(loadBindings(failing)).toEqual(DEFAULT_BINDINGS);
  });

  it("reports that the bindings were not stored when writing storage throws", () => {
    const failing = {
      getItem: () => null,
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(saveBindings(failing, DEFAULT_BINDINGS)).toBe(false);
  });

  it("restores the bindings it stored", () => {
    const items = new Map<string, string>();
    const storage = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    };
    const bindings = rebind(DEFAULT_BINDINGS, "x", "Enter") as Bindings;
    saveBindings(storage, bindings);
    expect(loadBindings(storage)).toEqual(bindings);
  });

  it("counts a tap shorter than a tick in the next sample only", () => {
    const keys = new HeldKeys(DEFAULT_BINDINGS);
    keys.down("KeyX");
    keys.up("KeyX");
    expect([keys.mask(), keys.sample(), keys.sample()]).toEqual([0, 0x40, 0]);
  });

  it("does not count an auto-repeat after the key is released", () => {
    const keys = new HeldKeys(DEFAULT_BINDINGS);
    keys.down("ArrowUp");
    const held = keys.sample();
    keys.down("ArrowUp");
    keys.up("ArrowUp");
    expect([held, keys.sample()]).toEqual([0x01, 0]);
  });
});

/** A source that holds `mask` and counts its samples and clears. */
function fixedSource(mask: number) {
  const counts = { samples: 0, clears: 0 };
  const source: InputSource = {
    sample: () => {
      counts.samples += 1;
      return mask;
    },
    clear: () => {
      counts.clears += 1;
    },
  };
  return { source, counts };
}

describe("combined sources", () => {
  it("sample the OR of the keys and another source", () => {
    const keys = new HeldKeys(DEFAULT_BINDINGS);
    keys.down("ArrowUp");
    expect(combined(keys, fixedSource(0x30).source).sample()).toBe(0x31);
  });

  it("sample each source exactly once per tick", () => {
    const sources = [fixedSource(0x01), fixedSource(0x01), fixedSource(0x40)];
    const input = combined(...sources.map(({ source }) => source));
    input.sample();
    input.sample();
    expect(sources.map(({ counts }) => counts.samples)).toEqual([2, 2, 2]);
  });

  it("clear every source", () => {
    const sources = [fixedSource(0), fixedSource(0)];
    combined(...sources.map(({ source }) => source)).clear();
    expect(sources.map(({ counts }) => counts.clears)).toEqual([1, 1]);
  });
});

const AZERTY: KeyboardLayout = new Map([
  ["KeyQ", "a"],
  ["KeyA", "q"],
  ["KeyW", "z"],
  ["KeyZ", "w"],
  ["KeyB", "b"],
  ["KeyX", "x"],
]);
const DVORAK: KeyboardLayout = new Map([
  ["KeyA", "a"],
  ["KeyN", "b"],
  ["KeyB", "x"],
  ["KeyX", "q"],
]);

describe("keyboard layouts", () => {
  it("binds the QWERTY places of A, B and X when the layout is unknown", () => {
    expect(defaultBindings(undefined)).toEqual(DEFAULT_BINDINGS);
  });

  it("binds A to the key that prints it on AZERTY", () => {
    expect(defaultBindings(AZERTY)).toEqual({ ...DEFAULT_BINDINGS, a: "KeyQ" });
  });

  it("binds B and X to the keys that print them on Dvorak", () => {
    expect(defaultBindings(DVORAK)).toEqual({ ...DEFAULT_BINDINGS, b: "KeyN", x: "KeyB" });
  });

  it("keeps the QWERTY place of a letter the layout doesn't print", () => {
    expect(defaultBindings(new Map([["KeyA", "ф"]]))).toEqual(DEFAULT_BINDINGS);
  });

  it("loads the layout's defaults when nothing is stored", () => {
    const empty = { getItem: () => null, setItem: () => undefined };
    expect(loadBindings(empty, defaultBindings(AZERTY))).toEqual({ ...DEFAULT_BINDINGS, a: "KeyQ" });
  });

  it.each([
    ["KeyQ", AZERTY, "A"],
    ["KeyQ", undefined, "Q (QWERTY)"],
    ["Digit1", undefined, "1 (QWERTY)"],
    ["ArrowUp", AZERTY, "↑"],
    ["Enter", undefined, "Enter"],
  ] as const)("names %s as %s prints it", (code, layout, label) => {
    expect(keyLabel(code, layout)).toBe(label);
  });

  it("names the key in its refusal", () => {
    expect(rebind(DEFAULT_BINDINGS, "a", "ArrowUp", keyLabel("ArrowUp", undefined))).toBe("↑ is already bound to up");
  });
});

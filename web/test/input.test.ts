import { describe, expect, it } from "vitest";
import {
  type Bindings,
  type Control,
  CONTROLS,
  DEFAULT_BINDINGS,
  HeldKeys,
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

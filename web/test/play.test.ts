import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fromHex, hex } from "../src/core";
import { type Bindings, type Control, CONTROLS, DEFAULT_BINDINGS, rebind } from "../src/input";
import { finalHash, loadEngine, play, repo, schedule, vector } from "./drive";

const openField = fromHex(JSON.parse(readFileSync(new URL("vectors/format/level-open-field.json", repo), "utf8")).input);

async function playVector(name: string) {
  const recorded = vector(name);
  expect([recorded.mode, recorded.levelIndex]).toEqual([0, 0]);
  const events = schedule(fromHex(recorded.journal));
  return play(await loadEngine(), fromHex(recorded.level), fromHex(recorded.runNonce), DEFAULT_BINDINGS, (tick) => events.get(tick));
}

/** A scripted Training run on the open-field level: a cut up, left and down that captures, then
 *  a commit. */
const SCRIPT: [number, Control[]][] = [
  [0, ["up"]],
  [10, ["left"]],
  [20, ["down", "a"]],
  [32, []],
  [40, ["x"]],
];
const scripted = (tick: number) => SCRIPT.find(([at]) => at === tick)?.[1];

describe("play", () => {
  it.each(["open-field-empty", "open-field-capture"])("reproduces the journal and final hash of %s from its keys", async (name) => {
    const { journal, hash } = await playVector(name);
    expect([hex(journal), hash]).toEqual([vector(name).journal, finalHash(name)]);
  });

  it("gives the same journal bytes for the same controls after every control is rebound", async () => {
    let rebound: Bindings = DEFAULT_BINDINGS;
    for (const [index, control] of CONTROLS.entries()) {
      const next = rebind(rebound, control, `Digit${index}`);
      if (typeof next === "string") throw new Error(next);
      rebound = next;
    }
    const nonce = fromHex(vector("open-field-empty").runNonce);
    const original = play(await loadEngine(), openField, nonce, DEFAULT_BINDINGS, scripted);
    const remapped = play(await loadEngine(), openField, nonce, rebound, scripted);
    expect(hex(remapped.journal)).toBe(hex(original.journal));
  });

  it("writes the journal and end-screen hash of a scripted run for native replay", async () => {
    const { journal, hash } = play(await loadEngine(), openField, fromHex(vector("open-field-empty").runNonce), DEFAULT_BINDINGS, scripted);
    const out = new URL("out/", import.meta.url);
    mkdirSync(out, { recursive: true });
    writeFileSync(new URL("scripted.jrn", out), journal);
    writeFileSync(new URL("scripted.hash", out), `${hash}\n`);
    expect(journal.length).toBe(71 + 3 * SCRIPT.length);
  });
});

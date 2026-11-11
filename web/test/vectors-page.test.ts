// The vectors page's replay (plan M3.12) on the repository's vectors/, served as the preview build
// ships them: traces compared through traceKeccak, a .trace read only on a mismatch to name the
// first differing tick, and a file that cannot be read counted as a failure.

import { readdirSync, readFileSync } from "node:fs";
import { keccak256 } from "ethers";
import { describe, expect, it } from "vitest";
import { type Fetch, type Kind, replayAll, type Tally } from "../src/pages/vectors";
import { KINDS } from "../src/vectors.mjs";
import { loadWasm, WASM_DEFAULT } from "./wasm.mjs";

const engine = await loadWasm(WASM_DEFAULT);
const vectors = new URL("../../vectors/", import.meta.url);
const jsonFiles = (kind: Kind) => readdirSync(new URL(`${kind}/`, vectors)).filter((name) => name.endsWith(".json"));
const INDEX = JSON.stringify(Object.fromEntries(KINDS.map((kind) => [kind, jsonFiles(kind)])));

/** Serves vectors/ as the build ships it, with `changed` files, index.json among them, in place of
 *  the repository's (null for a missing file), and records the paths it was asked for. */
function served(changed: Record<string, Uint8Array<ArrayBuffer> | null> = {}): { fetchVector: Fetch; asked: string[] } {
  const asked: string[] = [];
  const fetchVector: Fetch = async (path) => {
    asked.push(path);
    if (!(path in changed) && path === "index.json") return new Response(INDEX);
    const body = path in changed ? changed[path] : readFileSync(new URL(path, vectors));
    return body === null || body === undefined ? new Response(null, { status: 404 }) : new Response(body);
  };
  return { fetchVector, asked };
}

const replay = (fetchVector: Fetch): Promise<Record<Kind, Tally>> => replayAll(engine, fetchVector, () => undefined);

/** fast-cut's trace with one byte of tick 3 flipped, and the vector recording that trace. */
function differingAtTick3(): Record<string, Uint8Array<ArrayBuffer>> {
  const trace = new Uint8Array(readFileSync(new URL("game/fast-cut.trace", vectors)));
  const flipped = 3 * 32 + 5;
  trace[flipped] = (trace[flipped] ?? 0) ^ 1;
  const vector = JSON.parse(readFileSync(new URL("game/fast-cut.json", vectors), "utf8"));
  const json = JSON.stringify({ ...vector, traceKeccak: keccak256(trace) });
  return { "game/fast-cut.trace": trace, "game/fast-cut.json": new TextEncoder().encode(json) };
}

describe("the vectors page", () => {
  it("replays every vector of vectors/ with no mismatch, reading no trace", async () => {
    const { fetchVector, asked } = served();
    const tallies = await replay(fetchVector);
    expect({ tallies, traces: asked.filter((path) => path.endsWith(".trace")) }).toEqual({
      tallies: Object.fromEntries(KINDS.map((kind) => [kind, { replayed: jsonFiles(kind).length, failures: [] }])),
      traces: [],
    });
  });

  it("reads the .trace of a vector whose traceKeccak differs, and names the first differing tick", async () => {
    const { game } = await replay(served(differingAtTick3()).fetchVector);
    expect(game.failures.map(({ file, tick, message }) => [file, tick, message.split(";")[0]])).toEqual([
      ["game/fast-cut.json", 3, "trace differs from tick 3"],
    ]);
  });

  it("counts a vector file that cannot be read as a failure, not as replayed", async () => {
    const { game } = await replay(served({ "game/clear-the-level.json": null }).fetchVector);
    expect(game).toEqual({
      replayed: jsonFiles("game").length - 1,
      failures: [{ file: "game/clear-the-level.json", message: "could not read game/clear-the-level.json (404)" }],
    });
  });

  it("refuses an index.json that lists a kind the page does not replay", async () => {
    const index = new TextEncoder().encode(JSON.stringify({ ...JSON.parse(INDEX), fuzz: ["case-1.json"] }));
    await expect(replay(served({ "index.json": index }).fetchVector)).rejects.toThrow(
      "index.json lists the kinds format, fuzz, game, levels, the page replays format, game, levels",
    );
  });

  it("fails a vector whose .trace does not have its traceKeccak", async () => {
    const vector = JSON.parse(readFileSync(new URL("game/fast-cut.json", vectors), "utf8"));
    const json = new TextEncoder().encode(JSON.stringify({ ...vector, traceKeccak: `0x${"00".repeat(32)}` }));
    const { game } = await replay(served({ "game/fast-cut.json": json }).fetchVector);
    expect(game.failures.map(({ file, message }) => [file, message.split(" has ")[0]])).toEqual([["game/fast-cut.json", "game/fast-cut.trace"]]);
  });
});

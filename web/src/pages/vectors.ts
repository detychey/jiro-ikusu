// The vectors page (plan M3.12, docs/PHONE.md §9.3), built only for pull-request previews: every
// vector the build ships at /vectors/, replayed in this browser through the wasm engine with the
// checks of web/test/vectors.mjs (src/vectors.mjs). A game vector's trace is compared through its
// keccak256, the vector's traceKeccak, and its .trace file is fetched only on a mismatch, to name
// the first differing tick. A vector file that cannot be read is a failure, never skipped.

import { keccak256 } from "ethers";
import { element, engineBytes, messageOf } from "../page";
import { bindWasm, checkFormats, checkGame, type Engine, type Failure, type NamedVector, type WasmExports } from "../vectors.mjs";

/** The kinds of vectors/ the build ships, each listed in /vectors/index.json (vite.config.ts). */
export const KINDS = ["format", "game", "levels"] as const;
export type Kind = (typeof KINDS)[number];

export interface Tally {
  replayed: number;
  failures: Failure[];
}

/** Reads a file of the shipped vectors, by its path under /vectors/. */
export type Fetch = (path: string) => Promise<Response>;

async function read(fetchVector: Fetch, path: string): Promise<Response> {
  const response = await fetchVector(path);
  if (!response.ok) throw new Error(`could not read ${path} (${response.status})`);
  return response;
}

/** The shipped files of each kind, as /vectors/index.json lists them. */
async function listed(fetchVector: Fetch): Promise<Record<Kind, string[]>> {
  const index: unknown = await (await read(fetchVector, "index.json")).json();
  const lists = KINDS.map((kind) => (index as Record<string, unknown>)[kind]);
  if (!lists.every((names) => Array.isArray(names) && names.every((name) => typeof name === "string"))) {
    throw new Error(`index.json must list the files of ${KINDS.join(", ")}`);
  }
  return Object.fromEntries(KINDS.map((kind, i) => [kind, lists[i]])) as Record<Kind, string[]>;
}

/** The vectors of a kind that could be read, and a failure for each that could not. */
async function readKind(fetchVector: Fetch, kind: Kind, names: string[]): Promise<{ vectors: NamedVector[]; failures: Failure[] }> {
  const results = await Promise.all(
    names.map(async (name): Promise<NamedVector | Failure> => {
      const file = `${kind}/${name}`;
      try {
        return { file, vector: await (await read(fetchVector, file)).json() };
      } catch (error) {
        return { file, message: messageOf(error) };
      }
    }),
  );
  return {
    vectors: results.flatMap((result) => ("vector" in result ? [result] : [])),
    failures: results.flatMap((result) => ("message" in result ? [result] : [])),
  };
}

/** The vector's recorded trace: the computed one when its keccak256 is the vector's traceKeccak,
 *  otherwise the .trace file, which must have that digest, so that the checks name the first tick
 *  that differs. */
async function recordedTrace(fetchVector: Fetch, kind: Kind, vector: { trace: string; traceKeccak: string }, computed: Uint8Array) {
  if (keccak256(computed) === vector.traceKeccak) return computed;
  const path = `${kind}/${vector.trace}`;
  const recorded = new Uint8Array(await (await read(fetchVector, path)).arrayBuffer());
  const digest = keccak256(recorded);
  if (digest !== vector.traceKeccak) throw new Error(`${path} has keccak256 ${digest}, the vector's traceKeccak is ${vector.traceKeccak}`);
  return recorded;
}

/** The failures of the vectors of a kind, checked in order, telling `progress` which is next. */
async function check(engine: Engine, fetchVector: Fetch, kind: Kind, vectors: NamedVector[], progress: (file: string) => void) {
  if (kind === "format") {
    progress(kind);
    return checkFormats(engine, vectors);
  }
  const failures: Failure[] = [];
  for (const named of vectors) {
    progress(named.file);
    try {
      failures.push(...(await checkGame(engine, named, (computed) => recordedTrace(fetchVector, kind, named.vector, computed))));
    } catch (error) {
      failures.push({ file: named.file, message: messageOf(error) });
    }
  }
  return failures;
}

/** Replays every listed vector, kind by kind: a vector replayed is one that could be read. */
export async function replayAll(engine: Engine, fetchVector: Fetch, progress: (file: string) => void): Promise<Record<Kind, Tally>> {
  const files = await listed(fetchVector);
  const tallies = {} as Record<Kind, Tally>;
  for (const kind of KINDS) {
    const { vectors, failures } = await readKind(fetchVector, kind, files[kind]);
    tallies[kind] = { replayed: vectors.length, failures: [...failures, ...(await check(engine, fetchVector, kind, vectors, progress))] };
  }
  return tallies;
}

function show(tallies: Record<Kind, Tally>): void {
  for (const kind of KINDS) {
    element(`${kind}-replayed`).textContent = String(tallies[kind].replayed);
    element(`${kind}-mismatches`).textContent = String(tallies[kind].failures.length);
  }
  const failures = KINDS.flatMap((kind) => tallies[kind].failures);
  const list = element("failures");
  list.hidden = failures.length === 0;
  list.replaceChildren(
    ...failures.map(({ file, message, tick }) => {
      const item = document.createElement("li");
      if (tick !== undefined) item.dataset.tick = String(tick);
      item.append(Object.assign(document.createElement("code"), { textContent: `${file}: ${message}` }));
      return item;
    }),
  );
}

export async function mount(): Promise<void> {
  const status = element("status");
  element("build").textContent = __GIT_SHA__;
  try {
    const { instance } = await WebAssembly.instantiate(await engineBytes(), {});
    const engine = bindWasm(instance.exports as unknown as WasmExports);
    element("rules-version").textContent = String(engine.wasm.rules_version());
    const tallies = await replayAll(
      engine,
      (path) => fetch(`/vectors/${path}`),
      (file) => (status.textContent = `Replaying ${file}…`),
    );
    show(tallies);
    const replayed = KINDS.reduce((sum, kind) => sum + tallies[kind].replayed, 0);
    const mismatches = KINDS.reduce((sum, kind) => sum + tallies[kind].failures.length, 0);
    status.textContent = `Done: ${replayed} vectors replayed, ${mismatches} mismatches.`;
    status.classList.toggle("error", mismatches > 0);
    status.dataset.state = "done";
  } catch (error) {
    status.textContent = `Stopped: ${messageOf(error)}`;
    status.classList.add("error");
    status.dataset.state = "failed";
  }
}

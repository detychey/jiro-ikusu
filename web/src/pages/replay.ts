// The replay viewer (plan M2.3): watch and audit any journal; the bytes are the match. The core
// replays the level and the journal as the referee does, and gives the Outcome and the state hash
// of every tick. The view then plays the journal's masks through the engine one tick at a time,
// to show each tick, and a seek plays them again from tick 0. Nothing here decides an outcome.

import { type Core, CoreError, fromHex, HASH_LEN, hex, type Outcome } from "../core";
import { describeError } from "../errors";
import { controlsOf } from "../input";
import { type JournalEvent, journalEvents } from "../journal";
import { createLoop, type Loop } from "../loop";
import { element, loadCore, percent } from "../page";
import { Renderer } from "../render";

/** The bytes a replay takes (README §7.3). */
export interface Recording {
  level: Uint8Array;
  journal: Uint8Array;
  weightBp: number;
}

export class ReplayView {
  private played = 0;

  private constructor(
    private readonly core: Core,
    private readonly level: Uint8Array,
    readonly outcome: Outcome,
    /** The state hash of every tick, from the core's replay. */
    readonly trace: Uint8Array,
    /** The mask held on each tick (README §6.2). */
    private readonly masks: number[],
  ) {}

  /** The view of `recording` at tick 0, or the code of the first rule it breaks (README §6.3). */
  static open(core: Core, recording: Recording): ReplayView | { code: number } {
    const replayed = core.replay(recording.level, recording.journal, recording.weightBp);
    if ("code" in replayed) return { code: replayed.code };
    const { outcome, trace } = replayed;
    const masks = heldMasks(journalEvents(recording.journal), outcome.ticksUsed);
    const view = new ReplayView(core, recording.level, outcome, trace, masks);
    view.seek(0);
    return view;
  }

  /** The ticks the level lasted. */
  get ticks(): number {
    return this.outcome.ticksUsed;
  }

  /** The ticks played so far, 0 to `ticks`. */
  get tick(): number {
    return this.played;
  }

  /** The mask held on tick `tick`. */
  held(tick: number): number {
    return this.masks[tick] ?? 0;
  }

  /** Plays the journal again from tick 0 until `tick` ticks, kept within 0 to `ticks`, have been
   *  played. */
  seek(tick: number): void {
    const code = this.core.loadLevel(this.level);
    if (code !== 0) throw new CoreError("load_level", code);
    this.core.start(fromHex(this.outcome.runNonce), this.outcome.mode, this.outcome.levelIndex);
    this.played = 0;
    const target = Math.max(0, Math.min(this.ticks, Math.trunc(tick)));
    while (this.played < target) this.step();
  }

  /** Plays the next tick, unless the level has ended. */
  step(): void {
    if (this.played >= this.ticks) return;
    this.core.tick(this.held(this.played));
    this.played += 1;
  }

  /** The state hash after the ticks played so far. */
  hash(): Uint8Array {
    return this.core.stateHash();
  }
}

/** The mask held on each of the first `ticks` ticks: an event's mask holds from its tick until
 *  the next event's, and 0 before the first (README §6.2). */
function heldMasks(events: JournalEvent[], ticks: number): number[] {
  const masks: number[] = [];
  let mask = 0;
  let next = 0;
  for (let tick = 0; tick < ticks; tick += 1) {
    const event = events[next];
    if (event?.tick === tick) {
      mask = event.mask;
      next += 1;
    }
    masks.push(mask);
  }
  return masks;
}

/** The first tick whose state hash differs between `trace` and `expected`, or undefined when
 *  they are equal. A trace that stops early, or goes on, differs at its end. */
export function firstMismatch(trace: Uint8Array, expected: Uint8Array): number | undefined {
  const hashAt = (bytes: Uint8Array, tick: number) => bytes.subarray(tick * HASH_LEN, (tick + 1) * HASH_LEN);
  for (let tick = 0; tick * HASH_LEN < Math.max(trace.length, expected.length); tick += 1) {
    const [ours, theirs] = [hashAt(trace, tick), hashAt(expected, tick)];
    if (ours.length !== HASH_LEN || theirs.length !== HASH_LEN || ours.some((byte, i) => byte !== theirs[i])) {
      return tick;
    }
  }
  return undefined;
}

/** The controls a mask holds, by name, or "none". */
export function heldControls(mask: number): string {
  const held = controlsOf(mask);
  return held.length === 0 ? "none" : held.join(" ");
}

/** The fields of a game vector that a replay takes (README §6.6). */
interface GameVector {
  level: string;
  journal: string;
  weightBp: number;
}

/** Runs the page: replay.html. */
export function mount(): void {
  const canvas = element<HTMLCanvasElement>("field");
  const loadError = element<HTMLParagraphElement>("load-error");
  const player = element<HTMLDivElement>("player");
  const scrub = element<HTMLInputElement>("scrub");
  const playPause = element<HTMLButtonElement>("play-pause");
  const renderer = new Renderer(canvas);
  let core: Core;
  let view: ReplayView | undefined;
  let expected: Uint8Array | undefined;
  let loop: Loop<true> | undefined;

  const fit = () => renderer.fit(Math.min(window.innerWidth - 32, 960), window.innerHeight - 160);

  const bytesOf = async (input: HTMLInputElement): Promise<Uint8Array | undefined> => {
    const file = input.files?.[0];
    return file === undefined ? undefined : new Uint8Array(await file.arrayBuffer());
  };

  /** The recording and the trace to compare with: a game vector and its .trace file, or else a
   *  level and a journal, each from its file or else its hex field. */
  async function chosen(): Promise<[Recording, Uint8Array | undefined]> {
    const files = Array.from(element<HTMLInputElement>("vector-files").files ?? []);
    const vectorFile = files.find((file) => file.name.endsWith(".json"));
    if (vectorFile !== undefined) {
      const vector = JSON.parse(await vectorFile.text()) as GameVector;
      const traceFile = files.find((file) => file.name.endsWith(".trace"));
      const trace = traceFile === undefined ? undefined : new Uint8Array(await traceFile.arrayBuffer());
      return [{ level: fromHex(vector.level), journal: fromHex(vector.journal), weightBp: vector.weightBp }, trace];
    }
    const level =
      (await bytesOf(element("level-file"))) ?? fromHex(element<HTMLTextAreaElement>("level-hex").value.trim());
    const journal =
      (await bytesOf(element("journal-file"))) ?? fromHex(element<HTMLTextAreaElement>("journal-hex").value.trim());
    return [{ level, journal, weightBp: Number(element<HTMLInputElement>("weight").value) }, undefined];
  }

  async function load(): Promise<void> {
    pause();
    loadError.textContent = "";
    player.hidden = true;
    view = undefined;
    try {
      const [recording, trace] = await chosen();
      const opened = ReplayView.open(core, recording);
      if ("code" in opened) {
        loadError.textContent = `The core rejects these bytes: ${describeError(opened.code)}.`;
        return;
      }
      view = opened;
      expected = trace;
    } catch (error) {
      loadError.textContent = error instanceof Error ? error.message : String(error);
      return;
    }
    scrub.max = String(view.ticks);
    showOutcome(view.outcome);
    showCompare();
    player.hidden = false;
    show();
  }

  function show(): void {
    if (view === undefined) return;
    renderer.drawCells(core.grid(), core.dirtyCells());
    renderer.frame(core.snapshot());
    scrub.value = String(view.tick);
    element("tick").textContent = `${view.tick} of ${view.ticks}`;
    element("held").textContent = view.tick > 0 ? heldControls(view.held(view.tick - 1)) : "–";
    element("hash").textContent = hex(view.hash());
    canvas.dataset.ticksUsed = String(view.tick);
  }

  function showOutcome(outcome: Outcome): void {
    const table = element<HTMLTableElement>("outcome");
    table.replaceChildren();
    const rows: [string, string][] = [
      ["End", outcome.endReason],
      ["Claim", percent(outcome.claimBp)],
      ["Ticks used", String(outcome.ticksUsed)],
      ["Level score", String(outcome.levelScore)],
      ["Mode", outcome.mode === 0 ? "Training" : "Challenge"],
      ["Level index", String(outcome.levelIndex)],
      ["Draw slot", String(outcome.drawSlot)],
      ["Rules version", String(outcome.rulesVersion)],
      ["Level id", outcome.levelId],
      ["Run nonce", outcome.runNonce],
      ["Journal hash", outcome.journalHash],
    ];
    for (const [name, value] of rows) {
      const row = table.insertRow();
      row.insertCell().textContent = name;
      row.insertCell().textContent = value;
    }
  }

  function showCompare(): void {
    const compare = element("compare");
    const goTo = element<HTMLButtonElement>("go-to-mismatch");
    goTo.hidden = true;
    if (view === undefined || expected === undefined) {
      compare.textContent = "no trace to compare: load a vector with its .trace file";
      return;
    }
    const mismatch = firstMismatch(view.trace, expected);
    if (mismatch === undefined) {
      compare.textContent = `matches the vector's trace, ${view.ticks} ticks`;
      return;
    }
    compare.textContent = `first differs from the vector's trace at tick ${mismatch}`;
    goTo.hidden = false;
    goTo.onclick = () => seek(mismatch + 1);
  }

  function seek(tick: number): void {
    pause();
    view?.seek(tick);
    show();
  }

  function play(): void {
    if (view === undefined) return;
    if (view.tick >= view.ticks) view.seek(0);
    const playing = view;
    loop = createLoop({
      now: () => performance.now(),
      sample: () => 0,
      tick: () => {
        playing.step();
        return playing.tick >= playing.ticks ? true : undefined;
      },
    });
    playPause.textContent = "Pause";
    requestAnimationFrame(frame);
  }

  function pause(): void {
    loop = undefined;
    playPause.textContent = "Play";
  }

  function frame(): void {
    if (loop === undefined) return;
    const end = loop.pump();
    show();
    if (end === undefined) requestAnimationFrame(frame);
    else pause();
  }

  async function start(): Promise<void> {
    core = await loadCore();
    fit();
    window.addEventListener("resize", fit);
    element<HTMLFormElement>("load").addEventListener("submit", (event) => {
      event.preventDefault();
      void load();
    });
    playPause.addEventListener("click", () => (loop === undefined ? play() : pause()));
    element("step").addEventListener("click", () => {
      pause();
      view?.step();
      show();
    });
    scrub.addEventListener("input", () => seek(Number(scrub.value)));
  }

  start().catch((error: unknown) => {
    loadError.textContent = error instanceof Error ? error.message : String(error);
  });
}

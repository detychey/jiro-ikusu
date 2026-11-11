// The probe page (plan M3.12; docs/PHONE.md §9.3, Appendix A), built only for pull-request
// previews: the page's lifecycle events, frame gaps above 1 s on either clock, and touches that
// start near a side edge, logged with both clocks in IndexedDB, so that a kill or an app update
// shows in the next load; the clock probe, which plays the open field's 2,700 ticks through
// createLoop with no control held and measures A3 (docs/PHONE.md §10) at every frame; the
// features a phone needs; and the results as JSON to copy.

import openFieldVector from "../../../vectors/format/level-open-field.json";
import { type Core, type EndReason, fromHex } from "../core";
import { DEFAULT_BINDINGS, HeldKeys } from "../input";
import { ticksDue } from "../loop";
import { element, fitField, loadCore, messageOf } from "../page";
import { Renderer } from "../render";
import { done } from "../run/store";
import { startSession } from "../session";
import { browserStorage, load as loadStored, save } from "../storage";

/** A frame later than this after the one before, on either clock, is logged, as the page did not
 *  run meanwhile. */
const FRAME_GAP_MS = 1_000;
/** A touch that starts this close to a side edge is logged, for the width of Android's
 *  back-gesture zone (docs/PHONE.md §14, fact 17). */
const EDGE_PX = 64;
/** A3: before a frame's pump, at most this many ticks due and not yet run. */
const A3_MAX_BEHIND = 2;
const LOG_DATABASE = "jiro-ikusu-probe";
const LOG = "log";
/** localStorage's copy of the entries not known to be in IndexedDB, written at once on each event:
 *  IndexedDB writes asynchronously, so the last events of a page that goes away, such as pagehide,
 *  visibilitychange "hidden" or freeze, may never reach it. The next load adds what it lacks. */
const UNSAVED = "jiro-ikusu-probe-unsaved";
const DISPLAY_MODES = ["fullscreen", "standalone", "minimal-ui", "browser"];
/** How long the probe waits for an API to answer: one that never does, as with a prompt left open
 *  or a stuck IndexedDB, is reported as such. */
const ANSWER_MS = 10_000;

export interface ClockEnv {
  now(): number;
  /** Resolves at the next animation frame. */
  frame(): Promise<unknown>;
  /** How many times the page has been hidden so far. */
  hides(): number;
  /** Called after each frame's pump, with the ticks run so far. */
  pumped(ticksRun: number): void;
}

export interface ClockResult {
  ticksRun: number;
  endReason: EndReason;
  frames: number;
  /** For each count of ticks due and not yet run before a frame's pump, the frames that found it. */
  behind: Record<number, number>;
  maxBehind: number;
  maxFrameGapMs: number;
  /** The hides while the probe ran: A3 is measured while the page is visible. */
  hides: number;
  a3: boolean;
}

/** Plays the open field, whose 2,700 ticks end at the time limit with no control held, through
 *  startSession's createLoop, and at every frame, before pump() runs, counts the ticks due, by
 *  createLoop's formula, less the ticks run (A3). */
export async function clockProbe(core: Core, env: ClockEnv): Promise<ClockResult> {
  const idle = new HeldKeys(DEFAULT_BINDINGS);
  const loop = startSession(core, fromHex(openFieldVector.input), new Uint8Array(32), idle, env.now);
  const hidesBefore = env.hides();
  const behind: Record<number, number> = {};
  let maxBehind = 0;
  let maxFrameGapMs = 0;
  let frames = 0;
  let last = loop.t0;
  let end: EndReason | undefined;
  while (end === undefined) {
    await env.frame();
    const t = env.now();
    const due = ticksDue(loop.t0, t) - loop.ticksRun;
    behind[due] = (behind[due] ?? 0) + 1;
    maxBehind = Math.max(maxBehind, due);
    maxFrameGapMs = Math.max(maxFrameGapMs, t - last);
    last = t;
    frames += 1;
    end = loop.pump();
    env.pumped(loop.ticksRun);
  }
  const hides = env.hides() - hidesBefore;
  return {
    ticksRun: loop.ticksRun,
    endReason: end,
    frames,
    behind,
    maxBehind,
    maxFrameGapMs: Math.round(maxFrameGapMs),
    hides,
    a3: hides === 0 && maxBehind <= A3_MAX_BEHIND,
  };
}

export interface LogEntry {
  /** The load the event fired in, by its performance.timeOrigin. */
  load: number;
  /** The entry's place among its load's, from 0. */
  seq: number;
  event: string;
  /** performance.now() and Date.now() when it fired. */
  perfMs: number;
  dateMs: number;
  detail?: Record<string, unknown>;
}

const isLogEntries = (value: unknown): value is LogEntry[] =>
  Array.isArray(value) && value.every((entry) => typeof entry?.load === "number" && typeof entry?.seq === "number" && typeof entry?.event === "string");

/** The order the entries were recorded in. */
const recordOrder = (a: LogEntry, b: LogEntry) => a.load - b.load || a.seq - b.seq;

interface Log {
  add(entry: LogEntry): Promise<unknown>;
  all(): Promise<LogEntry[]>;
  clear(): Promise<unknown>;
}

async function openLog(factory: IDBFactory): Promise<Log> {
  const opening = factory.open(LOG_DATABASE, 1);
  opening.onupgradeneeded = () => opening.result.createObjectStore(LOG, { autoIncrement: true });
  const database = await done(opening, "opening the probe's log");
  const log = (mode: IDBTransactionMode) => database.transaction(LOG, mode).objectStore(LOG);
  return {
    add: (entry) => done(log("readwrite").add(entry), "writing the log"),
    all: () => done(log("readonly").getAll(), "reading the log"),
    clear: () => done(log("readwrite").clear(), "clearing the log"),
  };
}

function describe(error: unknown): string {
  return `${error instanceof Error ? error.name : "Error"}: ${messageOf(error)}`;
}

/** `promise`, or an error once ANSWER_MS have passed without its answer. */
function answered<T>(promise: Promise<T>): Promise<T> {
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`no answer within ${ANSWER_MS} ms`)), ANSWER_MS));
  return Promise.race([promise, timeout]);
}

/** What `action` gives, or the error it throws, described, for the report. */
async function attempt<T>(action: () => T | Promise<T>): Promise<T | string> {
  try {
    return await answered(Promise.resolve().then(action));
  } catch (error) {
    return describe(error);
  }
}

/** A journal-like file, for navigator.canShare. */
const journalFile = () => new File([new Uint8Array(1)], "probe.jrn", { type: "application/octet-stream" });

/** The features of docs/PHONE.md §9.3 that do not change while the page is open. */
async function features(): Promise<Record<string, unknown>> {
  return {
    userAgent: navigator.userAgent,
    secureContext: isSecureContext,
    webAssembly: typeof WebAssembly === "object",
    webLocks: "locks" in navigator ? await attempt(() => navigator.locks.request(LOG_DATABASE, () => "granted")) : "missing",
    wakeLock:
      "wakeLock" in navigator
        ? await attempt(async () => {
            await (await navigator.wakeLock.request("screen")).release();
            return "granted";
          })
        : "missing",
    serviceWorker: "serviceWorker" in navigator,
    storage:
      "storage" in navigator
        ? {
            persistedBefore: await attempt(() => navigator.storage.persisted()),
            persist: await attempt(() => navigator.storage.persist()),
            persistedAfter: await attempt(() => navigator.storage.persisted()),
          }
        : "missing",
    share: "share" in navigator,
    canShareFile: "canShare" in navigator ? await attempt(() => navigator.canShare({ files: [journalFile()] })) : "missing",
    injectedEthereum: "ethereum" in window,
  };
}

/** The env(safe-area-inset-*) values, which iOS reports under viewport-fit=cover. */
function safeAreaInsets(): Record<string, string> {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position: fixed; visibility: hidden; padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const { paddingTop, paddingRight, paddingBottom, paddingLeft } = getComputedStyle(probe);
  probe.remove();
  return { top: paddingTop, right: paddingRight, bottom: paddingBottom, left: paddingLeft };
}

/** What may change while the page is open: display mode, sizes, insets and visibility. */
function context(): Record<string, unknown> {
  return {
    displayMode: DISPLAY_MODES.find((mode) => matchMedia(`(display-mode: ${mode})`).matches) ?? "none",
    navigatorStandalone: (navigator as { standalone?: boolean }).standalone ?? "missing",
    viewport: { width: innerWidth, height: innerHeight },
    screen: { width: screen.width, height: screen.height },
    devicePixelRatio,
    coarsePointer: matchMedia("(pointer: coarse)").matches,
    safeAreaInsets: safeAreaInsets(),
    visibility: document.visibilityState,
  };
}

export interface Clocks {
  perfMs: number;
  dateMs: number;
}

const clocks = (): Clocks => ({ perfMs: performance.now(), dateMs: Date.now() });

/** The span between two frames on both clocks, when either is above FRAME_GAP_MS: Date.now() runs
 *  on while a device sleeps, and performance.now() may not (docs/PHONE.md §6.5). */
export function frameGap(last: Clocks, now: Clocks): Clocks | undefined {
  const perfMs = now.perfMs - last.perfMs;
  const dateMs = now.dateMs - last.dateMs;
  return Math.max(perfMs, dateMs) > FRAME_GAP_MS ? { perfMs: Math.round(perfMs), dateMs } : undefined;
}

/** The side edge nearer a touch at `clientX`, on a viewport `width` wide, and the touch's distance
 *  from it in CSS pixels. */
export function edgeDistance(clientX: number, width: number): { edge: "left" | "right"; px: number } {
  return clientX <= width - clientX ? { edge: "left", px: Math.round(clientX) } : { edge: "right", px: Math.round(width - clientX) };
}

/** Records each lifecycle event; each frame that comes more than FRAME_GAP_MS after the one
 *  before, with both clocks' spans; each touch that starts within EDGE_PX of a side edge; and
 *  each touchcancel, as when the system takes a touch for its back gesture. */
function watchLifecycle(record: (event: string, detail?: Record<string, unknown>) => void): void {
  document.addEventListener("visibilitychange", () => record("visibilitychange", { state: document.visibilityState }));
  window.addEventListener("pagehide", (event) => record("pagehide", { persisted: event.persisted }));
  window.addEventListener("pageshow", (event) => record("pageshow", { persisted: event.persisted }));
  document.addEventListener("freeze", () => record("freeze"));
  document.addEventListener("resume", () => record("resume"));
  window.addEventListener("blur", () => record("blur"));
  window.addEventListener("focus", () => record("focus"));
  const touchAt = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    return touch === undefined ? undefined : edgeDistance(touch.clientX, innerWidth);
  };
  const touchOptions = { passive: true };
  document.addEventListener(
    "touchstart",
    (event) => {
      const at = touchAt(event);
      if (at !== undefined && at.px <= EDGE_PX) record("touchstart", at);
    },
    touchOptions,
  );
  document.addEventListener("touchcancel", (event) => record("touchcancel", touchAt(event)), touchOptions);
  let last = clocks();
  const frame = () => {
    const now = clocks();
    const gap = frameGap(last, now);
    if (gap !== undefined) record("frame gap", { ...gap });
    last = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

interface Provider {
  uuid: string;
  name: string;
  rdns: string;
}

/** Asks the wallets for their EIP-6963 announcements, and hands each to `announced`. */
function watchProviders(announced: (provider: Provider) => void): void {
  window.addEventListener("eip6963:announceProvider", (event) => {
    const { uuid, name, rdns } = (event as CustomEvent<{ info: Provider }>).detail.info;
    announced({ uuid, name, rdns });
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

function logTable(entries: LogEntry[]): HTMLElement[] {
  const row = (cells: string[]) => {
    const tr = document.createElement("tr");
    tr.append(...cells.map((text) => Object.assign(document.createElement("td"), { textContent: text })));
    return tr;
  };
  const head = document.createElement("thead");
  head.append(row(["Time", "Event", "performance.now()", "Detail"]));
  const body = document.createElement("tbody");
  body.append(
    ...entries.map(({ event, perfMs, dateMs, detail }) =>
      row([new Date(dateMs).toISOString().slice(11, 23), event, perfMs.toFixed(1), detail === undefined ? "" : JSON.stringify(detail)]),
    ),
  );
  return [head, body];
}

export async function mount(): Promise<void> {
  const load = Math.round(performance.timeOrigin);
  const providers: Provider[] = [];
  const clockProbes: Record<string, unknown>[] = [];
  const current: LogEntry[] = [];
  let earlier: LogEntry[] = [];
  const storage = browserStorage();
  // Read before this load's first entry replaces the copy.
  let unsaved = loadStored(storage, UNSAVED, isLogEntries, () => []);
  let featureReport: Record<string, unknown> = {};
  let hides = 0;
  const showError = (error: unknown) => (element("probe-error").textContent = messageOf(error));

  function update(): void {
    const log = [...earlier, ...current];
    const results = { build: __GIT_SHA__, load, features: featureReport, context: context(), eip6963: providers, clockProbes, log };
    element<HTMLTextAreaElement>("results").value = JSON.stringify(results, null, 2);
    element("log").replaceChildren(...logTable(log));
  }

  function keepUnsaved(): void {
    if (!save(storage, UNSAVED, [...unsaved, ...current])) {
      showError("localStorage refused the log's copy: the last events before the page went away may be missing from the next load");
    }
  }

  // Events that fire while the log opens are written once it has opened.
  const opening = (async () => openLog(indexedDB))();
  function record(event: string, detail?: Record<string, unknown>): void {
    const { perfMs, dateMs } = clocks();
    const entry: LogEntry = { load, seq: current.length, event, perfMs: Math.round(perfMs * 10) / 10, dateMs, ...(detail && { detail }) };
    current.push(entry);
    keepUnsaved();
    opening.then((log) => log.add(entry)).catch(showError);
    update();
  }
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  record("load", {
    navigation: navigation?.type ?? "unknown",
    wasDiscarded: (document as { wasDiscarded?: boolean }).wasDiscarded ?? "missing",
  });
  watchLifecycle(record);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hides += 1;
  });
  watchProviders((provider) => {
    providers.push(provider);
    update();
  });

  const indexedDb = await attempt(async () => {
    const log = await opening;
    const stored = await log.all();
    const missing = unsaved.filter((entry) => !stored.some((kept) => kept.load === entry.load && kept.seq === entry.seq));
    for (const entry of missing) await log.add(entry);
    unsaved = [];
    keepUnsaved();
    earlier = [...stored, ...missing].filter((entry) => entry.load !== load).sort(recordOrder);
    return "ok";
  });
  const core = await attempt(loadCore);
  featureReport = { ...(await features()), indexedDB: indexedDb, engine: typeof core === "string" ? core : "ok" };
  update();

  element("copy").addEventListener("click", () => {
    const results = element<HTMLTextAreaElement>("results");
    results.select();
    results.setSelectionRange(0, results.value.length);
    // Where navigator.clipboard is missing, its call throws, which the promise catches too.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(results.value))
      .catch((error: unknown) => showError(`could not copy, so the results are selected: ${messageOf(error)}`));
  });
  const clearLog = element<HTMLButtonElement>("clear-log");
  clearLog.disabled = indexedDb !== "ok";
  clearLog.addEventListener("click", () => {
    opening
      .then((log) => log.clear())
      .then(() => {
        earlier = [];
        current.length = 0;
        unsaved = [];
        keepUnsaved();
        update();
      })
      .catch(showError);
  });

  const start = element<HTMLButtonElement>("clock-probe");
  if (typeof core === "string") {
    showError(`the clock probe needs the game engine: ${core}`);
    return;
  }
  start.disabled = false;
  start.addEventListener("click", () => {
    start.disabled = true;
    runClockProbe(core, () => hides)
      .then((result) => {
        clockProbes.push(result);
        update();
      })
      .catch(showError)
      .finally(() => (start.disabled = false));
  });
}

/** A screen wake lock, where the browser grants one, and what the request gave. */
async function wakeLock(): Promise<{ lock?: WakeLockSentinel; state: string }> {
  if (!("wakeLock" in navigator)) return { state: "missing" };
  try {
    return { lock: await answered(navigator.wakeLock.request("screen")), state: "held" };
  } catch (error) {
    return { state: describe(error) };
  }
}

/** Runs the clock probe on the page's field, holding a screen wake lock where the browser grants
 *  one, so that a phone's auto-lock does not hide the page during the probe's three minutes. */
async function runClockProbe(core: Core, hides: () => number): Promise<Record<string, unknown>> {
  const { lock, state } = await wakeLock();
  const renderer = new Renderer(element<HTMLCanvasElement>("field"));
  element("field-view").hidden = false;
  fitField(renderer);
  const started = { perfMs: performance.now(), dateMs: Date.now() };
  let drawn = -1;
  try {
    const result = await clockProbe(core, {
      now: () => performance.now(),
      frame: () => new Promise((resolve) => requestAnimationFrame(resolve)),
      hides,
      pumped: (ticksRun) => {
        if (ticksRun === drawn) return;
        drawn = ticksRun;
        renderer.drawCells(core.grid(), core.dirtyCells());
        renderer.frame(core.snapshot());
        element("probe-ticks").textContent = String(ticksRun);
      },
    });
    element("probe-behind").textContent = String(result.maxBehind);
    element("probe-a3").textContent = result.hides > 0 ? `not measured: the page was hidden ${result.hides} times` : result.a3 ? "holds" : "fails";
    return {
      startedAt: new Date(started.dateMs).toISOString(),
      perfMs: Math.round(performance.now() - started.perfMs),
      dateMs: Date.now() - started.dateMs,
      wakeLock: state,
      ...result,
    };
  } finally {
    await lock?.release();
  }
}

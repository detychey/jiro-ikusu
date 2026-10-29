// The typed loader of jiro-wasm (plan M1.11): the raw extern "C" exports, and a thin wrapper
// that moves bytes through wasm memory. A call that returns a non-zero code throws, so a misuse
// of the interface never goes unnoticed.

export const MISUSE = 255;
export const HASH_LEN = 32;
export const MINION_SLOTS = 3;
export const GRID_CELLS = 3_600;

/** README §4.10 and the Outcome's endReason (§7.3). */
export const END_REASONS = ["Committed", "Cleared", "Out of lives", "Time limit"] as const;
export type EndReason = (typeof END_REASONS)[number];

interface Exports {
  memory: WebAssembly.Memory;
  input_ptr(): number;
  input_capacity(): number;
  rules_version(): number;
  validate_level(len: number): number;
  load_level(len: number): number;
  start(mode: number, levelIndex: number): number;
  tick(rawMask: number): number;
  end_reason(): number;
  grid_ptr(): number;
  dirty_cells(): number;
  dirty_ptr(): number;
  player_x(): number;
  player_y(): number;
  player_cutting(): number;
  lives(): number;
  shield(): number;
  invulnerable(): number;
  boss_x(): number;
  boss_y(): number;
  boss_size(): number;
  minion_state(slot: number): number;
  minion_x(slot: number): number;
  minion_y(slot: number): number;
  minion_heading(slot: number): number;
  claim_bp(): number;
  target_bp(): number;
  ticks_used(): number;
  ticks_left(): number;
  state_hash(): number;
  journal_ptr(): number;
  journal_len(): number;
}

export interface Minion {
  state: "live" | "destroyed";
  x: number;
  y: number;
  /** 0 N, 1 E, 2 S, 3 W. */
  heading: number;
}

export interface Snapshot {
  player: { x: number; y: number; cutting: boolean };
  lives: number;
  shield: number;
  invulnerable: number;
  boss: { x: number; y: number; size: number };
  minions: Minion[];
  claimBp: number;
  targetBp: number;
  ticksUsed: number;
  ticksLeft: number;
}

export class CoreError extends Error {
  constructor(
    readonly call: string,
    readonly code: number,
  ) {
    super(`${call} returned code ${code}${code === MISUSE ? " (misuse of the interface)" : ""}`);
  }
}

export class Core {
  private constructor(private readonly wasm: Exports) {}

  static async load(source: BufferSource): Promise<Core> {
    const { instance } = await WebAssembly.instantiate(source, {});
    return new Core(instance.exports as unknown as Exports);
  }

  get rulesVersion(): number {
    return this.wasm.rules_version();
  }

  /** Validates `level` (README §5) and keeps it for `start`; returns 0 or its error code. */
  loadLevel(level: Uint8Array): number {
    this.input(level);
    return this.wasm.load_level(level.length);
  }

  /** Starts the loaded level with `runNonce` (32 bytes) at `levelIndex`, in `mode` (0 Training,
   *  1 Challenge). */
  start(runNonce: Uint8Array, mode: number, levelIndex: number): void {
    if (runNonce.length !== HASH_LEN) throw new Error(`a run nonce is ${HASH_LEN} bytes`);
    this.input(runNonce);
    this.check("start", this.wasm.start(mode, levelIndex));
  }

  /** Processes the next tick with the controls held now (README §6.1 bits), through the
   *  Recorder; returns how the level ended, if it did. */
  tick(mask: number): EndReason | undefined {
    this.check("tick", this.wasm.tick(mask));
    return this.endReason();
  }

  endReason(): EndReason | undefined {
    return END_REASONS[this.wasm.end_reason() - 1];
  }

  /** The 3,600 cell values, row-major, as a view valid until the next call. */
  grid(): Uint8Array {
    return this.view(this.wasm.grid_ptr(), GRID_CELLS);
  }

  /** The indices of the cells changed since the last call (every cell after `start`). */
  dirtyCells(): Uint16Array {
    const count = this.wasm.dirty_cells();
    return new Uint16Array(this.wasm.memory.buffer, this.wasm.dirty_ptr(), count);
  }

  snapshot(): Snapshot {
    const w = this.wasm;
    const minions: Minion[] = [];
    for (let slot = 0; slot < MINION_SLOTS; slot += 1) {
      const state = w.minion_state(slot);
      if (state === 0) continue;
      minions.push({
        state: state === 1 ? "live" : "destroyed",
        x: w.minion_x(slot),
        y: w.minion_y(slot),
        heading: w.minion_heading(slot),
      });
    }
    return {
      player: { x: w.player_x(), y: w.player_y(), cutting: w.player_cutting() === 1 },
      lives: w.lives(),
      shield: w.shield(),
      invulnerable: w.invulnerable(),
      boss: { x: w.boss_x(), y: w.boss_y(), size: w.boss_size() },
      minions,
      claimBp: w.claim_bp(),
      targetBp: w.target_bp(),
      ticksUsed: w.ticks_used(),
      ticksLeft: w.ticks_left(),
    };
  }

  /** The state hash v1 after the last tick (README §6.4). */
  stateHash(): Uint8Array<ArrayBuffer> {
    return this.view(this.wasm.state_hash(), HASH_LEN).slice();
  }

  /** The journal bytes so far (README §6.3). */
  journal(): Uint8Array<ArrayBuffer> {
    return this.view(this.wasm.journal_ptr(), this.wasm.journal_len()).slice();
  }

  private input(bytes: Uint8Array): void {
    if (bytes.length > this.wasm.input_capacity()) throw new CoreError("input", MISUSE);
    this.view(this.wasm.input_ptr(), bytes.length).set(bytes);
  }

  private view(ptr: number, len: number): Uint8Array<ArrayBuffer> {
    return new Uint8Array(this.wasm.memory.buffer, ptr, len);
  }

  private check(call: string, code: number): void {
    if (code !== 0) throw new CoreError(call, code);
  }
}

export function hex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function fromHex(text: string): Uint8Array {
  const digits = text.replace(/^0x/, "");
  if (digits.length % 2 !== 0 || /[^0-9a-f]/i.test(digits)) throw new Error(`not hex: ${text}`);
  return Uint8Array.from({ length: digits.length / 2 }, (_, i) => parseInt(digits.slice(2 * i, 2 * i + 2), 16));
}

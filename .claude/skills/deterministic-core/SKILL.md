---
name: deterministic-core
description: Use when implementing or changing game logic in the core — grid, player, boss, minions, capture, scoring, level loading, seed derivation, tick order. The core is the referee for real-money results, so any change can invalidate recorded games.
---

# Deterministic core

The core is the single implementation of the game rules. It is compiled for the Pico, the browser, the Stylus referee, a RISC-V zkVM guest (RV64IM) and the tests. Its output is a pure function of (level bytes, run nonce, journal). README §4 is the rulebook; this skill is about keeping the implementation deterministic.

## Rules

- **Integers only.** No `f32`/`f64` and no float math. Fractions are basis points (10,000 = 1). Multiply first, then do a single floor division at a documented point.
- **No time.** No delta-time, no clocks, no skipped ticks. State changes once per tick, in the order of README §4.4. Within a step, iterate in a fixed order: minions by index, cells in row-major order.
- **No hidden inputs.** Randomness comes only from the seed derivation in README §6.4. Never use a hardware RNG, memory addresses, or iteration over a hash map.
- **No heap, no recursion.** Use fixed-size arrays, with the capacities from README §2. Fills use an explicit stack.
- **Small and freestanding.** Stay `no_std`, without `alloc` if possible. A Stylus contract must fit in 24 KB compressed; ethblockdigger's referee is 23 KB.
- **No `usize` in state, hashing or serialization.** The zkVM target is 64-bit, while the Pico, wasm and Stylus are 32-bit, so `usize` changes size between targets. Use it only for indexing.
- **Explicit integer semantics.** Use fixed-width types and explicit casts. Use `checked_*` or `wrapping_*` wherever overflow is possible. Set `overflow-checks = true` in every Cargo profile: a plain `+` otherwise panics in debug builds and wraps in release builds.
- **No panics in stepping code.** A panic means a rejected journal. Validate everything at the boundary, in the decoder, so that stepping can never panic.
- **Reflection** is axis-separated inversion (README §4.6). Velocities are always ±1.

## Changing a rule

A rule change changes the outcome of existing journals. In the same change:

1. Bump `RULES_VERSION`.
2. Update README §4.
3. Regenerate `vectors/`, and explain in the PR why outcomes moved.

## Done when

- Unit tests and property tests pass (see `parity-testing`).
- Every target in CI reproduces the vectors.

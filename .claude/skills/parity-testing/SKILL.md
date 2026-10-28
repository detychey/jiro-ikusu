---
name: parity-testing
description: Use when writing tests for game logic or checking that targets agree — golden vectors, per-tick state-hash traces, property tests, differential fuzzing, playtest bots. One mismatched tick between the Pico, the browser and the referee invalidates a game.
---

# Parity testing

## Golden vectors (`vectors/`)

Each vector maps (level bytes, run nonce, journal bytes) to a per-tick trace of state hashes plus the final outcome (`claim_bp`, score, end reason). The native core generates the vectors and they are committed. Every target replays them: native, wasm, the Pico test firmware, the zkVM executor and the onchain referee.

**Compare per-tick traces,** not just final hashes. The first tick that differs locates the bug.

**Coverage.** One vector per rule in README §4, plus long random games. Include at least:

- each capture shape [COV-01];
- corner reflection and a corridor exactly as wide as the boss's body, for small and large bodies [COV-02];
- the player stepping onto a cell of the boss's body other than its top-left, such as the bottom-right cell, from the right and from below [COV-03];
- the swap collision [COV-04];
- a fast cut closing on its first sub-step [COV-05];
- the shield [COV-06];
- respawn after the bottom border was captured [COV-07];
- a player stranded off the rail by their own capture [COV-08];
- several hits in one tick, with and without a shield charge or invulnerability [COV-09];
- end conditions that meet on the same tick, such as clearing the level and losing the last life [COV-10];
- the Commit key [COV-11];
- the time limit, including events at tick T − 1 and T [COV-12];
- a full journal [COV-13].

## Property tests

- No cell of the boss's body is ever `CLAIMED` or `TRAIL`.
- Captured cells only grow, so `claim_bp` never decreases.
- A capture doesn't depend on visit order: a stack, a queue and a scanline fill give the same grid.
- Minions stay on rail cells and satisfy the coverage property of [README §4.7](../../../README.md#47-minions) (PIN-14): each covers its whole rail component, with no local loops. The draft's plain right-hand rule fails it where the rail is two cells thick, so run the test on random boards with captures happening mid-patrol.
- Journals survive an encode/decode round trip, and malformed journals are rejected.

## Differential fuzzing

Run random journals through every target build and compare the traces. A mismatch is a consensus bug: fix the core or the target, then add the case to `vectors/`.

## Playtest bots

Scripted policies play every level headlessly; ethblockdigger's `src/sim/policies` is the model. Their clear rates calibrate the 16 levels and the season 1 scoring weights (README §5, §8.4).

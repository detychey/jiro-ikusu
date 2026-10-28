---
name: journal-codec
description: Use when touching any byte format shared between the device, the browser and the chain — input mask, journal v1 encoding, run commitment, seed derivation, level bytes and level id, state hash. These formats are consensus, so a one-byte difference rejects valid games.
---

# Journal and byte formats

README §6 defines the formats. Rules for implementing them:

- **One implementation, in the core.** Every target calls it. The browser and the contracts never re-encode by hand.
- **Big-endian, fixed width, no memory dumps.** C struct padding makes `{ uint16_t tick; uint8_t mask; }` 4 bytes long, not 3.
- **Strict decoders,** in the order and with the codes of README §6.3 and §5. Return the first broken rule's code.
  - The journal decoder rejects what the bytes alone show: truncation or trailing bytes; an unknown format version, rules version or mode, mode 2 included until Superchallenge returns (PIN-12); a `levelIndex` of 6 or more; an `eventCount` above 2,700; a tick of 2,700 or more; ticks that don't increase; reserved bits; events that don't change the mask.
  - Replay, which knows the level, then rejects, in this order: an invalid level, a `levelId` that doesn't match the level bytes, events at or after the level's time limit, and, after play, events after the level ended.
- **The journal records exactly what the core consumed:** inputs → journal → core.
- **keccak256 for derivation and commitments only.** It is cheap onchain and available in `no_std` Rust (`tiny-keccak`, `sha3`). Seeds are derived once per level, and every derivation has its own domain tag. v1 has no per-tick randomness; if it is ever needed, use an integer PRNG inside the core with explicit 32-bit wrapping, not keccak256 per tick.
- **Version every format:** the journal's `version` byte and `rulesVersion` field (the core's `RULES_VERSION`), and the state-hash version. A change bumps the matching version and regenerates `vectors/`.

## Done when

- `encode(decode(x)) == x` holds for every vector.
- Every malformed fixture is rejected, with one test per rejection rule.

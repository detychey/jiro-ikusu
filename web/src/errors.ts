// The error codes of the core (core/src/error.rs): journals and replay, 1 to 15 (README §6.3),
// and levels, 20 to 39 (README §5), each under the core's name with what it means.

export const ERRORS: Readonly<Record<number, readonly [name: string, meaning: string]>> = {
  1: ["Truncated", "the journal ends inside its 71-byte header or its events"],
  2: ["TrailingBytes", "bytes follow the journal's header and events"],
  3: ["Version", "the journal's version is not 1"],
  4: ["RulesVersion", "the journal was played under another rules version"],
  5: ["Mode", "the journal's mode is 2 or above"],
  6: ["LevelIndex", "the journal's level index is 6 or above"],
  7: ["EventCount", "the journal counts more than 2,700 events"],
  8: ["TickLimit", "an event's tick is 2,700 or more"],
  9: ["TickOrder", "an event's tick is not above the previous event's"],
  10: ["ReservedBit", "an event sets the reserved bit 7"],
  11: ["UnchangedMask", "an event repeats the mask already held"],
  12: ["LevelId", "the journal's level id is not keccak256 of the level bytes"],
  13: ["EventPastTimeLimit", "an event is at or after the level's time limit"],
  14: ["EventAfterEnd", "an event follows the tick on which the level ended"],
  15: ["Invariant", "an internal invariant broke: the core has a bug"],
  20: ["LevelLength", "the level is not exactly 472 bytes"],
  21: ["LevelVersion", "the level's version is not 1"],
  22: ["BorderObstacle", "an obstacle is on the border"],
  23: ["BossSize", "the boss body size is not 2 to 8"],
  24: ["SpawnOrder", "the boss spawn rectangle has x0 above x1 or y0 above y1"],
  25: ["SpawnBounds", "the boss spawn rectangle lets the body reach the border"],
  26: ["BossPeriod", "the boss move period is 0"],
  27: ["MinionCount", "the minion count is above 3"],
  28: ["MinionSpawn", "a minion spawn is outside the field"],
  29: ["MinionSlot", "an unused minion slot is not all zero"],
  30: ["MinionPeriod", "the minion move period is 0 with minions, or not 0 without"],
  31: ["RespawnDelay", "the respawn delay is 0 with minions, or not 0 without"],
  32: ["TimeLimit", "the time limit is not 1 to 2,700 ticks"],
  33: ["Lives", "the level gives no life"],
  34: ["Target", "the target is not 1 to 10,000 bp"],
  35: ["OpenAreaSplit", "the open area is not one 4-connected region"],
  36: ["OpenAreaSmall", "the open area has fewer than 1,682 cells"],
  37: ["BossSpawn", "from some cell of the spawn rectangle, the boss body covers a cell that is not open"],
  38: ["MinionSpawnRail", "a minion spawn is not a rail cell"],
  39: ["PlayerStartRail", "the player start (30, 59) is not a rail cell"],
};

/** A core error code as `error <code> (<Name>): <meaning>`. */
export function describeError(code: number): string {
  const known = ERRORS[code];
  return known === undefined ? `error ${code}` : `error ${code} (${known[0]}): ${known[1]}`;
}

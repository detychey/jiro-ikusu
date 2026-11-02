// The season check (README §6.3, §8.4): the page plays a season only under the rules it accepts,
// on the levels it draws from. The wasm core's RULES_VERSION must be the season's rulesVersion,
// and the 16 shipped levels' ids the season's levelIds, slot by slot; otherwise settlement would
// reject every journal of the run, so the page refuses to buy one.

/** The fields of a season's parameters that the check reads. */
export interface SeasonRules {
  rulesVersion: bigint;
  levelIds: readonly string[];
}

/** Throws, with the reason, unless the page may buy a run in `season`. */
export function checkSeason(rulesVersion: number, shippedLevelIds: readonly string[], season: SeasonRules): void {
  const refuse = (reason: string): never => {
    throw new Error(`this page cannot play the season: ${reason}`);
  };
  if (season.rulesVersion !== BigInt(rulesVersion)) {
    refuse(`it accepts rules version ${season.rulesVersion}, and the page plays rules version ${rulesVersion}`);
  }
  if (season.levelIds.length !== shippedLevelIds.length) {
    refuse(`it draws from ${season.levelIds.length} levels, and the page ships ${shippedLevelIds.length}`);
  }
  const slot = season.levelIds.findIndex((levelId, i) => levelId.toLowerCase() !== shippedLevelIds[i]?.toLowerCase());
  if (slot >= 0) refuse(`its level in slot ${slot} is ${season.levelIds[slot]}, and the page ships ${shippedLevelIds[slot]}`);
}

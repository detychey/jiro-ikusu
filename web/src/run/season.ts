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

/** What the season view shows (README §8.4): the season's price, pot and parameters. */
export interface SeasonFacts {
  number: bigint;
  runFee: bigint;
  end: bigint;
  rulesVersion: bigint;
  rakeBp: bigint;
  grace: bigint;
  commitSlack: bigint;
  minClears: bigint;
  /** The season's run fees so far. */
  fees: bigint;
  /** The players' pots of earlier seasons that had no qualified points (Season.pendingRollover). */
  rollover: bigint;
}

/** The players' pot that closing the season now would give (README §8.4): the fees, less the
 *  rake rounded down, plus the rollover. */
export function projectedPlayersPot(facts: Pick<SeasonFacts, "fees" | "rakeBp" | "rollover">): bigint {
  return facts.fees - (facts.fees * facts.rakeBp) / 10_000n + facts.rollover;
}

/** The season view's entries, as label and text, with the players' pot of `projectedPlayersPot`. */
export function seasonEntries(facts: SeasonFacts, formatEth: (wei: bigint) => string): [string, string][] {
  const rollover = facts.rollover === 0n ? "" : `, with ${formatEth(facts.rollover)} rolled over`;
  return [
    ["Season", String(facts.number)],
    ["Run fee", formatEth(facts.runFee)],
    ["Players' pot", `${formatEth(projectedPlayersPot(facts))}: ${formatEth(facts.fees)} of fees less the ${Number(facts.rakeBp) / 100} % rake${rollover}`],
    ["Ends", new Date(Number(facts.end) * 1000).toISOString()],
    ["Settlement", `until ${Number(facts.grace) / 3600} h after the end`],
    ["Commit slack", `${facts.commitSlack} s`],
    ["Qualifies with", `${facts.minClears} cleared level${facts.minClears === 1n ? "" : "s"}`],
    ["Rules version", String(facts.rulesVersion)],
  ];
}

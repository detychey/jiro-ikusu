// The season page (README §8.4; plan M5.3): a season's parameters and players' pot, its end with
// a countdown, its leaderboard from the season's events, the permissionless close once its
// settlement has ended, the player's claim once it has closed, and the settlement of the player's
// best run (settle.ts). Reads go through the network's public RPC, so the page shows the season
// without a wallet; closing, claiming and settling go through the player's wallet. `?season=<n>`
// picks a season; by default it is the newest.

import type { Provider } from "ethers";
import { claim, closeSeason, connectContracts, type Contracts } from "../chain/contracts";
import { bundledDeployment, type Deployment } from "../chain/deployments";
import { footerEntries, renderFooter } from "../chain/footer";
import { claimOf, type LeaderboardRow, seasonLeaderboard } from "../chain/leaderboard";
import { networkOfPage, readOnlyProvider } from "../chain/networks";
import { connect, formatEth, injectedWallet, onNetwork, signerOf, switchNetwork, type Wallet } from "../chain/wallet";
import { element, loadCore, messageOf, pending } from "../page";
import { projectedPlayersPot, type SeasonFacts, seasonEntries } from "../run/season";
import { openRunStore } from "../run/store";
import { shippedLevels } from "../shipped";
import { showSettlement } from "./settle";

export interface SeasonView {
  facts: SeasonFacts;
  /** end + grace: the last second at which the season's runs settle. */
  settlementEnd: bigint;
  closed: boolean;
  /** Whether closeSeason closes this season: the oldest season not yet closed. */
  closesNext: boolean;
  totalQualifiedPoints: bigint;
  /** The players' pot the claims share: the contract's once closed, projected before. */
  playersPot: bigint;
  /** The leaderboard, with each player's claim from `playersPot`. */
  rows: (LeaderboardRow & { claim: bigint })[];
}

/** Season `number` as the page shows it. */
export async function readSeason(contracts: Pick<Contracts, "season" | "challenge">, provider: Provider, number: bigint): Promise<SeasonView> {
  const { season } = contracts;
  const [params, state, end, settlementEnd, rollover, lastClosed] = await Promise.all([
    season.paramsOf(number),
    season.seasons(number),
    season.endOf(number),
    season.settlementEndOf(number),
    season.pendingRollover(),
    season.lastClosedSeason(),
  ]);
  const { runFee, rulesVersion, rakeBp, grace, commitSlack, minClears } = params;
  const facts = { number, runFee, end, rulesVersion, rakeBp, grace, commitSlack, minClears, fees: state.fees, rollover };
  const playersPot = state.closed ? state.playersPot : projectedPlayersPot(facts);
  const rows = (await seasonLeaderboard(contracts, provider, number)).map((row) => ({
    ...row,
    claim: claimOf(row, playersPot, state.totalQualifiedPoints),
  }));
  return {
    facts,
    settlementEnd,
    closed: state.closed,
    closesNext: number === lastClosed + 1n,
    totalQualifiedPoints: state.totalQualifiedPoints,
    playersPot,
    rows,
  };
}

/** Whole seconds as days, hours, minutes and seconds. */
export function formatDuration(seconds: bigint): string {
  const [days, hours, minutes] = [seconds / 86_400n, (seconds / 3_600n) % 24n, (seconds / 60n) % 60n];
  const pad = (value: bigint) => String(value).padStart(2, "0");
  return `${days} d ${pad(hours)} h ${pad(minutes)} min ${pad(seconds % 60n)} s`;
}

/** Where the season stands at block.timestamp `now`, with the time left in that phase. */
export function seasonPhase(view: Pick<SeasonView, "facts" | "settlementEnd" | "closed" | "totalQualifiedPoints">, now: bigint): string {
  if (view.closed) {
    return view.totalQualifiedPoints === 0n
      ? "Closed with no qualified run: its players' pot rolled over to the next season to close."
      : "Closed: each qualified player claims their share.";
  }
  if (now < view.facts.end) return `Accepting runs: it ends in ${formatDuration(view.facts.end - now)}.`;
  if (now <= view.settlementEnd) return `Ended: its runs settle for ${formatDuration(view.settlementEnd - now + 1n)} more.`;
  return "Its settlement has ended: anyone may close it.";
}

export function closable(view: Pick<SeasonView, "settlementEnd" | "closed" | "closesNext">, now: bigint): boolean {
  return !view.closed && view.closesNext && now > view.settlementEnd;
}

/** The season `?season=<n>` names, if any. */
function seasonOfPage(search: string): bigint | undefined {
  const named = new URLSearchParams(search).get("season");
  if (named === null) return undefined;
  if (!/^[1-9][0-9]*$/.test(named)) throw new Error(`?season=${named} is not a season number`);
  return BigInt(named);
}

function renderTable(table: HTMLTableElement, header: string[], rows: string[][]): void {
  table.replaceChildren();
  const head = table.createTHead().insertRow();
  for (const text of header) head.insertCell().textContent = text;
  const body = table.createTBody();
  for (const cells of rows) {
    const row = body.insertRow();
    for (const text of cells) row.insertCell().textContent = text;
  }
}

function renderLeaderboard(view: SeasonView): void {
  const final = view.closed ? "" : " (if it closed now)";
  const rows = view.rows.map((row) => [
    String(row.rank),
    row.player,
    String(row.runId),
    String(row.score),
    String(row.ticks),
    row.qualified ? "yes" : "no",
    String(row.runs),
    row.claimed === undefined ? formatEth(row.claim) : `${formatEth(row.claimed)}, claimed`,
  ]);
  renderTable(element("leaderboard"), ["Rank", "Player", "Best run", "Score", "Ticks", "Qualified", "Runs", `Claim${final}`], rows);
}

/** Runs the page: season.html. */
export function mount(): void {
  const closeButton = element<HTMLButtonElement>("close");
  const connectButton = element<HTMLButtonElement>("connect");
  const claimButton = element<HTMLButtonElement>("claim");
  let deployment: Deployment;
  let number: bigint | undefined;
  try {
    deployment = bundledDeployment(networkOfPage(window.location.search));
    number = seasonOfPage(window.location.search);
  } catch (error) {
    renderFooter(element("footer"), footerEntries(undefined, __GIT_SHA__));
    element("season-error").textContent = messageOf(error);
    connectButton.disabled = true;
    return;
  }
  renderFooter(element("footer"), footerEntries(deployment, __GIT_SHA__));
  const provider = readOnlyProvider(deployment.network);
  const reader = connectContracts(deployment, provider);
  let view: SeasonView | undefined;
  /** The chain's clock minus the page's, in milliseconds. */
  let chainOffsetMs = 0;
  let player: { account: string; contracts: Contracts } | undefined;

  const chainNow = (): bigint => BigInt(Math.floor((Date.now() + chainOffsetMs) / 1000));

  function tick(): void {
    if (view === undefined) return;
    element("season-phase").textContent = seasonPhase(view, chainNow());
    closeButton.hidden = !closable(view, chainNow());
  }

  function showClaim(): void {
    const row = view?.rows.find(({ player: account }) => account.toLowerCase() === player?.account.toLowerCase());
    claimButton.hidden = !(view?.closed && row?.qualified && row.claimed === undefined && row.claim > 0n);
    if (row !== undefined) claimButton.textContent = `Claim ${formatEth(row.claim)}`;
  }

  async function load(): Promise<void> {
    number ??= await reader.season.currentSeason();
    if (number === 0n) throw new Error("no season has opened yet");
    const [shown, latest] = await Promise.all([readSeason(reader, provider, number), provider.getBlock("latest")]);
    if (latest === null) throw new Error("the node returned no latest block");
    chainOffsetMs = latest.timestamp * 1000 - Date.now();
    view = shown;
    const list = element("season-facts");
    list.replaceChildren(
      ...seasonEntries(view.facts, formatEth).flatMap(([label, text]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const value = document.createElement("dd");
        value.textContent = label === "Players' pot" && view?.closed ? formatEth(view.playersPot) : text;
        return [term, value];
      }),
    );
    renderLeaderboard(view);
    showClaim();
    tick();
  }

  async function connectPlayer(): Promise<void> {
    const wallet = injectedWallet(window as { ethereum?: Wallet });
    let connection = await connect(wallet);
    if (!onNetwork(connection, deployment.network)) {
      await switchNetwork(wallet, deployment.network);
      connection = await connect(wallet);
    }
    const signer = await signerOf(wallet, connection, deployment.network);
    const contracts = connectContracts(deployment, signer);
    player = { account: connection.account, contracts };
    connectButton.hidden = true;
    element("wallet-status").textContent = `Connected as ${connection.account}, on ${deployment.network.chainName}.`;
    if (view === undefined || number === undefined) await load();
    showClaim();
    tick();
    if (view === undefined || number === undefined) throw new Error("the season did not load");
    const core = await loadCore();
    const levels = (await shippedLevels()).map(([, level]) => level);
    const store = await openRunStore(window.indexedDB);
    await showSettlement({
      core,
      levels,
      store,
      contracts,
      deployment,
      player: connection.account,
      season: number,
      minClears: Number(view.facts.minClears),
      settled: load,
    });
  }

  connectButton.addEventListener("click", () => void pending(connectButton, connectPlayer, "wallet-error"));
  closeButton.addEventListener("click", () => {
    void pending(
      closeButton,
      async () => {
        if (player === undefined) throw new Error("connect the wallet first");
        const closed = await closeSeason(player.contracts);
        element("season-phase").textContent = `Season ${closed.season} closed.`;
        await load();
      },
      "season-error",
    );
  });
  claimButton.addEventListener("click", () => {
    void pending(
      claimButton,
      async () => {
        if (player === undefined || number === undefined) throw new Error("connect the wallet first");
        const amount = await claim(player.contracts, number);
        element("wallet-status").textContent = `Claimed ${formatEth(amount)} of season ${number}.`;
        await load();
      },
      "wallet-error",
    );
  });
  load().catch((error: unknown) => (element("season-error").textContent = messageOf(error)));
  setInterval(tick, 1_000);
}

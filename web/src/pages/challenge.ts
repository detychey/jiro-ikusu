// The Challenge page (README §8.2): the player's wallet on the network of the page's deployment,
// with a switch to that network, the ETH balance and a faucet link; the season accepting runs,
// its price, pot and parameters; and the run flow of src/run, from the purchase to the commit,
// with the field, the deadline countdown and the run file. A run this browser holds and has not
// committed resumes when the wallet connects. The footer lists the contract addresses and the
// build. Training never loads this page's chain code.

import { bundledDeployment, type Deployment } from "../chain/deployments";
import { type AcceptingSeason, acceptingSeason, connectContracts, type Contracts } from "../chain/contracts";
import { footerEntries, renderFooter } from "../chain/footer";
import { networkOfPage } from "../chain/networks";
import {
  type Connection,
  connect,
  formatEth,
  injectedWallet,
  onNetwork,
  sharedConnection,
  signerOf,
  switchNetwork,
  type Wallet,
  WALLET_EVENTS,
} from "../chain/wallet";
import { type Core, hex } from "../core";
import { CONTROLS, HeldKeys, loadBindings } from "../input";
import { element, exclusive, fitField, loadCore, messageOf, percent, showHud } from "../page";
import { Renderer } from "../render";
import { buyRun, continueRun, playUnfinished, type RunEnv, SeasonChanged } from "../run/flow";
import type { Margin } from "../run/play";
import { replayRunFile, runFileOf } from "../run/runfile";
import { checkSeason, seasonEntries } from "../run/season";
import { openRunStore, type RunRecord, type RunStore, withRunLock } from "../run/store";
import { shippedLevels } from "../shipped";
import { browserStorage } from "../storage";

function show(id: string, text: string): void {
  const shown = element(id);
  shown.textContent = text;
  shown.hidden = text === "";
}

/** Shows the wallet's account, network and balance, offering the switch when it is on another
 *  network; returns whether the wallet is on the page's network. */
async function refresh(wallet: Wallet, deployment: Deployment, connection: Connection): Promise<boolean> {
  const { network } = deployment;
  const switchButton = element<HTMLButtonElement>("switch");
  const faucet = element<HTMLAnchorElement>("faucet");
  if (!onNetwork(connection, network)) {
    const status = `Connected as ${connection.account}, on chain ${connection.chainId}: Challenge runs play on ${network.chainName}.`;
    show("wallet-status", status);
    show("switch", `Switch to ${network.chainName}`);
    show("balance", "");
    faucet.hidden = true;
    return false;
  }
  switchButton.hidden = true;
  show("wallet-status", `Connected as ${connection.account}, on ${network.chainName}.`);
  const signer = await signerOf(wallet, connection, network);
  show("balance", `Balance: ${formatEth(await signer.provider.getBalance(connection.account))}`);
  if (network.faucetUrl !== undefined) {
    faucet.href = network.faucetUrl;
    faucet.hidden = false;
  }
  return true;
}

/** Clears the wallet's account, network and balance, and offers Connect again. */
function showDisconnected(): void {
  for (const id of ["wallet-status", "switch", "balance"]) show(id, "");
  element<HTMLAnchorElement>("faucet").hidden = true;
  element<HTMLButtonElement>("connect").hidden = false;
  element("season").hidden = true;
}

/** Runs `action` with `button` disabled until it settles, showing its error in `errorId`. */
async function pending(button: HTMLButtonElement, action: () => Promise<void>, errorId = "wallet-error"): Promise<void> {
  button.disabled = true;
  show(errorId, "");
  try {
    await action();
  } catch (error) {
    element(errorId).textContent = messageOf(error);
  } finally {
    button.disabled = false;
  }
}

/** The newest deployment on the page's network, or undefined, with the reason shown. */
function deploymentOfPage(): Deployment | undefined {
  try {
    return bundledDeployment(networkOfPage(window.location.search));
  } catch (error) {
    element("wallet-error").textContent = messageOf(error);
    return undefined;
  }
}

function marginText({ onTime, commitBound }: Margin): string {
  return `Deadline: ${onTime} s of slack left, if the run were committed now (commitRun refuses it in ${commitBound} s).`;
}

/** The engine, the 16 shipped levels and the run store, loaded once. */
interface Engine {
  core: Core;
  names: string[];
  levels: Uint8Array[];
  levelIds: string[];
  store: RunStore;
}

async function loadEngine(): Promise<Engine> {
  const core = await loadCore();
  const shipped = await shippedLevels();
  const levels = shipped.map(([, level]) => level);
  return {
    core,
    names: shipped.map(([name]) => name),
    levels,
    levelIds: levels.map((level) => hex(core.levelId(level))),
    store: await openRunStore(window.indexedDB),
  };
}

export function mount(): void {
  const connectButton = element<HTMLButtonElement>("connect");
  const switchButton = element<HTMLButtonElement>("switch");
  const buyButton = element<HTMLButtonElement>("buy");
  const resumeButton = element<HTMLButtonElement>("resume");
  const stopButton = element<HTMLButtonElement>("stop");
  const canvas = element<HTMLCanvasElement>("field");
  const renderer = new Renderer(canvas);
  const bindings = loadBindings(browserStorage());
  const keys = new HeldKeys(bindings);
  const found = deploymentOfPage();
  renderFooter(element("footer"), footerEntries(found, __GIT_SHA__));
  if (found === undefined) {
    connectButton.disabled = true;
    return;
  }
  const deployment: Deployment = found;
  let wallet: Wallet | undefined;
  let engine: Promise<Engine> | undefined;
  /** The season the page shows, which Buy pays into. */
  let shown: AcceptingSeason | undefined;
  /** The run in play, while one is. */
  let active: RunRecord | undefined;
  /** Held while a run is bought, resumed or played: one at a time, on the one Core. */
  const exclusively = exclusive();
  let stopRequested = false;
  let hiddenDuringRun = false;

  const now = () => performance.timeOrigin + performance.now();

  async function runEnv(connection: Connection): Promise<{ env: RunEnv; contracts: Contracts }> {
    if (wallet === undefined) throw new Error("connect the wallet first");
    const loaded = await (engine ??= loadEngine());
    const signer = await signerOf(wallet, connection, deployment.network);
    const contracts = connectContracts(deployment, signer);
    const env: RunEnv = {
      ...loaded,
      keys,
      contracts,
      provider: signer.provider,
      chainId: deployment.network.chainId,
      now,
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      frame: () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
      stopRequested: () => stopRequested,
      view: {
        status: (text) => show("run-status", text),
        levelStarted: (levelIndex, slot) => {
          show("run-status", `Run ${active?.runId ?? ""}: playing. It commits by itself after the sixth level.`);
          show("run-level", `Level ${levelIndex + 1} of 6: ${loaded.names[slot] ?? `slot ${slot}`}`);
          element("field-section").hidden = false;
          stopButton.hidden = false;
          fitField(renderer);
          canvas.focus();
        },
        ticked: (core) => {
          renderer.drawCells(core.grid(), core.dirtyCells());
          const snapshot = core.snapshot();
          renderer.frame(snapshot);
          showHud(snapshot);
        },
        levelEnded: (levelIndex, end) => show("run-level", `Level ${levelIndex + 1} of 6: ${end}.${levelIndex < 5 ? " The next level starts in 3 s." : ""}`),
        margin: (margin) => show("run-margin", marginText(margin)),
      },
    };
    return { env, contracts };
  }

  /** Shows the season accepting runs, and whether this page can play it. */
  async function showSeason(env: RunEnv, contracts: Contracts): Promise<void> {
    const accepting = await acceptingSeason(contracts.season, env.provider);
    const [state, rollover] = await Promise.all([contracts.season.seasons(accepting.number), contracts.season.pendingRollover()]);
    const { number, runFee, end, params } = accepting;
    const { rulesVersion, rakeBp, grace, commitSlack, minClears } = params;
    const facts = { number, runFee, end, rulesVersion, rakeBp, grace, commitSlack, minClears, fees: state.fees, rollover };
    const list = element("season-facts");
    list.replaceChildren(
      ...seasonEntries(facts, formatEth).flatMap(([label, text]) => {
        const term = document.createElement("dt");
        term.textContent = label;
        const value = document.createElement("dd");
        value.textContent = text;
        return [term, value];
      }),
    );
    element("season").hidden = false;
    try {
      checkSeason(env.core.rulesVersion, env.levelIds, params);
      shown = accepting;
      buyButton.disabled = false;
    } catch (error) {
      shown = undefined;
      buyButton.disabled = true;
      show("season-error", messageOf(error));
    }
  }

  /** Plays `record` from the step it reached to its commit, then shows its Outcomes, unless
   *  another tab plays it. Returns whether to go on to the player's next unfinished run. */
  async function play(env: RunEnv, record: RunRecord): Promise<boolean> {
    let failed = false;
    const locked = await withRunLock(navigator.locks, record.key, async () => {
      active = record;
      stopRequested = false;
      hiddenDuringRun = document.hidden;
      element("run").hidden = false;
      element("hidden-warning").hidden = !hiddenDuringRun;
      element("run-outcomes").hidden = true;
      element<HTMLButtonElement>("run-file").hidden = true;
      resumeButton.hidden = true;
      buyButton.hidden = true;
      keys.clear();
      show("run-error", "");
      show("run-status", `Run ${record.runId} of season ${record.season}`);
      try {
        const done = await continueRun(env, record);
        if (done.commit !== undefined) showOutcomes(env, done);
        await showSeason(env, env.contracts);
      } catch (error) {
        failed = true;
        show("run-error", `Run ${record.runId}: ${messageOf(error)}`);
        show("resume", "Continue the unfinished runs");
      } finally {
        active = undefined;
        stopButton.hidden = true;
        buyButton.hidden = false;
        document.title = "Jiro-ikusu Challenge";
      }
    });
    if (!locked) show("season-error", `Run ${record.runId} is open in another tab: it plays there.`);
    return !failed;
  }

  function showOutcomes(env: RunEnv, record: RunRecord): void {
    show("run-level", "");
    show("run-margin", "");
    const file = runFileOf(record, env.levels);
    const outcomes = replayRunFile(env.core, file, record.weightsBp);
    const table = element<HTMLTableElement>("run-outcomes");
    table.replaceChildren();
    for (const [i, { endReason, claimBp, ticksUsed, levelScore }] of outcomes.entries()) {
      const row = table.insertRow();
      row.insertCell().textContent = `Level ${i + 1}`;
      row.insertCell().textContent = `${endReason}, ${percent(claimBp)}, ${ticksUsed} ticks, score ${levelScore}`;
    }
    const score = outcomes.reduce((sum, { levelScore }) => sum + levelScore, 0);
    table.insertRow().insertCell().textContent = `Score ${score}`;
    table.hidden = false;
    const download = element<HTMLButtonElement>("run-file");
    download.hidden = false;
    download.onclick = () => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
      link.download = `jiro-run-${file.chainId}-${file.runId}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    };
  }

  /** Shows the season, and resumes the runs this browser holds and has not committed, unless a
   *  run is already bought, resumed or played in this tab. */
  async function onConnected(connection: Connection): Promise<void> {
    const { env, contracts } = await runEnv(connection);
    await showSeason(env, contracts);
    await exclusively(() => resumeRuns(env, connection.account));
  }

  /** Plays the player's unfinished runs, oldest first, until none is left or one fails. */
  function resumeRuns(env: RunEnv, player: string): Promise<void> {
    return playUnfinished(env, player, (record) => play(env, record));
  }

  async function connected(): Promise<Connection> {
    if (wallet === undefined) throw new Error("connect the wallet first");
    const connection = await sharedConnection(wallet);
    if (connection === undefined) throw new Error("the wallet shares no account: connect it again");
    return connection;
  }

  /** Shows the connection the wallet shares, without prompting, or that it shares none. */
  async function refreshShared(injected: Wallet): Promise<void> {
    const connection = await sharedConnection(injected);
    if (connection === undefined) showDisconnected();
    else if (await refresh(injected, deployment, connection)) await onConnected(connection);
  }

  connectButton.addEventListener("click", () => {
    void pending(connectButton, async () => {
      const injected = wallet ?? injectedWallet(window as { ethereum?: Wallet });
      const connection = await connect(injected);
      const onPageNetwork = await refresh(injected, deployment, connection);
      connectButton.hidden = true;
      if (wallet === undefined) {
        wallet = injected;
        // A wallet event never prompts: a locked or disconnected wallet shows Connect again.
        const onChange = (): void => void pending(connectButton, () => refreshShared(injected));
        for (const event of WALLET_EVENTS) injected.on?.(event, onChange);
      }
      if (onPageNetwork) await onConnected(connection);
    });
  });
  switchButton.addEventListener("click", () => {
    void pending(switchButton, async () => {
      if (wallet === undefined) throw new Error("connect the wallet first");
      await switchNetwork(wallet, deployment.network);
      await refreshShared(wallet);
    });
  });
  buyButton.addEventListener("click", () => {
    void pending(
      buyButton,
      async () => {
        const connection = await connected();
        const { env, contracts } = await runEnv(connection);
        const buy = async (): Promise<void> => {
          if (shown === undefined) throw new Error("no season the page can play accepts runs");
          const record = await buyRun(env, shown, connection.account).catch(async (error: unknown) => {
            if (error instanceof SeasonChanged) await showSeason(env, contracts);
            throw error;
          });
          if (await play(env, record)) await resumeRuns(env, connection.account);
        };
        if (!(await exclusively(buy))) throw new Error("a run is already in play in this tab");
      },
      "season-error",
    );
  });
  resumeButton.addEventListener("click", () => {
    void pending(
      resumeButton,
      async () => {
        const connection = await connected();
        const { env } = await runEnv(connection);
        if (!(await exclusively(() => resumeRuns(env, connection.account)))) throw new Error("a run is already in play in this tab");
      },
      "run-error",
    );
  });
  stopButton.addEventListener("click", () => {
    stopRequested = true;
    stopButton.hidden = true;
  });

  window.addEventListener("resize", () => fitField(renderer));
  window.addEventListener("keydown", (event) => {
    // Bound keys belong to the game only during a run.
    if (active !== undefined && CONTROLS.some((control) => bindings[control] === event.code)) event.preventDefault();
    keys.down(event.code);
  });
  window.addEventListener("keyup", (event) => keys.up(event.code));
  window.addEventListener("blur", () => keys.clear());
  // Browsers throttle the timers of a hidden tab, and stop its animation frames: the game stops
  // while the deadline runs on.
  document.addEventListener("visibilitychange", () => {
    if (active === undefined) return;
    if (document.hidden) {
      hiddenDuringRun = true;
      document.title = "Run in progress: come back - Jiro-ikusu Challenge";
    } else {
      document.title = "Jiro-ikusu Challenge";
    }
    element("hidden-warning").hidden = !hiddenDuringRun;
  });
}

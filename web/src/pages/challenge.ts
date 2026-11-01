// The Challenge page (README §8.2): the player's wallet on the network of the page's deployment,
// with a switch to that network, the ETH balance and a faucet link, and the footer with the
// contract addresses and the build. Training never loads this page's chain code.

import { bundledDeployment, type Deployment } from "../chain/deployments";
import { footerEntries, renderFooter } from "../chain/footer";
import { networkOfPage } from "../chain/networks";
import { connect, formatEth, injectedWallet, onNetwork, signerOf, switchNetwork, type Wallet, WALLET_EVENTS } from "../chain/wallet";
import { element, messageOf } from "../page";

function show(id: string, text: string): void {
  const shown = element(id);
  shown.textContent = text;
  shown.hidden = text === "";
}

/** Shows the wallet's account, network and balance, offering the switch when it is on another network. */
async function refresh(wallet: Wallet, deployment: Deployment): Promise<void> {
  const { network } = deployment;
  const connection = await connect(wallet);
  const switchButton = element<HTMLButtonElement>("switch");
  const faucet = element<HTMLAnchorElement>("faucet");
  if (!onNetwork(connection, network)) {
    const status = `Connected as ${connection.account}, on chain ${connection.chainId}: Challenge runs play on ${network.chainName}.`;
    show("wallet-status", status);
    show("switch", `Switch to ${network.chainName}`);
    show("balance", "");
    faucet.hidden = true;
    return;
  }
  switchButton.hidden = true;
  show("wallet-status", `Connected as ${connection.account}, on ${network.chainName}.`);
  const signer = await signerOf(wallet, connection, network);
  show("balance", `Balance: ${formatEth(await signer.provider.getBalance(connection.account))}`);
  if (network.faucetUrl !== undefined) {
    faucet.href = network.faucetUrl;
    faucet.hidden = false;
  }
}

/** Runs `action` with `button` disabled until it settles, showing its error. */
async function pending(button: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
  button.disabled = true;
  show("wallet-error", "");
  try {
    await action();
  } catch (error) {
    element("wallet-error").textContent = messageOf(error);
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

export function mount(): void {
  const connectButton = element<HTMLButtonElement>("connect");
  const switchButton = element<HTMLButtonElement>("switch");
  const deployment = deploymentOfPage();
  renderFooter(element("footer"), footerEntries(deployment, __GIT_SHA__));
  if (deployment === undefined) {
    connectButton.disabled = true;
    return;
  }
  let wallet: Wallet | undefined;
  connectButton.addEventListener("click", () => {
    void pending(connectButton, async () => {
      if (wallet === undefined) {
        const injected = injectedWallet(window as { ethereum?: Wallet });
        await refresh(injected, deployment);
        wallet = injected;
        const onChange = (): void => void pending(connectButton, () => refresh(injected, deployment));
        for (const event of WALLET_EVENTS) injected.on?.(event, onChange);
        connectButton.hidden = true;
      }
    });
  });
  switchButton.addEventListener("click", () => {
    void pending(switchButton, async () => {
      if (wallet === undefined) throw new Error("connect the wallet first");
      await switchNetwork(wallet, deployment.network);
      await refresh(wallet, deployment);
    });
  });
}

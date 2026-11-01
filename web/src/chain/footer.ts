// The footer of the pages that use the chain: the newest generation's contract addresses, linked
// to the network's explorer, and the git sha the site was built from.

import { CONTRACT_KEYS, type Deployment } from "./deployments";

export interface FooterEntry {
  label: string;
  text: string;
  href?: string;
}

/** The footer's entries; without a deployment, the build's alone. */
export function footerEntries(deployment: Deployment | undefined, gitSha: string): FooterEntry[] {
  const build = { label: "Build", text: gitSha };
  if (deployment === undefined) return [build];
  const explorer = deployment.network.blockExplorerUrls[0];
  return [
    {
      label: "Network",
      text: `${deployment.network.chainName}, contracts deployed ${deployment.deployedAt} (${deployment.backend} referee)`,
    },
    ...CONTRACT_KEYS.map((key) => {
      const address = deployment.addresses[key];
      return { label: key, text: address, ...(explorer === undefined ? {} : { href: `${explorer}/address/${address}` }) };
    }),
    build,
  ];
}

export function renderFooter(footer: HTMLElement, entries: FooterEntry[]): void {
  const list = document.createElement("dl");
  for (const { label, text, href } of entries) {
    const term = document.createElement("dt");
    term.textContent = label;
    const value = document.createElement("dd");
    const content = document.createElement(href === undefined ? "code" : "a");
    content.textContent = text;
    if (href !== undefined) (content as HTMLAnchorElement).href = href;
    value.append(content);
    list.append(term, value);
  }
  footer.replaceChildren(list);
}

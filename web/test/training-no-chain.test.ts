// Training is free and needs no wallet (README §8.1): Training and the level editor must not load
// the chain code, nor ethers. The replay viewer reads committed runs from the chain (plan M5.3),
// through a public RPC, and stays wallet-free: it never loads the wallet module. The test follows
// every import, static or dynamic, from each page's entry script.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WEB = fileURLToPath(new URL("../", import.meta.url));
const CHAIN = join(WEB, "src", "chain");
const CHAIN_FREE_PAGES = ["index.html", "editor.html"];
const WALLET = join(CHAIN, "wallet.ts");

/** The modules a page's inline script imports, as files. */
function entriesOf(page: string): string[] {
  const html = readFileSync(join(WEB, page), "utf8");
  const entries = [...html.matchAll(/import\s[^"]*"(\/src\/[^"]+)"/g)].map(([, path]) => join(WEB, path ?? ""));
  if (entries.length === 0) throw new Error(`${page} imports no module`);
  return entries;
}

function resolve(from: string, specifier: string): string {
  const base = join(dirname(from), specifier);
  const found = [base, `${base}.ts`, join(base, "index.ts")].find((file) => existsSync(file) && file.match(/\.(ts|json)$/));
  if (found === undefined) throw new Error(`${relative(WEB, from)} imports ${specifier}, which resolves to no file`);
  return found;
}

/** Every file a page reaches through relative imports, and the packages it imports. */
function importGraph(page: string): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const pending = entriesOf(page);
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (files.has(file)) continue;
    files.add(file);
    if (file.endsWith(".json")) continue;
    for (const { fileName } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      if (fileName.startsWith(".")) pending.push(resolve(file, fileName));
      else packages.add(fileName);
    }
  }
  return { files, packages };
}

function chainFilesOf(page: string): string[] {
  return [...importGraph(page).files].filter((file) => file.startsWith(CHAIN)).map((file) => relative(WEB, file));
}

describe("the chain-free pages", () => {
  it.each(CHAIN_FREE_PAGES)("%s imports nothing from src/chain", (page) => {
    expect(chainFilesOf(page)).toEqual([]);
  });

  it.each(CHAIN_FREE_PAGES)("%s does not import ethers", (page) => {
    const ethers = [...importGraph(page).packages].filter((name) => name === "ethers" || name.startsWith("ethers/"));
    expect(ethers).toEqual([]);
  });

  it("the replay viewer does not import the wallet", () => {
    expect([...importGraph("replay.html").files]).not.toContain(WALLET);
  });

  it("the import graph reaches the wallet from the Challenge page", () => {
    expect(chainFilesOf("challenge.html")).toContain("src/chain/wallet.ts");
  });
});

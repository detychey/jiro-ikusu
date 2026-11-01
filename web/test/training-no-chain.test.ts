// Training is free and needs no wallet (README §8.1): the pages other than Challenge must not
// load the chain code, nor ethers. The test follows every import, static or dynamic, from each
// page's entry script.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WEB = fileURLToPath(new URL("../", import.meta.url));
const CHAIN = join(WEB, "src", "chain");
const WALLET_FREE_PAGES = ["index.html", "replay.html", "editor.html"];

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

describe("the wallet-free pages", () => {
  it.each(WALLET_FREE_PAGES)("%s imports nothing from src/chain", (page) => {
    expect(chainFilesOf(page)).toEqual([]);
  });

  it.each(WALLET_FREE_PAGES)("%s does not import ethers", (page) => {
    expect([...importGraph(page).packages]).not.toContain("ethers");
  });

  it("the import graph reaches src/chain from the Challenge page", () => {
    expect(chainFilesOf("challenge.html")).toContain("src/chain/wallet.ts");
  });
});

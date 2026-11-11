// The vectors page (plan M3.12, docs/PHONE.md §9.3), in every project: it replays every vector the
// build shipped at dist/vectors/ through the wasm engine, with no mismatch, and fetches no trace,
// which it reads only on a mismatch. Only a pull request's preview build (vite.config.ts's
// preview-pages mode) has the page; on any other build the tests skip.

import { existsSync, readdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const KINDS = ["format", "game", "levels"];
const dist = new URL("../dist/", import.meta.url);
const repoVectors = new URL("../../vectors/", import.meta.url);

/** The files of each kind under `vectors`, the build's or the repository's. */
const files = (vectors: URL) => KINDS.map((kind) => readdirSync(new URL(`${kind}/`, vectors)).sort());
const vectorCount = (kind: string) => readdirSync(new URL(`vectors/${kind}/`, dist)).filter((name) => name.endsWith(".json")).length;

test.skip(!existsSync(new URL("vectors.html", dist)), "this build has no preview pages: build with --mode preview-pages");

test("the build ships every vector file of vectors/", () => {
  expect(files(new URL("vectors/", dist))).toEqual(files(repoVectors));
});

test("the vectors page replays every vector the build shipped, with no mismatch", async ({ page }) => {
  test.setTimeout(300_000);
  const traces: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".trace")) traces.push(request.url());
  });
  await page.goto("/vectors");
  const status = page.locator("#status");
  await expect(status).toHaveAttribute("data-state", /^(done|failed)$/, { timeout: 240_000 });
  const tally = await Promise.all(
    KINDS.map(async (kind) => [kind, await page.locator(`#${kind}-replayed`).textContent(), await page.locator(`#${kind}-mismatches`).textContent()]),
  );
  const replayed = KINDS.reduce((sum, kind) => sum + vectorCount(kind), 0);
  expect({ status: await status.textContent(), tally, failures: await page.locator("#failures li").allTextContents(), traces }).toEqual({
    status: `Done: ${replayed} vectors replayed, 0 mismatches.`,
    tally: KINDS.map((kind) => [kind, String(vectorCount(kind)), "0"]),
    failures: [],
    traces: [],
  });
});

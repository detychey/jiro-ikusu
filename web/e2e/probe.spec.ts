// The probe page (plan M3.12, docs/PHONE.md §9.3), in every project: its results, as JSON, hold
// the feature report and a lifecycle log that IndexedDB keeps, so that the next load shows the
// one before, its pagehide included. Only a pull request's preview build has the page; on any
// other build the tests skip, and pages.yml fails a pull request's build that lacks it.

import { existsSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

test.skip(!existsSync(new URL("../dist/probe.html", import.meta.url)), "this build has no preview pages: build with --mode preview-pages");

/** The page's results, once its feature report is in. */
async function results(page: Page): Promise<{ load: number; features: Record<string, unknown>; log: { load: number; event: string }[] }> {
  const read = async () => JSON.parse(await page.locator("#results").inputValue());
  await expect.poll(async () => (await read()).features.engine, { timeout: 30_000 }).toBeDefined();
  return read();
}

test("the probe page reports its features, and its log keeps the load before a reload", async ({ page }) => {
  await page.goto("/probe");
  await results(page);
  await page.reload();
  const { features, log } = await results(page);
  const loads = log.filter(({ event }) => event === "load").map(({ load }) => load);
  expect({ indexedDB: features.indexedDB, engine: features.engine, loads: loads.length, distinct: new Set(loads).size }).toEqual({
    indexedDB: "ok",
    engine: "ok",
    loads: 2,
    distinct: 2,
  });
});

test("the log keeps the pagehide of the load before a reload, which fired as the page went away", async ({ page }) => {
  await page.goto("/probe");
  const before = (await results(page)).load;
  await page.reload();
  const { log } = await results(page);
  expect(log.filter(({ load }) => load === before).map(({ event }) => event)).toContain("pagehide");
});

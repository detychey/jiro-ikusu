// The browser smoke test (plan M2.2): the built site, on the open-field level with a vector's run
// nonce, plays the vector's keys on Playwright's fake clock, so that every key lands on its tick,
// and must end on the vector's final state hash. The root must load its font (docs/STYLE_GUIDE.md
// §4) with no response of 400 or more, and Training must scroll the field to the top when a game
// starts (§8).

import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const VECTOR = "open-field-capture";
const repo = new URL("../../", import.meta.url);
const vector = JSON.parse(readFileSync(new URL(`vectors/game/${VECTOR}.json`, repo), "utf8"));
const trace = readFileSync(new URL(`vectors/game/${vector.trace}`, repo));
const finalHash = "0x" + trace.subarray(trace.length - 32).toString("hex");

/** The default binding of each input-mask bit (README §6.1, web/README.md). */
const KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyA", "KeyB", "KeyX"];

/** The mask the journal sets at each tick (README §6.2). */
function events(journalHex: string): Map<number, number> {
  const journal = Buffer.from(journalHex.slice(2), "hex");
  const masks = new Map<number, number>();
  for (let at = 71; at + 3 <= journal.length; at += 3) {
    masks.set(journal.readUInt16BE(at), journal[at + 2] ?? 0);
  }
  return masks;
}

/** The canvas's data attributes. Locator waits rely on the page's animation frames, which the
 *  fake clock holds, so the test reads the page directly. */
async function field(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => ({ ...document.getElementById("field")?.dataset }));
}

/** Advances the fake clock one animation frame at a time until `ticks` ticks have run: a frame
 *  is shorter than a tick, so no tick runs before its keys are down. */
async function runUntil(page: Page, ticks: number): Promise<void> {
  while (Number((await field(page)).ticksUsed) < ticks) await page.clock.runFor(16);
}

/** Waits, on the real clock, until the level has started. */
async function started(page: Page): Promise<void> {
  for (let tries = 0; (await field(page)).ticksUsed !== "0"; tries += 1) {
    if (tries === 600) throw new Error("the level did not start");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

test(`plays ${VECTOR}'s keys to its final state hash`, async ({ page }) => {
  // install() lets fake time flow at the real rate until pauseAt(): after it, time moves only
  // through runFor, so no tick runs before its keys are down.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1_000);
  await page.goto(`/?level=Open%20field&nonce=${vector.runNonce}&autoplay`);
  await started(page);
  const masks = events(vector.journal);
  let held = 0;
  for (let tick = 0; ; tick += 1) {
    const mask = masks.get(tick);
    if (mask !== undefined) {
      for (const [bit, key] of KEYS.entries()) {
        const wanted = (mask >> bit) & 1;
        if (wanted !== ((held >> bit) & 1)) await (wanted ? page.keyboard.down(key) : page.keyboard.up(key));
      }
      held = mask;
    }
    await runUntil(page, tick + 1);
    if ((await field(page)).endReason !== undefined) break;
  }
  const end = await field(page);
  expect([end.ticksUsed, end.stateHash]).toEqual([String(vector.outcome.ticksUsed), finalHash]);
});

test("the root loads its font, with no response of 400 or more", async ({ page }) => {
  const failed: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/", { waitUntil: "networkidle" });
  const fontFaces = await page.evaluate(async () => (await document.fonts.load('24px "Jiro Pixel 12"')).length);
  expect([fontFaces, failed]).toEqual([1, []]);
});

test("Training scrolls the field to the top when a game starts", async ({ page }) => {
  // At 360 × 640 the page runs on far enough below the field for its top to reach the canvas's 8-px
  // scroll-margin-top. Autoplay starts the game without a click, which would scroll the page itself,
  // and play()'s canvas.focus() only brings the field's bottom into view: only its scrollIntoView
  // puts the field's top at 8 px.
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/index.html?autoplay");
  await expect.poll(async () => Number((await field(page)).ticksUsed)).toBeGreaterThan(0);
  const top = await page.evaluate(() => document.getElementById("field")?.getBoundingClientRect().top);
  expect(top).toBeCloseTo(8, 0);
});

// Play by touch (plan M3.13, docs/PHONE.md §9.4), in the phone projects only: a tap on Play, the
// stick, COMMIT's hold, §3.4's sizes (A5) and the mirrored setting. Playwright's touchscreen only
// taps, so drags and holds are PointerEvents of pointerType "touch" dispatched in the page.

import { expect, type Page, test } from "@playwright/test";
import { TOUCH_DEFAULTS } from "../src/touch";

test.skip(({ hasTouch }) => !hasTouch, "the touch controls show on touchscreens only");

/** A finger, in the page: it goes down on element `id` at `from`, an offset from the element's
 *  top-left corner, moves to `to`, and moves there in place on every frame until `ticks` ticks have
 *  run or the level has ended, then lifts. Returns the ticks used at its down and at its lift. */
async function finger(page: Page, id: string, from: number[], to: number[], ticks: number): Promise<[number, number]> {
  return page.evaluate(([id, from, to, ticks]) => new Promise<[number, number]>((resolve) => {
    const field = document.getElementById("field") as HTMLElement;
    const target = document.getElementById(id) as HTMLElement;
    const { left, top } = target.getBoundingClientRect();
    const send = (type: string, [x = 0, y = 0]: number[]) =>
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 2, pointerType: "touch", clientX: left + x, clientY: top + y }));
    const used = () => Number(field.dataset.ticksUsed);
    const down = used();
    send("pointerdown", from);
    const frame = () => {
      const done = used() >= down + ticks || field.dataset.endReason !== undefined;
      send(done ? "pointerup" : "pointermove", to);
      if (done) resolve([down, used()]);
      else requestAnimationFrame(frame);
    };
    frame();
  }), [id, from, to, ticks] as const);
}

async function field(page: Page): Promise<Record<string, string | undefined>> {
  return page.evaluate(() => ({ ...document.getElementById("field")?.dataset }));
}

const ticksUsed = async (page: Page) => Number((await field(page)).ticksUsed);

/** The player's cell: the field's one white cell. */
async function playerCell(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const canvas = document.getElementById("field") as HTMLCanvasElement;
    const { data, width } = (canvas.getContext("2d") as CanvasRenderingContext2D).getImageData(0, 0, canvas.width, canvas.height);
    const pixel = data.findIndex((_, i) => i % 4 === 0 && data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) / 4;
    if (pixel < 0) throw new Error("the field shows no player");
    return { x: Math.floor((pixel % width) / 4), y: Math.floor(pixel / width / 4) };
  });
}

/** Opens Training on the open field and starts the level with a tap on Play. */
async function startByTap(page: Page): Promise<void> {
  await page.goto("/?level=Open%20field");
  // The page names the keyboard's layout just before it listens for Play.
  await expect(page.locator("#layout-note")).not.toBeEmpty();
  await expect(page.locator("#touch"), "(pointer: coarse) shows the touch controls").toBeVisible();
  await page.locator("#play").tap();
  await expect.poll(() => ticksUsed(page)).toBeGreaterThan(0);
}

test("a tap on Play starts the level, and the stick steers the player", async ({ page }) => {
  await startByTap(page);
  const start = await playerCell(page);
  await finger(page, "stick", [72, 72], [40, 72], 8);
  const end = await playerCell(page);
  expect([end.x < start.x - 3, end.y]).toEqual([true, start.y]);
});

test("a tap on COMMIT for 2 ticks, shorter than X's hold, does not end the level", async ({ page }) => {
  await startByTap(page);
  const [, lifted] = await finger(page, "pad-x", [28, 28], [28, 28], 2);
  await expect.poll(() => ticksUsed(page)).toBeGreaterThan(lifted + 15);
  expect((await field(page)).endReason).toBeUndefined();
});

test("holding COMMIT 2 px inside its top edge, moving in place, ends the level after X's hold", async ({ page }) => {
  await startByTap(page);
  const [down, lifted] = await finger(page, "pad-x", [28, 2], [28, 2], 60);
  expect([(await field(page)).endReason, lifted]).toEqual(["Committed", down + TOUCH_DEFAULTS.xHold + 1]);
});

/** The distance between two boxes, 0 when they overlap. */
function distance(a: DOMRect, b: DOMRect): number {
  const dx = Math.max(0, a.left - b.right, b.left - a.right);
  const dy = Math.max(0, a.top - b.bottom, b.top - a.bottom);
  return Math.hypot(dx, dy);
}

for (const width of [320, 412]) {
  test(`the controls' sizes meet docs/PHONE.md §3.4 at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    const boxes = await page.evaluate(() =>
      Object.fromEntries(["touch", "stick", "pad-a", "pad-b", "pad-x"].map((id) => [id, document.getElementById(id)?.getBoundingClientRect().toJSON()])),
    );
    const { touch: bar, stick, "pad-a": a, "pad-b": b, "pad-x": x } = boxes;
    const side = bar.width - stick.width - 8 >= 152 ? 72 : 64;
    const sizes = [a, b, x].map((box) => `${box.width} x ${box.height}`);
    expect([stick.width >= 144 && stick.height >= 144, ...sizes]).toEqual([true, `${side} x ${side}`, `${side} x ${side}`, "56 x 56"]);
    expect(Math.min(distance(x, a), distance(x, b))).toBeGreaterThanOrEqual(24);
    expect(Math.min(distance(stick, a), distance(stick, x), distance(a, b))).toBeGreaterThanOrEqual(8);
    expect(Math.min(stick.left, width - b.right)).toBeGreaterThanOrEqual(16);
  });
}

test("the mirrored setting puts the stick on the right, and stays after a reload", async ({ page }) => {
  await page.goto("/");
  await page.locator(".controls summary").tap();
  await page.locator("#touch-mirrored").tap();
  await page.reload();
  await expect(page.locator("#touch-mirrored")).toBeChecked();
  const [stick, a] = await Promise.all([page.locator("#stick").boundingBox(), page.locator("#pad-a").boundingBox()]);
  expect((stick?.x ?? 0) > (a?.x ?? 0)).toBe(true);
});

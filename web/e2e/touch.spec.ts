// Play by touch (plan M3.13, docs/PHONE.md §9.4), in the phone projects only: Play starts the open
// field on a tap, the stick steers the player, COMMIT ends the level once held through X's hold
// and not on a shorter tap, the controls' sizes meet §3.4 (A5), and the mirrored setting stays.
// Playwright's touchscreen only taps, so drags and holds are PointerEvents of pointerType
// "touch" dispatched in the page, which Chromium and WebKit both accept.

import { expect, type Page, test } from "@playwright/test";

test.skip(({ hasTouch }) => !hasTouch, "the touch controls show on touchscreens only");

/** A touch pointer event: its type, the id of the element it lands on, its pointerId, and its
 *  offset from that element's center. */
type Touch = [type: string, id: string, pointerId: number, dx?: number, dy?: number];

/** Dispatches `touches` in one task, so that no tick runs between them. */
async function touch(page: Page, ...touches: Touch[]): Promise<void> {
  await page.evaluate((list) => {
    for (const [type, id, pointerId, dx = 0, dy = 0] of list) {
      const target = document.getElementById(id);
      if (target === null) throw new Error(`#${id} is missing`);
      const { left, top, width, height } = target.getBoundingClientRect();
      const at = { clientX: left + width / 2 + dx, clientY: top + height / 2 + dy };
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, pointerType: "touch", ...at }));
    }
  }, touches);
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
  // The page checks the setting's radio button just before it listens for Play.
  await expect(page.locator("#touch-on")).toBeChecked();
  await page.locator("#play").tap();
  await expect.poll(() => ticksUsed(page)).toBeGreaterThan(0);
}

test("a tap on Play starts the level, and the stick steers the player", async ({ page }) => {
  await startByTap(page);
  const start = await playerCell(page);
  await touch(page, ["pointerdown", "stick", 1], ["pointermove", "stick", 1, -32, 0]);
  await expect.poll(async () => (await playerCell(page)).x).toBeLessThan(start.x - 3);
  await touch(page, ["pointerup", "stick", 1]);
  expect((await playerCell(page)).y).toBe(start.y);
});

test("a tap on COMMIT shorter than X's hold does not end the level", async ({ page }) => {
  await startByTap(page);
  await touch(page, ["pointerdown", "pad-x", 2], ["pointerup", "pad-x", 2]);
  const tapped = await ticksUsed(page);
  await expect.poll(() => ticksUsed(page)).toBeGreaterThan(tapped + 15);
  expect((await field(page)).endReason).toBeUndefined();
});

test("holding COMMIT ends the level", async ({ page }) => {
  await startByTap(page);
  await touch(page, ["pointerdown", "pad-x", 2]);
  await expect.poll(async () => (await field(page)).endReason).toBe("Committed");
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
    const button = bar.width - stick.width - 8 >= 152 ? 72 : 64;
    expect({
      stick: stick.width >= 144 && stick.height >= 144,
      a: [a.width, a.height],
      b: [b.width, b.height],
      x: [x.width, x.height],
      xClear: Math.min(distance(x, a), distance(x, b)) >= 24,
      gaps: Math.min(distance(stick, a), distance(stick, x), distance(a, b)) >= 8,
      edges: Math.min(stick.left, width - b.right) >= 16,
    }).toEqual({ stick: true, a: [button, button], b: [button, button], x: [56, 56], xClear: true, gaps: true, edges: true });
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

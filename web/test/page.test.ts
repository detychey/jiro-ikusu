// What the pages share (plan M5.7): the gate that keeps a tab from buying, resuming or playing
// two runs at once on its one Core.

import { describe, expect, it, vi } from "vitest";
import { exclusive } from "../src/page";

describe("the gate of a tab's runs", () => {
  it("refuses a second action while the first is in flight, as two wallet events resuming one run", async () => {
    const exclusively = exclusive();
    let release = () => {};
    const first = exclusively(() => new Promise<void>((resolve) => (release = resolve)));
    const second = vi.fn(async () => {});
    const refused = await exclusively(second);
    release();
    expect([refused, second.mock.calls.length, await first]).toEqual([false, 0, true]);
  });

  it("opens again once the action settled, even by an error", async () => {
    const exclusively = exclusive();
    await expect(exclusively(() => Promise.reject(new Error("the commit failed")))).rejects.toThrow("the commit failed");
    expect(await exclusively(async () => {})).toBe(true);
  });
});

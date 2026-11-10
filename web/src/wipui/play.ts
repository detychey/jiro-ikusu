// Training in the wipui build (docs/STYLE_GUIDE.md §8): once Play has started the game, which the
// page marks by setting the canvas's data-ticks-used to 0, the field scrolls to the top, so the
// banner above it never costs the field a scale step. The scroll is instant, as every motion of the
// identity moves in whole ticks (§10), so it has no animation for reduced motion to remove.

import { element } from "../page";

const canvas = element<HTMLCanvasElement>("field");
new MutationObserver(() => {
  if (canvas.dataset.ticksUsed === "0") canvas.scrollIntoView({ block: "start", behavior: "instant" });
}).observe(canvas, { attributeFilter: ["data-ticks-used"] });

// Fingers on the touch controls: synthetic pointer events on a layout of the pads, which reach
// TouchControls through listenTouch, as the page's events do.

import { type Boxes, listenTouch, type Pad, type Point, TOUCH_DEFAULTS, TouchControls, type TouchParams } from "../src/touch";

/** The pads in client px: the stick's 144-px pad, then X over A and B, 72 px each. */
export const BOXES: Boxes = {
  stick: { left: 0, top: 0, right: 144, bottom: 144 },
  x: { left: 160, top: 0, right: 216, bottom: 56 },
  a: { left: 152, top: 80, right: 224, bottom: 152 },
  b: { left: 232, top: 80, right: 304, bottom: 152 },
};

export function centerOf(pad: Pad): Point {
  const { left, top, right, bottom } = BOXES[pad];
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** TouchControls on BOXES, with its page, its document, and pointer events to send it. */
export function fingers(params: TouchParams = TOUCH_DEFAULTS) {
  const controls = new TouchControls(() => BOXES, params);
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const root = new EventTarget();
  listenTouch(controls, root, page, doc);
  const send = (type: string, pointerId: number, { x, y }: Point = { x: 0, y: 0 }) =>
    root.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX: x, clientY: y }));
  return {
    controls,
    page,
    doc,
    send,
    down: (pointerId: number, at: Point) => send("pointerdown", pointerId, at),
    move: (pointerId: number, at: Point) => send("pointermove", pointerId, at),
    up: (pointerId: number) => send("pointerup", pointerId),
  };
}

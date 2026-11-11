// The touch controls (docs/PHONE.md §3): a floating stick for the directions, and the buttons A, B
// and X, an input source the tick samples beside the keyboard. Touch produces controls, never
// keys, so a touch schedule journals as the same controls on keys do (A2).

import { CONTROL_BITS, type InputSource } from "./input";
import { element } from "./page";
import { load, save, type Storage } from "./storage";

/** The parameters of docs/PHONE.md §3.4, in CSS px, degrees and ticks. */
export interface TouchParams {
  /** The stick sends no direction this close to its origin. */
  deadZone: number;
  /** The stick's origin follows the finger once it is farther than this. */
  follow: number;
  /** The width of the band centered on each diagonal. */
  band: number;
  /** The samples a pointer must have been down on X through before X enters the mask. */
  xHold: number;
}

/** docs/PHONE.md §3.4's defaults. xHold is provisional until M3.14's playtest (A7). */
export const TOUCH_DEFAULTS: TouchParams = { deadZone: 12, follow: 48, band: 20, xHold: 4 };

const { up: UP, down: DOWN, left: LEFT, right: RIGHT, x: X } = CONTROL_BITS;
const DIRECTIONS = UP | DOWN | LEFT | RIGHT;
/** The direction at each quarter turn counterclockwise from right. */
const QUARTERS = [RIGHT, UP, LEFT, DOWN];

/** The direction nearest `angle`, in degrees counterclockwise from right. */
function nearest(angle: number): number {
  return QUARTERS[(((Math.round(angle / 90) % 4) + 4) % 4)] as number;
}

/** The directions the stick sends at `distance` from its origin and `angle` degrees
 *  counterclockwise from right, given those it sent on the previous sample (docs/PHONE.md §3.2):
 *  none inside the dead zone; in the band centered on a diagonal, both adjacent directions when
 *  one of them was sent on the previous sample; otherwise the nearest direction. */
export function stickBits(angle: number, distance: number, previous: number, params: TouchParams = TOUCH_DEFAULTS): number {
  if (distance <= params.deadZone) return 0;
  const diagonal = Math.round((angle - 45) / 90) * 90 + 45;
  const pair = nearest(diagonal - 45) | nearest(diagonal + 45);
  const inBand = Math.abs(angle - diagonal) <= params.band / 2;
  return inBand && (pair & previous) !== 0 ? pair : nearest(angle);
}

export type Point = { x: number; y: number };

/** The stick's origin once the finger is at `finger`: it follows the finger at `radius`, once the
 *  finger is farther than that. */
function followed(origin: Point, finger: Point, radius: number): Point {
  const distance = Math.hypot(finger.x - origin.x, finger.y - origin.y);
  if (distance <= radius) return origin;
  const pull = 1 - radius / distance;
  return { x: origin.x + (finger.x - origin.x) * pull, y: origin.y + (finger.y - origin.y) * pull };
}

const PADS = ["stick", "a", "b", "x"] as const;
export type Pad = (typeof PADS)[number];
type Button = Exclude<Pad, "stick">;
/** A pad's box in client coordinates, as getBoundingClientRect gives it. */
export type Box = Pick<DOMRect, "left" | "top" | "right" | "bottom">;
export type Boxes = Readonly<Record<Pad, Box>>;
/** What the controls read of a PointerEvent. */
type TouchPointer = Pick<PointerEvent, "pointerId" | "clientX" | "clientY">;

function padAt({ x, y }: Point, boxes: Boxes): Pad | undefined {
  return PADS.find((pad) => x >= boxes[pad].left && x < boxes[pad].right && y >= boxes[pad].top && y < boxes[pad].bottom);
}

/** The button under `point`, if any: a pointer holds it. */
function buttonAt(point: Point, boxes: Boxes): Button | undefined {
  const pad = padAt(point, boxes);
  return pad === "stick" ? undefined : pad;
}

/** The touch controls' pointers, sampled once per tick (docs/PHONE.md §3.4). A pointer that
 *  lands on the stick's pad steers, its origin where it landed; any other holds the button under
 *  it, and may slide from one to another. */
export class TouchControls implements InputSource {
  private stick: { pointerId: number; origin: Point; at: Point } | undefined;
  private readonly buttons = new Map<number, Button | undefined>();
  /** The directions of the previous sample, for the diagonal bands. */
  private previous = 0;
  /** The controls held after the last event, and those pressed since the last sample: as for
   *  keys, a tap shorter than a tick still counts once. */
  private heldBefore = 0;
  private tapped = 0;
  /** The samples taken while a pointer was down on X, since it went down. */
  private xSamples = 0;

  constructor(
    private readonly boxes: () => Boxes,
    private readonly params: TouchParams = TOUCH_DEFAULTS,
    private readonly changed: () => void = () => undefined,
  ) {}

  down({ pointerId, clientX: x, clientY: y }: TouchPointer): void {
    const at = { x, y };
    const boxes = this.boxes();
    if (this.stick === undefined && padAt(at, boxes) === "stick") this.stick = { pointerId, origin: at, at };
    else this.buttons.set(pointerId, buttonAt(at, boxes));
    this.update();
  }

  move({ pointerId, clientX: x, clientY: y }: TouchPointer): void {
    const at = { x, y };
    if (this.stick?.pointerId === pointerId) {
      this.stick = { pointerId, origin: followed(this.stick.origin, at, this.params.follow), at };
    } else if (this.buttons.has(pointerId)) {
      this.buttons.set(pointerId, buttonAt(at, this.boxes()));
    } else {
      return;
    }
    this.update();
  }

  /** The pointer is up, cancelled or lost: it holds nothing from the next sample on. */
  release(pointerId: number): void {
    if (this.stick?.pointerId === pointerId) this.stick = undefined;
    this.buttons.delete(pointerId);
    this.update();
  }

  /** Releases every pointer, for example when the page is hidden. */
  clear(): void {
    this.stick = undefined;
    this.buttons.clear();
    this.previous = 0;
    this.heldBefore = 0;
    this.tapped = 0;
    this.xSamples = 0;
    this.changed();
  }

  /** The controls held now: the stick's directions and the buttons under the pointers. */
  held(): number {
    let mask = 0;
    if (this.stick !== undefined) {
      const dx = this.stick.at.x - this.stick.origin.x;
      const dy = this.stick.at.y - this.stick.origin.y;
      mask = stickBits((Math.atan2(-dy, dx) * 180) / Math.PI, Math.hypot(dx, dy), this.previous, this.params);
    }
    for (const button of this.buttons.values()) mask |= button === undefined ? 0 : CONTROL_BITS[button];
    return mask;
  }

  /** The tick's sample: the controls held now or pressed since the last sample, but X only once a
   *  pointer has been down on it through xHold earlier samples. */
  sample(): number {
    const held = this.held();
    const pressed = held | this.tapped;
    const x = (pressed & X) !== 0 && this.xSamples >= this.params.xHold ? X : 0;
    this.xSamples = (held & X) !== 0 ? this.xSamples + 1 : 0;
    const mask = (pressed & ~X) | x;
    this.previous = mask & DIRECTIONS;
    this.tapped = 0;
    this.heldBefore = this.held();
    this.changed();
    return mask;
  }

  /** The stick's origin and finger, while a pointer steers. */
  get stickAt(): { origin: Point; at: Point } | undefined {
    return this.stick;
  }

  /** X's hold so far, in whole ticks, up to xHold. */
  get xHeld(): number {
    return Math.min(this.xSamples, this.params.xHold);
  }

  private update(): void {
    const held = this.held();
    this.tapped |= held & ~this.heldBefore;
    this.heldBefore = held;
    if ((held & X) === 0) this.xSamples = 0;
    this.changed();
  }
}

/** The events that release a pointer, and those that release every control. */
export const POINTER_RELEASES = ["pointerup", "pointercancel", "lostpointercapture"] as const;
export const PAGE_RELEASES = ["blur", "pagehide"] as const;

/** Feeds `controls` the pointers that go down on `root`, the controls' element, and follows them
 *  on `page`, wherever they move or end; releases every control on `page`'s blur and pagehide and
 *  when `doc` turns hidden. */
export function listenTouch(
  controls: TouchControls,
  root: EventTarget,
  page: EventTarget = window,
  doc: EventTarget & Pick<Document, "visibilityState"> = document,
): void {
  root.addEventListener("pointerdown", (event) => controls.down(event as PointerEvent));
  page.addEventListener("pointermove", (event) => controls.move(event as PointerEvent));
  for (const type of POINTER_RELEASES) page.addEventListener(type, (event) => controls.release((event as PointerEvent).pointerId));
  for (const type of PAGE_RELEASES) page.addEventListener(type, () => controls.clear());
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") controls.clear();
  });
}

/** Places `part` at `at` in its pad `zone`, or back at the pad's center. */
function place(part: HTMLElement, at: Point | undefined, zone: Box): void {
  part.style.left = at === undefined ? "" : `${Math.round(at.x - zone.left)}px`;
  part.style.top = at === undefined ? "" : `${Math.round(at.y - zone.top)}px`;
}

/** The page's touch controls, `#touch`: its pads take their pointers, and show the stick where the
 *  thumb is, the buttons held, and X's hold. */
export function mountTouchControls(params: TouchParams = TOUCH_DEFAULTS): TouchControls {
  const pads: Record<Pad, HTMLElement> = { stick: element("stick"), a: element("pad-a"), b: element("pad-b"), x: element("pad-x") };
  const [ring, knob, hold] = [element("stick-ring"), element("stick-knob"), element("x-hold")];
  const rect = (pad: Pad) => pads[pad].getBoundingClientRect();
  const boxes = (): Boxes => ({ stick: rect("stick"), a: rect("a"), b: rect("b"), x: rect("x") });
  const controls: TouchControls = new TouchControls(boxes, params, () => {
    const zone = pads.stick.getBoundingClientRect();
    place(ring, controls.stickAt?.origin, zone);
    place(knob, controls.stickAt?.at, zone);
    const held = controls.held();
    for (const button of ["a", "b", "x"] as const) pads[button].classList.toggle("pressed", (held & CONTROL_BITS[button]) !== 0);
    hold.style.width = params.xHold === 0 ? "0" : `${(100 * controls.xHeld) / params.xHold}%`;
  });
  listenTouch(controls, element("touch"));
  return controls;
}

/** The Controls panel's setting: the touch controls on, off, or mirrored for the left hand. */
export const TOUCH_SETTINGS = ["on", "off", "mirrored"] as const;
export type TouchSetting = (typeof TOUCH_SETTINGS)[number];

const SETTING_KEY = "jiro-ikusu.touch";

function isTouchSetting(value: unknown): value is TouchSetting {
  return TOUCH_SETTINGS.some((setting) => setting === value);
}

/** The stored setting, or on when storage is missing, unreadable or invalid. */
export function loadTouchSetting(storage: Storage | undefined): TouchSetting {
  return load(storage, SETTING_KEY, isTouchSetting, () => "on");
}

/** Stores the setting; returns false when storage is missing or refuses. */
export function saveTouchSetting(storage: Storage | undefined, setting: TouchSetting): boolean {
  return save(storage, SETTING_KEY, setting);
}

/** Shows `#touch` as `setting` asks, and checks its radio button among `input[name="touch"]`. */
export function showTouchSetting(setting: TouchSetting): void {
  const touch = element("touch");
  touch.hidden = setting === "off";
  touch.classList.toggle("mirrored", setting === "mirrored");
  for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="touch"]')) radio.checked = radio.value === setting;
}

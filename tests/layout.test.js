// Run from the repo root: node tests/layout.test.js
// Contract C.4: initLayout keeps the map canvas matched to its box (fixes A1/D1).
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { document, el } = installFakeDocument();

// Controllable frame queue so the test decides when a frame runs.
let rafQ = [];
globalThis.requestAnimationFrame = (fn) => { rafQ.push(fn); return rafQ.length; };
globalThis.cancelAnimationFrame = (id) => { rafQ[id - 1] = null; };
const flushRaf = () => { const q = rafQ; rafQ = []; for (const fn of q) if (fn) fn(); };

// ResizeObserver shim that records instances and fires on demand.
const roInstances = [];
class FakeResizeObserver {
  constructor(cb) { this.cb = cb; this.observed = []; this.disconnected = false; roInstances.push(this); }
  observe(target) { this.observed.push(target); }
  disconnect() { this.disconnected = true; }
  trigger() { if (!this.disconnected) this.cb([{ target: this.observed[0] }], this); }
}
globalThis.ResizeObserver = FakeResizeObserver;

const { initLayout } = await import("../ui/layout.js");

const map = { resizes: 0, resize() { this.resizes++; } };
const layoutEl = el("layout");
const mapEl = el("map");
const card = el("present-card");
card.rect = { top: 10, left: 20, width: 300, height: 200 };

const layout = initLayout(map, { layoutEl, mapEl });
assert.equal(typeof layout.setPresenting, "function");
assert.equal(typeof layout.captionBox, "function");
assert.equal(typeof layout.onResize, "function");
assert.equal(typeof layout.destroy, "function");

// The observer watches the map element.
assert.equal(roInstances.length, 1, "one ResizeObserver created");
assert.ok(roInstances[0].observed.includes(mapEl), "map element is observed");
const ro = roInstances[0];

// Repeated size notifications inside one frame resize the map at most once.
ro.trigger(); ro.trigger(); ro.trigger();
assert.equal(map.resizes, 0, "resize is deferred to a frame");
flushRaf();
assert.equal(map.resizes, 1, "at most one resize per frame for repeated resizes");
ro.trigger(); flushRaf();
assert.equal(map.resizes, 2, "a later frame resizes again");

// onResize subscribers hear about size changes.
let notified = 0;
const off = layout.onResize(() => { notified++; });
ro.trigger(); flushRaf();
assert.equal(notified, 1, "onResize fires once per frame");
off();

// captionBox is null outside presentation mode.
assert.equal(layout.captionBox(), null, "no caption box when not presenting");

// Entering present mode: class on the layout, data-mode on <html>.
layout.setPresenting(true);
assert.ok(layoutEl.classList.contains("presenting"), "presenting class added");
assert.equal(document.documentElement.getAttribute("data-mode"), "present", "data-mode set on <html>");
const box = layout.captionBox();
assert.ok(box, "caption box returned while presenting");
assert.deepEqual({ top: box.top, left: box.left, width: box.width, height: box.height }, card.rect, "caption box is the #present-card rect");

// After the CSS transition ends the map resizes once more.
const beforeTransition = map.resizes;
layoutEl.fire("transitionend");
flushRaf();
assert.ok(map.resizes > beforeTransition, "map.resize called again after transitionend");

// Leaving present mode restores everything.
layout.setPresenting(false);
assert.ok(!layoutEl.classList.contains("presenting"), "presenting class removed");
assert.equal(document.documentElement.getAttribute("data-mode"), null, "data-mode cleared");
assert.equal(layout.captionBox(), null, "caption box gone after exit");

// destroy() disconnects the observer and stops all resize activity.
layout.destroy();
assert.ok(ro.disconnected, "observer disconnected on destroy");
const afterDestroy = map.resizes;
ro.trigger(); flushRaf();
layoutEl.fire("transitionend"); flushRaf();
layout.setPresenting(true); flushRaf();
assert.equal(map.resizes, afterDestroy, "no resizes after destroy");

console.log("layout checks passed");

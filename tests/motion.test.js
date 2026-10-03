// Run from the repo root: node dashboard/tests/motion.test.js
import assert from "node:assert/strict";
import { DUR, animateNumber, capMoves, clamp01, duration, easeInOutCubic, easeOutCubic, flipPlan, lerp, measureRows, playFlip, resetCameraOptions, segmentCameraOptions, tween, wardCameraOptions } from "../motion.js";

// Easings
assert.equal(easeOutCubic(0), 0); assert.equal(easeOutCubic(1), 1); assert.ok(easeOutCubic(0.5) > 0.5, "ease out arrives early");
assert.equal(easeInOutCubic(0), 0); assert.equal(easeInOutCubic(1), 1); assert.ok(Math.abs(easeInOutCubic(0.5) - 0.5) < 1e-9, "ease in out is symmetric");
assert.equal(lerp(10, 20, 0.25), 12.5); assert.equal(clamp01(2), 1); assert.equal(clamp01(-1), 0);
assert.equal(duration(350, true), 0); assert.equal(duration(350, false), 350);
for (const v of Object.values(DUR)) assert.ok(v >= 200 && v <= 700, "durations stay within 200 to 700 ms");

// Tween with injected clock: progresses, eases, completes, can be cancelled.
let clock = 0; const frames = [];
const raf = (fn) => { frames.push(fn); return frames.length; };
const run = () => { const f = frames.shift(); if (f) f(); };
const seen = []; let done = false;
tween({ duration: 100, ease: (t) => t, now: () => clock, raf, caf: () => {}, onUpdate: (t) => seen.push(t), onDone: () => { done = true; } });
run(); clock = 50; run(); clock = 100; run();
assert.deepEqual(seen, [0, 0.5, 1]); assert.equal(done, true);
const seen2 = []; const cancel = tween({ duration: 100, now: () => clock, raf, caf: () => {}, onUpdate: (t) => seen2.push(t) });
cancel(); run(); assert.deepEqual(seen2, [], "cancelled before the first frame");
let sync = null; tween({ duration: 0, onUpdate: (t) => { sync = t; } }); assert.equal(sync, 1, "zero duration completes synchronously");
let noRaf = null; tween({ duration: 300, raf: null, onUpdate: (t) => { noRaf = t; } });

// Count up: formatted, intermediate frames, final exact value, reduced motion jumps.
const el = { textContent: "" }; const fmt = (v) => Number(v).toLocaleString("en-US");
clock = 0; animateNumber(el, 1000, fmt, { duration: 100, now: () => clock, raf, caf: () => {} });
assert.equal(el.textContent, "1,000", "first value is set directly (nothing to count from)");
animateNumber(el, 2000, fmt, { duration: 100, now: () => clock, raf, caf: () => {} });
run(); assert.equal(el.textContent, "1,000"); clock = 50; run(); const mid = Number(el.textContent.replace(/,/g, "")); assert.ok(mid > 1000 && mid < 2000, `counts through intermediate values (${mid})`);
clock = 100; run(); assert.equal(el.textContent, "2,000");
animateNumber(el, 5, fmt, { reduced: true }); assert.equal(el.textContent, "5", "reduced motion: immediate");
animateNumber(el, 7, fmt, { duration: 100, now: () => clock, raf, caf: () => {} }); animateNumber(el, 9, fmt, { duration: 100, now: () => clock, raf, caf: () => {} });
clock = 200; run(); run(); assert.equal(el.textContent, "9", "a second call retargets the first");
animateNumber(null, 1, fmt);

// FLIP plan: moved rows get inverse deltas, entered and left rows are reported.
const before = new Map([["a", { top: 0, left: 0 }], ["b", { top: 40, left: 0 }], ["gone", { top: 80, left: 0 }]]);
const after = new Map([["b", { top: 0, left: 0 }], ["a", { top: 40, left: 0 }], ["new", { top: 80, left: 0 }]]);
const plan = flipPlan(before, after);
assert.deepEqual(plan.moves, [{ key: "b", dx: 0, dy: 40 }, { key: "a", dx: 0, dy: -40 }]);
assert.deepEqual(plan.entered, ["new"]); assert.deepEqual(plan.left, ["gone"]);
assert.equal(flipPlan(before, before).moves.length, 0, "no movement, no moves");
const many = Array.from({ length: 204 }, (_, i) => ({ key: String(i), dx: 0, dy: i }));
assert.equal(capMoves(many, 60).length, 60); assert.equal(capMoves(many, 60)[0].dy, 203, "largest moves animate, the rest snap");
assert.equal(capMoves(many.slice(0, 10), 60).length, 10);
// measureRows skips rows far outside the viewport
const rows = new Map([["x", { getBoundingClientRect: () => ({ top: 10, left: 0, bottom: 40 }) }], ["far", { getBoundingClientRect: () => ({ top: 5000, left: 0, bottom: 5030 }) }], ["norect", {}]]);
const measured = measureRows(rows, { top: 0, bottom: 600, height: 600 });
assert.deepEqual([...measured.keys()], ["x"]);
assert.equal(measureRows(rows).size, 2, "no viewport: every measurable row");
// playFlip sets the inverted transform then releases it on the next frame
const els = new Map([["a", { style: {} }], ["b", { style: {} }]]);
const pending = []; const n = playFlip({ moves: [{ key: "a", dx: 0, dy: -40 }, { key: "b", dx: 0, dy: 40 }] }, els, { raf: (fn) => pending.push(fn) });
assert.equal(n, 2); assert.equal(els.get("a").style.transform, "translate(0px, -40px)"); assert.equal(els.get("a").style.transition, "none");
pending[0](); assert.equal(els.get("a").style.transform, ""); assert.ok(els.get("a").style.transition.includes("350ms"));
assert.equal(playFlip({ moves: [{ key: "a", dx: 0, dy: 1 }] }, els, { reduced: true }), 0, "reduced motion: nothing moves");

// Camera option sets
const w = wardCameraOptions(false); assert.equal(w.fit.pitch, 30); assert.equal(w.fit.duration, 700); assert.ok(w.settle.bearing !== w.fit.bearing, "the ward move settles after the fit");
assert.equal(wardCameraOptions(true).fit.duration, 0); assert.equal(wardCameraOptions(true).settle.duration, 0);
const s = segmentCameraOptions(-12, false); assert.equal(s.pitch, 45); assert.equal(s.bearing, -12); assert.equal(s.duration, 700);
assert.equal(segmentCameraOptions(0, true).duration, 0);
assert.deepEqual(resetCameraOptions([-97.43, 35.225], 11.6, false), { center: [-97.43, 35.225], zoom: 11.6, pitch: 0, bearing: 0, duration: 700 });
assert.equal(resetCameraOptions([0, 0], 1, true).duration, 0);
console.log("motion checks passed");

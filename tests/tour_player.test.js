// Run from the repo root: node dashboard/tests/tour_player.test.js
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
document.addEventListener = (ev, fn) => { (document.listeners ||= {})[ev] = fn; };
const { AUTOPLAY_MS, dotsHtml, initTourPlayer, initialTour, keyAction, swipeAction, tourReduce } = await import("../ui/tour.js");

// Reducer is pure and bounded
let s = tourReduce(initialTour, { type: "next" }); assert.equal(s, initialTour, "inactive: next is a no-op");
s = tourReduce(initialTour, { type: "enter", total: 12, saved: { x: 1 } });
assert.deepEqual(s, { active: true, index: 0, total: 12, autoplay: false, saved: { x: 1 } });
assert.equal(tourReduce(s, { type: "prev" }).index, 0, "cannot go before the first step");
s = tourReduce(s, { type: "next" }); assert.equal(s.index, 1);
s = tourReduce(s, { type: "goto", index: 99 }); assert.equal(s.index, 11, "goto clamps");
s = tourReduce(s, { type: "toggleAutoplay" }); assert.equal(s.autoplay, true);
const atEnd = tourReduce(s, { type: "next" }); assert.equal(atEnd.index, 11); assert.equal(atEnd.autoplay, false, "autoplay stops at the last step");
assert.equal(tourReduce(initialTour, { type: "enter", total: 12, index: 9 }).index, 9, "deep link enters at a step");
assert.equal(tourReduce(initialTour, { type: "enter", total: 12, index: 40 }).index, 11);
assert.deepEqual(tourReduce(s, { type: "exit" }), initialTour);
assert.equal(tourReduce(s, { type: "unknown" }), s);
const frozen = Object.freeze({ ...s }); tourReduce(frozen, { type: "next" }); assert.equal(frozen.index, 11, "input state is not mutated");

// Keys and swipes
assert.deepEqual(keyAction("ArrowRight"), { type: "next" }); assert.deepEqual(keyAction(" "), { type: "next" }); assert.deepEqual(keyAction("ArrowLeft"), { type: "prev" });
assert.deepEqual(keyAction("Escape"), { type: "exit" }); assert.equal(keyAction("a"), null); assert.equal(keyAction("ArrowRight", true), null, "typing in a field is left alone");
assert.deepEqual(swipeAction(-80, 5), { type: "next" }); assert.deepEqual(swipeAction(90, -10), { type: "prev" }); assert.equal(swipeAction(20, 0), null); assert.equal(swipeAction(60, 70), null, "vertical drags are not swipes");
assert.equal((dotsHtml(2, 12).match(/tour-dot/g) || []).length, 12); assert.ok(dotsHtml(2, 12).includes('aria-selected="true" aria-label="Step 3 of 12"'));

// Player: applies steps through the callback, restores on exit, autoplay advances, keyboard works
const steps = Array.from({ length: 3 }, (_, i) => ({ title: `T${i}`, caption: `C${i}`, showPanel: i === 1 }));
const applied = [], exited = [];
const player = initTourPlayer({ steps, applyStep: (st, prev) => applied.push([st.title, prev && prev.title]), onExit: (saved) => exited.push(saved), autoplayMs: 5 });
assert.equal(el("tour").hidden, true, "hidden until Present");
player.dispatch({ type: "enter", total: 3, saved: { s: 1 } });
assert.equal(el("tour").hidden, false); assert.ok(el("layout").classList.contains("presenting")); assert.equal(el("present-toggle").getAttribute("aria-pressed"), "true");
assert.equal(el("tour-step").textContent, "1 of 3"); assert.equal(el("tour-title").textContent, "T0"); assert.equal(el("tour-caption").textContent, "C0");
assert.deepEqual(applied, [["T0", null]]); assert.equal(el("tour-prev").disabled, true);
el("tour-next").fire("click");
assert.deepEqual(applied.at(-1), ["T1", "T0"]); assert.ok(el("layout").classList.contains("tour-panel"), "a step can show the panel");
document.listeners.keydown({ key: "ArrowRight", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(player.getState().index, 2); assert.equal(el("tour-next").disabled, true); assert.ok(!el("layout").classList.contains("tour-panel"));
document.listeners.keydown({ key: "ArrowLeft", target: { tagName: "INPUT" }, preventDefault() {} });
assert.equal(player.getState().index, 2, "arrow keys inside a field are ignored");
document.listeners.keydown({ key: "ArrowLeft", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(player.getState().index, 1);
// swipe left advances
document.listeners.pointerdown({ isPrimary: true, clientX: 300, clientY: 100 }); document.listeners.pointerup({ clientX: 200, clientY: 104 });
assert.equal(player.getState().index, 2, "swipe left goes forward");
document.listeners.pointerdown({ isPrimary: true, clientX: 100, clientY: 100 }); document.listeners.pointerup({ clientX: 220, clientY: 90 });
assert.equal(player.getState().index, 1, "swipe right goes back");
// autoplay
el("tour-autoplay").checked = true; el("tour-autoplay").fire("change");
assert.equal(player.getState().autoplay, true);
await new Promise(r => setTimeout(r, 30));
assert.equal(player.getState().index, 2, "autoplay advanced"); assert.equal(player.getState().autoplay, false, "and stopped at the end");
document.listeners.keydown({ key: "Escape", target: { tagName: "INPUT" }, preventDefault() {} });
assert.equal(player.getState().active, false, "Escape exits even from a field"); assert.deepEqual(exited, [{ s: 1 }]); assert.equal(el("tour").hidden, true);
assert.ok(!el("layout").classList.contains("presenting"));
assert.ok(AUTOPLAY_MS >= 5000);
console.log("tour player checks passed");

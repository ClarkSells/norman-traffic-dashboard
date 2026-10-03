// Run from the repo root: node dashboard/tests/sheet.test.js
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
const { SNAPS, initSheet, initialSheet, pickSnap, sheetReduce, sheetTransform, snapHeights } = await import("../ui/sheet.js");

assert.deepEqual(SNAPS, ["peek", "half", "full"]);
const H = snapHeights(800, 150); assert.deepEqual(H, { peek: 150, half: 443, full: 736 }, "half is the midpoint of peek and full when that beats 55 percent");
assert.deepEqual(snapHeights(800, 50), { peek: 50, half: 440, full: 736 }, "otherwise 55 percent");
assert.equal(snapHeights(100, 150).peek, 100, "peek never exceeds the viewport");
assert.deepEqual(snapHeights(604, 276), { peek: 276, half: 416, full: 556 }, "a 390 by 664 phone gets evenly spaced snaps");
// Nearest snap on a slow release, one step on a flick
assert.equal(pickSnap(200, 0, H), "peek"); assert.equal(pickSnap(420, 0, H), "half"); assert.equal(pickSnap(700, 0, H), "full");
assert.equal(pickSnap(200, -1, H), "half", "flick up from peek goes to half"); assert.equal(pickSnap(460, -1, H), "full");
assert.equal(pickSnap(460, 1, H), "peek", "flick down from half goes to peek"); assert.equal(pickSnap(150, 1, H), "peek");

// Reducer: pure, drag follows the pointer, release snaps
let s = { ...initialSheet, viewportH: 800, peekH: 150 };
assert.equal(sheetReduce(s, { type: "move", y: 10 }), s, "move without a drag is a no-op");
s = sheetReduce(s, { type: "down", y: 700 }); assert.equal(s.dragging, true); assert.equal(s.height, 150);
s = sheetReduce(s, { type: "move", y: 500 }); assert.equal(s.height, 350, "dragging up grows the visible height");
assert.equal(sheetTransform(s), "translateY(calc(100% - 350px))");
s = sheetReduce(s, { type: "move", y: -1000 }); assert.equal(s.height, 736, "cannot drag past full");
s = sheetReduce(s, { type: "up", y: 500, dt: 800 }); assert.equal(s.dragging, false); assert.equal(s.snap, "half", "slow release snaps to the nearest point"); assert.equal(s.height, null);
assert.equal(sheetTransform(s), "translateY(calc(100% - 443px))");
s = sheetReduce(s, { type: "down", y: 400 }); s = sheetReduce(s, { type: "up", y: 330, dt: 50 }); assert.equal(s.snap, "full", "a quick flick up moves one step");
s = sheetReduce(s, { type: "down", y: 100 }); s = sheetReduce(s, { type: "up", y: 170, dt: 50 }); assert.equal(s.snap, "half", "a quick flick down moves one step");
s = sheetReduce(s, { type: "set", snap: "peek" }); assert.equal(s.snap, "peek"); assert.equal(sheetReduce(s, { type: "set", snap: "nope" }), s);
s = sheetReduce(s, { type: "cycle" }); assert.equal(s.snap, "half"); s = sheetReduce(s, { type: "cycle" }); assert.equal(s.snap, "full"); s = sheetReduce(s, { type: "cycle" }); assert.equal(s.snap, "peek");
s = sheetReduce(s, { type: "resize", viewportH: 390, peekH: 120 }); assert.equal(s.viewportH, 390); assert.equal(sheetTransform(s), "translateY(calc(100% - 120px))");
const frozen = Object.freeze({ ...s }); sheetReduce(frozen, { type: "cycle" }); assert.equal(frozen.snap, "peek", "input state is not mutated");

// DOM binding: only active on narrow screens; pointer events drive it; keyboard cycles
const panel = el("panel"), handle = el("sheet-handle"), header = el("briefing"), stats = el("stats");
header.offsetHeight = 80; handle.offsetHeight = 20; stats.offsetHeight = 24; panel.parentNode = { clientHeight: 800 };
const snaps = [];
let narrow = true;
const sheet = initSheet({ panel, handle, header, peekEls: [handle, header, stats], isNarrow: () => narrow, onSnap: (snap, n) => snaps.push([snap, n]) });
assert.ok(panel.classList.contains("sheet")); assert.equal(panel.dataset.snap, "peek"); assert.equal(panel.style.transform, "translateY(calc(100% - 128px))", "peek height = handle + header + stats, measured against the layout box");
assert.ok(handle.getAttribute("aria-label").includes("Now peek"));
handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 1, target: handle });
assert.ok(panel.classList.contains("sheet-dragging"));
handle.fire("pointermove", { clientY: 400 }); assert.equal(panel.style.transform, "translateY(calc(100% - 428px))");
handle.fire("pointerup", { clientY: 400 }); assert.equal(sheet.getState().snap, "half"); assert.ok(!panel.classList.contains("sheet-dragging"));
handle.fire("keydown", { key: "Enter" }); assert.equal(sheet.getState().snap, "full");
handle.fire("keydown", { key: "ArrowDown" }); assert.equal(sheet.getState().snap, "half");
handle.fire("keydown", { key: "ArrowUp" }); assert.equal(sheet.getState().snap, "full");
assert.deepEqual(snaps.at(-1), ["full", true]);
narrow = false; sheet.dispatch({ type: "set", snap: "peek" });
assert.ok(!panel.classList.contains("sheet")); assert.equal(panel.style.transform, "", "wide screens: no transform, the panel is a column again");
handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 1, target: handle }); assert.equal(sheet.getState().dragging, false, "no drag on wide screens");
console.log("sheet checks passed");

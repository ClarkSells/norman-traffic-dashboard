// Run from the repo root: node tests/sheet.test.js
import assert from "node:assert/strict";
import { installFakeDocument, El } from "./fake_dom.js";

// tests/fake_dom.js is lead-owned; it lacks removeEventListener, which destroy() needs. Shim it here, in the test.
if (!El.prototype.removeEventListener) {
  El.prototype.removeEventListener = function (ev, fn) {
    const list = this.listeners[ev];
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  };
}

installFakeDocument();
const { SNAPS, DEFAULT_SNAPS, initSheet, snapHeights, pickSnap } = await import("../ui/sheet.js");

// A fresh fake document per rig so listeners never accumulate between scenarios.
function rig({ narrow = true, reduced = false } = {}) {
  const { el } = installFakeDocument();
  const panel = el("panel"), handle = el("sheet-handle"), header = el("briefing"), mapEl = el("map");
  panel.parentNode = { clientHeight: 800 };
  const captured = [];
  handle.setPointerCapture = (id) => captured.push(id);
  let t = 1000;
  const sheet = initSheet({
    panel, handle, header,
    snaps: { peek: 148, half: 0.52, full: 0.92 },
    isNarrow: () => narrow, reduced, now: () => t,
  });
  return { panel, handle, header, mapEl, sheet, captured, tick: (ms) => { t += ms; } };
}

// ---- Pure helpers ----------------------------------------------------------
assert.deepEqual(SNAPS, ["peek", "half", "full"]);
assert.deepEqual(DEFAULT_SNAPS, { peek: 148, half: 0.52, full: 0.92 }, "design snap points: peek px, half and full fractions of viewport height");
assert.deepEqual(snapHeights(800), { peek: 148, half: 416, full: 736 }, "half is 52 vh, full is 92 vh");
assert.deepEqual(snapHeights(844), { peek: 148, half: 439, full: 776 }, "an iPhone 14 viewport");
assert.deepEqual(snapHeights(800, { peek: 100, half: 0.5, full: 0.9 }), { peek: 100, half: 400, full: 720 }, "custom snaps are honored");
assert.equal(snapHeights(100).peek, 100, "peek never exceeds the viewport");
assert.deepEqual(snapHeights(200), { peek: 148, half: 148, full: 184 }, "half never drops below peek");
// Nearest snap on a slow release, one step on a flick (velocity < 0 = flick up).
const H = snapHeights(800);
assert.equal(pickSnap(200, 0, H), "peek"); assert.equal(pickSnap(420, 0, H), "half"); assert.equal(pickSnap(700, 0, H), "full");
assert.equal(pickSnap(568, 0, H), "half", "just under the half/full midpoint settles to half");
assert.equal(pickSnap(580, 0, H), "full", "just past the half/full midpoint settles to full");
assert.equal(pickSnap(200, -1, H), "half", "flick up from peek goes to half");
assert.equal(pickSnap(460, -1, H), "full"); assert.equal(pickSnap(460, 1, H), "peek", "flick down from half goes to peek");

// ---- DOM binding: three snaps, aria, snapTo --------------------------------
{
  const { panel, handle, sheet } = rig();
  assert.equal(typeof sheet.snapTo, "function"); assert.equal(typeof sheet.current, "function"); assert.equal(typeof sheet.destroy, "function");
  assert.ok(panel.classList.contains("sheet"), "panel becomes a sheet on a narrow screen");
  assert.equal(panel.dataset.snap, "peek");
  assert.equal(panel.style.transform, "translateY(calc(100% - 148px))", "peek shows 148 px of panel");
  assert.equal(sheet.current(), "peek");
  assert.equal(handle.style.touchAction, "none", "the handle never lets the map take the gesture");
  assert.equal(handle.getAttribute("aria-expanded"), "false", "collapsed at peek");

  sheet.snapTo("half");
  assert.equal(sheet.current(), "half");
  assert.equal(panel.dataset.snap, "half");
  assert.equal(panel.style.transform, "translateY(calc(100% - 416px))");
  assert.equal(handle.getAttribute("aria-expanded"), "true", "expanded past peek");

  sheet.snapTo("full");
  assert.equal(panel.style.transform, "translateY(calc(100% - 736px))");
  assert.equal(handle.getAttribute("aria-expanded"), "true");

  sheet.snapTo("peek");
  assert.equal(sheet.current(), "peek");
  assert.equal(handle.getAttribute("aria-expanded"), "false");

  sheet.snapTo("nope");
  assert.equal(sheet.current(), "peek", "unknown snap names are ignored");
  assert.equal(panel.style.transform, "translateY(calc(100% - 148px))");
  sheet.destroy();
}

// ---- Tap toggles peek and half ---------------------------------------------
{
  const { handle, sheet, captured, tick } = rig();
  const down = handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 1 });
  assert.equal(down.prevented, true, "pointerdown is preventDefault-ed so the map never pans");
  assert.deepEqual(captured, [1], "the handle captures the pointer");
  tick(80);
  handle.fire("pointerup", { clientY: 697, pointerId: 1 });
  assert.equal(sheet.current(), "half", "a tap from peek opens to half");

  handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 2 });
  tick(80);
  handle.fire("pointerup", { clientY: 700, pointerId: 2 });
  assert.equal(sheet.current(), "peek", "a second tap toggles back to peek");

  handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 3 });
  tick(500);
  handle.fire("pointerup", { clientY: 700, pointerId: 3 });
  assert.equal(sheet.current(), "peek", "a long press without movement is not a tap and settles back");
  sheet.destroy();
}

// ---- Drag: live transform, nearest-snap settle, flick ----------------------
{
  const { panel, handle, header, mapEl, sheet, tick } = rig();
  handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 1 });
  assert.ok(panel.classList.contains("sheet-dragging"));
  // The map element has no pointermove listener and firing one there changes nothing.
  assert.ok(!(mapEl.listeners.pointermove && mapEl.listeners.pointermove.length), "no pointermove listener on the map");
  mapEl.fire("pointermove", { clientY: 100 });
  assert.equal(panel.style.transform, "translateY(calc(100% - 148px))", "a pointermove on the map does not move the sheet");
  handle.fire("pointermove", { clientY: 400 });
  assert.equal(panel.style.transform, "translateY(calc(100% - 448px))", "the drag follows the pointer live");
  tick(1000);
  handle.fire("pointerup", { clientY: 400 });
  assert.equal(sheet.current(), "half", "a slow release snaps to the nearest point");
  assert.ok(!panel.classList.contains("sheet-dragging"));

  // Drag beyond the halfway point between half and full settles to full.
  handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 2 });
  handle.fire("pointermove", { clientY: 200 });
  tick(1000);
  handle.fire("pointerup", { clientY: 200 });
  assert.equal(sheet.current(), "full", "dragging past the midpoint settles to full");

  // A quick flick up from full-height drag zone moves one step in its direction.
  sheet.snapTo("half");
  handle.fire("pointerdown", { isPrimary: true, clientY: 300, pointerId: 3 });
  tick(30);
  handle.fire("pointerup", { clientY: 200 });
  assert.equal(sheet.current(), "full", "a flick up from half lands on full");

  // The briefing header is a drag surface too.
  header.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 4 });
  header.fire("pointermove", { clientY: 900 });
  tick(400);
  header.fire("pointerup", { clientY: 900 });
  assert.equal(sheet.current(), "half", "dragging the header down from full settles to the nearest snap");

  // A non-primary pointer never starts a drag.
  handle.fire("pointerdown", { isPrimary: false, clientY: 700, pointerId: 9 });
  handle.fire("pointermove", { clientY: 100 });
  assert.equal(panel.style.transform, "translateY(calc(100% - 416px))", "non-primary pointers are ignored");
  sheet.destroy();
}

// ---- Keyboard: single-pointer-free alternative (WCAG 2.5.7) ----------------
{
  const { handle, sheet } = rig();
  handle.fire("keydown", { key: "Enter" });
  assert.equal(sheet.current(), "half");
  handle.fire("keydown", { key: " " });
  assert.equal(sheet.current(), "full");
  handle.fire("keydown", { key: "Enter" });
  assert.equal(sheet.current(), "peek", "Enter cycles through the snaps");
  handle.fire("keydown", { key: "ArrowUp" });
  assert.equal(sheet.current(), "half");
  handle.fire("keydown", { key: "ArrowUp" });
  assert.equal(sheet.current(), "full");
  handle.fire("keydown", { key: "ArrowDown" });
  assert.equal(sheet.current(), "half", "arrow keys step through the snaps");
  sheet.destroy();
}

// ---- Wide screens, reduced motion, destroy ---------------------------------
{
  const { panel, handle, sheet } = rig({ narrow: false });
  assert.ok(!panel.classList.contains("sheet"), "wide screens keep the panel as a column");
  assert.equal(panel.style.transform, "", "no transform on wide screens");
  sheet.snapTo("half");
  assert.equal(sheet.current(), "half");
  assert.equal(panel.dataset.snap, "half");
  assert.equal(panel.style.transform, "", "snapTo never transforms the wide layout");
  sheet.destroy();
}
{
  const { panel, sheet } = rig({ reduced: true });
  sheet.snapTo("full");
  assert.equal(sheet.current(), "full");
  assert.equal(panel.style.transform, "translateY(calc(100% - 736px))", "reduced motion lands on the snap instantly");
  sheet.destroy();
}
{
  const { panel, handle, header, sheet } = rig();
  sheet.destroy();
  sheet.destroy(); // idempotent
  handle.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 1 });
  handle.fire("pointermove", { clientY: 100 });
  handle.fire("pointerup", { clientY: 100 });
  handle.fire("keydown", { key: "Enter" });
  header.fire("pointerdown", { isPrimary: true, clientY: 700, pointerId: 2 });
  assert.equal(sheet.current(), "peek", "destroy removes every listener");
  assert.equal(panel.style.transform, "translateY(calc(100% - 148px))");
  assert.ok(!panel.classList.contains("sheet-dragging"));
}
console.log("sheet checks passed");

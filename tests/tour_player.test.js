// Run from the repo root: node tests/tour_player.test.js
// The C.10 player drives the C.9 present chrome: reducer purity, per-scene autoplay on injectable
// timers, present.onAction routing (replay, explore, goto), keyboard (a toggles autoplay, f fullscreen).
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { document } = installFakeDocument();
document.addEventListener = (ev, fn) => { ((document.listeners ||= {})[ev] ||= []).push(fn); };
const fireDoc = (ev, e) => { for (const fn of (document.listeners || {})[ev] || []) fn(e); };
const { AUTOPLAY_MS, dotsHtml, initTourPlayer, initialTour, keyAction, swipeAction, tourReduce } = await import("../ui/tour.js");

// Reducer is pure and bounded
let s = tourReduce(initialTour, { type: "next" }); assert.equal(s, initialTour, "inactive: next is a no-op");
s = tourReduce(initialTour, { type: "enter", total: 15, saved: { x: 1 } });
assert.deepEqual(s, { active: true, index: 0, total: 15, autoplay: false, saved: { x: 1 } });
assert.equal(tourReduce(s, { type: "prev" }).index, 0, "cannot go before the first scene");
s = tourReduce(s, { type: "next" }); assert.equal(s.index, 1);
s = tourReduce(s, { type: "goto", index: 99 }); assert.equal(s.index, 14, "goto clamps");
s = tourReduce(s, { type: "toggleAutoplay" }); assert.equal(s.autoplay, true);
const atEnd = tourReduce(s, { type: "next" }); assert.equal(atEnd.index, 14); assert.equal(atEnd.autoplay, false, "autoplay stops at the last scene");
assert.equal(tourReduce(initialTour, { type: "enter", total: 15, index: 9 }).index, 9, "deep link enters at a scene");
assert.equal(tourReduce(initialTour, { type: "enter", total: 15, index: 40 }).index, 14);
assert.deepEqual(tourReduce(s, { type: "exit" }), initialTour);
assert.equal(tourReduce(s, { type: "unknown" }), s);
const frozen = Object.freeze({ ...s }); tourReduce(frozen, { type: "next" }); assert.equal(frozen.index, 14, "input state is not mutated");

// Keys and swipes
assert.deepEqual(keyAction("ArrowRight"), { type: "next" }); assert.deepEqual(keyAction(" "), { type: "next" }); assert.deepEqual(keyAction("PageDown"), { type: "next" });
assert.deepEqual(keyAction("ArrowLeft"), { type: "prev" }); assert.deepEqual(keyAction("PageUp"), { type: "prev" });
assert.deepEqual(keyAction("Home"), { type: "goto", index: 0 }); assert.deepEqual(keyAction("End"), { type: "goto", index: Infinity });
assert.deepEqual(keyAction("Escape"), { type: "exit" });
assert.deepEqual(keyAction("a"), { type: "toggleAutoplay" }, "a toggles autoplay");
assert.deepEqual(keyAction("f"), { type: "fullscreen" }, "f toggles fullscreen");
assert.equal(keyAction("ArrowRight", true), null, "typing in a field is left alone");
assert.equal(keyAction("a", true), null, "a in a field types the letter");
assert.deepEqual(swipeAction(-80, 5), { type: "next" }); assert.deepEqual(swipeAction(90, -10), { type: "prev" }); assert.equal(swipeAction(20, 0), null); assert.equal(swipeAction(60, 70), null, "vertical drags are not swipes");
assert.equal((dotsHtml(2, 15).match(/tour-dot/g) || []).length, 15); assert.ok(dotsHtml(2, 15).includes('aria-selected="true" aria-label="Step 3 of 15"'));
assert.ok(AUTOPLAY_MS >= 5000);

// --- C.2 scene fixtures: title (manual), one timed city scene, closing (manual) -------------------
const FULL_STATE = { ward: null, metric: "combined", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: false, selectedLocId: null, basemap: "light", reducedMotion: false, heat: false, flow: false, presenting: true };
const scene = (id, index, autoplayMs, kind = "city") => ({
  id, index, number: index + 1, total: 3, kind, title: `T${index}`, caption: `C${index}`,
  stats: [], legend: null, list: null, state: { ...FULL_STATE }, basemap: "light", lightPreset: "dusk",
  camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
  layers: { flow: false, heat: false, dots: "all", callouts: [], pulse: [], mask: null, segmentsOpacity: 1 },
  autoplayMs,
});
const scenes = [scene("title", 0, null, "title"), scene("city", 1, 1000), scene("closing", 2, null, "closing")];

function fakePresent() {
  const calls = { show: [], hide: 0, progress: [], controls: [], autoplay: [] };
  let cb = null;
  return {
    calls,
    show: (sc, ctx) => calls.show.push([sc.id, ctx && ctx.prev ? ctx.prev.id : null]),
    hide: () => { calls.hide++; },
    setProgress: (i, total, f) => calls.progress.push([i, total, f]),
    setControlsVisible: (v) => calls.controls.push(v),
    setAutoplay: (v) => calls.autoplay.push(v),
    onAction: (fn) => { cb = fn; },
    fire: (a) => cb(a),
  };
}

// Injectable clock: setInterval handles fire when advance() crosses their due time.
function fakeTimers() {
  let t = 0, next = 1; const ivs = new Map();
  return {
    now: () => t,
    setInterval: (fn, ms) => { const id = next++; ivs.set(id, { fn, ms, due: t + ms }); return id; },
    clearInterval: (id) => { ivs.delete(id); },
    advance: (ms) => {
      const end = t + ms;
      for (;;) {
        let hit = null;
        for (const [id, iv] of ivs) if (iv.due <= end && (hit === null || iv.due < ivs.get(hit).due)) hit = id;
        if (hit === null) break;
        const iv = ivs.get(hit); t = iv.due; iv.due = t + iv.ms; iv.fn();
      }
      t = end;
    },
  };
}

// --- Player behavior ------------------------------------------------------------------------------
const timers = fakeTimers();
const present = fakePresent();
const applied = [], entered = [], exited = [];
const player = initTourPlayer({
  scenes, present, timers,
  applyScene: (sc, prev) => applied.push([sc.id, prev && prev.id]),
  onEnter: (saved) => entered.push(saved),
  onExit: (saved) => exited.push(saved),
});

// enter: applyScene(scene, prev) and present.show fire with no previous scene
player.dispatch({ type: "enter", total: 3, saved: { s: 1 } });
assert.deepEqual(applied, [["title", null]], "applyScene on enter");
assert.deepEqual(present.calls.show, [["title", null]], "present.show on enter");
assert.deepEqual(entered, [{ s: 1 }]);

// title and closing never auto advance, even with autoplay on
present.fire("autoplay");
assert.equal(player.getState().autoplay, true);
timers.advance(30000);
assert.equal(player.getState().index, 0, "title (autoplayMs null) never auto advances");
assert.ok(present.calls.progress.every(p => p[2] === 0), "no countdown fraction on a manual scene");

// autoplay uses scene.autoplayMs and reports the fraction every 100 ms
present.fire({ goto: 1 });
assert.deepEqual(applied.at(-1), ["city", "title"], "applyScene on index change carries the previous scene");
assert.deepEqual(present.calls.show.at(-1), ["city", "title"]);
timers.advance(100);
assert.deepEqual(present.calls.progress.at(-1), [1, 3, 0.1], "first heartbeat at 100 ms");
timers.advance(900);
assert.equal(player.getState().index, 2, "advanced exactly when scene.autoplayMs elapsed");
assert.deepEqual(applied.at(-1), ["closing", "city"]);
const fractions = present.calls.progress.filter(p => p[0] === 1);
const expected = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
assert.equal(fractions.length, expected.length, "progress every 100 ms plus the entry reset");
fractions.forEach((p, i) => { assert.equal(p[1], 3, "setProgress carries the total"); assert.ok(Math.abs(p[2] - expected[i]) < 1e-9, `fraction ${i}: got ${p[2]}`); });

present.fire("autoplay"); // back on, at the closing scene
timers.advance(30000);
assert.equal(player.getState().index, 2, "closing (autoplayMs null) never auto advances");

// replay goes to scene 0, explore exits through the same path as exit
present.fire("replay");
assert.equal(player.getState().index, 0, "replay goes to 0");
assert.deepEqual(applied.at(-1), ["title", "closing"]);
present.fire("explore");
assert.equal(player.getState().active, false, "explore exits");
assert.equal(present.calls.hide, 1, "explore hides the chrome");
assert.deepEqual(exited, [{ s: 1 }], "onExit gets the saved explore state");

player.dispatch({ type: "enter", total: 3 });
present.fire("next"); assert.equal(player.getState().index, 1);
present.fire("prev"); assert.equal(player.getState().index, 0);
present.fire("exit"); assert.equal(player.getState().active, false); assert.equal(present.calls.hide, 2);

// --- The next autoplay tick waits for a promised applyScene ---------------------------------------
const timers2 = fakeTimers();
const present2 = fakePresent();
const applied2 = [];
let resolveApply = null;
const player2 = initTourPlayer({
  scenes, present: present2, timers: timers2,
  applyScene: (sc, prev) => { applied2.push([sc.id, prev && prev.id]); return new Promise((res) => { resolveApply = res; }); },
});
player2.dispatch({ type: "enter", total: 3, index: 1 });
assert.deepEqual(applied2, [["city", null]]);
player2.dispatch({ type: "toggleAutoplay" });
timers2.advance(500);
assert.ok(present2.calls.progress.every(p => p[2] === 0), "no autoplay tick until applyScene resolves");
resolveApply();
await Promise.resolve(); await Promise.resolve();
timers2.advance(250);
const fr2 = present2.calls.progress.filter(p => p[0] === 1 && p[2] > 0).map(p => p[2]);
assert.deepEqual(fr2, [0.1, 0.2], "countdown starts once applyScene settles");
player2.dispatch({ type: "exit" });

// --- Keyboard: a toggles autoplay, f toggles fullscreen -------------------------------------------
let fsReq = 0, fsExit = 0;
document.documentElement.requestFullscreen = () => { fsReq++; };
document.exitFullscreen = () => { fsExit++; };
player.dispatch({ type: "enter", total: 3 });
fireDoc("keydown", { key: "a", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(player.getState().autoplay, true, "a key toggles autoplay");
fireDoc("keydown", { key: "f", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(fsReq, 1, "f key requests fullscreen");
document.fullscreenElement = document.documentElement;
fireDoc("keydown", { key: "f", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(fsExit, 1, "f key again exits fullscreen");
delete document.fullscreenElement;
fireDoc("keydown", { key: "ArrowRight", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(player.getState().index, 1);
fireDoc("keydown", { key: "ArrowLeft", target: { tagName: "INPUT" }, preventDefault() {} });
assert.equal(player.getState().index, 1, "arrow keys inside a field are ignored");
fireDoc("keydown", { key: "Escape", target: { tagName: "INPUT" }, preventDefault() {} });
assert.equal(player.getState().active, false, "Escape exits even from a field");

// swipe left advances on the map
player.dispatch({ type: "enter", total: 3 });
fireDoc("pointerdown", { isPrimary: true, clientX: 300, clientY: 100 }); fireDoc("pointerup", { clientX: 200, clientY: 104 });
assert.equal(player.getState().index, 1, "swipe left goes forward");
fireDoc("pointerdown", { isPrimary: true, clientX: 100, clientY: 100 }); fireDoc("pointerup", { clientX: 220, clientY: 90 });
assert.equal(player.getState().index, 0, "swipe right goes back");
player.dispatch({ type: "exit" });

// --- Wave 4 fixes: chrome keyboard isolation (3.7-02, 3.7-03) and autoplay switch sync (3.5-1) ----
player.dispatch({ type: "enter", total: 3 });
let pd = 0;
const noDefault = () => { pd++; };
// Space or arrows on a focused present-chrome button must activate it natively: no dispatch, no preventDefault
const inButton = { tagName: "SPAN", closest: (sel) => (sel.includes("button") ? { id: "present-prev" } : null) };
fireDoc("keydown", { key: " ", target: inButton, preventDefault: noDefault });
assert.equal(player.getState().index, 0, "Space on a focused button does not step scenes");
assert.equal(pd, 0, "native button activation is not suppressed");
fireDoc("keydown", { key: "Enter", target: inButton, preventDefault: noDefault });
assert.equal(player.getState().index, 0, "Enter on a focused button is left to the browser");
assert.equal(pd, 0);
fireDoc("keydown", { key: "ArrowRight", target: inButton, preventDefault: noDefault });
assert.equal(player.getState().index, 0, "arrows on chrome do not step scenes");
assert.equal(pd, 0);
// Arrow keys inside the progress tablist belong to the roving-tabindex navigation, not the player
const inProgress = { tagName: "DIV", closest: (sel) => (sel.includes("#present-progress") ? { id: "present-progress" } : null) };
fireDoc("keydown", { key: "ArrowRight", target: inProgress, preventDefault: noDefault });
assert.equal(player.getState().index, 0, "Right inside #present-progress does not step");
fireDoc("keydown", { key: "ArrowLeft", target: inProgress, preventDefault: noDefault });
assert.equal(player.getState().index, 0, "Left inside #present-progress does not step");
assert.equal(pd, 0, "tablist keeps its own key handling");
// Global keys still work when focus is on body/map, and Escape exits even from chrome
fireDoc("keydown", { key: "ArrowRight", target: { tagName: "BODY", closest: () => null }, preventDefault: noDefault });
assert.equal(player.getState().index, 1, "arrows still step scenes from the map/body");
fireDoc("keydown", { key: "Escape", target: inButton, preventDefault: noDefault });
assert.equal(player.getState().active, false, "Escape exits even with focus on a button");

// The autoplay switch follows player state: the a key, the reducer's last-scene auto-off, enter/exit
player.dispatch({ type: "enter", total: 3 });
let syncs = present.calls.autoplay.length;
fireDoc("keydown", { key: "a", target: { tagName: "BODY" }, preventDefault() {} });
assert.equal(player.getState().autoplay, true);
assert.equal(present.calls.autoplay.length, syncs + 1, "the a key syncs the switch");
assert.equal(present.calls.autoplay.at(-1), true, "switch shows autoplay on");
player.dispatch({ type: "next" });
assert.equal(player.getState().autoplay, true, "mid-tour next keeps autoplay");
player.dispatch({ type: "next" }); // lands on the last scene
assert.equal(player.getState().index, 2);
assert.equal(player.getState().autoplay, false, "reducer forces autoplay off at the last scene");
assert.equal(present.calls.autoplay.at(-1), false, "switch shows autoplay off at the last scene");
player.dispatch({ type: "goto", index: 1 });
player.dispatch({ type: "toggleAutoplay" });
player.dispatch({ type: "exit" });
assert.equal(present.calls.autoplay.at(-1), false, "exit with autoplay on syncs the switch off");

// Older chrome without setAutoplay keeps working (stub compatibility)
const legacy = fakePresent(); delete legacy.setAutoplay;
const legacyPlayer = initTourPlayer({ scenes, present: legacy, timers: fakeTimers(), applyScene: () => {} });
legacyPlayer.dispatch({ type: "enter", total: 3 });
legacyPlayer.dispatch({ type: "toggleAutoplay" });
assert.equal(legacyPlayer.getState().autoplay, true, "toggle works without a setAutoplay surface");
legacyPlayer.dispatch({ type: "exit" });

console.log("tour player checks passed");

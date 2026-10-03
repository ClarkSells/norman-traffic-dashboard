// Run from the repo root: node tests/present.test.js
// Presentation chrome (ui/present.js) against the fake DOM. Scene fixtures follow CONTRACTS.md C.2.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
const { AUTO_HIDE_MS, CROSSFADE_MS, initPresent } = await import("../ui/present.js");

// Injectable timer queue: records (fn, ms), fires on demand.
function fakeTimers() {
  let next = 1; const pending = new Map();
  return {
    setTimeout: (fn, ms) => { const h = next++; pending.set(h, { fn, ms }); return h; },
    clearTimeout: (h) => { pending.delete(h); },
    runDue: (ms) => { for (const [h, t] of [...pending]) if (t.ms === ms) { pending.delete(h); t.fn(); } },
  };
}

// A Scene (C.2) with sensible defaults; tests override what they exercise.
function scene(over = {}) {
  return {
    id: "city", index: 1, number: 2, total: 14,
    kind: "city", title: "Every counted segment", caption: "204 counted segments carry the through traffic.",
    stats: [{ label: "Segments", value: "204" }, { label: "Crash records", value: "23,595" }, { label: "Assigned", value: "5,307" }],
    legend: "combined", list: null,
    state: {}, basemap: "light", lightPreset: "dusk",
    camera: { kind: "establish" }, motion: { orbitDeg: 14, driftDeg: 0 },
    layers: { flow: true, heat: false, dots: "none", callouts: [], pulse: [], mask: null, segmentsOpacity: 1 },
    autoplayMs: 10000,
    ...over,
  };
}

const timers = fakeTimers();
const present = initPresent({ root: el("present"), reducedMotion: false, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
assert.equal(typeof present.show, "function"); assert.equal(typeof present.hide, "function");
assert.equal(typeof present.setProgress, "function"); assert.equal(typeof present.setControlsVisible, "function");
assert.equal(typeof present.onAction, "function");

// --- show(scene) writes the card -------------------------------------------------
const s1 = scene();
present.show(s1);
assert.equal(el("present").hidden, false, "show reveals the chrome");
assert.equal(el("present-scene-count").textContent, "Scene 2 of 14", "eyebrow scene count");
assert.equal(el("present-title").textContent, s1.title);
assert.equal(el("present-caption").textContent, s1.caption);
assert.equal(el("present-card").dataset.kind, "city", "card carries the scene kind for layout");
const stats = el("present-stats").children;
assert.equal(stats.length, 3, "one stat per scene.stats entry");
assert.equal(stats[0].children[0].textContent, "204", "stat order: value first");
assert.equal(stats[0].children[1].textContent, "Segments", "then its label");
assert.equal(stats[2].children[0].textContent, "5,307", "order preserved to the last stat");
const legendHtml = el("present-legend").innerHTML;
assert.ok(legendHtml.includes('data-metric="combined"'), "legend chip keyed by scene.legend");
assert.ok(legendHtml.includes("Combined score"), "chip carries the metric label");
assert.equal(el("present-list").children.length, 0, "no list cards without scene.list");
assert.equal(el("present-closing").hidden, true, "closing block stays hidden on a city scene");

// --- ward scene: top-five list cards, no legend chip -----------------------------
const ward = scene({
  kind: "ward", legend: null, stats: [],
  list: [
    { rank: 1, locId: "52500-158", road: "W Main St", span: "12th Ave NE to 24th Ave NE", score: "98" },
    { rank: 2, locId: "36250-44", road: "Lindsey St", span: "Berry Rd to Imhoff Rd", score: "91" },
  ],
});
present.show(ward, { prev: s1 });
timers.runDue(CROSSFADE_MS / 2);
const cards = el("present-list").children;
assert.equal(cards.length, 2, "one card per list entry");
assert.equal(cards[0].dataset.loc, "52500-158", "card keeps the loc id");
assert.equal(cards[0].children[0].textContent, "#1", "rank leads the card");
assert.equal(cards[1].children[2].textContent, "91", "score trails the card");
assert.equal(el("present-legend").innerHTML, "", "no chip when scene.legend is null");
assert.equal(el("present-stats").children.length, 0, "list replaces the stat strip");

// --- closing layout ----------------------------------------------------------------
present.show(scene({ kind: "closing", title: "Explore it yourself", stats: [], legend: null, list: null }), { prev: ward });
timers.runDue(CROSSFADE_MS / 2);
assert.equal(el("present-card").dataset.kind, "closing");
assert.equal(el("present-closing").hidden, false, "closing scene reveals Replay and Explore");

// --- title layout ------------------------------------------------------------------
present.show(scene({ kind: "title", number: 1, title: "Norman street segment priorities", stats: [], legend: null }), { prev: s1 });
timers.runDue(CROSSFADE_MS / 2);
assert.equal(el("present-card").dataset.kind, "title");
assert.equal(el("present-scene-count").textContent, "Scene 1 of 14");
assert.equal(el("present-closing").hidden, true, "title scene keeps the closing block hidden");

// --- crossfade: data-anim out then in ----------------------------------------------
const a = scene({ title: "First" });
const b = scene({ title: "Second" });
present.show(a);
assert.equal(el("present-card").getAttribute("data-anim"), null, "first show renders without a crossfade");
present.show(b, { prev: a });
assert.equal(el("present-card").getAttribute("data-anim"), "out", "crossfade starts with the out phase");
assert.equal(el("present-title").textContent, "First", "content holds until the out phase ends");
timers.runDue(CROSSFADE_MS / 2);
assert.equal(el("present-card").getAttribute("data-anim"), "in", "then the in phase");
assert.equal(el("present-title").textContent, "Second", "content swapped at the midpoint");

// --- reduced motion: no crossfade ----------------------------------------------------
const timers2 = fakeTimers();
const reduced = initPresent({ root: el("present"), reducedMotion: true, setTimeout: timers2.setTimeout, clearTimeout: timers2.clearTimeout });
reduced.show(a);
reduced.show(b, { prev: a });
assert.equal(el("present-card").getAttribute("data-anim"), null, "reduced motion skips the crossfade");
assert.equal(el("present-title").textContent, "Second", "content swaps immediately");

// --- progress: one tab per scene, active carries the fraction -------------------------
present.setProgress(1, 4, 0.25);
const prog = el("present-progress");
assert.equal(prog.children.length, 4, "one segment per scene");
const [p0, p1, p2] = prog.children;
assert.equal(p1.getAttribute("role"), "tab", "segments are tabs in the tablist");
assert.equal(p1.getAttribute("aria-label"), "Scene 2 of 4");
assert.equal(p1.getAttribute("aria-selected"), "true", "active segment selected");
assert.equal(p0.getAttribute("aria-selected"), "false");
assert.equal(p1.style["--fill"], "0.25", "active segment fills by the fraction");
assert.equal(p0.style["--fill"], "1", "completed segments are solid");
assert.equal(p2.style["--fill"], "0", "future segments are empty");
present.setProgress(1, 4, 0.8);
assert.equal(prog.children.length, 4, "fraction updates reuse the segments");
assert.equal(prog.children[1].style["--fill"], "0.8");

// --- onAction: every control, plus progress clicks ------------------------------------
const actions = [];
present.onAction((act) => actions.push(act));
el("present-next").fire("click");
el("present-prev").fire("click");
el("present-exit").fire("click");
el("present-replay").fire("click");
el("present-explore").fire("click");
el("present-autoplay").checked = true; el("present-autoplay").fire("change");
prog.children[2].fire("click");
assert.deepEqual(actions, ["next", "prev", "exit", "replay", "explore", "autoplay", { goto: 2 }]);
assert.equal(el("present-autoplay").getAttribute("aria-checked"), "true", "switch reflects its state");

// --- controls auto-hide after 3 s idle --------------------------------------------------
const controls = el("present-controls");
assert.equal(controls.classList.contains("hidden"), false, "controls start visible");
timers.runDue(AUTO_HIDE_MS);
assert.equal(controls.classList.contains("hidden"), true, "controls hide after 3 s without pointer movement");
assert.equal(controls.getAttribute("aria-hidden"), "true");
el("present").fire("pointermove");
assert.equal(controls.classList.contains("hidden"), false, "pointer movement brings them back");
timers.runDue(AUTO_HIDE_MS);
assert.equal(controls.classList.contains("hidden"), true, "and they hide again");
el("present").fire("keydown", { key: "ArrowRight" });
assert.equal(controls.classList.contains("hidden"), false, "a key press brings them back");
present.setControlsVisible(true);
assert.equal(controls.classList.contains("hidden"), false);
present.setControlsVisible(false);
assert.equal(controls.classList.contains("hidden"), true, "explicit hide wins");
present.hide();
assert.equal(el("present").hidden, true, "hide dismisses the chrome");

console.log("present chrome checks passed");

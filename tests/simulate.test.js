// Run from the repo root: node tests/simulate.test.js
// The Simulate section (C.14, C.17): controls write state, state syncs back, the year player steps on
// injectable timers and respects reduced motion, Reset returns to the default scenario.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
import { setRaw, SIM_DEFAULT } from "../data.js";
import { getState, setState, subscribe } from "../state.js";

const { el, button } = installFakeDocument();
const { assumptionText, closureArmed, initSimulate, playYears, PLAY_STEP_MS, resetScenario, setClosureArmed, setSampleNotice, stopYears, syncSimulate } = await import("../ui/simulate.js");

setRaw({ segments: { type: "FeatureCollection", features: [] }, wards: { features: [] }, summary: { years: [2021, 2022, 2023, 2024, 2025] }, collisions: null, points: null, closures: null, daytypes: null, horizon: null });
const daytypes = {
  factors: { school_fri: { factor: 1.0, source: "the count itself" }, school_wkday: { factor: 0.95, source: "assumption, FHWA style weekday ratio" }, weekend: { factor: 0.76, source: "assumption, Saturday and Sunday averaged" },
             summer_wkday: { formula: "0.95 * (1 - 0.15 * campus_w)", source: "assumption, campus influence fades 4 km out" }, gameday: { formula: "0.95 * 0.90 * count + routed stadium volume", source: "assumption, stadium capacity at 2.6 per vehicle" } },
  gameday: { vehicles: 30800, seats: 80000, occupancy: 2.6, stadium: [-97.44, 35.21], origins: [{ name: "I-35 at Lindsey", lon: -97.49, lat: 35.21, share: 0.25 }, { name: "I-35 at Main", lon: -97.49, lat: 35.22, share: 0.2 }], closures: [], routes: [] },
};

// assumptionText: pure, from daytypes.json
assert.equal(assumptionText("school_fri", daytypes), "School Friday: the count itself.");
assert.equal(assumptionText("school_wkday", daytypes), "School weekday: 0.95 of the school year Friday count, assumption, FHWA style weekday ratio.");
assert.equal(assumptionText("summer_wkday", daytypes), "Summer weekday: 0.95 * (1 - 0.15 * campus_w), assumption, campus influence fades 4 km out.");
assert.equal(assumptionText("gameday", daytypes), "OU game day: 0.95 * 0.90 * count + routed stadium volume, assumption, stadium capacity at 2.6 per vehicle, 30,800 vehicles, 80,000 seats at 2.6 per vehicle, routed from 2 interchanges to the stadium.");
assert.equal(assumptionText("gameday", { factors: daytypes.factors, gameday: { vehicles: 30800 } }), "OU game day: 0.95 * 0.90 * count + routed stadium volume, assumption, stadium capacity at 2.6 per vehicle, 30,800 vehicles.", "optional game day fields are left out when absent");
assert.ok(assumptionText("weekend", null).includes("not loaded"), "no file, no invented factor");
assert.equal(assumptionText("nope", daytypes), assumptionText("school_fri", daytypes), "unknown day type reads as the default");
for (const dt of Object.keys(daytypes.factors)) assert.ok(!assumptionText(dt, daytypes).includes("—"), "no em dashes");

// Controls
const dtBox = el("daytype-toggle"); const dtBtns = ["school_fri", "school_wkday", "weekend", "summer_wkday", "gameday"].map(v => button(dtBox, "daytype", v));
const gBox = el("growth-toggle"); const gBtns = ["0", "0.01", "0.02"].map(v => button(gBox, "growth", v));
const bBox = el("band-toggle"); const bBtns = ["lo", "base", "hi"].map(v => button(bBox, "band", v));
const scheduled = [];
let cleared = 0;
const timers = { setTimeout: (fn, ms) => { scheduled.push({ fn, ms }); return scheduled.length; }, clearTimeout: () => { cleared++; } };
initSimulate({ daytypes, timers });
subscribe(syncSimulate);   // app.js render() does this for the real page
assert.equal(el("sim-year").min, "2025"); assert.equal(el("sim-year").max, "2035");
assert.ok(el("sim-year-ticks").innerHTML.includes("<span>2025</span>") && el("sim-year-ticks").innerHTML.includes("<span>2035</span>"));
assert.equal(el("simulate-body").hidden, true, "folded by default"); assert.equal(el("simulate-toggle").getAttribute("aria-expanded"), "false");
el("simulate-toggle").fire("click"); assert.equal(el("simulate-body").hidden, false); assert.equal(el("simulate-toggle").getAttribute("aria-expanded"), "true");
assert.equal(el("sim-chip").hidden, true, "no chip on the default scenario"); assert.equal(el("sim-reset").hidden, true, "nothing to reset");
assert.equal(el("sim-assumption").textContent, "School Friday: the count itself.");

dtBox.fire("click", { target: dtBtns[1] });
assert.equal(getState().daytype, "school_wkday"); assert.equal(dtBtns[1].getAttribute("aria-pressed"), "true"); assert.equal(dtBtns[0].getAttribute("aria-pressed"), "false");
assert.ok(el("sim-assumption").textContent.startsWith("School weekday: 0.95"), "the assumption line follows the day type");
assert.equal(el("sim-chip").hidden, false, "the chip reads on once the scenario leaves the default"); assert.equal(el("sim-reset").hidden, false);
// growthAdd is numeric, never the string the dataset carries (the data key is data-growth, the state key growthAdd)
gBox.fire("click", { target: gBtns[1] }); assert.equal(getState().growthAdd, 0.01);
gBox.fire("click", { target: gBtns[2] }); assert.equal(getState().growthAdd, 0.02);
bBox.fire("click", { target: bBtns[2] }); assert.equal(getState().band, "hi");
el("sim-year").value = "2031"; el("sim-year").fire("input");
assert.equal(getState().year, 2031); assert.equal(el("sim-year-label").textContent, "2031");
el("sim-year").value = "2099"; el("sim-year").fire("input"); assert.equal(getState().year, 2035, "clamped to 2035");
el("sim-year").value = "1999"; el("sim-year").fire("change"); assert.equal(getState().year, 2025, "clamped to 2025");
assert.equal(el("sim-year-fill").style.left, "0%", "the fill runs from 2025 to the chosen year");

// Closure switch arms closure mode; off clears the closed segment
assert.equal(closureArmed(), false);
el("closure-toggle").checked = true; el("closure-toggle").fire("change");
assert.equal(closureArmed(), true); assert.equal(el("closure-toggle").getAttribute("aria-checked"), "true");
setState({ closing: "52500-158" });
el("closure-toggle").checked = false; el("closure-toggle").fire("change");
assert.equal(closureArmed(), false); assert.equal(getState().closing, null, "switching off clears the closure");
syncSimulate({ ...getState(), closing: "52500-12" });
assert.equal(closureArmed(), true, "a restored closure (hash, scene) arms the switch"); assert.equal(el("closure-toggle").checked, true);
setClosureArmed(false); assert.equal(closureArmed(), false);

// Reset returns every simulate key to the default
resetScenario();
const s = getState();
for (const [k, v] of Object.entries(SIM_DEFAULT)) assert.equal(s[k], v, `reset: ${k}`);
assert.equal(s.simPlaying, false); assert.equal(closureArmed(), false);
assert.equal(dtBtns[0].getAttribute("aria-pressed"), "true"); assert.equal(bBtns[1].getAttribute("aria-pressed"), "true"); assert.equal(gBtns[0].getAttribute("aria-pressed"), "true");

// Play: one year per 900 ms, pauses at 2035, Pause stops, restart from 2035 goes back to 2025
scheduled.length = 0;
el("sim-play").fire("click");
assert.equal(getState().simPlaying, true); assert.equal(el("sim-play").textContent, "Pause"); assert.equal(el("sim-play").getAttribute("aria-pressed"), "true");
assert.equal(scheduled.length, 1); assert.equal(scheduled[0].ms, PLAY_STEP_MS); assert.equal(PLAY_STEP_MS, 900);
const step = () => { const t = scheduled.shift(); t.fn(); };
step(); assert.equal(getState().year, 2026, "one year per step");
step(); step(); assert.equal(getState().year, 2028);
el("sim-play").fire("click");   // pause
assert.equal(getState().simPlaying, false); assert.equal(el("sim-play").textContent, "Play"); assert.equal(cleared, 1, "the pending step is cleared");
assert.equal(getState().year, 2028, "paused where it was");
scheduled.length = 0;
el("sim-play").fire("click");   // resume from 2028
for (let i = 0; i < 20 && scheduled.length; i++) step();
assert.equal(getState().year, 2035, "pauses at 2035"); assert.equal(getState().simPlaying, false); assert.equal(scheduled.length, 0, "nothing scheduled past 2035");
el("sim-play").fire("click");
assert.equal(getState().year, 2025, "play at 2035 restarts from 2025"); assert.equal(getState().simPlaying, true);
stopYears(); assert.equal(getState().simPlaying, false);
// dragging the slider while playing stops the player
scheduled.length = 0; el("sim-play").fire("click"); el("sim-year").value = "2030"; el("sim-year").fire("input");
assert.equal(getState().simPlaying, false); assert.equal(getState().year, 2030);
// reduced motion jumps to the end
setState({ year: 2025 });
const stop = playYears({ reduced: true, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
assert.equal(getState().year, 2035); assert.equal(getState().simPlaying, false); assert.equal(typeof stop, "function");
// an external simPlaying false (a scene change) ends the loop on the next tick
scheduled.length = 0; setState({ year: 2025 }); playYears({ reduced: false, setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout });
setState({ simPlaying: false }); step(); assert.equal(getState().year, 2025, "no step after simPlaying was cleared"); assert.equal(scheduled.length, 0);

setSampleNotice(true); assert.equal(el("sim-sample").hidden, false); setSampleNotice(false); assert.equal(el("sim-sample").hidden, true);
console.log("simulate checks passed");

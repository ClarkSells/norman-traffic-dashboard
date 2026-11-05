// ## WHAT THIS FILE DOES
// The Simulate section of the panel (CONTRACTS.md C.14 and C.17): day type, projection year with a Play
// button, growth lever, growth band, the Close a segment switch, the assumption line, the sample notice and
// Reset. Controls write state.js; syncSimulate reflects state back on every render. The year player steps
// state.year on a timer. Imports data.js, state.js and ui/panel.js (rangeFill). Called from app.js
// (initSimulate, syncSimulate, closureArmed, playYears, stopYears, setSampleNotice) and the simulate tests.
// Simulate section of the panel (CONTRACTS C.14, C.17): day type, projection year with Play, growth lever,
// growth band, the "Close a segment" switch, the assumption line and Reset. Every control writes state.js;
// syncSimulate reflects state back (hash restores, scenes, reset). The year player steps one year per
// 900 ms on injectable timers; under reduced motion it jumps to the end instead of easing through the years.
import { DAYTYPE_LABEL, DAYTYPES, GROWTH_ADDS, SIM_DEFAULT, SIM_YEARS, isDefaultScenario } from "../data.js";
import { getState, setState } from "../state.js";
import { rangeFill } from "./panel.js";

export const PLAY_STEP_MS = 900;
const BANDS = ["lo", "base", "hi"];

const n = (v, d = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ## assumptionText: the sentence under the controls, from daytypes.json
// The one line under the controls: the active day type's factor and where it comes from, read from
// daytypes.json (C.16). Pure. Without the file it says so instead of inventing a factor.
export function assumptionText(daytype, daytypes) {
  const dt = DAYTYPES.includes(daytype) ? daytype : SIM_DEFAULT.daytype;
  const label = DAYTYPE_LABEL[dt];
  const f = daytypes && daytypes.factors ? daytypes.factors[dt] : null;
  if (!f) return `${label}: day type factors not loaded, volumes shown as the pipeline wrote them.`;
  const parts = [];
  if (f.factor != null) parts.push(f.factor === 1 ? "the count itself" : `${n(f.factor, 2)} of the school year Friday count`);
  if (f.formula) parts.push(f.formula);
  if (f.source && !(f.factor === 1 && f.source === "the count itself")) parts.push(f.source);
  if (dt === "gameday" && daytypes.gameday) {
    const g = daytypes.gameday;
    const bits = [];
    if (g.vehicles != null) bits.push(`${n(g.vehicles)} vehicles`);
    if (g.seats != null && g.occupancy != null) bits.push(`${n(g.seats)} seats at ${n(g.occupancy, 1)} per vehicle`);
    if (Array.isArray(g.origins) && g.origins.length) bits.push(`routed from ${g.origins.length} interchanges to the stadium`);
    if (bits.length) parts.push(bits.join(", "));
  }
  return `${label}: ${parts.join(", ")}.`;
}

// ## Segmented controls, same pattern as ui/panel.js
// Shared segmented behaviour, mirrored from ui/panel.js (one pressed button, data-<dataKey> carries the value
// that lands in state[stateKey]).
function wireSegmented(id, dataKey, stateKey, parse) {
  const box = document.getElementById(id);
  if (!box) return;
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const value = parse ? parse(btn.dataset[dataKey]) : btn.dataset[dataKey];
    syncSegmented(id, dataKey, value);
    setState({ [stateKey]: value });
  });
}
function syncSegmented(id, dataKey, value) {
  const box = document.getElementById(id);
  if (!box || typeof box.querySelectorAll !== "function") return;
  const want = value == null ? "" : String(value);
  box.querySelectorAll("button").forEach(b => {
    const on = (b.dataset[dataKey] == null ? "" : String(b.dataset[dataKey])) === want;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

const clampYear = (y) => Math.min(SIM_YEARS[1], Math.max(SIM_YEARS[0], Math.round(Number(y) || SIM_YEARS[0])));

// ## Module state: the armed switch, the running player, the loaded daytypes and injected timers
let armed = false;          // the "Close a segment" switch: the next map click closes a segment
let stopPlay = null;        // cancel for the running year player
let daytypesJson = null;
let timers = {};

// ## closureArmed and setClosureArmed
// The switch itself is not in state.js; only the resulting closing loc_id is. app.js asks closureArmed on
// every segment click to decide between closing the segment and opening the popup.
// True while the switch is on: app.js routes segment clicks to state.closing instead of the popup.
export function closureArmed() { return armed; }
export function setClosureArmed(on) {
  armed = !!on;
  const sw = document.getElementById("closure-toggle");
  if (sw) { sw.checked = armed; sw.setAttribute("aria-checked", String(armed)); }
  if (!armed && getState().closing) setState({ closing: null });
}

// ## playYears and stopYears: the year player
// Each tick writes state.year, which runs the whole render loop (map repaint, table, legend), so one tick per
// 900 ms is the pace the map can follow. The run out scene calls playYears after its camera arrives.
// Steps state.year one year per 900 ms up to 2035 and pauses there. Pressing play at 2035 restarts from 2025.
// Under reduced motion the year jumps straight to 2035. Returns stop(); stopping clears simPlaying.
export function playYears({ reduced, setTimeout: st, clearTimeout: ct } = {}) {
  stopYears();
  const _st = st || timers.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const _ct = ct || timers.clearTimeout || ((h) => clearTimeout(h));
  const isReduced = reduced != null ? !!reduced : !!getState().reducedMotion;
  const start = getState().year >= SIM_YEARS[1] ? SIM_YEARS[0] : getState().year;
  if (isReduced) { setState({ year: SIM_YEARS[1], simPlaying: false }); return () => {}; }
  let handle = null, stopped = false;
  setState({ year: start, simPlaying: true });
  const tick = () => {
    handle = null;
    if (stopped) return;
    const s = getState();
    if (!s.simPlaying) { stopped = true; stopPlay = null; return; }   // reset or a scene cleared it
    const next = clampYear(s.year + 1);
    if (next >= SIM_YEARS[1]) { stopped = true; stopPlay = null; setState({ year: SIM_YEARS[1], simPlaying: false }); return; }
    setState({ year: next });
    handle = _st(tick, PLAY_STEP_MS);
  };
  handle = _st(tick, PLAY_STEP_MS);
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (handle != null) _ct(handle);
    handle = null;
    stopPlay = null;
    if (getState().simPlaying) setState({ simPlaying: false });
  };
  stopPlay = stop;
  return stop;
}
export function stopYears() { if (stopPlay) { const s = stopPlay; stopPlay = null; s(); } }

// ## resetScenario
// Back to the default scenario: nothing projected, nothing closed, the switch off, the player stopped.
export function resetScenario() {
  stopYears();
  armed = false;
  setState({ ...SIM_DEFAULT, simPlaying: false });
}

// ## initSimulate: wire the controls once at startup
// opts: { daytypes: parsed daytypes.json or null, timers: { setTimeout, clearTimeout } for tests }
export function initSimulate(opts = {}) {
  daytypesJson = opts.daytypes || null;
  timers = opts.timers || {};
  wireSegmented("daytype-toggle", "daytype", "daytype", (v) => (DAYTYPES.includes(v) ? v : SIM_DEFAULT.daytype));
  wireSegmented("growth-toggle", "growth", "growthAdd", (v) => { const x = Number(v); return GROWTH_ADDS.includes(x) ? x : 0; });
  wireSegmented("band-toggle", "band", "band", (v) => (BANDS.includes(v) ? v : SIM_DEFAULT.band));

  const year = document.getElementById("sim-year");
  if (year) {
    year.min = String(SIM_YEARS[0]); year.max = String(SIM_YEARS[1]); year.step = "1";
    const onYear = () => { const y = clampYear(year.value); stopYears(); setState({ year: y }); };   // read before stop: stop re-syncs the input
    year.addEventListener("input", onYear); year.addEventListener("change", onYear);
  }
  const ticks = document.getElementById("sim-year-ticks");
  if (ticks) { let h = ""; for (let y = SIM_YEARS[0]; y <= SIM_YEARS[1]; y += 5) h += `<span>${y}</span>`; ticks.innerHTML = h; }
  const play = document.getElementById("sim-play");
  if (play) play.addEventListener("click", () => { if (getState().simPlaying) stopYears(); else playYears(); });

  const sw = document.getElementById("closure-toggle");
  if (sw) sw.addEventListener("change", (e) => setClosureArmed(!!(e.target ? e.target.checked : sw.checked)));
  const reset = document.getElementById("sim-reset");
  if (reset) reset.addEventListener("click", resetScenario);

  const toggle = document.getElementById("simulate-toggle"), body = document.getElementById("simulate-body");
  if (toggle && body) {
    const set = (open) => { body.hidden = !open; toggle.setAttribute("aria-expanded", String(open)); };
    set(!!opts.open);
    toggle.addEventListener("click", () => set(body.hidden));
  }
  syncSimulate(getState());
}

// ## setSampleNotice
// Marks the section when the scenario data is the stamped sample (data/SAMPLE_DATA.txt exists).
export function setSampleNotice(on) {
  const el = document.getElementById("sim-sample");
  if (el) el.hidden = !on;
}

// ## syncSimulate: state to the controls, on every render
// Reflects state into the controls. The closure switch reads on while a segment is closed, even after a hash restore.
export function syncSimulate(state) {
  syncSegmented("daytype-toggle", "daytype", state.daytype || SIM_DEFAULT.daytype);
  syncSegmented("growth-toggle", "growth", state.growthAdd || 0);
  syncSegmented("band-toggle", "band", state.band || SIM_DEFAULT.band);
  const y = state.year != null ? state.year : SIM_DEFAULT.year;
  const year = document.getElementById("sim-year");
  if (year) { year.value = String(y); year.setAttribute("aria-valuetext", String(y)); }
  const label = document.getElementById("sim-year-label");
  if (label) label.textContent = String(y);
  const fill = document.getElementById("sim-year-fill");
  if (fill && fill.style) { const f = rangeFill(SIM_YEARS[0], y, SIM_YEARS[0], SIM_YEARS[1]); fill.style.left = f.left; fill.style.right = f.right; }
  const play = document.getElementById("sim-play");
  if (play) { play.textContent = state.simPlaying ? "Pause" : "Play"; play.setAttribute("aria-pressed", String(!!state.simPlaying)); }
  if (state.closing) armed = true;
  const sw = document.getElementById("closure-toggle");
  if (sw) { sw.checked = armed; sw.setAttribute("aria-checked", String(armed)); }
  const line = document.getElementById("sim-assumption");
  if (line) line.textContent = assumptionText(state.daytype, daytypesJson);
  const chip = document.getElementById("sim-chip");
  if (chip) chip.hidden = isDefaultScenario(state);
  const reset = document.getElementById("sim-reset");
  if (reset) reset.hidden = isDefaultScenario(state);
}

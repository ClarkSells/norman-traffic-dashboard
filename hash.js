// ## WHAT THIS FILE DOES
// Deep links. The URL hash (the part after #) mirrors the dashboard state so a view can be copied and pasted:
// ward, metric, LOS, year window, collectors, selected segment, basemap, the Simulate keys, and tour=N for a
// present scene. stateToHash and hashToPatch are pure and unit tested; readHash and writeHash touch the
// browser. Imports nothing. Called from app.js (render writes it after every state change, main reads it at
// boot and on hashchange) and from the tests.
// URL hash <-> UI state. #ward=2&metric=combined&los=E&years=2021-2025&sel=52500-158&tour=10
// Simulate keys (C.14) are short and written only when they leave the default scenario:
// dt=school_wkday&yr=2031&grow=1&band=hi&close=52500-158
const METRICS = new Set(["combined", "v_c", "collisions"]);
const DAYTYPES = new Set(["school_fri", "school_wkday", "weekend", "summer_wkday", "gameday"]);
const BANDS = new Set(["lo", "base", "hi"]);
const GROWTH_ADDS = [0, 0.01, 0.02];
export const YEAR_RANGE = [2025, 2035];

// ## stateToHash: state to a "#key=value&key=value" string
// Default values are left out where possible so the common hash stays short; metric, los and years are always
// written so a pasted link is explicit about what it shows.
export function stateToHash(state, tourStep) {
  const q = [];
  if (state.ward != null) q.push(`ward=${state.ward}`);
  q.push(`metric=${state.metric}`);
  q.push(`los=${state.los}`);
  q.push(`years=${state.yearMin}-${state.yearMax}`);
  if (state.includeCollectors) q.push("collectors=1");
  if (state.selectedLocId) q.push(`sel=${encodeURIComponent(state.selectedLocId)}`);
  if (state.basemap === "satellite") q.push("basemap=satellite");
  if (state.daytype && state.daytype !== "school_fri") q.push(`dt=${state.daytype}`);
  if (state.year != null && state.year !== YEAR_RANGE[0]) q.push(`yr=${state.year}`);
  if (state.growthAdd) q.push(`grow=${Math.round(state.growthAdd * 100)}`);
  if (state.band && state.band !== "base") q.push(`band=${state.band}`);
  if (state.closing) q.push(`close=${encodeURIComponent(state.closing)}`);
  if (tourStep != null) q.push(`tour=${tourStep}`);
  return "#" + q.join("&");
}

// ## hashToPatch: parse a hash into a state patch, validating every value
// A hash is user input, so every value is checked against the allowed set (ward 1 to 8, known metrics, a
// four digit year pair, a loc id pattern) before it lands in the patch. Bad values are dropped silently.
// Returns {patch, tour} where patch holds only the valid keys found. Unknown or malformed values are ignored.
export function hashToPatch(hash) {
  const patch = {}; let tour = null;
  const s = (hash || "").replace(/^#/, "");
  if (!s) return { patch, tour };
  for (const part of s.split("&")) {
    const [k, v = ""] = part.split("=").map(decodeURIComponent);
    if (k === "ward") { if (v === "" || v === "all") patch.ward = null; else { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 8) patch.ward = n; } }
    else if (k === "metric" && METRICS.has(v)) patch.metric = v;
    else if (k === "los" && (v === "E" || v === "C")) patch.los = v;
    else if (k === "years") { const m = v.match(/^(\d{4})-(\d{4})$/); if (m) { let a = Number(m[1]), b = Number(m[2]); if (a > b) [a, b] = [b, a]; patch.yearMin = a; patch.yearMax = b; } }
    else if (k === "collectors") patch.includeCollectors = v === "1" || v === "true";
    else if (k === "sel") { if (/^[\w-]+$/.test(v)) patch.selectedLocId = v; }
    else if (k === "basemap" && (v === "light" || v === "satellite")) patch.basemap = v;
    else if (k === "dt" && DAYTYPES.has(v)) patch.daytype = v;
    else if (k === "yr") { const n = Number(v); if (Number.isInteger(n) && n >= YEAR_RANGE[0] && n <= YEAR_RANGE[1]) patch.year = n; }
    else if (k === "grow") { const n = Number(v) / 100; if (GROWTH_ADDS.includes(n)) patch.growthAdd = n; }
    else if (k === "band" && BANDS.has(v)) patch.band = v;
    else if (k === "close") { if (/^[\w-]+$/.test(v)) patch.closing = v; }
    else if (k === "tour") { const n = Number(v); if (Number.isInteger(n) && n >= 0) tour = n; }
  }
  return { patch, tour };
}

// ## readHash and writeHash: the browser side
export function readHash() { return typeof location !== "undefined" ? hashToPatch(location.hash) : { patch: {}, tour: null }; }

// replaceState keeps the history clean while the controls change; the hash is still copyable at any moment.
export function writeHash(state, tourStep) {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  const h = stateToHash(state, tourStep);
  if (location.hash !== h) history.replaceState(null, "", h);
}

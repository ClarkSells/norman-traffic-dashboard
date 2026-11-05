import { DATA } from "./config.js";

const ARTERIAL = new Set(["Principal Arterial", "Minor Arterial"]);
let raw = { segments: null, collisions: null, wards: null, points: null, summary: null, closures: null, daytypes: null, horizon: null };

// Simulate files (C.15, C.16). config.js DATA holds the five base files; these three are optional: a missing one
// leaves its slot null and the Simulate controls degrade without breaking the base dashboard.
export const SIM_DATA = { closures: "data/closure_impacts.json", daytypes: "data/daytypes.json", horizon: "data/horizon.json" };
export const SIM_DEFAULT = { daytype: "school_fri", year: 2025, growthAdd: 0, band: "base", closing: null };
export const SIM_YEARS = [2025, 2035];
export const GROWTH_ADDS = [0, 0.01, 0.02];
export const DAYTYPES = ["school_fri", "school_wkday", "weekend", "summer_wkday", "gameday"];
export const DAYTYPE_LABEL = { school_fri: "School Friday", school_wkday: "School weekday", weekend: "Weekend", summer_wkday: "Summer weekday", gameday: "OU game day" };
export const DAYTYPE_WORD = { school_fri: "school Friday", school_wkday: "school weekday", weekend: "weekend", summer_wkday: "summer weekday", gameday: "OU game day" };
export const BAND_LABEL = { lo: "Low", base: "Base", hi: "High" };
export const BAND_WORD = { lo: "low band", base: "base band", hi: "high band" };

// Reads a response body counting bytes. onBytes(loaded, total) is called as chunks arrive; total is null when the
// server sent no Content-Length. Falls back to res.text() when streaming is not available.
export async function readWithProgress(res, onBytes) {
  const total = Number(res.headers && res.headers.get && res.headers.get("Content-Length")) || null;
  if (!res.body || typeof res.body.getReader !== "function") { const t = await res.text(); if (onBytes) onBytes(t.length, total); return t; }
  const reader = res.body.getReader(); const chunks = []; let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.byteLength;
    if (onBytes) onBytes(loaded, total);
  }
  const all = new Uint8Array(loaded); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder().decode(all);
}

// Combined progress across files: {loaded, total, ratio} where total and ratio are null when any file lacks a length.
export function combineProgress(perFile) {
  let loaded = 0, total = 0, known = true;
  for (const f of Object.values(perFile)) { loaded += f.loaded || 0; if (f.total == null) known = false; else total += f.total; }
  return { loaded, total: known ? total : null, ratio: known && total > 0 ? Math.min(1, loaded / total) : null };
}

// Fetches the five data files in parallel. onProgress({loaded, total, ratio}) fires as bytes arrive.
export async function loadAll(onProgress) {
  const perFile = {};
  const report = () => { if (onProgress) onProgress(combineProgress(perFile)); };
  const entries = await Promise.all(Object.entries(DATA).map(async ([k, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
    perFile[k] = { loaded: 0, total: null };
    const text = await readWithProgress(res, (loaded, total) => { perFile[k] = { loaded, total }; report(); });
    return [k, JSON.parse(text)];
  }));
  const sim = await Promise.all(Object.entries(SIM_DATA).map(async ([k, url]) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return [k, null];
      return [k, JSON.parse(await res.text())];
    } catch { return [k, null]; }
  }));
  raw = { ...Object.fromEntries(entries), ...Object.fromEntries(sim) };
  return raw;
}

export function getRaw() { return raw; }

// Test seam: lets node tests inject already-parsed data without fetch().
export function setRaw(obj) { raw = obj; }

export function years() { return raw.summary && raw.summary.years ? raw.summary.years : [2021, 2022, 2023, 2024, 2025]; }

// Every year that appears in any segment's collisions_by_year, so the year slider can widen past the default window.
export function yearExtent() {
  const ys = new Set(years());
  for (const f of (raw.segments && raw.segments.features) || []) {
    const by = typeof f.properties.collisions_by_year === "string" ? JSON.parse(f.properties.collisions_by_year) : (f.properties.collisions_by_year || {});
    for (const y of Object.keys(by)) ys.add(Number(y));
  }
  const arr = [...ys].sort((a, b) => a - b);
  return { min: arr[0], max: arr[arr.length - 1] };
}

// ---- Simulate (CONTRACTS C.14): scenario math, pure ---------------------------------------------------------

// The default scenario (school Friday count, 2025, no growth lever, base band, nothing closed) leaves every
// number exactly as the base dashboard computes it. A state without the simulate keys counts as default.
export function isDefaultScenario(state) {
  return (state.daytype == null || state.daytype === SIM_DEFAULT.daytype)
    && (state.year == null || state.year === SIM_DEFAULT.year)
    && !state.growthAdd
    && (state.band == null || state.band === SIM_DEFAULT.band)
    && !state.closing;
}

// g = growth_<band> + growthAdd. An unknown band rate falls back to the base rate, then to 0 (the count is carried
// flat and only the lever applies), so a segment without a fitted growth still projects.
export function growthRate(p, state) {
  const band = state.band || SIM_DEFAULT.band;
  let g = p[`growth_${band}`];
  if (g == null) g = p.growth_base;
  if (g == null) g = 0;
  return g + (state.growthAdd || 0);
}

// vpd_eff = dt_<daytype>_vpd * (1 + g) ** (year - volume_year). The count is projected forward from the year it
// was taken, which can be well before 2025; that is intended. Null when the day type volume is unknown.
export function effectiveVpd(p, state) {
  const dt = state.daytype || SIM_DEFAULT.daytype;
  let base = p[`dt_${dt}_vpd`];
  if (base == null && dt === "school_fri") base = p.vpd_max;   // the school Friday volume is the count itself
  if (base == null) return null;
  const year = state.year != null ? state.year : SIM_DEFAULT.year;
  const from = p.volume_year != null ? p.volume_year : year;
  return base * (1 + growthRate(p, state)) ** (year - from);
}

// Volume a detour segment receives from the closed segment, from closure_impacts.json (0 when none or unknown).
export function closureAdded(locId, closing, impacts) {
  if (!closing || !impacts || !impacts[closing] || !impacts[closing].added_vpd) return 0;
  const v = impacts[closing].added_vpd[locId];
  return v == null ? 0 : v;
}

// vc_eff = (vpd_eff + added_vpd[closing][loc]) / capacity_<los>; the closed segment itself reads 0.
export function effectiveVc(p, state, closureImpacts) {
  const cap = state.los === "C" ? p.capacity_C : p.capacity_E;
  if (!cap) return null;
  if (state.closing && p.loc_id === state.closing) return 0;
  const vpd = effectiveVpd(p, state);
  if (vpd == null) return null;
  return (vpd + closureAdded(p.loc_id, state.closing, closureImpacts)) / cap;
}

let segIndex = { fc: null, map: new Map() };
export function segmentProps(locId) {
  const fc = raw.segments;
  if (!fc) return null;
  if (segIndex.fc !== fc) segIndex = { fc, map: new Map((fc.features || []).map(f => [f.properties.loc_id, f.properties])) };
  return segIndex.map.get(locId) || null;
}

// "2031, base band, school weekday" plus ", plus 1 percent per year" and ", W Main St closed" when they apply.
// Empty for the default scenario. Built from state only, so every label on screen agrees.
export function scenarioText(state) {
  if (isDefaultScenario(state)) return "";
  const parts = [String(state.year != null ? state.year : SIM_DEFAULT.year), BAND_WORD[state.band] || BAND_WORD.base];
  if (state.growthAdd) parts.push(`plus ${Math.round(state.growthAdd * 100)} percent per year`);
  parts.push(DAYTYPE_WORD[state.daytype] || DAYTYPE_WORD.school_fri);
  if (state.closing) { const c = segmentProps(state.closing); parts.push(`${c ? c.on_road : state.closing} closed`); }
  return parts.join(", ");
}

// The v/c column and legend word: "v/c" today, "projected v/c, 2031, base band, school weekday" under a scenario.
export function vcLabel(state) {
  const t = scenarioText(state);
  return t ? `projected v/c, ${t}` : "v/c";
}

// Everything the closure UI says about the closed segment: the detour rows sorted by the v/c increase, the top
// one, and the pipeline's flags. Null when nothing is closed or the segment is unknown.
export function closureImpact(state) {
  if (!state.closing) return null;
  const closed = segmentProps(state.closing);
  if (!closed) return null;
  const impact = raw.closures && raw.closures[state.closing] ? raw.closures[state.closing] : null;
  const detours = [];
  if (impact && !impact.no_path) {
    for (const id of impact.detour_loc_ids || []) {
      const p = segmentProps(id);
      if (!p) continue;
      // "before" is the same projection without the closure, so the delta is the closure alone.
      const before = effectiveVc(p, { ...state, closing: null }, raw.closures);
      const after = effectiveVc(p, state, raw.closures);
      detours.push({ loc_id: id, on_road: p.on_road, from_road: p.from_road, to_road: p.to_road, added: closureAdded(id, state.closing, raw.closures), before, after,
                     delta: before != null && after != null ? after - before : null });
    }
    detours.sort((a, b) => (b.delta || 0) - (a.delta || 0));
  }
  return { closing: state.closing, closed, impact, detours, top: detours[0] || null,
           missing: !impact, no_path: !impact || !!impact.no_path, flagged: !!(impact && impact.flagged),
           detour_len_mi: impact ? impact.detour_len_mi : null, ratio: impact ? impact.ratio : null };
}

// The briefing sentence for game day, from daytypes.json alone (C.16). Fields the file lacks are left out.
export function gamedayText(daytypes) {
  const g = daytypes && daytypes.gameday;
  const n = (v, d = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  if (!g) return "OU game day: no game day routing data loaded";
  const parts = [];
  if (g.vehicles != null) parts.push(`${n(g.vehicles)} vehicles${g.seats != null && g.occupancy != null ? ` (${n(g.seats)} seats at ${n(g.occupancy, 1)} per vehicle)` : ""}, counted arriving and leaving`);
  const origins = Array.isArray(g.origins) ? g.origins.length : 0;
  if (origins) parts.push(`routed from ${origins} interchanges to the stadium by shortest travel time`);
  if (Array.isArray(g.closures) && g.closures.length) parts.push(`${g.closures.length} segment${g.closures.length === 1 ? "" : "s"} closed around the stadium`);
  return `OU game day: ${parts.length ? parts.join(", ") : "assumption"}`;
}

// How many listed segments sit at or above a v/c threshold under the state (the scene stat and the briefing).
export function countOver(state, threshold) {
  return rankedRows(state).filter(r => r.v_c_active != null && r.v_c_active >= threshold).length;
}

// Recompute the state-dependent numbers for one segment feature. Pure function, no Mapbox involved.
// Under a scenario (C.14) the projected v/c replaces v_c in the paint and the table; the default scenario
// reproduces the base dashboard exactly.
export function deriveProps(p, state) {
  const cap = state.los === "C" ? p.capacity_C : p.capacity_E;
  const v_c_today = cap ? p.vpd_max / cap : null;
  const def = isDefaultScenario(state);
  const v_c = def ? v_c_today : effectiveVc(p, state, raw.closures);
  const vpd_eff = def ? p.vpd_max : effectiveVpd(p, state);
  const closure_added = def ? 0 : closureAdded(p.loc_id, state.closing, raw.closures);
  const closedProps = closure_added > 0 ? segmentProps(state.closing) : null;
  const is_closed = state.closing && p.loc_id === state.closing ? 1 : 0;
  const byYear = typeof p.collisions_by_year === "string" ? JSON.parse(p.collisions_by_year) : (p.collisions_by_year || {});
  let collisions = 0;
  for (const [y, n] of Object.entries(byYear)) {
    const yy = Number(y);
    if (yy >= state.yearMin && yy <= state.yearMax) collisions += n;
  }
  const combined = v_c == null ? null : collisions + v_c;
  const wards = Array.isArray(p.wards) ? p.wards : JSON.parse(p.wards || "[]");
  const inWard = state.ward == null || wards.includes(state.ward);
  const isPrimary = state.includeCollectors || ARTERIAL.has(p.functional_class);
  const metricValue = state.metric === "v_c" ? v_c : state.metric === "collisions" ? collisions : combined;
  const out = { v_c_active: v_c, collisions_active: collisions, combined_active: combined, metric_value: metricValue,
                capacity_active: cap, in_ward: inWard ? 1 : 0, is_primary: isPrimary ? 1 : 0, wards_list: wards,
                v_c_today, vpd_eff, closure_added, is_closed, projected: def ? 0 : 1 };
  if (closedProps) { out.closure_from = closedProps.on_road; out.v_c_before_closure = cap && vpd_eff != null ? vpd_eff / cap : null; }
  return out;
}

// A fresh GeoJSON with derived properties merged in, ready for map.getSource("segments").setData(...)
export function applyState(state) {
  const feats = raw.segments.features.map(f => ({ ...f, properties: { ...f.properties, ...deriveProps(f.properties, state) } }));
  return { type: "FeatureCollection", features: feats };
}

// Rows for the side table: segments in the selected ward (or all), primary only unless collectors are on, ranked by the active metric.
export function rankedRows(state) {
  const rows = applyState(state).features
    .map(f => ({ ...f.properties, geometry: f.geometry }))
    .filter(r => r.in_ward === 1 && r.is_primary === 1 && r.metric_value != null)
    .sort((a, b) => (b.metric_value - a.metric_value) || (b.v_c_active - a.v_c_active) || (b.vpd_max - a.vpd_max));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

// Rank of one segment inside its ward list and inside the citywide list, under the current state.
// Ward rank uses the segment's primary ward unless the state has a ward selected that contains it.
export function rankWithin(state, locId) {
  const f = (raw.segments.features || []).find(x => x.properties.loc_id === locId);
  if (!f) return null;
  const wards = Array.isArray(f.properties.wards) ? f.properties.wards : JSON.parse(f.properties.wards || "[]");
  const ward = state.ward != null && wards.includes(state.ward) ? state.ward : (f.properties.ward_primary != null ? f.properties.ward_primary : wards[0]);
  const inWard = rankedRows({ ...state, ward });
  const city = rankedRows({ ...state, ward: null });
  const w = inWard.find(r => r.loc_id === locId), c = city.find(r => r.loc_id === locId);
  return { ward, wardRank: w ? w.rank : null, wardOf: inWard.length, cityRank: c ? c.rank : null, cityOf: city.length, listed: !!c };
}

// Headline numbers for the stat tiles and the briefing sentence.
export function summarize(state) {
  const rows = rankedRows(state);
  const crashes = rows.reduce((a, r) => a + r.collisions_active, 0);
  const maxScore = rows.reduce((a, r) => Math.max(a, r.metric_value || 0), 0);
  return { rows, n: rows.length, crashes, top: rows[0] || null, maxScore };
}

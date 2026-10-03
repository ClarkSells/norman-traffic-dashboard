import { DATA } from "./config.js";

const ARTERIAL = new Set(["Principal Arterial", "Minor Arterial"]);
let raw = { segments: null, collisions: null, wards: null, points: null, summary: null };

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
  raw = Object.fromEntries(entries);
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

// Recompute the state-dependent numbers for one segment feature. Pure function, no Mapbox involved.
export function deriveProps(p, state) {
  const cap = state.los === "C" ? p.capacity_C : p.capacity_E;
  const v_c = cap ? p.vpd_max / cap : null;
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
  return { v_c_active: v_c, collisions_active: collisions, combined_active: combined, metric_value: metricValue,
           capacity_active: cap, in_ward: inWard ? 1 : 0, is_primary: isPrimary ? 1 : 0, wards_list: wards };
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

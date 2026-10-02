import { DATA } from "./config.js";

const ARTERIAL = new Set(["Principal Arterial", "Minor Arterial"]);
let raw = { segments: null, collisions: null, wards: null, points: null, summary: null };

export async function loadAll() {
  const entries = await Promise.all(Object.entries(DATA).map(async ([k, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`failed to load ${url}: ${res.status}`);
    return [k, await res.json()];
  }));
  raw = Object.fromEntries(entries);
  return raw;
}

export function getRaw() { return raw; }

// Test seam: lets node tests inject already-parsed data without fetch().
export function setRaw(obj) { raw = obj; }

export function years() { return raw.summary && raw.summary.years ? raw.summary.years : [2021, 2022, 2023, 2024, 2025]; }

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

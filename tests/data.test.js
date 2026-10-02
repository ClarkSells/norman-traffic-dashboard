// Run from the repo root: node dashboard/tests/data.test.js
// Uses an inline mini dataset so it works before the pipeline has produced dashboard/data/*.
// If the real files exist it checks them too.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { applyState, deriveProps, rankedRows, setRaw, years } from "../data.js";

const here = dirname(fileURLToPath(import.meta.url));
const seg = (loc, wards, cls, vpd, capC, capE, byYear) => ({
  type: "Feature", geometry: { type: "LineString", coordinates: [[-97.44, 35.22], [-97.43, 35.22]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, shared_boundary: wards.length > 1, functional_class: cls,
                vpd_max: vpd, capacity_C: capC, capacity_E: capE, collisions_by_year: byYear } });
const mini = {
  segments: { type: "FeatureCollection", features: [
    seg("A", [1], "Principal Arterial", 12200, 22000, 34200, { 2022: 1, 2023: 2, 2016: 5 }),
    seg("B", [2], "Minor Arterial", 5800, 10000, 17100, { 2023: 1 }),
    seg("C", [1, 2], "Minor Arterial", 2900, 10000, 17100, {}),
    seg("D", [1], "Collector", 5745, 10000, 17100, { 2024: 4 }),
  ] },
  wards: { type: "FeatureCollection", features: [] }, collisions: null, points: null, summary: { years: [2021, 2022, 2023, 2024, 2025] },
};
setRaw(mini);
const base = { ward: null, metric: "combined", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: false, selectedLocId: null };

const a = deriveProps(mini.segments.features[0].properties, base);
assert.equal(a.collisions_active, 3, "window sums 2022 and 2023 and ignores 2016");
assert.ok(Math.abs(a.v_c_active - 12200 / 34200) < 1e-12, "LOS E");
assert.ok(Math.abs(deriveProps(mini.segments.features[0].properties, { ...base, los: "C" }).v_c_active - 12200 / 22000) < 1e-12, "LOS C");
assert.equal(deriveProps(mini.segments.features[0].properties, { ...base, yearMin: 2016, yearMax: 2016 }).collisions_active, 5, "single year window");
assert.equal(a.in_ward, 1); assert.equal(deriveProps(mini.segments.features[0].properties, { ...base, ward: 2 }).in_ward, 0);
assert.equal(deriveProps(mini.segments.features[3].properties, base).is_primary, 0, "collectors excluded by default");
assert.deepEqual(years(), [2021, 2022, 2023, 2024, 2025]);

const rows = rankedRows(base);
assert.deepEqual(rows.map(r => r.loc_id), ["A", "B", "C"], "ranked by combined, collectors out");
assert.deepEqual(rows.map(r => r.rank), [1, 2, 3]);
assert.deepEqual(rankedRows({ ...base, ward: 2 }).map(r => r.loc_id), ["B", "C"], "ward 2 keeps B and the shared C");
assert.deepEqual(rankedRows({ ...base, includeCollectors: true }).map(r => r.loc_id), ["D", "A", "B", "C"], "collector D has 4 crashes");
assert.deepEqual(rankedRows({ ...base, metric: "v_c" }).map(r => r.loc_id), ["A", "B", "C"]);
assert.equal(applyState(base).features.length, 4, "applyState keeps every feature");
assert.equal(applyState(base).features[0].properties.metric_value, a.combined_active);
console.log("data.js mini checks passed");

const real = join(here, "..", "data", "segments.geojson");
if (existsSync(real)) {
  const load = (f) => JSON.parse(readFileSync(join(here, "..", "data", f), "utf8"));
  setRaw({ segments: load("segments.geojson"), wards: load("wards.geojson"), summary: load("summary.json"), collisions: null, points: null });
  const p0 = load("segments.geojson").features[0].properties;
  const d0 = deriveProps(p0, base);
  assert.equal(d0.collisions_active, p0.collisions, "real data: 5 year window reproduces the pipeline count");
  assert.ok(Math.abs(d0.v_c_active - p0.v_c_E) < 1e-9, "real data: LOS E v/c matches");
  const all = rankedRows(base);
  assert.ok(all.length > 100 && all.every((r, i) => i === 0 || r.metric_value <= all[i - 1].metric_value));
  console.log(`data.js real-data checks passed: ${all.length} primary rows, top = ${all[0].on_road} ${all[0].from_road} to ${all[0].to_road} (${all[0].combined_active.toFixed(1)})`);
} else {
  console.log("real data not present yet (run python run.py), skipped real-data checks");
}

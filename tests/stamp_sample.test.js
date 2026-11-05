// Run from the repo root: node tests/stamp_sample.test.js
// scripts/stamp_sample.mjs writes SAMPLE Simulate data shaped like CONTRACTS.md C.13 to C.16. The
// values are made up; the test pins the shape, determinism and the contract invariants the app relies on.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { BANNER, DAYTYPE_FACTORS, projectVpd, stampAll, stampSegment, upgradeTier, yearCrossing } from "../scripts/stamp_sample.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const seg = (loc, vpd, vy, lanes, divided, oneWay, coords) => ({ type: "Feature", geometry: { type: "LineString", coordinates: coords },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards: [1], functional_class: "Minor Arterial", vpd_max: vpd, volume_year: vy,
                capacity_C: 22000, capacity_E: 34200, lanes_final: lanes, divided, one_way: oneWay, length_mi: 0.5 } });
const fc = { type: "FeatureCollection", features: [
  seg("A", 20000, 2018, 4, false, false, [[-97.45, 35.21], [-97.44, 35.21]]),
  seg("B", 9000, 2024, 2, false, false, [[-97.44, 35.21], [-97.43, 35.21]]),
  seg("C", 31000, 2023, 6, true, false, [[-97.46, 35.22], [-97.45, 35.22]]),
  seg("D", 5000, 2010, 3, false, true, [[-97.50, 35.30], [-97.49, 35.30]]),
] };

// pure helpers
assert.ok(Math.abs(projectVpd(1000, 2020, 0.1, 2022) - 1210) < 1e-9, "compound growth from the count year");
assert.equal(yearCrossing(30000, 2025, 0.02, 34200, 0.9), 2027, "first year the projection reaches the threshold");
assert.equal(yearCrossing(30000, 2025, 0.02, 34200, 0.7), 2025, "already over: the current year");
assert.equal(yearCrossing(1000, 2025, 0.0, 34200, 0.9), null, "never by 2050: null");
assert.deepEqual(upgradeTier(2, false, false), { tier: "5 lane center turn", lanes: 5, divided: false });
assert.deepEqual(upgradeTier(4, false, false), { tier: "4 lane divided", lanes: 4, divided: true });
assert.deepEqual(upgradeTier(4, true, false), { tier: "6 lane divided", lanes: 6, divided: true });
assert.deepEqual(upgradeTier(6, true, false), { tier: "at top tier", lanes: 6, divided: true });
assert.deepEqual(upgradeTier(3, false, true), { tier: "add one lane (one way)", lanes: 4, divided: false });

// one segment: every C.13 property present, deterministic, inside the stated ranges
const a1 = stampSegment({ ...fc.features[0].properties, __coords: fc.features[0].geometry.coordinates });
const a2 = stampSegment({ ...fc.features[0].properties, __coords: fc.features[0].geometry.coordinates });
assert.deepEqual(a1, a2, "seeded from loc_id: the same input stamps the same values");
const KEYS = ["growth_base", "growth_lo", "growth_hi", "growth_method", "growth_n_obs", "growth_shrink_w", "vpd_2025_base", "vpd_2030_base", "vpd_2035_base", "vpd_2035_lo", "vpd_2035_hi",
  "vc_2035_base", "vc_2035_lo", "vc_2035_hi", "year_vc_07_base", "year_vc_09_base", "year_vc_09_lo", "year_vc_09_hi", "upgrade_tier", "upgrade_lanes", "upgrade_divided", "capacity_after", "vc_after_upgrade", "headroom_yrs",
  "dt_school_fri_vpd", "dt_school_wkday_vpd", "dt_weekend_vpd", "dt_summer_wkday_vpd", "dt_gameday_vpd", "dt_school_fri_vc", "dt_school_wkday_vc", "dt_weekend_vc", "dt_summer_wkday_vc", "dt_gameday_vc", "dt_gameday_added", "campus_w",
  "speed_measured", "speed_diff", "speed_flag", "capacity", "v_c"];
for (const k of KEYS) assert.ok(k in a1, `stamped segment carries ${k}`);
assert.ok(a1.growth_base >= -0.03 && a1.growth_base <= 0.06, "growth inside the clip");
assert.ok(a1.growth_lo < a1.growth_base && a1.growth_base < a1.growth_hi, "lo < base < hi");
assert.ok(["loglin", "pairwise", "ward_median"].includes(a1.growth_method));
assert.equal(a1.dt_school_fri_vpd, 20000, "school Friday volume is the count itself");
assert.ok(Math.abs(a1.dt_school_wkday_vpd - 20000 * DAYTYPE_FACTORS.school_wkday.factor) < 0.1, "weekday factor from the table");
assert.ok(Math.abs(a1.dt_weekend_vpd - 20000 * DAYTYPE_FACTORS.weekend.factor) < 0.1, "weekend factor from the table");
assert.ok(a1.campus_w >= 0 && a1.campus_w <= 1);
assert.ok(Math.abs(a1.vpd_2035_base - projectVpd(20000, 2018, a1.growth_base, 2035)) < 0.1, "2035 volume projected from the count year");
assert.equal(a1.capacity, 34200, "capacity mirrors capacity_E when the file lacks it");
assert.deepEqual(upgradeTier(4, false, false).tier, a1.upgrade_tier);
assert.ok(a1.capacity_after > 0 && a1.vc_after_upgrade > 0 && a1.headroom_yrs >= 0 && a1.headroom_yrs <= 25);
const c1 = stampSegment({ ...fc.features[2].properties, __coords: fc.features[2].geometry.coordinates });
assert.equal(c1.upgrade_tier, "at top tier"); assert.equal(c1.capacity_after, null); assert.equal(c1.vc_after_upgrade, null); assert.equal(c1.headroom_yrs, null);

// the whole bundle
const all = stampAll(fc);
assert.equal(all.segments.features.length, 4, "every feature kept");
assert.equal(all.segments.features[0].properties.on_road, "Main", "existing properties untouched");
assert.deepEqual(Object.keys(all.closures).sort(), ["A", "B", "C", "D"], "one closure entry per segment");
for (const [id, c] of Object.entries(all.closures)) {
  for (const k of ["detour_loc_ids", "added_vpd", "vc_after", "path", "detour_len_mi", "ratio", "flagged", "no_path"]) assert.ok(k in c, `${id}: closure carries ${k}`);
  assert.ok(!c.detour_loc_ids.includes(id), "a segment never detours onto itself");
  if (!c.no_path) {
    assert.ok(c.detour_loc_ids.length >= 1 && c.detour_loc_ids.length <= 3, "one to three detour segments");
    assert.ok(c.path.length >= 3, "path runs from one end node to the other through the detour");
    for (const d of c.detour_loc_ids) assert.ok(c.added_vpd[d] > 0 && c.vc_after[d] > 0, "added volume and v/c after for every detour segment");
  } else assert.deepEqual(c.detour_loc_ids, []);
}
assert.deepEqual(Object.keys(all.daytypes.factors), ["school_fri", "school_wkday", "weekend", "summer_wkday", "gameday"]);
for (const f of Object.values(all.daytypes.factors)) assert.ok(typeof f.source === "string" && f.source.length, "every factor carries a source");
assert.equal(all.daytypes.gameday.vehicles, 30800);
assert.equal(all.daytypes.gameday.routes.length, all.daytypes.gameday.origins.length, "one route per origin");
assert.ok(Math.abs(all.daytypes.gameday.origins.reduce((a, o) => a + o.share, 0) - 0.95) < 1e-9, "routed shares sum to 0.95, local traffic is the rest");
assert.deepEqual(all.horizon.params, { k: 2, clip: [-0.03, 0.06], years: [2025, 2030, 2035], thresholds: [0.7, 0.9] });
assert.equal(all.horizon.growth_sensitivity.length, 4);
assert.ok("year_vc_09_m0" in all.horizon.growth_sensitivity[0] && "year_vc_09_m2" in all.horizon.growth_sensitivity[0]);

// the CLI: writes the four files plus the sample marker and says so on stdout
const dir = mkdtempSync(join(tmpdir(), "stamp-"));
writeFileSync(join(dir, "segments.geojson"), JSON.stringify(fc));
const r = spawnSync(process.execPath, [join(here, "..", "scripts", "stamp_sample.mjs"), dir], { encoding: "utf8" });
assert.equal(r.status, 0, r.stderr);
assert.ok(r.stdout.includes(BANNER) && BANNER === "SAMPLE DATA, not pipeline output", "the banner is printed");
assert.ok(readFileSync(join(dir, "SAMPLE_DATA.txt"), "utf8").startsWith(BANNER), "the marker file says the same");
const written = JSON.parse(readFileSync(join(dir, "segments.geojson"), "utf8"));
assert.equal(written.features[1].properties.growth_method, all.segments.features[1].properties.growth_method);
assert.ok(JSON.parse(readFileSync(join(dir, "closure_impacts.json"), "utf8")).A, "closure_impacts.json written");
assert.ok(JSON.parse(readFileSync(join(dir, "daytypes.json"), "utf8")).factors, "daytypes.json written");
assert.ok(JSON.parse(readFileSync(join(dir, "horizon.json"), "utf8")).params, "horizon.json written");
const r2 = spawnSync(process.execPath, [join(here, "..", "scripts", "stamp_sample.mjs"), dir], { encoding: "utf8" });
assert.equal(readFileSync(join(dir, "segments.geojson"), "utf8"), JSON.stringify(written) + "\n", "a second run over stamped data is byte identical");
assert.equal(r2.status, 0);
console.log("stamp_sample checks passed");

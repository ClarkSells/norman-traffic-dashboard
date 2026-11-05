// Run from the repo root: node tests/scenario.test.js
// Simulate scenario math (CONTRACTS C.14) in data.js: pure functions over the C.13 segment properties and the
// closure_impacts.json shape. The default scenario must reproduce the base dashboard to the bit.
import assert from "node:assert/strict";
import { applyState, closureAdded, closureImpact, countOver, deriveProps, effectiveVc, effectiveVpd, growthRate, isDefaultScenario, rankedRows, scenarioText, segmentProps, setRaw, SIM_DEFAULT, vcLabel } from "../data.js";

const seg = (loc, road, vpd, vy, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.44, 35.22], [-97.43, 35.22]] },
  properties: { loc_id: loc, on_road: road, from_road: "x", to_road: "y", wards: [1], shared_boundary: false, functional_class: "Minor Arterial",
                vpd_max: vpd, volume_year: vy, capacity_C: 22000, capacity_E: 34200, collisions_by_year: { 2023: 2 },
                growth_base: 0.02, growth_lo: 0.01, growth_hi: 0.03, dt_school_fri_vpd: vpd, dt_school_wkday_vpd: vpd * 0.95, dt_weekend_vpd: vpd * 0.76, dt_summer_wkday_vpd: vpd * 0.9, dt_gameday_vpd: vpd * 0.855 + 1000, ...extra } });
const A = seg("A", "W Main St", 20000, 2023), B = seg("B", "12th Ave SE", 10000, 2020), C = seg("C", "Flood Ave", 5000, 2025, { growth_base: null, growth_lo: null, growth_hi: null });
const closures = {
  A: { detour_loc_ids: ["B"], added_vpd: { B: 20000 }, vc_after: { B: 0.88 }, path: [[-97.44, 35.22], [-97.435, 35.225], [-97.43, 35.22]], detour_len_mi: 1.2, ratio: 1.8, flagged: false, no_path: false },
  B: { detour_loc_ids: [], added_vpd: {}, vc_after: {}, path: [], detour_len_mi: null, ratio: null, flagged: false, no_path: true },
  C: { detour_loc_ids: ["A", "B"], added_vpd: { A: 6000, B: 5000 }, vc_after: { A: 0.73, B: 0.44 }, path: [[-97.44, 35.22], [-97.43, 35.22]], detour_len_mi: 3.2, ratio: 3.5, flagged: true, no_path: false },
};
setRaw({ segments: { type: "FeatureCollection", features: [A, B, C] }, wards: { features: [] }, summary: { years: [2021, 2022, 2023, 2024, 2025] }, collisions: null, points: null, closures, daytypes: null, horizon: null });
const base = { ward: null, metric: "v_c", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: false, selectedLocId: null, ...SIM_DEFAULT };
const close = (v) => Math.abs(v) < 1e-9;

// isDefaultScenario
assert.equal(isDefaultScenario(base), true);
assert.equal(isDefaultScenario({ ward: null, metric: "combined", los: "E" }), true, "a state without the simulate keys is the default scenario");
for (const patch of [{ daytype: "weekend" }, { year: 2026 }, { growthAdd: 0.01 }, { band: "hi" }, { closing: "A" }]) assert.equal(isDefaultScenario({ ...base, ...patch }), false, `${JSON.stringify(patch)} leaves the default`);

// growthRate: band plus lever, with the fallbacks
assert.equal(growthRate(A.properties, base), 0.02);
assert.ok(close(growthRate(A.properties, { ...base, band: "lo", growthAdd: 0.02 }) - 0.03), "low band plus two percent");
assert.ok(close(growthRate(A.properties, { ...base, band: "hi" }) - 0.03));
assert.equal(growthRate(C.properties, { ...base, band: "hi", growthAdd: 0.01 }), 0.01, "unknown growth carries the count flat; the lever still applies");
assert.equal(growthRate({ growth_base: 0.015 }, { ...base, band: "lo" }), 0.015, "a missing band rate falls back to base");

// effectiveVpd: projected from the count year, day type volume as the base
assert.ok(close(effectiveVpd(A.properties, base) - 20000 * 1.02 ** 2), "2025 from a 2023 count: two years of growth");
assert.ok(close(effectiveVpd(B.properties, { ...base, year: 2035 }) - 10000 * 1.02 ** 15), "a 2020 count projected to 2035: fifteen years, as intended");
assert.ok(close(effectiveVpd(A.properties, { ...base, daytype: "weekend", year: 2023 }) - 20000 * 0.76), "day type volume, no growth at the count year");
assert.ok(close(effectiveVpd(A.properties, { ...base, daytype: "gameday", year: 2023 }) - (20000 * 0.855 + 1000)), "game day volume carries the routed stadium traffic");
assert.equal(effectiveVpd({ vpd_max: 100, volume_year: 2020 }, { ...base, year: 2030 }), 100, "no day type volumes and no growth: school Friday falls back to the count, carried flat");
assert.equal(effectiveVpd({ vpd_max: 100, volume_year: 2020 }, { ...base, daytype: "weekend" }), null, "an unknown day type volume is null, never guessed");

// effectiveVc and closures
assert.ok(close(effectiveVc(A.properties, base, closures) - (20000 * 1.02 ** 2) / 34200));
assert.ok(close(effectiveVc(A.properties, { ...base, los: "C" }, closures) - (20000 * 1.02 ** 2) / 22000), "LOS C capacity");
assert.equal(effectiveVc(A.properties, { ...base, closing: "A" }, closures), 0, "the closed segment reads 0");
assert.ok(close(effectiveVc(B.properties, { ...base, closing: "A" }, closures) - (10000 * 1.02 ** 5 + 20000) / 34200), "a detour segment carries its projected volume plus the closed segment's volume");
assert.ok(close(effectiveVc(C.properties, { ...base, closing: "A" }, closures) - 5000 / 34200), "segments off the detour are untouched");
assert.equal(closureAdded("B", "A", closures), 20000); assert.equal(closureAdded("B", "B", closures), 0); assert.equal(closureAdded("B", "A", null), 0); assert.equal(closureAdded("B", null, closures), 0);
assert.equal(effectiveVc({ loc_id: "Z", vpd_max: 1, capacity_E: null }, base, closures), null, "no capacity, no v/c");

// deriveProps: the default scenario reproduces today; a scenario swaps in the projected v/c
const d0 = deriveProps(A.properties, base);
assert.ok(close(d0.v_c_active - 20000 / 34200), "default: v_c is the count over capacity, no projection");
assert.equal(d0.projected, 0); assert.equal(d0.closure_added, 0); assert.equal(d0.is_closed, 0); assert.equal(d0.vpd_eff, 20000);
const d1 = deriveProps(A.properties, { ...base, year: 2030 });
assert.ok(close(d1.v_c_active - (20000 * 1.02 ** 7) / 34200), "scenario: projected v/c in v_c_active");
assert.equal(d1.projected, 1); assert.ok(close(d1.v_c_today - 20000 / 34200), "today's v/c kept beside the projection");
assert.ok(close(d1.combined_active - (2 + d1.v_c_active)), "the combined score uses the projected v/c");
const dB = deriveProps(B.properties, { ...base, closing: "A" });
assert.equal(dB.closure_added, 20000); assert.equal(dB.closure_from, "W Main St");
assert.ok(close(dB.v_c_before_closure - (10000 * 1.02 ** 5) / 34200) && close(dB.v_c_active - (10000 * 1.02 ** 5 + 20000) / 34200), "before and after the closure for the tooltip");
assert.equal(deriveProps(A.properties, { ...base, closing: "A" }).is_closed, 1);
assert.equal(deriveProps(A.properties, { ...base, closing: "A" }).v_c_active, 0);
assert.equal(applyState({ ...base, year: 2031 }).features[0].properties.projected, 1, "applyState feeds the projected numbers to the paint");
// the table under a scenario ranks by the projected v/c
assert.deepEqual(rankedRows({ ...base, closing: "A" }).map(r => r.loc_id), ["B", "C", "A"], "the detour segment leads, the closed one sinks to v/c 0");

// labels built from state
assert.equal(scenarioText(base), ""); assert.equal(vcLabel(base), "v/c");
assert.equal(vcLabel({ ...base, year: 2031, daytype: "school_wkday" }), "projected v/c, 2031, base band, school weekday");
assert.equal(scenarioText({ ...base, band: "hi", growthAdd: 0.01, daytype: "gameday", year: 2035 }), "2035, high band, plus 1 percent per year, OU game day");
assert.equal(scenarioText({ ...base, closing: "A" }), "2025, base band, school Friday, W Main St closed");
assert.equal(scenarioText({ ...base, closing: "nope" }), "2025, base band, school Friday, nope closed", "an unknown closed id still reads");
assert.ok(!vcLabel({ ...base, year: 2031, growthAdd: 0.02 }).includes("-"), "no dashes in the label");

// closureImpact: the briefing's view of a closure
assert.equal(closureImpact(base), null);
const ci = closureImpact({ ...base, closing: "A" });
assert.equal(ci.closed.on_road, "W Main St"); assert.equal(ci.no_path, false); assert.equal(ci.flagged, false); assert.equal(ci.detour_len_mi, 1.2); assert.equal(ci.ratio, 1.8);
assert.equal(ci.top.loc_id, "B"); assert.equal(ci.top.added, 20000); assert.ok(close(ci.top.before - (10000 * 1.02 ** 5) / 34200) && close(ci.top.after - (10000 * 1.02 ** 5 + 20000) / 34200));
const cc = closureImpact({ ...base, closing: "C" });
assert.deepEqual(cc.detours.map(d => d.loc_id), ["A", "B"], "detours sorted by the v/c increase");
assert.equal(cc.flagged, true);
const cb = closureImpact({ ...base, closing: "B" });
assert.equal(cb.no_path, true); assert.equal(cb.top, null); assert.deepEqual(cb.detours, []);
assert.equal(closureImpact({ ...base, closing: "nope" }), null, "unknown segment");
assert.equal(segmentProps("A").on_road, "W Main St"); assert.equal(segmentProps("zz"), null);

// countOver: the "runs out of road" stat
assert.equal(countOver(base, 0.5), 1, "today only A sits over 0.5");
assert.equal(countOver({ ...base, year: 2035, band: "hi", growthAdd: 0.02 }, 0.5), 2, "under a hot scenario B joins it");
console.log("scenario math checks passed");

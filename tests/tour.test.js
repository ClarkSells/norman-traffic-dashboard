// Run from the repo root: node dashboard/tests/tour.test.js
// Step definitions validate against the real data when it is present; captions quote FACTS or computed values only.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { FACTS, LIVE_URL, TOP5, WARD_TOP, factTokens } from "../facts.js";
import { setRaw } from "../data.js";
import { buildTour } from "../tour.js";

// Facts: exact strings from the handoff, never the forbidden ones
assert.equal(FACTS.ab_agreement_percent, "85.94"); assert.equal(FACTS.uncounted_top_ten_sum, 564); assert.equal(FACTS.v_c_max, "0.88");
assert.equal(TOP5.length, 5); assert.equal(TOP5[0].combined, "168.55"); assert.equal(TOP5[4].loc_id, "52500-178");
assert.equal(Object.keys(WARD_TOP).length, 8); assert.deepEqual(WARD_TOP[5], ["52500-237", "61.58"]);
const facts = JSON.stringify({ FACTS, TOP5, WARD_TOP });
assert.ok(!facts.includes("0.9995") && !facts.includes("9 of 10") && !facts.includes("1.084"), "no irreproducible figures");
assert.ok(factTokens().has("23,595") && factTokens().has("168.55") && factTokens().has("204"));

const here = dirname(fileURLToPath(import.meta.url));
const real = join(here, "..", "data", "segments.geojson");
const seg = (loc, wards, vpd, byYear, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.5, 35.2], [-97.49, 35.2]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, ward_primary: wards[0], shared_boundary: wards.length > 1, functional_class: "Minor Arterial", vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear, v_c_E: vpd / 34200, lanes_final: 4, ...extra } });
const raw = existsSync(real)
  ? { segments: JSON.parse(readFileSync(real, "utf8")), summary: JSON.parse(readFileSync(join(here, "..", "data", "summary.json"), "utf8")) }
  : { segments: { type: "FeatureCollection", features: [seg("52500-158", [2], 30000, { 2023: 168 }), seg("52500-254", [1, 4], 1000, {}), seg("52500-261", [4, 6], 1000, {}), seg("52500-243", [8], 1000, {}), seg("52500-178", [3, 8], 1000, {})] }, summary: { years: [2021, 2022, 2023, 2024, 2025] } };
setRaw({ ...raw, wards: { features: [] }, collisions: null, points: null });
const steps = buildTour(raw);

assert.equal(steps.length, 12, "twelve steps");
assert.deepEqual(steps.map(s => s.id), ["citywide", "vc", "crashes", "combined", "top1", "top2", "top3", "top4", "top5", "ward2", "losc", "lanes"]);
const ids = new Set(raw.segments.features.map(f => f.properties.loc_id));
const tokens = factTokens();
for (const s of steps) {
  assert.ok(s.title && s.caption && s.state && s.camera && s.basemap, `${s.id}: complete definition`);
  assert.equal(s.number, s.index + 1); assert.equal(s.total, 12);
  for (const k of ["ward", "metric", "los", "yearMin", "yearMax", "includeCollectors", "selectedLocId"]) assert.ok(k in s.state, `${s.id}: state patch carries ${k}`);
  if (s.state.selectedLocId) assert.ok(ids.has(s.state.selectedLocId), `${s.id}: selected ${s.state.selectedLocId} exists in segments.geojson`);
  if (s.camera.segment) assert.ok(ids.has(s.camera.segment), `${s.id}: camera target exists`);
  if (s.popup) assert.equal(s.popup, s.state.selectedLocId, `${s.id}: popup opens on the selected segment`);
  assert.ok(!s.caption.includes("—") && !s.caption.includes(" - ") && !s.title.includes("—"), `${s.id}: no em dashes`);
  assert.ok(s.caption.split(/\s+/).length <= 120, `${s.id}: caption under 120 words`);
  assert.ok(s.caption.split(/[.!?](\s|$)/).filter(x => x.trim()).length <= 4, `${s.id}: one to a few sentences`);
  // Every number in the caption is a quoted fact or a value computed from the data for this step.
  const computed = new Set(Object.values(s.computed || {}).filter(v => v != null).map(String));
  for (const num of s.caption.replace(LIVE_URL, "").match(/\d[\d,]*\.?\d*/g) || []) {
    const bare = num.replace(/\.$/, "");
    assert.ok(tokens.has(bare) || computed.has(bare) || /^(1\.0|2020|2025)$/.test(bare), `${s.id}: "${bare}" is a quoted fact or computed from data`);
  }
}
assert.equal(steps[0].state.metric, "combined"); assert.equal(steps[0].camera.pitch, 0, "citywide flat");
assert.equal(steps[1].state.metric, "v_c"); assert.equal(steps[2].state.metric, "collisions"); assert.equal(steps[3].state.metric, "combined");
assert.ok(steps[2].caption.includes("rank correlation above 0.99") && steps[2].caption.includes("tiebreaker"), "the sanctioned correlation phrase");
for (let i = 0; i < 5; i++) { const s = steps[4 + i], t = TOP5[i]; assert.equal(s.camera.segment, t.loc_id); assert.ok(s.caption.includes(t.name) && s.caption.includes(`v/c ${t.v_c}`) && s.caption.includes(`${t.crashes} crashes`) && s.caption.includes(t.combined), `top ${i + 1} caption quotes name, v/c, crashes, score`); }
assert.equal(steps[9].state.ward, 2); assert.equal(steps[9].showPanel, true, "ward step shows the panel"); assert.ok(steps[9].caption.includes("counted once, listed in both neighboring wards"));
assert.equal(steps[10].state.los, "C"); assert.equal(steps[10].state.ward, 2); assert.equal(steps[10].showPanel, true);
assert.equal(steps[11].basemap, "satellite"); assert.equal(steps[11].camera.segment, "52500-158"); assert.ok(steps[11].caption.includes(LIVE_URL), "closing caption carries the live URL");
if (existsSync(real)) {
  assert.ok(steps[1].caption.includes("0.88"), "v/c max computed from data agrees with the quoted 0.88");
  assert.ok(steps[9].caption.includes(`Ward 2 has ${steps[9].computed.ward2Count} arterial`));
  assert.ok(steps[11].caption.includes("34,556") || steps[11].computed.vpd, "lane story quotes the segment's own volume");
  // Quoted TOP5 values agree with the data
  for (const t of TOP5) { const p = raw.segments.features.find(f => f.properties.loc_id === t.loc_id).properties; assert.equal(p.collisions, t.crashes); assert.equal(p.combined.toFixed(2), t.combined); assert.equal(p.v_c.toFixed(2), t.v_c); assert.equal(p.rank_combined_city, t.rank); }
  console.log("tour real-data checks passed");
}
console.log("tour step checks passed");

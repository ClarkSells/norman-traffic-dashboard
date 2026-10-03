// Run from the repo root: node tests/scenes.test.js
// The 15 present-mode scenes (0 to 14) from handoff/02_DESIGN_DIRECTION.md section 10, validated against C.2.
// Captions quote factTokens() or values computed from the loaded data only.
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { FACTS, TOP5, factTokens } from "../facts.js";
import { setRaw, rankedRows } from "../data.js";
import { SCENE_TIMING } from "../config.js";
import { buildScenes } from "../scenes.js";

const here = dirname(fileURLToPath(import.meta.url));
const real = join(here, "..", "data", "segments.geojson");
const seg = (loc, wards, vpd, byYear, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.5, 35.2], [-97.49, 35.2]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, ward_primary: wards[0], shared_boundary: wards.length > 1, functional_class: "Minor Arterial", vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear, v_c_E: vpd / 34200, lanes_final: 4, ...extra } });
const raw = existsSync(real)
  ? { segments: JSON.parse(readFileSync(real, "utf8")), summary: JSON.parse(readFileSync(join(here, "..", "data", "summary.json"), "utf8")) }
  : { segments: { type: "FeatureCollection", features: [seg("52500-158", [2], 30000, { 2023: 168 }), seg("52500-254", [1, 4], 1000, {}), seg("52500-261", [4, 6], 1000, {}), seg("52500-243", [8], 1000, {}), seg("52500-178", [3, 8], 1000, {})] }, summary: { years: [2021, 2022, 2023, 2024, 2025] } };
setRaw({ ...raw, wards: { features: [] }, collisions: null, points: null });
const scenes = buildScenes(raw);

// Independent recomputation of the values scenes.js derives from the data (mirrors tour.js).
const BASE = { ward: null, metric: "combined", los: "E", yearMin: FACTS.year_min, yearMax: FACTS.year_max, includeCollectors: false, selectedLocId: null };
const byId = Object.fromEntries(raw.segments.features.map(f => [f.properties.loc_id, f.properties]));
const ward2 = rankedRows({ ...BASE, ward: 2 });
const over1 = rankedRows({ ...BASE, ward: 2, los: "C" }).filter(r => r.v_c_active >= 1);
const vcMax = raw.segments.features.reduce((a, f) => Math.max(a, f.properties.v_c_E || 0), 0);
const n = (v) => Number(v).toLocaleString("en-US");
const main = byId["52500-158"] || {};

// Numeric tokens a caption may carry: quoted facts plus this deck's computed values.
// "1.0" (the v/c threshold) and "2020" (the capacity plan) are sanctioned constants from the tour captions.
const computed = new Set(["1.0", "2020", vcMax ? vcMax.toFixed(2) : FACTS.v_c_max, String(ward2.length), String(over1.length)]);
if (main.vpd_max != null) computed.add(n(main.vpd_max));
if (main.lanes_final != null) computed.add(String(main.lanes_final));
const tokens = factTokens();

// 15 scenes in storyboard order
assert.equal(scenes.length, 15, "fifteen scenes");
assert.deepEqual(scenes.map(s => s.id), ["title", "citywide", "vc", "heat", "crashes", "combined", "top1", "top2", "top3", "top4", "top5", "ward2", "losc", "lanes", "closing"], "storyboard order");

const C1_KEYS = ["ward", "metric", "los", "yearMin", "yearMax", "includeCollectors", "selectedLocId", "basemap", "reducedMotion", "heat", "flow", "presenting"];
const LAYER_KEYS = ["flow", "heat", "dots", "callouts", "pulse", "mask", "segmentsOpacity"];
const KINDS = new Set(["title", "city", "segment", "ward", "closing"]);
const CAMERAS = new Set(["establish", "segment", "ward", "aerial"]);

for (const s of scenes) {
  assert.equal(s.number, s.index + 1); assert.equal(s.total, 15);
  assert.ok(KINDS.has(s.kind), `${s.id}: known kind`);
  assert.ok(s.title && s.caption, `${s.id}: title and caption present`);
  // state: full C.1 object, never a partial patch
  for (const k of C1_KEYS) assert.ok(k in s.state, `${s.id}: state carries ${k}`);
  assert.equal(s.state.presenting, true, `${s.id}: presenting true`);
  assert.equal(s.state.basemap, s.basemap, `${s.id}: state.basemap mirrors scene basemap`);
  assert.equal(s.state.heat, s.layers.heat, `${s.id}: state.heat mirrors layers.heat`);
  assert.equal(s.state.flow, s.layers.flow, `${s.id}: state.flow mirrors layers.flow`);
  // layers: complete C.2 layers object
  for (const k of LAYER_KEYS) assert.ok(k in s.layers, `${s.id}: layers carries ${k}`);
  assert.ok(["all", "segment", "none"].includes(s.layers.dots), `${s.id}: dots mode`);
  assert.ok(Array.isArray(s.layers.callouts) && Array.isArray(s.layers.pulse), `${s.id}: callouts and pulse are lists`);
  // camera and motion
  assert.ok(CAMERAS.has(s.camera.kind), `${s.id}: known camera kind`);
  assert.equal(typeof s.motion.orbitDeg, "number"); assert.equal(typeof s.motion.driftDeg, "number");
  // stats and legend
  assert.ok(Array.isArray(s.stats) && s.stats.length <= 5, `${s.id}: 0 to 5 stats`);
  for (const st of s.stats) assert.ok(st.label && typeof st.value === "string", `${s.id}: stat values pre-formatted`);
  assert.ok(s.legend === null || ["combined", "v_c", "collisions"].includes(s.legend), `${s.id}: legend chip`);
  if (s.list) for (const [i, row] of s.list.entries()) {
    assert.equal(row.rank, i + 1, `${s.id}: list ranked top down`);
    for (const k of ["locId", "road", "span", "score"]) assert.ok(row[k] != null && row[k] !== "", `${s.id}: list row carries ${k}`);
  }
  // caption hygiene, same bar as tour.test.js
  assert.ok(!s.caption.includes("—") && !s.caption.includes(" - ") && !s.title.includes("—"), `${s.id}: no em dashes`);
  assert.ok(s.caption.split(/\s+/).length <= 120, `${s.id}: caption under 120 words`);
  for (const num of s.caption.match(/\d[\d,]*\.?\d*/g) || []) {
    const bare = num.replace(/[^\d]+$/, "");
    assert.ok(tokens.has(bare) || computed.has(bare), `${s.id}: "${bare}" is a quoted fact or computed from data`);
  }
}

// autoplayMs: null only for title and closing; SCENE_TIMING by kind everywhere else, except the two
// scenes the storyboard times explicitly (scene 5 "combined" 12 s, scene 13 "lanes" 14 s).
const STORYBOARD_TIMING = { combined: 12000, lanes: 14000 };
assert.equal(scenes[0].autoplayMs, null, "title is manual");
assert.equal(scenes[14].autoplayMs, null, "closing is manual");
for (const s of scenes) {
  const want = s.kind === "title" || s.kind === "closing" ? null : (STORYBOARD_TIMING[s.id] || SCENE_TIMING[s.kind]);
  assert.equal(s.autoplayMs, want, `${s.id}: autoplay ${want}`);
  assert.ok(typeof s.autoplayMs === "number" || s.kind === "title" || s.kind === "closing", `${s.id}: only title and closing are manual`);
}

// Camera language per the storyboard
assert.equal(scenes[0].camera.kind, "establish"); assert.equal(scenes[0].motion.orbitDeg, 0, "title: no orbit");
assert.equal(scenes[1].camera.kind, "establish"); assert.equal(scenes[1].motion.orbitDeg, 14, "scene 1 orbits");
for (let i = 2; i <= 5; i++) { assert.equal(scenes[i].camera.kind, "establish", `scene ${i}: hold on the city framing`); assert.equal(scenes[i].motion.orbitDeg, 0, `scene ${i}: hold`); }
assert.equal(scenes[11].camera.kind, "ward"); assert.equal(scenes[11].camera.ward, 2); assert.ok(scenes[11].motion.driftDeg > 0, "ward fit drifts");
assert.equal(scenes[12].camera.kind, "ward"); assert.equal(scenes[12].camera.ward, 2); assert.equal(scenes[12].motion.orbitDeg, 0); assert.equal(scenes[12].motion.driftDeg, 0, "scene 12 holds");
assert.deepEqual(scenes[13].camera, { kind: "aerial", locId: "52500-158" }, "aerial on W Main St");
assert.equal(scenes[13].motion.orbitDeg, 25, "aerial orbit");
assert.equal(scenes[14].camera.kind, "establish"); assert.equal(scenes[14].motion.orbitDeg, 0, "closing: no orbit");

// Segment scenes carry the TOP5 loc ids in rank order
const top5Ids = TOP5.map(t => t.loc_id);
for (let i = 0; i < 5; i++) {
  const s = scenes[6 + i], t = TOP5[i];
  assert.equal(s.kind, "segment"); assert.equal(s.camera.kind, "segment"); assert.equal(s.camera.locId, t.loc_id, `scene ${6 + i}: TOP5 rank ${t.rank}`);
  assert.equal(s.state.selectedLocId, t.loc_id);
  assert.deepEqual(s.layers.callouts, [t.loc_id]); assert.deepEqual(s.layers.pulse, [t.loc_id]);
  assert.equal(s.layers.dots, "segment"); assert.equal(s.layers.flow, true, "segment scene flow on");
  assert.ok(s.motion.driftDeg > 0, "segment dolly drifts");
  assert.ok(s.caption.includes(t.name) && s.caption.includes(`v/c ${t.v_c}`) && s.caption.includes(`${t.crashes} crashes`) && s.caption.includes(t.combined), `top ${i + 1} caption quotes name, v/c, crashes, score`);
}

// Layer story per the storyboard
assert.equal(scenes[3].layers.heat, true, "scene 3 heat on");
assert.equal(scenes[3].state.heat, true);
assert.equal(scenes[3].layers.segmentsOpacity, 0.35, "segments at 35 percent under the heat surface");
assert.equal(scenes[3].layers.flow, false, "scene 3 flow off");
for (const [i, s] of scenes.entries()) if (i !== 3) { assert.equal(s.layers.heat, false, `scene ${i}: heat off`); assert.equal(s.state.heat, false); }
assert.deepEqual(scenes[5].layers.callouts, top5Ids, "scene 5 callouts for the top five");
assert.deepEqual(scenes[5].layers.pulse, top5Ids, "scene 5 pulses in rank order");
assert.deepEqual(scenes[5].stats.map(st => st.value), TOP5.map(t => t.combined), "scene 5 stat strip of the five scores");
assert.equal(scenes[11].layers.mask, 2, "scene 11 masks outside ward 2");
assert.equal(scenes[12].layers.mask, 2, "scene 12 keeps the ward 2 mask");
for (const [i, s] of scenes.entries()) if (i !== 11 && i !== 12) assert.equal(s.layers.mask, null, `scene ${i}: no mask`);
assert.equal(scenes[11].lightPreset, "day"); assert.equal(scenes[12].lightPreset, "day", "ward scenes run the day preset");
assert.equal(scenes[13].basemap, "satellite", "scene 13 is satellite");
assert.equal(scenes[13].state.basemap, "satellite");
assert.equal(scenes[13].calloutText, `${main.lanes_final} lanes · ${n(main.vpd_max)} VPD`, "aerial callout text from the segment's own figures");

// State progressions mirror the storyboard
assert.equal(scenes[1].state.metric, "combined"); assert.equal(scenes[2].state.metric, "v_c");
assert.equal(scenes[4].state.metric, "collisions"); assert.equal(scenes[5].state.metric, "combined");
assert.equal(scenes[11].state.ward, 2); assert.equal(scenes[12].state.ward, 2); assert.equal(scenes[12].state.los, "C");
assert.equal(scenes[2].legend, "v_c", "scene 2 legend chip");

// Ward 2 figures agree with rankedRows, as tour.js computes them today
assert.ok(scenes[11].caption.includes(`Ward 2 has ${ward2.length} arterial`), "ward 2 caption carries the live count");
assert.deepEqual(scenes[11].list.map(r => r.locId), ward2.slice(0, 5).map(r => r.loc_id), "ward 2 list is the rankedRows top five");
assert.ok(scenes[12].caption.includes(`${over1.length} Ward 2`), "LOS C caption carries the live count");
assert.deepEqual(scenes[12].layers.pulse, over1.map(r => r.loc_id), "LOS C pulses every segment that crosses 1.0");

// Title and closing copy verbatim from the storyboard
assert.equal(scenes[0].title, "Norman street segment priorities");
assert.equal(scenes[0].caption, "Congestion, crashes and a combined score for every counted segment, by council ward");
assert.equal(scenes[0].kind, "title"); assert.equal(scenes[14].kind, "closing");
assert.equal(scenes[0].layers.segmentsOpacity, 0.5); assert.equal(scenes[14].layers.segmentsOpacity, 0.5, "bookends show segments at 50 percent");

if (existsSync(real)) {
  assert.ok(scenes[2].caption.includes("0.88"), "v/c max computed from data agrees with the quoted 0.88");
  assert.equal(scenes[13].calloutText, "6 lanes · 31,886 VPD", "callout text matches the storyboard verbatim");
  for (const t of TOP5) assert.ok(byId[t.loc_id], `TOP5 ${t.loc_id} exists in segments.geojson`);
  console.log("scenes real-data checks passed");
}
console.log("scenes checks passed");

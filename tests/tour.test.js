// Run from the repo root: node tests/tour.test.js
// The 15 C.2 scenes from buildScenes (scenes.js, card 1.4), validated against the real data files.
// Captions quote facts.js figures only. Until scenes.js lands, a local fixture with the same shape
// stands in so this suite runs; every assertion is drawn from CONTRACTS C.2 and the storyboard, so it
// must pass unchanged against the real buildScenes.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { FACTS, LIVE_URL, TOP5, WARD_TOP, factTokens } from "../facts.js";
import { setRaw, rankedRows } from "../data.js";
import { SCENE_TIMING } from "../config.js";

// Facts: exact strings from the handoff, never the forbidden ones
assert.equal(FACTS.ab_agreement_percent, "85.94"); assert.equal(FACTS.uncounted_top_ten_sum, 564); assert.equal(FACTS.v_c_max, "0.88");
assert.equal(TOP5.length, 5); assert.equal(TOP5[0].combined, "168.55"); assert.equal(TOP5[4].loc_id, "52500-178");
assert.equal(Object.keys(WARD_TOP).length, 8); assert.deepEqual(WARD_TOP[5], ["52500-237", "61.58"]);
const factsJson = JSON.stringify({ FACTS, TOP5, WARD_TOP });
assert.ok(!factsJson.includes("0.9995") && !factsJson.includes("9 of 10") && !factsJson.includes("1.084"), "no irreproducible figures");
assert.ok(factTokens().has("23,595") && factTokens().has("168.55") && factTokens().has("204"));

// Real data files, same raw shape getRaw() returns at runtime
const here = dirname(fileURLToPath(import.meta.url));
const load = (name) => JSON.parse(readFileSync(join(here, "..", "data", name), "utf8"));
const raw = {
  segments: load("segments.geojson"),
  wards: load("wards.geojson"),
  collisions: load("collisions.geojson"),
  points: load("count_points.geojson"),
  summary: load("summary.json"),
  closures: load("closure_impacts.json"),
};
setRaw(raw);

const n = (v) => Number(v).toLocaleString("en-US");

// Stand-in for scenes.js while card 1.4 is in flight. C.2-shaped, 15 scenes, storyboard order,
// captions quoting the same facts.js figures the real scenes.js must quote.
function fixtureBuildScenes(rawData) {
  const segs = (rawData.segments && rawData.segments.features) || [];
  const byId = Object.fromEntries(segs.map(f => [f.properties.loc_id, f.properties]));
  const vcMax = segs.reduce((a, f) => Math.max(a, f.properties.v_c_E || 0), 0);
  const vcMaxText = vcMax ? vcMax.toFixed(2) : FACTS.v_c_max;
  const base = { ward: null, metric: "combined", los: "E", yearMin: FACTS.year_min, yearMax: FACTS.year_max,
    includeCollectors: false, selectedLocId: null, basemap: "light", reducedMotion: false, heat: false, flow: false, presenting: true };
  const layers = (over = {}) => ({ flow: false, heat: false, dots: "all", callouts: [], pulse: [], mask: null, segmentsOpacity: 1, ...over });
  const ward2 = rankedRows({ ...base, ward: 2 });
  const ward2C = rankedRows({ ...base, ward: 2, los: "C" });
  const over1 = ward2C.filter(r => r.v_c_active >= 1).length;
  const main = byId["52500-158"] || {};
  const list = ward2.slice(0, 5).map(r => ({ rank: r.rank, locId: r.loc_id, road: r.on_road, span: `${r.from_road} to ${r.to_road}`, score: r.combined_active.toFixed(2) }));
  const scenes = [
    { id: "title", kind: "title", title: "Norman street segment priorities", basemap: "light", lightPreset: "dusk",
      caption: "Congestion, crashes and a combined score for every counted segment, by council ward.",
      stats: [], legend: null, list: null, state: { ...base }, camera: { kind: "establish" },
      motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers({ segmentsOpacity: 0.5 }), autoplayMs: null },
    { id: "citywide", kind: "city", title: "Every counted segment in Norman", basemap: "light", lightPreset: "dusk",
      caption: `${n(FACTS.segments)} segments, ${n(FACTS.collision_rows)} crash records, ${n(FACTS.assigned_in_window)} assigned ${FACTS.year_min} to ${FACTS.year_max}. Each segment is colored by its combined score: crashes plus the volume to capacity ratio (v/c).`,
      stats: [{ label: "segments", value: n(FACTS.segments) }, { label: "crash records", value: n(FACTS.collision_rows) }, { label: "assigned", value: n(FACTS.assigned_in_window) }],
      legend: "combined", list: null, state: { ...base, flow: true }, camera: { kind: "establish" },
      motion: { orbitDeg: 14, driftDeg: 0 }, layers: layers({ flow: true }), autoplayMs: SCENE_TIMING.city },
    { id: "vc", kind: "city", title: "Volume alone", basemap: "light", lightPreset: "dusk",
      caption: `Colored by v/c: the highest daily count at each location divided by its capacity at level of service (LOS) E. The highest v/c citywide is ${vcMaxText}, so no segment is over capacity on this measure.`,
      stats: [{ label: "highest v/c", value: vcMaxText }], legend: "v_c", list: null, state: { ...base, metric: "v_c", flow: true },
      camera: { kind: "establish" }, motion: { orbitDeg: 14, driftDeg: 0 }, layers: layers({ flow: true }), autoplayMs: SCENE_TIMING.city },
    { id: "heat", kind: "city", title: "Where crashes cluster", basemap: "light", lightPreset: "dusk",
      caption: `${n(FACTS.assigned_in_window)} assigned crashes, ${FACTS.year_min} to ${FACTS.year_max}, as one density surface. The clusters sit on the same handful of arterial corridors the combined score ranks highest.`,
      stats: [{ label: "assigned", value: n(FACTS.assigned_in_window) }], legend: null, list: null, state: { ...base, heat: true },
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers({ heat: true, segmentsOpacity: 0.35 }), autoplayMs: SCENE_TIMING.city },
    { id: "crashes", kind: "city", title: "Crashes alone", basemap: "light", lightPreset: "dusk",
      caption: `Colored by crashes assigned to each segment, ${FACTS.year_min} to ${FACTS.year_max}. The map barely changes from the combined view: ${FACTS.rank_correlation_phrase}.`,
      stats: [], legend: "collisions", list: null, state: { ...base, metric: "collisions" },
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers(), autoplayMs: SCENE_TIMING.city },
    { id: "combined", kind: "city", title: "Back to the combined score", basemap: "light", lightPreset: "dusk",
      caption: "Combined score = crashes + v/c, exactly as the brief defines it. The five highest scoring segments in the city come next, in rank order.",
      stats: TOP5.map(t => ({ label: `#${t.rank}`, value: t.combined })), legend: "combined", list: null, state: { ...base },
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers({ callouts: TOP5.map(t => t.loc_id) }), autoplayMs: SCENE_TIMING.city },
    ...TOP5.map(t => ({ id: `top${t.rank}`, kind: "segment", title: `#${t.rank} citywide: ${t.name}`, basemap: "light", lightPreset: "dusk",
      caption: `${t.name}, ${t.span}. v/c ${t.v_c}, ${t.crashes} crashes, combined score ${t.combined}.`,
      stats: [{ label: "v/c", value: t.v_c }, { label: "crashes", value: String(t.crashes) }, { label: "score", value: t.combined }],
      legend: null, list: null, state: { ...base, selectedLocId: t.loc_id, flow: true },
      camera: { kind: "segment", locId: t.loc_id }, motion: { orbitDeg: 0, driftDeg: 8 },
      layers: layers({ flow: true, dots: "segment", callouts: [t.loc_id], pulse: [t.loc_id] }), autoplayMs: SCENE_TIMING.segment })),
    { id: "ward2", kind: "ward", title: "How a councilmember reads their list", basemap: "light", lightPreset: "day",
      caption: `Ward 2 has ${ward2.length} arterial segments in its primary list, ranked top down by combined score. A boundary tag means the segment sits on a ward line: counted once, listed in both neighboring wards.`,
      stats: [], legend: "combined", list, state: { ...base, ward: 2 },
      camera: { kind: "ward", ward: 2 }, motion: { orbitDeg: 0, driftDeg: 8 }, layers: layers({ mask: 2 }), autoplayMs: SCENE_TIMING.ward },
    { id: "losc", kind: "ward", title: "What moves under LOS C", basemap: "light", lightPreset: "day",
      caption: `LOS C uses the 2020 plan's lower capacities, so every v/c rises and ${over1} Ward 2 ${over1 === 1 ? "segment reaches" : "segments reach"} or pass 1.0. Crash counts do not move, so the order of the list barely changes.`,
      stats: [{ label: "segments at v/c 1.0+", value: String(over1) }], legend: "v_c", list: null, state: { ...base, ward: 2, los: "C" },
      camera: { kind: "ward", ward: 2 }, motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers({ mask: 2 }), autoplayMs: SCENE_TIMING.ward },
    { id: "lanes", kind: "segment", title: "The lane count story", basemap: "satellite", lightPreset: "dusk",
      caption: `All ${n(FACTS.lanes_verified)} lane counts were verified by a person against aerial imagery. W Main St carries ${main.vpd_max != null ? n(main.vpd_max) : "its highest count"} vehicles per day on ${main.lanes_final != null ? main.lanes_final : "its verified"} lanes.`,
      stats: [], legend: null, list: null, state: { ...base, selectedLocId: "52500-158", basemap: "satellite", flow: true },
      camera: { kind: "aerial", locId: "52500-158" }, motion: { orbitDeg: 25, driftDeg: 0 },
      layers: layers({ flow: true, dots: "segment", callouts: ["52500-158"] }), autoplayMs: SCENE_TIMING.ward },
    { id: "closing", kind: "closing", title: "Explore it yourself", basemap: "light", lightPreset: "dusk",
      caption: `Every figure in this briefing is reproducible from the workbook and the audit trail. Explore it yourself at ${LIVE_URL}`,
      stats: [], legend: null, list: null, state: { ...base }, camera: { kind: "establish" },
      motion: { orbitDeg: 0, driftDeg: 0 }, layers: layers({ segmentsOpacity: 0.5 }), autoplayMs: null },
  ];
  return scenes.map((sc, i) => ({ ...sc, index: i, number: i + 1, total: scenes.length }));
}

let buildScenes, source = "scenes.js";
try {
  ({ buildScenes } = await import("../scenes.js"));
} catch {
  buildScenes = fixtureBuildScenes; source = "fixture (scenes.js not on disk yet)";
}
const scenes = buildScenes(raw);

// Shape: 17 scenes (the storyboard's 15 plus the two Simulate scenes at 13 and 14), complete C.2 definitions, storyboard order
assert.equal(scenes.length, 17, "seventeen scenes");
const KINDS = ["title", "city", "city", "city", "city", "city", "segment", "segment", "segment", "segment", "segment", "ward", "ward", "city", "segment", null, "closing"];
const STATE_KEYS = ["ward", "metric", "los", "yearMin", "yearMax", "includeCollectors", "selectedLocId", "basemap", "reducedMotion", "heat", "flow", "presenting"];
for (const sc of scenes) {
  assert.ok(sc.id && sc.title && sc.caption, `scene ${sc.index}: id, title and caption`);
  assert.equal(sc.number, sc.index + 1); assert.equal(sc.total, 17);
  if (KINDS[sc.index]) assert.equal(sc.kind, KINDS[sc.index], `scene ${sc.index} kind`);
  assert.ok(Array.isArray(sc.stats) && sc.stats.length <= 5, `scene ${sc.index}: stats 0 to 5`);
  assert.ok(sc.state && typeof sc.state === "object", `scene ${sc.index}: full state`);
  for (const k of STATE_KEYS) assert.ok(k in sc.state, `scene ${sc.index}: state carries ${k}`);
  assert.ok(sc.camera && sc.camera.kind, `scene ${sc.index}: camera`);
  assert.ok(sc.layers && typeof sc.layers === "object", `scene ${sc.index}: layers`);
  assert.ok(!sc.caption.includes("—"), `scene ${sc.index}: no em dashes`);
}

// Segment scenes carry the TOP5 loc ids in rank order
const locOf = (sc) => (sc.camera && sc.camera.locId) || sc.state.selectedLocId;
for (let i = 0; i < 5; i++) {
  assert.equal(locOf(scenes[6 + i]), TOP5[i].loc_id, `segment scene ${i + 1} is citywide rank ${i + 1}`);
  assert.equal(scenes[6 + i].state.selectedLocId, TOP5[i].loc_id, `segment scene ${i + 1} selects its segment`);
}

// Captions quote the facts.js figures (the same figures the old 12-step tour test pinned)
assert.ok(scenes[1].caption.includes("204") && scenes[1].caption.includes("23,595") && scenes[1].caption.includes("5,307"), "citywide caption quotes the headline counts");
assert.ok(scenes[2].caption.includes("0.88"), "v/c scene quotes the citywide max");
assert.ok(scenes[4].caption.includes("rank correlation above 0.99") && scenes[4].caption.includes("tiebreaker"), "the sanctioned correlation phrase");
for (let i = 0; i < 5; i++) {
  const t = TOP5[i], c = scenes[6 + i].caption;
  assert.ok(c.includes(t.name) && c.includes(`v/c ${t.v_c}`) && c.includes(`${t.crashes} crashes`) && c.includes(t.combined), `top ${i + 1} caption quotes name, v/c, crashes, score`);
}
assert.ok(scenes[11].caption.includes("counted once, listed in both neighboring wards"), "ward scene explains the boundary tag");
assert.ok(scenes[16].caption.includes(LIVE_URL), "closing caption carries the live URL");

// The ward scene carries its top five list cards in rank order
assert.ok(Array.isArray(scenes[11].list) && scenes[11].list.length === 5, "ward scene carries a top five list");
scenes[11].list.forEach((row, i) => { assert.equal(row.rank, i + 1); assert.ok(row.locId && row.road, `list row ${i + 1} complete`); });

// Basemap and autoplay timing
assert.equal(scenes[15].basemap, "satellite", "scene 15 satellite");
scenes.forEach((sc, i) => {
  if (i === 0 || i === 16) assert.equal(sc.autoplayMs, null, `scene ${i} is manual (title and closing never auto advance)`);
  else assert.ok(Number.isFinite(sc.autoplayMs) && sc.autoplayMs > 0, `scene ${i} has an autoplay duration`);
});
assert.ok(scenes.slice(1, 5).every(sc => sc.autoplayMs === SCENE_TIMING.city), "city scenes 1 to 4 run 10 s");
assert.equal(scenes[5].autoplayMs, 12000, "the combined score scene runs the storyboard's 12 s");
assert.ok(scenes.slice(6, 11).every(sc => sc.autoplayMs === SCENE_TIMING.segment), "segment scenes run 12 s");
assert.ok(scenes.slice(11, 13).every(sc => sc.autoplayMs === SCENE_TIMING.ward), "ward and LOS scenes run 14 s");
assert.equal(scenes[13].autoplayMs, SCENE_TIMING.city, "the run out scene runs a city scene's 10 s, longer than the 9 s year play");
assert.equal(scenes[14].autoplayMs, SCENE_TIMING.segment, "the closure scene runs a segment scene's 12 s");
assert.equal(scenes[15].autoplayMs, 14000, "the lane story scene runs the storyboard's 14 s");

console.log(`tour scene checks passed (${source})`);

// Run from the repo root: node tests/segments.test.js
// Wave 4 regressions for layers/segments.js:
//   3.6-01  pulse() must work when the GeoJSONSource has no public .data accessor (the real
//           Mapbox GL JS v3 renderer keeps it private) — locIds come from a module cache.
//   3.6-02  a basemap setStyle wipe must not strand the selection frame: re-adding the layers
//           resets module selection state so the next updateSegments rebuilds halo/gap/pulse.
//   3.1-04  the ward mask must read as a stage in present mode: dark present paper at 45%,
//           world-minus-ward geometry, rings wound per the GeoJSON right-hand rule.
import assert from "node:assert/strict";

const {
  addSegmentsLayer, updateSegments, pulse,
  addWardMask, clearWardMask, WARD_MASK_LAYER,
} = await import("../layers/segments.js");

// A map double that mimics the REAL Mapbox GL JS v3.6 GeoJSONSource: it exposes setData but
// no public .data accessor (verified against the CDN bundle: the field is private `_data`).
// tests/e2e/mapbox_stub.js models .data, which is why the stub suites never caught 3.6-01.
function realishMap() {
  const sources = {}, layers = [], paint = {}, layout = {}, calls = [];
  return {
    sources, layers, paint, layout, calls,
    addSource(id, s) { const held = { data: s.data, opts: s }; sources[id] = { setData: (d) => { held.data = d; }, _held: held }; },
    getSource(id) { return sources[id]; },
    sourceData(id) { return sources[id] && sources[id]._held.data; },
    removeSource(id) { delete sources[id]; },
    wipe() { for (const k of Object.keys(sources)) delete sources[k]; layers.length = 0; },
    addLayer: (l, before) => { const i = before ? layers.findIndex(x => x.id === before) : -1; if (i >= 0) layers.splice(i, 0, l); else layers.push(l); },
    getLayer: (id) => layers.find(l => l.id === id),
    removeLayer(id) { const i = layers.findIndex(l => l.id === id); if (i >= 0) layers.splice(i, 1); },
    setPaintProperty: (id, k, v) => { paint[`${id}.${k}`] = v; calls.push([id, k, v]); },
    getPaintProperty: (id, k) => paint[`${id}.${k}`],
    setLayoutProperty: (id, k, v) => { layout[`${id}.${k}`] = v; },
    setFeatureState: () => {},
  };
}

const feat = (id, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.5, 35.2], [-97.4, 35.21]] }, properties: { loc_id: id, vpd_max: 10000, ...extra } });
const segs = { type: "FeatureCollection", features: [feat("52500-1"), feat("52500-2")] };

const driveTween = ({ onUpdate, onDone }) => {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) onUpdate(t);
  if (onDone) onDone();
  return () => {};
};

// ---- 3.6-01: pulse copies locIds from the cached FeatureCollection, never from source.data ----
const m1 = realishMap();
addSegmentsLayer(m1, segs);
assert.equal(m1.getSource("segments").data, undefined, "the double mimics the real renderer: no .data accessor");
assert.equal(m1.getSource("segments-selected").data, undefined, "same for the selection source");
pulse(m1, ["52500-2"], { reduced: false, tween: driveTween });
assert.equal(m1.sourceData("segments-selected").features.length, 0, "after the pulse the prior (empty) selection is restored");
const m1b = realishMap();
addSegmentsLayer(m1b, segs);
// watch the source DURING the pulse: the locId feature must be present while the tween runs
const lazy = {};
const lazyTween = ({ onUpdate, onDone }) => { lazy.onUpdate = onUpdate; lazy.onDone = onDone; return () => {}; };
pulse(m1b, ["52500-2"], { reduced: false, tween: lazyTween });
lazy.onUpdate(0.25);
const mid = m1b.sourceData("segments-selected");
assert.equal(mid.features.length, 1, "mid-pulse the named segment sits in the selection source (from the cache)");
assert.equal(mid.features[0].properties.loc_id, "52500-2", "the pulse locId was filtered out of the cached FeatureCollection");
lazy.onDone();
assert.equal(m1b.sourceData("segments-selected").features.length, 0, "the tween end restores the prior selection");
console.log("pulse cache (3.6-01) checks passed");

// pulse restores a live selection, it does not clobber it
const m1c = realishMap();
addSegmentsLayer(m1c, segs);
const stSel = { metric: "combined", selectedLocId: "52500-1", ward: null, includeCollectors: false, reducedMotion: true };
updateSegments(m1c, stSel, segs);
assert.equal(m1c.sourceData("segments-selected").features[0].properties.loc_id, "52500-1", "selection written");
pulse(m1c, ["52500-2"], { reduced: false, tween: driveTween });
assert.equal(m1c.sourceData("segments-selected").features.length, 1, "the selection survives a scene pulse");
assert.equal(m1c.sourceData("segments-selected").features[0].properties.loc_id, "52500-1", "restore brings the selected feature back, not an empty FC");
console.log("pulse restore checks passed");

// ---- 3.6-02: basemap setStyle wipe -> re-add -> same state must rebuild the selection frame ----
const m2 = realishMap();
addSegmentsLayer(m2, segs);
updateSegments(m2, stSel, segs);
assert.equal(m2.sourceData("segments-selected").features.length, 1, "selection frame present before the swap");
m2.wipe();   // setStyle drops every source and layer
addSegmentsLayer(m2, segs);
assert.equal(m2.sourceData("segments-selected").features.length, 0, "the re-added selection source starts empty");
updateSegments(m2, stSel, segs);   // identical state: selectedLocId has not changed
assert.equal(m2.sourceData("segments-selected").features.length, 1, "selection frame rebuilt after the basemap swap");
assert.equal(m2.sourceData("segments-selected").features[0].properties.loc_id, "52500-1");
console.log("selection restore after setStyle (3.6-02) checks passed");

// ---- 3.1-04: the ward mask reads as a stage ----
const ward = { type: "Feature", properties: { Ward_num: 2 }, geometry: { type: "Polygon", coordinates: [[[-97.5, 35.15], [-97.4, 35.15], [-97.4, 35.25], [-97.5, 35.25], [-97.5, 35.15]]] } };
const other = { type: "Feature", properties: { Ward_num: 4 }, geometry: { type: "Polygon", coordinates: [[[-97.4, 35.15], [-97.3, 35.15], [-97.3, 35.25], [-97.4, 35.25], [-97.4, 35.15]]] } };
const wardsFc = { type: "FeatureCollection", features: [ward, other] };

// present mode: applyMode strips the inline theme vars, so the fill color must be a real
// value — the dark present paper (#121417) — or a ~235-lum day map shows no dimming at all.
globalThis.document = { documentElement: { dataset: { mode: "present" } } };
try {
  const m3 = realishMap();
  addSegmentsLayer(m3, segs);
  addWardMask(m3, ward, wardsFc);
  const lyr = m3.getLayer(WARD_MASK_LAYER);
  assert.equal(lyr.paint["fill-color"], "#121417", "present mode: the veil is the dark present paper, not the light explore paper");
  assert.equal(lyr.paint["fill-opacity"], 0.45, "45 percent paper per design section 9");
  assert.equal(lyr.slot, "top", "the veil renders in the top slot with the other data layers");
} finally { delete globalThis.document; }
console.log("ward mask present-mode paint (3.1-04) checks passed");

// default (no document / explore): the light explore paper
const m4 = realishMap();
addSegmentsLayer(m4, segs);
addWardMask(m4, ward, wardsFc);
assert.equal(m4.getLayer(WARD_MASK_LAYER).paint["fill-color"], "#f6f4ee", "explore default keeps the light paper veil");

// geometry covers world-minus-ward, wound per the GeoJSON right-hand rule (exterior CCW, hole CW)
const ringArea = (r) => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return a / 2; };
const geom = m4.sourceData("ward-mask").features[0].geometry;
assert.equal(geom.type, "Polygon");
assert.equal(geom.coordinates.length, 2, "outer ring plus the ward hole");
assert.ok(ringArea(geom.coordinates[0]) > 0, "outer ring is counterclockwise");
assert.ok(ringArea(geom.coordinates[1]) < 0, "the ward hole is clockwise");
const ox = geom.coordinates[0].map(p => p[0]), oy = geom.coordinates[0].map(p => p[1]);
assert.ok(Math.min(...ox) < -97.5 && Math.max(...ox) > -97.3 && Math.min(...oy) < 35.15 && Math.max(...oy) > 35.25, "the veil covers the whole wards extent, not just the ward");
clearWardMask(m4);
console.log("ward mask geometry checks passed");

console.log("segments.test.js: all checks passed");

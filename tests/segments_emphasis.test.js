// Run from the repo root: node tests/segments_emphasis.test.js
// Card 1.9 emphasis additions to layers/segments.js: pulse, opacity scalar, ward mask.
import assert from "node:assert/strict";

const {
  addSegmentsLayer, updateSegments, setSegmentsOpacity, pulse,
  addWardMask, clearWardMask, WARD_MASK_SOURCE, WARD_MASK_LAYER,
  widthExpression, lineOpacityExpression, casingOpacityExpression,
} = await import("../layers/segments.js");

function fakeMap() {
  const sources = {}, layers = [], paint = {}, calls = [];
  return {
    sources, layers, paint, calls,
    addSource(id, s) { sources[id] = { ...s }; },
    getSource(id) { return sources[id] ? { data: sources[id].data, setData: (d) => { sources[id].data = d; } } : undefined; },
    removeSource(id) { delete sources[id]; },
    addLayer: (l, before) => { const i = before ? layers.findIndex(x => x.id === before) : -1; if (i >= 0) layers.splice(i, 0, l); else layers.push(l); },
    getLayer: (id) => layers.find(l => l.id === id),
    removeLayer(id) { const i = layers.findIndex(l => l.id === id); if (i >= 0) layers.splice(i, 1); },
    setPaintProperty: (id, k, v) => { paint[`${id}.${k}`] = v; calls.push([id, k, v]); },
    getPaintProperty: (id, k) => paint[`${id}.${k}`],
    setLayoutProperty: () => {},
    setFeatureState: () => {},
  };
}

const feat = (id, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.5, 35.2], [-97.4, 35.21]] }, properties: { loc_id: id, vpd_max: 10000, ...extra } });
const segs = { type: "FeatureCollection", features: [feat("52500-1"), feat("52500-2")] };
const state = { metric: "combined", selectedLocId: null, ward: 2, includeCollectors: false, reducedMotion: true };

// ---- setSegmentsOpacity: crossfade-style opacity scalar on top of the current state ----
const m1 = fakeMap();
addSegmentsLayer(m1, segs);
updateSegments(m1, state, { type: "FeatureCollection", features: [feat("52500-1", { combined_active: 12.5 }), feat("52500-2", { combined_active: 3 })] });
setSegmentsOpacity(m1, 0.35);
assert.deepEqual(m1.paint["segments-line.line-opacity"], lineOpacityExpression({ ward: 2, includeCollectors: false }, 0.35), "line opacity is the existing expression with k applied");
assert.equal(m1.paint["segments-line.line-opacity"][1], 0.35, "k multiplies the whole opacity case");
assert.deepEqual(m1.paint["segments-casing.line-opacity"], casingOpacityExpression({ ward: 2, includeCollectors: false }, 0.9 * 0.35), "casing scales by the same factor");
setSegmentsOpacity(m1, 1);
assert.equal(m1.paint["segments-line.line-opacity"][1], 1, "k=1 restores the full expression");
const m1b = fakeMap();
addSegmentsLayer(m1b, segs);
setSegmentsOpacity(m1b, 0.5);
assert.equal(m1b.paint["segments-line.line-opacity"][1], 0.5, "works before any updateSegments (base state fallback)");
console.log("setSegmentsOpacity checks passed");

// ---- pulse: line-width on segments-selected goes 1.0x -> 1.6x and back, twice, then restores ----
const m2 = fakeMap();
addSegmentsLayer(m2, segs);
const base = m2.getLayer("segments-selected").paint["line-width"];
assert.deepEqual(base, widthExpression(2), "the pulse layer's resting width is the module expression");
let durationSeen = null;
const driveTween = ({ duration, onUpdate, onDone }) => {
  durationSeen = duration;
  for (const t of [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]) onUpdate(t);
  if (onDone) onDone();
  return () => {};
};
const cancel1 = pulse(m2, ["52500-1", "52500-2"], { reduced: false, tween: driveTween });
assert.equal(typeof cancel1, "function", "pulse returns a cancel function");
assert.equal(durationSeen, 1400, "1.4 s total");
const widthCalls = m2.calls.filter(([id, k]) => id === "segments-selected" && k === "line-width").map(([, , v]) => v);
assert.equal(widthCalls.length, 10, "one width write per tween step plus the restore");
const factors = widthCalls.slice(0, 9).map(v => { assert.equal(v[0], "*"); return v[1]; });
for (const f of factors) assert.ok(f >= 1 && f <= 1.6 + 1e-9, `factor ${f} stays inside 1.0x..1.6x`);
const peaks = factors.map((f, i) => ({ f, i })).filter(({ f, i }) => f > 1.59 && (i === 0 || f >= factors[i - 1]) && (i === factors.length - 1 || f >= factors[i + 1]));
assert.equal(peaks.length, 2, "the width peaks twice (two pulses)");
assert.ok(Math.abs(factors[2] - 1.6) < 1e-9 && Math.abs(factors[6] - 1.6) < 1e-9, "peaks land at the quarter and three-quarter marks");
assert.deepEqual(widthCalls[widthCalls.length - 1], base, "the original width expression is restored at the end");
for (const v of widthCalls.slice(0, 9)) assert.deepEqual(v[2], base, "every tweened width scales the original expression, never a new curve");
console.log("pulse checks passed");

// pulse cancel: mid-pulse cancel restores the resting width at once.
const m3 = fakeMap();
addSegmentsLayer(m3, segs);
let saved = null;
const lazyTween = ({ onUpdate, onDone }) => { saved = { onUpdate, onDone }; return () => { saved.cancelled = true; }; };
const cancel2 = pulse(m3, ["52500-1"], { reduced: false, tween: lazyTween });
saved.onUpdate(0.25);
assert.equal(m3.paint["segments-selected.line-width"][1], 1.6, "mid-pulse the width is at the peak");
cancel2();
assert.deepEqual(m3.paint["segments-selected.line-width"], widthExpression(2), "cancel restores the resting width");
saved.onUpdate(0.75);
assert.deepEqual(m3.paint["segments-selected.line-width"], widthExpression(2), "after cancel the tween is dead");
console.log("pulse cancel checks passed");

// reduced motion: pulse is a no-op.
const m4 = fakeMap();
addSegmentsLayer(m4, segs, { reducedMotion: true });
const cancel3 = pulse(m4, ["52500-1"], { reduced: true, tween: driveTween });
assert.equal(typeof cancel3, "function");
assert.equal(m4.calls.filter(([id, k]) => id === "segments-selected" && k === "line-width").length, 0, "reduced motion: no width writes");
console.log("pulse reduced-motion checks passed");

// ---- ward mask: a fill over everything outside the ward, built as a polygon with the ward as a hole ----
const ward = { type: "Feature", properties: { Ward_num: 3 }, geometry: { type: "Polygon", coordinates: [[[-97.5, 35.15], [-97.4, 35.15], [-97.4, 35.25], [-97.5, 35.25], [-97.5, 35.15]]] } };
const other = { type: "Feature", properties: { Ward_num: 4 }, geometry: { type: "Polygon", coordinates: [[[-97.4, 35.15], [-97.3, 35.15], [-97.3, 35.25], [-97.4, 35.25], [-97.4, 35.15]]] } };
const wardsFc = { type: "FeatureCollection", features: [ward, other] };
const m5 = fakeMap();
addSegmentsLayer(m5, segs);
addWardMask(m5, ward, wardsFc);
assert.equal(WARD_MASK_SOURCE, "ward-mask");
assert.equal(WARD_MASK_LAYER, "ward-mask");
assert.equal(m5.getLayer("ward-mask").type, "fill");
assert.equal(m5.getLayer("ward-mask").source, "ward-mask");
assert.equal(m5.getLayer("ward-mask").paint["fill-color"], "#f6f4ee", "paper veil (caller may restyle for present/dusk)");
assert.equal(m5.getLayer("ward-mask").paint["fill-opacity"], 0.45, "45 percent paper");
const maskGeom = m5.sources["ward-mask"].data.features[0].geometry;
assert.equal(maskGeom.type, "Polygon", "one polygon: outer extent with the ward cut out");
assert.equal(maskGeom.coordinates.length, 2, "outer ring plus one hole");
const outer = maskGeom.coordinates[0], hole = maskGeom.coordinates[1];
const xs = outer.map(p => p[0]), ys = outer.map(p => p[1]);
assert.ok(Math.min(...xs) < -97.5 && Math.max(...xs) > -97.3 && Math.min(...ys) < 35.15 && Math.max(...ys) > 35.25, "outer ring covers the wards union extent with margin");
const ringKey = (r) => r.map(p => p.join(",")).join("|");
const wardRing = ward.geometry.coordinates[0];
assert.ok(ringKey(hole) === ringKey(wardRing) || ringKey(hole) === ringKey([...wardRing].reverse()), "the hole is the ward boundary (orientation aside)");
const maskIdx = m5.layers.findIndex(l => l.id === "ward-mask");
const casingIdx = m5.layers.findIndex(l => l.id === "segments-casing");
assert.ok(maskIdx >= 0 && maskIdx < casingIdx, "the veil sits under the segment lines so data stays crisp");
addWardMask(m5, other, wardsFc);
assert.equal(m5.layers.filter(l => l.id === "ward-mask").length, 1, "re-masking updates the data, never re-adds the layer");
assert.equal(m5.sources["ward-mask"].data.features[0].geometry.coordinates.length, 2);
console.log("addWardMask checks passed");

clearWardMask(m5);
assert.equal(m5.getLayer("ward-mask"), undefined, "clear removes the layer");
assert.equal(m5.getSource("ward-mask"), undefined, "clear removes the source");
clearWardMask(m5);
clearWardMask(fakeMap());
console.log("clearWardMask checks passed");

console.log("segments_emphasis.test.js: all checks passed");

// Run from the repo root: node dashboard/tests/layers.test.js
// A fake map records the sources and layers each module adds; no Mapbox needed.
import assert from "node:assert/strict";

export function fakeMap() {
  const sources = {}, layers = [], paint = {}, filters = {}, states = [];
  return {
    sources, layers, paint, filters, states,
    addSource: (id, s) => { sources[id] = s; },
    getSource: (id) => sources[id] ? { setData: (d) => { sources[id].data = d; } } : undefined,
    addLayer: (l) => { layers.push(l); },
    getLayer: (id) => layers.find(l => l.id === id),
    setPaintProperty: (id, k, v) => { paint[`${id}.${k}`] = v; },
    setFilter: (id, f) => { filters[id] = f; },
    setFeatureState: (ref, st) => { states.push([ref.id, st]); },
  };
}

const wards = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, properties: { Ward_num: 3 } }] };
const { addWardsLayer, updateWards } = await import("../layers/wards.js");
const m1 = fakeMap();
addWardsLayer(m1, wards);
assert.deepEqual(m1.layers.map(l => l.id), ["wards-fill", "wards-line", "wards-label"]);
assert.equal(m1.sources.wards.type, "geojson");
updateWards(m1, { ward: 3 });
assert.deepEqual(m1.paint["wards-fill.fill-opacity"], ["case", ["==", ["get", "Ward_num"], 3], 0.16, 0.03]);
updateWards(m1, { ward: null });
assert.equal(m1.paint["wards-fill.fill-opacity"], 0.10);
console.log("wards layer checks passed");

const { addSegmentsLayer, updateSegments } = await import("../layers/segments.js");
const segs = { type: "FeatureCollection", features: [] };
const m2 = fakeMap();
addSegmentsLayer(m2, segs);
assert.deepEqual(m2.layers.map(l => l.id), ["segments-casing", "segments-line", "segments-shared", "segments-selected"]);
assert.equal(m2.sources.segments.promoteId, "loc_id");
updateSegments(m2, { metric: "v_c", selectedLocId: "52500-1" }, segs);
const color = m2.paint["segments-line.line-color"];
assert.equal(color[0], "step"); assert.ok(color.includes(0.5) && color.includes(1.0), "v/c breaks applied");
assert.deepEqual(m2.states.at(-1), ["52500-1", { selected: true }]);
updateSegments(m2, { metric: "combined", selectedLocId: null }, segs);
assert.deepEqual(m2.states.at(-1), ["52500-1", { selected: false }]);
assert.ok(m2.paint["segments-line.line-color"].includes(100), "combined breaks applied");
console.log("segments layer checks passed");

const { addCollisionsLayer, updateCollisions } = await import("../layers/collisions.js");
const { addPointsLayer } = await import("../layers/points.js");
const m3 = fakeMap();
addCollisionsLayer(m3, { type: "FeatureCollection", features: [] }, { yearMin: 2021, yearMax: 2025 });
assert.deepEqual(m3.layers.map(l => l.id), ["collisions-heat", "collisions-dots"]);
assert.deepEqual(m3.layers[0].filter, ["all", [">=", ["get", "year"], 2021], ["<=", ["get", "year"], 2025]]);
assert.equal(m3.layers[0].type, "heatmap"); assert.equal(m3.layers[1].type, "circle");
updateCollisions(m3, { yearMin: 2016, yearMax: 2019 });
assert.deepEqual(m3.filters["collisions-dots"], ["all", [">=", ["get", "year"], 2016], ["<=", ["get", "year"], 2019]]);
addPointsLayer(m3, { type: "FeatureCollection", features: [] });
assert.equal(m3.layers.at(-1).id, "count-points");
console.log("collisions and points layer checks passed");

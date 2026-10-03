// Run from the repo root: node dashboard/tests/expressions.test.js
// Mapbox GL JS accepts ["zoom"] only as the input of a top level "step" or "interpolate" (optionally wrapped in
// "let" or "coalesce"). A zoom curve nested inside "case", "+", "match" or any other operator makes the whole layer
// invalid: map.addLayer logs an error and never adds it. The Playwright stub does not validate, so this test does.
import assert from "node:assert/strict";
import { fakeMap } from "./layers.test.js";

const isZoom = (e) => Array.isArray(e) && e[0] === "zoom";
const isCurve = (e) => Array.isArray(e) && (e[0] === "step" || e[0] === "interpolate");
// Returns a list of problems for one expression value.
export function zoomPlacementProblems(value, path = "") {
  const out = [];
  const walk = (e, top, p) => {
    if (!Array.isArray(e)) return;
    if (isZoom(e)) { if (!top) out.push(`${p}: ["zoom"] is not the input of a top level step or interpolate`); return; }
    const op = e[0];
    if (isCurve(e)) {
      const inputIndex = op === "step" ? 1 : 2;
      e.forEach((child, i) => walk(child, top && i === inputIndex, `${p}/${op}[${i}]`));
      return;
    }
    const passthrough = op === "let" || op === "coalesce";
    e.forEach((child, i) => { if (i > 0) walk(child, top && passthrough, `${p}/${op}[${i}]`); });
  };
  walk(value, true, path);
  return out;
}

assert.deepEqual(zoomPlacementProblems(["interpolate", ["linear"], ["zoom"], 10, 1, 16, 5]), []);
assert.deepEqual(zoomPlacementProblems(["interpolate", ["linear"], ["zoom"], 10, ["+", 1, ["case", true, 2, 0]], 16, 5]), [], "data expressions inside the curve's outputs are fine");
assert.equal(zoomPlacementProblems(["case", true, ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 5], 1]).length, 1, "a zoom curve inside a case is refused");
assert.equal(zoomPlacementProblems(["+", ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 5], 2]).length, 1, "a zoom curve inside an arithmetic operator is refused");
assert.deepEqual(zoomPlacementProblems(["coalesce", ["step", ["zoom"], 1, 12, 2], 1]), [], "let and coalesce may wrap the curve");

const { addSegmentsLayer, updateSegments } = await import("../layers/segments.js");
const { addWardsLayer, updateWards } = await import("../layers/wards.js");
const { addCollisionsLayer } = await import("../layers/collisions.js");
const { addPointsLayer } = await import("../layers/points.js");
const feat = (id) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { loc_id: id, vpd_max: 10000, combined_active: 1, v_c_active: 0.2, collisions_active: 3 } });
const segs = { type: "FeatureCollection", features: [feat("52500-1"), feat("52500-2")] };
const wards = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { Ward_num: 3 } }] };
const m = fakeMap();
addWardsLayer(m, wards); addCollisionsLayer(m, { type: "FeatureCollection", features: [] }, { yearMin: 2021, yearMax: 2025 }); addSegmentsLayer(m, segs); addPointsLayer(m, { type: "FeatureCollection", features: [] });
updateWards(m, { ward: 3 }); updateSegments(m, { metric: "v_c", selectedLocId: "52500-1", ward: 3, includeCollectors: false }, segs);
const problems = [];
for (const l of m.layers) for (const group of ["paint", "layout"]) for (const [k, v] of Object.entries(l[group] || {})) problems.push(...zoomPlacementProblems(v, `${l.id}.${k}`));
for (const [k, v] of Object.entries(m.paint)) problems.push(...zoomPlacementProblems(v, `setPaintProperty ${k}`));
assert.deepEqual(problems, [], "every zoom curve the layers use is top level");
console.log(`expression placement checks passed (${m.layers.length} layers, ${Object.keys(m.paint).length} paint updates)`);

// Run from the repo root: node dashboard/tests/geo.test.js
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { bearing, bearingAcrossScreen, dominantBearing, lineBounds, lineMidpoint, metersBetween, metersToLine, nearestSegment, polygonCentroid, wardCentroids } from "../geo.js";

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
assert.ok(near(metersBetween([-97.43, 35.22], [-97.43, 35.23]), 1112, 2), "one hundredth of a degree of latitude is about 1.1 km");
assert.deepEqual(polygonCentroid([[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]), [1, 1], "square centroid");
const c = polygonCentroid([[0, 0], [4, 0], [4, 1], [0, 0]]); assert.ok(near(c[0], 8 / 3) && near(c[1], 1 / 3), "triangle centroid is area weighted");
assert.deepEqual(polygonCentroid([[1, 1], [1, 1], [1, 1]]), [1, 1], "degenerate ring falls back to the vertex mean");
const wc = wardCentroids({ features: [{ geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { Ward_num: 3 } }] });
assert.deepEqual(wc.features[0].geometry.coordinates, [1, 1]); assert.equal(wc.features[0].properties.name, "Ward 3");
assert.ok(near(bearing([0, 0], [0, 1]), 0) && near(bearing([0, 0], [1, 0]), 90, 0.01), "north is 0, east is 90");
assert.ok(near(dominantBearing([[0, 0], [1, 0]]), 90, 0.01) && near(dominantBearing([[1, 0], [0, 0]]), 90, 0.01), "east and west fold to the same road direction");
assert.ok(near(dominantBearing([[0, 0], [0, 1]]), 0) && near(dominantBearing([[0, 1], [0, 0]]), 0));
assert.equal(dominantBearing([[0, 0]]), 0);
assert.ok(near(bearingAcrossScreen([[0, 0], [1, 0]]), 0, 0.01), "an east west road needs no rotation");
assert.ok(near(bearingAcrossScreen([[0, 0], [0, 1]]), -90) || near(bearingAcrossScreen([[0, 0], [0, 1]]), 90), "a north south road rotates a quarter turn");
assert.ok(Math.abs(bearingAcrossScreen([[0, 0], [1, 3]])) <= 90, "rotation stays within a quarter turn");
assert.deepEqual(lineBounds([[1, 5], [3, 2], [2, 9]]), [[1, 2], [3, 9]]);
assert.deepEqual(lineMidpoint([[0, 0], [1, 1], [2, 2]]), [1, 1]);
const line = [[-97.44, 35.22], [-97.43, 35.22]];
assert.ok(metersToLine([-97.435, 35.22], line) < 1, "a point on the line is at distance zero");
assert.ok(near(metersToLine([-97.435, 35.221], line), 110.5, 1), "one thousandth of a degree north of the line is about 110 m");
const feats = [{ geometry: { coordinates: line }, properties: { loc_id: "L" } }, { geometry: { coordinates: [[-97.44, 35.25], [-97.43, 35.25]] }, properties: { loc_id: "FAR" } }];
assert.equal(nearestSegment([-97.435, 35.221], feats, 300).feature.properties.loc_id, "L");
assert.equal(nearestSegment([-97.435, 35.235], feats, 300), null, "nothing within 300 m returns null");
assert.ok(nearestSegment([-97.435, 35.235], feats, 3000).meters > 300);

const here = dirname(fileURLToPath(import.meta.url));
const real = join(here, "..", "data", "wards.geojson");
if (existsSync(real)) {
  const wards = JSON.parse(readFileSync(real, "utf8"));
  const cents = wardCentroids(wards);
  assert.equal(cents.features.length, 8);
  for (const f of cents.features) { const [x, y] = f.geometry.coordinates; assert.ok(x > -97.7 && x < -97.2 && y > 35.1 && y < 35.35, `centroid for ${f.properties.name} is inside Norman`); }
  const segs = JSON.parse(readFileSync(join(here, "..", "data", "segments.geojson"), "utf8"));
  const main = segs.features.find(f => f.properties.loc_id === "52500-158");
  assert.ok(Math.abs(bearingAcrossScreen(main.geometry.coordinates)) < 15, "W Main St runs east west, so it needs little rotation");
  const mid = lineMidpoint(main.geometry.coordinates);
  assert.equal(nearestSegment(mid, segs.features, 300).feature.properties.loc_id, "52500-158", "a point on W Main St finds W Main St");
  console.log("geo real-data checks passed");
}
console.log("geo checks passed");

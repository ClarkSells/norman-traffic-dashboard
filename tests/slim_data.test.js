// Run from the repo root: node tests/slim_data.test.js
// Covers CONTRACTS.md C.12: coordinates rounded to 5 decimals, properties
// { y, c, l? } with c in a/s/n/r/x, l omitted when there is no loc id.
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { round5, codeFor, slimFeature, slimCollection, serialize, buildMeta } from "../scripts/slim-data.mjs";

// Five feature fixture: one per real category plus one unknown category.
const fixture = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.4399191, 35.22115849] }, properties: { year: 2021, loc_id: "52500-158", cat: "assigned", assigned: true } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.4234812, 35.24734281] }, properties: { year: 2022, loc_id: null, cat: "shared_intersection_resolved", assigned: false } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.44994123, 35.23292999] }, properties: { year: 2023, loc_id: null, cat: "on_road_no_segment", assigned: false } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.48837111, 35.23292123] }, properties: { year: 2024, loc_id: "52500-84", cat: "road_not_counted", assigned: false } },
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.46137444, 35.18625222] }, properties: { year: 2025, loc_id: null, cat: "mystery_cat", assigned: false } },
  ],
};

const slim = slimCollection(fixture);

// Feature count preserved: five in, five out.
assert.equal(slim.type, "FeatureCollection");
assert.equal(slim.features.length, 5, "feature count preserved");

// Rounding: coordinates rounded to 5 decimals.
assert.deepEqual(slim.features[0].geometry.coordinates, [-97.43992, 35.22116], "coordinates rounded to 5 decimals");
for (const f of slim.features) {
  for (const v of f.geometry.coordinates) assert.equal(v, round5(v), "no coordinate keeps more than 5 decimals");
}

// Code mapping: assigned -> a, shared_intersection_resolved -> s,
// on_road_no_segment -> n, road_not_counted -> r, anything else -> x.
assert.deepEqual(slim.features.map((f) => f.properties.c), ["a", "s", "n", "r", "x"], "C.12 category codes");
assert.equal(codeFor("assigned"), "a");
assert.equal(codeFor("anything_unlisted"), "x");

// Years carried through as numbers under the short key.
assert.deepEqual(slim.features.map((f) => f.properties.y), [2021, 2022, 2023, 2024, 2025]);

// Null dropping: l omitted when there is no loc id, kept when present.
assert.ok(!("l" in slim.features[1].properties), "null loc_id drops the l key");
assert.ok(!("l" in slim.features[4].properties), "missing loc id drops the l key");
assert.equal(slim.features[0].properties.l, "52500-158");
assert.equal(slim.features[3].properties.l, "52500-84");

// Properties are exactly { y, c, l? } in a stable key order; verbose keys are gone.
assert.deepEqual(Object.keys(slim.features[0].properties), ["y", "c", "l"]);
assert.deepEqual(Object.keys(slim.features[2].properties), ["y", "c"]);
assert.deepEqual(Object.keys(slim.features[0]), ["type", "geometry", "properties"]);

// Idempotence: already slim features stay stable and the serialized bytes are identical.
const twice = slimCollection(slim);
assert.deepEqual(twice, slim, "slimming a slim collection is a fixed point");
assert.equal(serialize(twice), serialize(slim), "second run is byte identical");
assert.deepEqual(slimFeature(slim.features[0]), slim.features[0], "single slim feature passes through unchanged");

// Rows the pipeline flagged outside the 2021-2025 analysis window are dropped
// (they are what puts the file over the byte budget; see facts.js year_min/year_max).
const withOutside = {
  type: "FeatureCollection",
  features: [
    ...fixture.features,
    { type: "Feature", geometry: { type: "Point", coordinates: [-97.4, 35.2] }, properties: { year: 2018, loc_id: null, cat: "outside_year_window", assigned: false } },
  ],
};
assert.equal(slimCollection(withOutside).features.length, 5, "outside_year_window rows are dropped");

// Meta file shape: { features, years: [min, max], bytes, gzipBytes, writtenAt }.
const text = serialize(slim);
const bytes = Buffer.byteLength(text, "utf8");
const gz = gzipSync(text).length;
const meta = buildMeta(slim, bytes, gz, new Date("2026-02-07T12:00:00.000Z"));
assert.deepEqual(meta, { features: 5, years: [2021, 2025], bytes, gzipBytes: gz, writtenAt: "2026-02-07T12:00:00.000Z" });
assert.equal(meta.features, slim.features.length, "feature count equals the meta file");

console.log("slim_data checks passed");

// Run from the repo root: node dashboard/tests/hash.test.js
import assert from "node:assert/strict";
import { hashToPatch, stateToHash, writeHash } from "../hash.js";

const full = { ward: 2, metric: "combined", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: false, selectedLocId: "52500-158", basemap: "light" };
assert.equal(stateToHash(full, 10), "#ward=2&metric=combined&los=E&years=2021-2025&sel=52500-158&tour=10", "the documented deep link form");
assert.equal(stateToHash({ ...full, ward: null, selectedLocId: null }), "#metric=combined&los=E&years=2021-2025", "defaults keep the hash short");
assert.equal(stateToHash({ ...full, includeCollectors: true, basemap: "satellite", metric: "v_c", los: "C" }), "#ward=2&metric=v_c&los=C&years=2021-2025&collectors=1&sel=52500-158&basemap=satellite");

// Round trip: every key survives
const { patch, tour } = hashToPatch(stateToHash({ ...full, includeCollectors: true, basemap: "satellite" }, 12));
assert.deepEqual(patch, { ward: 2, metric: "combined", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: true, selectedLocId: "52500-158", basemap: "satellite" });
assert.equal(tour, 12);
assert.deepEqual(hashToPatch(stateToHash({ ...full, ward: null, selectedLocId: null })).patch, { metric: "combined", los: "E", yearMin: 2021, yearMax: 2025 });
for (const st of [full, { ...full, ward: 8, metric: "collisions", los: "C", yearMin: 2016, yearMax: 2026 }]) {
  const back = hashToPatch(stateToHash(st, 3)).patch;
  assert.equal(stateToHash({ ...st, ...back }, 3), stateToHash(st, 3), "hash -> patch -> hash is stable");
}
// Malformed or hostile input is ignored key by key
assert.deepEqual(hashToPatch("").patch, {}); assert.equal(hashToPatch("").tour, null);
assert.deepEqual(hashToPatch("#ward=9&metric=nope&los=X&years=abc&sel=<script>&tour=0&basemap=mars").patch, {});
assert.equal(hashToPatch("#tour=0").tour, null);
assert.deepEqual(hashToPatch("#ward=all&years=2025-2021").patch, { ward: null, yearMin: 2021, yearMax: 2025 }, "ward=all clears, reversed years are swapped");
assert.deepEqual(hashToPatch("ward=3").patch, { ward: 3 }, "leading # optional");
assert.deepEqual(hashToPatch("#collectors=true").patch, { includeCollectors: true });
assert.deepEqual(hashToPatch("#sel=52500-1%2F").patch, {}, "selection ids are plain tokens");
// writeHash uses replaceState and is a no-op without a browser
writeHash(full, null);
const calls = []; globalThis.location = { hash: "" }; globalThis.history = { replaceState: (_, __, h) => { calls.push(h); globalThis.location.hash = h; } };
writeHash(full, 2); writeHash(full, 2);
assert.deepEqual(calls, ["#ward=2&metric=combined&los=E&years=2021-2025&sel=52500-158&tour=2"], "written once; unchanged hash is not rewritten");
console.log("hash checks passed");

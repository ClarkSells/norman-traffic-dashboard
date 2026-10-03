// Run from the repo root: node dashboard/tests/caveats.test.js
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import { CAVEATS, DUPLICATE_PAIR_IDS, FALLBACK_GEOMETRY_IDS, caveatsFor, hasCaveat } from "../caveats.js";

assert.equal(FALLBACK_GEOMETRY_IDS.length, 6);
assert.deepEqual(DUPLICATE_PAIR_IDS, ["52500-240", "52500-241"]);
assert.equal(caveatsFor("52500-1").length, 0, "clean segment has no caveat");
assert.ok(!hasCaveat("52500-1"));
assert.equal(caveatsFor("52500-76").length, 1); assert.ok(caveatsFor("52500-76")[0].includes("800 meter window"));
assert.equal(caveatsFor("52500-133").length, 2, "52500-133 is fallback geometry and a spot check failure");
assert.ok(caveatsFor("52500-240")[0].includes("52500-241") && caveatsFor("52500-241")[0].includes("52500-240"), "the pair point at each other");
assert.ok(caveatsFor("52500-71")[0].includes("CLASSEN BLVD") && caveatsFor("52500-71")[0].includes("no cross street"));
assert.ok(caveatsFor("52500-115")[0].includes("Ward 8"));
assert.ok(caveatsFor("52500-192")[0].includes("FY21"));
for (const t of Object.values(CAVEATS)) {
  assert.ok(!t.includes("—") && !t.includes(" - "), "no em dashes in caveats");
  assert.ok(t.split(/\s+/).length <= 120);
}
// Every caveat id exists in the real segments file when it is present.
const here = dirname(fileURLToPath(import.meta.url));
const real = join(here, "..", "data", "segments.geojson");
if (existsSync(real)) {
  const ids = new Set(JSON.parse(readFileSync(real, "utf8")).features.map(f => f.properties.loc_id));
  for (const id of [...FALLBACK_GEOMETRY_IDS, ...DUPLICATE_PAIR_IDS, "52500-71", "52500-115", "52500-192"]) assert.ok(ids.has(id), `${id} exists in segments.geojson`);
  const fb = JSON.parse(readFileSync(real, "utf8")).features.filter(f => f.properties.geom_source === "fallback_window").map(f => f.properties.loc_id).sort();
  assert.deepEqual(fb, [...FALLBACK_GEOMETRY_IDS].sort(), "fallback list matches the data");
}
console.log("caveat checks passed");

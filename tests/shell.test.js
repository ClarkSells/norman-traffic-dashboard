// Run from the repo root: node dashboard/tests/shell.test.js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import * as cfg from "../config.js";
import { getState, setState, subscribe } from "../state.js";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");
for (const id of ["map", "panel", "ward-select", "metric-toggle", "los-toggle", "year-min", "year-max", "show-collectors", "stats", "rank-table", "legend", "basemap-toggle"]) {
  assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
}
assert.ok(html.includes("mapbox-gl.js") && html.includes('type="module" src="app.js"'), "mapbox script and module entry present");
assert.equal(cfg.RAMP.length, 5); assert.equal(cfg.BLUE_RAMP.length, 5); assert.equal(Object.keys(cfg.WARD_COLORS).length, 8);
assert.deepEqual(cfg.BREAKS.v_c, [0.5, 0.7, 0.9, 1.0]);
assert.ok(cfg.STYLES.light.startsWith("mapbox://") && cfg.STYLES.satellite.startsWith("mapbox://"));
let seen = null; const off = subscribe((s, patch) => { seen = patch; });
setState({ metric: "v_c" });
assert.equal(getState().metric, "v_c"); assert.deepEqual(seen, { metric: "v_c" }); off();
assert.deepEqual(Object.keys(getState()).sort(), ["basemap", "includeCollectors", "los", "metric", "selectedLocId", "ward", "yearMax", "yearMin"]);
console.log("shell checks passed");

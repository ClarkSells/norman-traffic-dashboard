// Run from the repo root: node dashboard/tests/shell.test.js
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
import * as cfg from "../config.js";
import { getState, setState, subscribe } from "../state.js";

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, "..", "index.html"), "utf8");
for (const id of ["map", "panel", "layout", "ward-select", "metric-toggle", "los-toggle", "year-min", "year-max", "show-collectors", "stats", "rank-table", "legend", "basemap-toggle",
                  "help-toggle", "help-box", "loading", "loading-text", "loading-reload", "panel-toggle"]) {
  assert.ok(html.includes(`id="${id}"`), `index.html is missing #${id}`);
}
assert.ok(html.includes("mapbox-gl.js") && html.includes('type="module" src="app.js"'), "mapbox script and module entry present");
assert.ok(html.includes('aria-controls="help-box"') && html.includes('aria-expanded="false"'), "help toggle announces its state");
assert.ok(html.includes('id="loading" role="status"'), "loading card is announced to screen readers");
assert.ok(html.includes('aria-label="First collision year"') && html.includes('aria-label="Last collision year"'), "year selects are labelled");
assert.equal((html.match(/aria-pressed="true"/g) || []).length, 2, "one pressed button per segmented control");
const css = readFileSync(join(here, "..", "style.css"), "utf8");
assert.ok(css.includes(":focus-visible"), "visible keyboard focus styles");
assert.ok(css.includes("tbody tr:focus-visible"), "table rows show focus");
assert.ok(css.includes("@media (max-width: 800px)") && css.includes(".layout.panel-collapsed"), "narrow screens stack and can collapse the panel");
assert.ok(css.includes(".loading[hidden] { display: none; }"), "hidden attribute wins over display:flex on the loading card");
assert.equal(cfg.RAMP.length, 5); assert.equal(cfg.BLUE_RAMP.length, 5); assert.equal(Object.keys(cfg.WARD_COLORS).length, 8);
assert.deepEqual(cfg.BREAKS.v_c, [0.5, 0.7, 0.9, 1.0]);
assert.ok(cfg.STYLES.light.startsWith("mapbox://") && cfg.STYLES.satellite.startsWith("mapbox://"));
let seen = null; const off = subscribe((s, patch) => { seen = patch; });
setState({ metric: "v_c" });
assert.equal(getState().metric, "v_c"); assert.deepEqual(seen, { metric: "v_c" }); off();
assert.deepEqual(Object.keys(getState()).sort(), ["basemap", "includeCollectors", "los", "metric", "selectedLocId", "ward", "yearMax", "yearMin"]);
console.log("shell checks passed");

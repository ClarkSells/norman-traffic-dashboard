// Run from the repo root: node dashboard/tests/app.test.js  (static checks only; the browser is the real test)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "app.js"), "utf8");
for (const imp of ["./config.js", "./data.js", "./layers/collisions.js", "./layers/points.js", "./layers/segments.js", "./layers/wards.js", "./ui/legend.js", "./ui/panel.js", "./ui/popup.js", "./state.js", "./ui/help.js", "./ui/loading.js"]) {
  assert.ok(src.includes(`from "${imp}"`), `app.js must import ${imp}`);
}
// Layer load race (commit 5b2003b): the style and the data load in parallel and whichever finishes last adds the layers.
assert.ok(src.includes("let styleReady = false;") && src.includes("let dataReady = false;"), "both readiness flags exist");
assert.ok(src.includes("if (!styleReady || !dataReady) return;"), "addAllLayers waits for the style and the data");
assert.ok(src.includes('if (map.getLayer("segments-line")) return;'), "addAllLayers is idempotent per style");
assert.ok(src.includes('map.on("style.load", () => { styleReady = true; addAllLayers(); });'), "layers are (re)added on every style.load, including after a basemap switch");
assert.ok(src.indexOf('map.on("style.load"') < src.indexOf("async function main()"), "style listener is registered before the data fetch starts");
assert.ok(/await loadAll\(\);\s*\n\s*dataReady = true;/.test(src), "dataReady flips as soon as the data arrives");
assert.ok(src.indexOf("dataReady = true;") < src.indexOf("  addAllLayers();\n  attachPopup"), "main calls addAllLayers after the data arrives");
assert.ok(src.includes("styleReady = false;\n    map.setStyle(STYLES[next]);"), "basemap switch resets styleReady right before setStyle");
// Loading overlay and failure handling
assert.ok(src.includes("initLoading();"), "loading card shown before the fetches start");
assert.ok(src.includes("hideLoading();"), "loading card hidden once the layers are added");
assert.ok(src.includes("showLoadError(err)"), "data fetch failure shows a readable message");
assert.ok(src.includes('map.on("error"'), "style failure shows a readable message");
assert.ok(src.includes("subscribe(render)"), "render must subscribe to state changes");
assert.ok(src.includes("basemap-toggle"), "satellite toggle wired");
assert.ok(src.includes("initHelp(") && src.includes("initPanelToggle()") && src.includes("initLegend("), "help box, mobile panel toggle and legend fold wired");
console.log("app.js static checks passed");

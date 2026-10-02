// Run from the repo root: node dashboard/tests/app.test.js  (static checks only; the browser is the real test)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "app.js"), "utf8");
for (const imp of ["./config.js", "./data.js", "./layers/collisions.js", "./layers/points.js", "./layers/segments.js", "./layers/wards.js", "./ui/legend.js", "./ui/panel.js", "./ui/popup.js", "./state.js"]) {
  assert.ok(src.includes(`from "${imp}"`), `app.js must import ${imp}`);
}
assert.ok(src.includes('map.on("style.load", addAllLayers)'), "layers must be re-added after a style switch");
assert.ok(src.includes("subscribe(render)"), "render must subscribe to state changes");
assert.ok(src.includes("basemap-toggle"), "satellite toggle wired");
console.log("app.js static checks passed");

// Run from the repo root: node dashboard/tests/app.test.js  (static checks only; the browser is the real test)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "app.js"), "utf8");
for (const imp of ["./config.js", "./data.js", "./layers/collisions.js", "./layers/points.js", "./layers/segments.js", "./layers/wards.js", "./ui/legend.js", "./ui/panel.js", "./ui/popup.js", "./state.js", "./ui/help.js", "./ui/loading.js", "./theme.js", "./layers/basemap.js", "./ui/tooltip.js", "./tour.js", "./ui/tour.js", "./hash.js", "./ui/sheet.js"]) {
  assert.ok(src.includes(`from "${imp}"`), `app.js must import ${imp}`);
}
// Layer load race (commit 5b2003b): the style and the data load in parallel and whichever finishes last adds the layers.
assert.ok(src.includes("let styleReady = false;") && src.includes("let dataReady = false;"), "both readiness flags exist");
assert.ok(src.includes("if (!styleReady || !dataReady) return;"), "addAllLayers waits for the style and the data");
assert.ok(src.includes('if (map.getLayer("segments-line")) return;'), "addAllLayers is idempotent per style");
assert.ok(src.includes('map.on("style.load", () => { styleReady = true; addAllLayers(); });'), "layers are (re)added on every style.load, including after a basemap switch");
assert.ok(src.indexOf('map.on("style.load"') < src.indexOf("async function main()"), "style listener is registered before the data fetch starts");
assert.ok(/await loadAll\([^)]*\);\s*\n\s*dataReady = true;/.test(src), "dataReady flips as soon as the data arrives");
assert.ok(src.indexOf("addAllLayers();", src.indexOf("dataReady = true;")) > 0, "main calls addAllLayers after the data arrives");
assert.ok(src.includes("styleReady = false;\n  map.setStyle(STYLES[next]);"), "basemap switch resets styleReady right before setStyle");
assert.equal((src.match(/map\.setStyle\(/g) || []).length, 1, "one place switches styles");
// Loading overlay and failure handling
assert.ok(src.includes("initLoading();"), "loading card shown before the fetches start");
assert.ok(src.includes("hideLoading();"), "loading card hidden once the layers are added");
assert.ok(src.includes("showLoadError(err)"), "data fetch failure shows a readable message");
assert.ok(src.includes('map.on("error"'), "style failure shows a readable message");
assert.ok(src.includes("subscribe(render)"), "render must subscribe to state changes");
assert.ok(src.includes("basemap-toggle"), "satellite toggle wired");
assert.ok(src.includes("initHelp(") && src.includes("initPanelToggle()") && src.includes("initLegend("), "help box, mobile panel toggle and legend fold wired");
assert.ok(src.includes("applyTheme(themeFor(state.basemap))"), "chrome theme follows the basemap");
assert.ok(src.includes("highlightRow(") && src.includes("setHover(map,"), "hover sync between map and table");
assert.ok(src.includes('"reset-view"'), "reset view wired");
assert.ok(src.includes("tuneBasemap(map,") && src.includes("applyMapTheme("), "basemap labels tuned and map chrome themed on every style load");
assert.ok(src.includes("reducedMotion:"), "prefers-reduced-motion read into state");
assert.ok(src.includes("wardCameraOptions(") && src.includes("segmentCameraOptions(") && src.includes("resetCameraOptions("), "camera choreography from motion.js");
assert.ok(src.includes("bearingAcrossScreen("), "segment camera aligns to the road");
assert.ok(src.includes("loadAll(setProgress)"), "fetch progress feeds the bar");
assert.ok(!src.includes("essential: true"), "essential is left unset so Mapbox honours prefers-reduced-motion");
assert.ok(src.includes("initTourPlayer(") && src.includes("buildTour(") && src.includes("applyStep: applyTourStep"), "Present mode wired");
assert.ok(src.includes("readHash()") && src.includes("writeHash(state,"), "deep links restored and written");
assert.ok(src.includes('addEventListener("hashchange"'), "hash edits apply live");
assert.ok(src.includes("new mapboxgl.FullscreenControl(") && src.includes("new mapboxgl.GeolocateControl("), "fullscreen and geolocate controls");
assert.ok(src.includes("nearestSegment(") && src.includes("300)"), "locate selects the nearest segment within 300 m");
assert.ok(src.includes("initSheet("), "bottom sheet wired");
assert.ok(src.includes('map.on("mousemove", "segments-line"') && src.includes("showTooltip(") && src.includes("setPointHover("), "hover tooltip and point hover");
console.log("app.js static checks passed");

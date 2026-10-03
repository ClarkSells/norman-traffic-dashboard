// Run from the repo root: node dashboard/tests/app.test.js  (static checks only; the browser is the real test)
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "app.js"), "utf8");
for (const imp of ["./config.js", "./data.js", "./layers/collisions.js", "./layers/points.js", "./layers/segments.js", "./layers/wards.js", "./layers/flow.js", "./layers/callouts.js", "./ui/legend.js", "./ui/panel.js", "./ui/popup.js", "./state.js", "./ui/help.js", "./ui/loading.js", "./theme.js", "./layers/basemap.js", "./ui/tooltip.js", "./scenes.js", "./ui/tour.js", "./ui/present.js", "./ui/layout.js", "./ui/mapchrome.js", "./camera.js", "./hash.js", "./ui/sheet.js"]) {
  assert.ok(src.includes(`from "${imp}"`), `app.js must import ${imp}`);
}
assert.ok(!src.includes("./tour.js") && !src.includes("ui/status.js"), "the old tour and the HUD are gone");
// Layer load race (commit 5b2003b): the style and the data load in parallel and whichever finishes last adds the layers.
assert.ok(src.includes("let styleReady = false;") && src.includes("let dataReady = false;"), "both readiness flags exist");
assert.ok(src.includes("if (!styleReady || !dataReady) return;"), "addAllLayers waits for the style and the data");
assert.ok(src.includes('if (map.getLayer("segments-line")) return;'), "addAllLayers is idempotent per style");
assert.ok(src.includes('map.on("style.load",') && src.includes("addAllLayers();"), "layers are (re)added on every style.load, including after a basemap switch");
assert.ok(src.indexOf('map.on("style.load"') < src.indexOf("async function main()"), "style listener is registered before the data fetch starts");
assert.ok(/await loadAll\([^)]*\);\s*\n\s*dataReady = true;/.test(src), "dataReady flips as soon as the data arrives");
assert.ok(src.indexOf("addAllLayers();", src.indexOf("dataReady = true;")) > 0, "main calls addAllLayers after the data arrives");
assert.ok(!src.includes("map.setStyle("), "styles switch through switchBasemap (snapshot crossfade), never a bare setStyle");
// Loading overlay and failure handling
assert.ok(src.includes("initLoading();"), "loading card shown before the fetches start");
assert.ok(src.includes("hideLoading();"), "loading card hidden once the layers are added");
assert.ok(src.includes("setStage("), "staged loading copy (Preparing the map / Placing segments / Loading crash records)");
assert.ok(src.includes("showLoadError(err)"), "data fetch failure shows a readable message");
assert.ok(src.includes('map.on("error"'), "style failure shows a readable message");
assert.ok(src.includes("subscribe(render)"), "render must subscribe to state changes");
assert.ok(src.includes("basemap-toggle"), "satellite toggle wired");
assert.ok(src.includes("initHelp(") && src.includes("initPanelToggle()") && src.includes("initLegend("), "help box, mobile panel toggle and legend fold wired");
assert.ok(src.includes("highlightRow(") && src.includes("setHover(map,"), "hover sync between map and table");
assert.ok(src.includes('"reset-view"'), "reset view wired");
assert.ok(src.includes("configureStandard(map,") && src.includes("applyMapTheme("), "Standard style configured and map chrome themed on every style load");
assert.ok(src.includes("reducedMotion"), "prefers-reduced-motion read into state");
assert.ok(src.includes("dollyToSegment(") && src.includes("fitWard(") && src.includes("establish("), "camera choreography from camera.js");
assert.ok(src.includes("bearingAcrossScreen("), "segment camera aligns to the road");
assert.ok(src.includes("loadAll(setProgress)"), "fetch progress feeds the bar");
assert.ok(src.includes("preserveDrawingBuffer: true"), "canvas snapshots for the style crossfade");
assert.ok(src.includes("initTourPlayer(") && src.includes("buildScenes(") && src.includes("initPresent("), "Present mode wired: scenes, chrome, player");
assert.ok(src.includes("applyScene") && src.includes("presentationPadding("), "scenes drive state, layers and the caption-aware camera");
assert.ok(src.includes("__dash.ready = true"), "the real renderer harness gets its readiness flag");
assert.ok(src.includes("readHash()") && src.includes("writeHash(state,"), "deep links restored and written");
assert.ok(src.includes('addEventListener("hashchange"'), "hash edits apply live");
assert.ok(src.includes("new mapboxgl.FullscreenControl(") && src.includes("new mapboxgl.GeolocateControl("), "fullscreen and geolocate controls");
assert.ok(src.includes('"geolocation" in navigator'), "geolocate only when the browser can locate (B4)");
assert.ok(src.includes("nearestSegment(") && src.includes("300)"), "locate selects the nearest segment within 300 m");
assert.ok(src.includes("initSheet("), "bottom sheet wired");
assert.ok(src.includes("initLayout(") && src.includes("initMapChrome("), "layout keeper and map chrome wired");
assert.ok(src.includes('map.on("mousemove", "segments-line"') && src.includes("showTooltip(") && src.includes("setPointHover("), "hover tooltip and point hover");
assert.ok(src.includes("startFlow(") && src.includes("setHeatVisible(") && src.includes("showCallouts(") && src.includes("addWardMask("), "flow, heat, callouts and the ward mask wired");
console.log("app.js static checks passed");

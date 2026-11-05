// Run from the repo root: node tests/closure.test.js
// Closure mode layers (C.14, C.15, C.17) on a recording fake map, the popup intercept, and the popup's closure line.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
installFakeDocument();
const { CLOSED_SOURCE, CLOSURE_LAYERS, PATH_SOURCE, addClosureLayers, pathFeature, setClosure, setClosureTheme } = await import("../layers/closure.js");
const { THEMES } = await import("../theme.js");
const { MUTED } = await import("../config.js");
const { attachPopup, popupHtml } = await import("../ui/popup.js");
const { setRaw } = await import("../data.js");

function fakeMap() {
  const sources = {}, layers = [], paint = [];
  return {
    sources, layers, paint,
    addSource(id, s) { sources[id] = { data: s.data, setData(d) { sources[id].data = d; } }; },
    getSource(id) { return sources[id]; },
    addLayer(l, before) { const i = before ? layers.findIndex(x => x.id === before) : -1; if (i >= 0) layers.splice(i, 0, { ...l, beforeId: before }); else layers.push({ ...l, beforeId: before }); },
    getLayer(id) { return layers.find(l => l.id === id); },
    setPaintProperty(id, k, v) { paint.push([id, k, v]); },
  };
}
const impact = { detour_loc_ids: ["B"], added_vpd: { B: 14200 }, vc_after: { B: 0.81 }, path: [[-97.44, 35.22], [-97.435, 35.225], [-97.43, 35.22]], detour_len_mi: 2.1, ratio: 1.8, flagged: false, no_path: false };
const closedFeature = { type: "Feature", properties: { loc_id: "A", on_road: "W Main St", vpd_max: 31886 }, geometry: { type: "LineString", coordinates: [[-97.44, 35.22], [-97.43, 35.22]] } };

// pathFeature: the detour polyline, empty without a path
assert.deepEqual(pathFeature(null).features, []);
assert.deepEqual(pathFeature({ ...impact, no_path: true }).features, [], "no_path draws nothing");
assert.deepEqual(pathFeature({ ...impact, path: [[0, 0]] }).features, [], "a one point path is not a line");
const pf = pathFeature(impact);
assert.equal(pf.features.length, 1); assert.deepEqual(pf.features[0].geometry.coordinates, impact.path);
assert.deepEqual(pf.features[0].properties, { detour_len_mi: 2.1, ratio: 1.8, flagged: false });

// addClosureLayers: two sources, three layers under the selection frame, idempotent
const m = fakeMap();
m.addLayer({ id: "segments-line" }); m.addLayer({ id: "segments-selected-casing" });
addClosureLayers(m);
assert.ok(m.getSource(CLOSED_SOURCE) && m.getSource(PATH_SOURCE), "both sources added");
assert.deepEqual(m.layers.map(l => l.id), ["segments-line", "closure-closed", "closure-path-casing", "closure-path", "segments-selected-casing"], "closed segment, then the path casing and the path, all under the selection frame");
assert.deepEqual(CLOSURE_LAYERS, ["closure-closed", "closure-path-casing", "closure-path"], "contract ids");
const closed = m.getLayer("closure-closed"), path = m.getLayer("closure-path"), casing = m.getLayer("closure-path-casing");
assert.equal(closed.paint["line-color"], MUTED, "the closed segment is dim"); assert.deepEqual(closed.paint["line-dasharray"], [1.5, 2], "and dashed");
assert.equal(closed.source, CLOSED_SOURCE); assert.equal(path.source, PATH_SOURCE); assert.equal(casing.source, PATH_SOURCE);
assert.equal(path.paint["line-color"], THEMES.light.ink, "the detour is drawn in ink"); assert.equal(casing.paint["line-color"], THEMES.light["map-casing"], "over a paper casing");
for (const l of [closed, path, casing]) { assert.equal(l.slot, "top"); assert.equal(l.type, "line"); assert.equal(l.beforeId, "segments-selected-casing"); }
const n = m.layers.length; addClosureLayers(m); assert.equal(m.layers.length, n, "re-adding after a style load does not duplicate");
// a map without the selection frame yet still gets the layers (appended)
const m0 = fakeMap(); addClosureLayers(m0); assert.equal(m0.layers.length, 3); assert.equal(m0.layers[0].beforeId, undefined);

// setClosure writes the sources; null clears
setClosure(m, closedFeature, impact);
assert.deepEqual(m.getSource(CLOSED_SOURCE).data.features, [closedFeature]);
assert.deepEqual(m.getSource(PATH_SOURCE).data.features[0].geometry.coordinates, impact.path);
setClosure(m, closedFeature, null);
assert.deepEqual(m.getSource(PATH_SOURCE).data.features, [], "a closed segment with no impact entry draws no path");
setClosure(m, null, null);
assert.deepEqual(m.getSource(CLOSED_SOURCE).data.features, []); assert.deepEqual(m.getSource(PATH_SOURCE).data.features, []);
setClosure(fakeMap(), closedFeature, impact);   // no sources yet: a no-op, never a throw

// theme follows the basemap
setClosureTheme(m, "dark");
assert.deepEqual(m.paint.filter(([id]) => id === "closure-path").pop(), ["closure-path", "line-color", THEMES.dark.ink]);
assert.deepEqual(m.paint.filter(([id]) => id === "closure-path-casing").pop(), ["closure-path-casing", "line-color", THEMES.dark["map-casing"]]);
setClosureTheme(fakeMap(), "dark");   // no layer yet: no-op

// attachPopup intercept: closure mode claims the click, nothing opens, nothing selects
globalThis.mapboxgl = { Popup: class { constructor() { this.calls = []; } setLngLat(l) { this.calls.push(["lngLat", l]); return this; } setHTML() { this.calls.push(["html"]); return this; } addTo() { this.calls.push(["addTo"]); return this; } isOpen() { return false; } remove() {} getLngLat() { return null; } } };
setRaw({ segments: { type: "FeatureCollection", features: [{ ...closedFeature, properties: { ...closedFeature.properties, from_road: "x", to_road: "y", wards: [2], functional_class: "Minor Arterial", capacity_C: 22000, capacity_E: 34200, collisions_by_year: {} } }] }, wards: { features: [] }, summary: { years: [2021] }, collisions: null, points: null, closures: { A: impact } });
const handlers = {};
const pm = { on: (ev, layer, fn) => { handlers[`${ev}:${layer}`] = fn; } };
const selected = [], intercepted = [];
let armed = true;
const popup = attachPopup(pm, (id) => selected.push(id), () => true, { intercept: (id) => { if (!armed) return false; intercepted.push(id); return true; } });
const click = { features: [{ properties: { loc_id: "A" } }], lngLat: [-97.44, 35.22] };
handlers["click:segments-line"](click);
assert.deepEqual(intercepted, ["A"]); assert.deepEqual(selected, [], "intercepted: no selection"); assert.equal(popup.calls.length, 0, "intercepted: no popup");
armed = false;
handlers["click:segments-line"](click);
assert.deepEqual(selected, ["A"], "switch off: the click selects"); assert.ok(popup.calls.some(c => c[0] === "addTo"), "and opens the popup");
handlers["click:count-points"](click);
assert.deepEqual(selected, ["A", "A"], "count points share the handler");

// popup: the closed segment and a detour segment say so
const base = { loc_id: "B", on_road: "12th Ave SE", from_road: "a", to_road: "b", wards: [1], functional_class: "Minor Arterial", vpd_max: 10000, volume_year: 2023, capacity_E: 34200, capacity_C: 22000, v_c_active: 0.81, collisions_active: 3, combined_active: 3.81 };
const st = { los: "E", yearMin: 2021, yearMax: 2025, metric: "combined" };
const det = popupHtml({ ...base, closure_added: 14200, closure_from: "W Main St", v_c_before_closure: 0.52, projected: 1 }, null, st);
assert.ok(det.includes('<p class="closure">plus 14,200 vpd from the closure of W Main St, v/c 0.52 to 0.81</p>'), "detour line in the popup");
assert.ok(det.includes("projected v/c") && !det.includes("volume to capacity (v/c)"), "the v/c cell reads projected under a scenario");
assert.ok(popupHtml({ ...base, is_closed: 1, v_c_active: 0 }, null, st).includes('<span class="chip">closed in this scenario</span>'));
const plain = popupHtml(base, null, st);
assert.ok(!plain.includes("closure") && plain.includes("volume to capacity (v/c)"), "no closure chrome on an untouched segment");
assert.ok(!det.includes("—"));
console.log("closure checks passed");

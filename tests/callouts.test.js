// Run from the repo root: node tests/callouts.test.js
// Callout symbol layer (C.8): anchor table by bearing, point source writes, clear.
import assert from "node:assert/strict";

const { addCalloutLayer, showCallouts, clearCallouts, calloutAnchor, CALLOUT_SOURCE, CALLOUT_LAYER } = await import("../layers/callouts.js");

function fakeMap() {
  const sources = {}, layers = [], paint = {}, layout = {};
  return {
    sources, layers, paint, layout,
    addSource(id, s) { sources[id] = { ...s }; },
    getSource(id) { return sources[id] ? { data: sources[id].data, setData: (d) => { sources[id].data = d; } } : undefined; },
    addLayer: (l) => { layers.push(l); },
    getLayer: (id) => layers.find(l => l.id === id),
    setPaintProperty: (id, k, v) => { paint[`${id}.${k}`] = v; },
    setLayoutProperty: (id, k, v) => { layout[`${id}.${k}`] = v; },
  };
}

// calloutAnchor: the label sits beside the line, so the anchor rotates with the segment bearing.
// N-S lines (bearing near 0/180) take a side anchor; E-W lines (near 90/270) take a top/bottom anchor.
assert.equal(calloutAnchor(0), "left", "line runs north, label sits east of it");
assert.equal(calloutAnchor(20), "left");
assert.equal(calloutAnchor(44.9), "left");
assert.equal(calloutAnchor(45), "bottom", "diagonal cutoff at 45 degrees");
assert.equal(calloutAnchor(90), "bottom", "line runs east, label sits above it");
assert.equal(calloutAnchor(134), "bottom");
assert.equal(calloutAnchor(135), "right");
assert.equal(calloutAnchor(180), "right", "line runs south, label sits west of it");
assert.equal(calloutAnchor(224), "right");
assert.equal(calloutAnchor(225), "top");
assert.equal(calloutAnchor(270), "top", "line runs west, label sits below it");
assert.equal(calloutAnchor(314), "top");
assert.equal(calloutAnchor(315), "left");
assert.equal(calloutAnchor(359.9), "left");
assert.equal(calloutAnchor(-45), "left", "negative bearings normalize");
assert.equal(calloutAnchor(-90), "top", "negative bearings normalize");
assert.equal(calloutAnchor(360), "left", "360 wraps to 0");
assert.equal(calloutAnchor(405), "bottom", "bearings past 360 wrap");
console.log("calloutAnchor checks passed");

// addCalloutLayer: one empty geojson source and one symbol layer above everything (slot top).
const m1 = fakeMap();
addCalloutLayer(m1, { type: "FeatureCollection", features: [] });
assert.equal(CALLOUT_SOURCE, "callouts");
assert.equal(CALLOUT_LAYER, "callouts");
assert.equal(m1.sources.callouts.type, "geojson");
assert.deepEqual(m1.sources.callouts.data, { type: "FeatureCollection", features: [] }, "source starts empty");
const lyr = m1.getLayer("callouts");
assert.equal(lyr.type, "symbol");
assert.equal(lyr.source, "callouts");
assert.equal(lyr.slot, "top", "callouts render above basemap labels");
assert.deepEqual(lyr.layout["text-field"], ["get", "text"]);
assert.deepEqual(lyr.layout["text-anchor"], ["get", "anchor"], "anchor is per feature, from the segment bearing");
assert.deepEqual(lyr.layout["symbol-sort-key"], ["get", "rank"], "rank orders label priority");
assert.equal(lyr.layout["text-allow-overlap"], true, "callouts are the story: they never lose the collision to basemap road labels (3.1-03, 3.2-05)");
assert.equal(lyr.layout["text-ignore-placement"], true, "ranked callouts ignore other symbols' placement instead of being culled");
assert.equal(lyr.paint["text-halo-color"], "#f6f4ee", "halo in the light paper color (caller may restyle for present/dusk)");
assert.ok(lyr.paint["text-halo-width"] >= 1, "halo wide enough to read over the ramp");
assert.equal(lyr.paint["text-emissive-strength"], 1, "labels read under dusk lighting");
addCalloutLayer(m1);
assert.equal(m1.layers.filter(l => l.id === "callouts").length, 1, "idempotent: never re-added");
console.log("addCalloutLayer checks passed");

// showCallouts: writes one point feature per item at the segment midpoint, anchor derived from bearing.
const m2 = fakeMap();
showCallouts(m2, [
  { locId: "52500-1", text: "#1  W Main St", rank: 1, lngLat: [-97.44, 35.22], bearing: 90 },
  { locId: "52500-2", text: "#2  N Porter Ave", rank: 2, lngLat: [-97.45, 35.21], bearing: 10 },
]);
assert.equal(m2.getLayer("callouts") !== undefined, true, "showCallouts adds the layer when missing");
const feats = m2.sources.callouts.data.features;
assert.equal(feats.length, 2);
assert.deepEqual(feats[0].geometry, { type: "Point", coordinates: [-97.44, 35.22] }, "point at the given lngLat");
assert.equal(feats[0].properties.text, "#1  W Main St", "text-field source carries rank and road");
assert.equal(feats[0].properties.rank, 1, "symbol-sort-key source");
assert.equal(feats[0].properties.locId, "52500-1");
assert.equal(feats[0].properties.anchor, "bottom", "bearing 90 -> label above the line");
assert.equal(feats[1].properties.anchor, "left", "bearing 10 -> label beside the line");
showCallouts(m2, [{ locId: "52500-9", text: "#3  Lindsey St", rank: 3, lngLat: [-97.46, 35.2], bearing: 180 }]);
assert.equal(m2.sources.callouts.data.features.length, 1, "show replaces, it does not append");
assert.equal(m2.sources.callouts.data.features[0].properties.anchor, "right");
console.log("showCallouts checks passed");

// clearCallouts: source data back to an empty collection, layer stays put.
clearCallouts(m2);
assert.deepEqual(m2.sources.callouts.data, { type: "FeatureCollection", features: [] });
assert.equal(m2.getLayer("callouts") !== undefined, true, "clearing empties the source, the layer is not removed");
clearCallouts(fakeMap());
console.log("clearCallouts checks passed");

console.log("callouts.test.js: all checks passed");

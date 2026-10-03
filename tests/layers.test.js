// Run from the repo root: node dashboard/tests/layers.test.js
// A fake map records the sources and layers each module adds; no Mapbox needed.
import assert from "node:assert/strict";

export function fakeMap() {
  const sources = {}, layers = [], paint = {}, layout = {}, filters = {}, states = [], fs = {};
  return {
    sources, layers, paint, layout, filters, states, fs, setDataCalls: 0,
    addSource(id, s) { sources[id] = { ...s }; },
    getSource(id) { const m = this; return sources[id] ? { setData: (d) => { sources[id].data = d; m.setDataCalls++; } } : undefined; },
    addLayer: (l) => { layers.push(l); },
    getLayer: (id) => layers.find(l => l.id === id),
    setPaintProperty: (id, k, v) => { paint[`${id}.${k}`] = v; },
    setLayoutProperty: (id, k, v) => { layout[`${id}.${k}`] = v; },
    setFilter: (id, f) => { filters[id] = f; },
    setFeatureState: (ref, st) => { states.push([ref.id, st]); fs[`${ref.source}:${ref.id}`] = { ...(fs[`${ref.source}:${ref.id}`] || {}), ...st }; },
    getStyle: () => ({ layers: [...layers] }),
  };
}

const wards = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { Ward_num: 3 } }] };
const { addWardsLayer, fillOpacityFor, labelFilterFor, labelOpacityFor, setWardsTheme, updateWards, wardFilterFor } = await import("../layers/wards.js");
const m1 = fakeMap();
addWardsLayer(m1, wards);
assert.deepEqual(m1.layers.map(l => l.id), ["wards-fill", "wards-line", "wards-label"]);
assert.equal(m1.sources.wards.type, "geojson");
assert.deepEqual(m1.sources["ward-centroids"].data.features[0].geometry.coordinates, [1, 1], "labels sit at client-computed centroids");
assert.equal(m1.layers[2].source, "ward-centroids");
updateWards(m1, { ward: 3 });
assert.deepEqual(m1.filters["wards-fill"], ["==", ["get", "Ward_num"], 3], "fill filtered to the active ward");
assert.equal(m1.paint["wards-fill.fill-opacity"], 0.08, "subtle constant fill, so the transition can fade it");
assert.deepEqual(m1.filters["wards-label"], ["!=", ["get", "Ward_num"], 3], "label of the selected ward goes away");
assert.equal(m1.paint["wards-label.text-opacity"], 0.55, "other labels fade");
updateWards(m1, { ward: null });
assert.equal(m1.paint["wards-fill.fill-opacity"], 0); assert.equal(m1.paint["wards-label.text-opacity"], 1);
assert.equal(fillOpacityFor(null), 0); assert.equal(labelOpacityFor(null), 1); assert.deepEqual(wardFilterFor(null), ["==", ["get", "Ward_num"], -1]); assert.deepEqual(labelFilterFor(null), ["!=", ["get", "Ward_num"], -1]);
assert.deepEqual(m1.layers[0].paint["fill-opacity-transition"], { duration: 350 }, "paint transitions around 350 ms");
const m1r = fakeMap(); addWardsLayer(m1r, wards, { reducedMotion: true });
assert.deepEqual(m1r.layers[0].paint["fill-opacity-transition"], { duration: 0 }, "reduced motion: ward transitions are instant");
setWardsTheme(m1, "dark");
assert.equal(m1.paint["wards-line.line-color"], "#e8e6df"); assert.equal(m1.paint["wards-label.text-halo-color"], "#15171a");
console.log("wards layer checks passed");

const { addSegmentsLayer, brighten, colorExpression, inWardExpression, lineOpacityExpression, needsCrossfade, primaryExpression, pulseGradient, setHover, setSegmentsTheme, updateSegments, widthExpression } = await import("../layers/segments.js");
const feat = (id, extra = {}) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] }, properties: { loc_id: id, vpd_max: 10000, metric_value: 12.5, in_ward: 1, is_primary: 1, ...extra } });
const segs = { type: "FeatureCollection", features: [feat("52500-1"), feat("52500-2", { in_ward: 0, metric_value: null })] };
const m2 = fakeMap();
addSegmentsLayer(m2, segs);
assert.deepEqual(m2.layers.map(l => l.id), ["segments-casing", "segments-selected-casing", "segments-selected-gap", "segments-line-ghost", "segments-line", "segments-shared", "segments-selected"], "the selection halo and its paper gap sit under the data line; the pulse sits on top");
assert.deepEqual(m2.layers[4].paint["line-color-transition"], { duration: 350 }, "paint transitions around 350 ms");
assert.equal(m2.layers[1].paint["line-color"], "#16150f", "the selection frame is ink, not paper, so the class color inside stays visible");
assert.equal(m2.layers[2].paint["line-color"], "#fbfaf7", "a paper gap ring sits between the halo and the line");
const m2r = fakeMap(); addSegmentsLayer(m2r, segs, { reducedMotion: true });
assert.deepEqual(m2r.layers[4].paint["line-color-transition"], { duration: 0 }, "reduced motion: paint transitions are instant");
assert.equal(m2r.layers[6].layout.visibility, "none", "reduced motion: the pulse layer is hidden from the start");
assert.equal(m2.sources.segments.promoteId, "loc_id");
assert.equal(m2.sources["segments-selected"].lineMetrics, true, "selection source has line metrics for line-progress");
assert.equal(m2.layers[6].source, "segments-selected");
const w = widthExpression();
assert.equal(w[0], "interpolate"); assert.deepEqual(w[2], ["zoom"]); assert.equal(w[4][2][1], "vpd_max", "width depends on zoom and on VPD");
assert.ok(w[4][w[4].length - 1] < w[w.length - 1][w[w.length - 1].length - 1], "wider at high zoom");
const wh = widthExpression(["case", ["boolean", ["feature-state", "hover"], false], 2, 0]);
assert.deepEqual(wh[4][4], ["+", 1.2, ["case", ["boolean", ["feature-state", "hover"], false], 2, 0]], "a hover extra is added inside the zoom curve, never around it");
assert.equal(m2.layers[4].paint["line-width"][0], "interpolate", "segments-line width is a top level zoom curve (the real library refuses a case around two zoom curves)");
assert.equal(brighten("#000000", 0.5), "#808080"); assert.equal(brighten("#ffffff"), "#ffffff");
assert.deepEqual(colorExpression("v_c")[1], ["coalesce", ["feature-state", "v_c"], 0], "color reads the chosen metric from feature-state");
assert.equal(inWardExpression(null), true); assert.equal(inWardExpression(4)[0], "case"); assert.ok(JSON.stringify(inWardExpression(4)).includes('",4,"') && JSON.stringify(inWardExpression(4)).includes('["in",4,["get","wards"]]'), "ward membership handles array and JSON text forms");
assert.equal(primaryExpression(true), true); assert.deepEqual(primaryExpression(false), ["in", ["get", "functional_class"], ["literal", ["Principal Arterial", "Minor Arterial"]]]);
assert.equal(lineOpacityExpression({ ward: 2, includeCollectors: false }, 0.5)[1], 0.5, "crossfade factor multiplies the opacity");
assert.ok(needsCrossfade({ metric: "combined", ward: null, includeCollectors: false }, { metric: "v_c", ward: null, includeCollectors: false }));
assert.ok(!needsCrossfade({ metric: "combined", ward: null, includeCollectors: false }, { metric: "combined", ward: null, includeCollectors: false, los: "C" }), "LOS and year changes update in place");
assert.ok(!needsCrossfade(null, { metric: "v_c" }), "first render never fades");
updateSegments(m2, { metric: "v_c", selectedLocId: "52500-1", ward: null, includeCollectors: false }, { type: "FeatureCollection", features: [feat("52500-1", { combined_active: 12.5, v_c_active: 0.4, collisions_active: 12 }), feat("52500-2", { combined_active: null, v_c_active: null, collisions_active: 0 })] });
assert.equal(m2.setDataCalls, 1, "a state change does not replace the main source (only the one-feature selection source)");
assert.deepEqual(m2.fs["segments:52500-1"], { combined: 12.5, v_c: 0.4, collisions: 12, selected: true }, "all three metric values go to feature-state");
assert.equal(m2.fs["segments:52500-2"].combined, 0, "null metric is stored as 0 so the step expression works");
assert.equal(m2.paint["segments-line-ghost.line-opacity"][1], 0, "ghost stays hidden on the first render");
const color = m2.paint["segments-line.line-color"];
assert.equal(color[0], "case"); assert.equal(color[2][0], "step"); assert.ok(color[2].includes(0.5) && color[2].includes(1.0), "v/c breaks applied");
assert.equal(m2.sources["segments-selected"].data.features[0].properties.loc_id, "52500-1", "selected feature copied into its own source");
assert.equal(m2.paint["segments-selected.line-gradient"], undefined, "no rAF in node: pulse does not start, static casing stays");
updateSegments(m2, { metric: "combined", selectedLocId: null, ward: null, includeCollectors: false }, segs);
assert.equal(m2.paint["segments-line.line-opacity"][1], 1, "no requestAnimationFrame in node: the crossfade completes at once");
assert.deepEqual(m2.states.find(([id, st]) => id === "52500-1" && st.selected === false) !== undefined, true);
assert.equal(m2.sources["segments-selected"].data.features.length, 0);
assert.equal(m2.setDataCalls, 2);
assert.ok(m2.paint["segments-line.line-color"][2].includes(100), "combined breaks applied");
updateSegments(m2, { metric: "combined", selectedLocId: "52500-2", reducedMotion: true, ward: null, includeCollectors: false }, segs);
assert.deepEqual(m2.paint["segments-selected.line-gradient"], pulseGradient(-1), "reduced motion: gradient hidden");
assert.equal(m2.layout["segments-selected.visibility"], "none", "reduced motion: the pulse layer is hidden; the halo and the class color carry the selection");
updateSegments(m2, { metric: "combined", selectedLocId: "52500-1", reducedMotion: false, ward: null, includeCollectors: false }, segs);
assert.equal(m2.layout["segments-selected.visibility"], "visible", "motion allowed again: the pulse layer comes back");
setHover(m2, "52500-1"); assert.equal(m2.fs["segments:52500-1"].hover, true);
setHover(m2, "52500-2"); assert.equal(m2.fs["segments:52500-1"].hover, false); assert.equal(m2.fs["segments:52500-2"].hover, true);
setHover(m2, null); assert.equal(m2.fs["segments:52500-2"].hover, false);
// pulse gradient: stops strictly increase and the light sits at p
for (const p of [0, 0.1, 0.5, 0.9, 1]) { const g = pulseGradient(p); const stops = g.slice(3).filter((_, i) => i % 2 === 0); for (let i = 1; i < stops.length; i++) assert.ok(stops[i] > stops[i - 1], `stops increase at p=${p}`); assert.ok(g.includes("rgba(255,255,255,0.95)")); }
setSegmentsTheme(m2, "dark");
assert.equal(m2.paint["segments-casing.line-color"], "#ffffff", "satellite: brighter casing"); assert.equal(m2.paint["segments-casing.line-opacity"][2], 0.95); assert.equal(m2.paint["segments-selected-casing.line-color"], "#ffffff"); assert.equal(m2.paint["segments-selected-gap.line-color"], "#ffffff");
setSegmentsTheme(m2, "light");
console.log("segments layer checks passed");

const { CROSSFADE, addCollisionsLayer, circleColor, updateCollisions } = await import("../layers/collisions.js");
const { addPointsLayer, setPointHover } = await import("../layers/points.js");
const m3 = fakeMap();
addCollisionsLayer(m3, { type: "FeatureCollection", features: [] }, { yearMin: 2021, yearMax: 2025 });
assert.deepEqual(m3.layers.map(l => l.id), ["collisions-heat", "collisions-dots"]);
assert.deepEqual(m3.layers[0].filter, ["all", [">=", ["get", "year"], 2021], ["<=", ["get", "year"], 2025]]);
assert.equal(m3.layers[0].type, "heatmap"); assert.equal(m3.layers[1].type, "circle");
assert.equal(m3.layers[1].minzoom, CROSSFADE.from); assert.ok(m3.layers[0].maxzoom >= CROSSFADE.to, "heatmap outlives the crossfade");
assert.deepEqual(m3.layers[0].paint["heatmap-opacity"].slice(-4), [CROSSFADE.from, 0.75, CROSSFADE.to, 0], "heatmap fades out as dots fade in");
assert.deepEqual(m3.layers[1].paint["circle-opacity"].slice(-4), [CROSSFADE.from, 0, CROSSFADE.to, 0.85]);
assert.deepEqual(m3.layers[0].paint["heatmap-opacity-transition"], { duration: 350 });
const m3r = fakeMap(); addCollisionsLayer(m3r, { type: "FeatureCollection", features: [] }, { yearMin: 2021, yearMax: 2025, reducedMotion: true });
assert.deepEqual(m3r.layers[0].paint["heatmap-opacity-transition"], { duration: 0 }, "reduced motion: collision transitions are instant");
assert.equal(circleColor[0], "match"); assert.deepEqual(circleColor[1], ["get", "cat"], "dots are colored by the assignment category the geojson carries");
assert.ok(circleColor.includes("assigned") && circleColor.includes("road_not_counted"));
updateCollisions(m3, { yearMin: 2016, yearMax: 2019 });
assert.deepEqual(m3.filters["collisions-dots"], ["all", [">=", ["get", "year"], 2016], ["<=", ["get", "year"], 2019]], "out of window crashes are filtered, not dimmed");
addPointsLayer(m3, { type: "FeatureCollection", features: [] });
assert.equal(m3.layers.at(-1).id, "count-points"); assert.equal(m3.layers.at(-1).minzoom, 13, "count points hidden until zoom 13");
assert.equal(m3.sources.points.promoteId, "loc_id");
assert.equal(m3.layers.at(-1).paint["circle-radius"][0], "interpolate"); assert.deepEqual(m3.layers.at(-1).paint["circle-radius"][2], ["zoom"]);
assert.deepEqual(m3.layers.at(-1).paint["circle-radius"][4], ["+", 3, ["case", ["boolean", ["feature-state", "hover"], false], 3, 0]], "markers grow on hover, inside the zoom curve");
setPointHover(m3, "52500-9"); assert.equal(m3.fs["points:52500-9"].hover, true); setPointHover(m3, null); assert.equal(m3.fs["points:52500-9"].hover, false);
console.log("collisions and points layer checks passed");

const { isStandardStyle, tuneBasemap } = await import("../layers/basemap.js");
const classic = fakeMap();
classic.getStyle = () => ({ layers: [{ id: "poi-label", type: "symbol", "source-layer": "poi_label" }, { id: "road-label", type: "symbol", "source-layer": "road" }, { id: "transit-label", type: "symbol", "source-layer": "transit_stop_label" }, { id: "settlement-label", type: "symbol", "source-layer": "place_label" }, { id: "road-primary", type: "line", "source-layer": "road" }] });
const r = tuneBasemap(classic, "light");
assert.equal(r.mode, "classic"); assert.deepEqual(r.hidden, ["poi-label", "transit-label"], "POI and transit labels hidden, road and place names kept");
assert.equal(classic.layout["road-label.visibility"], undefined);
const standard = fakeMap(); const cfg = {};
standard.getStyle = () => ({ imports: [{ id: "basemap" }], layers: [] }); standard.setConfigProperty = (i, k, v) => { cfg[k] = v; };
assert.ok(isStandardStyle(standard.getStyle()));
assert.equal(tuneBasemap(standard, "dark").mode, "standard"); assert.equal(cfg.showPointOfInterestLabels, false); assert.equal(cfg.lightPreset, "night");
assert.equal(tuneBasemap({ getStyle: () => null }).mode, "none");
console.log("basemap tuning checks passed");

const { hideTooltip, showTooltip, tooltipHtml, tooltipPosition } = await import("../ui/tooltip.js");
const html = tooltipHtml({ on_road: "W Main St", from_road: "26th Dr. W", to_road: "24th Ave.W", combined_active: 168.55, v_c_active: 0.55, collisions_active: 168 }, { metric: "combined" });
assert.ok(html.includes("W Main St") && html.includes("<strong>168.55</strong> combined score"));
assert.ok(tooltipHtml({ on_road: "x", from_road: "a", to_road: "b", collisions_active: 168 }, { metric: "collisions" }).includes("<strong>168</strong> collisions"));
assert.deepEqual(tooltipPosition({ x: 10, y: 10 }, { width: 800, height: 600 }, { width: 200, height: 50 }), { x: 22, y: 22 });
assert.deepEqual(tooltipPosition({ x: 790, y: 590 }, { width: 800, height: 600 }, { width: 200, height: 50 }), { x: 578, y: 528 }, "flips away from the edges");
const tipEl = { innerHTML: "", hidden: true, style: {}, offsetWidth: 100, offsetHeight: 40 };
showTooltip(tipEl, "<b>x</b>", { x: 5, y: 5 }, { width: 500, height: 500 }); assert.equal(tipEl.hidden, false); assert.equal(tipEl.style.transform, "translate(17px, 17px)");
hideTooltip(tipEl); assert.equal(tipEl.hidden, true); hideTooltip(null);
console.log("tooltip checks passed");

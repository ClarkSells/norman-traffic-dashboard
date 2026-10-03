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

const { CROSSFADE, HEAT_OPACITY, addCollisionsLayer, circleColor, updateCollisions, setHeatVisible, setDotsMode, revealSegmentCrashes, dimOutsideWard, yearFilter } = await import("../layers/collisions.js");
const { COLLISION_COLORS } = await import("../theme.js");
const { addPointsLayer, setPointHover } = await import("../layers/points.js");
const cpt = (y, c, l) => ({ type: "Feature", geometry: { type: "Point", coordinates: [-97.4, 35.2] }, properties: l ? { y, c, l } : { y, c } });
const crashes = { type: "FeatureCollection", features: [cpt(2021, "a", "L1"), cpt(2023, "s", "L1"), cpt(2025, "n", "L1"), cpt(2022, "r", "L2"), cpt(2024, "x")] };
const m3 = fakeMap();
addCollisionsLayer(m3, crashes, { yearMin: 2021, yearMax: 2025 });
assert.deepEqual(m3.layers.map(l => l.id), ["collisions-heat", "collisions-dots"]);
assert.equal(m3.sources.collisions.generateId, true, "feature state needs generated ids");
assert.deepEqual(m3.layers[0].filter, ["all", [">=", ["get", "y"], 2021], ["<=", ["get", "y"], 2025]], "filters read the COLL short names");
assert.equal(m3.layers[0].type, "heatmap"); assert.equal(m3.layers[1].type, "circle");
assert.equal(m3.layers[0].maxzoom, 13.6, "heat hands off to dots at 13.6");
assert.equal(m3.layers[1].minzoom, 13.0, "dots from zoom 13.0");
assert.deepEqual(CROSSFADE, { from: 13.0, to: 13.6 }, "0.6 zoom crossfade");
assert.equal(m3.layers[0].paint["heatmap-opacity"], 0.45, "supporting role heat opacity, design section 8");
assert.deepEqual(m3.layers[0].paint["heatmap-radius"], ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 18]);
assert.deepEqual(m3.layers[0].paint["heatmap-intensity"], ["interpolate", ["linear"], ["zoom"], 10, 0.3, 14, 0.8]);
const hc = m3.layers[0].paint["heatmap-color"];
assert.equal(hc[3], 0); assert.match(hc[4], /^rgba\(.+,0\)$/, "transparent below the first stop"); assert.equal(hc[5], 0.3, "first color stop at density 0.3");
assert.deepEqual(m3.layers[1].paint["circle-opacity"], ["interpolate", ["linear"], ["zoom"], 13.0, 0, 13.6, 0.85], "dots crossfade in over 0.6 zoom");
assert.deepEqual(m3.layers[0].paint["heatmap-opacity-transition"], { duration: 350 });
const m3r = fakeMap(); addCollisionsLayer(m3r, crashes, { yearMin: 2021, yearMax: 2025, reducedMotion: true, heat: false });
assert.deepEqual(m3r.layers[0].paint["heatmap-opacity-transition"], { duration: 0 }, "reduced motion: collision transitions are instant");
assert.equal(m3r.layers[0].paint["heatmap-opacity"], 0, "state.heat false starts the heat hidden");
assert.equal(circleColor[0], "match"); assert.deepEqual(circleColor[1], ["get", "c"], "dots match on the short category code");
for (const code of ["a", "s", "n", "r"]) assert.ok(circleColor.includes(code), `code ${code} mapped`);
assert.equal(circleColor[circleColor.indexOf("a") + 1], COLLISION_COLORS.assigned, "codes map back to the full name colors");
assert.equal(circleColor.at(-1), COLLISION_COLORS.on_road_no_segment, "x and unknown codes fall back to the muted color");
updateCollisions(m3, { yearMin: 2022, yearMax: 2024 });
assert.deepEqual(m3.filters["collisions-dots"], ["all", [">=", ["get", "y"], 2022], ["<=", ["get", "y"], 2024]], "out of window crashes are filtered, not dimmed");
assert.deepEqual(yearFilter({ yearMin: 2022, yearMax: 2024 }), ["all", [">=", ["get", "y"], 2022], ["<=", ["get", "y"], 2024]]);
// heat toggle fades the opacity with the injectable tween, 600 ms by default
const m3h = fakeMap(); addCollisionsLayer(m3h, crashes, { yearMin: 2021, yearMax: 2025 });
const fades = [];
const fadeTween = (opts) => { fades.push(opts.duration); opts.onUpdate(0.5); opts.onUpdate(1); if (opts.onDone) opts.onDone(); return () => {}; };
setHeatVisible(m3h, false, { tween: fadeTween });
assert.equal(m3h.paint["collisions-heat.heatmap-opacity"], 0, "heat fades out");
assert.equal(fades[0], 600, "default fade is 600 ms");
setHeatVisible(m3h, true, { fadeMs: 250, tween: fadeTween });
assert.equal(m3h.paint["collisions-heat.heatmap-opacity"], HEAT_OPACITY, "heat fades back to its supporting opacity");
assert.equal(fades[1], 250);
// dots modes: segment filters on the loc id, none hides, all restores the year window
setDotsMode(m3, "segment", { locId: "L1" });
assert.deepEqual(m3.filters["collisions-dots"], ["all", [">=", ["get", "y"], 2022], ["<=", ["get", "y"], 2024], ["==", ["get", "l"], "L1"]], "segment mode keeps the year window and filters on l");
setDotsMode(m3, "all");
assert.deepEqual(m3.filters["collisions-dots"], ["all", [">=", ["get", "y"], 2022], ["<=", ["get", "y"], 2024]], "all restores the year window");
setDotsMode(m3, "none");
assert.equal(m3.layout["collisions-dots.visibility"], "none", "none hides the dots");
setDotsMode(m3, "all");
assert.equal(m3.layout["collisions-dots.visibility"], "visible");
// crash reveal: feature state t goes 0 -> 1 over 900 ms, staggered by year (2021 first)
const m3c = fakeMap(); addCollisionsLayer(m3c, crashes, { yearMin: 2021, yearMax: 2025 });
let reveal = null;
const recTween = (opts) => { reveal = opts; return () => { opts.cancelled = true; }; };
revealSegmentCrashes(m3c, "L1", { duration: 900, tween: recTween });
assert.ok(reveal, "the reveal drives an injectable tween");
assert.equal(reveal.duration, 900, "the reveal runs 900 ms");
assert.equal(m3c.fs["collisions:0"].t, 0, "segment dots start at t 0");
const revealOpacity = m3c.paint["collisions-dots.circle-opacity"];
assert.ok(JSON.stringify(revealOpacity).includes('"feature-state","t"') && JSON.stringify(revealOpacity).includes("0.12"), "other crashes dim to 12 percent during the reveal");
reveal.onUpdate(0.3);
assert.ok(m3c.fs["collisions:0"].t > m3c.fs["collisions:1"].t && m3c.fs["collisions:1"].t > m3c.fs["collisions:2"].t, "2021 leads, later years follow");
assert.equal(m3c.fs["collisions:2"].t, 0, "the last year has not started at 30 percent");
reveal.onUpdate(1);
assert.equal(m3c.fs["collisions:2"].t, 1, "every year revealed by the end");
assert.equal(m3c.fs["collisions:3"], undefined, "other segments are untouched");
// reduced motion: dots are simply present, no tween
const m3rm = fakeMap(); addCollisionsLayer(m3rm, crashes, { yearMin: 2021, yearMax: 2025, reducedMotion: true });
revealSegmentCrashes(m3rm, "L1", { reduced: true, tween: () => { throw new Error("reduced motion must not tween"); } });
assert.equal(m3rm.fs["collisions:2"].t, 1, "reduced motion: dots are simply present");
// a second reveal clears the first; cancel restores the crossfade and stops the tween
reveal = null;
const cancelReveal = revealSegmentCrashes(m3c, "L2", { duration: 900, tween: recTween });
assert.equal(m3c.fs["collisions:0"].t, null, "the previous reveal is cleared");
assert.equal(m3c.fs["collisions:3"].t, 0, "the new segment starts at 0");
cancelReveal();
assert.ok(reveal.cancelled, "cancel stops the tween");
assert.equal(m3c.fs["collisions:3"].t, null, "cancel clears the feature state");
assert.deepEqual(m3c.paint["collisions-dots.circle-opacity"], ["interpolate", ["linear"], ["zoom"], 13.0, 0, 13.6, 0.85], "cancel restores the crossfade opacity");
// ward dimming: within expression on the ward polygon, null restores
dimOutsideWard(m3, { type: "Feature", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }, properties: { Ward_num: 3 } });
const dimmed = m3.paint["collisions-dots.circle-opacity"];
assert.ok(JSON.stringify(dimmed).includes('"within"') && JSON.stringify(dimmed).includes("0.25"), "crashes outside the ward dim to 25 percent");
dimOutsideWard(m3, null);
assert.deepEqual(m3.paint["collisions-dots.circle-opacity"], ["interpolate", ["linear"], ["zoom"], 13.0, 0, 13.6, 0.85], "null restores");
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

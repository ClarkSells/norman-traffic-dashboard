// Closure mode (CONTRACTS C.14, C.15, C.17): the closed segment drawn dashed and dim on its own layer, and the
// detour path from closure_impacts.json drawn as an ink line above the segments. The detour segments themselves
// are repainted through the scenario math in data.js (feature-state v_c), not here. Two empty sources are added
// once per style load; setClosure rewrites their data and null clears both.
import { MUTED } from "../config.js";
import { THEMES } from "../theme.js";
import { widthExpression } from "./segments.js";

export const CLOSED_SOURCE = "closure-closed";
export const PATH_SOURCE = "closure-path";
export const CLOSURE_LAYERS = ["closure-closed", "closure-path-casing", "closure-path"];
const BEFORE_ID = "segments-selected-casing";   // under the selection frame, above segments-line and the flow
const EMPTY = { type: "FeatureCollection", features: [] };

let theme = THEMES.light;
export function setClosureTheme(map, name) {
  theme = THEMES[name] || THEMES.light;
  if (!map || !map.getLayer || !map.getLayer("closure-path")) return;
  map.setPaintProperty("closure-path", "line-color", theme.ink);
  map.setPaintProperty("closure-path-casing", "line-color", theme["map-casing"]);
}

// The detour polyline as a one feature collection; empty when the pipeline found no path.
export function pathFeature(impact) {
  if (!impact || impact.no_path || !Array.isArray(impact.path) || impact.path.length < 2) return EMPTY;
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: { detour_len_mi: impact.detour_len_mi, ratio: impact.ratio, flagged: !!impact.flagged }, geometry: { type: "LineString", coordinates: impact.path } }] };
}

export function addClosureLayers(map) {
  if (!map.getSource(CLOSED_SOURCE)) map.addSource(CLOSED_SOURCE, { type: "geojson", data: EMPTY });
  if (!map.getSource(PATH_SOURCE)) map.addSource(PATH_SOURCE, { type: "geojson", data: EMPTY });
  const before = map.getLayer && map.getLayer(BEFORE_ID) ? BEFORE_ID : undefined;
  if (!map.getLayer("closure-closed")) {
    // Dashed and dim over the segment's own line (which reads v/c 0 under the closure).
    map.addLayer({ id: "closure-closed", type: "line", source: CLOSED_SOURCE, slot: "top",
      layout: { "line-cap": "butt", "line-join": "round" },
      paint: { "line-color": MUTED, "line-width": widthExpression(1), "line-dasharray": [1.5, 2], "line-opacity": 0.9, "line-emissive-strength": 1 } }, before);
  }
  if (!map.getLayer("closure-path-casing")) {
    map.addLayer({ id: "closure-path-casing", type: "line", source: PATH_SOURCE, slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": theme["map-casing"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 7, 16.5, 10], "line-opacity": 0.9 } }, before);
  }
  if (!map.getLayer("closure-path")) {
    map.addLayer({ id: "closure-path", type: "line", source: PATH_SOURCE, slot: "top",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": theme.ink, "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 14, 3, 16.5, 4.5], "line-opacity": 0.95, "line-emissive-strength": 1 } }, before);
  }
}

// closedFeature: the segment feature from segments.geojson (null clears); impact: its closure_impacts.json entry.
export function setClosure(map, closedFeature, impact) {
  const closed = map.getSource && map.getSource(CLOSED_SOURCE);
  const path = map.getSource && map.getSource(PATH_SOURCE);
  if (!closed || !path) return;
  closed.setData(closedFeature ? { type: "FeatureCollection", features: [closedFeature] } : EMPTY);
  path.setData(closedFeature ? pathFeature(impact) : EMPTY);
}

import { WARD_COLORS } from "../config.js";
import { wardCentroids } from "../geo.js";
import { THEMES } from "../theme.js";
import { DUR } from "../motion.js";

const fillColor = ["match", ["get", "Ward_num"], ...Object.entries(WARD_COLORS).flatMap(([k, v]) => [Number(k), v]), "#cccccc"];
const T = { duration: DUR.mid };
let theme = THEMES.light;

export function setWardsTheme(map, name) {
  theme = THEMES[name] || THEMES.light;
  if (!map || !map.getLayer || !map.getLayer("wards-line")) return;
  map.setPaintProperty("wards-line", "line-color", theme["ward-line"]);
  map.setPaintProperty("wards-label", "text-color", theme["ward-label"]);
  map.setPaintProperty("wards-label", "text-halo-color", theme["ward-halo"]);
}

export function addWardsLayer(map, wards) {
  if (!map.getSource("wards")) map.addSource("wards", { type: "geojson", data: wards });
  if (!map.getSource("ward-centroids")) map.addSource("ward-centroids", { type: "geojson", data: wardCentroids(wards) });
  // Subtle fill for the active ward only (a filter picks the ward, a constant opacity fades it in and out).
  map.addLayer({ id: "wards-fill", type: "fill", source: "wards", filter: ["==", ["get", "Ward_num"], -1],
    paint: { "fill-color": fillColor, "fill-opacity": 0, "fill-opacity-transition": T } });
  map.addLayer({ id: "wards-line", type: "line", source: "wards",
    paint: { "line-color": theme["ward-line"], "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.2], "line-opacity": 0.9, "line-opacity-transition": T } });
  // Labels at client-computed centroids. The selected ward's label is filtered away and the others fade.
  map.addLayer({ id: "wards-label", type: "symbol", source: "ward-centroids",
    layout: { "text-field": ["get", "name"], "text-size": ["interpolate", ["linear"], ["zoom"], 10, 12, 14, 18], "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
              "text-letter-spacing": 0.05, "text-allow-overlap": true },
    paint: { "text-color": theme["ward-label"], "text-halo-color": theme["ward-halo"], "text-halo-width": 1.4, "text-opacity": 1, "text-opacity-transition": T } });
}

export function fillOpacityFor(ward) { return ward == null ? 0 : 0.08; }
export function labelOpacityFor(ward) { return ward == null ? 1 : 0.55; }
export function wardFilterFor(ward) { return ["==", ["get", "Ward_num"], ward == null ? -1 : ward]; }
export function labelFilterFor(ward) { return ward == null ? ["!=", ["get", "Ward_num"], -1] : ["!=", ["get", "Ward_num"], ward]; }

export function updateWards(map, state) {
  if (!map.getLayer("wards-fill")) return;
  map.setFilter("wards-fill", wardFilterFor(state.ward));
  map.setPaintProperty("wards-fill", "fill-opacity", fillOpacityFor(state.ward));
  map.setPaintProperty("wards-line", "line-opacity", state.ward == null ? 0.9 : 0.6);
  if (map.getLayer("wards-label")) {
    map.setFilter("wards-label", labelFilterFor(state.ward));
    map.setPaintProperty("wards-label", "text-opacity", labelOpacityFor(state.ward));
  }
}

import { THEMES } from "../theme.js";

let theme = THEMES.light;
export function setPointsTheme(map, name) {
  theme = THEMES[name] || THEMES.light;
  if (!map || !map.getLayer || !map.getLayer("count-points")) return;
  map.setPaintProperty("count-points", "circle-color", theme.surface);
  map.setPaintProperty("count-points", "circle-stroke-color", theme.ink);
}

const HOVER = ["boolean", ["feature-state", "hover"], false];

// Count locations: small markers hidden until zoom 13, growing on hover.
export function addPointsLayer(map, points) {
  if (!map.getSource("points")) map.addSource("points", { type: "geojson", data: points, promoteId: "loc_id" });
  map.addLayer({ id: "count-points", type: "circle", source: "points", minzoom: 13,
    // The hover growth sits inside the zoom curve: ["zoom"] is only valid as the input of a top level step or interpolate.
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, ["+", 3, ["case", HOVER, 3, 0]], 17, ["+", 5, ["case", HOVER, 3, 0]]],
             "circle-color": theme.surface, "circle-stroke-color": theme.ink,
             "circle-stroke-width": ["case", HOVER, 2, 1.2],
             "circle-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, 1],
             "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.6, 1] } });
}

let hovered = null;
export function setPointHover(map, locId) {
  if (!map.getSource || !map.getSource("points")) return;
  if (hovered && hovered !== locId) map.setFeatureState({ source: "points", id: hovered }, { hover: false });
  if (locId) map.setFeatureState({ source: "points", id: locId }, { hover: true });
  hovered = locId;
}

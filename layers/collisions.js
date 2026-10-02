import { BLUE_RAMP, MUTED } from "../config.js";

function yearFilter(state) {
  return ["all", [">=", ["get", "year"], state.yearMin], ["<=", ["get", "year"], state.yearMax]];
}

export function addCollisionsLayer(map, collisions, state) {
  if (!map.getSource("collisions")) map.addSource("collisions", { type: "geojson", data: collisions });
  map.addLayer({ id: "collisions-heat", type: "heatmap", source: "collisions", maxzoom: 14, filter: yearFilter(state),
    paint: { "heatmap-weight": 1, "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 18],
             "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 14, 1.2],
             "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(134,182,239,0)",
                               0.2, BLUE_RAMP[0], 0.4, BLUE_RAMP[1], 0.6, BLUE_RAMP[2], 0.8, BLUE_RAMP[3], 1, BLUE_RAMP[4]],
             "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.7, 14, 0] } });
  map.addLayer({ id: "collisions-dots", type: "circle", source: "collisions", minzoom: 13, filter: yearFilter(state),
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 13, 2.5, 17, 5],
             "circle-color": ["case", ["==", ["get", "assigned"], true], BLUE_RAMP[2], MUTED],
             "circle-stroke-color": "#fcfcfb", "circle-stroke-width": 0.8, "circle-opacity": 0.85 } });
}

export function updateCollisions(map, state) {
  for (const id of ["collisions-heat", "collisions-dots"]) if (map.getLayer(id)) map.setFilter(id, yearFilter(state));
}

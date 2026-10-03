import { BLUE_RAMP } from "../config.js";
import { COLLISION_COLORS } from "../theme.js";
import { DUR } from "../motion.js";
const T = { duration: DUR.mid };

// Collisions outside the selected years are filtered, not dimmed.
export function yearFilter(state) {
  return ["all", [">=", ["get", "year"], state.yearMin], ["<=", ["get", "year"], state.yearMax]];
}

// Colored by assignment status (the "cat" property the pipeline writes).
export const circleColor = ["match", ["get", "cat"],
  "assigned", COLLISION_COLORS.assigned, "shared_intersection_resolved", COLLISION_COLORS.shared_intersection_resolved,
  "on_road_no_segment", COLLISION_COLORS.on_road_no_segment, "road_not_counted", COLLISION_COLORS.road_not_counted, COLLISION_COLORS.on_road_no_segment];

// Below about zoom 13 the crashes read as a density surface; above it they crossfade into individual dots.
export const CROSSFADE = { from: 12.4, to: 13.4 };

export function addCollisionsLayer(map, collisions, state) {
  if (!map.getSource("collisions")) map.addSource("collisions", { type: "geojson", data: collisions });
  map.addLayer({ id: "collisions-heat", type: "heatmap", source: "collisions", maxzoom: 14, filter: yearFilter(state),
    paint: { "heatmap-weight": 1, "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 20],
             "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 1.3],
             "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(134,182,239,0)",
                               0.2, BLUE_RAMP[0], 0.4, BLUE_RAMP[1], 0.6, BLUE_RAMP[2], 0.8, BLUE_RAMP[3], 1, BLUE_RAMP[4]],
             "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], CROSSFADE.from, 0.75, CROSSFADE.to, 0], "heatmap-opacity-transition": T } });
  map.addLayer({ id: "collisions-dots", type: "circle", source: "collisions", minzoom: CROSSFADE.from, filter: yearFilter(state),
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12.4, 1.5, 14, 3, 17, 5.5],
             "circle-color": circleColor,
             "circle-stroke-color": "#fbfaf7", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 16, 1],
             "circle-opacity": ["interpolate", ["linear"], ["zoom"], CROSSFADE.from, 0, CROSSFADE.to, 0.85],
             "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], CROSSFADE.from, 0, CROSSFADE.to, 0.85],
             "circle-opacity-transition": T, "circle-color-transition": T } });
}

export function updateCollisions(map, state) {
  for (const id of ["collisions-heat", "collisions-dots"]) if (map.getLayer(id)) map.setFilter(id, yearFilter(state));
}

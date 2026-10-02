import { BREAKS, RAMP } from "../config.js";

function colorExpression(metric) {
  const b = BREAKS[metric];
  return ["step", ["coalesce", ["get", "metric_value"], 0], RAMP[0], b[0], RAMP[1], b[1], RAMP[2], b[2], RAMP[3], b[3], RAMP[4]];
}

export function addSegmentsLayer(map, segments) {
  if (!map.getSource("segments")) map.addSource("segments", { type: "geojson", data: segments, promoteId: "loc_id" });
  map.addLayer({ id: "segments-casing", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#fcfcfb", "line-width": ["interpolate", ["linear"], ["get", "vpd_max"], 1000, 5, 35000, 12],
             "line-opacity": ["case", ["==", ["get", "in_ward"], 1], 0.9, 0.2] } });
  map.addLayer({ id: "segments-line", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": colorExpression("combined"),
             "line-width": ["interpolate", ["linear"], ["get", "vpd_max"], 1000, 2.5, 35000, 8],
             "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1,
                              ["==", ["get", "in_ward"], 1], 0.95, 0.25] } });
  map.addLayer({ id: "segments-shared", type: "line", source: "segments", filter: ["==", ["get", "shared_boundary"], true],
    layout: { "line-cap": "butt" },
    paint: { "line-color": "#0b0b0b", "line-width": 1, "line-dasharray": [2, 2], "line-offset": 5,
             "line-opacity": ["case", ["==", ["get", "in_ward"], 1], 0.6, 0.1] } });
  map.addLayer({ id: "segments-selected", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#0b0b0b", "line-width": 11, "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.35, 0] } });
}

let selected = null;

export function updateSegments(map, state, data) {
  if (!map.getSource("segments")) return;
  map.getSource("segments").setData(data);
  map.setPaintProperty("segments-line", "line-color", colorExpression(state.metric));
  if (selected && selected !== state.selectedLocId) map.setFeatureState({ source: "segments", id: selected }, { selected: false });
  if (state.selectedLocId) map.setFeatureState({ source: "segments", id: state.selectedLocId }, { selected: true });
  selected = state.selectedLocId;
}

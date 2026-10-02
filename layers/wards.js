import { WARD_COLORS } from "../config.js";

const fillColor = ["match", ["get", "Ward_num"], ...Object.entries(WARD_COLORS).flatMap(([k, v]) => [Number(k), v]), "#cccccc"];

export function addWardsLayer(map, wards) {
  if (!map.getSource("wards")) map.addSource("wards", { type: "geojson", data: wards });
  map.addLayer({ id: "wards-fill", type: "fill", source: "wards",
    paint: { "fill-color": fillColor, "fill-opacity": 0.10 } });
  map.addLayer({ id: "wards-line", type: "line", source: "wards",
    paint: { "line-color": "#898781", "line-width": 1.2, "line-opacity": 0.8 } });
  map.addLayer({ id: "wards-label", type: "symbol", source: "wards",
    layout: { "text-field": ["concat", "Ward ", ["to-string", ["get", "Ward_num"]]], "text-size": 12, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"] },
    paint: { "text-color": "#52514e", "text-halo-color": "#fcfcfb", "text-halo-width": 1.2 } });
}

export function updateWards(map, state) {
  if (!map.getLayer("wards-fill")) return;
  const opacity = state.ward == null ? 0.10 : ["case", ["==", ["get", "Ward_num"], state.ward], 0.16, 0.03];
  map.setPaintProperty("wards-fill", "fill-opacity", opacity);
}

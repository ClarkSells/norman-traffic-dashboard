export function addPointsLayer(map, points) {
  if (!map.getSource("points")) map.addSource("points", { type: "geojson", data: points });
  map.addLayer({ id: "count-points", type: "circle", source: "points", minzoom: 12,
    paint: { "circle-radius": 4, "circle-color": "#fcfcfb", "circle-stroke-color": "#0b0b0b", "circle-stroke-width": 1.2 } });
}

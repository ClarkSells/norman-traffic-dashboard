import { CENTER, MAPBOX_TOKEN, STYLES, ZOOM } from "./config.js";
import { applyState, getRaw, loadAll } from "./data.js";
import { addCollisionsLayer, updateCollisions } from "./layers/collisions.js";
import { addPointsLayer } from "./layers/points.js";
import { addSegmentsLayer, updateSegments } from "./layers/segments.js";
import { addWardsLayer, updateWards } from "./layers/wards.js";
import { renderLegend } from "./ui/legend.js";
import { initControls, renderTable } from "./ui/panel.js";
import { attachPopup } from "./ui/popup.js";
import { getState, setState, subscribe } from "./state.js";

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ container: "map", style: STYLES.light, center: CENTER, zoom: ZOOM });
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

function addAllLayers() {
  const raw = getRaw(), state = getState();
  addWardsLayer(map, raw.wards);
  addCollisionsLayer(map, raw.collisions, state);
  addSegmentsLayer(map, applyState(state));
  addPointsLayer(map, raw.points);
  updateWards(map, state);
  updateSegments(map, state, applyState(state));
}

function flyToSegment(locId) {
  const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
  if (!f) return;
  const b = new mapboxgl.LngLatBounds();
  f.geometry.coordinates.forEach(c => b.extend(c));
  map.fitBounds(b, { padding: 120, maxZoom: 15.5, duration: 700 });
}

function flyToWard(ward) {
  const f = getRaw().wards.features.find(x => x.properties.Ward_num === ward);
  if (!f) { map.flyTo({ center: CENTER, zoom: ZOOM }); return; }
  const b = new mapboxgl.LngLatBounds();
  f.geometry.coordinates[0].forEach(c => b.extend(c));
  map.fitBounds(b, { padding: 40, duration: 700 });
}

function render(state, patch) {
  const data = applyState(state);
  updateSegments(map, state, data);
  updateWards(map, state);
  updateCollisions(map, state);
  renderLegend(document.getElementById("legend"), state);
  renderTable(state, (locId) => { setState({ selectedLocId: locId }); flyToSegment(locId); });
  if (patch && "ward" in patch) flyToWard(state.ward);
}

async function main() {
  await loadAll();
  initControls();
  map.on("style.load", addAllLayers);
  if (map.isStyleLoaded()) addAllLayers();
  attachPopup(map, (locId) => setState({ selectedLocId: locId }));
  subscribe(render);
  render(getState(), {});
  document.getElementById("basemap-toggle").addEventListener("click", (e) => {
    const next = getState().basemap === "light" ? "satellite" : "light";
    setState({ basemap: next });
    e.target.textContent = next === "light" ? "Satellite" : "Streets";
    map.setStyle(STYLES[next]);   // layers are re-added on the next style.load
  });
}

main().catch(err => { console.error(err); document.getElementById("stats").textContent = `Failed to load: ${err.message}`; });

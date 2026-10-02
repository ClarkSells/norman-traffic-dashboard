import { CENTER, MAPBOX_TOKEN, STYLES, ZOOM } from "./config.js";
import { applyState, getRaw, loadAll } from "./data.js";
import { addCollisionsLayer, updateCollisions } from "./layers/collisions.js";
import { addPointsLayer } from "./layers/points.js";
import { addSegmentsLayer, updateSegments } from "./layers/segments.js";
import { addWardsLayer, updateWards } from "./layers/wards.js";
import { initHelp } from "./ui/help.js";
import { initLegend, renderLegend } from "./ui/legend.js";
import { hideLoading, initLoading, showLoadError } from "./ui/loading.js";
import { initControls, initPanelToggle, renderTable } from "./ui/panel.js";
import { attachPopup } from "./ui/popup.js";
import { getState, setState, subscribe } from "./state.js";

initLoading();   // "Loading ..." card over the map until the layers are on it

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ container: "map", style: STYLES.light, center: CENTER, zoom: ZOOM });
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

// The style and the data load in parallel. Whichever finishes last adds the
// layers. Registering the style listener before the data fetch matters: on a
// hosted copy the style usually wins, and a listener attached after the fact
// would never fire.
let styleReady = false;
let dataReady = false;

function addAllLayers() {
  if (!styleReady || !dataReady) return;
  if (map.getLayer("segments-line")) return;   // already added for this style
  const raw = getRaw(), state = getState();
  addWardsLayer(map, raw.wards);
  addCollisionsLayer(map, raw.collisions, state);
  addSegmentsLayer(map, applyState(state));
  addPointsLayer(map, raw.points);
  updateWards(map, state);
  updateSegments(map, state, applyState(state));
  updateCollisions(map, state);
  hideLoading();
}

map.on("style.load", () => { styleReady = true; addAllLayers(); });
// A style that never arrives (bad token, blocked host) would otherwise leave a blank map behind the loading card.
map.on("error", (e) => { if (!styleReady) showLoadError((e && e.error) || new Error("the map style did not load")); });

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
  dataReady = true;
  initControls();
  addAllLayers();
  attachPopup(map, (locId) => setState({ selectedLocId: locId }));
  initHelp(getRaw().summary && getRaw().summary.qa);
  initPanelToggle();
  initLegend(document.getElementById("legend"));
  subscribe(render);
  render(getState(), {});
  document.getElementById("basemap-toggle").addEventListener("click", (e) => {
    const next = getState().basemap === "light" ? "satellite" : "light";
    setState({ basemap: next });
    e.target.textContent = next === "light" ? "Satellite" : "Streets";
    styleReady = false;
    map.setStyle(STYLES[next]);   // layers are re-added on the next style.load
  });
}

main().catch(err => {
  console.error(err);
  showLoadError(err);
  document.getElementById("stats").textContent = `Failed to load: ${err.message}`;
});

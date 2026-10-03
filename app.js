import { CENTER, MAPBOX_TOKEN, STYLES, ZOOM } from "./config.js";
import { applyState, getRaw, loadAll } from "./data.js";
import { tuneBasemap } from "./layers/basemap.js";
import { addCollisionsLayer, updateCollisions } from "./layers/collisions.js";
import { addPointsLayer, setPointHover, setPointsTheme } from "./layers/points.js";
import { addSegmentsLayer, setHover, setSegmentsTheme, updateSegments } from "./layers/segments.js";
import { addWardsLayer, setWardsTheme, updateWards } from "./layers/wards.js";
import { initHelp } from "./ui/help.js";
import { initLegend, renderLegend } from "./ui/legend.js";
import { hideLoading, initLoading, showLoadError } from "./ui/loading.js";
import { clampPatchYears, highlightRow, initControls, initPanelToggle, renderTable, syncControls } from "./ui/panel.js";
import { attachPopup } from "./ui/popup.js";
import { hideTooltip, showTooltip, tooltipHtml } from "./ui/tooltip.js";
import { deriveProps } from "./data.js";
import { getState, setState, subscribe } from "./state.js";
import { applyTheme, themeFor } from "./theme.js";
import { bearingAcrossScreen, lineBounds } from "./geo.js";
import { resetCameraOptions, segmentCameraOptions, wardCameraOptions } from "./motion.js";
import { setProgress } from "./ui/loading.js";
import { buildTour } from "./tour.js";
import { initTourPlayer } from "./ui/tour.js";
import { readHash, writeHash } from "./hash.js";
import { initSheet } from "./ui/sheet.js";
import { renderStatus } from "./ui/status.js";
import { nearestSegment } from "./geo.js";

initLoading();   // "Loading ..." card over the map until the layers are on it
const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
setState({ reducedMotion: reduceMotion });
applyTheme(themeFor(getState().basemap));

// The chrome theme and the map chrome (casings, ward lines, labels) move together.
function applyMapTheme(name) {
  setSegmentsTheme(map, name); setWardsTheme(map, name); setPointsTheme(map, name);
}

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ container: "map", style: STYLES.light, center: CENTER, zoom: ZOOM });
map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
map.addControl(new mapboxgl.FullscreenControl({ container: document.body }), "top-right");
// A councilmember standing on a street: locate, then select the nearest ranked segment within 300 m.
const geolocate = new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserHeading: false, fitBoundsOptions: { maxZoom: 15 } });
map.addControl(geolocate, "top-right");
geolocate.on("geolocate", (e) => {
  if (!dataReady || !e || !e.coords) return;
  const hit = nearestSegment([e.coords.longitude, e.coords.latitude], getRaw().segments.features, 300);
  if (hit) selectSegment(hit.feature.properties.loc_id, { fly: true, openPopup: true });
});

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
  applyMapTheme(themeFor(state.basemap));
  tuneBasemap(map, themeFor(state.basemap));
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

// Camera choreography. Mapbox skips animations on its own when the OS asks for reduced motion (that is the default
// when "essential" is left unset), and the option sets also drop their durations to 0 in that case.
function flyToSegment(locId, override = {}) {
  const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
  if (!f) return;
  const reduced = getState().reducedMotion;
  const opts = segmentCameraOptions(bearingAcrossScreen(f.geometry.coordinates), reduced);
  const [sw, ne] = lineBounds(f.geometry.coordinates);
  const cam = map.cameraForBounds([sw, ne], { padding: opts.padding, bearing: opts.bearing, maxZoom: opts.maxZoom });
  if (!cam) return;
  map.easeTo({ center: cam.center, zoom: override.zoom != null ? override.zoom : Math.min(cam.zoom, opts.maxZoom), pitch: override.pitch != null ? override.pitch : opts.pitch, bearing: opts.bearing, duration: opts.duration });
}

function flyToWard(ward) {
  const f = getRaw().wards.features.find(x => x.properties.Ward_num === ward);
  const reduced = getState().reducedMotion;
  if (!f) { map.flyTo(resetCameraOptions(CENTER, ZOOM, reduced)); return; }
  const b = new mapboxgl.LngLatBounds();
  f.geometry.coordinates[0].forEach(c => b.extend(c));
  const { fit, settle } = wardCameraOptions(reduced);
  map.fitBounds(b, fit);
  if (settle.duration > 0) map.once("moveend", () => { if (getState().ward === ward) map.easeTo(settle); });
}

let popup = null;
let tour = null;          // the Present mode player
let panelToggle = null;   // setter from initPanelToggle

function setBasemap(next) {
  if (getState().basemap === next) return;
  setState({ basemap: next });
  styleReady = false;
  map.setStyle(STYLES[next]);   // layers are re-added on the next style.load
}

// Applies one tour step: state through setState (so every layer renders through the normal path), then the camera.
function applyTourStep(step) {
  if (popup) popup.remove();
  setBasemap(step.basemap || "light");
  setState({ ...step.state });
  const cam = step.camera || {};
  if (cam.segment) {
    flyToSegment(cam.segment, { zoom: cam.zoom, pitch: cam.pitch });
    if (step.popup && popup) { const open = () => popup.open(step.popup); if (getState().reducedMotion) open(); else map.once("moveend", () => { if (getState().selectedLocId === step.popup) open(); }); }
  } else if (cam.ward) flyToWard(cam.ward);
  else if (cam.center) map.easeTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch || 0, bearing: cam.bearing || 0, duration: getState().reducedMotion ? 0 : 700 });
}

function selectSegment(locId, { fly = true, openPopup = true } = {}) {
  setState({ selectedLocId: locId });
  if (fly) flyToSegment(locId);
  if (openPopup && popup) popup.open(locId);
}

function resetView() {
  setState({ ward: null, selectedLocId: null });
  if (popup) popup.remove();
  map.flyTo(resetCameraOptions(CENTER, ZOOM, getState().reducedMotion));
}

// Status line: camera and counts, refreshed on every move (one write per frame at most) and every render.
let statusQueued = false;
function updateStatus() {
  if (statusQueued) return;
  statusQueued = true;
  const run = () => {
    statusQueued = false;
    const el = document.getElementById("status-line"); if (!el || !dataReady) return;
    const c = map.getCenter(), st = getState();
    const shown = document.querySelectorAll("#rank-table tbody tr:not(.leaving)").length, total = getRaw().segments.features.length;
    renderStatus(el, { zoom: map.getZoom(), lng: c.lng, lat: c.lat, pitch: map.getPitch(), bearing: map.getBearing() }, shown, total, st.ward != null ? `WARD ${st.ward}` : "");
  };
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run); else run();
}
map.on("move", updateStatus);

function render(state, patch) {
  const data = applyState(state);
  updateSegments(map, state, data);
  updateWards(map, state);
  updateCollisions(map, state);
  renderLegend(document.getElementById("legend"), state);
  renderTable(state, (locId) => selectSegment(locId), { onHover: (locId) => setHover(map, locId) });
  syncControls(state);
  updateStatus();
  if (patch && "ward" in patch) flyToWard(state.ward);
  if (patch && "basemap" in patch) { applyTheme(themeFor(state.basemap)); applyMapTheme(themeFor(state.basemap)); }
  if (popup && popup.isOpen && popup.isOpen() && patch && !("selectedLocId" in patch)) popup.refresh();
  writeHash(state, tour && tour.getState().active ? tour.getState().index + 1 : null);
}

async function main() {
  await loadAll(setProgress);
  dataReady = true;
  initControls();
  addAllLayers();
  popup = attachPopup(map, (locId) => setState({ selectedLocId: locId }));
  initHelp(getRaw().summary && getRaw().summary.qa);
  panelToggle = initPanelToggle();
  const sheet = initSheet({ panel: document.getElementById("panel"), handle: document.getElementById("sheet-handle"), header: document.getElementById("briefing"),
              peekEls: [document.getElementById("sheet-handle"), document.getElementById("briefing"), document.getElementById("stats")] });
  map.resize();   // the panel may have become a bottom sheet, which changes the map box
  // Read-only handles for the Playwright checks (tests/e2e); nothing in the UI depends on them.
  window.__dash = { map, getState, sheet, get tour() { return tour; } };
  initLegend(document.getElementById("legend"));
  // Present mode
  const steps = buildTour(getRaw());
  tour = initTourPlayer({ steps, applyStep: applyTourStep,
    onExit: (saved) => { if (saved && saved.state) { setBasemap(saved.state.basemap); setState({ ...saved.state, basemap: getState().basemap }); map.easeTo({ ...saved.camera, duration: getState().reducedMotion ? 0 : 700 }); } writeHash(getState(), null); } });
  const snapshot = () => ({ state: getState(), camera: { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() } });
  document.getElementById("present-toggle").addEventListener("click", () => {
    if (tour.getState().active) tour.dispatch({ type: "exit" }); else tour.dispatch({ type: "enter", total: steps.length, saved: snapshot() });
  });
  subscribe(render);
  // Deep link: restore the UI state (and the tour step) from the URL hash once the data is here.
  const { patch: rawPatch, tour: tourStep } = readHash();
  const patch = clampPatchYears(rawPatch);
  if (patch.basemap) { const b = patch.basemap; delete patch.basemap; setBasemap(b); }
  if (Object.keys(patch).length) setState(patch); else render(getState(), {});
  if (patch.ward != null) flyToWard(patch.ward);
  if (patch.selectedLocId) { flyToSegment(patch.selectedLocId); if (popup) popup.open(patch.selectedLocId); }
  if (tourStep) tour.dispatch({ type: "enter", total: steps.length, saved: snapshot(), index: tourStep - 1 });
  window.addEventListener("hashchange", () => {
    const { patch: p0, tour: t } = readHash();
    const p = clampPatchYears(p0);
    if (t && !tour.getState().active) tour.dispatch({ type: "enter", total: steps.length, saved: snapshot(), index: t - 1 });
    else if (t && tour.getState().active && tour.getState().index !== t - 1) tour.dispatch({ type: "goto", index: t - 1 });
    else if (!t && Object.keys(p).length && !tour.getState().active) { if (p.basemap) setBasemap(p.basemap); setState(p); }
  });
  document.getElementById("reset-view").addEventListener("click", resetView);
  document.getElementById("table-empty").addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    if (btn.dataset.action === "Include collectors") setState({ includeCollectors: true }); else resetView();
  });
  // Map hover -> table row, tooltip and pointer cursor
  const tip = document.getElementById("map-tooltip"), mapEl = document.getElementById("map");
  map.on("mousemove", "segments-line", (e) => {
    const id = e.features[0].properties.loc_id;
    setHover(map, id); highlightRow(id);
    map.getCanvas().style.cursor = "pointer";
    const f = getRaw().segments.features.find(x => x.properties.loc_id === id);
    if (f) showTooltip(tip, tooltipHtml({ ...f.properties, ...deriveProps(f.properties, getState()) }, getState()), e.point, { width: mapEl.clientWidth, height: mapEl.clientHeight });
  });
  map.on("mouseleave", "segments-line", () => { setHover(map, null); highlightRow(null); hideTooltip(tip); map.getCanvas().style.cursor = ""; });
  map.on("mouseenter", "count-points", (e) => { map.getCanvas().style.cursor = "pointer"; setPointHover(map, e.features[0].properties.loc_id); });
  map.on("mouseleave", "count-points", () => { map.getCanvas().style.cursor = ""; setPointHover(map, null); });
  map.on("click", () => hideTooltip(tip));
  document.getElementById("basemap-toggle").addEventListener("click", () => setBasemap(getState().basemap === "light" ? "satellite" : "light"));
}

main().catch(err => {
  console.error(err);
  showLoadError(err);
  const line = document.getElementById("briefing-line");
  if (line) line.textContent = `Failed to load: ${err.message}`;
});

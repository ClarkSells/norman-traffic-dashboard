import { CITY_BOUNDS, CENTER, FLOW, MAPBOX_TOKEN, PRESETS, STYLES, ZOOM } from "./config.js";
import { applyState, deriveProps, getRaw, loadAll } from "./data.js";
import { configureStandard, setLightPreset, switchBasemap } from "./layers/basemap.js";
import { addCollisionsLayer, dimOutsideWard, revealSegmentCrashes, setDotsMode, setHeatVisible, updateCollisions } from "./layers/collisions.js";
import { addFlowLayers, FLOW_LAYERS, setFlowVisible, startFlow, flowUpdateStats } from "./layers/flow.js";
import { addCalloutLayer, clearCallouts, showCallouts } from "./layers/callouts.js";
import { addPointsLayer, setPointHover, setPointsTheme } from "./layers/points.js";
import { addSegmentsLayer, addWardMask, clearWardMask, pulse, setHover, setSegmentsOpacity, setSegmentsTheme, updateSegments } from "./layers/segments.js";
import { addWardsLayer, setWardsTheme, updateWards } from "./layers/wards.js";
import { aerial, dollyToSegment, drift, establish, fitWard, orbit, presentationPadding, stopMotion } from "./camera.js";
import { initHelp } from "./ui/help.js";
import { initLegend, renderLegend } from "./ui/legend.js";
import { hideLoading, initLoading, setProgress, setStage, showLoadError } from "./ui/loading.js";
import { clampPatchYears, highlightRow, initControls, initPanelToggle, renderTable, syncControls } from "./ui/panel.js";
import { attachPopup } from "./ui/popup.js";
import { hideTooltip, showTooltip, tooltipHtml } from "./ui/tooltip.js";
import { getState, setState, subscribe } from "./state.js";
import { applyMode, applyTheme, themeFor } from "./theme.js";
import { bearingAcrossScreen, lineMidpoint, nearestSegment } from "./geo.js";
import { buildScenes } from "./scenes.js";
import { initTourPlayer } from "./ui/tour.js";
import { initPresent } from "./ui/present.js";
import { initLayout } from "./ui/layout.js";
import { initMapChrome } from "./ui/mapchrome.js";
import { readHash, writeHash } from "./hash.js";
import { initSheet } from "./ui/sheet.js";
import { closureArmed, initSimulate, playYears, setSampleNotice, stopYears, syncSimulate } from "./ui/simulate.js";

initLoading();   // loading card over the map until the layers are on it
setStage("map");
const reduceMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
setState({ reducedMotion: reduceMotion });
applyTheme(themeFor(getState().basemap));
applyMode("explore");

// The chrome theme and the map chrome (casings, ward lines, labels) move together.
function applyMapTheme(name) {
  setSegmentsTheme(map, name); setWardsTheme(map, name); setPointsTheme(map, name);
}

mapboxgl.accessToken = MAPBOX_TOKEN;
// preserveDrawingBuffer lets switchBasemap snapshot the canvas for the crossfade (no black frame).
const map = new mapboxgl.Map({ container: "map", style: STYLES.light, center: CENTER, zoom: ZOOM, preserveDrawingBuffer: true });
// Phones get no nav control (pinch and double tap); desktop gets zoom buttons and fullscreen, never in present.
const isPhone = () => typeof matchMedia === "function" && matchMedia("(max-width: 767px)").matches;
let navControl = null, fsControl = null;
if (!isPhone()) {
  navControl = new mapboxgl.NavigationControl({ showCompass: false });
  fsControl = new mapboxgl.FullscreenControl({ container: document.body });
  map.addControl(navControl, "top-right");
  map.addControl(fsControl, "top-right");
}
// Geolocate only when the browser can actually locate: https (or localhost) plus the API, never in present (B4).
let geolocate = null;
const secure = typeof location === "undefined" || location.protocol === "https:" || /^localhost$|^127\./.test(location.hostname);
if (secure && typeof navigator !== "undefined" && "geolocation" in navigator && typeof mapboxgl.GeolocateControl === "function") {
  geolocate = new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false, showUserHeading: false, fitBoundsOptions: { maxZoom: 15 } });
  map.addControl(geolocate, "top-right");
  geolocate.on("geolocate", (e) => {
    if (!dataReady || presenting || !e || !e.coords) return;
    const hit = nearestSegment([e.coords.longitude, e.coords.latitude], getRaw().segments.features, 300);
    if (hit) selectSegment(hit.feature.properties.loc_id, { fly: true, openPopup: true });
  });
}

const layout = initLayout(map, { layoutEl: document.getElementById("layout"), mapEl: document.getElementById("map") });
const mapchrome = initMapChrome(map, { northEl: document.getElementById("map-north"), recenterEl: document.getElementById("map-recenter"), cityBounds: CITY_BOUNDS });

// The style and the data load in parallel. Whichever finishes last adds the layers (style.load
// also fires after every setStyle, which is how layers survive a basemap switch).
let styleReady = false;
let dataReady = false;
let presenting = false;
let currentScene = null;

// --- Traffic flow loop (design section 7): one rAF loop, per-band speed from the median v/c ----
let stopFlow = null;
function flowStepMs(data) {
  const bands = [[], [], []];
  for (const f of data.features) {
    const v = f.properties.vpd_max, vc = f.properties.v_c_active;
    if (vc == null) continue;
    bands[v < FLOW.bands[0] ? 0 : v < FLOW.bands[1] ? 1 : 2].push(vc);
  }
  return bands.map((list) => {
    if (!list.length) return FLOW.stepMs.moderate;
    list.sort((a, b) => a - b);
    const m = list[Math.floor(list.length / 2)];
    return m < FLOW.vcBands[0] ? FLOW.stepMs.free : m <= FLOW.vcBands[1] ? FLOW.stepMs.moderate : FLOW.stepMs.congested;
  });
}
function startFlowLoop() {
  stopFlowLoop({ keepVisible: true });
  if (getState().reducedMotion) { setFlowVisible(map, false); return; }   // flow never runs under reduced motion
  setFlowVisible(map, true);
  stopFlow = startFlow(map, { stepMsByLayer: flowStepMs(applyState(getState())) });
}
function stopFlowLoop({ keepVisible = false } = {}) {
  if (stopFlow) { stopFlow(); stopFlow = null; }
  if (!keepVisible) setFlowVisible(map, false);
}

function addAllLayers() {
  if (!styleReady || !dataReady) return;
  if (map.getLayer("segments-line")) return;   // already added for this style
  const raw = getRaw(), state = getState();
  applyMapTheme(themeFor(state.basemap));
  configureStandard(map, { lightPreset: presenting && currentScene ? currentScene.lightPreset : PRESETS.explore, presenting });
  addWardsLayer(map, raw.wards, { reducedMotion: state.reducedMotion });
  addCollisionsLayer(map, raw.collisions, state);
  addSegmentsLayer(map, applyState(state), { reducedMotion: state.reducedMotion });
  addFlowLayers(map, state);
  // The design stacks flow above segments-line and below the selection frame, all in slot "top".
  for (const id of FLOW_LAYERS) if (typeof map.moveLayer === "function" && map.getLayer("segments-selected")) map.moveLayer(id, "segments-selected");
  addCalloutLayer(map);
  addPointsLayer(map, raw.points);
  updateWards(map, state);
  updateSegments(map, state, applyState(state));
  updateCollisions(map, state);
  if (state.flow) startFlowLoop();
  if (presenting && currentScene) applySceneLayers(currentScene);   // re-apply scene effects after a style swap
  setStage("crashes");
  // ready/hideLoading on the first idle, but the selection pulse keeps repainting forever and a
  // perfect idle may never come on a deep-linked segment, so bound the wait.
  let readyDone = false;
  const markReady = () => { if (readyDone) return; readyDone = true; hideLoading(); window.__dash.ready = true; };
  map.once("idle", markReady);
  setTimeout(markReady, 4000);
}

map.on("style.load", () => { styleReady = true; setStage("segments"); addAllLayers(); });
// A style that never arrives (bad token, blocked host) would otherwise leave a blank map behind the loading card.
map.on("error", (e) => { if (!styleReady) showLoadError((e && e.error) || new Error("the map style did not load")); });

// --- Explore camera --------------------------------------------------------------
const EXPLORE_PAD = { top: 96, right: 96, bottom: 96, left: 96 };

function flyToSegment(locId) {
  const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
  if (!f) return;
  dollyToSegment(map, f, { padding: EXPLORE_PAD, pitch: 45, reduced: getState().reducedMotion });
}

function wardFeature(ward) {
  return getRaw().wards.features.find(x => x.properties.Ward_num === ward) || null;
}

function flyToWard(ward) {
  const reduced = getState().reducedMotion;
  const f = wardFeature(ward);
  if (!f) { map.flyTo({ center: CENTER, zoom: ZOOM, pitch: 0, bearing: 0, duration: reduced ? 0 : 900 }); dimOutsideWard(map, null); return; }
  fitWard(map, f, { padding: EXPLORE_PAD, pitch: 30, reduced });
  dimOutsideWard(map, f);   // crashes outside the ward sink to 25 percent (C8)
}

let popup = null;
let tour = null;          // the Present mode player
let panelToggle = null;   // setter from initPanelToggle
let helpBox = null;       // { close } from initHelp
let cancelReveal = null;  // in-flight crash reveal cancel
let cancelSceneSpin = null; // in-flight orbit/drift cancel

async function setBasemap(next) {
  if (getState().basemap === next) return;
  applyTheme(themeFor(next));
  await switchBasemap(map, next, { lightPreset: next === "satellite" ? null : PRESETS.explore, presenting: false, fadeMs: getState().reducedMotion ? 0 : 350 });
  setState({ basemap: next });
  applyMapTheme(themeFor(next));
}

function selectSegment(locId, { fly = true, openPopup = true } = {}) {
  setState({ selectedLocId: locId });
  if (fly) flyToSegment(locId);
  if (openPopup && popup) popup.open(locId);
}

function resetView() {
  setState({ ward: null, selectedLocId: null });
  if (popup) popup.remove();
  if (helpBox) helpBox.close();
  map.flyTo({ center: CENTER, zoom: ZOOM, pitch: 0, bearing: 0, duration: getState().reducedMotion ? 0 : 900 });
}

// --- Present mode ----------------------------------------------------------------
// Callout items from a scene's loc id list: the segment's own citywide rank and road from the data,
// its midpoint for the anchor point. Scene 13 overrides the text with its lanes/VPD callout.
function calloutItems(scene) {
  const ids = scene.layers.callouts || [];
  if (!ids.length) return [];
  return ids.map((locId, i) => {
    const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
    if (!f) return null;
    const coords = f.geometry.coordinates;
    const rank = f.properties.rank_combined_city != null ? f.properties.rank_combined_city : i + 1;
    const text = scene.calloutText && ids.length === 1 ? scene.calloutText : `#${rank}  ${f.properties.on_road}`;
    return { locId, text, rank, lngLat: lineMidpoint(coords), bearing: bearingAcrossScreen(coords) };
  }).filter(Boolean);
}

// Everything a scene does to the layers (no camera, no state). Also used to re-apply a scene after a style swap.
function applySceneLayers(scene) {
  const reduced = getState().reducedMotion;
  const L = scene.layers;
  setSegmentsOpacity(map, L.segmentsOpacity);
  setHeatVisible(map, L.heat, { fadeMs: reduced ? 0 : 600 });
  setDotsMode(map, L.dots === "segment" ? "segment" : L.dots, { locId: scene.state.selectedLocId });
  if (L.callouts && L.callouts.length) showCallouts(map, calloutItems(scene)); else clearCallouts(map);
  if (L.mask != null) { const f = wardFeature(L.mask); addWardMask(map, f, getRaw().wards); dimOutsideWard(map, f); }
  else { clearWardMask(map); dimOutsideWard(map, null); }
  // Ward labels belong to the ward scenes only (section 10 layer column; 3.2-06).
  if (map.getLayer("wards-label")) map.setLayoutProperty("wards-label", "visibility", L.mask != null ? "visible" : "none");
}

// One scene: state, basemap, layers, camera, then the after-arrival emphasis (pulse, crash reveal, orbit).
async function applyScene(scene, prev) {
  const reduced = getState().reducedMotion;
  currentScene = scene;
  if (!styleReady) await new Promise((r) => map.once("style.load", r));   // deep link into a scene at boot
  stopMotion(map);
  if (cancelSceneSpin) { cancelSceneSpin(); cancelSceneSpin = null; }
  if (cancelReveal) { cancelReveal(); cancelReveal = null; }
  if (popup) popup.remove();
  hideTooltip(document.getElementById("map-tooltip"));
  if (scene.basemap !== getState().basemap) {
    await switchBasemap(map, scene.basemap, { lightPreset: scene.lightPreset, presenting: true, fadeMs: reduced ? 0 : 350 });
  } else {
    setLightPreset(map, scene.lightPreset);
    configureStandard(map, { lightPreset: scene.lightPreset, presenting: true });
  }
  setState({ ...scene.state, reducedMotion: reduced });   // C.1 full state; the player's reduced-motion overlay
  applySceneLayers(scene);
  // Flow pauses during the camera flight and restarts on arrival (design section 7 frame budget).
  setFlowVisible(map, false);
  const padding = presentationPadding({ width: map.getCanvas().clientWidth || 1440, height: map.getCanvas().clientHeight || 900 }, layout.captionBox());
  const segFeature = scene.camera.locId ? getRaw().segments.features.find(x => x.properties.loc_id === scene.camera.locId) : null;
  let arrived;
  if (scene.camera.kind === "segment") arrived = dollyToSegment(map, segFeature, { padding, zoom: scene.camera.zoom, pitch: scene.camera.pitch, reduced });
  else if (scene.camera.kind === "aerial") arrived = aerial(map, segFeature, { padding, reduced });
  else if (scene.camera.kind === "ward") { fitWard(map, wardFeature(scene.camera.ward), { padding, reduced }); arrived = reduced ? Promise.resolve() : new Promise(r => map.once("moveend", r)); }
  else { establish(map, getRaw().wards, { padding, reduced }); arrived = reduced ? Promise.resolve() : new Promise(r => map.once("moveend", r)); }
  await arrived;
  if (currentScene !== scene) return;   // superseded while the camera flew
  if (scene.layers.flow) startFlowLoop(); else stopFlowLoop();
  if (scene.layers.pulse && scene.layers.pulse.length) pulse(map, scene.layers.pulse, { reduced });
  if (scene.layers.dots === "segment" && scene.state.selectedLocId) cancelReveal = revealSegmentCrashes(map, scene.state.selectedLocId, { reduced });
  const ms = scene.autoplayMs || 10000;
  if (scene.motion.orbitDeg) cancelSceneSpin = orbit(map, scene.motion.orbitDeg, ms, { reduced });
  else if (scene.motion.driftDeg) cancelSceneSpin = drift(map, scene.motion.driftDeg, ms, { reduced });
}

// Interruptions: wheel, drag or pinch cancels the orbit/drift but keeps the scene (design section 6).
for (const ev of ["mousedown", "wheel", "touchstart"]) {
  map.on(ev, () => { if (presenting && cancelSceneSpin) { cancelSceneSpin(); cancelSceneSpin = null; } });
}

function onEnterPresent() {
  presenting = true;
  if (popup) popup.remove();
  hideTooltip(document.getElementById("map-tooltip"));
  layout.setPresenting(true);
  applyMode("present");
  mapchrome.setPresenting(true);
  if (navControl) map.removeControl(navControl);
  if (fsControl) map.removeControl(fsControl);
  if (geolocate) map.removeControl(geolocate);
  const panelEl = document.getElementById("panel");
  if (panelEl) panelEl.inert = true;   // hidden panel stays out of the tab order (3.7-01)
  const presentEl = document.getElementById("present");
  if (presentEl) presentEl.focus();    // keep the keyboard user's place across the boundary (3.7-11)
}

function onExitPresent(saved) {
  presenting = false;
  currentScene = null;
  stopMotion(map);
  if (cancelSceneSpin) { cancelSceneSpin(); cancelSceneSpin = null; }
  if (cancelReveal) { cancelReveal(); cancelReveal = null; }
  clearCallouts(map);
  clearWardMask(map);
  dimOutsideWard(map, null);
  if (map.getLayer("wards-label")) map.setLayoutProperty("wards-label", "visibility", "visible");
  setDotsMode(map, "all");
  setSegmentsOpacity(map, 1);
  stopFlowLoop();
  layout.setPresenting(false);
  applyMode("explore");
  mapchrome.setPresenting(false);
  const panelEl = document.getElementById("panel");
  if (panelEl) panelEl.inert = false;
  const toggle = document.getElementById("present-toggle");
  if (toggle) toggle.focus();          // restore focus to the control that started the tour (3.7-11)
  if (navControl) map.addControl(navControl, "top-right");
  if (fsControl) map.addControl(fsControl, "top-right");
  if (geolocate) map.addControl(geolocate, "top-right");
  const back = saved && saved.state ? saved.state : null;
  const finish = () => {
    if (back) setState({ ...back });
    applyTheme(themeFor(getState().basemap));   // re-apply the inline theme vars present mode stripped
    if (saved && saved.camera) map.easeTo({ ...saved.camera, duration: getState().reducedMotion ? 0 : 700 });
    writeHash(getState(), null);
  };
  if (back && getState().basemap !== back.basemap) {
    applyTheme(themeFor(back.basemap));
    switchBasemap(map, back.basemap, { lightPreset: back.basemap === "satellite" ? null : PRESETS.explore, presenting: false, fadeMs: getState().reducedMotion ? 0 : 350 })
      .then(() => { applyMapTheme(themeFor(back.basemap)); finish(); });
  } else {
    setLightPreset(map, PRESETS.explore);
    configureStandard(map, { lightPreset: PRESETS.explore, presenting: false });
    finish();
  }
}

function render(state, patch) {
  const data = applyState(state);
  updateSegments(map, state, data);
  updateWards(map, state);
  updateCollisions(map, state);
  renderLegend(document.getElementById("legend"), state);
  renderTable(state, (locId) => selectSegment(locId), { onHover: (locId) => setHover(map, locId) });
  syncControls(state);
  syncSimulate(state);
  const bmBtn = document.getElementById("basemap-toggle");
  if (bmBtn) { bmBtn.textContent = state.basemap === "satellite" ? "Streets" : "Satellite"; bmBtn.setAttribute("aria-pressed", String(state.basemap === "satellite")); }
  if (presenting) { writeHash(state, tour && tour.getState().active ? tour.getState().index : null); return; }
  if (patch && "ward" in patch) flyToWard(state.ward);
  if (patch && "heat" in patch) setHeatVisible(map, state.heat !== false, { fadeMs: state.reducedMotion ? 0 : 600 });
  if (patch && "flow" in patch) { if (state.flow) startFlowLoop(); else stopFlowLoop(); }
  if (popup && popup.isOpen && popup.isOpen() && patch && !("selectedLocId" in patch)) popup.refresh();
  writeHash(state, null);
}

async function main() {
  await loadAll(setProgress);
  dataReady = true;
  performance.mark("dash:data-ready");
  initControls();
  initSimulate({ daytypes: getRaw().daytypes });
  // data/SAMPLE_DATA.txt exists only while scripts/stamp_sample.mjs output stands in for the pipeline.
  fetch("data/SAMPLE_DATA.txt", { method: "HEAD" }).then(r => setSampleNotice(r.ok)).catch(() => setSampleNotice(false));
  addAllLayers();
  performance.mark("dash:layers-added");
  popup = attachPopup(map, (locId) => setState({ selectedLocId: locId }), () => !presenting);
  helpBox = initHelp(getRaw().summary && getRaw().summary.qa);
  panelToggle = initPanelToggle();
  const sheet = initSheet({ panel: document.getElementById("panel"), handle: document.getElementById("sheet-handle"), header: document.getElementById("briefing"),
              peekEls: [document.getElementById("sheet-handle"), document.getElementById("briefing"), document.getElementById("stats")] });
  map.resize();   // the panel may have become a bottom sheet, which changes the map box
  // Read-only handles for the Playwright checks (tests/e2e); nothing in the UI depends on them.
  window.__dash = { map, getState, sheet, ready: false, get tour() { return tour; }, flowStats: () => flowUpdateStats() };
  initLegend(document.getElementById("legend"));
  // Present mode: 15 scenes, the chrome, and the player.
  const scenes = buildScenes(getRaw());
  const present = initPresent({ root: document.getElementById("present"), reducedMotion: () => getState().reducedMotion });
  tour = initTourPlayer({ scenes, applyScene, onEnter: onEnterPresent, onExit: onExitPresent, present });
  const snapshot = () => ({ state: { ...getState(), presenting: false }, camera: { center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() } });
  document.getElementById("present-toggle").addEventListener("click", () => {
    if (tour.getState().active) tour.dispatch({ type: "exit" }); else tour.dispatch({ type: "enter", total: scenes.length, saved: snapshot() });
  });
  subscribe(render);
  // Deep link: restore the UI state (and the scene, tour=N is the 0 based scene index) from the URL hash.
  const { patch: rawPatch, tour: tourIndex } = readHash();
  const patch = clampPatchYears(rawPatch);
  if (patch.basemap) { const b = patch.basemap; delete patch.basemap; setBasemap(b); }
  if (Object.keys(patch).length) setState(patch); else render(getState(), {});
  if (patch.ward != null) flyToWard(patch.ward);
  if (patch.selectedLocId) { flyToSegment(patch.selectedLocId); if (popup) popup.open(patch.selectedLocId); }
  if (tourIndex != null) tour.dispatch({ type: "enter", total: scenes.length, saved: snapshot(), index: tourIndex });
  window.addEventListener("hashchange", () => {
    const { patch: p0, tour: t } = readHash();
    const p = clampPatchYears(p0);
    if (t != null && !tour.getState().active) tour.dispatch({ type: "enter", total: scenes.length, saved: snapshot(), index: t });
    else if (t != null && tour.getState().active && tour.getState().index !== t) tour.dispatch({ type: "goto", index: t });
    else if (t == null && tour.getState().active) tour.dispatch({ type: "exit" });
    else if (t == null && Object.keys(p).length && !tour.getState().active) { if (p.basemap) setBasemap(p.basemap); setState(p); }
  });
  document.getElementById("reset-view").addEventListener("click", resetView);
  document.getElementById("table-empty").addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    if (btn.dataset.action === "Include collectors") setState({ includeCollectors: true }); else resetView();
  });
  // Map hover -> table row, tooltip and pointer cursor (never in present: the film has no tooltip)
  const tip = document.getElementById("map-tooltip"), mapEl = document.getElementById("map");
  map.on("mousemove", "segments-line", (e) => {
    if (presenting) return;
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

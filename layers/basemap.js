// ## WHAT THIS FILE DOES
// Everything about the Mapbox Standard basemap itself, as opposed to our data layers: the config properties
// (which labels show, the light preset, the faded theme in present), the slot names our layers use, and the
// style switch with a snapshot crossfade so swapping between Standard and Standard Satellite never shows a
// black frame. Imports config.js and motion.js. Called from app.js (boot, setBasemap, applyScene, exit) and
// the basemap tests, which drive it with a recording map double and an injectable tween.
// Basemap control: Mapbox Standard config, layer slots, and the snapshot crossfade for style switches.
// The data reads first: POI and transit labels off, place and road labels on, 3D objects on, and the
// "faded" theme while presenting so the thematic layers carry the frame (handoff/02_DESIGN_DIRECTION.md).
import { STYLES } from "../config.js";
import { tween } from "../motion.js";

export const STYLE_FOR = { light: STYLES.standard, satellite: STYLES.satellite };

// Design's Standard configuration. `theme` and `show3dObjects` exist only on Mapbox Standard;
// standard-satellite rejects them (docs.mapbox.com/mapbox-gl-js/guides/migrate), so they are skipped there.
const LABEL_CONFIG = {
  showPointOfInterestLabels: false,
  showTransitLabels: false,
  showPlaceLabels: true,
  showRoadLabels: true,
};

// ## isStandardStyle, safeStyle, isSatelliteStyle: what kind of style is loaded
// Mapbox Standard is delivered as a style that imports a basemap fragment, which is what makes it
// configurable through setConfigProperty. Classic styles have no imports and reject config calls.
export function isStandardStyle(style) { return !!(style && style.imports && style.imports.length); }

// getStyle() THROWS "Style is not done loading" in GL JS v3 when the style has not loaded yet
// (it does not return null), so every caller goes through this guard.
function safeStyle(map) {
  if (!map || !map.getStyle) return null;
  try { return map.getStyle(); } catch { return null; }
}

function isSatelliteStyle(style) {
  const url = style && style.imports && style.imports[0] && style.imports[0].url;
  if (url) return /satellite/.test(String(url));
  return !!(style && style.name && /satellite/i.test(style.name));
}

// ## setConfig: one Standard config write
// Mapbox concept: Standard exposes a small set of named config properties on its "basemap" import (label
// groups, lightPreset, theme, show3dObjects). Setting one restyles the whole basemap without a style reload.
function setConfig(map, key, value) { map.setConfigProperty("basemap", key, value); }

// ## configureStandard: the design's basemap settings
// Applies the design's Standard config. No-op on non Standard styles (classic styles, or a map
// whose style has not loaded yet). lightPreset comes from the caller ("dusk" present, "day" explore).
export function configureStandard(map, { lightPreset, presenting } = {}) {
  const style = safeStyle(map);
  if (!isStandardStyle(style)) return;
  for (const [key, value] of Object.entries(LABEL_CONFIG)) setConfig(map, key, value);
  if (lightPreset) setConfig(map, "lightPreset", lightPreset);
  if (!isSatelliteStyle(style)) {
    setConfig(map, "show3dObjects", true);
    setConfig(map, "theme", presenting ? "faded" : "default");
  }
}

// ## setLightPreset: "day" in explore, "dusk" in most present scenes
// The light preset changes the basemap's lighting and sky. Our data layers use emissive strength so the
// orange ramp keeps its color under the dusk light.
export function setLightPreset(map, preset) {
  const style = safeStyle(map);
  if (!isStandardStyle(style) || !preset) return;
  setConfig(map, "lightPreset", preset);
}

// ## slotFor: which Standard slot a layer kind belongs in
// Slots into the Standard style: wards under roads, heat above roads behind 3D buildings,
// everything else above POI labels (cheatsheet section 2).
export function slotFor(layerKind) {
  if (layerKind === "wards") return "bottom";
  if (layerKind === "heat") return "middle";
  return "top";
}

// ## switchBasemap: setStyle with a crossfade
// setStyle throws away every source and layer, downloads the new style and fires style.load. The sequence
// here: photograph the canvas into an <img> over the map, call setStyle, on style.load re-apply the config and
// run onReady (app.js adds the layers back through its own style.load handler), then fade the photo away
// once the map is idle or after a bounded wait. A style that errors or throws resolves at once so callers
// awaiting the promise never hang.
// Style switch without a black frame: freeze the current canvas into an overlay img, swap the
// style under it, re-apply config and hand control to onReady after style.load, then fade the
// overlay away once the map is idle. The snapshot needs preserveDrawingBuffer: true on the Map
// constructor (Wave 2 wiring); if toDataURL fails the switch still completes without an overlay.
export function switchBasemap(map, next, { lightPreset, presenting, onReady, tween: tweenFn = tween, fadeMs = 350, setTimeout: setTimeoutFn = setTimeout, clearTimeout: clearTimeoutFn = clearTimeout } = {}) {
  const url = STYLE_FOR[next] || next;
  const canvas = map.getCanvas ? map.getCanvas() : null;
  const container = (map.getCanvasContainer && map.getCanvasContainer()) || (canvas && canvas.parentNode) || null;
  let overlay = null;
  if (canvas && container && typeof document !== "undefined") {
    let src = null;
    try { src = canvas.toDataURL("image/jpeg", 0.85); } catch { src = null; }
    if (src) {
      overlay = document.createElement("img");
      overlay.className = "style-crossfade";
      overlay.src = src;
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.width = "100%";
      overlay.style.height = "100%";
      overlay.style.objectFit = "cover";
      overlay.style.pointerEvents = "none";
      container.appendChild(overlay);
    }
  }
  return new Promise((resolve) => {
    let settled = false;
    let timeoutId = null;
    const clearFallback = () => {
      if (timeoutId !== null) { clearTimeoutFn(timeoutId); timeoutId = null; }
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      clearFallback();
      if (overlay) { overlay.remove(); overlay = null; }
      resolve();
    };
    map.once("style.load", () => {
      configureStandard(map, { lightPreset, presenting });
      if (onReady) onReady();
      // The selection pulse and the flow loop keep repainting forever, so a perfect idle may never
      // come; bound the wait and fade the overlay regardless.
      const proceed = () => {
        if (settled) return;
        settled = true;
        clearFallback();
        if (!overlay || !fadeMs) { if (overlay) overlay.remove(); resolve(); return; }
        tweenFn({
          duration: fadeMs,
          onUpdate: (t) => { overlay.style.opacity = String(1 - t); },
          onDone: () => { overlay.remove(); resolve(); },
        });
      };
      map.once("idle", proceed);
      timeoutId = setTimeoutFn(proceed, 5000);
    });
    // A style that never reaches style.load (bad URL, network block mid-session) must not hang the
    // awaiting callers: settle on the map error event, and on a synchronous setStyle throw.
    map.once("error", fail);
    try { map.setStyle(url); } catch { fail(); }
  });
}

// ## tuneBasemap: the older label tuning, kept for tests
// --- Legacy API (Wave 0). app.js and tests/layers.test.js still call tuneBasemap; the lead
// rewires them to configureStandard/switchBasemap in Wave 2. Kept so neighbors keep working.
const HIDE_SOURCE_LAYERS = new Set(["poi_label", "transit_stop_label", "airport_label", "natural_label", "natural_point_label", "natural_line_label", "water_point_label", "water_line_label", "housenum_label"]);

export function tuneBasemap(map, theme) {
  const style = safeStyle(map);
  if (!style) return { mode: "none", hidden: [] };
  if (isStandardStyle(style)) {
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    map.setConfigProperty("basemap", "showTransitLabels", false);
    map.setConfigProperty("basemap", "lightPreset", theme === "dark" ? "night" : "day");
    return { mode: "standard", hidden: [] };
  }
  const hidden = [];
  for (const l of style.layers || []) {
    if (l.type !== "symbol") continue;
    const sl = l["source-layer"];
    if (sl && HIDE_SOURCE_LAYERS.has(sl)) { map.setLayoutProperty(l.id, "visibility", "none"); hidden.push(l.id); }
  }
  return { mode: "classic", hidden };
}

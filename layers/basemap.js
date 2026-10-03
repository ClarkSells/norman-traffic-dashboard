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

export function isStandardStyle(style) { return !!(style && style.imports && style.imports.length); }

function isSatelliteStyle(style) {
  const url = style && style.imports && style.imports[0] && style.imports[0].url;
  if (url) return /satellite/.test(String(url));
  return !!(style && style.name && /satellite/i.test(style.name));
}

function setConfig(map, key, value) { map.setConfigProperty("basemap", key, value); }

// Applies the design's Standard config. No-op on non Standard styles (classic styles, or a map
// whose style has not loaded yet). lightPreset comes from the caller ("dusk" present, "day" explore).
export function configureStandard(map, { lightPreset, presenting } = {}) {
  const style = map.getStyle ? map.getStyle() : null;
  if (!isStandardStyle(style)) return;
  for (const [key, value] of Object.entries(LABEL_CONFIG)) setConfig(map, key, value);
  if (lightPreset) setConfig(map, "lightPreset", lightPreset);
  if (!isSatelliteStyle(style)) {
    setConfig(map, "show3dObjects", true);
    setConfig(map, "theme", presenting ? "faded" : "default");
  }
}

export function setLightPreset(map, preset) {
  const style = map.getStyle ? map.getStyle() : null;
  if (!isStandardStyle(style) || !preset) return;
  setConfig(map, "lightPreset", preset);
}

// Slots into the Standard style: wards under roads, heat above roads behind 3D buildings,
// everything else above POI labels (cheatsheet section 2).
export function slotFor(layerKind) {
  if (layerKind === "wards") return "bottom";
  if (layerKind === "heat") return "middle";
  return "top";
}

// Style switch without a black frame: freeze the current canvas into an overlay img, swap the
// style under it, re-apply config and hand control to onReady after style.load, then fade the
// overlay away once the map is idle. The snapshot needs preserveDrawingBuffer: true on the Map
// constructor (Wave 2 wiring); if toDataURL fails the switch still completes without an overlay.
export function switchBasemap(map, next, { lightPreset, presenting, onReady, tween: tweenFn = tween, fadeMs = 350 } = {}) {
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
    map.once("style.load", () => {
      configureStandard(map, { lightPreset, presenting });
      if (onReady) onReady();
      map.once("idle", () => {
        if (!overlay || !fadeMs) { if (overlay) overlay.remove(); resolve(); return; }
        tweenFn({
          duration: fadeMs,
          onUpdate: (t) => { overlay.style.opacity = String(1 - t); },
          onDone: () => { overlay.remove(); resolve(); },
        });
      });
    });
    map.setStyle(url);
  });
}

// --- Legacy API (Wave 0). app.js and tests/layers.test.js still call tuneBasemap; the lead
// rewires them to configureStandard/switchBasemap in Wave 2. Kept so neighbors keep working.
const HIDE_SOURCE_LAYERS = new Set(["poi_label", "transit_stop_label", "airport_label", "natural_label", "natural_point_label", "natural_line_label", "water_point_label", "water_line_label", "housenum_label"]);

export function tuneBasemap(map, theme) {
  const style = map.getStyle ? map.getStyle() : null;
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

import { BREAKS, RAMP } from "../config.js";
import { THEMES } from "../theme.js";
import { DUR, tween } from "../motion.js";

// Lighter copy of a hex color for the hover state.
export function brighten(hex, amount = 0.3) {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).map(v => Math.round(v + (255 - v) * amount));
  return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
}

const ARTERIAL = ["Principal Arterial", "Minor Arterial"];
const HOVER = ["boolean", ["feature-state", "hover"], false];
const SELECTED = ["boolean", ["feature-state", "selected"], false];

// The three metric values live in feature-state (they depend on LOS and the year window); the color expression
// picks one, so a metric switch is an expression swap that can crossfade while LOS and year changes update in place.
export function metricValue(metric) { return ["coalesce", ["feature-state", metric], 0]; }

// Membership of a ward, read from the wards property. GeoJSON array properties may reach an expression as an
// array or as their JSON text ("[1,4]") depending on the tile path, so both forms are handled.
export function inWardExpression(ward) {
  if (ward == null) return true;
  const w = ["get", "wards"];
  const s = ["to-string", w];
  return ["case", ["==", ["typeof", w], "string"],
    ["any", ["in", `[${ward}]`, s], ["in", `[${ward},`, s], ["in", `,${ward},`, s], ["in", `,${ward}]`, s]],
    ["in", ward, w]];
}

export function primaryExpression(includeCollectors) {
  return includeCollectors ? true : ["in", ["get", "functional_class"], ["literal", ARTERIAL]];
}

export function colorExpression(metric, bright = false) {
  const b = BREAKS[metric];
  const ramp = bright ? RAMP.map(c => brighten(c)) : RAMP;
  return ["step", metricValue(metric), ramp[0], b[0], ramp[1], b[1], ramp[2], b[2], ramp[3], b[3], ramp[4]];
}

// Width grows with vehicles per day and with zoom, so segments neither vanish at z11 nor flood at z16.
export function widthExpression(extra = 0) {
  const byVpd = (lo, hi) => ["interpolate", ["linear"], ["get", "vpd_max"], 1000, lo + extra, 35000, hi + extra];
  return ["interpolate", ["linear"], ["zoom"], 10, byVpd(1.2, 3.2), 12.5, byVpd(2.2, 6.5), 14.5, byVpd(3.5, 10), 16.5, byVpd(5, 15)];
}

// Line opacity for a state, times a constant factor k (the crossfade handle).
export function lineOpacityExpression(state, k = 1) {
  const inWard = inWardExpression(state.ward), primary = primaryExpression(state.includeCollectors);
  return ["*", k, ["case", SELECTED, 1, HOVER, 1, ["all", inWard, primary], 0.95, inWard, 0.45, 0.2]];
}
export function casingOpacityExpression(state, casingOpacity) {
  return ["case", inWardExpression(state.ward), casingOpacity, 0.15];
}
export function lineColorForState(state) { return ["case", HOVER, colorExpression(state.metric, true), colorExpression(state.metric)]; }

let theme = THEMES.light;
export function setSegmentsTheme(map, name) {
  theme = THEMES[name] || THEMES.light;
  if (!map || !map.getLayer || !map.getLayer("segments-casing")) return;
  map.setPaintProperty("segments-casing", "line-color", theme["map-casing"]);
  map.setPaintProperty("segments-shared", "line-color", theme.ink);
  map.setPaintProperty("segments-selected-casing", "line-color", theme["map-casing"]);
  if (lastState) map.setPaintProperty("segments-casing", "line-opacity", casingOpacityExpression(lastState, theme["map-casing-opacity"]));
}

const T = { duration: DUR.mid };

export function addSegmentsLayer(map, segments) {
  if (!map.getSource("segments")) map.addSource("segments", { type: "geojson", data: segments, promoteId: "loc_id" });
  // One feature source for the selection, with lineMetrics so line-progress works for the pulse.
  if (!map.getSource("segments-selected")) map.addSource("segments-selected", { type: "geojson", data: { type: "FeatureCollection", features: [] }, lineMetrics: true });
  const base = { ward: null, includeCollectors: false, metric: "combined" };
  map.addLayer({ id: "segments-casing", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": theme["map-casing"], "line-width": widthExpression(3), "line-opacity": casingOpacityExpression(base, theme["map-casing-opacity"]),
             "line-color-transition": T, "line-opacity-transition": T } });
  // The ghost carries the previous color and opacity expressions during a crossfade, then sits at opacity 0.
  map.addLayer({ id: "segments-line-ghost", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": lineColorForState(base), "line-width": widthExpression(0), "line-opacity": lineOpacityExpression(base, 0) } });
  map.addLayer({ id: "segments-line", type: "line", source: "segments",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": lineColorForState(base),
             "line-width": ["case", HOVER, widthExpression(2), widthExpression(0)],
             "line-opacity": lineOpacityExpression(base, 1), "line-color-transition": T, "line-opacity-transition": T } });
  map.addLayer({ id: "segments-shared", type: "line", source: "segments", filter: ["==", ["get", "shared_boundary"], true],
    layout: { "line-cap": "butt" },
    paint: { "line-color": theme.ink, "line-width": 1, "line-dasharray": [2, 2], "line-offset": ["interpolate", ["linear"], ["zoom"], 10, 3, 16, 9],
             "line-opacity": ["case", inWardExpression(null), 0.6, 0.1], "line-opacity-transition": T } });
  map.addLayer({ id: "segments-selected-casing", type: "line", source: "segments-selected",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": theme["map-casing"], "line-width": widthExpression(8), "line-opacity": 0.95 } });
  map.addLayer({ id: "segments-selected", type: "line", source: "segments-selected",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": widthExpression(2), "line-opacity": 0.9, "line-gradient": pulseGradient(-1) } });
  lastState = null;
}

// A soft light that travels along the selected segment. p is the head position 0..1; -1 hides the light.
export function pulseGradient(p) {
  const w = 0.22;
  const stops = [];
  const add = (x, c) => stops.push(Math.max(0, Math.min(1, x)), c);
  if (p < 0) return ["interpolate", ["linear"], ["line-progress"], 0, "rgba(255,255,255,0)", 1, "rgba(255,255,255,0)"];
  p = Math.min(0.999, Math.max(0.001, p));
  add(0, "rgba(255,255,255,0)");
  if (p - w > 0) add(p - w, "rgba(255,255,255,0)");
  add(p, "rgba(255,255,255,0.95)");
  if (p + w * 0.4 < 1) add(p + w * 0.4, "rgba(255,255,255,0)");
  add(1, "rgba(255,255,255,0)");
  const out = ["interpolate", ["linear"], ["line-progress"]];
  let last = -1;
  for (let i = 0; i < stops.length; i += 2) { if (stops[i] > last) { out.push(stops[i], stops[i + 1]); last = stops[i]; } }
  return out;
}

let pulseHandle = null;
export function stopPulse() { if (pulseHandle && typeof cancelAnimationFrame === "function") cancelAnimationFrame(pulseHandle); pulseHandle = null; }

export function startPulse(map, period = 2400) {
  stopPulse();
  if (typeof requestAnimationFrame !== "function") return;
  let last = 0;
  const tick = (t) => {
    if (!map.getLayer("segments-selected")) { pulseHandle = null; return; }
    if (t - last > 33) { last = t; map.setPaintProperty("segments-selected", "line-gradient", pulseGradient((t % period) / period)); }
    pulseHandle = requestAnimationFrame(tick);
  };
  pulseHandle = requestAnimationFrame(tick);
}

let selected = null;
let hovered = null;
let lastState = null;
let cancelFade = null;

// Hover feature-state, driven by the table rows and by the map itself. null clears it.
export function setHover(map, locId) {
  if (!map.getSource || !map.getSource("segments")) return;
  if (hovered && hovered !== locId) map.setFeatureState({ source: "segments", id: hovered }, { hover: false });
  if (locId) map.setFeatureState({ source: "segments", id: locId }, { hover: true });
  hovered = locId;
}

// Puts the selected feature into its own source and runs the pulse (or a static bright casing under reduced motion).
export function setSelected(map, feature, { reducedMotion = false } = {}) {
  const src = map.getSource("segments-selected");
  if (!src) return;
  src.setData({ type: "FeatureCollection", features: feature ? [feature] : [] });
  stopPulse();
  if (!feature) return;
  if (reducedMotion) map.setPaintProperty("segments-selected", "line-gradient", pulseGradient(-1));
  else startPulse(map);
}

// Did the change call for a crossfade (expression swap) rather than an in-place feature-state update?
export function needsCrossfade(prev, next) {
  return !!prev && (prev.metric !== next.metric || prev.ward !== next.ward || prev.includeCollectors !== next.includeCollectors);
}

// State changes write feature-state instead of replacing the source data, so the 250 KB geojson is parsed and
// tiled once. data is applyState(state): its derived values are copied into feature-state per feature.
export function updateSegments(map, state, data) {
  if (!map.getSource("segments")) return;
  const prev = lastState;
  for (const f of data.features) {
    const p = f.properties;
    map.setFeatureState({ source: "segments", id: p.loc_id }, { combined: p.combined_active == null ? 0 : p.combined_active, v_c: p.v_c_active == null ? 0 : p.v_c_active, collisions: p.collisions_active == null ? 0 : p.collisions_active });
  }
  const fade = needsCrossfade(lastState, state) && !state.reducedMotion;
  if (cancelFade) { cancelFade(); cancelFade = null; }
  if (fade && map.getLayer("segments-line-ghost")) {
    map.setPaintProperty("segments-line-ghost", "line-color", lineColorForState(lastState));
    map.setPaintProperty("segments-line-ghost", "line-opacity", lineOpacityExpression(lastState, 1));
    map.setPaintProperty("segments-line", "line-color", lineColorForState(state));
    map.setPaintProperty("segments-line", "line-opacity", lineOpacityExpression(state, 0));
    cancelFade = tween({ duration: DUR.mid, onUpdate: (t) => {
      map.setPaintProperty("segments-line-ghost", "line-opacity", lineOpacityExpression(prev, 1 - t));
      map.setPaintProperty("segments-line", "line-opacity", lineOpacityExpression(state, t));
    }, onDone: () => { cancelFade = null; } });
  } else {
    map.setPaintProperty("segments-line", "line-color", lineColorForState(state));
    map.setPaintProperty("segments-line", "line-opacity", lineOpacityExpression(state, 1));
    if (map.getLayer("segments-line-ghost")) map.setPaintProperty("segments-line-ghost", "line-opacity", lineOpacityExpression(state, 0));
  }
  map.setPaintProperty("segments-casing", "line-opacity", casingOpacityExpression(state, theme["map-casing-opacity"]));
  map.setPaintProperty("segments-shared", "line-opacity", ["case", inWardExpression(state.ward), 0.6, 0.1]);
  if (selected && selected !== state.selectedLocId) map.setFeatureState({ source: "segments", id: selected }, { selected: false });
  if (state.selectedLocId) map.setFeatureState({ source: "segments", id: state.selectedLocId }, { selected: true });
  if (selected !== state.selectedLocId) {
    const f = state.selectedLocId ? data.features.find(x => x.properties.loc_id === state.selectedLocId) : null;
    setSelected(map, f || null, { reducedMotion: state.reducedMotion });
  }
  selected = state.selectedLocId;
  lastState = { metric: state.metric, ward: state.ward, includeCollectors: state.includeCollectors };
}

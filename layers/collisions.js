// ## WHAT THIS FILE DOES
// The crash records: a heatmap layer for the zoomed out view and a circle layer for the dots that take over
// past zoom 13.6, plus the year filter, the heat fade, the dots mode used by scenes, the per segment crash
// reveal and the ward dim. Imports config.js (COLL short keys, blue ramp), theme.js and motion.js. Called from
// app.js (addAllLayers, render, applySceneLayers, flyToWard) and the layers and tour tests.
import { BLUE_RAMP, COLL } from "../config.js";
import { COLLISION_COLORS } from "../theme.js";
import { DUR, clamp01, lerp, tween } from "../motion.js";

// Paint transitions are module constants that nothing else zeroes, so they are built from the reduced motion flag.
const transitionFor = (reducedMotion) => ({ duration: reducedMotion ? 0 : DUR.mid });

// ## Heat paint
// A heatmap layer sums a kernel around every point and colors the density. Radius and intensity grow with
// zoom so the surface stays readable; the color ramp is the blue sequential ramp from config.js.
// Heat, explore supporting role (design section 8): quiet surface that hands off to dots at 13.6.
export const HEAT_OPACITY = 0.45;
const HEAT_RADIUS = ["interpolate", ["linear"], ["zoom"], 10, 8, 14, 18];
const HEAT_INTENSITY = ["interpolate", ["linear"], ["zoom"], 10, 0.3, 14, 0.8];
const HEAT_COLOR = ["interpolate", ["linear"], ["heatmap-density"],
  0, "rgba(134,182,239,0)", 0.3, BLUE_RAMP[0], 0.5, BLUE_RAMP[1], 0.7, BLUE_RAMP[2], 0.85, BLUE_RAMP[3], 1, BLUE_RAMP[4]];

// ## Dots paint and the reveal expressions
// Mapbox concept: an expression with ["zoom"] as the input of a top level interpolate is a zoom curve; the
// library only accepts zoom at the top level, so per feature factors (the reveal t) go inside the outputs.
// Below 13 the crashes read as a density surface; the dots crossfade in across 0.6 zoom.
export const CROSSFADE = { from: 13.0, to: 13.6 };
const DOTS_OPACITY = ["interpolate", ["linear"], ["zoom"], CROSSFADE.from, 0, CROSSFADE.to, 0.85];
// During a crash reveal the segment's dots carry feature state t (radius grows 0 -> final); everything else dims to 12 percent.
const REVEAL_OPACITY = ["*", DOTS_OPACITY, ["case", ["!=", ["feature-state", "t"], null], 1, 0.12]];
// The reveal factor multiplies the radius INSIDE the zoom curve's outputs: a zoom curve must stay the top level
// expression of a paint value (tests/expressions.test.js), and data expressions in the outputs are fine.
const REVEAL_T = ["coalesce", ["feature-state", "t"], 1];
const DOTS_RADIUS = ["interpolate", ["linear"], ["zoom"], CROSSFADE.from, ["*", 1.6, REVEAL_T], 16, ["*", 4.2, REVEAL_T]];

// ## Year filters
// Mapbox concept: a layer filter is an expression that decides which features draw at all. The year window
// is a filter so crashes outside it cost nothing to render.
// Collisions outside the selected years are filtered, not dimmed. Property names come from COLL (the slim short keys).
const yearClauses = (state) => (state && state.yearMin != null
  ? [[">=", ["get", COLL.year], state.yearMin], ["<=", ["get", COLL.year], state.yearMax]]
  : []);
export function yearFilter(state) {
  return ["all", ...yearClauses(state)];
}
const windowFilter = (state) => {
  const c = yearClauses(state);
  return c.length > 1 ? ["all", ...c] : c[0] || null;
};

// ## circleColor: dot color by assignment category
// Slim data carries category codes; theme colors are keyed by the full names. x falls back to the muted color.
export const circleColor = ["match", ["get", COLL.cat],
  "a", COLLISION_COLORS.assigned, "s", COLLISION_COLORS.shared_intersection_resolved,
  "n", COLLISION_COLORS.on_road_no_segment, "r", COLLISION_COLORS.road_not_counted, COLLISION_COLORS.on_road_no_segment];

// ## Per map bookkeeping
// Stored in a WeakMap keyed by the map object so tests with several map doubles do not share state.
// Per-map bookkeeping: year window, dots mode, current heat opacity and the crash index the reveal tweens.
const maps = new WeakMap();
function metaFor(map) {
  let m = maps.get(map);
  if (!m) {
    m = { state: null, mode: "all", locId: null, heatOpacity: HEAT_OPACITY, crashIndex: new Map(), revealIds: [], cancelReveal: null };
    maps.set(map, m);
  }
  return m;
}
function dotsFilter(meta) {
  const clauses = yearClauses(meta.state);
  if (meta.mode === "segment" && meta.locId) clauses.push(["==", ["get", COLL.loc], meta.locId]);
  return clauses.length > 1 ? ["all", ...clauses] : clauses[0] || null;
}

// ## addCollisionsLayer: one source, two layers, plus the crash index for the reveal
// generateId gives every crash a numeric feature id (the slim file has none), which the reveal needs to write
// feature state per dot. The index maps loc_id to year to those ids.
export function addCollisionsLayer(map, collisions, state) {
  const T = transitionFor(!!(state && state.reducedMotion));
  const meta = metaFor(map);
  meta.state = state || null;
  // generateId ids the features in order; index them by loc id and year so the reveal can stagger 2021 first.
  meta.crashIndex = new Map();
  for (const [i, f] of (collisions.features || []).entries()) {
    const p = f.properties || {};
    const loc = p[COLL.loc];
    if (!loc) continue;
    const id = f.id != null ? f.id : i;
    let byYear = meta.crashIndex.get(loc);
    if (!byYear) meta.crashIndex.set(loc, (byYear = new Map()));
    const y = p[COLL.year];
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(id);
  }
  meta.heatOpacity = !state || state.heat !== false ? HEAT_OPACITY : 0;
  if (!map.getSource("collisions")) map.addSource("collisions", { type: "geojson", data: collisions, generateId: true });
  map.addLayer({ id: "collisions-heat", type: "heatmap", source: "collisions", slot: "middle", maxzoom: CROSSFADE.to, filter: windowFilter(state),
    paint: { "heatmap-weight": 1, "heatmap-radius": HEAT_RADIUS, "heatmap-intensity": HEAT_INTENSITY, "heatmap-color": HEAT_COLOR,
             "heatmap-opacity": meta.heatOpacity, "heatmap-opacity-transition": T } });
  map.addLayer({ id: "collisions-dots", type: "circle", source: "collisions", slot: "top", minzoom: CROSSFADE.from, filter: dotsFilter(meta),
    paint: { "circle-radius": DOTS_RADIUS,
             "circle-color": circleColor,
             "circle-stroke-color": "#fbfaf7", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 13, 0.4, 16, 1],
             "circle-opacity": DOTS_OPACITY, "circle-stroke-opacity": DOTS_OPACITY,
             "circle-emissive-strength": 1,
             "circle-opacity-transition": T, "circle-color-transition": T } });
}

// ## updateCollisions: reapply the year window on every render
export function updateCollisions(map, state) {
  const meta = metaFor(map);
  if (state) meta.state = state;
  if (map.getLayer("collisions-heat")) map.setFilter("collisions-heat", windowFilter(meta.state));
  if (map.getLayer("collisions-dots") && meta.mode !== "none") map.setFilter("collisions-dots", dotsFilter(meta));
}

// ## setHeatVisible: the heat fade used by the Settings switch and the heat scene
// Fades the heat layer in or out (present scene 3) with the injectable tween; 600 ms by default.
// Guards the layer: a scene entered before the style finished loading records the intent and no-ops.
export function setHeatVisible(map, visible, { fadeMs = 600, tween: tweenFn } = {}) {
  const meta = metaFor(map);
  const from = meta.heatOpacity, to = visible ? HEAT_OPACITY : 0;
  meta.heatOpacity = to;
  if (!map.getLayer || !map.getLayer("collisions-heat")) return () => {};
  const tw = tweenFn || tween;
  return tw({ duration: fadeMs, onUpdate: (p) => { if (map.getLayer("collisions-heat")) map.setPaintProperty("collisions-heat", "heatmap-opacity", lerp(from, to, p)); } });
}

// ## setDotsMode: which crash dots a scene shows
// "all" shows the year window, "segment" narrows the dots to one loc id, "none" hides them.
export function setDotsMode(map, mode, { locId } = {}) {
  const meta = metaFor(map);
  meta.mode = mode;
  meta.locId = locId || null;
  if (!map.getLayer || !map.getLayer("collisions-dots")) return;
  if (mode === "none") { map.setLayoutProperty("collisions-dots", "visibility", "none"); return; }
  map.setLayoutProperty("collisions-dots", "visibility", "visible");
  map.setFilter("collisions-dots", dotsFilter(meta));
}

// ## Crash reveal: clearReveal and revealSegmentCrashes
// On a segment scene the segment's own crashes grow in one year at a time (2021 first) while every other
// dot dims, so the eye reads the count on the road. Each dot's progress lives in feature state "t".
function clearReveal(map, meta) {
  if (meta.cancelReveal) { meta.cancelReveal(); meta.cancelReveal = null; }
  if (!meta.revealIds.length) return;
  const hasSource = map.getSource && map.getSource("collisions");
  for (const id of meta.revealIds) {
    if (!hasSource) break;
    if (typeof map.removeFeatureState === "function") map.removeFeatureState({ source: "collisions", id }, "t");
    else map.setFeatureState({ source: "collisions", id }, { t: null });
  }
  meta.revealIds = [];
  if (map.getLayer && map.getLayer("collisions-dots")) map.setPaintProperty("collisions-dots", "circle-opacity", DOTS_OPACITY);
}

// The segment's crash dots drop in over 900 ms, staggered by year (2021 first); the rest dim to 12 percent.
// Under reduced motion the dots are simply present. Returns a cancel that restores the plain crossfade.
export function revealSegmentCrashes(map, locId, { duration: ms = 900, reduced = false, tween: tweenFn } = {}) {
  const meta = metaFor(map);
  clearReveal(map, meta);
  if (!map.getLayer || !map.getLayer("collisions-dots")) return () => {};
  const byYear = meta.crashIndex.get(locId);
  if (!byYear || !byYear.size) return () => {};
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const groups = years.map((y) => byYear.get(y));
  const ids = groups.flat();
  meta.revealIds = ids;
  for (const id of ids) map.setFeatureState({ source: "collisions", id }, { t: 0 });
  map.setPaintProperty("collisions-dots", "circle-opacity", REVEAL_OPACITY);
  if (reduced || !ms) {
    for (const id of ids) map.setFeatureState({ source: "collisions", id }, { t: 1 });
    return () => clearReveal(map, meta);
  }
  const n = groups.length, per = ms * 0.6;
  const delay = (i) => (n > 1 ? (i / (n - 1)) * ms * 0.4 : 0);
  const last = new Array(n).fill(0);
  const tw = tweenFn || tween;
  meta.cancelReveal = tw({ duration: ms, onUpdate: (p) => {
    if (map.getLayer && !map.getLayer("collisions-dots")) return;   // a style swap wiped the layer mid-reveal
    const elapsed = p * ms;
    groups.forEach((g, i) => {
      const tv = clamp01((elapsed - delay(i)) / per);
      if (tv !== last[i]) { last[i] = tv; for (const id of g) map.setFeatureState({ source: "collisions", id }, { t: tv }); }
    });
  } });
  return () => clearReveal(map, meta);
}

// ## dimOutsideWard: the ["within", polygon] expression
// Ward select: crashes outside the ward dim to 25 percent. null restores.
export function dimOutsideWard(map, wardFeature) {
  if (!map.getLayer("collisions-dots")) return;
  if (!wardFeature) { map.setPaintProperty("collisions-dots", "circle-opacity", DOTS_OPACITY); return; }
  const geometry = wardFeature.geometry || wardFeature;
  map.setPaintProperty("collisions-dots", "circle-opacity", ["*", DOTS_OPACITY, ["case", ["within", geometry], 1, 0.25]]);
}

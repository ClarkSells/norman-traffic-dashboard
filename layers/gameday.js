// OU game day overlay (CONTRACTS C.16, C.17): the routed stadium traffic from daytypes.json as thin dashed
// lines from each interchange to the stadium, the origins as small labeled points. The dash animates with the
// flow.js ant path cycle on injectable timers; under reduced motion the dash rests. Sources are filled once from
// daytypes.json; setGamedayVisible shows the three layers only while state.daytype is "gameday".
import { dashSequence } from "./flow.js";
import { THEMES } from "../theme.js";

export const ROUTES_SOURCE = "gameday-routes";
export const ORIGINS_SOURCE = "gameday-origins";
export const GAMEDAY_LAYERS = ["gameday-routes", "gameday-origins", "gameday-origin-labels"];
export const GAMEDAY_DASH = { dash: 2, gap: 3 };
export const GAMEDAY_STEP_MS = 90;
const BEFORE_ID = "segments-selected-casing";
const EMPTY = { type: "FeatureCollection", features: [] };

// One line per route, width by its share of the stadium traffic.
export function routesFc(daytypes) {
  const g = daytypes && daytypes.gameday;
  if (!g || !Array.isArray(g.routes)) return EMPTY;
  return { type: "FeatureCollection", features: g.routes.filter(r => Array.isArray(r.path) && r.path.length >= 2).map(r => ({
    type: "Feature", properties: { origin: r.origin, share: r.share != null ? r.share : 0 }, geometry: { type: "LineString", coordinates: r.path } })) };
}

// The interchanges as points with a label ("I-35 at Lindsey, 25%"), plus the stadium itself.
export function originsFc(daytypes) {
  const g = daytypes && daytypes.gameday;
  if (!g) return EMPTY;
  const feats = (Array.isArray(g.origins) ? g.origins : []).filter(o => o.lon != null && o.lat != null).map(o => ({
    type: "Feature", properties: { name: o.name, share: o.share, text: o.share != null ? `${o.name}, ${Math.round(o.share * 100)}%` : o.name, kind: "origin" }, geometry: { type: "Point", coordinates: [o.lon, o.lat] } }));
  if (Array.isArray(g.stadium) && g.stadium.length === 2) feats.push({ type: "Feature", properties: { name: "Stadium", text: "Stadium", kind: "stadium" }, geometry: { type: "Point", coordinates: g.stadium } });
  return { type: "FeatureCollection", features: feats };
}

let theme = THEMES.light;
export function setGamedayTheme(map, name) {
  theme = THEMES[name] || THEMES.light;
  if (!map || !map.getLayer || !map.getLayer("gameday-routes")) return;
  map.setPaintProperty("gameday-routes", "line-color", theme.ink);
  map.setPaintProperty("gameday-origins", "circle-color", theme.surface);
  map.setPaintProperty("gameday-origins", "circle-stroke-color", theme.ink);
  map.setPaintProperty("gameday-origin-labels", "text-color", theme.ink);
  map.setPaintProperty("gameday-origin-labels", "text-halo-color", theme.surface);
}

export function addGamedayLayers(map, daytypes, { visible = false } = {}) {
  if (!map.getSource(ROUTES_SOURCE)) map.addSource(ROUTES_SOURCE, { type: "geojson", data: routesFc(daytypes) });
  if (!map.getSource(ORIGINS_SOURCE)) map.addSource(ORIGINS_SOURCE, { type: "geojson", data: originsFc(daytypes) });
  const before = map.getLayer && map.getLayer(BEFORE_ID) ? BEFORE_ID : undefined;
  const visibility = visible ? "visible" : "none";
  if (!map.getLayer("gameday-routes")) {
    map.addLayer({ id: "gameday-routes", type: "line", source: ROUTES_SOURCE, slot: "top",
      layout: { "line-cap": "butt", "line-join": "round", visibility },
      paint: { "line-color": theme.ink, "line-width": ["interpolate", ["linear"], ["get", "share"], 0.05, 1.2, 0.25, 3], "line-opacity": 0.85,
               "line-dasharray": dashSequence(GAMEDAY_DASH.dash, GAMEDAY_DASH.gap)[0], "line-emissive-strength": 1 } }, before);
  }
  if (!map.getLayer("gameday-origins")) {
    map.addLayer({ id: "gameday-origins", type: "circle", source: ORIGINS_SOURCE, slot: "top",
      layout: { visibility },
      paint: { "circle-radius": ["case", ["==", ["get", "kind"], "stadium"], 6, 4], "circle-color": theme.surface, "circle-stroke-color": theme.ink, "circle-stroke-width": 1.5, "circle-emissive-strength": 1 } }, before);
  }
  if (!map.getLayer("gameday-origin-labels")) {
    map.addLayer({ id: "gameday-origin-labels", type: "symbol", source: ORIGINS_SOURCE, slot: "top",
      layout: { visibility, "text-field": ["get", "text"], "text-size": 11, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"], "text-anchor": "left", "text-offset": [0.7, 0], "text-allow-overlap": true, "text-ignore-placement": true },
      paint: { "text-color": theme.ink, "text-halo-color": theme.surface, "text-halo-width": 1.4, "text-emissive-strength": 1 } }, before);
  }
}

export function setGamedayVisible(map, visible) {
  for (const id of GAMEDAY_LAYERS) {
    if (map.getLayer && !map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

// The dash cycle on the routes: at most one setPaintProperty per 50 ms, nothing while hidden(), stop() cancels.
// The caller decides about reduced motion (never start it then), as with flow.js.
export function startGamedayFlow(map, { now, raf, caf, hidden, stepMs = GAMEDAY_STEP_MS } = {}) {
  const t = now || (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  const request = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : null);
  const cancel = caf || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});
  const isHidden = hidden || (() => typeof document !== "undefined" && !!document.hidden);
  if (!request) return () => {};
  const seq = dashSequence(GAMEDAY_DASH.dash, GAMEDAY_DASH.gap);
  let last = -1, lastRun = -Infinity, handle = null, stopped = false;
  const tick = () => {
    if (stopped) return;
    const time = t();
    if (!isHidden() && time - lastRun >= 50 && (!map.getLayer || map.getLayer("gameday-routes"))) {
      lastRun = time;
      const s = Math.floor(time / stepMs) % seq.length;
      if (s !== last) { last = s; map.setPaintProperty("gameday-routes", "line-dasharray", seq[s]); }
    }
    handle = request(tick);
  };
  handle = request(tick);
  return function stop() { stopped = true; if (handle != null) cancel(handle); handle = null; };
}

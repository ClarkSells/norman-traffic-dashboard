// ## WHAT THIS FILE DOES
// The ranked labels the present scenes place next to segments ("#1  W Main St"). One point source and one
// symbol layer; showCallouts rewrites the source data, clearCallouts empties it. Imports nothing. Called from
// app.js (applySceneLayers, onExitPresent) and the callouts tests.
// Scene callouts (design section 9): a symbol layer that labels ranked segments on the map.
// One empty point source and one symbol layer, added once per style load; scenes rewrite the
// source data with showCallouts and empty it with clearCallouts. Contract C.8.

export const CALLOUT_SOURCE = "callouts";
export const CALLOUT_LAYER = "callouts";

const EMPTY = { type: "FeatureCollection", features: [] };

// ## calloutAnchor: which side of the point the text sits on
// The label sits beside the line, so the text-anchor rotates with the segment bearing:
// a N-S line (bearing near 0 or 180) takes a side anchor, an E-W line takes top or bottom.
// "left"/"right" mean the text grows away from the point to the east/west; "bottom"/"top"
// mean the text sits above/below the point (Mapbox anchors the named edge at the point).
export function calloutAnchor(bearingDeg) {
  const b = ((bearingDeg % 360) + 360) % 360;
  if (b >= 45 && b < 135) return "bottom";
  if (b >= 135 && b < 225) return "right";
  if (b >= 225 && b < 315) return "top";
  return "left";
}

// ## addCalloutLayer: the symbol layer
// Mapbox concept: a symbol layer draws text or icons at points. text-field reads a property, text-anchor
// places the text relative to the point, and the overlap flags opt out of Mapbox's label collision pass.
// The one place the map draws our own type; everything else is HTML. The halo defaults to the
// explore light paper (--paper #f6f4ee); the caller may restyle text-color/halo for present dusk
// via setPaintProperty on CALLOUT_LAYER. text-emissive-strength 1 keeps the labels readable under
// the dusk light preset. The font stack is the cheatsheet section 8 recipe. Callouts are few and
// ranked, and per design section 9 they ARE the story: text-allow-overlap + text-ignore-placement
// keep them from ever losing the collision to the basemap's own road labels (3.1-03, 3.2-05),
// while symbol-sort-key by rank still decides which label draws on top when two callouts meet.
export function addCalloutLayer(map) {
  if (!map.getSource(CALLOUT_SOURCE)) map.addSource(CALLOUT_SOURCE, { type: "geojson", data: EMPTY });
  if (map.getLayer(CALLOUT_LAYER)) return;
  map.addLayer({
    id: CALLOUT_LAYER, type: "symbol", source: CALLOUT_SOURCE, slot: "top",
    layout: {
      "text-field": ["get", "text"],
      "text-size": 13,
      "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
      "text-anchor": ["get", "anchor"],
      "text-offset": [0.8, 0],
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "symbol-sort-key": ["get", "rank"],
    },
    paint: {
      "text-color": "#1c1b18",
      "text-halo-color": "#f6f4ee",
      "text-halo-width": 1.6,
      "text-emissive-strength": 1,
    },
  });
}

// ## showCallouts and clearCallouts
// items: [{ locId, text, rank, lngLat, bearing }] — text already formatted ("#1  W Main St").
// Replaces the source data; the anchor is derived per item so each label sits beside its line.
export function showCallouts(map, items) {
  if (!map.getLayer(CALLOUT_LAYER)) addCalloutLayer(map);
  const src = map.getSource(CALLOUT_SOURCE);
  if (!src) return;
  src.setData({
    type: "FeatureCollection",
    features: (items || []).map(it => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: it.lngLat },
      properties: { locId: it.locId, text: it.text, rank: it.rank, anchor: calloutAnchor(it.bearing) },
    })),
  });
}

export function clearCallouts(map) {
  const src = map.getSource && map.getSource(CALLOUT_SOURCE);
  if (src) src.setData(EMPTY);
}

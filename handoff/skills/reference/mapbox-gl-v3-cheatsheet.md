# Mapbox GL JS v3 cheatsheet for this project

Scope: only what the task cards need. Items marked VERIFY were written from memory of the API and must be checked against the linked page before use (Kimi has web access; the lead fetches each page once and pastes the verified snippet into CONTRACTS.md if it differs). Everything else was confirmed against docs.mapbox.com on 2026-10-03.

The full documentation index for an agent is `https://docs.mapbox.com/mapbox-gl-js/llms.txt` (plain text, one URL per page). The Map API reference is `https://docs.mapbox.com/mapbox-gl-js/api/map.md`.

## 1. Loading and lifecycle

```js
mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({ container: "map", style: "mapbox://styles/mapbox/standard", center, zoom, pitch, bearing });
map.on("style.load", () => { /* add sources and layers here; fires again after every setStyle */ });
map.on("load", () => { /* first style and tiles ready, fires once */ });
map.on("idle", () => { /* no pending tiles or animations; fires repeatedly */ });
map.resize();   // call whenever the container's box changed without a window resize (this project's A1 bug)
```

Style switching loses custom sources and layers; re-add them in `style.load` (confirmed: https://docs.mapbox.com/mapbox-gl-js/example/style-switch.md). The current `app.js` already does this through `addAllLayers`.

## 2. Mapbox Standard style (confirmed: https://docs.mapbox.com/mapbox-gl-js/example/set-config-property.md and https://docs.mapbox.com/mapbox-gl-js/guides/styles/work-with-layers.md)

```js
const STANDARD = "mapbox://styles/mapbox/standard";
const STANDARD_SATELLITE = "mapbox://styles/mapbox/standard-satellite";

map.setConfigProperty("basemap", "lightPreset", "dusk");   // "dawn" | "day" | "dusk" | "night"
map.setConfigProperty("basemap", "showPlaceLabels", true);
map.setConfigProperty("basemap", "showRoadLabels", true);
map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
map.setConfigProperty("basemap", "showTransitLabels", false);
// VERIFY against https://docs.mapbox.com/style-spec/reference/standard/ : "show3dObjects" (boolean), "theme" ("default" | "faded" | "monochrome"),
// "font", "colorBuildingHighlight", "colorBuildingSelect". If "theme" is unsupported on 3.6.0, lower basemap emphasis by keeping the
// dusk preset and using line-emissive-strength on the data layers instead.
```

Detect Standard at runtime: `map.getStyle().imports` is a non empty array (the existing `isStandardStyle` in `layers/basemap.js`).

Slots (confirmed):

| slot | sits |
|---|---|
| `bottom` | above polygons (land, landuse, water) |
| `middle` | above lines (roads) and behind 3D buildings |
| `top` | above POI labels and behind place and transit labels |
| none | above every style layer |

```js
map.addLayer({ id: "wards-fill", type: "fill", source: "wards", slot: "bottom", paint: { ... } });
map.addLayer({ id: "segments-line", type: "line", source: "segments", slot: "top", paint: { ... } });
```

`beforeId` only orders layers inside the same slot; across slots it is ignored. Use `slot` instead of a basemap layer id when inserting into Standard.

3D buildings come with Standard; there is no separate `fill-extrusion` layer to add (the classic `3d-buildings` example is for legacy styles: https://docs.mapbox.com/mapbox-gl-js/example/3d-buildings.md). Pitch 45 to 65 shows them.

Emissive data layers under dusk and night lighting: set `"line-emissive-strength": 1` (and `"circle-emissive-strength": 1`) so the orange segments and blue dots are not darkened by the scene light. Confirmed in the ant path example.

## 3. Terrain and fog (not used by this design; here for completeness)

```js
map.addSource("mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 });
map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
map.setFog({ range: [-1, 2], "horizon-blend": 0.3, color: "white", "high-color": "#add8e6", "space-color": "#d8f2ff", "star-intensity": 0.0 });
```

## 4. Camera (VERIFY option defaults at https://docs.mapbox.com/mapbox-gl-js/api/map.md, sections flyTo, easeTo, fitBounds, rotateTo, cameraForBounds)

```js
map.flyTo({ center, zoom, pitch, bearing, curve: 1.42 /* default */, speed: 1.2 /* default */, screenSpeed, maxDuration, essential: true, easing });
map.easeTo({ center, zoom, pitch, bearing, duration, easing, essential: true, padding: { top, right, bottom, left } });
map.jumpTo({ center, zoom, pitch, bearing });
map.rotateTo(bearing, { duration, easing });
map.fitBounds([[west, south], [east, north]], { padding: { top, right, bottom, left }, maxZoom, pitch, bearing, duration, linear: false });
const cam = map.cameraForBounds([[w, s], [e, n]], { padding, bearing, maxZoom });   // -> { center, zoom, bearing } or undefined
map.stop();            // cancels any in flight camera animation
map.once("moveend", cb);
```

Notes that matter here:
- `essential: true` makes the animation run even when the OS asks for reduced motion; this project does the opposite on purpose (the camera module checks `reduced` and uses `jumpTo`), so pass `essential: true` only where the move carries meaning and the reduced branch is handled by hand.
- A long `rotateTo` with `easing: t => t` is the orbit. Cancel it with `map.stop()` on user input (`map.on("mousedown" | "wheel" | "touchstart", ...)`).
- `padding` on `fitBounds` and `easeTo` is how the caption card gets out of the way; compute it from the card's `getBoundingClientRect()` each time (card 1.5 `presentationPadding`).
- Example references: fly to https://docs.mapbox.com/mapbox-gl-js/example/flyto.md, orbit https://docs.mapbox.com/mapbox-gl-js/example/animate-camera-around-point.md, chapter driven camera https://docs.mapbox.com/mapbox-gl-js/example/scroll-fly-to.md and the storytelling template in `reference/mapbox-storytelling/`.

## 5. Style switch without a black frame (project pattern, cards 1.2 and 2.1)

```js
export async function switchBasemap(map, nextUrl, { onReady, fadeMs = 350 }) {
  const canvas = map.getCanvas();
  const img = document.createElement("img");
  img.src = canvas.toDataURL("image/jpeg", 0.85);   // needs preserveDrawingBuffer: true on the Map, or take the snapshot inside a 'render' callback (VERIFY which 3.6.0 needs)
  img.className = "style-crossfade"; mapEl.appendChild(img);
  map.once("style.load", () => onReady());           // app re-adds layers and config here
  map.setStyle(nextUrl);
  await new Promise(r => map.once("idle", r));
  img.style.transition = `opacity ${fadeMs}ms`; img.style.opacity = "0";
  await new Promise(r => setTimeout(r, fadeMs)); img.remove();
}
```

If `toDataURL` returns a blank image, construct the map with `preserveDrawingBuffer: true` (small performance cost) or capture during `map.once("render")`. Decide once in card 1.2 and record it in NOTES.

## 6. Animated flow line (confirmed: https://docs.mapbox.com/mapbox-gl-js/example/animate-ant-path.md)

```js
const dashArraySequence = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]
];
let step = 0;
function animateDashArray(timestamp) {
  const newStep = parseInt((timestamp / 50) % dashArraySequence.length);
  if (newStep !== step) { map.setPaintProperty("line-dashed", "line-dasharray", dashArraySequence[step]); step = newStep; }
  requestAnimationFrame(animateDashArray);
}
map.addLayer({ id: "line-background", type: "line", source: "line", paint: { "line-color": "yellow", "line-width": 6, "line-opacity": 0.4 } });
map.addLayer({ id: "line-dashed", type: "line", source: "line", paint: { "line-color": "yellow", "line-width": 6, "line-dasharray": [0, 4, 3], "line-emissive-strength": 1 } });
animateDashArray(0);
```

Project adaptations (card 1.7): generalize the sequence to `dashSequence(dash, gap)` (dash plus gap constant across the cycle so it tiles); one layer per VPD band with a filter, because `line-dasharray` is not data driven; the `timestamp / stepMs` divisor sets speed per layer (free flow 45 ms, moderate 70 ms, congested 110 ms); `line-dasharray` units are multiples of `line-width`; dash direction follows the line's vertex order. Stop the loop on `document.hidden`, on exit, during `flyTo`, and never start it under reduced motion.

Alternative for a smoother gradient flow (not chosen): `line-gradient` with `lineMetrics: true` on the source, https://docs.mapbox.com/mapbox-gl-js/example/line-gradient.md and https://docs.mapbox.com/mapbox-gl-js/example/animate-a-line.md.

## 7. Heatmap and circles (confirmed example: https://docs.mapbox.com/mapbox-gl-js/example/heatmap-layer.md)

Paint properties used by card 1.8: `heatmap-weight`, `heatmap-intensity`, `heatmap-radius`, `heatmap-color` (interpolate on `["heatmap-density"]`, first stop must be transparent), `heatmap-opacity`, plus layer `maxzoom`. Circles: `circle-radius`, `circle-color`, `circle-opacity`, `circle-stroke-*`, `circle-emissive-strength`, layer `minzoom`. Feature state for the crash reveal: `map.setFeatureState({ source: "collisions", id }, { t })` requires feature ids (`generateId: true` on `addSource`, or `promoteId` on a stable property); the current source has no ids, so card 1.8 adds `generateId: true` and tracks ids by index, or uses `promoteId` if the slim script writes a stable id (coordinate through the lead).

`within` expression for ward dimming: `["within", wardPolygonGeoJSON]` evaluates per feature (VERIFY it accepts a Feature or Geometry object; the style spec expression reference is https://docs.mapbox.com/style-spec/reference/expressions/).

## 8. Symbol callouts (card 1.9)

```js
map.addSource("callouts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
map.addLayer({ id: "callouts", type: "symbol", source: "callouts", slot: "top",
  layout: { "text-field": ["get", "text"], "text-size": 13, "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
            "text-anchor": ["get", "anchor"], "text-offset": [0.8, 0], "text-allow-overlap": false, "symbol-sort-key": ["get", "rank"] },
  paint: { "text-color": "#1c1b18", "text-halo-color": "#f6f4ee", "text-halo-width": 1.6, "text-emissive-strength": 1 } });
```

Fonts available in Mapbox styles are the style's own glyph set (`DIN Pro` in classic styles; VERIFY the Standard style font names). The callout text is the only place the map draws our own type; everything else is HTML.

## 9. Performance notes (see `skills/mapbox/mapbox-web-performance-patterns`)

- Add layers once per style load; toggle with `setLayoutProperty(id, "visibility", ...)` and `setFilter`, never re-add.
- One `setPaintProperty` per layer per animation step; batch state changes before the next frame.
- GeoJSON sources: fewer properties and 5 decimal coordinates cut parse time as much as bytes; `buffer` and `tolerance` can be tuned on `addSource`.
- Avoid rendering the heatmap and 21k circles in the same zoom window; keep the crossfade narrow and hide the heat layer during long camera flights in presentation.
- Layer scoped `mousemove` events (as the current code does) beat `queryRenderedFeatures` on every move.

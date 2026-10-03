# Contracts

The lead writes these into `CONTRACTS.md` in Wave 0 verbatim. A card's Interfaces block repeats its slice. If a card and `CONTRACTS.md` disagree, `CONTRACTS.md` wins and the agent reports it.

## C.1 State (`state.js`, existing shape plus three keys)

```
{ ward: null|1..8, metric: "combined"|"v_c"|"collisions", los: "E"|"C", yearMin, yearMax,
  includeCollectors: bool, selectedLocId: null|string, basemap: "light"|"satellite",
  reducedMotion: bool,
  heat: bool,        // new, default true in explore
  flow: bool,        // new, default false in explore
  presenting: bool   // new, true while a scene is on screen
}
```

## C.2 Scene (`scenes.js`)

```js
// buildScenes(raw) -> Scene[]   (raw = getRaw(): segments, wards, collisions, points, summary)
// Scene = {
//   id: string, index: number, number: number, total: number,
//   kind: "title"|"city"|"segment"|"ward"|"closing",
//   title: string, caption: string,
//   stats: [{ label: string, value: string }],         // 0 to 5 items, values already formatted
//   legend: null | "combined" | "v_c" | "collisions",  // inline legend chip
//   list: null | [{ rank, locId, road, span, score }], // ward scene top five
//   state: full dashboard state (C.1) for this scene, never a partial patch,
//   basemap: "light"|"satellite", lightPreset: "day"|"dusk",
//   camera: { kind: "establish" } | { kind: "segment", locId, zoom?, pitch? } | { kind: "ward", ward } | { kind: "aerial", locId },
//   motion: { orbitDeg: number, driftDeg: number },    // 0 disables
//   layers: { flow: bool, heat: bool, dots: "all"|"segment"|"none", callouts: string[], pulse: string[], mask: null|number, segmentsOpacity: number },
//   autoplayMs: number | null                          // null = manual (title, closing)
// }
```

## C.3 Camera (`camera.js`)

```js
export function establish(map, wardsFc, { padding, pitch = 55, bearing = -18, duration = 1600, reduced })
export function dollyToSegment(map, segmentFeature, { padding, zoom, pitch = 58, reduced }) // Promise<void> resolved on moveend
export function fitWard(map, wardFeature, { padding, pitch = 42, bearing = -10, duration = 1800, reduced })
export function aerial(map, segmentFeature, { padding, zoom = 16.8, pitch = 62, reduced })
export function orbit(map, degrees, ms, { reduced })   // returns cancel(); linear bearing change; no-op when reduced or degrees is 0
export function drift(map, degrees, ms, { reduced })   // like orbit, smaller, allowed to ease pitch by up to 4 degrees
export function stopMotion(map)                        // cancels orbit, drift and any in flight camera animation (map.stop())
export function presentationPadding(viewport, captionBox) // -> { top, right, bottom, left } per the design padding rule
export function zoomForLengthMi(mi)                    // 16.6 | 16.1 | 15.7
```

## C.4 Layout (`ui/layout.js`)

```js
export function initLayout(map, { layoutEl, mapEl }) // -> { setPresenting(bool), captionBox(), onResize(cb), destroy() }
// Must observe mapEl with ResizeObserver and call map.resize() on every size change (at most once per frame),
// toggle class "presenting" on layoutEl, set data-mode on <html>, and call map.resize() again after the CSS transition ends.
```

## C.5 Basemap (`layers/basemap.js`)

```js
export const STYLE_FOR = { light: STYLES.standard, satellite: STYLES.satellite }
export function configureStandard(map, { lightPreset, presenting })            // setConfigProperty calls; no-op on non Standard styles
export function switchBasemap(map, next, { lightPreset, presenting, onReady })  // snapshot crossfade; onReady after style.load; resolves when the overlay has faded
export function setLightPreset(map, preset)
export function slotFor(layerKind)   // "wards" -> "bottom", "heat" -> "middle", everything else -> "top"
```

## C.6 Flow (`layers/flow.js`)

```js
export const FLOW_LAYERS = ["segments-flow-lo", "segments-flow-mid", "segments-flow-hi"]
export function addFlowLayers(map, state)              // three layers above "segments-line" with the VPD band filters
export function setFlowVisible(map, visible)
export function startFlow(map, { stepMsByLayer, now, raf, caf, hidden })  // returns stop(); 20 updates per second max; respects hidden()
export function dashSequence(dash, gap)                // pure: the dasharray cycle for one class
export function flowFilter(cls)                        // pure: ["all", primary filter, vpd band]
```

## C.7 Collisions (`layers/collisions.js`, existing exports kept)

```js
export function setHeatVisible(map, visible, { fadeMs, tween })
export function setDotsMode(map, mode, { locId })      // "all" | "segment" | "none"
export function revealSegmentCrashes(map, locId, { duration, reduced, tween })  // returns cancel()
export function dimOutsideWard(map, wardFeature)       // null restores
```

## C.8 Callouts (`layers/callouts.js`)

```js
export function addCalloutLayer(map)
export function showCallouts(map, items)   // items: [{ locId, text, rank, lngLat, bearing }]
export function clearCallouts(map)
export function calloutAnchor(bearingDeg)  // pure: "left"|"right"|"top"|"bottom"
```

## C.9 Present chrome (`ui/present.js`)

```js
export function initPresent({ root })   // root = #present
// -> { show(scene, { prev }), hide(), setProgress(index, total, fraction), setControlsVisible(bool), onAction(cb) }
// onAction(cb) receives "next" | "prev" | "exit" | "autoplay" | "replay" | "explore" | { goto: index }
```

## C.10 Tour player (`ui/tour.js`)

Keeps `tourReduce`, `keyAction`, `swipeAction`. `initTourPlayer({ scenes, applyScene, onEnter, onExit, present })` where `present` is the object from C.9. Autoplay duration comes from `scene.autoplayMs`; `null` disables it for that scene. Adds actions `replay` (goto 0) and `explore` (exit). Key `a` toggles autoplay, `f` toggles fullscreen.

## C.11 DOM ids the lead creates in `index.html` (Wave 0)

```
#present (section, hidden)   #present-eyebrow   #present-scene-count
#present-card  #present-title  #present-caption  #present-stats  #present-legend  #present-list
#present-progress (role=tablist)   #present-controls  #present-prev  #present-next  #present-autoplay  #present-exit
#present-closing  #present-replay  #present-explore
#map-recenter (button, hidden)   #map-north (button, hidden)
#settings-toggle  #settings (disclosure in the panel)  #heat-toggle  #flow-toggle
```

## C.12 Data file (after `scripts/slim-data.mjs`)

`data/collisions.geojson` features: coordinates rounded to 5 decimals; properties `{ y: 2021, c: "a"|"s"|"n"|"r"|"x", l: "52500-158" }` where `c` codes `assigned, shared_intersection_resolved, on_road_no_segment, road_not_counted, other` and `l` is omitted when there is no loc id. `data.js` and `layers/collisions.js` read the short names through the `COLL` mapping in `config.js`. The segments file is unchanged.

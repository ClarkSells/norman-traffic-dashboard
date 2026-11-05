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
//   eyebrow: string | null,                            // title-scene branding line over the card (Wave 4, 3.2-01)
//   hint: string | null                                // title-scene start cue, e.g. "Press space or Next" (Wave 4, 3.2-01)
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
// -> { show(scene, { prev }), hide(), setProgress(index, total, fraction), setControlsVisible(bool), setAutoplay(bool), onAction(cb) }
// onAction(cb) receives "next" | "prev" | "exit" | "autoplay" | "replay" | "explore" | { goto: index }
// setAutoplay(bool) syncs the switch (checked + aria-checked) when autoplay changes outside the
// switch itself (the `a` key, or the reducer forcing autoplay off at the last scene). Added in Wave 4.
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

## C.13 Simulate: new `data/segments.geojson` properties (Phase 2, pipeline branch `phase2/forecast`)

The pipeline adds these properties to every feature in `data/segments.geojson`. All may be null when unknown.

- growth_base, growth_lo, growth_hi: annual growth rate as a decimal (0.021 = 2.1 percent per year)
- growth_method: "loglin" | "pairwise" | "ward_median"; growth_n_obs: int; growth_shrink_w: float 0..1
- vpd_2025_base, vpd_2030_base, vpd_2035_base, vpd_2035_lo, vpd_2035_hi: float
- vc_2035_base, vc_2035_lo, vc_2035_hi: float (at the segment's LOS E capacity)
- year_vc_07_base, year_vc_09_base, year_vc_09_lo, year_vc_09_hi: int or null (null = not by 2050; a value of 2025 means already)
- upgrade_tier: string label ("5 lane center turn", "4 lane divided", "6 lane divided", "add one lane (one way)", "at top tier"); upgrade_lanes: int; upgrade_divided: bool; capacity_after: float or null; vc_after_upgrade: float or null (2035 base); headroom_yrs: float or null
- dt_school_fri_vpd, dt_school_wkday_vpd, dt_weekend_vpd, dt_summer_wkday_vpd, dt_gameday_vpd: float (day type volumes; dt_school_fri_vpd equals vpd_max, the count itself, because the ACOG counts are school year Friday counts); matching dt_<type>_vc at LOS E; dt_gameday_added: float (routed stadium volume alone); campus_w: float 0..1
- speed_measured: float or null (mph); speed_diff: float or null; speed_flag: bool
- existing: volume_year (int), capacity_E, capacity_C, capacity, v_c, vpd_max, lanes_final, divided, one_way

## C.14 Simulate: scenario math (`data.js`, pure functions, unit tested)

```
g = growth_<band> + growthAdd   (band in lo|base|hi, growthAdd in 0 | 0.01 | 0.02)
vpd_eff(f, s) = dt_<daytype>_vpd * (1 + g) ** (s.year - volume_year)     (year 2025..2035; note volume_year can be as early as 2010, that is intended: the count is projected forward to the chosen year)
vc_eff = vpd_eff / capacity_<los>     (existing los state E|C)
In closure mode with a closed segment X: vc_eff for a detour segment D = (vpd_eff(D) + added_vpd[X][D]) / capacity(D); X itself gets vc 0 and is drawn closed.
"Projected v/c" replaces v_c in the segment paint and the table when the scenario differs from the default (daytype school_fri, year 2025, growthAdd 0, band base, no closure). When the scenario is the default, nothing on screen changes from today's behavior, and the existing tests must still pass.
```

State keys (C.1 extension, `state.js`): `daytype` ("school_fri" default), `year` (2025), `growthAdd` (0), `band` ("base"), `closing` (null, a loc_id when a segment is closed), `simPlaying` (false). Hash keys (`hash.js`): `dt`, `yr`, `grow`, `band`, `close`, written only when they differ from the default.

## C.15 Simulate: `data/closure_impacts.json`

```
{ "<loc_id>": { "detour_loc_ids": ["52500-12", ...], "added_vpd": { "52500-12": 14200.0 }, "vc_after": { "52500-12": 0.81 }, "path": [[lon, lat], ...], "detour_len_mi": 2.1, "ratio": 1.8, "flagged": false, "no_path": false } }
```

One entry per counted segment; `path` is the detour polyline between the closed segment's end nodes.

## C.16 Simulate: `data/daytypes.json` and `data/horizon.json`

daytypes.json:

```
{ "factors": { "school_fri": { "factor": 1.0, "source": "the count itself" }, "school_wkday": { "factor": 0.95, "source": "assumption, FHWA style weekday ratio" }, "weekend": {...}, "summer_wkday": { "formula": "...", "source": "..." }, "gameday": {...} }, "gameday": { "vehicles": 30800, "stadium": [lon, lat], "origins": [ { "name": "I-35 at Lindsey", "lon": x, "lat": y, "share": 0.25 } ], "closures": ["52500-77"], "routes": [ { "origin": "I-35 at Lindsey", "share": 0.25, "path": [[lon, lat], ...] } ] } }
```

horizon.json:

```
{ "params": { "k": 2, "clip": [-0.03, 0.06], "years": [2025, 2030, 2035], "thresholds": [0.7, 0.9] }, "backtest": { "n": 93, "mape": 0.14, "by_class": { "Principal Arterial": 0.11 } }, "growth_sensitivity": [ { "loc_id": "...", "year_vc_09_m0": 2031, "year_vc_09_m1": 2029, "year_vc_09_m2": 2028 } ] }
```

The dashboard loads the three files beside the five in `config.js` DATA (`data.js` SIM_DATA); a missing file leaves its slot null and the Simulate controls degrade (no closure path, no game day routes, no assumption line) without breaking the base dashboard. `data/SAMPLE_DATA.txt` is present only while `scripts/stamp_sample.mjs` output stands in for the pipeline; nothing in the app depends on sample-only values.

## C.17 Simulate: DOM ids and layer ids

```
#simulate (section in the panel)  #daytype-toggle  #sim-year  #sim-year-label  #sim-year-ticks  #sim-play  #growth-toggle  #band-toggle
#closure-toggle (switch)  #sim-assumption  #sim-reset  #sim-sample (hidden unless data/SAMPLE_DATA.txt exists)
layers: closure-closed, closure-path-casing, closure-path (layers/closure.js); gameday-routes, gameday-origins, gameday-origin-labels (layers/gameday.js)
```

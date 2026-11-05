# Code map

Every JavaScript and CSS file in the dashboard, what it owns, what it exports, what it imports and who calls it. Signatures are copied from the source. Options objects are shown as `{ ... }` with their defaults where the source gives them. Each file also opens with a `WHAT THIS FILE DOES` block, so this table is the index and the file is the detail.

## Entry point and shared modules

| Path | Purpose | Main exports (signatures) | Imports | Called from |
| --- | --- | --- | --- | --- |
| `index.html` | The one page: topbar, panel, map, legend, present region, loading card, every DOM id. Loads the three stylesheets, Mapbox GL JS v3.6 from the CDN, the three.js import map and `app.js`. | none | none | the browser |
| `app.js` | Entry point. Creates the map, loads data, adds layers, wires the UI, owns the render loop and present mode. | none (module side effects; `window.__dash` for the e2e checks) | `config.js`, `data.js`, `state.js`, `theme.js`, `camera.js`, `geo.js`, `scenes.js`, `hash.js`, every `layers/*.js`, every `ui/*.js` | `index.html` |
| `config.js` | Constants: the Mapbox token, style URLs, light presets, flow bands, scene timing, the slim collision keys, city bounds, data file paths, center and zoom, the color ramps, class breaks, metric labels. Do not change values here without checking the tests. | `MAPBOX_TOKEN`, `STYLES`, `PRESETS`, `FLOW`, `SCENE_TIMING`, `COLL`, `CITY_BOUNDS`, `DATA`, `CENTER`, `ZOOM`, `RAMP`, `BLUE_RAMP`, `WARD_COLORS`, `MUTED`, `BREAKS`, `METRIC_LABEL` | none | nearly everything |
| `state.js` | The one state object, `setState` and `subscribe`. | `getState()`, `setState(patch)`, `subscribe(fn)` | none | `app.js`, `ui/panel.js`, `ui/popup.js`, `ui/simulate.js` |
| `data.js` | Fetches the data files and computes every state dependent number. | `loadAll(onProgress)`, `readWithProgress(res, onBytes)`, `combineProgress(perFile)`, `getRaw()`, `setRaw(obj)`, `years()`, `yearExtent()`, `isDefaultScenario(state)`, `growthRate(p, state)`, `effectiveVpd(p, state)`, `closureAdded(locId, closing, impacts)`, `effectiveVc(p, state, closureImpacts)`, `segmentProps(locId)`, `scenarioText(state)`, `vcLabel(state)`, `closureImpact(state)`, `gamedayText(daytypes)`, `countOver(state, threshold)`, `deriveProps(p, state)`, `applyState(state)`, `rankedRows(state)`, `rankWithin(state, locId)`, `summarize(state)`, plus the constants `SIM_DATA`, `SIM_DEFAULT`, `SIM_YEARS`, `GROWTH_ADDS`, `DAYTYPES`, `DAYTYPE_LABEL`, `DAYTYPE_WORD`, `BAND_LABEL`, `BAND_WORD` | `config.js` | `app.js`, `scenes.js`, `ui/panel.js`, `ui/popup.js`, `ui/tooltip.js`, `ui/legend.js`, `ui/simulate.js` |
| `hash.js` | URL hash to state and back (deep links). | `stateToHash(state, tourStep)`, `hashToPatch(hash)`, `readHash()`, `writeHash(state, tourStep)`, `YEAR_RANGE` | none | `app.js` |
| `theme.js` | The light, dark and present palettes, applied to `<html>` as CSS custom properties and read by the layer modules for map chrome. | `THEMES`, `FONTS`, `GOOGLE_FONTS_URL`, `themeFor(basemap)`, `cssVars(name)`, `applyTheme(name, root)`, `applyMode(mode, root)`, `contrastRatio(hexA, hexB)`, `COLLISION_COLORS` | `config.js` | `app.js`, `layers/segments.js`, `layers/collisions.js`, `layers/wards.js`, `layers/points.js`, `layers/closure.js`, `layers/gameday.js`, `ui/legend.js` |
| `motion.js` | Easing, the injectable `tween`, the number counter, the FLIP helpers. | `DUR`, `easeOutCubic`, `easeInOutCubic`, `linear`, `lerp`, `clamp01`, `prefersReducedMotion()`, `duration(ms, reduced)`, `tween({ duration, ease, onUpdate, onDone, now, raf, caf })`, `animateNumber(el, to, format, { duration, reduced, now, raf, caf })`, `flipPlan(before, after)`, `capMoves(moves, max = 60)`, `measureRows(rowsByKey, viewport)`, `playFlip(plan, rowsByKey, { reduced, raf, duration })` | none | `layers/basemap.js`, `layers/segments.js`, `layers/collisions.js`, `layers/wards.js`, `ui/panel.js`, `ui/sheet.js`, `ui/present.js` |
| `camera.js` | The camera moves: establish, dolly to segment, fit ward, aerial, orbit, drift, stop, plus the padding and zoom rules. | `zoomForLengthMi(mi)`, `presentationPadding(viewport, captionBox)`, `establish(map, wardsFc, { padding, pitch = 55, bearing = -18, duration = 1600, reduced })`, `fitWard(map, wardFeature, { padding, pitch = 42, bearing = -10, duration = 1800, reduced })`, `dollyToSegment(map, segmentFeature, { padding, zoom, pitch = 58, reduced })` (Promise), `aerial(map, segmentFeature, { padding, zoom = 16.8, pitch = 62, reduced })` (Promise), `orbit(map, degrees, ms, opts)`, `drift(map, degrees, ms, opts)`, `stopMotion(map)` | `geo.js` | `app.js` |
| `geo.js` | Pure geographic helpers. | `metersBetween(a, b)`, `polygonCentroid(ring)`, `wardCentroids(wards)`, `bearing(a, b)`, `dominantBearing(coords)`, `bearingAcrossScreen(coords)`, `lineBounds(coords)`, `lineMidpoint(coords)`, `metersToLine(p, coords)`, `nearestSegment(p, features, maxMeters = 300)` | none | `camera.js`, `app.js`, `layers/wards.js` |
| `scenes.js` | The 17 present scenes as data. | `buildScenes(raw)` returns `Scene[]` (CONTRACTS.md C.2) | `config.js`, `facts.js`, `data.js` | `app.js` |
| `facts.js` | Verified constants captions may quote, and the public URLs. | `FACTS`, `TOP5`, `WARD_TOP`, `LIVE_URL`, `PRIVATE_REPO`, `PUBLIC_REPO`, `factTokens()` | none | `scenes.js`, `ui/loading.js` |
| `caveats.js` | Data quality sentences per segment. | `CAVEATS`, `FALLBACK_GEOMETRY_IDS`, `DUPLICATE_PAIR_IDS`, `caveatsFor(locId)`, `hasCaveat(locId)` | none | `ui/popup.js` |

## layers/

Each module owns a set of Mapbox sources and layers. `add*` runs once per style load (from `addAllLayers` in `app.js`), `update*` and `set*` run on renders and scene changes.

| Path | Purpose | Main exports (signatures) | Imports | Called from |
| --- | --- | --- | --- | --- |
| `layers/basemap.js` | Mapbox Standard config, slot names, the style switch with a snapshot crossfade. | `STYLE_FOR`, `isStandardStyle(style)`, `configureStandard(map, { lightPreset, presenting })`, `setLightPreset(map, preset)`, `slotFor(layerKind)`, `switchBasemap(map, next, { lightPreset, presenting, onReady, tween, fadeMs = 350, setTimeout, clearTimeout })` (Promise), `tuneBasemap(map, theme)` (legacy) | `config.js`, `motion.js` | `app.js` |
| `layers/segments.js` | The segment lines: ramp, width, casing, hover and selection feature state, metric crossfade, pulse, ward mask. Layers: `segments-casing`, `segments-selected-casing`, `segments-selected-gap`, `segments-line-ghost`, `segments-line`, `segments-shared`, `segments-selected`, `ward-mask`. | `brighten(hex, amount)`, `metricValue(metric)`, `inWardExpression(ward)`, `primaryExpression(includeCollectors)`, `colorExpression(metric, bright)`, `widthExpression(extra)`, `lineOpacityExpression(state, k)`, `casingOpacityExpression(state, casingOpacity)`, `lineColorForState(state)`, `setSegmentsTheme(map, name)`, `addSegmentsLayer(map, segments, { reducedMotion })`, `pulseGradient(p)`, `startPulse(map, period)`, `stopPulse()`, `setHover(map, locId)`, `setSelected(map, feature, { reducedMotion })`, `needsCrossfade(prev, next)`, `updateSegments(map, state, data)`, `setSegmentsOpacity(map, k)`, `pulse(map, locIds, { reduced, tween })`, `addWardMask(map, wardFeature, wardsFc)`, `clearWardMask(map)`, `WARD_MASK_SOURCE`, `WARD_MASK_LAYER` | `config.js`, `theme.js`, `motion.js` | `app.js`, `layers/flow.js`, `layers/closure.js` |
| `layers/collisions.js` | Crash heat and dots, year filter, heat fade, dots mode, crash reveal, ward dim. Layers: `collisions-heat`, `collisions-dots`. | `HEAT_OPACITY`, `CROSSFADE`, `circleColor`, `yearFilter(state)`, `addCollisionsLayer(map, collisions, state)`, `updateCollisions(map, state)`, `setHeatVisible(map, visible, { fadeMs = 600, tween })`, `setDotsMode(map, mode, { locId })`, `revealSegmentCrashes(map, locId, { duration = 900, reduced, tween })`, `dimOutsideWard(map, wardFeature)` | `config.js`, `theme.js`, `motion.js` | `app.js` |
| `layers/flow.js` | The traffic flow dash animation on three band layers. Layers: `segments-flow-lo`, `segments-flow-mid`, `segments-flow-hi`. | `FLOW_LAYERS`, `flowUpdateStats()`, `dashSequence(dash, gap)`, `flowFilter(cls)`, `flowWidthExpression(k = 0.45)`, `addFlowLayers(map, state)`, `setFlowVisible(map, visible)`, `startFlow(map, { stepMsByLayer, now, raf, caf, hidden })` returns `stop()` | `config.js`, `layers/segments.js` | `app.js`, `layers/gameday.js` |
| `layers/callouts.js` | Ranked text labels beside segments in present scenes. Layer: `callouts`. | `CALLOUT_SOURCE`, `CALLOUT_LAYER`, `calloutAnchor(bearingDeg)`, `addCalloutLayer(map)`, `showCallouts(map, items)`, `clearCallouts(map)` | none | `app.js` |
| `layers/closure.js` | The closed segment and its detour path in closure mode. Layers: `closure-closed`, `closure-path-casing`, `closure-path`. | `CLOSED_SOURCE`, `PATH_SOURCE`, `CLOSURE_LAYERS`, `setClosureTheme(map, name)`, `pathFeature(impact)`, `addClosureLayers(map)`, `setClosure(map, closedFeature, impact)` | `config.js`, `theme.js`, `layers/segments.js` | `app.js` |
| `layers/gameday.js` | The stadium routes and origins for the game day day type. Layers: `gameday-routes`, `gameday-origins`, `gameday-origin-labels`. | `ROUTES_SOURCE`, `ORIGINS_SOURCE`, `GAMEDAY_LAYERS`, `GAMEDAY_DASH`, `GAMEDAY_STEP_MS`, `routesFc(daytypes)`, `originsFc(daytypes)`, `setGamedayTheme(map, name)`, `addGamedayLayers(map, daytypes, { visible })`, `setGamedayVisible(map, visible)`, `startGamedayFlow(map, { now, raf, caf, hidden, stepMs })` returns `stop()` | `layers/flow.js`, `theme.js` | `app.js` |
| `layers/points.js` | Count location circles past zoom 13. Layer: `count-points`. | `setPointsTheme(map, name)`, `addPointsLayer(map, points)`, `setPointHover(map, locId)` | `theme.js` | `app.js` |
| `layers/wards.js` | Ward fill, lines and labels. Layers: `wards-fill`, `wards-line`, `wards-label`. | `setWardsTheme(map, name)`, `addWardsLayer(map, wards, { reducedMotion })`, `fillOpacityFor(ward)`, `labelOpacityFor(ward)`, `wardFilterFor(ward)`, `labelFilterFor(ward)`, `updateWards(map, state)` | `config.js`, `geo.js`, `theme.js`, `motion.js` | `app.js` |

## ui/

| Path | Purpose | Main exports (signatures) | Imports | Called from |
| --- | --- | --- | --- | --- |
| `ui/panel.js` | The left panel: briefing, controls, Settings, stat tiles, the keyed ranked table. | `num(v, d = 2)`, `int(v)`, `briefingTitle(state)`, `briefingLine(state, summary)`, `closureLine(state)`, `clampYears(a, b, lo, hi)`, `rangeFill(a, b, lo, hi)`, `clampPatchYears(patch)`, `initControls()`, `initSettings()`, `syncControls(state)`, `initPanelToggle()`, `rowKeyActivates(e)`, `rowCells(r, state, maxScore)`, `emptyMessage(state)`, `renderTable(state, onRowClick, hooks)`, `statsLine(state, summary)`, `renderStats(state, summary, animateNumber)`, `renderBriefing(state, summary)`, `highlightRow(locId)`, `rowElement(locId)` | `data.js`, `state.js`, `config.js`, `motion.js` | `app.js`, `ui/simulate.js` |
| `ui/popup.js` | The segment popup, including the Forecast block and the View site buttons. | `growthText(p)`, `forecastHtml(p)`, `sitesHtml(sites)`, `popupHtml(p, ranks, state, sites)`, `popupFor(locId, state, sites)`, `attachPopup(map, onSelect, enabled, { intercept, sites, onSite })` returns a Mapbox Popup with `open(locId, lngLat)` and `refresh()` | `caveats.js`, `data.js`, `state.js`, `config.js`, `ui/tooltip.js` | `app.js` |
| `ui/tooltip.js` | The hover tooltip over the map. | `closureLine(p)`, `tooltipHtml(p, state)`, `tooltipPosition(point, box, size)`, `showTooltip(el, html, point, box)`, `hideTooltip(el)` | `config.js`, `data.js` | `app.js`, `ui/popup.js` |
| `ui/legend.js` | The legend pill. | `legendTitle(state)`, `renderLegend(el, state)`, `initLegend(el, opts)` | `config.js`, `theme.js`, `data.js` | `app.js` |
| `ui/help.js` | The How to read this overlay. | `FALLBACK_IDS`, `helpHtml(qa)`, `initHelp(qa)` returns `{ close, set }` | none | `app.js` |
| `ui/loading.js` | The loading card and progress bar, the error card. | `errorMessage(err)`, `setStage(next)`, `setProgress(p)`, `finishProgress()`, `showLoading()`, `hideLoading()`, `showLoadError(err)`, `initLoading()` | `facts.js` | `app.js` |
| `ui/layout.js` | Keeps the map canvas sized to its box (ResizeObserver plus `map.resize()`), toggles present mode classes. | `initLayout(map, { layoutEl, mapEl })` returns `{ setPresenting(bool), captionBox(), onResize(cb), destroy() }` | none | `app.js` |
| `ui/mapchrome.js` | Scale bar, north button, recenter button. | `initMapChrome(map, { northEl, recenterEl, cityBounds, ScaleControl, scaleOptions })` returns `{ setPresenting(bool) }` | none | `app.js` |
| `ui/sheet.js` | The phone bottom sheet with three snaps. | `SNAPS`, `DEFAULT_SNAPS`, `snapHeights(viewportH, snaps)`, `pickSnap(height, velocity, heights)`, `initSheet({ panel, handle, header, peekEls, snaps, isNarrow, onSnap, reduced, now, raf, caf })` returns `{ snapTo, current, destroy, getState, dispatch }` | `motion.js` | `app.js` |
| `ui/simulate.js` | The Simulate section and the year player. | `PLAY_STEP_MS`, `assumptionText(daytype, daytypes)`, `closureArmed()`, `setClosureArmed(on)`, `playYears({ reduced, setTimeout, clearTimeout })` returns `stop()`, `stopYears()`, `resetScenario()`, `initSimulate({ daytypes, timers, open })`, `setSampleNotice(on)`, `syncSimulate(state)` | `data.js`, `state.js`, `ui/panel.js` | `app.js` |
| `ui/siteview.js` | The 3D site view overlay (three.js mesh or Mapbox aerial fallback). | `initSiteView(map, { base = "sites/", fetchJson, threeBase, doc })` returns `{ ready, sitesForLoc(locId), open(siteId), close() }` | none statically; three.js and its addons by dynamic import | `app.js`, `ui/popup.js` (through `opts.sites` and `opts.onSite`) |
| `ui/present.js` | The present chrome: caption card, progress tablist, controls. | `CROSSFADE_MS`, `AUTO_HIDE_MS`, `initPresent({ root, reducedMotion, setTimeout, clearTimeout })` returns `{ show(scene, { prev }), hide(), setProgress(index, total, fraction), setControlsVisible(bool), setAutoplay(bool), onAction(cb) }` | `config.js`, `motion.js` | `app.js` |
| `ui/tour.js` | The present player: reducer, key and swipe maps, autoplay heartbeat. | `initialTour`, `AUTOPLAY_MS`, `tourReduce(s, action)`, `keyAction(key, inField)`, `swipeAction(dx, dy, minPx = 48)`, `dotsHtml(index, total)`, `initTourPlayer({ scenes, applyScene, onEnter, onExit, present, timers })` returns `{ dispatch(action), getState() }` | none | `app.js` |

## scripts/ and tests/

| Path | Purpose | Main exports | Imports | Called from |
| --- | --- | --- | --- | --- |
| `scripts/slim-data.mjs` | Rewrites `data/collisions.geojson` to the slim C.12 shape. | `CAT_CODE`, `DROP_CATS`, `round5(v)`, `codeFor(cat)`, `slimFeature(feature)`, `slimCollection(fc)`, `serialize(fc)`, `buildMeta(fc, bytes, gzipBytes, now)` | node builtins | the command line, `tests/slim_data.test.js` |
| `scripts/stamp_sample.mjs` | Writes made up Simulate data in the contract shape (development only). | `BANNER`, `DAYTYPE_FACTORS`, `GAMEDAY`, `seedFrom`, `rng`, `distKm`, `midpoint`, `pathLengthMi`, `projectVpd`, `yearCrossing`, `upgradeTier`, `stampSegment(p)`, `stampClosures(features)`, `stampDaytypes()`, `stampHorizon(features)`, `stampAll(fc)` | node builtins | the command line, `tests/stamp_sample.test.js` |
| `tests/run_all.js` | Runs every `tests/*.test.js` in its own node process and prints the count. | none | node builtins | `npm test` |
| `tests/fake_dom.js` | The tiny DOM stand in the unit tests use. | `El`, `installFakeDocument()` | none | every `tests/*.test.js` that touches the DOM |
| `tests/*.test.js` (37 files) | One file per module or feature, named after it (`segments.test.js`, `simulate.test.js`, `tour_player.test.js`, ...). Each asserts with node's `assert` and exits nonzero on failure. | none | the module under test, `fake_dom.js` | `run_all.js` |
| `tests/e2e/harness.js` | Serves the repo, swaps the Mapbox CDN script for the stub, collects console errors, waits for the layers. | `serve`, `stubMapbox`, `watchConsole`, `waitForLayers`, `root`, `SCRATCH` | node builtins | the e2e drives |
| `tests/e2e/mapbox_stub.js` | A fake `mapboxgl` that records sources, layers, paint and camera calls and paints a canvas. Not Mapbox. | global `mapboxgl`, `window.__stubMaps` | none | injected by `harness.js` |
| `tests/e2e/verify.mjs` | The full drive, 106 checks. | none | playwright, `harness.js` | the command line |
| `tests/e2e/real.mjs`, `real_helpers.mjs` | The real renderer screenshot gate into `qa/real/`. | helpers in `real_helpers.mjs` | playwright, node builtins | the command line, `tests/real_helpers.test.js` |
| `tests/e2e/perf.mjs`, `peek.mjs`, `mobile_peek.mjs` | Throttled load timing, and two one screenshot peeks. | none | playwright, `harness.js` | the command line |

## CSS

| Path | Purpose | Loaded by |
| --- | --- | --- |
| `tokens.css` | Design tokens as custom properties on `:root` (explore) and `:root[data-mode="present"]` (present): fonts, colors, surfaces, radii, durations, easings. `theme.js` writes the older `--surface` style names inline; both sets are in use. | `index.html`, first |
| `style.css` | The explore chrome: topbar, progress bar, panel skeleton, layout grid, briefing, controls, segmented buttons, the two handle year range, switches, Settings, Simulate section, stat tiles, the ranked table and its FLIP classes, legend pill, tooltip, popup, help overlay, loading card, map chrome buttons, and the phone bottom sheet rules (`.panel.sheet`, `[data-snap]`). | `index.html`, second |
| `present.css` | The present chrome: full bleed map, scrim, eyebrow, caption card, title and closing layouts, stat strip, legend chip, ward list cards, closing buttons, the 250 ms crossfade keyed on `data-anim`, the progress segments, the controls and autoplay switch, the phone layout, reduced motion. | `index.html`, third |
| `ui/siteview.js` (inline `STYLE`) | The site view overlay's own CSS, injected into `<head>` on first open. | `ui/siteview.js` |

## The render loop

Every change on screen goes through the same path. A control writes a patch, the store notifies, `render` recomputes and pushes.

```
  user action                       state.js                      app.js render(state, patch)
  ───────────                       ────────                      ───────────────────────────
  click a ward button ──► setState({ ward: 2, selectedLocId: null })
  drag the year slider ─► setState({ yearMin, yearMax })
  toggle a switch ──────► setState({ heat: false })
  Simulate controls ────► setState({ year: 2031 })                 │
  a scene (present) ────► setState({ ...scene.state })             │
  hash restore ─────────► setState(patch)                          │
                                         │                         │
                                         ▼                         ▼
                                   Object.assign(state, patch)
                                   for each listener: fn(getState(), patch)
                                         │
                                         ▼  (the only listener)
                        ┌────────────────────────────────────────────────────────────┐
                        │ data = applyState(state)   deriveProps for all 204 segments │
                        │ updateSegments(map, state, data)  feature state + paint     │
                        │ updateWards(map, state)           filters + opacity         │
                        │ updateCollisions(map, state)      year filter               │
                        │ renderLegend(el, state)                                     │
                        │ renderTable(state, onRowClick)    rows, stats, briefing     │
                        │ syncControls(state); syncSimulate(state)                    │
                        │ if "closing" in patch   applyClosure(state)                 │
                        │ if "daytype" in patch   applyGameday(state)                 │
                        │ if presenting: writeHash(state, sceneIndex); return         │
                        │ if "ward" in patch      flyToWard(state.ward)               │
                        │ if "heat" in patch      setHeatVisible(...)                 │
                        │ if "flow" in patch      startFlowLoop() / stopFlowLoop()    │
                        │ if popup open           popup.refresh()                     │
                        │ writeHash(state, null)                                      │
                        └────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                          Mapbox map repaints from feature state, filters and paint
                          expressions. The DOM shows the new table, legend and controls.
                          The URL hash now reproduces the view.
```

Three things to notice. `render` never reads the DOM to learn the state; it is handed the state. The map is updated with `setFeatureState`, `setFilter` and `setPaintProperty`, never with new source data, so the GeoJSON is parsed once. And the patch is used only to skip work that does not apply (no ward fly when only the metric changed).

## The data flow

From the files on disk to a painted line and a table row.

```
  data/segments.geojson ─┐
  data/collisions.geojson│   loadAll(onProgress)              getRaw()
  data/wards.geojson     ├──► fetch + readWithProgress ─────► raw = { segments, collisions, wards,
  data/count_points.geojson│   (progress bar moves)                   points, summary, closures,
  data/summary.json      ─┘                                           daytypes, horizon }
  data/closure_impacts.json ┐ fetched leniently, null on 404
  data/daytypes.json        ┤
  data/horizon.json         ┘
                                                                           │
                              state (ward, metric, los, years, collectors, │
                                     daytype, year, growthAdd, band, closing)
                                                                           │
                                               ┌───────────────────────────┘
                                               ▼
                             deriveProps(p, state)      for one segment's stored properties p
                               cap        = los C ? capacity_C : capacity_E
                               v_c        = default scenario ? vpd_max / cap
                                                             : effectiveVc(p, state, closures)
                                            effectiveVc = (effectiveVpd + closureAdded) / cap
                                            effectiveVpd = dt_<daytype>_vpd * (1 + g) ** (year - volume_year)
                                            g = growth_<band> + growthAdd
                               collisions = sum of collisions_by_year[y] for yearMin <= y <= yearMax
                               combined   = collisions + v_c
                               in_ward, is_primary, metric_value, closure bookkeeping
                                               │
                                               ▼
                             applyState(state)           a new FeatureCollection, every feature's
                                                         properties = stored + derived
                                  │                                   │
                                  ▼                                   ▼
                   updateSegments(map, state, data)        rankedRows(state) / summarize(state)
                     setFeatureState per loc_id:             filter in_ward and is_primary,
                       { combined, v_c, collisions }         sort by metric_value, number the rows
                     paint expressions read                           │
                       ["feature-state", metric]                      ▼
                       through colorExpression              renderTable, renderStats, renderBriefing,
                                                            popupFor (deriveProps again for one id),
                                                            tooltipHtml, scenes (countOver, closureImpact)
```

The same `deriveProps` feeds the map, the table, the popup, the tooltip, the legend title and the scene captions, which is why they always agree. Under the default scenario the Simulate branch is skipped and the numbers equal the stored `v_c_E` or `v_c_C` exactly.

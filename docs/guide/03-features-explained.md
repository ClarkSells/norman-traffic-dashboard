# Features explained

One section per feature. Each says where the code lives, which state keys drive it, which data fields it reads (names from `CONTRACTS.md` and the files in `data/`), how to test it, and one known limitation. The state keys are the ones in `state.js`; the full shape is in `CONTRACTS.md` C.1 and C.14.

## The ranked list and the ward filter

The panel's table lists every primary segment in the selected ward (or the whole city), ranked by the active metric, with a rank number, the road and span, v/c, crashes, and a score bar. The eight ward buttons set the filter; the map tints the chosen ward, fits the camera to it and dims crashes outside it.

| | |
| --- | --- |
| Code | `ui/panel.js` (`initControls`, `renderTable`, `rowCells`, `renderStats`, `renderBriefing`), `data.js` (`rankedRows`, `summarize`, `rankWithin`), `layers/wards.js` (`updateWards`), `layers/segments.js` (`inWardExpression`, `lineOpacityExpression`), `app.js` (`flyToWard`, `selectSegment`), `motion.js` (FLIP helpers) |
| State keys | `ward` (null or 1 to 8), `metric`, `includeCollectors`, `selectedLocId`, `reducedMotion` |
| Data fields | `segments.geojson`: `loc_id`, `on_road`, `from_road`, `to_road`, `wards` (array, sometimes JSON text), `ward_primary`, `functional_class`, `shared_boundary`, `vpd_max`, plus the derived `in_ward`, `is_primary`, `metric_value`, `v_c_active`, `collisions_active`, `combined_active`. `wards.geojson`: `Ward_num`. |
| How to test | `node tests/panel.test.js` (briefing, rows, empty state), `node tests/panel_a11y.test.js` (roving tabindex, arrow keys), `node tests/layers.test.js` (ward filters and opacities). In the browser: click Ward 2, the title reads "Ward 2", the camera tilts to about 30 degrees, rows reorder with a slide, the hash gains `ward=2`. `tests/e2e/verify.mjs` walks all eight wards and checks the state, title and row count agree. |
| Known limitation | A boundary segment is listed in both neighboring wards with a different rank in each, and its citywide rank is a third number. The popup shows the ward and city ranks, but the table only shows the rank inside the current list, so the same road can read "#3" in one ward and "#1" in the next. |

How it works in one paragraph. `rankedRows` runs `applyState`, keeps rows whose `in_ward` and `is_primary` flags are 1 and whose `metric_value` is not null, sorts by `metric_value` with `v_c_active` and `vpd_max` as tie breakers, and numbers them. `renderTable` keeps one `<tr>` per `loc_id` in a Map and reuses it, so a re-render only rewrites cells whose signature changed and moves existing rows into the new order; rows that left fade out, new rows fade in, moved rows play a FLIP (measure before, measure after, transform back, release). Hovering a row sets hover feature state on the map line; hovering the map line highlights the row.

## Metric and LOS toggles

Three metrics color the map and rank the list: combined (crashes plus v/c), v/c alone, crashes alone. Two capacity tables set the denominator of v/c: LOS E from the 2025 plan (default) and LOS C from the 2020 plan, which rates roads lower so v/c rises.

| | |
| --- | --- |
| Code | `ui/panel.js` (`initControls`, `syncControls`, `initSettings` moves the LOS control behind Settings), `data.js` (`deriveProps`), `layers/segments.js` (`metricValue`, `colorExpression`, `updateSegments` with the ghost crossfade), `config.js` (`BREAKS`, `RAMP`, `METRIC_LABEL`) |
| State keys | `metric` ("combined", "v_c", "collisions"), `los` ("E", "C") |
| Data fields | `capacity_E`, `capacity_C`, `vpd_max`, `collisions_by_year`; derived `v_c_active`, `combined_active`, `collisions_active`, `capacity_active` |
| How to test | `node tests/segments.test.js` (expressions, crossfade, feature state), `node tests/expressions.test.js` (zoom curves stay top level), `node tests/data.test.js`. In the browser: switch to v/c and watch the colors crossfade over 350 ms while the legend title changes; switch LOS to C and the first row's v/c rises. The drive checks the ghost layer ends at opacity 0 and the line at 1 after each metric change, and that v/c differs between LOS C and E. |
| Known limitation | The combined score adds a raw crash count (often over 100) to a ratio (under 1), so crashes decide the order and v/c only breaks ties; the help overlay says so (rank correlation above 0.99). A segment with no capacity in the chosen table gets a null v/c and drops out of the list rather than showing with crashes alone. |

A metric change is an expression swap: the three metric values already sit in feature state, so `colorExpression(metric)` just reads a different key. `needsCrossfade` is true when the metric, ward or collector flag changed; then the ghost layer takes the old color and opacity expressions and fades out while the real line fades in. An LOS change writes new feature state values in place and the paint transition (`DUR.mid`) carries the color change.

## Collision year range

A two handle slider sets the window of crash years that count. The table, the stat tiles, the heat, the dots and the legend title all follow it.

| | |
| --- | --- |
| Code | `ui/panel.js` (`initControls`, `clampYears`, `rangeFill`, `clampPatchYears`, `syncControls`), `data.js` (`years`, `yearExtent`, `deriveProps`), `layers/collisions.js` (`yearFilter`, `updateCollisions`), `style.css` (`.range-pair`, the two native inputs on one track) |
| State keys | `yearMin`, `yearMax` |
| Data fields | `segments.geojson`: `collisions_by_year` (an object year to count, stored as JSON text). `collisions.geojson`: `y` (the `COLL.year` short key). `summary.json`: `years`. |
| How to test | `node tests/panel.test.js` (clamping, fill percentages, the "2021 only" label), `node tests/hash.test.js` (the `years=a-b` key, swapped bounds). In the browser: drag the upper handle to 2023, the label reads "2021 to 2023", the crash tile counts down, the legend title follows. The drive does the same through an `input` event. |
| Known limitation | `yearExtent` widens the slider to any year found in a segment's `collisions_by_year`, but `scripts/slim-data.mjs` drops crash points outside 2021 to 2025. If the pipeline ever adds an older year to the segment counts, the table would count it while the map shows no dots for it. Today both carry exactly 2021 to 2025. |

The window is applied two ways. For the table, `deriveProps` sums `collisions_by_year` entries inside the window. For the map, `yearFilter` builds `["all", [">=", ["get", "y"], yearMin], ["<=", ["get", "y"], yearMax]]` and `updateCollisions` sets it as the filter on both the heat and the dots layer, so crashes outside the window are not drawn at all.

## Crash density heat

Below zoom 13 the crashes read as a blue density surface; between 13 and 13.6 the dots crossfade in and the heat fades out. The Settings switch "Crash density" turns the surface off entirely, and the present mode heat scene fades it in over 600 ms.

| | |
| --- | --- |
| Code | `layers/collisions.js` (`addCollisionsLayer`, `setHeatVisible`, `HEAT_OPACITY`, `CROSSFADE`), `ui/panel.js` (`initSettings` wires `#heat-toggle`), `app.js` (`render` reacts to a `heat` patch, `applySceneLayers`), `config.js` (`BLUE_RAMP`) |
| State keys | `heat` (default true in explore; scenes set it), `yearMin`, `yearMax`, `reducedMotion` |
| Data fields | `collisions.geojson`: point coordinates, `y`, `c` (category code `a`, `s`, `n`, `r`, `x`) |
| How to test | `node tests/layers.test.js` and `node tests/tour.test.js` (heat opacity and fade with an injected tween). In the browser: open Settings, switch Crash density off, the surface fades over 600 ms; zoom past 13.6 and it is gone regardless. The drive flips the switch and checks `heatmap-opacity` goes from 0.45 to 0. |
| Known limitation | Every crash weighs 1, so a cluster of minor incidents reads as hot as a cluster of serious ones. The slim file carries no severity field, so weighting would need a pipeline change (C.12). |

Mapbox concept: a heatmap layer sums a kernel around every point and colors the density. `heatmap-radius` and `heatmap-intensity` grow with zoom so the surface stays legible, `maxzoom` 13.6 removes the layer when zoomed in, and the layer sits in the Standard "middle" slot so buildings draw over it.

## Traffic flow dash animation

A white dashed overlay on the arterial network whose dashes travel along the road, faster on free flowing bands and slower on congested ones. Off by default in explore (Settings, "Traffic flow"), on in several present scenes.

| | |
| --- | --- |
| Code | `layers/flow.js` (`dashSequence`, `flowFilter`, `flowWidthExpression`, `addFlowLayers`, `setFlowVisible`, `startFlow`, `flowUpdateStats`), `app.js` (`flowStepMs`, `startFlowLoop`, `stopFlowLoop`), `config.js` (`FLOW.bands`, `FLOW.stepMs`, `FLOW.vcBands`) |
| State keys | `flow`, `reducedMotion`; the step speed reads the derived `v_c_active` of every segment |
| Data fields | `vpd_max` (band membership), `functional_class` (primary only), derived `v_c_active` (median per band picks the speed) |
| How to test | `node tests/flow.test.js` (the dash cycle wraps without a seam, the filters, the loop throttles to 20 updates per second and stops when hidden). In the browser: open Settings, switch Traffic flow on, the dashes move; `window.__dash.flowStats()` in the console reports p50 and p95 cost per update. `tests/e2e/real.mjs` writes the same stats into `qa/real/report.json`. |
| Known limitation | Flow never runs under reduced motion and never draws on collectors (the filter is `primaryExpression(false)` regardless of the collectors switch). Speed is per band, not per segment: every road in a band moves at the pace of that band's median v/c, so one congested road in a free flowing band still runs fast. |

Why three layers: `line-dasharray` is a paint property that cannot be data driven, so there is one layer per volume band, each with its own dash and gap. `dashSequence` precomputes the frames of the cycle (the dash shifted a little further each frame with the same total period), and `startFlow` writes the next frame to each layer at most every 50 ms, choosing the frame from the clock and the band's step interval so the animation stays in time after a dropped frame.

## Segment popup

Click a segment line or a count point, or a table row, and a Mapbox popup opens at the segment's midpoint: name, span and id, ward chips, the six figures (volume, lanes, capacity, v/c, crashes, length), the combined score with the ward and city ranks, the closure line, the Forecast block, the caveats, the View site buttons and an aerial link.

| | |
| --- | --- |
| Code | `ui/popup.js` (`popupHtml`, `popupFor`, `attachPopup`), `data.js` (`deriveProps`, `rankWithin`), `caveats.js`, `ui/tooltip.js` (`closureLine`), `app.js` (`selectSegment`, `closureIntercept`, `render` calls `popup.refresh()`) |
| State keys | `selectedLocId`, plus every key `deriveProps` reads (`los`, `yearMin`, `yearMax`, `metric`, `ward`, the Simulate keys) |
| Data fields | `on_road`, `from_road`, `to_road`, `loc_id`, `wards`, `shared_boundary`, `functional_class`, `vpd_max`, `volume_year`, `lanes_final`, `lanes_source`, `one_way`, `capacity_E`, `capacity_C`, `length_mi`, `collisions_by_year`, the C.13 forecast fields; derived `v_c_active`, `collisions_active`, `combined_active`, `capacity_active`, `is_closed`, `closure_added`, `closure_from`, `v_c_before_closure`, `projected` |
| How to test | `node tests/popup_legend.test.js` (markup, ranks, caveats, the closure line, the Forecast block, the site buttons). In the browser: click W Main St, the popup lists "#1 of N in Ward 2" and "#1 of 177 citywide"; change LOS while it is open and the capacity and v/c cells update in place. The drive clicks a table row and checks the popup opened and `sel=` landed in the hash. |
| Known limitation | The popup is built from template strings without HTML escaping. Road names and caveats are trusted pipeline output today; a road name containing `<` would break the markup. |

`attachPopup` registers one click handler on `segments-line` and one on `count-points`. Before opening it asks `opts.intercept` (closure mode may claim the click) and `enabled()` (never in present). `popup.refresh()` rebuilds the HTML for the remembered `loc_id` when the state changes under an open popup, so the numbers never go stale.

## Tooltips

Hovering a segment line shows a small box with the road, the span and the active metric value, plus the closure line when the segment is a detour. It follows the pointer and flips sides near the map edges.

| | |
| --- | --- |
| Code | `ui/tooltip.js` (`tooltipHtml`, `tooltipPosition`, `showTooltip`, `hideTooltip`), `app.js` (the `mousemove` and `mouseleave` handlers on `segments-line`, hidden in present), `style.css` (`.map-tooltip`) |
| State keys | `metric` (which value and label), the Simulate keys (through `vcLabel`), `selectedLocId` is not involved |
| Data fields | `on_road`, `from_road`, `to_road`; derived `v_c_active`, `collisions_active`, `combined_active`, `is_closed`, `closure_added`, `closure_from`, `v_c_before_closure` |
| How to test | `node tests/layers.test.js` (the markup and the edge flip). In the browser: hover any segment, the table row highlights and scrolls into view, the cursor becomes a pointer. The drive hovers a segment and checks the tooltip and the row highlight when the stub registers a hit. |
| Known limitation | Hover only. On a touch screen there is no tooltip, and hovering a count point changes the cursor and grows the circle but shows no tooltip; the popup is the touch path. |

## Legend

A pill in the map corner. Folded it shows the title (metric, LOS, year window, and the scenario when one is active) and the ramp; a click expands the width key, the boundary dash, the crash dot colors and the heat swatch.

| | |
| --- | --- |
| Code | `ui/legend.js` (`legendTitle`, `renderLegend`, `initLegend`), `config.js` (`RAMP`, `BREAKS`, `METRIC_LABEL`, `BLUE_RAMP`), `theme.js` (`COLLISION_COLORS`), `style.css` (`.legend`, `.compact`, `.collapsed`) |
| State keys | `metric`, `los`, `yearMin`, `yearMax`, the Simulate keys (through `scenarioText`) |
| Data fields | none directly; the break values come from `config.js` |
| How to test | `node tests/legend_toggle.test.js` (fold survives re-renders, `aria-expanded`), `node tests/popup_legend.test.js` (titles under scenarios). In the browser: change the metric and the title and the ramp labels follow; click the title to expand. |
| Known limitation | The width key is a drawing of three line thicknesses, not tied to the actual `widthExpression` values, so it says "thicker means more vehicles" without naming the volumes behind each thickness. |

## Help overlay

"How to read this" opens four cards over the panel: v/c, LOS, collisions, combined score, each with one figure and a plain paragraph. Escape closes it, focus is kept inside while it is open, and Reset view also closes it.

| | |
| --- | --- |
| Code | `ui/help.js` (`helpHtml`, `initHelp`), `app.js` (`helpBox.close()` in `resetView`), `style.css` (`.help`, `.help-card`) |
| State keys | none |
| Data fields | `summary.json` `qa.segments_lanes_verified` (falls back to 204) |
| How to test | `node tests/help.test.js` (markup, open and close, Escape, the focus trap). In the browser: press the button, tab around, press Escape, focus returns to the button. |
| Known limitation | The collisions card says "Crashes from 2021 to 2025" and "within about 30 meters" as fixed text. The year window and the assignment distance do not follow the slider or a pipeline parameter. |

## Basemap switch and theme

The Satellite button swaps Mapbox Standard for Standard Satellite and back. The chrome theme follows: light palette on streets, dark palette on satellite. In present mode the chrome switches to the present palette and the basemap light preset goes to dusk.

| | |
| --- | --- |
| Code | `layers/basemap.js` (`switchBasemap`, `configureStandard`, `setLightPreset`, `slotFor`), `theme.js` (`THEMES`, `themeFor`, `applyTheme`, `applyMode`), `app.js` (`setBasemap`, `applyMapTheme`, the `style.load` handler, `addAllLayers`), every `set*Theme` in `layers/`, `tokens.css` (`:root` and `:root[data-mode="present"]`), `config.js` (`STYLES`, `PRESETS`) |
| State keys | `basemap` ("light", "satellite"), `presenting`, `reducedMotion` |
| Data fields | none |
| How to test | `node tests/basemap.test.js` (config calls per style kind, the crossfade with an injected tween, error and timeout paths), `node tests/theme.test.js` (contrast ratios for every palette). In the browser: press Satellite, the old frame stays as a photo while the new style loads, then fades; the legend, the panel and the casings go dark. The drive checks the button label and `aria-pressed`, and that the layers are back after the swap. |
| Known limitation | A style switch is a full rebuild: `setStyle` discards every source and layer, `addAllLayers` adds them again, the selection pulse restarts and the flow loop is restarted. On a slow connection the snapshot sits for up to five seconds before the fallback timer fades it. `preserveDrawingBuffer: true`, needed for the snapshot, costs some rendering performance on every frame. |

Mapbox concepts in play: Standard is a configurable style, so label groups, the light preset (`day`, `dusk`), the `faded` theme used in present and `show3dObjects` are set with `setConfigProperty` instead of editing layers. Our layers name a slot (`bottom`, `middle`, `top`) so the basemap interleaves them with roads, buildings and labels. Standard Satellite rejects `theme` and `show3dObjects`, so `configureStandard` skips them there.

## Present mode and scenes

Press Present (or open a `#tour=N` link) and the panel slides away, the map fills the screen, a caption card appears and the 17 scenes play: title, five citywide views, the top five segments one by one, ward 2 and its LOS C change, the two Simulate scenes, the satellite lane count story, and a closing card. Arrow keys and space step, `a` toggles autoplay, `f` toggles fullscreen, Escape exits, swipes work on a phone.

| | |
| --- | --- |
| Code | `scenes.js` (`buildScenes`), `ui/tour.js` (`tourReduce`, `keyAction`, `swipeAction`, `initTourPlayer`), `ui/present.js` (`initPresent`), `app.js` (`applyScene`, `applySceneLayers`, `calloutItems`, `onEnterPresent`, `onExitPresent`), `camera.js` (every move), `layers/callouts.js`, `layers/segments.js` (`pulse`, `setSegmentsOpacity`, `addWardMask`), `layers/collisions.js` (`setDotsMode`, `revealSegmentCrashes`, `setHeatVisible`), `ui/layout.js` (`setPresenting`, `captionBox`), `present.css`, `facts.js` |
| State keys | `presenting`, plus the full state each scene carries (`scene.state` is a complete C.1 object); `reducedMotion` is overlaid by the player |
| Data fields | `facts.js` constants for captions; `segments.geojson` `loc_id`, `on_road`, `lanes_final`, `vpd_max`, `rank_combined_city` for callouts and stats; `wards.geojson` for the establish and ward fits; `closure_impacts.json` for scene 14 |
| How to test | `node tests/scenes.test.js` (17 scenes, every caption number is a fact or computed, complete states), `node tests/tour.test.js` and `node tests/tour_player.test.js` (reducer, keys, autoplay heartbeat), `node tests/present.test.js` (chrome, tablist keys, auto hide), `node tests/camera.test.js` (padding, zoom rules, the stage center math), `node tests/segments_emphasis.test.js`, `node tests/callouts.test.js`. In the browser: press Present, step with the right arrow, watch the camera and the callouts; press Escape and the explore view you left comes back. The drive steps all 17 scenes and checks the camera, layers and captions per scene; `tests/e2e/real.mjs` screenshots them with the real renderer. |
| Known limitation | Captions quote `facts.js` constants (204 segments, 23,595 crash records, the top five with their scores). A pipeline rerun that changes any of them needs `facts.js` edited by hand, and the scenes test will fail until it is. |

How a scene is applied, in order: stop anything the previous scene left running (camera motion, year player, spin, crash reveal, popup, tooltip); switch the basemap or just the light preset; `setState(scene.state)` so `render` repaints the layers and the panel; `applySceneLayers` for opacity, heat, dots, callouts and the ward mask; compute padding from the caption card's box so the subject lands in the uncovered stage; run the camera move for `scene.camera.kind` and wait for `moveend`; then the emphasis (flow, pulse, crash reveal, the year player on scene 13, orbit or drift for the scene's length). The player waits for `applyScene` to settle before starting the autoplay countdown.

## Mobile sheet

Under 768 px wide the panel becomes a bottom sheet with three snap points: peek (148 px), half (52 percent of the layout height) and full (92 percent). Drag the handle or the briefing header; a tap toggles peek and half; a quick flick jumps one snap; Enter cycles and the arrow keys step from the keyboard.

| | |
| --- | --- |
| Code | `ui/sheet.js` (`snapHeights`, `pickSnap`, `initSheet`), `style.css` (`.panel.sheet`, `[data-snap]`, `.sheet-handle`), `ui/layout.js` (resizes the map when the sheet moves), `app.js` (`initSheet` in `main`, `map.resize()` after it, no nav control on phones), `camera.js` (`presentationPadding` reserves 40 vh plus 24 px on phones) |
| State keys | none; the sheet keeps its own `snap` and exposes it on `window.__dash.sheet` for the drive |
| Data fields | none |
| How to test | `node tests/sheet.test.js` (snap heights at several viewports, the flick rule, tap versus drag, keyboard, pointer capture). The drive runs at 390 by 844, 768 wide and 844 by 390 and checks the sheet class, the snaps and that a drag never pans the map. `tests/e2e/mobile_peek.mjs` takes one phone screenshot. |
| Known limitation | The phone check is `max-width: 767px`, so a phone held in landscape (844 by 390) gets the desktop grid with a very short panel rather than the sheet. |

## Hash deep links

The URL hash mirrors the state: `#ward=2&metric=combined&los=E&years=2021-2025&sel=52500-158`, with `collectors=1`, `basemap=satellite`, the Simulate keys `dt`, `yr`, `grow`, `band`, `close`, and `tour=N` for a present scene (0 based). Loading a link restores the view; editing the hash while the page is open applies it.

| | |
| --- | --- |
| Code | `hash.js` (`stateToHash`, `hashToPatch`, `readHash`, `writeHash`), `app.js` (`render` writes after every change, `main` reads at boot and listens to `hashchange`), `ui/panel.js` (`clampPatchYears` keeps restored years inside the data) |
| State keys | all of them except `reducedMotion`, `heat`, `flow`, `presenting`, `simPlaying` |
| Data fields | none; `sel` and `close` values are validated against a `loc_id` pattern, not against the data |
| How to test | `node tests/hash.test.js` (round trip, swapped years, bad values ignored, Simulate keys only when they differ from the default). In the browser: change a few controls, copy the URL, open it in a new tab. The drive sets ward 4, v/c, LOS C and a selection, expects exactly `#ward=4&metric=v_c&los=C&years=2021-2025&sel=52500-192`, reloads that URL and checks the state and the controls came back; it also opens a `tour=` link. |
| Known limitation | The hash is written with `history.replaceState`, so the browser Back button does not step through earlier views; only the latest view is in history. `tour=` is 0 based while the chrome says "Scene N of 17" 1 based, so a hand typed `tour=5` opens the scene labeled 6. |

## The Simulate section

A disclosure in the panel with five controls. Each one changes the projected volume every segment carries, and the projected v/c then flows through the same `deriveProps` into the map paint, the table, the popup, the tooltip, the legend and the briefing. When every control is at its default nothing on screen differs from the base dashboard.

| | |
| --- | --- |
| Code | `ui/simulate.js` (`initSimulate`, `syncSimulate`, `playYears`, `stopYears`, `resetScenario`, `closureArmed`, `assumptionText`), `data.js` (`isDefaultScenario`, `growthRate`, `effectiveVpd`, `effectiveVc`, `closureAdded`, `closureImpact`, `scenarioText`, `vcLabel`, `countOver`, `gamedayText`), `layers/closure.js`, `layers/gameday.js`, `app.js` (`applyClosure`, `applyGameday`, `closureIntercept`), `scenes.js` (scenes 13 and 14), `hash.js` (the short keys) |
| State keys | `daytype`, `year`, `growthAdd`, `band`, `closing`, `simPlaying` |
| Data fields | `segments.geojson` C.13: `growth_lo`, `growth_base`, `growth_hi`, `volume_year`, `capacity_E`, `capacity_C`, `dt_school_fri_vpd`, `dt_school_wkday_vpd`, `dt_weekend_vpd`, `dt_summer_wkday_vpd`, `dt_gameday_vpd`. `closure_impacts.json` C.15: `detour_loc_ids`, `added_vpd`, `path`, `detour_len_mi`, `ratio`, `flagged`, `no_path`. `daytypes.json` C.16: `factors.<type>.factor`, `formula`, `source`, `gameday.vehicles`, `seats`, `occupancy`, `stadium`, `origins`, `routes`, `closures`. |
| How to test | `node tests/scenario.test.js` (the math against hand computed values, the default scenario equals today), `node tests/simulate.test.js` (controls, the year player on fake timers, reset), `node tests/closure.test.js`, `node tests/gameday.test.js`. The Playwright drive does not touch the Simulate section yet. In the browser: open Simulate, set the year to 2035, the table header reads "projected v/c", the chip reads "on" and the hash gains `yr=2035`; switch on Close a segment, click W Main St, the detour draws in ink and the briefing names the largest increase. |
| Known limitation | See each control below. |

The controls, one at a time.

| Control | What it does | Math (`data.js`) | Known limitation |
| --- | --- | --- | --- |
| Day type | Picks which day's volume to project: school Friday (the count itself), school weekday, weekend, summer weekday, OU game day. The assumption line under the controls quotes the factor and its source from `daytypes.json`. | `base = dt_<daytype>_vpd`, falling back to `vpd_max` for school Friday | Every factor except school Friday is an assumption from `daytypes.json` (for example weekday is 0.95 of the Friday count), not a measured day type count. The line says so. |
| Year | A slider from 2025 to 2035 with a Play button that steps one year per 900 ms (jumps straight to 2035 under reduced motion). | `vpd_eff = base * (1 + g) ** (year - volume_year)` | The projection compounds from `volume_year`, which can be as early as 2010, so an old count with a high fitted rate grows for 25 years. That is intended (the count is carried to the chosen year) but it makes old counts sensitive to the band. |
| Growth lever | Adds 0, 1 or 2 percentage points per year to every segment's rate. | `g = growth_<band> + growthAdd` | Uniform across the city; there is no per ward or per corridor lever. |
| Growth band | Low, base or high: which of the three fitted rates to use. | `growth_lo`, `growth_base` or `growth_hi`; a missing band falls back to base, then to 0 | A segment with no fitted growth at all projects flat (rate 0 plus the lever) without saying so in the UI. |
| Close a segment | A switch that arms the next map click: that segment reads v/c 0 and is drawn dashed, its detour path from `closure_impacts.json` is drawn in ink, and every detour segment carries the added volume. A second click reopens it. The briefing names the largest v/c increase, the detour length and the pipeline's flags. | `vc_eff(D) = (vpd_eff(D) + added_vpd[X][D]) / capacity(D)`; `vc_eff(X) = 0` | The added volume is the pipeline's shortest path routing of the whole count onto the detour, with no capacity aware spreading and no partial diversion. 37 of the 202 detours are flagged as implausibly long and the briefing says so, but the volume is still applied. |
| Game day routes | With the OU game day day type, `layers/gameday.js` draws the routed stadium traffic from each interchange as dashed lines (width by share) with labeled origins and the stadium, and runs the dash animation. | The routed volume is already inside `dt_gameday_vpd` (`dt_gameday_added` is the routed part alone). | `daytypes.json` lists segments closed around the stadium (`gameday.closures`) and the briefing counts them, but nothing draws them as closed or removes their volume; closure mode is separate. |

## The Forecast block

Inside the popup, under the score row, a block of rows from the pipeline's projection: the growth rate with its method and shrinkage, v/c in 2035 with the band range, the year v/c reaches 0.9 (with the high and low band years), the recommended upgrade tier with v/c after it and years of headroom, and a measured speed when it is flagged. Only the rows whose fields the pipeline filled are printed.

| | |
| --- | --- |
| Code | `ui/popup.js` (`growthText`, `forecastHtml`), `style.css` (`.forecast`) |
| State keys | none; the block reads stored properties only, not the scenario |
| Data fields | C.13: `growth_base`, `growth_lo`, `growth_hi`, `growth_method`, `growth_n_obs`, `growth_shrink_w`, `growth_raw`, `vc_2035_base`, `vc_2035_lo`, `vc_2035_hi`, `year_vc_09_base`, `year_vc_09_lo`, `year_vc_09_hi`, `upgrade_tier`, `vc_after_upgrade`, `headroom_yrs`, `speed_flag`, `speed_measured`, `speed_diff` |
| How to test | `node tests/popup_legend.test.js` (rows appear only for filled fields, the wording for each method, "not by 2050", "already", the top tier case). In the browser: open any popup and compare the rows with the segment's properties in `data/segments.geojson`. |
| Known limitation | The 2035 and year to 0.9 figures are computed by the pipeline at LOS E capacity and do not follow the LOS toggle or the Simulate controls, so under LOS C or a high band the popup's v/c cell (live) and the Forecast rows (stored) can disagree. `horizon.json` (the model parameters, the backtest and the growth sensitivity table) is loaded but not shown anywhere yet. |

## The 3D site view

For the five top intersections the pipeline captured a 3D mesh and Street View images. The popup shows a "View site in 3D" button for each site that covers the segment; it opens a full screen overlay with a three.js render of the mesh (orbit with the mouse, scroll to zoom), labels at the points `site.json` lists, a note on the method, and a strip of Street View images. If a site has no mesh, the map itself becomes the stage: the camera flies to an aerial view and the same labels are pinned as Mapbox markers.

| | |
| --- | --- |
| Code | `ui/siteview.js` (`initSiteView`, `sitesForLoc`, `open`, `renderMesh`, `renderFallback`, `labelEl`), `ui/popup.js` (`sitesHtml`), `app.js` (`initSiteView` in `main`, the popup's `sites` and `onSite` options), `index.html` (the three.js import map) |
| State keys | none; the overlay is outside the state store |
| Data fields | `sites/index.json`: per site `name`, `lat`, `lon`, `loc_ids`, `score`, `has_mesh`, `streetview[]`. `sites/<id>/site.json`: `name`, `center`, `bbox`, `size_m`, `mesh`, `mesh_frame`, `labels[]` with `kind`, `text`, `lon`, `lat`, `x`, `y`, `z`. `sites/<id>/mesh.glb`, `sites/<id>/streetview/*.jpg`. |
| How to test | `node tests/siteview.test.js` (index lookup, the fallback path with a fake map and document, close and Escape). In the browser: open the W Main St popup, press "View site in 3D: W Main St at 24th Ave NW", drag to orbit, press Close or Escape. The mesh path needs WebGL and the CDN; the fallback path can be forced by setting `has_mesh` to false in a local copy of `sites/index.json`. |
| Known limitation | three.js 0.160.0 and its addons load from `cdn.jsdelivr.net` on first open, so the 3D view needs network even when the page is served locally, and each mesh is 2 to 3 MB. The meshes were captured with Aleph from Google imagery through undocumented endpoints (the note in the viewer says so), so they are a demonstration asset, not a reproducible pipeline output. |

The two render paths share the label builder. In the mesh path a `CSS2DObject` places each label at the `x`, `y`, `z` the pipeline wrote in meters from the bbox center (Aleph's frame: x east, y up, z south). In the fallback path a `mapboxgl.Marker` places the same label at `lon`, `lat`. Labels of different kinds at the same point are stacked by a per kind pixel offset so they do not overprint.

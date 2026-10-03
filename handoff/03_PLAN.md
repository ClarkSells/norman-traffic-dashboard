# Presentation polish plan (Kimi Code swarm edition)

Goal: take the live dashboard from "good student build" to "three month consulting deliverable", per `01_AUDIT.md` (what is wrong) and `02_DESIGN_DIRECTION.md` (what right looks like). Mapbox Standard with 3D buildings, a choreographed 14 scene presentation, traffic flow animation, a restructured explore panel, a working phone layout, and a QA gate that looks at real pixels.

Executor: Kimi Code on Clark's Windows machine, lead agent plus parallel sub-agents, in this repository (`norman-traffic-dashboard`, the deployed source of truth). Branch: `polish/presentation`. Clark merges to `main` when the Wave 4 gate passes; GitHub Pages deploys from `main`.

Tech stack, unchanged: Mapbox GL JS v3 from the CDN, ES modules, no bundler, Node 20+ for tests, Playwright for e2e. Data slimming is a Node script here so this repo stays single runtime.

## Part A: Operating rules for this run

### A.1 Facts about Kimi sub-agents that shape the plan

- A sub-agent sees only its task card plus `AGENTS.md`, `CONTRACTS.md` and the skills the card names. It returns one report. It cannot see other agents or the browser.
- So every card is self contained, owns its files exclusively, names the exact exports it must provide, and ends with an acceptance command the agent can run blind.
- Only the lead edits shared files (`index.html`, `app.js`, `style.css` base tokens, `config.js`) and only in Wave 0 and Wave 2. Only the lead runs `git`.
- Agents cannot see pixels. The visual gate is a Playwright script that writes screenshots and a JSON of frame times; the lead reads the screenshots and the QA agents read the JSON plus the screenshots the lead attaches.

### A.2 Skills: who reads what

Skills live in `handoff/skills/`. `handoff/skills/INDEX.md` is the catalog. Each card lists the skills its agent must read before writing code; the lead prepends their paths to the card. The lead itself reads, before Wave 0: `superpowers/writing-plans`, `superpowers/subagent-driven-development`, `superpowers/dispatching-parallel-agents`, `ecc/taste`, `ecc/frontend-design-direction`, `mapbox/mapbox-web-performance-patterns`, and `reference/mapbox-gl-v3-cheatsheet.md`.

### A.3 Kimi settings

```toml
# ~/.kimi-code/config.toml
default_permission_mode = "yolo"
[background]
max_running_tasks = 10
[subagent]
timeout_ms = 2400000
[[permission.rules]]
tool = "Bash(git *)"
decision = "deny"
```

The agents `builder`, `designer`, `qa-visual`, `reviewer` are in `.kimi-code/agents/` in this repo.

### A.4 Wave map

| Wave | What | Cards | Agents | Parallel | Gate |
|---|---|---|---|---|---|
| 0 | Branch, contracts, DOM scaffold, tokens, real renderer harness, data slimming | 0.1 to 0.4 | lead (0.1, 0.2), 2 builders (0.3, 0.4) | partly | `npm test` green including `sheet.test.js`; `node tests/e2e/real.mjs --smoke` writes a screenshot with the real map; `data/collisions.geojson` under 1.6 MB |
| 1 | Every module, each with its unit test on the stub | 1.1 to 1.14 | 14 builders and designers | yes | `npm test` green; `node --check` on every JS file; every card's acceptance PASS |
| 2 | Integration: `app.js`, `index.html`, `style.css` wiring, hash compatibility | 2.1 | lead | no | `node tests/e2e/verify.mjs` (stub) green; `node tests/e2e/real.mjs` runs all 15 scenes at three viewports and writes `qa/real/` |
| 3 | Visual and code QA on real pixels | 3.1 to 3.7 | 4 qa-visual, 3 reviewers | yes | findings filed in `qa/findings.md` with severity |
| 4 | Fixes and final gate | 4.1 | lead plus re-dispatch of owning builders | partly | every P0 and P1 finding closed, budgets in `02_DESIGN_DIRECTION.md` section 11 met, Clark's walkthrough |

### A.5 What Clark does by hand

| When | What |
|---|---|
| Before Wave 0 | Confirm the `pk.` token's URL restrictions include `https://clarksells.github.io/*` and `http://localhost:*`. `npm i -D playwright` and `npx playwright install chromium` in this repo. |
| After Wave 2 | Open `http://localhost:8000/#tour=0` through `npm run serve`, step the whole tour with the keyboard, and write anything that feels wrong into `qa/clark.md`. Agents cannot feel. |
| After Wave 4 | Merge `polish/presentation` to `main`, wait for Pages, run the tour on the venue laptop and on a phone. |

## Part B: File ownership

Every file has one owner. Wave 0 files are frozen after Wave 0 except where a card says "modify".

```
AGENTS.md                      0.1 (lead)   rules for this repo's swarm (copy of handoff/AGENTS.dashboard.md)
CONTRACTS.md                   0.1 (lead)   Part C below, verbatim
config.js                      0.1 (lead)   STYLES, PRESETS, FLOW, SCENE_TIMING, COLL, CITY_BOUNDS added
tokens.css                     0.1 (lead)   type and color tokens (new file, linked from index.html)
index.html                     0.1 (lead) DOM scaffold for present chrome; 2.1 (lead) final merge
style.css                      0.1 (lead) base rewrite to tokens; 1.6 modifies the panel section only
present.css                    1.3
scripts/slim-data.mjs          0.3
tests/e2e/real.mjs             0.4
tests/e2e/real_helpers.mjs     0.4
ui/layout.js                   1.1
layers/basemap.js              1.2
ui/present.js                  1.3
scenes.js                      1.4   (replaces tour.js, which 2.1 deletes)
camera.js                      1.5   (motion.js keeps tween and FLIP helpers; camera option functions move here)
ui/panel.js                    1.6
ui/help.js                     1.6
layers/flow.js                 1.7
layers/collisions.js           1.8
layers/callouts.js             1.9
layers/segments.js             1.9   (modify: pulse, opacity scalar, ward mask exports)
ui/legend.js                   1.10
ui/mapchrome.js                1.10  (scale, north arrow, recenter)
ui/sheet.js                    1.11
ui/loading.js                  1.12
theme.js                       1.13
ui/tour.js                     1.14  (player: reducer plus DOM binding to present chrome)
motion.js                      1.5 (modify: remove camera option functions, keep the rest)
ui/status.js                   2.1 deletes
tour.js                        2.1 deletes
app.js                         2.1 (lead)
tests/*.test.js                each card owns the test file it names
tests/e2e/verify.mjs           2.1 (lead) updates selectors and scene count
qa/                            Wave 3 agents write findings here; screenshots under qa/real/ are gitignored
```

## Part C: Contracts

The lead writes these into `CONTRACTS.md` in Wave 0 verbatim. A card's Interfaces block repeats its slice. If a card and `CONTRACTS.md` disagree, `CONTRACTS.md` wins and the agent reports it.

### C.1 State (`state.js`, existing shape plus three keys)

```
{ ward: null|1..8, metric: "combined"|"v_c"|"collisions", los: "E"|"C", yearMin, yearMax,
  includeCollectors: bool, selectedLocId: null|string, basemap: "light"|"satellite",
  reducedMotion: bool,
  heat: bool,        // new, default true in explore
  flow: bool,        // new, default false in explore
  presenting: bool   // new, true while a scene is on screen
}
```

### C.2 Scene (`scenes.js`)

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

### C.3 Camera (`camera.js`)

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

### C.4 Layout (`ui/layout.js`)

```js
export function initLayout(map, { layoutEl, mapEl }) // -> { setPresenting(bool), captionBox(), onResize(cb), destroy() }
// Must observe mapEl with ResizeObserver and call map.resize() on every size change (at most once per frame),
// toggle class "presenting" on layoutEl, set data-mode on <html>, and call map.resize() again after the CSS transition ends.
```

### C.5 Basemap (`layers/basemap.js`)

```js
export const STYLE_FOR = { light: STYLES.standard, satellite: STYLES.satellite }
export function configureStandard(map, { lightPreset, presenting })            // setConfigProperty calls; no-op on non Standard styles
export function switchBasemap(map, next, { lightPreset, presenting, onReady })  // snapshot crossfade; onReady after style.load; resolves when the overlay has faded
export function setLightPreset(map, preset)
export function slotFor(layerKind)   // "wards" -> "bottom", "heat" -> "middle", everything else -> "top"
```

### C.6 Flow (`layers/flow.js`)

```js
export const FLOW_LAYERS = ["segments-flow-lo", "segments-flow-mid", "segments-flow-hi"]
export function addFlowLayers(map, state)              // three layers above "segments-line" with the VPD band filters
export function setFlowVisible(map, visible)
export function startFlow(map, { stepMsByLayer, now, raf, caf, hidden })  // returns stop(); 20 updates per second max; respects hidden()
export function dashSequence(dash, gap)                // pure: the dasharray cycle for one class
export function flowFilter(cls)                        // pure: ["all", primary filter, vpd band]
```

### C.7 Collisions (`layers/collisions.js`, existing exports kept)

```js
export function setHeatVisible(map, visible, { fadeMs, tween })
export function setDotsMode(map, mode, { locId })      // "all" | "segment" | "none"
export function revealSegmentCrashes(map, locId, { duration, reduced, tween })  // returns cancel()
export function dimOutsideWard(map, wardFeature)       // null restores
```

### C.8 Callouts (`layers/callouts.js`)

```js
export function addCalloutLayer(map)
export function showCallouts(map, items)   // items: [{ locId, text, rank, lngLat, bearing }]
export function clearCallouts(map)
export function calloutAnchor(bearingDeg)  // pure: "left"|"right"|"top"|"bottom"
```

### C.9 Present chrome (`ui/present.js`)

```js
export function initPresent({ root })   // root = #present
// -> { show(scene, { prev }), hide(), setProgress(index, total, fraction), setControlsVisible(bool), onAction(cb) }
// onAction(cb) receives "next" | "prev" | "exit" | "autoplay" | "replay" | "explore" | { goto: index }
```

### C.10 Tour player (`ui/tour.js`)

Keeps `tourReduce`, `keyAction`, `swipeAction`. `initTourPlayer({ scenes, applyScene, onEnter, onExit, present })` where `present` is the object from C.9. Autoplay duration comes from `scene.autoplayMs`; `null` disables it for that scene. Adds actions `replay` (goto 0) and `explore` (exit). Key `a` toggles autoplay, `f` toggles fullscreen.

### C.11 DOM ids the lead creates in `index.html` (Wave 0)

```
#present (section, hidden)   #present-eyebrow   #present-scene-count
#present-card  #present-title  #present-caption  #present-stats  #present-legend  #present-list
#present-progress (role=tablist)   #present-controls  #present-prev  #present-next  #present-autoplay  #present-exit
#present-closing  #present-replay  #present-explore
#map-recenter (button, hidden)   #map-north (button, hidden)
#settings-toggle  #settings (disclosure in the panel)  #heat-toggle  #flow-toggle
```

### C.12 Data file (after `scripts/slim-data.mjs`)

`data/collisions.geojson` features: coordinates rounded to 5 decimals; properties `{ y: 2021, c: "a"|"s"|"n"|"r"|"x", l: "52500-158" }` where `c` codes `assigned, shared_intersection_resolved, on_road_no_segment, road_not_counted, other` and `l` is omitted when there is no loc id. `data.js` and `layers/collisions.js` read the short names through the `COLL` mapping in `config.js`. The segments file is unchanged.

## Part D: Task cards

Each card: Goal, Files, Skills, Interfaces, Steps, Acceptance. Agents follow `AGENTS.md`: test first on the stub (`tests/fake_dom.js`, `tests/e2e/mapbox_stub.js`), implement, run acceptance, report.

### Wave 0

#### Card 0.1 (lead): Branch, contracts, scaffold, tokens

Files: `AGENTS.md`, `CONTRACTS.md`, `config.js`, `tokens.css`, `index.html`, `style.css` (base only).
Steps:
1. `git checkout -b polish/presentation`.
2. Write `CONTRACTS.md` from Part C verbatim. Copy `handoff/AGENTS.dashboard.md` to `AGENTS.md`.
3. `config.js`: add `STYLES = { standard: "mapbox://styles/mapbox/standard", satellite: "mapbox://styles/mapbox/standard-satellite" }` (keep `light` as an alias of `standard` for one release), `PRESETS = { explore: "day", present: "dusk" }`, `FLOW = { bands: [8000, 18000], stepMs: { free: 45, moderate: 70, congested: 110 }, vcBands: [0.5, 0.8] }`, `SCENE_TIMING = { city: 10000, segment: 12000, ward: 14000 }`, `COLL = { year: "y", cat: "c", loc: "l" }`, `CITY_BOUNDS` computed once from `data/wards.geojson` and pasted as a literal `[[west, south], [east, north]]`.
4. `tokens.css`: the two token sets from `02_DESIGN_DIRECTION.md` section 3 under `:root` and `:root[data-mode="present"]`, plus the three font stacks. `index.html` loads IBM Plex Sans, Serif and Mono (exact weights), preloads the three woff2 files used above the fold, links `tokens.css` before `style.css`, and contains every id in C.11 as empty scaffolding with the aria roles from the design.
5. `style.css`: replace hard coded colors and the single font with tokens; no layout changes (1.6 owns the panel section, marked with `/* panel: owned by 1.6 */`).
6. Commit "wave 0: contracts, scaffold, tokens".
Acceptance: `npm test` runs (only `sheet.test.js` may fail until 0.2); `node --check` on all JS.

#### Card 0.2 (lead): fix `tests/sheet.test.js`

Read the failing assertion, decide whether the test or `ui/sheet.js` drifted, fix the one that is wrong without changing the sheet's public behavior (1.11 rewrites it; this only gives Wave 1 a green baseline).
Acceptance: `npm test` prints `20 of 20`.

#### Card 0.3 (builder): `scripts/slim-data.mjs`

Goal: shrink `data/collisions.geojson` per C.12, idempotent, with a report.
Skills: `mapbox/mapbox-web-performance-patterns`.
Steps: `tests/slim_data.test.js` on a five feature fixture (rounding, code mapping, null dropping, idempotence, feature count preserved); implement (file fits in memory); print before and after bytes and gzip bytes; write `data/collisions.meta.json` with `{ features, years: [min, max], bytes, gzipBytes, writtenAt }` (ISO 8601 timestamp).
Acceptance: `node scripts/slim-data.mjs && node tests/slim_data.test.js` PASS; `data/collisions.geojson` under 1,600,000 bytes; feature count equals the meta file.
Note for the lead: the same mapping must later move into the pipeline's `geojson_out.py` in `norman-traffic-case`; file that as a follow up, do not do it here.

#### Card 0.4 (builder): real renderer harness `tests/e2e/real.mjs`

Goal: the visual gate. Loads the real Mapbox CDN with the token from `config.js`, serves the repo with gzip, and for each of three viewports (1440x900, 1920x1080, 390x844 mobile emulation): open `#tour=0`, wait for `window.__dash.ready` (2.1 sets it), `map.loaded()` and one `idle`, screenshot; then for scenes 0 to 14 dispatch next, wait for `moveend` plus 900 ms plus `idle`, screenshot `qa/real/<viewport>/scene-<nn>.png`; record frame times during each transition with a `requestAnimationFrame` probe injected before `next`; also screenshot explore mode in four states (citywide, ward 3, segment 52500-181, satellite). Writes `qa/real/report.json` with per transition `{ scene, maxFrameMs, medianFrameMs, longFrames }`, load timings, console errors, and bytes transferred. `--smoke` runs only the first screenshot.
Skills: `ecc/browser-qa`, `ecc/e2e-testing`, `mapbox/mapbox-web-performance-patterns`.
Files: `tests/e2e/real.mjs`, `tests/e2e/real_helpers.mjs`, `tests/real_helpers.test.js` (pure helpers: frame stats, viewport table, report shape).
Acceptance: `node tests/real_helpers.test.js` PASS; `node tests/e2e/real.mjs --smoke` writes `qa/real/1440x900/smoke.png` with visible map tiles (the lead looks at it). Needs Clark's token and network.

### Wave 1 (parallel)

#### Card 1.1 (builder): `ui/layout.js`

Goal: the map always matches its box. Fixes A1 and D1.
Skills: `mapbox/mapbox-web-integration-patterns` (lifecycle section), `ecc/frontend-patterns`.
Interfaces: C.4.
Steps: `tests/layout.test.js` with the fake DOM and a ResizeObserver shim: `map.resize` is called at most once per frame for repeated resizes and again after `transitionend`; `setPresenting(true)` adds the class and sets `data-mode="present"`; `captionBox()` returns the rect of `#present-card` when presenting and `null` otherwise.
Acceptance: `node tests/layout.test.js` PASS.

#### Card 1.2 (builder): `layers/basemap.js` rewrite

Goal: Standard style, config properties, slots, crossfade style switch. Fixes A12, C7.
Skills: `mapbox/mapbox-style-patterns`, `mapbox/mapbox-cartography`, `reference/mapbox-gl-v3-cheatsheet.md` sections 2 and 5, `reference/mapbox-storytelling/index.html` (how it handles style changes).
Interfaces: C.5.
Steps: `tests/basemap.test.js` with its own map double: `configureStandard` calls `setConfigProperty("basemap", key, value)` for each key in the design and is a no-op when `getStyle().imports` is missing; `switchBasemap` draws the canvas into an overlay `img`, calls `setStyle` with the right URL, calls `onReady` once after `style.load`, removes the overlay after `idle` with a 350 ms fade through the injectable tween from `motion.js`; `slotFor` table. Do not edit `tests/e2e/mapbox_stub.js` (lead owned).
Acceptance: `node tests/basemap.test.js` PASS.

#### Card 1.3 (designer): `ui/present.js` and `present.css`

Goal: the presentation chrome from `02_DESIGN_DIRECTION.md` section 5. Fixes A4, A5, A9, A10, A11, A13.
Skills: `anthropic/frontend-design`, `ecc/frontend-design-direction`, `ecc/motion-ui`, `ecc/motion-patterns`, `ecc/frontend-slides`, `ecc/accessibility`.
Interfaces: C.9, DOM ids from C.11.
Steps: `tests/present.test.js`: `show(scene)` writes title, caption, stats (count and order), legend chip by `scene.legend`, list cards for ward scenes, closing layout for `kind: "closing"`, title layout for `kind: "title"`; `setProgress` renders one segment per scene, the active one with `aria-selected` and a `--fill` custom property equal to the fraction; `onAction` fires for every control and for progress segment clicks with `{ goto }`; crossfade uses `data-anim="out"` then `"in"` and skips under reduced motion; controls auto hide after 3 s without pointer movement (injectable timers). `present.css` implements the chrome, scrim, stagger, phone layout under 768, tokens only.
Acceptance: `node tests/present.test.js` PASS; `node --check ui/present.js`.

#### Card 1.4 (builder): `scenes.js`

Goal: the 15 scenes (0 to 14) from the storyboard as data. Fixes A3, A7, A8, A13, A14.
Skills: `ecc/frontend-slides` (narrative beats), `reference/mapbox-storytelling/config.js` (chapter shape).
Interfaces: C.2. Facts from `facts.js` exactly as `tour.js` quotes them today; the LOS C count and the ward 2 list are computed with `rankedRows` as today.
Steps: `tests/scenes.test.js`: 15 scenes in storyboard order, every `state` complete (every key in C.1), every caption's numeric tokens are in `factTokens()` or in the computed set, `autoplayMs` null only for title and closing, segment scenes carry the TOP5 loc ids in rank order, scene 13 is satellite, scenes 11 and 12 carry `mask: 2`, scene 3 has `heat: true` and every other scene `heat: false`.
Acceptance: `node tests/scenes.test.js` PASS.

#### Card 1.5 (builder): `camera.js` (and trim `motion.js`)

Goal: the four camera moves. Fixes A1 (city fit), A6.
Skills: `reference/mapbox-gl-v3-cheatsheet.md` section 4, `reference/mapbox-storytelling/index.html` (flyTo usage), `ecc/motion-foundations`.
Interfaces: C.3. `motion.js` keeps `tween`, `animateNumber`, FLIP helpers, `DUR`, easings; its three camera option functions move into `camera.js` (delete them from `motion.js` and update `tests/motion.test.js`, which this card owns for that change only).
Steps: `tests/camera.test.js` with a recording map double: `establish` calls `fitBounds` with the union bounds of the wards and the padding passed; `dollyToSegment` uses `cameraForBounds` then `flyTo` with `curve 1.55`, `speed 0.85`, `maxDuration 2600`, `essential true`, bearing from `bearingAcrossScreen`, zoom by `zoomForLengthMi`; `orbit` advances bearing linearly with injectable `now` and `raf`, `cancel` stops it; everything is `jumpTo` under `reduced`; `presentationPadding` matches the design rule for desktop and phone.
Acceptance: `node tests/camera.test.js && node tests/motion.test.js` PASS.

#### Card 1.6 (designer): `ui/panel.js`, `style.css` panel section, `ui/help.js`

Goal: the explore panel from `02_DESIGN_DIRECTION.md` section 4. Fixes C1, C2, C6, C10, C11.
Skills: `anthropic/frontend-design`, `ecc/design-system`, `ecc/make-interfaces-feel-better`, `ecc/accessibility`, `ecc/frontend-a11y`.
Interfaces: keep every export of `ui/panel.js` (`initControls, initPanelToggle, renderTable, highlightRow, syncControls, clampPatchYears`); add `initSettings()` for the disclosure with `#heat-toggle` and `#flow-toggle` writing `state.heat` and `state.flow`. Rows become `tr[role=button][tabindex]` with Enter, Space, ArrowUp, ArrowDown, Home, End; the selected row scrolls into view. Help becomes a four card overlay with a close button; `initHelp` returns `{ close }` and the lead calls it from Reset.
Steps: extend `tests/panel.test.js` and `tests/panel_a11y.test.js` (owned) for keyboard navigation, the settings disclosure and the stats line; `tests/help.test.js` (owned) for the overlay. Only the panel section of `style.css` changes.
Acceptance: `node tests/panel.test.js && node tests/panel_a11y.test.js && node tests/help.test.js` PASS.

#### Card 1.7 (builder): `layers/flow.js`

Goal: traffic flow animation per design section 7.
Skills: `reference/mapbox-gl-v3-cheatsheet.md` section 6, `mapbox/mapbox-data-visualization-patterns` (animated data), `mapbox/mapbox-web-performance-patterns`.
Interfaces: C.6.
Steps: `tests/flow.test.js`: `dashSequence(2, 3)` returns a cycle that tiles without a seam (each array's dash plus gap sum is constant); `flowFilter` for each band; `addFlowLayers` adds three layers with `slot: "top"` placed before `segments-selected-casing`; `startFlow` with injectable `now` and `raf` calls `setPaintProperty` at most once per layer per 50 ms and not at all while `hidden()` is true, `stop()` cancels; the width expression is 45 percent of `widthExpression()` from `layers/segments.js`.
Acceptance: `node tests/flow.test.js` PASS.

#### Card 1.8 (builder): `layers/collisions.js`

Goal: supporting role heat, dots modes, crash reveal, ward dimming, short property names. Fixes B1, B2, C3, C8.
Skills: `mapbox/mapbox-data-visualization-patterns` (heat maps), `ecc/motion-foundations`.
Interfaces: C.7 plus the existing exports; filters read `COLL` names from `config.js`.
Steps: the collisions section of `tests/layers.test.js` (owned for that section): heat paint values per design section 8, `maxzoom 13.6`, dots `minzoom 13.0`, crossfade 0.6; `setHeatVisible` tweens `heatmap-opacity` with the injectable tween; `setDotsMode("segment", { locId })` filters on `l`; `revealSegmentCrashes` sets feature state `t` from 0 to 1 staggered by year; `dimOutsideWard` uses a `within` expression on the ward polygon.
Acceptance: `node tests/layers.test.js` PASS.

#### Card 1.9 (builder): `layers/callouts.js` and `layers/segments.js` emphasis

Goal: callouts, pulse, opacity scalar, ward mask. Fixes A5, A8, design section 9.
Skills: `mapbox/mapbox-style-patterns` (symbol layers), `mapbox/mapbox-cartography` (label placement).
Interfaces: C.8; in `layers/segments.js` add `export function pulse(map, locIds, { reduced, tween })`, `export function setSegmentsOpacity(map, k)` (uses the existing `lineOpacityExpression(state, k)`), `export function addWardMask(map, wardFeature, wardsFc)` and `clearWardMask(map)`.
Steps: `tests/callouts.test.js`: anchor table by bearing; `showCallouts` writes a point source with `text-field` and `symbol-sort-key`; `tests/segments_emphasis.test.js`: pulse tweens `line-width` twice and restores; mask builds a polygon with a hole.
Acceptance: both tests PASS.

#### Card 1.10 (builder): `ui/legend.js` and `ui/mapchrome.js`

Goal: compact legend pill, scale control, north arrow, recenter. Fixes C4, C5, D2 (recenter half), D3.
Skills: `ecc/make-interfaces-feel-better`, `mapbox/mapbox-web-integration-patterns`.
Interfaces: `initLegend(el, { compact: true })` renders a pill with the metric swatch row and expands on click; `renderLegend` keeps its signature. `initMapChrome(map, { northEl, recenterEl, cityBounds })` adds `ScaleControl` bottom left, shows `northEl` when `|bearing| > 1` and resets bearing on click, shows `recenterEl` when the center is outside `cityBounds` and flies home on click, returns `{ setPresenting(bool) }` which hides all of it.
Steps: `tests/legend_toggle.test.js` (owned) and `tests/mapchrome.test.js`.
Acceptance: both PASS.

#### Card 1.11 (builder): `ui/sheet.js`

Goal: a phone sheet that works with any pointer. Fixes D2.
Skills: `ecc/frontend-patterns`, `ecc/accessibility`.
Interfaces: `initSheet({ panel, handle, header, peekEls, snaps: { peek: 148, half: 0.52, full: 0.92 } })` returns `{ snapTo(name), current(), destroy }`; pointer events (`pointerdown/move/up` with `setPointerCapture`) on the handle; tap toggles peek and half; `aria-expanded` on the handle; the map never receives the drag (`touch-action: none` on the handle, `preventDefault`).
Steps: rewrite `tests/sheet.test.js` for the three snaps, the tap toggle, and that the map element gets no `pointermove`.
Acceptance: `node tests/sheet.test.js` PASS.

#### Card 1.12 (builder): `ui/loading.js`

Goal: calm, determinate loading. Fixes B3.
Interfaces: keep `initLoading, setProgress, hideLoading, showLoadError`; add `setStage("map"|"segments"|"crashes")` with the lines "Preparing the map", "Placing 204 segments", "Loading five years of crash records"; the bar is determinate from `setProgress` bytes.
Acceptance: `node tests/loading.test.js` PASS (owned).

#### Card 1.13 (builder): `theme.js`

Goal: themes through tokens and `data-mode`.
Interfaces: `themeFor(basemap)` unchanged; `applyTheme(name)` sets `data-theme`; add `applyMode(mode)` setting `data-mode` to `"explore"|"present"`; `THEMES` gains the present chrome colors; `COLLISION_COLORS` unchanged.
Acceptance: `node tests/theme.test.js` PASS (owned).

#### Card 1.14 (builder): `ui/tour.js` player

Goal: the player drives the present chrome. Fixes A9, A10.
Skills: `ecc/motion-patterns`.
Interfaces: C.10.
Steps: extend `tests/tour_player.test.js` (owned): autoplay uses `scene.autoplayMs`, title and closing never auto advance, `replay` goes to 0, `explore` exits, `a` and `f` keys, `present.setProgress` is called every 100 ms during autoplay with the fraction (injectable timers), `applyScene(scene, prev)` is called on enter and on every index change. `tests/tour.test.js` is rewritten here to import `scenes.js`.
Acceptance: `node tests/tour_player.test.js && node tests/tour.test.js` PASS.

### Wave 2 (lead)

#### Card 2.1 (lead): integration

Files: `app.js`, `index.html` (final), `style.css` (final merge), `tests/e2e/verify.mjs`; delete `tour.js` and `ui/status.js`.
Steps:
1. `app.js` boots: tokens and mode, Standard style with `configureStandard`, layers added in slot order on `style.load` (wards, heat, segments casing, line, flow, selected, callouts, dots, points), `initLayout`, `initMapChrome`, panel with settings, legend pill, sheet, present chrome, player with `scenes`.
2. `applyScene(scene, prev)`: `stopMotion`; `switchBasemap` if changed (await ready); `setLightPreset`; `setState(scene.state)`; layers per `scene.layers` (flow start or stop, heat fade, dots mode, callouts, mask, segments opacity); camera by `scene.camera.kind` with `presentationPadding(viewport, layout.captionBox())`; after the camera settles: pulse list, crash reveal, orbit or drift per `scene.motion`.
3. Enter: snapshot state and camera, `layout.setPresenting(true)`, `applyMode("present")`, `mapchrome.setPresenting(true)`, close popup and tooltip. Exit: reverse all of it, `clearCallouts`, `clearWardMask`, stop flow unless `state.flow`, restore state and camera, close popup.
4. Hash: `tour=N` is the scene index (0 based); `basemap=light|satellite` unchanged; every other key unchanged.
5. `window.__dash.ready = true` after the first `idle`.
6. Update `verify.mjs` selectors and scene count; run it on the stub; run `real.mjs` and look at every screenshot before declaring the wave done.
Acceptance: `npm test` green; `node tests/e2e/verify.mjs` green; `node tests/e2e/real.mjs` completes with zero console errors and `qa/real/report.json` present.

### Wave 3 (parallel QA on real pixels)

Each qa-visual agent gets the screenshot folder for its viewport plus `qa/real/report.json` and writes `qa/findings/<card>.md` as a table (id, severity P0 to P2, scene or state, what, expected per design section, suggested owner card).

| Card | Agent | Scope | Skills |
|---|---|---|---|
| 3.1 | qa-visual | Present mode 1440x900, scenes 0 to 14: composition, dead space, caption legibility over imagery, callout placement, chrome hidden, transitions (compare consecutive frames) | `ecc/taste`, `ecc/click-path-audit`, `ecc/motion-foundations`, `mapbox/mapbox-cartography` |
| 3.2 | qa-visual | Present mode 1920x1080 and 390x844: same checklist plus the phone sheet | same |
| 3.3 | qa-visual | Explore mode four states at 1440x900 and 390x844: panel budget, rows visible, legend pill, satellite crossfade frames, ward dimming | `ecc/taste`, `ecc/production-audit`, `ecc/accessibility` |
| 3.4 | qa-visual | Performance and load: `report.json` against the budget table; flag any transition over 32 ms max frame or data over budget | `mapbox/mapbox-web-performance-patterns` |
| 3.5 | reviewer | Code review `app.js`, `scenes.js`, `camera.js`, `ui/tour.js`, `ui/present.js` against CONTRACTS | `superpowers/verification-before-completion` |
| 3.6 | reviewer | Code review `layers/*.js`, `ui/layout.js`, `scripts/slim-data.mjs` | same |
| 3.7 | reviewer | Accessibility and reduced motion: keyboard only pass in `verify.mjs` output, token contrast, aria on progress and rows | `ecc/accessibility`, `ecc/frontend-a11y` |

Gate: findings merged into `qa/findings.md` by the lead, sorted by severity.

### Wave 4 (lead)

#### Card 4.1: close findings and final gate

Re-dispatch each P0 and P1 finding to its owning builder with the finding text appended to the original card; the lead fixes integration seams itself. Rerun `npm test`, `verify.mjs`, `real.mjs`, compare screenshots to the previous run, then stop and hand to Clark for the walkthrough. Clark's notes in `qa/clark.md` become a second small fix round. Then merge.

## Part E: Lead self review after every wave

- Did any agent touch a file outside its card? (`git status` and the reports.) Revert and re-dispatch.
- Does every caption still quote `facts.js`? (`node tests/scenes.test.js`.)
- Open three screenshots at random and ask: would a consulting firm ship this frame? If not, file it before moving on.
- Is reduced motion still a working slide show? (`verify.mjs` reduced motion section.)
- Commit once per wave: `git add -A && git commit -m "wave N: <one line>"`.

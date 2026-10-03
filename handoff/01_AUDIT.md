# Norman Street Segment Priorities: human perspective audit

Date: 2026-10-03
Audited build: `main` at `a9a164a` (live at https://clarksells.github.io/norman-traffic-dashboard/)
Method: walked the live site in a real browser as a first time viewer at three viewports (1440x900 desktop, a 758x996 narrow window, 375x812 phone), clicked every control, stepped all 12 Present steps with the keyboard, toggled satellite, dragged the mobile sheet, then read the source to find root causes. Frame rate measured with a requestAnimationFrame probe during a 2 s flyTo. Screenshots are in `audit-evidence/`.

Overall: the analysis layer is strong, the information design is thoughtful, and the test harness is unusually good for a student project. What is missing is the last mile that makes a councilmember say "who built this". The presentation mode is the weakest surface and the one that matters most on the day. Most problems trace to three root causes: the map canvas is never told the layout changed, the camera and chrome were tuned for the two column layout and reused unchanged in presentation, and the previous QA could not see the map at all (the Playwright harness stubs Mapbox).

Severity key: P0 breaks the presentation in front of the audience, P1 visibly unpolished to a careful viewer, P2 fit and finish.

## 1. Presentation mode

| # | Sev | Finding | Evidence | Root cause (source) | Fix direction |
|---|---|---|---|---|---|
| A1 | P0 | On Present, the map does not refit. Desktop: Norman sits in the left two thirds, a blank strip on the right. Narrow window and phone: the whole map area is blank, only the legend and the caption remain. This is "the gap". | 01, 02, 15 | `.layout.presenting { grid-template-columns: 0 1fr }` changes the map box but nothing calls `map.resize()`. Mapbox only listens to window resize. `applyTourStep` then eases to the fixed `CENTER/ZOOM` that was tuned for the panel layout. | `ui/layout.js`: ResizeObserver on `#map` calling `map.resize()`, plus `transitionend`. City scenes use `fitBounds` of the ward union with viewport aware padding, never a fixed center. |
| A2 | P0 | After Exit, the W Main St popup stays open over the citywide view. | 07 | `onExit` restores state and camera but never calls `popup.remove()`. | Presentation never uses the popup. Exit clears selection, callouts, flow, and closes any popup. |
| A3 | P1 | Steps 1 to 4 are static. The camera never moves, only the line colors change, and the crash heatmap stays on top of everything so the color change barely registers. Step 3's own caption admits "the map barely changes". | 02 | `CITY` camera is identical for four steps; no scene level control of the heat layer. | Each scene owns its camera and its layer set (see Design Direction, scenes 1 to 5). The heat layer gets its own scene and is off elsewhere. |
| A4 | P1 | Too much chrome during a presentation: zoom buttons, fullscreen, a disabled geolocate button, the developer HUD ("Z 11.6 · 35.2250N 97.4300W · 177/204 SEGMENTS"), the big legend card, the popup, and the caption card all at once. | 02, 03 | Presentation only hides the panel. | Presentation chrome set: full bleed map, one caption card, one progress bar, nothing else. Nav control, HUD, legend, popup hidden. |
| A5 | P1 | In the close ups the popup covers the very segment being described and repeats the caption. Two text blocks compete for the eye. | 03, 06 | `applyTourStep` opens the sticky popup on `moveend`. | No popup in presentation. Caption card carries a stat strip (VPD, lanes, v/c, crashes, score). The segment gets a short label callout on the map. |
| A6 | P1 | Steps 8 and 9 frame the segment near the top edge with 60 percent dead space below. | 04 | `segmentCameraOptions` uses `padding: 140`, `maxZoom 15.6`, pitch 45 tuned for a map that had a 360 px panel beside it. | Camera module computes padding from the caption card's actual box and uses the segment bearing for a dolly, pitch 55 to 60, zoom 15.8 to 16.4 by segment length. |
| A7 | P1 | Steps 10 and 11 bring the operating side panel back. The layout jumps, the panel's controls are live and distracting, and the heat layer again drowns Ward 2. | 05 | `step.showPanel` toggles `.tour-panel` which restores the full panel. | Ward scene uses a presentation overlay: ward mask, the top 5 as cards in the caption area, non ward crashes dimmed. The operating panel never appears in presentation. |
| A8 | P1 | Step 11 (LOS C) produces no visible change. The caption says "N segments reach or pass 1.0" but nothing on the map shows which. | 05 | Only the state flips; no emphasis. | Segments that cross 1.0 pulse twice and get a callout; the count animates in the caption. |
| A9 | P2 | The tour ends with a disabled Next button, a bare URL printed as text, and no way to replay. | 06 | Reducer stops at `total - 1`. | Closing scene: title card with Replay, Explore the dashboard, links to workbook and report. |
| A10 | P2 | Autoplay is a fixed 9 s with no visible timing; progress dots are 10 px squares that are hard to read from across a room. | 02 | `AUTOPLAY_MS` constant, `dotsHtml`. | Thin segmented progress bar with a fill that shows the autoplay countdown; pause on hover or keypress. |
| A11 | P2 | Caption text swaps instantly; no transition between scenes. | all | `put(...)` text replacement. | 250 ms crossfade of the card contents; title and stats stagger in. |
| A12 | P1 | Pitch 45 on the flat `light-v11` style with no buildings reads as a tilted sheet of paper, not a 3D city. | 03, 04 | Style is `light-v11` plus a raster satellite overlay; no 3D. | Mapbox Standard style (3D buildings and landmarks built in, `dusk` light preset for presentation) and `standard-satellite` for the aerial scene. See Design Direction. |
| A13 | P2 | The presentation starts cold on step 1 with no title. | 02 | No title scene. | Scene 0 title card: project name, prepared for, date, "press space to begin". |
| A14 | P2 | Entering Present while a ward or segment is selected keeps that selection in step 1's ranked data (the hash shows `sel=` leaking into tour steps). | hash | Tour state is spread over the saved state. | Scenes set a complete state, never a partial patch. |

## 2. Load and performance

| # | Sev | Finding | Evidence | Root cause | Fix direction |
|---|---|---|---|---|---|
| B1 | P1 | The crash heatmap pops in 3 to 6 s after the segments with no transition. Two different first impressions depending on timing. | 08, 09 | `collisions.geojson` is 3.9 MB decoded (21,252 features, full precision coordinates, verbose property names). Layers are added when everything has loaded, but Mapbox renders the heat tiles later. | Slim the file (5 decimal coordinates, short property names, drop nulls, target under 1.6 MB raw, under 400 KB gzipped). Fade the heat layer in over 600 ms on first `idle`. Stage the loading card as "segments ready, crash records loading". |
| B2 | P1 | 33 fps with 50 to 60 ms long frames during a 2 s flyTo at 1440x900. Visible stutter in the fly scenes. | rAF probe | Heat layer, 21k circles (minzoom 12.4 while heat maxzoom 14, so both render between 12.4 and 14), casing, ghost and selected layers all evaluated every frame. | Hide heat and dots during camera animation in presentation; tighten the crossfade window to 0.6 zoom levels; `line-emissive-strength` instead of extra casing layers where possible. Budget: no frame over 32 ms during any scene transition on a 2020 laptop. |
| B3 | P2 | Loading card says "about 4 MB of segment and crash data". Developer language, indeterminate bar. | 13 | `ui/loading.js` copy. | "Preparing the map" with a determinate bar driven by fetch progress (already wired through `setProgress`). |
| B4 | P2 | Geolocate control renders disabled and logs three warnings. | console | `GeolocateControl` added unconditionally. | Add only when `navigator.geolocation` exists and the page is served over https; never in presentation. |
| B5 | P2 | Fonts load from Google Fonts after first paint; the mono fallback flashes. | 08 | `display=swap` with no preload. | Preload the two or three weights actually used; self host if the venue network is uncertain. |

## 3. Explore mode (the working dashboard)

| # | Sev | Finding | Evidence | Root cause | Fix direction |
|---|---|---|---|---|---|
| C1 | P1 | At 900 px tall the controls eat 60 percent of the panel; only three ranked rows are visible. The ranked list is the product and it is below the fold. | 10 | Panel stacks briefing, help buttons, five control groups, stats, then the table. | Compact control bar (ward chips in one row, metric segmented, LOS and years behind a "Settings" disclosure), stats as a single line, table gets at least 55 percent of the panel height with a sticky header. |
| C2 | P1 | Everything is IBM Plex Mono: headings, body, buttons, captions. It reads as a terminal, not a consulting deliverable. | all | `--font` is a single family. | Type system: IBM Plex Sans for UI and body, IBM Plex Serif for the briefing title and scene titles, IBM Plex Mono for numbers, tables and labels. Same superfamily, so it stays coherent. |
| C3 | P1 | At the default zoom the blue heat surface dominates; the orange segments (the ranked product) read as secondary. | 09 | Heat intensity 0.5 to 1.3, opacity 0.75, radius up to 20 at z14. | Heat is a supporting layer: opacity 0.45, radius 8 to 18, intensity 0.3 to 0.8, color ramp that starts transparent for longer. Add a "Crash density" toggle, default on in explore, off in presentation except its own scene. |
| C4 | P2 | Legend card is large and collides with the popup and with a fitted ward. | 10 | Fixed bottom right card. | Compact legend pill that expands on click; in presentation the legend is a one line chip inside the caption card. |
| C5 | P2 | Developer HUD at the top of the map. | all | `ui/status.js`. | Remove in production; replace with Mapbox's scale control and a north indicator that appears only when bearing is not 0. |
| C6 | P2 | Ranked rows are `tr` elements with click handlers, not buttons; keyboard users cannot reach them. The "Include collectors" switch is not in the interactive tree. | a11y tree | Markup. | Rows get `role="button"` and `tabindex=0` with Enter and Space, roving focus with arrow keys; the switch becomes a real `button[role=switch]`. |
| C7 | P2 | Satellite toggle flashes black for about a second while the style swaps; the whole UI theme flips at once. | 11 | `map.setStyle` replaces the style; layers re-add on `style.load`. | Crossfade: snapshot the canvas to an image overlay, swap style, fade the overlay out when the new style is `idle`. With Standard, `standard-satellite` keeps the same label stack so the swap is calmer. |
| C8 | P2 | Selecting a ward fits the polygon but leaves it partly under the popup and legend; crashes outside the ward stay at full strength. | 10 | `wardCameraOptions` padding 48, no collision dimming. | Padding aware of overlays; crash opacity 0.25 outside the selected ward. |
| C9 | P2 | Hover tooltip did not appear with an emulated pointer at 1440x900 (may be a real bug or an emulation artifact). | hover test | Unverified. | Verify with the real renderer pass; tooltip should appear within 100 ms of hover. |
| C10 | P2 | "How to read this" is a wall of 11 px mono text inside the panel; Reset view does not close it. | screenshot | `ui/help.js`. | Four short cards with one figure each (v/c, LOS, collisions, combined), closable, and closed by Reset. |
| C11 | P2 | Header has three equal buttons (Present, Hide list, Satellite). Present is the action that matters and is not primary. | 13 | Button styles. | Present as the one filled button; Satellite and Hide list as quiet toggles. |
| C12 | P2 | Title wraps to three lines on a phone. | 13 | 16 px uppercase mono. | Shorter display title on narrow widths ("Segment priorities"), full title in the briefing. |
| C13 | P2 | Count point circles and segment endpoints (white dots) appear at z13 plus with no explanation in the legend. | 03 | `count-points` layer. | Either legend entry or hide below z14.5; in presentation hidden. |

## 4. Mobile

| # | Sev | Finding | Evidence | Root cause | Fix direction |
|---|---|---|---|---|---|
| D1 | P0 | Present mode on a phone: the map area is completely blank. | 15 | Same as A1 plus `.layout.presenting .panel { transform: translateY(100%) }` leaves the map box unchanged while the canvas was sized for the peek layout. | `ui/layout.js` resize fix; presentation on phones uses full viewport height with the caption as a bottom sheet. |
| D2 | P1 | The sheet handle cannot be dragged with a pointer; the drag pans the map instead and the user ends up over southern Oklahoma with no way back. Tapping the handle does nothing. | 14 | `ui/sheet.js` listens for touch gestures only; no recenter control. | Pointer events on the handle with three snap points (peek, half, full); tap toggles peek and half; a "Recenter" button appears when the map center leaves the city bounds. |
| D3 | P2 | Zoom, fullscreen and geolocate stack in the top right over the map on a 375 px screen. | 13 | Default nav control. | Phones get no nav control (pinch and double tap), only Recenter. |

## 5. Code and QA

| # | Sev | Finding | Root cause | Fix direction |
|---|---|---|---|---|
| E1 | P1 | The Playwright harness replaces Mapbox GL with a stub (`tests/e2e/mapbox_stub.js`) because the previous cloud session could not reach api.mapbox.com. Every rendering defect above (A1, D1, B1, C7) passed that harness. | Environment limitation of the earlier session. | A second harness, `tests/e2e/real.mjs`, that loads the real CDN with the public token on Clark's machine, screenshots every scene at three viewports, and records frame times. The swarm's visual gate runs on real pixels. |
| E2 | P2 | `tests/sheet.test.js` fails on `main` (19 of 20 pass). | Drifted expectation. | Fix in the sheet task. |
| E3 | P2 | The public token in `config.js` is a `pk.` token (fine) but its URL restriction should be confirmed against `clarksells.github.io` and `localhost` before the venue. | Account setting. | Clark checks in account.mapbox.com; the `mapbox-token-security` skill in `skills/mapbox/` has the checklist. |
| E4 | P2 | `norman-traffic-case/dashboard/` (the private repo) is behind this repo by the whole `claude/upgrade` series (no `motion.js`, `tour.js`, `facts.js`, `geo.js`, `hash.js`). | Two copies. | This repo is the source of truth for the dashboard. The pipeline's `geojson_out.py` keeps writing `dashboard/data/`; Clark copies `data/` here. Do not polish the stale copy. |

## 6. What already works and must not regress

- Client side recompute of v/c, collisions and ranks for LOS and year changes (`data.js`) is fast and correct.
- The hash deep links (`#ward=2&metric=combined&los=C&years=2021-2025&sel=...&tour=5`) are a real asset for the report and the slides; keep every key working.
- FLIP row animation in the table, count up stat tiles, hover sync between map and table.
- Dark theme on satellite is a nice touch; keep the idea, apply it through the new tokens.
- The facts module guarantees captions quote the workbook exactly; keep that discipline for every new caption.
- Reduced motion is honored end to end; every new animation must go through the same flag.

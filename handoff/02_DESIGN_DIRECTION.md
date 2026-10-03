# Design direction: presentation grade

These are the director's decisions. They are settled; task cards in `03_PLAN.md` implement them. If a builder finds a decision impossible in Mapbox GL JS v3.6, it reports the constraint and the nearest equivalent; it does not invent a different direction.

The bar: a councilmember, a city engineer, and a competition judge should each believe a professional consulting group spent three months on this. That means restraint, not fireworks. Every motion has a reason. Every number traces to the workbook. Nothing on screen is there because the library offered it.

## 1. Product principles

1. The ranked segments are the product. The map, the crashes, the 3D city, and the motion all exist to make the ranking legible and credible. If a layer competes with the segments, it loses.
2. Two modes, two chrome sets. Explore mode is an instrument: dense, quiet, keyboard friendly. Present mode is a film: full bleed, one caption at a time, a camera that always has a destination.
3. Honest motion. Flow animation encodes volume and congestion (density and speed). Pulses mark the segments the caption is talking about. Nothing animates without carrying information, and everything stops under reduced motion.
4. No new facts. Every caption figure comes from `facts.js` or is computed from the loaded data by the same functions the panel uses.

## 2. Map style and 3D

| Decision | Value | Why |
|---|---|---|
| Base style, explore and present | `mapbox://styles/mapbox/standard` | 3D buildings and landmarks come with it, consistent label stack, light presets for mood, config properties instead of hand editing layers. |
| Aerial style | `mapbox://styles/mapbox/standard-satellite` | Same label stack as Standard so the swap is calm; imagery for the lane verification scene. |
| Light preset | Explore light theme: `day`. Explore dark theme (satellite): leave the satellite style's own lighting. Present: `dusk` for city and segment scenes, `day` for the ward scene (fills need to read), satellite for the lane scene. | Dusk gives the 3D buildings shadow and the orange segments glow against a cool ground. Night loses the blue crash dots. |
| Standard config | `showPointOfInterestLabels: false`, `showTransitLabels: false`, `showPlaceLabels: true`, `showRoadLabels: true`, `show3dObjects: true`, `theme: "faded"` in present mode, `"default"` in explore. Verify names against the Standard style reference; fall back to the nearest supported property. | The data must read first; faded basemap under the thematic layers in a film. |
| Slots | wards fill and line: `bottom`. Collision heat: `middle`. Segment casing, line, flow, selected, callouts, collision dots, count points: `top`. | Segments and crash dots are never occluded by buildings; the ward tint sits under roads like a zoning map. |
| Terrain | None. | Norman is flat; terrain tiles cost bandwidth and add visual noise for no story. 3D comes from buildings and pitch. |
| Fog and atmosphere | Standard's default. No custom `setFog`. | Keep it calm. |
| Projection | Leave the default. Do not force `mercator` unless the real renderer pass shows frame time problems at city zoom. | |
| Mapbox GL version | Pin `v3.6.0` as today, or move to the latest 3.x after the real renderer pass is green on 3.6.0. | One variable at a time. |

Hash compatibility: the `basemap` key keeps the values `light` and `satellite`. `light` now means Standard with the day preset.

## 3. Type, color, surfaces

Typography (same superfamily so it stays one voice):

| Role | Face | Sizes (desktop 1440) |
|---|---|---|
| Scene titles, briefing title | IBM Plex Serif 500 | Scene title 36/42, briefing title 26/30 |
| UI, body, captions, buttons | IBM Plex Sans 400/500/600 | Caption 17/26, body 14/21, button 13 |
| Figures, table cells, legend labels, chips | IBM Plex Mono 400/500 with `font-variant-numeric: tabular-nums` | Table 13, stat value 22, chip 11 uppercase 0.08em |

Load the exact weights only, preload the three woff2 files used above the fold, `display: swap`.

Color stays on the validated palettes already in `config.js` (orange ordinal ramp for the metric, blue ramp for crash density, eight ward hues at 10 percent fill with labels). New tokens:

| Token | Light (explore) | Present (dark chrome over dusk map) |
|---|---|---|
| `--paper` | `#f6f4ee` | `#121417` |
| `--surface-raised` | `#fffdf8` | `#1b1e23` at 92 percent with `backdrop-filter: blur(14px)` |
| `--ink` | `#1c1b18` | `#f3f1ea` |
| `--ink-muted` | `#6b6963` | `#a7a49c` |
| `--accent` | `#d45f14` | `#ee7b2f` |
| `--hairline` | `#e3dfd5` | `#2a2e35` |
| `--focus` | `#2a78d6` | `#86b6ef` |

Contrast: every text token against its surface passes WCAG AA at the sizes above. Builders run the check in `skills/ecc/accessibility`.

## 4. Explore mode layout

Desktop (1024 and up): two columns, panel 400 px, map fills the rest.

Panel, top to bottom, with the vertical budget at 900 px tall:

| Block | Height budget | Contents |
|---|---|---|
| Briefing header | 96 px | Eyebrow "Council briefing", title (ward name or "All wards"), one line summary, Present as the single filled button on the right of the top bar |
| Control bar | 112 px | Row 1: ward chips `All 1 2 3 4 5 6 7 8` (one row, 36 px). Row 2: metric segmented `Combined · v/c · Crashes` and a quiet `Settings` disclosure that opens LOS, year range, Include collectors, Crash density, Traffic flow |
| Stats line | 44 px | `177 segments · 5,121 crashes 2021 to 2025 · top: W Main St` in one mono line |
| Ranked table | remainder, at least 55 percent | Sticky header, rows are buttons, rank, segment (road over from/to), v/c, crashes, score with the score cell tinted by the metric ramp, keyboard roving focus, selected row pinned visible |
| Help | overlay | "How to read this" opens a four card overlay over the panel, closed by Escape, by its close button, and by Reset view |

Map chrome in explore: scale control bottom left, a north arrow that fades in when bearing is not 0 and resets the bearing on click, compact legend pill bottom right that expands on click, satellite toggle and fullscreen in the top bar, zoom buttons top right on desktop only. No geolocate unless `navigator.geolocation` exists and the page is https; no developer HUD.

Behaviors to keep from today: hover sync map to row, click row to fly and open the popup, ward select fits the ward, LOS and year recompute client side, hash round trip, FLIP row moves, stat count up.

New behaviors: selecting a ward dims crashes outside it to 25 percent; selecting a segment reveals its own crash dots at full strength and dims the rest; the satellite toggle crossfades through a canvas snapshot so there is no black flash; a `Traffic flow` switch (default off in explore) starts the flow layer; a `Crash density` switch (default on) controls the heat layer.

Mobile (under 768): map on top, bottom sheet with three snap points (peek 148 px, half 52 vh, full 92 vh) driven by pointer events on the handle and a tap toggle; a Recenter button appears over the map when the center leaves the city bounds; no zoom buttons; Present goes full screen.

## 5. Present mode: chrome

Full bleed map. Everything below is positioned over it.

| Element | Position | Spec |
|---|---|---|
| Eyebrow | top left, 24 px inset | `CITY OF NORMAN · STREET SEGMENT PRIORITIES` mono 11 uppercase, plus `Scene 4 of 14` to its right, both at 70 percent ink |
| Caption card | bottom left, 24 px inset, max width 560 px | Title (serif 36), caption (sans 17, two to three lines), stat strip (up to four mono figures with labels), inline legend chip when the scene colors by a metric. Raised surface with blur. Contents crossfade 250 ms on scene change; title, caption, stats stagger 60 ms. |
| Progress bar | bottom center, 3 px tall, one segment per scene with 4 px gaps, width 40 percent of viewport | The current segment fills left to right during autoplay (countdown), completed segments are solid accent, future segments are hairline. Clickable segments jump to the scene. |
| Controls | bottom right | `Back` `Next` as quiet buttons, `Autoplay` as a switch, `Exit (Esc)`. Auto hides after 3 s of no pointer movement; any pointer movement or key brings it back. |
| Scrim | bottom 28 vh | Vertical gradient from transparent to 55 percent paper so captions read over any imagery. |
| Hidden in present | nav control, fullscreen control, scale, north arrow, legend pill, HUD, popup, tooltip, panel | |
| Keyboard | Right, Space, PageDown next; Left, PageUp back; Home, End; Escape exit; A toggles autoplay; F toggles fullscreen | |
| Autoplay | 10 s city scenes, 12 s segment scenes, 14 s ward and LOS scenes, title and closing do not advance | Pause while the pointer is over the caption card; resume on leave. |

On phones: caption card becomes a bottom sheet at 40 vh, progress bar under the eyebrow, controls inside the sheet, swipe left and right steps.

## 6. Camera language

Four moves, implemented once in `camera.js`, used by every scene:

| Move | Definition | Reduced motion |
|---|---|---|
| Establish | `fitBounds` of the ward union with padding that accounts for the caption card box, `pitch 55`, `bearing -18`, `duration 1600`, then a slow `rotateTo(bearing + 14)` over the scene's autoplay time with linear easing (the orbit), cancelled on any user input. | `jumpTo` the fitted camera, no orbit |
| Dolly to segment | `flyTo` to the segment's bounds camera with `curve 1.55`, `speed 0.85`, `maxDuration 2600`, `essential true`, `pitch 58`, bearing equal to the segment's own bearing so the road runs across the screen, zoom from length: under 0.25 mi 16.6, under 0.6 mi 16.1, else 15.7. On arrival a 10 s drift: `easeTo` bearing plus 6 degrees, linear. | `jumpTo`, no drift |
| Fit ward | `fitBounds` of the ward polygon, padding aware of the caption card, `pitch 42`, `bearing -10`, `duration 1800`, then a slow 8 degree drift. | `jumpTo` |
| Aerial | `standard-satellite`, segment camera at `pitch 62`, `zoom 16.8`, then a 25 degree orbit over the scene time. | `jumpTo`, no orbit |

Padding rule: `{ top: 96, right: 64, bottom: captionCardHeight + 64, left: captionCardWidth + 64 }` on desktop; on phones `{ top: 72, left: 24, right: 24, bottom: 40vh + 24 }`.

Interruptions: wheel, drag, or pinch during a scene cancels the orbit and drift but keeps the scene; Next from an interrupted scene resumes the choreography.

## 7. Traffic flow animation (the "show traffic" layer)

Technique: the Mapbox ant path (a `line` layer whose `line-dasharray` cycles through a precomputed sequence). It is GPU cheap, needs no custom shader, and the stub harness can assert the sequence. Reference: `skills/reference/mapbox-gl-v3-cheatsheet.md` section 6.

| Property | Encoding |
|---|---|
| Layer | `segments-flow`, slot `top`, above `segments-line`, below `segments-selected` |
| Color | white at 85 percent in present (dusk), `--paper` at 70 percent in explore light, so the flow reads as moving light on the orange line |
| Width | `segments-line` width minus 55 percent, so the orange stays visible as the lane |
| Dash density (VPD) | three classes on `vpd_max`: under 8,000 dash 1.2 gap 4; 8,000 to 18,000 dash 2 gap 3; over 18,000 dash 3 gap 2 (units of line width). Encoded by splitting the source into three flow layers with filters, since `line-dasharray` is not data driven. |
| Speed (v/c) | three classes on the active v/c: under 0.5 free flow, step every 45 ms; 0.5 to 0.8 moderate, every 70 ms; over 0.8 congested, every 110 ms. Encoded by giving each VPD layer its own filter on v/c class as well (nine small layers) or, simpler and preferred, by advancing the three VPD layers' phase at a rate chosen per layer from the median v/c of the segments in that layer. Builder picks the simpler one unless the real renderer pass shows the congested class is not readable. |
| Direction | one way streets: dash runs in the line's vertex direction (the pipeline writes one way lines in the travel direction; verify against `one_way` and reverse coordinates in `scripts/slim-data.mjs` if not). Two way: single lane in vertex direction for v1. v2 stretch: two offset lanes with `line-offset` ±0.35 width and opposite phase. |
| Frame budget | `requestAnimationFrame` loop throttled to 20 updates per second, one `setPaintProperty` per layer per step, stopped when `document.hidden`, stopped during `flyTo` (restart on `moveend`), never started under reduced motion. |
| Where it runs | Present: scenes 1, 2, 5 and the five segment scenes. Explore: only when the `Traffic flow` switch is on. |

## 8. Crash reveal

In each segment scene the crashes assigned to that segment drop in: `circle-radius` goes 0 to final over 900 ms with a stagger by year (2021 first), using a feature state `t` driven by a tween, while the caption's crash figure counts up with the existing `animateNumber`. Other crashes are at 12 percent opacity. Under reduced motion the dots are simply present.

Heat layer in present: visible only in scene 3 ("Where crashes cluster"), faded in over 600 ms, with the segments at 35 percent opacity so the surface reads. Everywhere else in present the heat is off.

Heat layer in explore (supporting role): opacity 0.45, radius 8 at z10 to 18 at z14, intensity 0.3 to 0.8, color ramp with the first stop at density 0.3, maxzoom 13.6; dots from 13.0 with a 0.6 zoom crossfade.

## 9. Callouts and emphasis

- Callout: a `symbol` layer on a point source at the segment midpoint with `text-field` = rank and road (`#1  W Main St`), `text-anchor` chosen from the segment bearing so the label sits beside the line, `text-halo` in the surface color, `symbol-sort-key` by rank, `text-allow-overlap` false. Used in scene 5 (top five labeled) and in each segment scene (just that one).
- Pulse: `line-width` tween on `segments-selected` from 1.0x to 1.6x and back, twice, 1.4 s total, used when a scene introduces a segment and in the LOS C scene for every segment that crosses 1.0.
- Ward mask: in ward scenes a fill layer over everything outside the ward at 45 percent paper (built as the ward union polygon with a hole), so the ward reads as a stage.

## 10. Scene storyboard (14 scenes)

Captions quote `facts.js` and `TOP5` exactly as the current `tour.js` does; new captions below are direction, the builder keeps the existing fact tokens.

| # | Scene | Basemap, preset | Camera | Layers | Caption card | Autoplay |
|---|---|---|---|---|---|---|
| 0 | Title | standard, dusk | Establish, no orbit, segments visible at 50 percent | segments | Title "Norman street segment priorities", line "Congestion, crashes and a combined score for every counted segment, by council ward", eyebrow "Prepared for the City of Norman · MIS Data Analytics Case Competition · October 2026", hint "Press space or Next" | manual |
| 1 | Every counted segment | standard, dusk | Establish with orbit | segments combined, flow on | "204 segments ..." existing caption. Stats: segments 204, crash records 23,595, assigned 5,307 | 10 s |
| 2 | Volume alone | standard, dusk | hold, orbit continues | segments v/c, flow on (speed now visible) | existing v/c caption. Stat: highest v/c 0.88. Legend chip v/c | 10 s |
| 3 | Where crashes cluster | standard, dusk | hold | heat fades in, segments 35 percent, flow off | "Five years of crash records as a density surface ..." Stat: assigned 5,307 | 10 s |
| 4 | Crashes by segment | standard, dusk | hold | heat fades out, segments collisions | existing crash caption | 10 s |
| 5 | The combined score | standard, dusk | hold, orbit ends | segments combined, callouts for the top five, each pulses in rank order 400 ms apart | existing combined caption, stat strip of the five scores | 12 s |
| 6 to 10 | #1 to #5 citywide | standard, dusk | Dolly to segment, drift | that segment selected, callout, crash reveal, flow on | `#1 citywide: W Main St`, caption with span, stats VPD · lanes · v/c · crashes · score | 12 s each |
| 11 | How a councilmember reads their list | standard, day | Fit ward 2, drift | ward mask, ward 2 segments combined, others dimmed, crashes outside ward 25 percent | existing Ward 2 caption; stat strip replaced by the top five list cards for ward 2 (rank, road, score) | 14 s |
| 12 | What moves under LOS C | standard, day | hold | LOS C state; segments that reach 1.0 pulse twice and get callouts | existing LOS C caption with the live count | 14 s |
| 13 | The lane count story | standard-satellite | Aerial on 52500-158 with orbit | segment selected, flow on, callout "6 lanes · 31,886 VPD" | existing lane caption without the URL | 14 s |
| 14 | Closing | standard, dusk | Establish, no orbit | segments 50 percent | "Explore it yourself", buttons Replay, Explore the dashboard, links to the workbook and the report, the live URL as a copyable chip | manual |

Transitions: basemap changes (scene 12 to 13 and 13 to 14) go through the crossfade snapshot so there is never a black frame.

## 11. Performance budget (measured by `tests/e2e/real.mjs` on Clark's machine)

| Metric | Budget |
|---|---|
| First map paint with segments | under 2.5 s on a 20 Mbps connection, cold cache |
| Heat layer visible | under 4.5 s cold, fades in, never pops |
| Transfer | `collisions.geojson` under 1.6 MB raw, under 400 KB gzip; total data under 2.2 MB raw |
| Scene transitions | no frame over 32 ms, median frame under 17 ms at 1440x900 |
| Flow animation idle cost | under 4 ms per update, 20 updates per second |
| Memory | no growth across a full tour loop run three times |

## 12. Accessibility and reduced motion

- Every control reachable by keyboard, visible focus ring in both themes, roving focus in the ranked table.
- Present mode announces scene titles through the existing `aria-live="polite"` region; the progress bar is a `tablist`.
- `prefers-reduced-motion`: no orbit, no drift, no flow, no pulse, no crash drop; crossfades become instant; the tour still works as a slide show.
- Contrast AA for all text; the orange ramp is never the only encoding (rank numbers and labels carry it too).

## 13. Out of scope for this pass

Hexbin crash aggregation, custom WebGL particle traffic, terrain, a narrated audio track, and a video export. Each is a follow up with its own card if the real renderer pass shows headroom.

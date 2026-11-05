# Norman Street Segment Priorities, site redesign design spec

Date: 2026-11-05
Author: Clark Hobbs with Claude
Status: for Clark's review, then `docs/superpowers/plans/2026-11-05-site-redesign.md` executes it
Inputs: `docs/audit/2026-11-05-ui-audit.md` (35 findings, design direction), `docs/research/2026-11-05-scout.md` (data, references, code, assets), `../norman-traffic-case/docs/audit/2026-11-05-scope-audit.md` (assignment adherence, G1 to G15), the assignment documents, the Phase 2 design, and the night build spec.

## 0. What this is

The current dashboard is a one page instrument with a presentation mode, a Simulate section and a 3D site view, built in three rounds on a written design direction. It works, the gates are green (37 unit test files, 106 Playwright checks), and the bones are good. Three things keep it from reading as a finished professional product: load bearing layout defects a judge hits in the first thirty seconds (clipped score column, popup off screen, heat map burying the ranking, a developer note on a city facing screen, a token that fails silently off its origin); system drift that makes it feel generated (two switch designs, five corner radii, uppercase mono everywhere, a `//` prefix); and the fact that the analytics, which is what the class grades, is invisible on the site. The Python programs exist, the figures do not.

This spec turns the dashboard into a small, coherent site with four surfaces that share one visual system:

| Surface | File | Job |
|---|---|---|
| Map | `index.html` | The instrument: ranked list, map, Explore and Simulate tabs, popup and inspector, site view |
| Film | `index.html#present` (same page, present mode) | The 10 minute talk: 17 scenes plus a 15 second night opener |
| Methods | `methods.html` | One section per Python program: the question, the rule, the parameters, the figure the pipeline drew, the columns it added, how to check it |
| Data and report | `data.html` | Sources with licenses and feature service links, the workbook and report downloads, the assumption table, the adherence summary |

Every number on every surface comes from the pipeline's outputs. No headline figure is typed in.

## 1. Decisions

| Question | Decision | Why |
|---|---|---|
| Visual direction | Editorial light: warm paper, ink, the validated orange ramp as the only data hue, one brand accent (OU Crimson `#841617`) used only on the eyebrow rule, the primary button and the film's title card, never for data | The UI audit's "consulting report, not startup dashboard" and the scout's Direction 2 agree. The orange ramp is validated and already in the report; changing the encoding this close to the talk buys nothing. Crimson is sanctioned for digital by OU and reads local. Two hues, two jobs |
| Dark mode | Only for the aerial basemap and the film. Ramp reversed on dark (brightest equals highest) with a 2 px dark halo and no white casing | Ramp steps 4 and 5 fail contrast on dark (1.76:1 and 3.0:1); the one justified ramp change |
| Film opener | 15 seconds, Mapbox Standard `night` preset, camera flies from I-35 at Lindsey into Campus Corner along a `line-gradient` reveal of the game day route, then crossfades to the day preset and scene 1 | The scout's Direction 1 opener without deck.gl: `line-gradient` on `line-progress` is in Mapbox already, no new dependency, and it reuses `daytypes.json` routes |
| Architecture | Static ES modules, no bundler, no framework, no new npm dependencies, Mapbox GL JS 3.6 from the CDN, three.js from the CDN for the site view only | Unchanged. GitHub Pages hosts it, the gates run in node |
| Pages | Three HTML files sharing `tokens.css`, `style.css`, a new `site.css` for the two document pages, and a shared `ui/sitenav.js` header | A document page in the map's chrome would fight the map; two plain pages in the same type system read as one product |
| Methods figures | Drawn by the pipeline with matplotlib into `output/figures/methods/*.svg` and copied into the dashboard's `figures/methods/`. The methods page shows the SVGs and, for four of them, an interactive version drawn from the JSON files already shipped | The class is graded on Python; the figures must be Python's. Interactive charts are the dashboard's job and need no library (inline SVG from data) |
| New data layers | Programmed projects (City `Projects_Polyline_View` and the 2026 SMB layers with `CalendarYear`), flood hazard, schools, OU property, building footprints with real heights, signalized intersections (ADA layer plus ACOG crash `Intersection_Control`) | All public City of Norman or ACOG feature services found by the scout. Programmed status is the Tier 1 flag the Phase 2 design wanted and never got |
| 3D site view | Stays, re-skinned into the system, developer prose removed, provenance moved to the data page | Clark's call to keep Aleph. The data page carries the attribution and the terms note in plain words |
| Audit fixes | The scope audit's G1 to G15 ride along: wording ("verified by a person"), workbook README sheet count, scene 3 crash count, tie rule alignment, contracts alignment. The sponsor claim and the collector override disclosure are report edits Clark makes himself | They are small and they are the kind of thing a judge notices |

## 2. Audience and tone (frontend design direction)

Purpose: a council briefing instrument that ranks every counted street segment in Norman by congestion and crashes, shows where the ranking comes from, lets staff test a closure, a game day or a growth year without leaving the map, and shows the Python that did it.

Audience: City of Norman traffic engineers (numbers, method, one corridor fast), councilmembers (their ward's five), MIS faculty judges (analysis and craft in the same screen). Projector first, laptop second, phone in the field.

Tone: consulting report, not startup dashboard. Quiet chrome, loud data. Dense but calm. Nothing on screen because the library offered it.

Memorable detail: the square knob. Switches, slider thumbs, the selected row rule and the film's progress bar are small ink squares, so the instrument feels machined. Every figure anywhere on the site is Plex Mono with tabular numerals, because they all came from the same workbook.

Constraints: Mapbox GL JS 3.6 Standard, no bundler, ES modules, WCAG AA for every text token on its surface, reduced motion still works as a slide show, one radius scale, one switch, one button border, no gradients except the two film scrims, no icons that are not controls, no developer words on screen.

## 3. Visual system

### 3.1 Tokens (`tokens.css`, the only place colors and type live)

Light (map explore, methods, data):

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f6f4ee` | page, panel |
| `--surface-raised` | `#fffdf8` | popup, inspector, legend, figure frames |
| `--ink` | `#1c1b18` | text, active controls, knobs |
| `--ink-muted` | `#6b6963` | labels, spans, secondary figures |
| `--hairline` | `#e3dfd5` | rules, table lines |
| `--accent` | `#d45f14` | ramp step 3, selected row rule, progress fill (never text under 24 px) |
| `--link` | `#b44e0d` | links, the one filled button |
| `--brand` | `#841617` | eyebrow rule, film title card rule, methods page section numerals. At most 2 percent of any screen |
| `--focus` | `#2a78d6` | focus ring |
| `--accent-soft` | `#fbe9dc` | selected row, caveat background |
| ramp | `#f59e5c #ee7b2f #d45f14 #a4480e #6d2f09` | segment score classes, unchanged |
| blue ramp | `#86b6ef #5598e7 #2a78d6 #1c5cab #0d366b` | crash dots and density, unchanged |
| `--closed` | `#1c1b18` plus a 45 degree hatch sprite | closed segment |
| `--programmed` | `#2a78d6` | programmed project overlay (dashed), same hue family as crashes so it reads as context, not score |

Dark (film, aerial basemap): `--paper #121417`, `--surface-raised rgba(27,30,35,0.92)` plus 14 px blur, `--ink #f3f1ea`, `--ink-muted #a7a49c`, `--hairline #2a2e35`, future progress `rgba(243,241,234,0.3)`, `--accent #ee7b2f`, `--focus #86b6ef`, dark ramp `#6d2f09 #a4480e #d45f14 #ee7b2f #f59e5c` (reversed) with a 2 px `#0b0c0e` halo at 70 percent and no white casing. The legend says "brighter is higher".

Type (one superfamily, IBM Plex, already loaded):

| Role | Spec |
|---|---|
| scene title | Serif 500, 36/42 |
| briefing title, page title | Serif 500, 24/28 (methods page h1 32/38) |
| product title | Serif 500, 15, mixed case |
| caption | Sans 400, 17/26, max 34rem, max three lines |
| body and table | Sans 400, 13/19.5 (methods page body 15/24, max 68ch) |
| control labels and eyebrows | Sans 600, 11, uppercase, 0.06em, ink muted, section labels only |
| buttons | Sans 500, 13 |
| figures | Mono 500, tabular: table 13, popup 15, stat 22, callout 14, chip 11, methods figure caption 12 |
| legend title | Sans 600, 12, sentence case |

Spacing: 4 px base, 4 8 12 16 20 24 32 48. Panel gutter 20. Row height 48. Control row 36. Top bar 60. Radii: 2 (chips, switch, knob, thumb), 4 (buttons, segmented, inputs), 8 (popup, legend, help, figure frame), 12 (film card, phone sheet). Nothing else.

Motion: four kinds only (camera, flow, pulse, crash reveal); everything else is a 150 to 350 ms crossfade; `cubic-bezier(0.22, 1, 0.36, 1)` out; reduced motion zeroes every duration.

Copy: sentence case except eyebrows; commas and periods, no dashes; "crashes" in the UI; a unit on every figure; scenario state in one chip row; a caption is one claim and one number; no developer words (endpoint, pipeline, stub, sample, site.json).

### 3.2 Shared chrome

`ui/sitenav.js` renders the top bar on every page: product title (Serif 15, mixed case) with a 2 px `--brand` rule under it, then three text links Map, Methods, Data, right aligned actions (Present, Aerial on the map page). Active link gets the 2 px rule. 60 px tall, hairline bottom. On phones the links collapse to a 36 px segmented control under the title.

Footer on the document pages: one line, Sans 11 uppercase ink muted, "Data: City of Norman GIS, ACOG, ODOT. Imagery: Google via Aleph. Built for the MIS Data Analytics Case Competition, fall 2026." No logos (City logo may not be copied; OU seal is a trademark).

## 4. The map page

### 4.1 Layout

Left panel 400 px (phones: the existing sheet). Map fills the rest. Top bar from 3.2. The panel is three stacked regions with fixed heights so the ranked list never loses its room:

1. Briefing header (eyebrow, ward title, one line summary, two small buttons), 132 px.
2. Control block, 232 px, a two tab segmented control `Explore · Simulate` on its top row. Explore shows ward, metric, LOS, collision years. Simulate shows day type, year with Play, extra growth, forecast range, close a segment. The tabs swap contents, nothing stacks (UI audit B1).
3. Stats line and the ranked table, everything that is left (at 900 px tall: 476 px, nine rows).

Scenario state lives in one chip row under the stats line, never in the briefing line: `2031 · base · +2 percent · game day · W Main St closed`. The briefing line stays one line.

### 4.2 Ranked table (A1, C5, C6)

`table-layout: fixed`, columns rank 40, segment auto, v/c 52, crashes 64, score 76. Segment cell `max-width: 0` so names ellipsize. Spans one line, title cased by `scripts/slim-data.mjs` (data is never hand edited). Score bar becomes a 3 px rule under the figure in that score class's ramp color, so the table doubles as the map key. Closed segment row shows a "closed" chip instead of 0.00. Header under a scenario reads "v/c 2031" with the full sentence in `title` and `aria-label`.

### 4.3 Popup and inspector (A2, C15)

Click a segment: a short popup (title, span, chips, the six figures, score row, two buttons "Details" and "View site in 3D" where a site exists). About 300 px. Never leaves the stage: `maxWidth 360`, auto anchor.

"Details" opens the inspector, a 400 px right drawer on desktop (replaces the popup), the full sheet on phones. Sections in order: media (aerial, two Street View headings, captioned "Looking north, 2021"), forecast (growth line, 2035 v/c with range, year to 0.9, upgrade, headroom), programmed (project name, work type, bond year, calendar year, status, from the new layer), flags (flood zone, school within 400 m, speed), crashes by year (a 5 bar mono sparkline), caveats, "Open in Google Maps" as the last quiet link. Every row only when the field is not null.

### 4.4 Layers (A3, B2, B11, new)

| Layer | Default | Notes |
|---|---|---|
| segments (casing, line, ghost, selected, pulse) | on | light: casing stays; dark: 2 px dark halo, no casing, reversed ramp |
| count points | z14 and up | unchanged |
| wards fill, line, label | on | mask built from a world ring with the ward as the hole |
| crash dots | on | unchanged |
| crash density | off | when on: radius 18 at z10 to 40 at z14, intensity 0.15 to 0.5, opacity 0.28, first stop at 0.45, dimmed outside the selected ward |
| flow | off | unchanged |
| programmed projects | off, switch "Programmed projects" | dashed `--programmed` 2 px lines from `data/projects.geojson`; hover shows name and year |
| context (flood zone, schools, OU property) | off, one switch "Context" | flood as a 6 percent blue fill, schools as 5 px ink squares with a label at z14, OU property as a hairline outline |
| buildings | on above z15, aerial basemap only | `fill-extrusion` from `data/buildings.geojson` with `BuildingHeight`, 60 percent opacity, Standard's own 3D objects off (`show3dObjects: false`) so nothing double renders |
| closure overlay | scenario | closed segment 4 px ink with hatch pattern and a "Closed" callout; detour 4 px accent with line arrows and a "+0.84 v/c" callout at its midpoint |
| game day routes | scenario | unchanged dash animation, origins as labeled ink squares |
| callouts | film and top five | HTML markers (`mapboxgl.Marker`) Mono 14 with a 2 px accent leader, per callout anchor from the segment bearing, collision pass pushes overlapping labels down |

Basemap: Standard `day`, `theme: "faded"`, POI and transit labels off, road labels on, 3D objects off (we draw our own buildings). Aerial: `standard-satellite`, dark chrome and dark ramp. Attribution compact, logo at 60 percent in the film.

Token (A5): the token's allowed URLs get `http://localhost:*`, `http://127.0.0.1:*` and the Pages origin; the loading card shows a plain error sentence when a `/v4/` tile answers 403 (`map.on("error")`).

### 4.5 Simulate tab

Controls, top to bottom, each a 36 px row: day type as a 2 by 3 grid of equal cells (School Friday, School weekday, Weekend, Summer weekday, OU game day, blank), year range 2025 to 2035 with a Play button and the year in Mono 15 at the right, "Extra growth, percent per year" segmented `+0 +1 +2`, "Forecast range" segmented `Low Base High`, "Close a segment" switch with the hint "then click a segment". Reset scenario as a small button. The assumption sentence for the active day type sits in the control's `title` and in the inspector's forecast section, not in the panel.

Nothing about the scenario math changes (CONTRACTS C.13 to C.17 stand, with the growth method wording updated to the pooled model).

### 4.6 Legend (B10, C12)

Bottom left. Collapsed: the metric name (Sans 12 sentence case) over the five swatches. Expanded: swatches with their break values in Mono 11, the crash dot key, and one chip for the scenario year when not default. Dark mode adds "brighter is higher". Phones at peek: the 36 px ramp strip only.

### 4.7 Site view (A4, B13)

Same overlay, re-skinned: app tokens, the briefing header pattern (eyebrow "Site view · Ward 2", Serif title, meta line, "Back to W Main St" link), labels as two line pills (road, then figures) at most 28 characters wide with a leader line and a screen space collision pass, Street View strip as a captioned 4 up grid, ground plane in `--paper` under the mesh so the capture edge does not float. On screen copy: "3D capture of the intersection. Drag to orbit, scroll to zoom." Fallback: "No 3D capture for this site yet. Showing the aerial camera." Provenance lives on the data page.

## 5. The film

Seventeen scenes stay. Changes:

| Scene | Change |
|---|---|
| 0 opener (new) | 15 s: Standard `night`, camera at I-35 and Lindsey pitch 60 bearing 70, `line-gradient` reveals the game day route from the Lindsey interchange to the stadium while the camera eases along it (the route is in `daytypes.json`, sampled by cumulative length in `geo.js`), title card fades in at 10 s with the product title and the brand rule, crossfade to `day` and scene 1 at 15 s. Reduced motion: the title card alone for 4 s |
| 1 citywide | establish fits the bounds of `segments.geojson` plus 8 percent, never the ward union (B3); title card sits in the lower third with the grid above it |
| 3 heat | caption counts the in window crashes from `facts.json` (G2 in the scope audit) |
| 6 top five | camera fits the top five bounds; callouts are HTML markers with leaders; five rows in the card, not five stats (B4, B6) |
| 11 ward | world ring mask; list rows with hairlines, no cards in cards (B11, C7) |
| 13 runout | the year counts up in the title line; two stats; caption one claim and one number (B6, B7) |
| 14 closure | camera fits the closed segment plus detour; hatch and arrows as in 4.4; caption 24 words (B7, B8) |
| 15 lanes | caption says "verified against aerial imagery by the project team" (G8) |
| 16 closing | URL as a copyable chip, filled "Explore the dashboard", text links Workbook, Report, Methods (C8) |

Chrome: progress bar across the full width at `bottom: 8px` (B5), future segments at 30 percent ink (C10), one switch design (B9), stat strips capped at four (B6), phone card full width (B12), attribution compact.

## 6. The methods page

`methods.html`. A long document in the type system: page title "How the numbers were made", a one paragraph lede, a sticky left contents rail (desktop) listing the fourteen sections, then one section per Python program in pipeline order. Each section has the same anatomy so a reader learns it once:

1. Numeral in `--brand` Mono 22, the program name in Serif 24 (`ingest_counts.py`), and the question it answers in Sans 17.
2. "The rule" in one or two sentences with the formula in Mono.
3. A figure frame (8 px radius, hairline, `--surface-raised`) holding the pipeline's SVG, with a Mono 12 caption naming the source file and the parameters.
4. A small table: parameters (from `config.py`), columns added (from CONTRACTS.md), test file.
5. "How to check it": one sentence a judge could act on.
6. For four sections an interactive version under the SVG (inline SVG drawn from the shipped JSON, no library): growth back test (dot plot of predicted vs actual, hover shows the station), horizon (sortable table of the top 20 by year to 0.9 with band switch), closures (pick a segment, see its detour table), day types (bar strip per segment for the top ten under each day type).

The fourteen sections and their figures (all drawn by `src/outputs/figures_methods.py` into `output/figures/methods/`):

| # | Program | Figure (SVG) | Interactive |
|---|---|---|---|
| 1 | `ingest_counts.py` | counts by fiscal year and by month (the school year Friday pattern), 500 rows | no |
| 2 | `select_volume.py` | histogram of counts per station (1 to 5) and the share where the max is not the latest | no |
| 3 | `enrich_gis.py` and `lane_review.py` | city lanes vs verified lanes confusion matrix (6 by 6 heat table) | no |
| 4 | `capacity.py` | the ACOG table as a stepped chart: capacity by lane configuration at LOS C and E | no |
| 5 | `wards.py` | small map: count points colored by ward, boundary segments ringed | no |
| 6 | `segment_geometry.py` | one example: the centerline, the two cross streets, the clipped segment, the 30 m buffer | no |
| 7 | `collisions_load.py` and `collisions_assign.py` | audit category bar (eight bars, 23,595 rows) and the A vs B agreement | no |
| 8 | `scoring.py` | scatter of v/c vs crashes, point size by combined, top ten labeled | no |
| 9 | `qa.py` | the QA table as a figure: each check as a row with pass mark | no |
| 10 | `forecast/growth.py` and `backtest.py` | two panels: consecutive count ratio distribution (p05 to p95 shaded) and the back test MAPE bars (naive, low, base, high, own trend) | yes, predicted vs actual dots |
| 11 | `forecast/horizon.py` | small multiples: v/c path 2025 to 2035 for the top 12 segments, three bands as a ribbon, 0.7 and 0.9 rules | yes, horizon table |
| 12 | `scenarios/graph.py` and `closure.py` | the road graph (6,365 nodes) in ink with one closure's detour in accent; histogram of detour ratios | yes, closure picker |
| 13 | `scenarios/daytype.py` | top ten segments by game day v/c as grouped bars across the five day types; map inset of the routed flows | yes, day type strip |
| 14 | `scenarios/speed.py` and `sites/aleph_sites.py` | measured vs posted scatter with the +10 line; the five site boxes on a small map | no |

Figure style (matplotlib, one `style_methods()` function): paper background, ink text, Plex fonts if installed else DejaVu, no top or right spines, the orange ramp for ordinal values, blue for crashes, 11 pt labels, SVG with `svg.fonttype: none` so text stays text. Width 920 px, height per figure 420 to 560.

## 7. The data page

`data.html`. Sections:

1. Downloads: the workbook (20 sheets, listed), the report (docx and md), the geojson and JSON files with sizes, a "rebuild from raw" note.
2. Sources table: every dataset used or offered, with provider, feature service URL, fields used, license, retrieved date. From the scout: City Street_Centerlines, Proposed_Functional_Classifications, Council_Wards, Projects_Polyline_View, the 2026 and 2021 SMB layers, Building_Footprint, Flood_Hazard_Zone, NormanSchools, University_Of_Oklahoma_Property, ADA_Transition_Plan_GIS_Data; ACOG counts (the five workbooks), ACOG roadway capacity guideline, ACOG_Crash_Map, ACOG_MPO_FC_Roads; ODOT AADT_Network; collisions workbook (City); Google Street View, satellite and 3D via Aleph with the terms note in plain words.
3. Assumptions table (the Phase 2 and night build assumptions with source today and replacement source).
4. Adherence summary from the scope audit: what is required and met, what is interpreted, what is beyond the ask, in three short tables.
5. Method notes that used to live in the UI (the site view provenance, the sample data note).

## 8. Pipeline additions (`norman-traffic-case`)

| Piece | Module | Output |
|---|---|---|
| New GIS downloads | `src/gis_download.py` gains six services in `config.GIS_SERVICES`: projects, smb_2026 (five layers merged), buildings, flood, schools, ou_property, ada_intersections | `data/gis/*.geojson` |
| Programmed flag | `src/enrich/programmed.py`: `add_programmed(segments, projects_path, smb_path, buffer_m=25) -> segments` with `programmed (bool), programmed_name, programmed_type, programmed_year, programmed_status, programmed_source` from any project line within 25 m sharing the road key | columns on `segments`, `Programmed_Projects` sheet |
| Context flags | `src/enrich/flags.py`: `add_context_flags(segments, flood_path, schools_path, signals_path) -> segments` with `flood_zone, school_400m (int), signalized_from, signalized_to (bool or None)` | columns, `Context_Flags` sheet |
| Dashboard layers | `outputs/geojson_out.py`: `write_projects_geojson`, `write_context_geojson`, `write_buildings_geojson` (clipped to the city bounds, `height` property) | `dashboard/data/projects.geojson`, `context.geojson`, `buildings.geojson` |
| Methods figures | `src/outputs/figures_methods.py`: `draw_all(ctx, out_dir)` with one function per section | `output/figures/methods/01_counts.svg` to `14_speed_sites.svg`, copied to the dashboard `figures/methods/` |
| Facts | `outputs/facts_out.py`: `write_facts_json` | `dashboard/data/facts.json`, which replaces the typed values in `facts.js` (the dashboard reads it at load and `facts.js` becomes a thin accessor) |
| Audit fixes | `outputs/workbook.py` README sheet lists all 20 sheets; `scripts/validate_outputs.py` asserts 20; `Sensitivity` pivot keeps rows with NaN from or to (`dropna=False`) | |

## 9. Audit fixes carried in this spec

| Audit id | Fix | Where |
|---|---|---|
| G1 | README sheet and validator list 20 sheets | pipeline `workbook.py`, `validate_outputs.py` |
| G2 | scene 3 caption uses the in window count | `scenes.js`, `facts.json` |
| G3 | dashboard ranks use min rank on ties like the workbook | `data.js rankedRows` |
| G8 | "verified by a person" becomes "verified against aerial imagery by the project team" | `ui/help.js`, `scenes.js` |
| G11 | Sensitivity sheet keeps the three NaN rows | `run.py sensitivity()` |
| G13 | CONTRACTS C.13 and C.16 describe the pooled model | `CONTRACTS.md` |
| G14 | explore says "177 arterial segments", scene 2 says "204 counted segments, 177 arterials" | `ui/panel.js`, `scenes.js` |
| G5, G7 | report edits Clark makes: collector override disclosure, sponsor claim | `docs/report/sections/03_method.md`, `04_assumptions.md` (not in the plan) |

## 10. Testing and gates

Unchanged gates stay green at every commit: `npm test` (unit files, node, fake DOM), `node tests/e2e/verify.mjs` (stub drive, 0 console errors). New checks: `tests/sitenav.test.js`, `tests/inspector.test.js`, `tests/tabs.test.js`, `tests/projects_layer.test.js`, `tests/methods.test.js` (the methods page lists fourteen sections and every figure file exists), `tests/data_page.test.js`, a verify drive step for the Simulate tab and the inspector, and a methods page drive that checks every `<img>` loads. Pipeline: `pytest` stays green, `python run.py` writes the fourteen SVGs and validates them (every file over 2 KB and well formed XML).

Real renderer check before the talk, on the presentation machine: `node tests/e2e/real.mjs` with the token fixed, 0 tile errors.

## 11. Out of scope

deck.gl trips, SUMO, a backend, Census joins, ODOT ATR factors (data not public), a custom Studio style, any change to the ranking method, any ramp change on light.

## 12. Order of work (the plan's waves)

1. Wave A, the P0 fixes and the audit fixes: table, popup split and inspector shell, heat default off, site view copy, token and 403 watcher, G2, G3, G8, G11, G13, G14, README sheet count.
2. Wave B, the system: tokens and radii and the one switch, sitenav, Explore and Simulate tabs, legend, chip row, establish bounds, world ring mask, callout markers, film chrome.
3. Wave C, data: GIS downloads, programmed and context flags, buildings, projects and context layers, inspector sections, facts.json.
4. Wave D, methods: `figures_methods.py`, `methods.html`, the four interactive figures, `data.html`.
5. Wave E, film: opener, closure scene styling, scene captions, closing card, dark ramp.
6. Wave F, site view re-skin, phone pass, the real renderer run.

Cut from the bottom. Waves A and B alone make the current site presentable; D is what makes it a data analytics project.

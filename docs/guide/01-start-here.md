# Start here

This is the reading guide for the Norman street segment priorities dashboard. It is written for someone opening the repository for the first time who wants to understand every line. Read this page, then `02-code-map.md` for the file by file map, then `03-features-explained.md` for one section per feature.

## What the dashboard is

A single page web app that shows every counted street segment in Norman, Oklahoma, colored and ranked by congestion (volume to capacity, v/c), by crashes, or by the combined score the case brief defines (crashes plus v/c). A council member picks their ward and reads a ranked list. A planner opens the Simulate section and projects each count forward, picks a day type, or closes a segment to see where the traffic goes. A presenter presses Present and gets a 17 scene scripted walkthrough with camera moves and captions.

The map is Mapbox GL JS v3 on the Mapbox Standard style. There is no framework, no bundler and no build step: plain ES modules loaded by `index.html`, CSS in three files, data in `data/` as GeoJSON and JSON.

| Piece | What it is |
| --- | --- |
| `index.html` | The one page. Every DOM id the code looks up is declared here. |
| `app.js` | The entry point. Creates the map, loads data, adds layers, wires the UI, runs present mode. |
| `state.js` | The one state object and its subscribe and setState functions. |
| `data.js` | Loading and every computed number (v/c, crashes in window, combined score, scenario math, ranks). |
| `layers/` | One module per group of Mapbox layers (segments, collisions, wards, flow, callouts, closure, gameday, points, basemap). |
| `ui/` | One module per panel or overlay (panel, popup, tooltip, legend, help, loading, layout, mapchrome, sheet, simulate, siteview, present, tour). |
| `scenes.js`, `facts.js`, `caveats.js` | The present mode storyboard, the verified constants, the per segment data notes. |
| `tokens.css`, `style.css`, `present.css` | Design tokens, the explore chrome, the present chrome. |
| `data/` | The pipeline's output: segments, collisions, wards, count points, summary, and the three Simulate files. |
| `sites/` | 3D captures of the top intersections (`index.json`, one folder per site with `site.json`, `mesh.glb`, Street View images). |
| `tests/` | Node unit tests on a fake DOM and a recording map double, plus the Playwright drives under `tests/e2e/`. |
| `scripts/` | `slim-data.mjs` (shrinks the collisions file) and `stamp_sample.mjs` (made up Simulate data for development). |

## How to run it locally

The app fetches its data files, so it needs an HTTP server, not a `file://` URL.

```
cd norman-traffic-dashboard
npm run serve
```

`npm run serve` runs `python3 -m http.server 8000`. Open `http://localhost:8000/` in a browser. Any static server works the same way, for example `npx serve .` on port 3000, as long as the repo root is the document root so `data/`, `sites/` and the module imports resolve.

The Mapbox token is in `config.js` (`MAPBOX_TOKEN`). It is a public token restricted to the hosting URL and localhost, so the map loads on localhost and on the published page; on another host the style request fails and the loading card turns into an error.

## How it is deployed

GitHub Pages serves the `main` branch of this repository at `https://clarksells.github.io/norman-traffic-dashboard/` (the `LIVE_URL` in `facts.js`). There is no build: a push to `main` is a deploy, and `.nojekyll` at the root tells Pages to serve files as they are. Feature work happens on branches (`phase2/dashboard` is the current one); merging to `main` publishes.

Pages serves gzip to browsers that accept it, so the real download is much smaller than the byte counts in `data/`. `tests/e2e/harness.js` can serve gzip the same way so the progress bar is tested against realistic sizes.

## Where the data comes from

The dashboard never computes raw traffic or crash figures. A separate pipeline repository, `norman-traffic-case` (`PRIVATE_REPO` in `facts.js`), reads the city's count sheets, the centerlines, the ward polygons and the crash records, assigns crashes to segments, verifies lane counts, fits growth rates and routes detours, and writes the files in `data/`:

| File | Contents | Read by |
| --- | --- | --- |
| `data/segments.geojson` | 204 counted segments as LineStrings with every stored property (volume, capacity at LOS E and C, lanes, crashes by year, wards, the C.13 forecast fields). | `data.js`, `layers/segments.js`, `scenes.js`, `ui/popup.js` |
| `data/collisions.geojson` | Crash points in the slim C.12 shape: `{ y: year, c: category code, l: loc_id }`. | `layers/collisions.js` |
| `data/wards.geojson` | The eight council ward polygons (`Ward_num`). | `layers/wards.js`, `camera.js` |
| `data/count_points.geojson` | Where each count was taken. | `layers/points.js` |
| `data/summary.json` | The analysis years, the QA block the help overlay quotes, per ward tops. | `data.js`, `ui/help.js` |
| `data/closure_impacts.json` | Per segment: detour segments, added volume, the detour path (C.15). | `data.js`, `layers/closure.js` |
| `data/daytypes.json` | Day type factors and the game day origins and routes (C.16). | `ui/simulate.js`, `layers/gameday.js`, `data.js` |
| `data/horizon.json` | Growth model parameters and backtest (C.16). Loaded, not yet displayed. | `data.js` |

`CONTRACTS.md` is the written agreement between the pipeline and the dashboard: C.12 for the collisions shape, C.13 for the forecast properties, C.15 and C.16 for the three Simulate files. If a field name changes in the pipeline, it changes there first.

Two scripts touch `data/`:

- `node scripts/slim-data.mjs` rewrites `data/collisions.geojson` into the slim shape (short keys, five decimal coordinates, rows outside 2021 to 2025 dropped) and writes `data/collisions.meta.json`. Run it after copying a fresh collisions file from the pipeline. It is idempotent, so running it on an already slim file changes nothing.
- `node scripts/stamp_sample.mjs` writes made up Simulate data in the contract shape. It was used before the pipeline produced the real files and is kept for development. Never run it on the real `data/` folder you intend to publish; it overwrites `segments.geojson` and the three Simulate files and drops a `SAMPLE_DATA.txt` marker.

Rule from `AGENTS.md`: never hand edit a data file.

## How to run the tests

Unit tests run in node with no browser. Each `tests/*.test.js` file builds a fake DOM (`tests/fake_dom.js`) and a recording map double, imports the module under test, and asserts on what was called.

```
npm test                      # runs tests/run_all.js, every test file in its own process
node tests/panel.test.js      # one file
```

The expected last line today is `37 of 37 dashboard test files passed`.

The Playwright drive opens the real page in headless Chromium with the Mapbox CDN script swapped for `tests/e2e/mapbox_stub.js` (a fake `mapboxgl` that records sources, layers and paint calls), serves the repo over HTTP with gzip, and clicks through every control, the hash round trip, all 17 scenes, reduced motion, a keyboard only pass and the mobile sheet at three viewports.

```
node tests/e2e/verify.mjs     # expected last line: 106 of 106 checks passed
```

Playwright is in `package-lock.json` as a dev dependency but not in `package.json`, so on a fresh clone install it explicitly:

```
npm install --save-dev playwright@1.63.0
npx playwright install chromium
```

Other drives in `tests/e2e/`: `real.mjs` loads the real Mapbox library and screenshots every scene at three viewports into `qa/real/` (needs network and the token), `perf.mjs` reads the flow loop cost, `peek.mjs` and `mobile_peek.mjs` take one screenshot each for a quick look.

## The three files to read first

1. `state.js` (about 40 lines). The whole dashboard is one object plus `setState` and `subscribe`. Once you see that every control writes here and one function reads from here, the rest is detail.
2. `data.js`, starting at `deriveProps`. This is where v/c, crashes in the year window, the combined score and the projected scenario numbers come from. Every number on screen traces back to this function or to `facts.js`.
3. `app.js`, starting at `render` and then `main`. `render` is the subscriber: it pushes the derived data into the map layers and the panel on every state change. `main` is the startup order. After those two, `addAllLayers` and `applyScene` show how the map and present mode are built.

Then open any `layers/*.js` or `ui/*.js` file: each begins with a `WHAT THIS FILE DOES` block and has a `## ` note before every exported function.

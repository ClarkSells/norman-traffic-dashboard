# Site Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Norman street segment dashboard into a four surface site (map, film, methods, data) that reads as a professional operations product, shows the Python analytics with figures the pipeline drew, and carries the scope audit's fixes.

**Architecture:** Two repos. The pipeline (`norman-traffic-case`, Python, `python run.py`) gains new GIS downloads, a programmed projects flag, context flags, a methods figure module (matplotlib to SVG) and a facts JSON; the dashboard (`norman-traffic-dashboard`, static ES modules, Mapbox GL JS 3.6 from the CDN, GitHub Pages) gains a shared top bar, two document pages, an inspector drawer, Explore and Simulate tabs, new map layers, a film opener and the fixes from `docs/audit/2026-11-05-ui-audit.md`. The spec is `docs/superpowers/specs/2026-11-05-site-redesign-design.md`; read it first, it holds the tokens, the layer table and the fourteen methods sections.

**Tech Stack:** Pipeline: Python 3.11+, pandas 3, shapely 2, networkx 3, matplotlib 3.11, openpyxl, pytest. Dashboard: Mapbox GL JS v3.6.0 (CDN), three.js 0.160 (CDN, site view only), node 22 tests with `tests/fake_dom.js`, Playwright drives in `tests/e2e/`. No bundler, no framework, no new npm dependencies.

## Global Constraints

- Dashboard: ES modules, no build step, no new npm dependencies, Mapbox GL JS `v3.6.0` from `https://api.mapbox.com/mapbox-gl-js/v3.6.0/`. Windows is the target machine: forward slashes, UTF-8.
- Every gate stays green at every commit: dashboard `npm test` (all files pass) and `node tests/e2e/verify.mjs` (ends `N of N checks passed`, console errors `[]`); pipeline `python -m pytest -q` (72 passed plus new tests) and `python run.py --skip-figures` ends `validate_outputs: PASS`.
- Colors and type come from `tokens.css` only. Light ramp `#f59e5c #ee7b2f #d45f14 #a4480e #6d2f09` and blue ramp `#86b6ef #5598e7 #2a78d6 #1c5cab #0d366b` never change on light. Brand `#841617` only on the eyebrow rule, the primary button, the film title rule and methods numerals.
- Radii: 2 (chips, switch, knob, thumb), 4 (buttons, segmented, inputs), 8 (popup, legend, help, figure frame), 12 (film card, phone sheet). Nothing else.
- Copy: sentence case except eyebrows; commas and periods, no dashes anywhere in UI text or comments; "crashes" in the UI; a unit on every figure; no developer words on screen (endpoint, pipeline, stub, sample, site.json, capture.cmd).
- Every headline number comes from `data/facts.json` (pipeline output) or a `data.js` function. Nothing is typed in.
- Data files in the dashboard (`data/*.geojson`, `data/*.json`, `sites/`, `media/`, `figures/`) are pipeline output; never hand edit them. `scripts/slim-data.mjs` is the only dashboard script that rewrites one.
- Tests use `tests/fake_dom.js` and recording map doubles; never require a browser in a unit test. Each new module gets a `tests/<name>.test.js` that `tests/run_all.js` picks up automatically.
- Commit after every task with the message given. Never `git add -A` in the pipeline repo (gitignored media and captures live beside tracked files); add explicit paths.
- Comments in new code follow the house style: a `// ## WHAT THIS FILE DOES` header (dashboard) or `## WHAT THIS FILE DOES` (pipeline) and `## ` section comments.

---

## File structure

Dashboard (`norman-traffic-dashboard`), new or changed:

| Path | Responsibility |
|---|---|
| `tokens.css` | adds `--brand`, `--programmed`, `--accent-soft`, ramp tokens, radius tokens, dark ramp |
| `style.css` | table fixed layout, score rule, chip row, tabs, inspector, sitenav |
| `site.css` (new) | the two document pages: article measure, contents rail, figure frames, tables |
| `ui/sitenav.js` (new) | top bar for all three pages |
| `ui/tabs.js` (new) | Explore and Simulate tab controller |
| `ui/chips.js` (new) | scenario chip row |
| `ui/inspector.js` (new) | right drawer with media, forecast, programmed, flags, crashes by year, caveats |
| `ui/popup.js` | short popup, Details button |
| `ui/legend.js` | metric only title, scenario chip, dark note |
| `ui/callouts_html.js` (new) | HTML marker callouts with leaders and a collision pass |
| `layers/projects.js` (new) | programmed projects lines |
| `layers/context.js` (new) | flood, schools, OU property |
| `layers/buildings.js` (new) | fill-extrusion from `data/buildings.geojson` |
| `layers/collisions.js` | heat default off, retuned |
| `layers/segments.js` | dark ramp and halo, world ring mask |
| `layers/closure.js` | hatch pattern, arrows, callouts |
| `layers/opener.js` (new) | the film's line gradient route reveal |
| `camera.js` | establish on segment bounds |
| `scenes.js` | opener scene, captions, stats caps |
| `facts.js` | thin accessor over `data/facts.json` |
| `data.js` | min rank ties, facts loading, projects and context in `getRaw()` |
| `methods.html` (new), `methods.js` (new), `ui/charts.js` (new) | the methods page and its four interactive figures |
| `data.html` (new), `datapage.js` (new) | sources, downloads, assumptions, adherence |
| `figures/methods/*.svg` | pipeline output, copied |
| `tests/*.test.js` | one per new module |

Pipeline (`norman-traffic-case`), new or changed:

| Path | Responsibility |
|---|---|
| `config.py` | six new `GIS_SERVICES`, `PROGRAMMED_BUFFER_M`, `SCHOOL_RADIUS_M`, `FIGURES_METHODS_DIR` |
| `src/gis_download.py` | downloads the new services |
| `src/enrich/__init__.py`, `src/enrich/programmed.py` (new) | `add_programmed` |
| `src/enrich/flags.py` (new) | `add_context_flags` |
| `src/outputs/geojson_out.py` | `write_projects_geojson`, `write_context_geojson`, `write_buildings_geojson` |
| `src/outputs/facts_out.py` (new) | `write_facts_json` |
| `src/outputs/figures_methods.py` (new) | fourteen SVG figures |
| `src/outputs/workbook.py` | README sheet lists every sheet |
| `scripts/validate_outputs.py` | asserts 20 sheets and the fourteen SVGs |
| `run.py` | calls the above; sensitivity keeps NaN rows |
| `CONTRACTS.md` | new columns and files |
| `tests/test_programmed.py`, `tests/test_flags.py`, `tests/test_figures_methods.py`, `tests/test_facts_out.py` (new) | |

---

# Wave A: the P0 fixes and the audit fixes

### Task A1: Ranked table layout (UI audit A1, C5, C6)

**Files:**
- Modify: `style.css` (the `/* Ranked table */` block, lines 163 to 185)
- Modify: `ui/panel.js:266-269` (row html)
- Modify: `scripts/slim-data.mjs` (title case pass on `on_road`, `from_road`, `to_road` in `data/segments.geojson`)
- Test: `tests/panel.test.js`, `tests/slim_data.test.js`

**Interfaces:**
- Consumes: `rankedRows(state)` rows with `rank, on_road, from_road, to_road, v_c_active, collisions_active, metric_value, shared_boundary, functional_class`.
- Produces: `rowHtml(r, share, scoreText, scoreClass)` and `classFor(value, metric)` exported from `ui/panel.js`; row html with `td.score` holding `<span class="fig">` and `<i class="rule" data-class="N">` where N is the ramp class 0 to 4 from `BREAKS[metric]`.

- [ ] **Step 1: Write the failing test**

Append to `tests/panel.test.js`:

```js
// Score rule: a 3 px rule under the figure in the ramp class color, no absolutely positioned bar.
{
  const { rowHtml, classFor } = await import("../ui/panel.js");
  const html = rowHtml({ rank: 1, on_road: "W Robinson St", from_road: "N Flood Ave", to_road: "Stubbeman Ave", v_c_active: 0.87, collisions_active: 120, metric_value: 120.87, shared_boundary: true, functional_class: "Principal Arterial" }, 0.9, "120.87", 4);
  assert.ok(html.includes('<i class="rule" data-class="4"'), "rule carries the ramp class");
  assert.ok(!html.includes('class="bar"'), "the old bar is gone");
  assert.ok(html.includes('<td class="seg">'), "segment cell has the fixed layout class");
  assert.equal(classFor(0, "combined"), 0);
  assert.equal(classFor(1e9, "combined"), 4);
  console.log("score rule checks passed");
}
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node tests/panel.test.js`
Expected: FAIL, `rowHtml` is not exported.

- [ ] **Step 3: Export `rowHtml` and change the row**

In `ui/panel.js`, the row template starts at line 266 (`return \`<td class="num rank">...`). Extract it into an exported function and add `classFor`:

```js
import { BREAKS } from "../config.js";

// ## classFor: ramp class 0 to 4 for a metric value, the same breaks the map paint uses
export function classFor(value, metric) {
  const b = BREAKS[metric] || BREAKS.combined;
  let c = 0; for (const x of b) if (value >= x) c++;
  return Math.min(4, c);
}

// ## rowHtml: one ranked row
// rank, segment (name, chips, span on one line each), v/c, crashes, score with a 3 px rule in the ramp class
// color so the table doubles as the map key. scoreClass is 0 to 4 from classFor.
export function rowHtml(r, share, scoreText, scoreClass) {
  return `<td class="num rank">${r.rank}</td>
      <td class="seg"><div class="road"><span class="name">${r.on_road}</span>${r.shared_boundary ? '<span class="tag">boundary</span>' : ""}${ARTERIAL.has(r.functional_class) ? "" : '<span class="tag">collector</span>'}</div><div class="span">${r.from_road} to ${r.to_road}</div></td>
      <td class="num">${r.closed ? '<span class="chip closed">closed</span>' : num(r.v_c_active)}</td><td class="num">${int(r.collisions_active)}</td>
      <td class="num score"><span class="fig">${scoreText}</span><i class="rule" data-class="${scoreClass}" style="width:${Math.max(8, share * 100).toFixed(1)}%" aria-hidden="true"></i></td>`;
}
```

Call it where the old template was: `rowHtml(r, share, scoreText, classFor(r.metric_value, state.metric))`. `r.closed` is set by `rankedRows` when `state.closing === r.loc_id` (add that one line in `data.js rankedRows`).

Replace the `/* Ranked table */` CSS block in `style.css` with:

```css
/* Ranked table: fixed layout so long names ellipsize instead of widening the table (UI audit A1) */
.table-wrap { overflow: auto; flex: 1 1 auto; min-height: 0; position: relative; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 13px; }
col.c-rank { width: 40px; } col.c-vc { width: 52px; } col.c-crash { width: 64px; } col.c-score { width: 76px; }
th { position: sticky; top: 0; background: var(--surface); text-align: left; font: 600 11px/1 var(--font-sans); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); padding: 10px 10px; border-bottom: 1px solid var(--hairline); z-index: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
th:first-child, td:first-child { padding-left: 20px; }
th:last-child, td:last-child { padding-right: 20px; }
td { padding: 7px 10px; border-bottom: 1px solid var(--hairline); vertical-align: top; height: 48px; box-sizing: border-box; }
td.seg { max-width: 0; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
td.rank { color: var(--ink-muted); }
tbody tr { cursor: pointer; background: transparent; transition: background var(--t-fast) var(--ease-out), opacity var(--t-mid) var(--ease-out); }
tbody tr.entering { animation: rowIn var(--t-mid) var(--ease-out) both; }
tbody tr.leaving { opacity: 0; pointer-events: none; }
@keyframes rowIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
tbody tr:hover, tbody tr.hover { background: var(--row-hover); }
tbody tr.selected { background: var(--row-selected); box-shadow: inset 3px 0 0 var(--accent); }
td .road { display: flex; align-items: baseline; gap: 6px; font-family: var(--font-num); font-weight: 600; font-size: 13px; line-height: 1.25; min-width: 0; }
td .road .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
td .span { color: var(--ink-muted); font-size: 11.5px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
td .tag { display: inline-block; flex: none; font-family: var(--font-text); font-size: 10px; font-weight: 500; color: var(--ink-muted); border: 1px solid var(--hairline); border-radius: 2px; padding: 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
td.score .fig { display: block; }
td.score .rule { display: block; height: 3px; margin: 3px 0 0 auto; background: var(--ramp-3); transition: width var(--t-mid) var(--ease-out); }
td.score .rule[data-class="0"] { background: var(--ramp-0); } td.score .rule[data-class="1"] { background: var(--ramp-1); } td.score .rule[data-class="2"] { background: var(--ramp-2); } td.score .rule[data-class="3"] { background: var(--ramp-3); } td.score .rule[data-class="4"] { background: var(--ramp-4); }
.chip.closed { font: 500 11px var(--font-mono); border: 1px solid var(--ink); border-radius: 2px; padding: 0 4px; }
```

Add to `tokens.css` `:root`: `--ramp-0: #f59e5c; --ramp-1: #ee7b2f; --ramp-2: #d45f14; --ramp-3: #a4480e; --ramp-4: #6d2f09;`.

In `index.html`, after `<table id="rank-table">` insert `<colgroup><col class="c-rank"><col class="c-seg"><col class="c-vc"><col class="c-crash"><col class="c-score"></colgroup>`.

- [ ] **Step 4: Title case in the slim script**

In `scripts/slim-data.mjs` add an exported helper and a pass over `data/segments.geojson` that rewrites only the three name fields:

```js
// ## titleCaseRoad: "24TH AVE NW" becomes "24th Ave NW"; direction suffixes and highway codes stay upper case
export function titleCaseRoad(s) {
  if (!s) return s;
  const KEEP = new Set(["NW", "NE", "SW", "SE", "N", "S", "E", "W", "I-35", "SH", "US"]);
  return String(s).trim().split(/\s+/).map(w => {
    const up = w.toUpperCase();
    if (KEEP.has(up)) return up;
    if (/^\d+(ST|ND|RD|TH)$/.test(up)) return up.replace(/(ST|ND|RD|TH)$/, m => m.toLowerCase());
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}
```

In the script's main path (after the collisions slimming): read `data/segments.geojson`, set `on_road`, `from_road`, `to_road` on every feature through `titleCaseRoad`, write back with `JSON.stringify(fc)` (no indent, like the pipeline). Add to `tests/slim_data.test.js`: `assert.equal(titleCaseRoad("24TH AVE NW"), "24th Ave NW"); assert.equal(titleCaseRoad("w robinson st"), "W Robinson St"); assert.equal(titleCaseRoad("I-35 NB Ramp"), "I-35 Nb Ramp".replace("Nb", "NB"));` (add `NB`, `SB`, `EB`, `WB` to `KEEP` so the last one holds).

- [ ] **Step 5: Run the gates**

Run: `node scripts/slim-data.mjs && npm test && node tests/e2e/verify.mjs`
Expected: all unit files pass, drive ends `checks passed`. Add to the desktop pass of `tests/e2e/verify.mjs`: `check("table fits the panel", (await page.evaluate(() => document.querySelector("#rank-table").getBoundingClientRect().width)) <= 400);`.

- [ ] **Step 6: Commit**

```bash
git add style.css tokens.css index.html ui/panel.js data.js scripts/slim-data.mjs data/segments.geojson tests/panel.test.js tests/slim_data.test.js tests/e2e/verify.mjs
git commit -m "table: fixed layout, score rule in the ramp class color, title cased road names (UI audit A1, C5, C6)"
```

### Task A2: Short popup plus inspector drawer (UI audit A2, C15)

**Files:**
- Create: `ui/inspector.js`
- Modify: `ui/popup.js` (`popupHtml`, `attachPopup`, new `mediaIndexNow`), `app.js` (wire the inspector), `index.html` (an `<aside id="inspector" hidden>` after `#map`), `style.css`
- Test: `tests/inspector.test.js`, `tests/popup_legend.test.js`

**Interfaces:**
- Produces: `initInspector({ el, segmentProps, mediaFor, getState, onClose }) -> { open(locId), close(), isOpen(), current(), refresh() }` and pure `inspectorHtml(p, { media, state }) -> string`, `forecastSection(p)`, `programmedSection(p)`, `flagsSection(p)`, `crashesSection(p, state)`.
- `popupHtml(p, ranks, state, sites)` keeps its signature; forecast, media and caveats move out; it gains `<button type="button" class="btn small" data-details="${p.loc_id}">Details</button>`.
- `attachPopup(map, onSelect, enabled, opts)` gains `opts.onDetails(locId)`. `ui/popup.js` exports `mediaIndexNow()` returning the loaded media index or null.

- [ ] **Step 1: Write the failing tests**

`tests/inspector.test.js`:

```js
// Run from the repo root: node tests/inspector.test.js
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
const { inspectorHtml, initInspector } = await import("../ui/inspector.js");

const p = { loc_id: "52500-158", on_road: "W Main St", from_road: "26th Dr W", to_road: "24th Ave W", wards: [2], vpd_max: 31886, volume_year: 2022, lanes_final: 6, capacity_E: 58000, v_c_active: 0.55, collisions_active: 168,
  collisions_by_year: { 2021: 30, 2022: 35, 2023: 33, 2024: 36, 2025: 34 },
  growth_base: 0.0129, growth_lo: 0, growth_hi: 0.03, growth_method: "pooled_ward", growth_n_obs: 2, growth_shrink_w: 0.615, vc_2035_base: 0.63, vc_2035_lo: 0.55, vc_2035_hi: 0.74, year_vc_09_base: null, upgrade_tier: "at top tier",
  programmed: true, programmed_name: "Main St Resurfacing", programmed_type: "RD_", programmed_year: 2026, programmed_status: "Planned", programmed_source: "City of Norman Projects", flood_zone: null, school_400m: 1, speed_flag: false,
  geometry_lon: -97.4767, geometry_lat: 35.2184 };
const html = inspectorHtml(p, { media: { aerial: true, streetview: [{ file: "sv_091.jpg", heading: 91, date: "2021-02" }] }, state: { los: "E", yearMin: 2021, yearMax: 2025 } });
assert.ok(html.includes("media/52500-158/aerial.jpg") && html.includes("looking E, 2021-02"), "media section with captions");
assert.ok(html.includes("Main St Resurfacing") && html.includes("2026"), "programmed section");
assert.ok(html.includes("1 school within 400 m"), "flags section");
assert.equal((html.match(/class="yr"/g) || []).length, 5, "five crash year bars");
assert.ok(!html.includes("flood zone"), "null flags are not rendered");
assert.ok(html.includes("Open in Google Maps"), "google link last");
assert.ok(html.indexOf("Forecast") < html.indexOf("Programmed project"), "sections in spec order");

const root = el("inspector");
const ins = initInspector({ el: root, segmentProps: () => p, mediaFor: () => null, onClose: () => {} });
assert.equal(ins.open("52500-158"), true);
assert.equal(root.hidden, false); assert.ok(ins.isOpen());
ins.close(); assert.equal(root.hidden, true); assert.ok(!ins.isOpen());
console.log("inspector checks passed");
```

Append to `tests/popup_legend.test.js` (reuse its `p` and `state`): `assert.ok(popupHtml({ ...p, loc_id: "52500-158" }, null, state).includes('data-details="52500-158"'), "popup has a Details button"); assert.ok(!popupHtml(p, null, state).includes("Forecast"), "forecast moved to the inspector");`

- [ ] **Step 2: Run them to make sure they fail**

Run: `node tests/inspector.test.js; node tests/popup_legend.test.js`
Expected: FAIL (module missing; then the Details assertion).

- [ ] **Step 3: Write `ui/inspector.js`**

```js
// ## WHAT THIS FILE DOES
// The inspector: a 400 px drawer on the right of the map (the full sheet on phones) with everything about one
// segment that does not fit a popup: media, forecast, programmed project, flags, crashes by year, caveats.
// Pure html builders plus a small controller. Imports caveats.js and ui/popup.js (growthText, mediaHtml).
// Called from app.js when the popup's Details button is pressed.
import { caveatsFor } from "../caveats.js";
import { growthText, mediaHtml } from "./popup.js";

const num = (v, d = 2) => (v == null ? "n/a" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }));
const int = (v) => (v == null ? "n/a" : Math.round(Number(v)).toLocaleString("en-US"));
const row = (k, v) => (v == null || v === "" ? "" : `<div class="irow"><span class="k">${k}</span><span class="v">${v}</span></div>`);

// ## forecastSection: growth line, 2035 v/c with its range, year to 0.9, upgrade. Empty without a base rate.
export function forecastSection(p) {
  if (p.growth_base == null) return "";
  const y09 = p.year_vc_09_base == null ? "not by 2050" : (p.year_vc_09_base <= 2025 ? "already" : String(p.year_vc_09_base));
  const range = p.vc_2035_lo != null && p.vc_2035_hi != null ? `, ${num(p.vc_2035_lo)} to ${num(p.vc_2035_hi)} across the bands` : "";
  const up = p.upgrade_tier === "at top tier" ? "already at the top tier of the ACOG table"
    : (p.upgrade_tier ? `${p.upgrade_tier}${p.vc_after_upgrade != null ? `, v/c ${num(p.vc_after_upgrade)} after` : ""}${p.headroom_yrs != null ? `, ${int(p.headroom_yrs)} years of headroom` : ""}` : null);
  return `<section class="isec"><h5>Forecast</h5>${row("growth", growthText(p))}${row("v/c in 2035", p.vc_2035_base != null ? `${num(p.vc_2035_base)} base${range}` : null)}${row("reaches v/c 0.9", y09)}${row("upgrade", up)}</section>`;
}

// ## programmedSection: the city project that covers the segment, when one does
export function programmedSection(p) {
  if (!p.programmed) return "";
  return `<section class="isec"><h5>Programmed project</h5>${row("project", p.programmed_name)}${row("work", p.programmed_type)}${row("year", p.programmed_year)}${row("status", p.programmed_status)}${row("source", p.programmed_source)}</section>`;
}

// ## flagsSection: flood zone, schools within 400 m, speed flag. Only rows with a value.
export function flagsSection(p) {
  const rows = [row("flood zone", p.flood_zone),
    row("schools", p.school_400m ? `${p.school_400m} school${p.school_400m === 1 ? "" : "s"} within 400 m` : null),
    row("speed", p.speed_flag ? `measured ${int(p.speed_measured)} mph against posted ${int(p.cl_speed)} mph` : null)].join("");
  return rows ? `<section class="isec"><h5>Context</h5>${rows}</section>` : "";
}

// ## crashesSection: five mono bars, one per window year, scaled to the largest year
export function crashesSection(p, state) {
  const by = p.collisions_by_year || {};
  const years = []; for (let y = state.yearMin; y <= state.yearMax; y++) years.push(y);
  const max = Math.max(1, ...years.map(y => Number(by[y] || 0)));
  const bars = years.map(y => `<div class="yr"><i style="height:${Math.round(100 * Number(by[y] || 0) / max)}%"></i><b>${Number(by[y] || 0)}</b><span>${y}</span></div>`).join("");
  return `<section class="isec"><h5>Crashes by year</h5><div class="yrbars">${bars}</div></section>`;
}

// ## inspectorHtml: the whole drawer body for one segment, sections in the spec's order
export function inspectorHtml(p, { media, state }) {
  const st = state || { los: "E", yearMin: 2021, yearMax: 2025 };
  const caveats = caveatsFor(p.loc_id).map(t => `<p class="caveat">${t}</p>`).join("");
  const link = p.geometry_lat && p.geometry_lon ? `<a class="quiet" href="https://www.google.com/maps/@${p.geometry_lat},${p.geometry_lon},120m/data=!3m1!1e3" target="_blank" rel="noopener">Open in Google Maps</a>` : "";
  return `<header class="ihead"><div class="eyebrow">Segment · Ward ${(p.wards || []).join(", ")}</div><h3>${p.on_road}</h3><div class="span">${p.from_road} to ${p.to_road} · ${p.loc_id}</div></header>
    ${media ? `<section class="isec">${mediaHtml(p.loc_id, { [p.loc_id]: media })}</section>` : ""}
    ${forecastSection(p)}${programmedSection(p)}${flagsSection(p)}${crashesSection(p, st)}
    ${caveats ? `<section class="isec"><h5>Notes</h5>${caveats}</section>` : ""}
    <footer class="ifoot">${link}</footer>`;
}

// ## initInspector: open and close the drawer; the body is rebuilt on every open from the current state
export function initInspector({ el, segmentProps, mediaFor, getState = () => ({ los: "E", yearMin: 2021, yearMax: 2025 }), onClose = () => {} }) {
  let current = null;
  const close = () => { if (current == null && el.hidden) return; current = null; el.hidden = true; el.classList.remove("open"); onClose(); };
  const open = (locId) => {
    const p = segmentProps(locId);
    if (!p) return false;
    current = locId;
    el.innerHTML = `<button class="btn small iclose" type="button" aria-label="Close details">Close</button>` + inspectorHtml(p, { media: mediaFor(locId), state: getState() });
    el.hidden = false; el.classList.add("open");
    const btn = typeof el.querySelector === "function" ? el.querySelector(".iclose") : null;
    if (btn) btn.addEventListener("click", close);
    return true;
  };
  return { open, close, isOpen: () => current != null, current: () => current, refresh: () => { if (current) open(current); } };
}
```

`mediaHtml` in `ui/popup.js` renders captions as `street view looking N, 2021-02` already; keep that text (the test checks `looking E, 2021-02`). Remove from `popupHtml` the `${mediaHtml(p.loc_id)}`, `${forecastHtml(p)}` and `${caveats}` pieces and add, before `${aerial}`: `<div class="links actions"><button type="button" class="btn small" data-details="${p.loc_id}">Details</button>${sitesHtml(sites)}</div>`. Keep `forecastHtml` exported (the test for it stays). Add `export function mediaIndexNow() { return mediaIndex; }`. In `attachPopup`'s `open`, after the `[data-site]` binding: `for (const b of root.querySelectorAll("[data-details]")) b.addEventListener("click", () => onDetails(b.dataset.details || b.getAttribute("data-details")));` with `const onDetails = typeof opts.onDetails === "function" ? opts.onDetails : () => {};`.

`index.html`: after `<div id="map"></div>` add `<aside class="inspector" id="inspector" hidden aria-label="Segment details"></aside>`.

`style.css` (append):

```css
/* Inspector: a 400 px drawer over the right edge of the map; a bottom sheet on phones (UI audit A2) */
.inspector { position: absolute; top: 0; right: 0; bottom: 0; width: 400px; max-width: 100%; background: var(--surface-raised); border-left: 1px solid var(--hairline); overflow: auto; z-index: 4; padding: 16px 20px 24px; box-sizing: border-box; transform: translateX(12px); opacity: 0; transition: transform var(--t-mid) var(--ease-out), opacity var(--t-mid) var(--ease-out); }
.inspector.open { transform: none; opacity: 1; }
.inspector[hidden] { display: none; }
.inspector .iclose { position: absolute; top: 14px; right: 20px; }
.inspector .ihead h3 { font: 500 24px/28px var(--font-serif); margin: 4px 0 0; }
.inspector .ihead .span { color: var(--ink-muted); font-size: 12.5px; margin-top: 2px; }
.inspector .isec { border-top: 1px solid var(--hairline); padding: 12px 0; }
.inspector .isec h5 { font: 600 11px/1 var(--font-sans); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); margin: 0 0 8px; }
.inspector .irow { display: grid; grid-template-columns: 112px 1fr; gap: 8px; font-size: 13px; line-height: 19.5px; padding: 3px 0; }
.inspector .irow .k { color: var(--ink-muted); } .inspector .irow .v { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
.inspector .yrbars { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; height: 96px; align-items: end; }
.inspector .yr { display: grid; grid-template-rows: 1fr auto auto; height: 100%; text-align: center; font: 500 11px var(--font-mono); }
.inspector .yr i { display: block; align-self: end; background: var(--ramp-2); min-height: 2px; }
.inspector .yr span { color: var(--ink-muted); }
.inspector .ifoot { padding-top: 12px; font-size: 11.5px; }
.popup .links.actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
@media (max-width: 767px) { .inspector { width: 100%; top: auto; height: 70vh; border-left: 0; border-top: 1px solid var(--hairline); border-radius: 12px 12px 0 0; } }
```

`app.js`: `import { initInspector } from "./ui/inspector.js";` and `import { attachPopup, loadMediaIndex, mediaIndexNow, popupFor } from "./ui/popup.js";`. After `attachPopup(...)`:

```js
  // ## inspector: the Details drawer, rebuilt from the current state on every open
  const inspector = initInspector({
    el: document.getElementById("inspector"),
    segmentProps: (id) => { const b = popupFor(id); return b ? { ...b.feature.properties, ...deriveProps(b.feature.properties, getState()), geometry_lon: b.lngLat[0], geometry_lat: b.lngLat[1] } : null; },
    mediaFor: (id) => ((mediaIndexNow() || {})[id] || null),
    getState,
  });
```

and pass `onDetails: (id) => { if (popup) popup.remove(); inspector.open(id); }` in the `attachPopup` opts. In `render`, when `patch` has `selectedLocId: null` or when `presenting` turns true, call `inspector.close()`; when `los`, `yearMin`, `yearMax` or any scenario key changes and the inspector is open, call `inspector.refresh()`.

- [ ] **Step 4: Run the tests and the drive**

Run: `npm test && node tests/e2e/verify.mjs`
Expected: PASS. Add to `verify.mjs` after the popup check: `await page.click("[data-details]"); await settle(page); check("inspector opens inside the stage", await page.evaluate(() => { const r = document.getElementById("inspector").getBoundingClientRect(); return !document.getElementById("inspector").hidden && r.right <= innerWidth + 1; }));`.

- [ ] **Step 5: Commit**

```bash
git add ui/inspector.js ui/popup.js app.js index.html style.css tests/inspector.test.js tests/popup_legend.test.js tests/e2e/verify.mjs
git commit -m "inspector: short popup with Details, right drawer with media, forecast, programmed, flags, crashes by year (UI audit A2)"
```

### Task A3: Crash density default off and retuned (UI audit A3)

**Files:**
- Modify: `state.js:17` (`heat: false`), `layers/collisions.js` (the heat constants), `index.html` (the heat switch unchecked)
- Test: `tests/layers.test.js`, `tests/shell.test.js`

- [ ] **Step 1: Failing test**

In `tests/layers.test.js` change the heat assertions to expect `HEAT_OPACITY === 0.28`, a `heatmap-radius` expression whose stops are `10, 18, 14, 40`, a `heatmap-intensity` with stops `10, 0.15, 14, 0.5`, and the first non transparent `heatmap-color` stop at density `0.45`. In the test that asserts the initial state (`tests/shell.test.js` or `tests/app.test.js`, whichever reads `getState().heat`) expect `false`.

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Change the constants** (keep the file's variable names):

```js
export const HEAT_OPACITY = 0.28;
export const HEAT_RADIUS = ["interpolate", ["linear"], ["zoom"], 10, 18, 14, 40];
export const HEAT_INTENSITY = ["interpolate", ["linear"], ["zoom"], 10, 0.15, 14, 0.5];
export const HEAT_COLOR = ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(134,182,239,0)", 0.45, "rgba(134,182,239,0.35)", 0.7, "rgba(42,120,214,0.55)", 1, "rgba(13,54,107,0.8)"];
```

`state.js`: `heat: false,` with the comment "crash density surface (explore default off, UI audit A3; scenes own it in present)". `index.html`: remove `checked` from `#heat-toggle`, set `aria-checked="false"`.

- [ ] **Step 4: Run the gates, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add state.js layers/collisions.js index.html tests/layers.test.js tests/shell.test.js tests/app.test.js
git commit -m "crash density: off by default in explore, retuned to read as a surface (UI audit A3)"
```

### Task A4: Site view copy (UI audit A4)

**Files:** `ui/siteview.js:127,136,167`, `tests/siteview.test.js`

- [ ] **Step 1: Failing test.** In `tests/siteview.test.js` replace the fallback assertion with `assert.ok(note.includes("No 3D capture for this site yet. Showing the aerial camera."), "fallback copy");` and add `assert.ok(!note.includes("capture.cmd") && !note.includes("Aleph"), "no developer words");` where `note` is the `.siteview-note` text already read there.
- [ ] **Step 2: Run `node tests/siteview.test.js`, expect FAIL.**
- [ ] **Step 3: Replace the three strings:** mesh note `3D capture of the intersection. Drag to orbit, scroll to zoom.`; fallback `No 3D capture for this site yet. Showing the aerial camera.`; load error `The 3D capture did not load. Showing the aerial camera.`.
- [ ] **Step 4: Run `npm test`, expect PASS.**
- [ ] **Step 5: Commit:** `git add ui/siteview.js tests/siteview.test.js && git commit -m "site view: user copy, provenance moves to the data page (UI audit A4)"`.

### Task A5: Tile error watcher (UI audit A5)

**Files:** `app.js:186`, `ui/loading.js`, `tests/loading.test.js`

- [ ] **Step 1: Failing test.** Append to `tests/loading.test.js`:

```js
{
  const { tileErrorMessage } = await import("../ui/loading.js");
  assert.equal(tileErrorMessage({ status: 403, url: "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/11/1/2.vector.pbf" }), "The map tiles were refused for this address. Open the published page, or add this address to the map token's allowed URLs.");
  assert.equal(tileErrorMessage({ status: 500, url: "https://api.mapbox.com/v4/x" }), null);
  assert.equal(tileErrorMessage(null), null);
  console.log("tile error checks passed");
}
```

- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** in `ui/loading.js`:

```js
// ## tileErrorMessage: a plain sentence for a 403 on a tile or style request (URL restricted token off its
// origin), null for anything else so ordinary errors keep their own handling
export function tileErrorMessage(err) {
  if (!err || err.status !== 403 || !/\/v4\/|\/styles\/v1\//.test(String(err.url || ""))) return null;
  return "The map tiles were refused for this address. Open the published page, or add this address to the map token's allowed URLs.";
}
```

In `app.js` replace the `map.on("error", ...)` line with:

```js
let tileErrorShown = false;
map.on("error", (e) => {
  const err = e && e.error;
  const refused = tileErrorMessage(err);
  if (refused && !tileErrorShown) { tileErrorShown = true; showLoadError(new Error(refused)); return; }
  if (!styleReady) showLoadError(err || new Error("the map style did not load"));
});
```

and import `tileErrorMessage` from `./ui/loading.js`. Check `showLoadError` prints `err.message` in the card body (it does for the style error; keep the same path).

- [ ] **Step 4: Run the gates, PASS.** Outside the code, Clark adds `http://localhost:*`, `http://127.0.0.1:*` and `https://clarksells.github.io/*` to the token's allowed URLs in the Mapbox account.
- [ ] **Step 5: Commit:** `git add app.js ui/loading.js tests/loading.test.js && git commit -m "loading: plain error card when tiles are refused (UI audit A5)"`.

### Task A6: Audit wording and counts (scope audit G2, G3, G8, G14)

**Files:** `data.js:293-301` (`rankedRows`), `facts.js`, `ui/help.js:24`, `scenes.js:93,107-108,177`, `ui/panel.js` (stats line), `tests/data.test.js`, `tests/scenes.test.js`, `tests/help.test.js`, `tests/panel.test.js`

- [ ] **Step 1: Failing tests.** `tests/data.test.js`: build a mini raw with three primary features whose `combined` values are `10, 10, 5`, `setRaw`, call `rankedRows({ ward: null, metric: "combined", los: "E", yearMin: 2021, yearMax: 2025, includeCollectors: false })` and `assert.deepEqual(rows.map(r => r.rank), [1, 1, 3])`. `tests/help.test.js`: `assert.ok(!html.includes("verified by a person") && html.includes("by the project team against aerial imagery"))`. `tests/scenes.test.js`: the `heat` scene caption includes `n(FACTS.in_window_rows)` and not `n(FACTS.collision_rows)`; the `citywide` scene caption includes "204 counted segments, 177 arterials"; the `lanes` scene caption includes "project team". `tests/panel.test.js`: the stats line for the default state includes "arterial segments".
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement.** `data.js rankedRows`: replace `rows.forEach((r, i) => { r.rank = i + 1; });` with

```js
  // ## min rank on ties, the rule the workbook uses (scope audit G3): equal metric values share the lowest rank
  let lastValue = null, lastRank = 0;
  rows.forEach((r, i) => {
    if (lastValue != null && r.metric_value === lastValue) r.rank = lastRank;
    else { r.rank = i + 1; lastRank = r.rank; }
    lastValue = r.metric_value;
    r.closed = state.closing != null && state.closing === r.loc_id;
  });
```

`facts.js` `FACTS` gains `in_window_rows: 11345, arterial_segments: 177` (Task C6 later sources both from `facts.json`). `ui/help.js:24`: "All ${verified} lane counts were verified against aerial imagery by the project team." `scenes.js:177`: the same sentence. `scenes.js:108`: `Five years of crash records as a density surface: ${n(FACTS.in_window_rows)} records from ${FACTS.year_min} to ${FACTS.year_max}, ${n(FACTS.assigned_in_window)} of them assigned to a counted segment.` `scenes.js:93`: `${n(FACTS.segments)} counted segments, ${n(FACTS.arterial_segments)} arterials in the ward lists, ${n(FACTS.collision_rows)} crash records, ${n(FACTS.assigned_in_window)} assigned ${FACTS.year_min} to ${FACTS.year_max}.` `ui/panel.js` stats line: `${rows.length} ${state.includeCollectors ? "segments" : "arterial segments"} · ...`.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add data.js facts.js ui/help.js scenes.js ui/panel.js tests/data.test.js tests/scenes.test.js tests/help.test.js tests/panel.test.js && git commit -m "audit fixes: min rank on ties, in window crash count, lane verification wording, 204 vs 177 (scope audit G2 G3 G8 G14)"`.

### Task A7: Contracts and the code prefix (scope audit G13, UI audit C1)

**Files:** `CONTRACTS.md` (C.13, C.16), `style.css:69,290`, `tests/shell.test.js`

- [ ] **Step 1: Failing test.** `tests/shell.test.js`: `assert.ok(!readFileSync("style.css", "utf8").includes('content: "// "'), "no code prefix on the eyebrow"); assert.ok(readFileSync("CONTRACTS.md", "utf8").includes("pooled_ward"), "contracts describe the pooled model");`
- [ ] **Step 2: Run, FAIL.**
- [ ] **Step 3: Implement.** Delete `.eyebrow::before { content: "// "; color: var(--accent); }` and the `// ` in the error card title string. In `CONTRACTS.md` C.13 replace the growth method sentence with: `growth_method: "pooled_ward" for every segment. base = the ward's pooled rate over all consecutive count pairs, shrunk toward the citywide rate with weight n_pairs / (n_pairs + 20); lo = 0 (or base when base is lower); hi = the ward's post 2020 pooled rate (or base when higher); all clipped to [-0.01, 0.05]. growth_raw and growth_raw_method ("loglin" | "pairwise" | "none") carry the station's own trend for display only.` In C.16 set `horizon.json.params` to `{ k: 20, clip: [-0.01, 0.05], years: [2025, 2030, 2035], thresholds: [0.7, 0.9], max_year: 2050, current_year: 2025, growth_adds: [0, 0.01, 0.02] }` and describe `rates` (`city_all, city_post, city_span_pandemic, pairs_*, ward_all, ward_post, count_ratio_p05/p50/p95`) and `backtest` (`n, mape: { naive, lo, base, hi, own }, median_ape, by_class_base, note`).
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add CONTRACTS.md style.css tests/shell.test.js && git commit -m "contracts: pooled growth model; chrome: no code prefix (G13, C1)"`.

### Task A8: Pipeline audit fixes (scope audit G1, G11)

**Files (pipeline repo):** `src/outputs/workbook.py` (`_readme`, `write_workbook`), `scripts/validate_outputs.py`, `run.py` (`sensitivity`), `tests/test_workbook_figures.py`, `tests/test_validate_outputs.py`

- [ ] **Step 1: Failing tests.** `tests/test_workbook_figures.py`: after writing a workbook with two `extra_sheets`, read it back with `pd.ExcelFile` and assert every sheet name appears in the README sheet's text (`"\n".join(readme_df.astype(str).agg(" ".join, axis=1))`). `tests/test_validate_outputs.py`: a workbook with the 12 original sheets fails `validate`, one with all 20 passes.
- [ ] **Step 2: Run, FAIL.**
- [ ] **Step 3: Implement.** `_readme(params, sheet_names)` builds its sheet rows from `sheet_names` (one row per sheet with a one line description from a dict `SHEET_NOTES`; unknown names get "see CONTRACTS.md"); `write_workbook` computes `names = [the twelve in order] + list((extra_sheets or {}).keys())` and passes it. `validate_outputs.py`: `EXPECTED_SHEETS` is the full list of twenty; check `set(EXPECTED_SHEETS) <= set(found)`. `run.py sensitivity()`: `long[["from_road", "to_road"]] = long[["from_road", "to_road"]].fillna("")` before `pivot_table`, and `dropna=False`.
- [ ] **Step 4: `python -m pytest -q` and `python run.py --skip-figures`, PASS; `pd.read_excel(..., "Sensitivity")` has 204 rows.**
- [ ] **Step 5: Commit:** `git add src/outputs/workbook.py scripts/validate_outputs.py run.py tests/test_workbook_figures.py tests/test_validate_outputs.py && git commit -m "workbook: README lists all 20 sheets, validator expects 20, sensitivity keeps NaN rows (scope audit G1 G11)"`.

Wave A gate: both repos green; `node tests/e2e/verify.mjs` includes the table width and inspector checks; push both branches.

---

# Wave B: the system

### Task B1: Tokens, radii, one switch (UI audit B9, spec 3.1)

**Files:** `tokens.css`, `style.css` (switch, segmented, buttons, legend, help, tooltip, sheet radii), `present.css` (switch, card, chips, buttons), `tests/theme.test.js`

- [ ] **Step 1: Failing test.** `tests/theme.test.js`: read `tokens.css` and assert it contains `--brand: #841617`, `--programmed: #2a78d6`, `--radius-chip: 2px`, `--radius-control: 4px`, `--radius-card: 8px`, `--radius-sheet: 12px`. Read `style.css` and `present.css` and assert no `border-radius:` value other than `0`, `2px`, `4px`, `8px`, `12px` or a `var(--radius-` token appears (regex over the two files; print offenders).
- [ ] **Step 2: Run, FAIL (999px, 3px, 6px, 14px exist today).**
- [ ] **Step 3: Implement.** Add to `tokens.css` `:root`: `--brand: #841617; --programmed: #2a78d6; --accent-soft: #fbe9dc; --radius-chip: 2px; --radius-control: 4px; --radius-card: 8px; --radius-sheet: 12px;` and `--radius: var(--radius-control)` so existing `var(--radius)` uses stay. Dark block adds `--brand: #a31d1f` (brand on dark, 5.2:1 on `#121417`). Replace every `border-radius` in `style.css` and `present.css` with the matching token: chips, switch, knob, slider thumb 2; buttons, segmented, inputs 4; popup, legend, help, tooltip 8; present card, sheet 12. Make `present.css` switch rules the same as `style.css` (34 by 20 track, 2 px radius, 14 px square knob) by deleting the present overrides at `present.css:338-358` and letting the base rule apply; same for slider thumbs. One button border token: `--btn-border: var(--ink-muted)` light, `var(--hairline)` present, used by both files.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add tokens.css style.css present.css tests/theme.test.js && git commit -m "tokens: brand and programmed colors, one radius scale, one switch (UI audit B9)"`.

### Task B2: Shared top bar `ui/sitenav.js` (spec 3.2)

**Files:** create `ui/sitenav.js`, modify `index.html` (replace the `<header class="topbar">` contents), `style.css`, `app.js` (call `initSiteNav`), test `tests/sitenav.test.js`

**Interfaces:** `siteNavHtml({ active: "map"|"methods"|"data", actions: string }) -> string`; `initSiteNav(el, opts) -> { setActive(name) }`. The map page passes its existing Present, Hide list and Aerial buttons as `actions` html so their ids stay.

- [ ] **Step 1: Failing test** `tests/sitenav.test.js`: `siteNavHtml({ active: "methods", actions: "" })` contains three links `href="index.html"`, `href="methods.html"`, `href="data.html"`, the methods link has `aria-current="page"`, the product title text is "Norman street segment priorities" in mixed case, and the html contains `class="brand-rule"`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.**

```js
// ## WHAT THIS FILE DOES
// The top bar every page shares: product title with the brand rule, three section links, and the page's own
// action buttons on the right. Pure html plus a tiny init. Imported by app.js, methods.js and datapage.js.
const LINKS = [["map", "index.html", "Map"], ["methods", "methods.html", "Methods"], ["data", "data.html", "Data"]];
export function siteNavHtml({ active, actions = "" }) {
  const links = LINKS.map(([k, href, label]) => `<a class="navlink${k === active ? " active" : ""}" href="${href}"${k === active ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  return `<div class="brand"><span class="product">Norman street segment priorities</span><span class="brand-rule" aria-hidden="true"></span></div><nav class="sections" aria-label="Sections">${links}</nav><div class="actions">${actions}</div>`;
}
export function initSiteNav(el, opts) {
  el.innerHTML = siteNavHtml(opts);
  return { setActive(name) { for (const a of el.querySelectorAll(".navlink")) { const on = a.getAttribute("href") === `${name === "map" ? "index" : name}.html`; a.classList.toggle("active", on); if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); } } };
}
```

`style.css`: `.topbar { height: 60px; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 24px; padding: 0 20px; border-bottom: 1px solid var(--hairline); } .topbar .product { font: 500 15px/1 var(--font-serif); } .topbar .brand-rule { display: block; width: 28px; height: 2px; background: var(--brand); margin-top: 6px; } .topbar .sections { display: flex; gap: 20px; } .topbar .navlink { font: 500 13px var(--font-sans); color: var(--ink-muted); text-decoration: none; padding: 20px 0; border-bottom: 2px solid transparent; } .topbar .navlink.active { color: var(--ink); border-bottom-color: var(--brand); } @media (max-width: 767px) { .topbar { grid-template-columns: 1fr auto; } .topbar .sections { grid-column: 1 / -1; height: 36px; } }`. In `index.html` the topbar becomes `<header class="topbar" id="topbar"></header>` and `app.js` calls `initSiteNav(document.getElementById("topbar"), { active: "map", actions: '<button id="present-toggle" class="btn" type="button" title="Scripted walkthrough: arrow keys step, Esc exits">Present</button><button id="panel-toggle" class="btn panel-toggle" type="button" aria-expanded="true" aria-controls="panel">Hide list</button><div class="segmented basemap" id="basemap-toggle" role="group" aria-label="Basemap"><button type="button" data-basemap="light" class="active" aria-pressed="true">Map</button><button type="button" data-basemap="satellite" aria-pressed="false">Aerial</button></div>' })` before any code that looks those ids up (move the lookups after it). The basemap control becomes a segmented `Map · Aerial` (UI audit C13); update the handler that toggled `#basemap-toggle` to read `data-basemap` and `syncControls` to set the active button. Update `tests/e2e/verify.mjs` and any unit test that clicked `#basemap-toggle` as a single button.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add ui/sitenav.js index.html style.css app.js ui/panel.js tests/sitenav.test.js tests/e2e/verify.mjs tests/shell.test.js && git commit -m "sitenav: shared top bar with brand rule and section links; Map and Aerial segmented (spec 3.2, C13)"`.

### Task B3: Explore and Simulate tabs, chip row (UI audit B1, B10, C3, C4)

**Files:** create `ui/tabs.js`, `ui/chips.js`; modify `index.html` (controls block lines 46 to 140), `style.css`, `ui/simulate.js` (labels, day type grid, assumption to `title`), `ui/panel.js` (briefing line one line), `ui/legend.js` (`legendTitle` returns the metric only), `app.js`; tests `tests/tabs.test.js`, `tests/chips.test.js`, `tests/simulate.test.js`, `tests/popup_legend.test.js`

**Interfaces:** `initTabs(el, { onChange }) -> { set(name), get() }` with names `explore`, `simulate`; `chipsHtml(state, raw) -> string` from `ui/chips.js` using `data.js scenarioText` pieces: `[year if not 2025, band if not base, "+N percent" if growthAdd, day type label if not school_fri, "<name> closed" if closing]`; `legendTitle(state)` returns `METRIC_LABEL[state.metric]` only; a new `legendSub(state)` returns `LOS E · crashes 2021 to 2025` and the scenario year chip.

- [ ] **Step 1: Failing tests.** `tests/tabs.test.js`: with two fake panels `#tab-explore` and `#tab-simulate` and two buttons `[data-tab]`, `initTabs` hides simulate by default, `set("simulate")` shows it, hides explore, sets `aria-selected`, calls `onChange("simulate")`. `tests/chips.test.js`: `chipsHtml(defaultState)` is `""`; `chipsHtml({ ...defaultState, year: 2031, band: "hi", growthAdd: 0.02, daytype: "gameday", closing: "52500-158" }, raw)` yields five `<span class="chip">` in that order with texts `2031`, `high band`, `+2 percent per year`, `OU game day`, `W Main St closed`. `tests/popup_legend.test.js`: `legendTitle` under a scenario equals `"Combined score"` and `legendSub` contains `"projected 2031"`. `tests/simulate.test.js`: the day type control has six cells (`.daytypes button` count 5 plus one `.spacer`), the growth label reads "Extra growth, percent per year", the band label "Forecast range", and `#sim-assumption` does not exist (the sentence is on `#daytype-toggle` `title`).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `ui/tabs.js`:

```js
// ## WHAT THIS FILE DOES
// Two tabs over the control block, Explore and Simulate. They swap panels so nothing stacks above the ranked
// list (UI audit B1). Imported by app.js. Pure DOM, no state key: the active tab is a view choice, not data.
export function initTabs(el, { onChange = () => {} } = {}) {
  const buttons = Array.from(el.querySelectorAll("[data-tab]"));
  const panels = { explore: document.getElementById("tab-explore"), simulate: document.getElementById("tab-simulate") };
  let current = "explore";
  const set = (name) => {
    current = name in panels ? name : "explore";
    for (const b of buttons) { const on = b.dataset.tab === current; b.classList.toggle("active", on); b.setAttribute("aria-selected", String(on)); }
    for (const [k, p] of Object.entries(panels)) if (p) p.hidden = k !== current;
    onChange(current);
  };
  for (const b of buttons) b.addEventListener("click", () => set(b.dataset.tab));
  set("explore");
  return { set, get: () => current };
}
```

`index.html`: wrap the ward, metric, LOS and years controls in `<div id="tab-explore" role="tabpanel">`, the Simulate body (without its accordion head) in `<div id="tab-simulate" role="tabpanel" hidden>`, and put `<div class="segmented tabs" role="tablist" id="control-tabs"><button type="button" data-tab="explore" role="tab" class="active" aria-selected="true">Explore</button><button type="button" data-tab="simulate" role="tab" aria-selected="false">Simulate</button></div>` as the first row of `.controls`. Day types become `<div class="daytypes grid">` with five buttons and one `<span class="spacer" aria-hidden="true"></span>`; `#daytype-toggle` gets `title` set by `syncSimulate` to the active assumption sentence; delete `#sim-assumption` and `#sim-sample`. Labels: "Extra growth, percent per year", "Forecast range" with buttons Low Base High. `ui/chips.js`:

```js
// ## WHAT THIS FILE DOES
// The scenario chip row under the stats line: one chip per non default scenario setting, in a fixed order, so
// the briefing line can stay one line. Imports data.js (isDefaultScenario, segmentProps). Called from app.js render.
import { isDefaultScenario, segmentProps } from "../data.js";
const DAY = { school_wkday: "school weekday", weekend: "weekend", summer_wkday: "summer weekday", gameday: "OU game day" };
export function chipsHtml(state) {
  if (isDefaultScenario(state)) return "";
  const chips = [];
  if (state.year && state.year !== 2025) chips.push(String(state.year));
  if (state.band && state.band !== "base") chips.push(`${state.band === "hi" ? "high" : "low"} band`);
  if (state.growthAdd) chips.push(`+${Math.round(state.growthAdd * 100)} percent per year`);
  if (state.daytype && state.daytype !== "school_fri") chips.push(DAY[state.daytype] || state.daytype);
  if (state.closing) { const p = segmentProps(state.closing); chips.push(`${p ? p.on_road : state.closing} closed`); }
  return chips.map(c => `<span class="chip">${c}</span>`).join("");
}
```

`index.html` adds `<div class="chips" id="scenario-chips" aria-live="polite"></div>` under `#stats`; `app.js render` sets its `innerHTML = chipsHtml(state)`. `ui/panel.js briefingLine` drops the scenario clause (the chips carry it) and the line gets `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. `ui/legend.js`: `legendTitle(state) = METRIC_LABEL[state.metric]`; new `legendSub(state)` = `LOS ${state.los} · crashes ${state.yearMin} to ${state.yearMax}` plus `<span class="chip">projected ${state.year}</span>` when `!isDefaultScenario(state)`; `renderLegend` prints both. `style.css`: `.controls { height: 232px; }` with the explore and simulate panels each fitting in 196 px (four 36 px rows plus gaps; the years control keeps its two row range); `.daytypes.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; } .daytypes.grid button, .daytypes.grid .spacer { height: 36px; }`; `.chips { display: flex; flex-wrap: wrap; gap: 4px; padding: 0 20px 6px; min-height: 0; } .chip { font: 500 11px var(--font-mono); border: 1px solid var(--hairline); border-radius: var(--radius-chip); padding: 1px 6px; }`.
- [ ] **Step 4: Gates PASS.** Add to `verify.mjs`: click `[data-tab="simulate"]`, `check("simulate tab keeps the table at least 300 px tall", (await page.evaluate(() => document.getElementById("table-wrap").getBoundingClientRect().height)) >= 300)`, set year 2031 through the range input and `check("chip row shows the year", (await page.textContent("#scenario-chips")).includes("2031"))`.
- [ ] **Step 5: Commit:** `git add ui/tabs.js ui/chips.js index.html style.css ui/simulate.js ui/panel.js ui/legend.js app.js tests/tabs.test.js tests/chips.test.js tests/simulate.test.js tests/popup_legend.test.js tests/e2e/verify.mjs && git commit -m "controls: Explore and Simulate tabs, scenario chip row, legend title is the metric (UI audit B1 B10 C3 C4)"`.

### Task B4: Establish on segment bounds and the world ring mask (UI audit B3, B11)

**Files:** `camera.js:155-162`, `data.js` (export `segmentsBbox()`), `layers/segments.js:330-362` (`addWardMask`), `app.js` (pass `segmentsBbox` to `establish`), `tests/camera.test.js`, `tests/segments.test.js`

- [ ] **Step 1: Failing tests.** `tests/camera.test.js`: `establish(map, wardsFc, { segmentsBounds: [[-97.5, 35.15], [-97.35, 35.3]] })` eases to a center inside those bounds, not the ward union's center (use the recording map double; assert `|center.lng - (-97.425)| < 0.01`). `tests/segments.test.js`: the mask polygon's outer ring is `[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]` and the ward polygon is its hole.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `data.js`: `export function segmentsBbox() { let w = 180, s = 90, e = -180, n = -90; for (const f of raw.segments.features) for (const [x, y] of f.geometry.coordinates) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; } const px = (e - w) * 0.08, py = (n - s) * 0.08; return [[w - px, s - py], [e + px, n + py]]; }`. `camera.js establish(map, wardsFc, { segmentsBounds, ... })`: `const bounds = segmentsBounds || collectionBounds(wardsFc);` and the rest unchanged; `app.js` passes `segmentsBounds: segmentsBbox()` everywhere `establish` is called (scenes, reset view, tour). `addWardMask`: build `{ type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], ...wardRings] }` where `wardRings` are the ward's rings reversed if needed so the hole winding is opposite the outer ring (reverse each ring; Mapbox tolerates either winding for fills but the test asserts the outer ring literally).
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add camera.js data.js layers/segments.js app.js tests/camera.test.js tests/segments.test.js && git commit -m "camera: establish on the segment bounds; ward mask from a world ring (UI audit B3 B11)"`.

### Task B5: HTML callouts with leaders (UI audit B4)

**Files:** create `ui/callouts_html.js`; modify `scenes.js` (callouts use the new module through `app.js`), `app.js` (replace `showCallouts` for present with `showHtmlCallouts`), `present.css`; test `tests/callouts_html.test.js`

**Interfaces:** `placeCallouts(items, project, { minGap = 40 }) -> [{ id, text, lngLat, anchor, dy }]` pure (items `{ id, text, lngLat, bearing }`; `project(lngLat) -> { x, y }`); `showHtmlCallouts(map, items) -> clear()` creates `mapboxgl.Marker` elements with class `callout` and a leader `<i>`.

- [ ] **Step 1: Failing test.** Two items projecting to `{x: 100, y: 100}` and `{x: 100, y: 120}`: after `placeCallouts` the second has `dy` of at least 40 relative to the first; anchors come from bearing (`bearing` within 45 of 0 or 180 gives `left`, else `bottom`).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.**

```js
// ## WHAT THIS FILE DOES
// Callouts as HTML markers (Plex Mono 14, a 2 px accent leader) instead of symbol layer text, so they are legible
// on a projector and never overprint: placeCallouts pushes a label down when it lands within minGap px of an
// earlier one. Pure placement plus a Mapbox marker wrapper. Called from app.js for the film and the top five.
export function placeCallouts(items, project, { minGap = 40 } = {}) {
  const placed = [];
  for (const it of items) {
    const p = project(it.lngLat);
    const anchor = it.bearing != null && (Math.abs(((it.bearing % 180) + 180) % 180) < 45 || Math.abs(((it.bearing % 180) + 180) % 180) > 135) ? "left" : "bottom";
    let dy = 0;
    for (const q of placed) if (Math.abs(q.x - p.x) < 160 && Math.abs((q.y + q.dy) - (p.y + dy)) < minGap) dy = (q.y + q.dy) + minGap - p.y;
    placed.push({ id: it.id, text: it.text, lngLat: it.lngLat, anchor, dy, x: p.x, y: p.y });
  }
  return placed.map(({ x, y, ...rest }) => rest);
}
export function showHtmlCallouts(map, items) {
  if (typeof mapboxgl === "undefined") return () => {};
  const project = (ll) => map.project(ll);
  const markers = placeCallouts(items, project).map(c => {
    const el = document.createElement("div"); el.className = `callout ${c.anchor}`;
    el.innerHTML = `<i class="leader" aria-hidden="true"></i><span>${c.text}</span>`;
    el.style.setProperty("--dy", `${c.dy}px`);
    return new mapboxgl.Marker({ element: el, anchor: c.anchor === "left" ? "left" : "bottom", offset: c.anchor === "left" ? [14, c.dy] : [0, -10 + c.dy] }).setLngLat(c.lngLat).addTo(map);
  });
  return () => markers.forEach(m => m.remove());
}
```

`present.css`: `.callout { font: 500 14px var(--font-mono); color: var(--ink); background: var(--surface-raised); border: 1px solid var(--hairline); border-radius: var(--radius-chip); padding: 4px 8px; white-space: nowrap; position: relative; } .callout .leader { position: absolute; width: 2px; height: 10px; background: var(--accent); left: 50%; bottom: -10px; } .callout.left .leader { width: 12px; height: 2px; left: -12px; top: 50%; bottom: auto; }`. In `app.js` present path, where `showCallouts(map, ids)` runs for a scene, use `clearCallouts = showHtmlCallouts(map, ids.map(id => ({ id, text: labelFor(id), lngLat: lineMidpoint(id), bearing: bearingFor(id) })))` with `labelFor` building `#rank road` from `rankWithin` and the segment name, and `bearingFor` from `geo.js bearingAcrossScreen` (already imported). Keep the symbol layer callouts for explore hover if used; the film uses html.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add ui/callouts_html.js app.js present.css scenes.js tests/callouts_html.test.js && git commit -m "callouts: HTML markers with leaders and a collision pass for the film (UI audit B4)"`.

### Task B6: Film chrome (UI audit B5, B6, B7, B12, C7, C8, C10, C11)

**Files:** `present.css`, `scenes.js`, `ui/present.js`, `tests/scenes.test.js`, `tests/present.test.js`

- [ ] **Step 1: Failing tests.** `tests/scenes.test.js`: every scene has at most four `stats`; the `closure` caption has at most 28 words; the `runout` caption at most 24; the `closing` scene has `links: [{ label: "Workbook", href }, { label: "Report", href }, { label: "Methods", href: "methods.html" }]` and `urlChip: LIVE_URL`; `ward2` scene uses `list` rows (already) and the test asserts `present.css` contains no `.present-list .card` rule. `tests/present.test.js`: the progress bar element gets class `full-width`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `present.css`: `.present-progress { left: 24px; right: 24px; width: auto; bottom: 8px; transform: none; }` (B5); future segments `rgba(243,241,234,0.3)` (C10); list rows as `.present-list .row { display: grid; grid-template-columns: 2ch 1fr auto; gap: 12px; padding: 8px 0; border-top: 1px solid var(--hairline); }` and delete the card rule (C7); `@media (max-width: 767px) { .present-card { left: 0; right: 0; width: 100%; max-width: none; box-sizing: border-box; } .present-caption { max-width: none; } }` (B12); `.mapboxgl-ctrl-attrib { font-size: 10px; } :root[data-mode="present"] .mapboxgl-ctrl-logo { opacity: 0.6; }` and `attributionControl: { compact: true }` in the map constructor (C11). `scenes.js`: cap stats at four everywhere; `top5` scenes use `list`; `runout` stats `[{ label: "at or over 0.9 today", value }, { label: "by 2035", value }]` and a `titleLive: true` flag the present chrome uses to append the live year to the title (the existing live year readout moves from the stats into the title); captions rewritten: runout `By 2035 at base growth ${n} of ${total} counted segments reach v/c 0.9, three more pass 0.7.`, closure `Close ${name} between ${from} and ${to} and its ${vpd} vehicles a day land on ${detourName}, taking it from v/c ${before} to ${after}.`; closing scene gets `urlChip` and `links`; `ui/present.js` renders `urlChip` as `<button class="chip copy" data-copy="${url}">${url}</button>` (copies with `navigator.clipboard` when present) and the links as text links, with the primary "Explore the dashboard" as `.btn.primary` (filled `--link`).
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add present.css scenes.js ui/present.js app.js tests/scenes.test.js tests/present.test.js && git commit -m "film chrome: full width progress, four stat cap, short captions, list rows, phone card, closing links (UI audit B5 B6 B7 B12 C7 C8 C10 C11)"`.

### Task B7: Dark ramp and halo (UI audit B2)

**Files:** `layers/segments.js` (`setSegmentsTheme`), `theme.js`, `tokens.css`, `ui/legend.js` (dark note), `tests/layers.test.js`, `tests/theme.test.js`

- [ ] **Step 1: Failing tests.** `setSegmentsTheme(map, "dark")` writes `line-color` using the reversed ramp (first stop color `#6d2f09`, last `#f59e5c`), casing `line-color` `#0b0c0e`, casing `line-opacity` `0.7`, casing width the line width plus 2 (not plus 3); `legendSub` on the dark theme includes "brighter is higher".
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `config.js` is Clark's; add `RAMP_DARK = [...RAMP].reverse()` in `theme.js` instead, export it, and have `setSegmentsTheme` pick `name === "dark" ? RAMP_DARK : RAMP` when it rebuilds the `line-color` match or step expression (it already rebuilds the paint on theme change; keep the same expression shape with the swapped colors). Casing on dark: `#0b0c0e` at 0.7, width `+2`. `renderLegend` swatches follow the active ramp so the legend inverts with the map; `legendSub` appends `· brighter is higher` on dark.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add layers/segments.js theme.js tokens.css ui/legend.js tests/layers.test.js tests/theme.test.js && git commit -m "dark basemap: reversed ramp with a dark halo, legend says brighter is higher (UI audit B2)"`.

Wave B gate: gates green; push.

---

# Wave C: data

All Wave C pipeline tasks run in `norman-traffic-case` on `phase2/forecast`.

### Task C1: New GIS downloads

**Files:** `config.py` (`GIS_SERVICES`), `src/gis_download.py`, `tests/test_gis_download.py`

**Interfaces:** `config.GIS_SERVICES` gains `projects`, `smb_2026_urban_asphalt`, `smb_2026_concrete`, `smb_2026_preventive`, `smb_2026_rural`, `smb_2026_reconstruction`, `buildings`, `flood`, `schools`, `ou_property`, `ada_intersections`; `gis_download.download_all(services, out_dir, only=None)` writes `data/gis/<key>.geojson` for every key and skips existing files unless `refresh=True`.

- [ ] **Step 1: Failing test.** In `tests/test_gis_download.py` assert the eleven new keys exist in `config.GIS_SERVICES`, every URL starts with `https://services.arcgis.com/` and ends with `/FeatureServer/<int>`, and `download_all({"x": url}, tmp_path, fetch=fake)` writes `x.geojson` where `fake` returns a two feature collection in two pages (test the `resultOffset` paging with a fake that returns `exceededTransferLimit: true` once).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** URLs from `docs/research/2026-11-05-scout.md` section A1 (copy the exact FeatureServer paths it lists for each dataset; the org is `rt1leD4Hj3sLGHNL`; where the scout lists a layer index use it, else `0`). `download_all` pages with `resultOffset` and `resultRecordCount=2000`, requests `outFields=*`, `outSR=4326`, `f=geojson`, and for `buildings` passes `geometry=<CITY_BOUNDS envelope>&geometryType=esriGeometryEnvelope&inSR=4326` so the 77,431 footprints are clipped server side to the segment bounds plus 1 km. Keep the existing three services and their file names. `--only buildings` from the command line.
- [ ] **Step 4: `pytest -q tests/test_gis_download.py` PASS; `python src/gis_download.py` downloads the new files (sizes logged).**
- [ ] **Step 5: Commit:** `git add config.py src/gis_download.py tests/test_gis_download.py data/gis/*.geojson && git commit -m "gis: projects, 2026 bond layers, buildings, flood, schools, OU property, ADA intersections downloads"` (if any file is over 20 MB, add it to `.gitignore` and note it in the README instead of committing).

### Task C2: Programmed projects flag

**Files:** create `src/enrich/__init__.py`, `src/enrich/programmed.py`; modify `config.py` (`PROGRAMMED_BUFFER_M = 25.0`), `run.py` (call in `phase2`), `CONTRACTS.md`; test `tests/test_programmed.py`

**Interfaces:** `add_programmed(segments, projects_path, smb_paths, buffer_m) -> segments` adds `programmed (bool), programmed_name (str|None), programmed_type (str|None), programmed_year (int|None), programmed_status (str|None), programmed_source (str|None), programmed_ids (list[str])`. A project matches when any of its line's vertices lie within `buffer_m` of the segment line in the metric frame and the project's name key (`naming.road_key` of `NAME` or `Project`) equals the segment's `road_key`, or when at least 60 percent of the project line's length lies inside the buffer regardless of name. The newest `programmed_year` wins when several match; `programmed_source` is `"City of Norman Projects"` for the projects layer and `"2026 Street Maintenance Bond"` for the SMB layers.

- [ ] **Step 1: Failing test.** A synthetic segment along y = 0 from x = 0 to 300 m with `road_key "MAIN"`; a projects geojson with one feature named "MAIN ST RESURFACING" along y = 5 from 50 to 250 m (`BOND_YR 2019`, `WORK_TYPE "RD_"`, `PROJ_STATUS "Complete"`) and one far away; an SMB geojson with one feature "Main St" `CalendarYear 2027`, `STATUS "Planned"` along y = 8 from 100 to 200. Assert `programmed` true, `programmed_year 2027`, `programmed_source "2026 Street Maintenance Bond"`, `programmed_ids` holds both ids, and the far feature never matches. A second segment with no project nearby gets `programmed False` and `None` elsewhere.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** (`src/enrich/programmed.py`):

```python
"""Step 17: which counted segments are already covered by a programmed city project.
## WHAT THIS FILE DOES
## In: segments with metric geometry, the City projects layer and the 2026 bond layers (GeoJSON). Out: segments with
## programmed flags. Called from run.py phase2(). A project "covers" a segment when its line runs along the segment
## (60 percent of its length inside the buffer) or when it is within the buffer and carries the same road key."""
from __future__ import annotations
from pathlib import Path
import pandas as pd
from shapely.geometry import shape
from geo import load_features, project
from naming import road_key

COLS = ["programmed", "programmed_name", "programmed_type", "programmed_year", "programmed_status", "programmed_source", "programmed_ids"]

def _projects(path: Path, source: str) -> list[dict]:
    out = []
    for geom_m, p in load_features(path):
        name = p.get("NAME") or p.get("Project") or p.get("PROJ_ID") or ""
        year = p.get("CalendarYear") or p.get("ConstYear") or p.get("BOND_YR")
        out.append({"id": str(p.get("Project_ID") or p.get("PROJ_ID") or p.get("OBJECTID") or len(out)), "name": str(name).strip(), "key": road_key(name),
                    "type": p.get("WORK_TYPE") or p.get("PROJ_CAT") or source, "year": int(year) if year not in (None, "", 0) else None,
                    "status": p.get("PROJ_STATUS") or p.get("STATUS"), "source": source, "geom": geom_m})
    return out

def add_programmed(segments: pd.DataFrame, projects_path: Path, smb_paths: list[Path], buffer_m: float = 25.0) -> pd.DataFrame:
    projects = _projects(projects_path, "City of Norman Projects") + [pr for p in smb_paths for pr in _projects(p, "2026 Street Maintenance Bond")]
    out = segments.copy()
    rows = []
    for r in out.itertuples(index=False):
        g = getattr(r, "geometry", None)
        if g is None or g.is_empty:
            rows.append({c: (False if c == "programmed" else ([] if c == "programmed_ids" else None)) for c in COLS}); continue
        line = project(g); buf = line.buffer(buffer_m)
        hits = []
        for pr in projects:
            if not pr["geom"].intersects(buf):
                continue
            inside = pr["geom"].intersection(buf).length / pr["geom"].length if pr["geom"].length > 0 else 0.0
            if inside >= 0.6 or pr["key"] == getattr(r, "road_key", ""):
                hits.append(pr)
        if not hits:
            rows.append({c: (False if c == "programmed" else ([] if c == "programmed_ids" else None)) for c in COLS}); continue
        best = max(hits, key=lambda h: (h["year"] or 0))
        rows.append({"programmed": True, "programmed_name": best["name"], "programmed_type": best["type"], "programmed_year": best["year"],
                     "programmed_status": best["status"], "programmed_source": best["source"], "programmed_ids": sorted({h["id"] for h in hits})})
    for c in COLS:
        out[c] = [row[c] for row in rows]
    return out
```

`run.py phase2`: after `add_speed_flags`, `seg = add_programmed(seg, C.GIS_DIR / "projects.geojson", [C.GIS_DIR / f"{k}.geojson" for k in C.GIS_SERVICES if k.startswith("smb_2026")], C.PROGRAMMED_BUFFER_M)` and a `Programmed_Projects` sheet (`seg[seg.programmed][["loc_id", "on_road", "from_road", "to_road"] + COLS[1:]]`). Add `programmed*` to `FORECAST_PROPS` in `geojson_out.py` (lists through `_clean` need `programmed_ids` as a list; extend `_clean` to pass lists through). Document in `CONTRACTS.md`.
- [ ] **Step 4: `pytest -q` PASS; `python run.py --skip-figures` logs `programmed: N of 204 segments covered`.**
- [ ] **Step 5: Commit:** `git add src/enrich config.py run.py src/outputs/geojson_out.py CONTRACTS.md tests/test_programmed.py && git commit -m "programmed: city project and 2026 bond coverage per segment"`.

### Task C3: Context flags and dashboard layer files

**Files:** create `src/enrich/flags.py`; modify `config.py` (`SCHOOL_RADIUS_M = 400.0`), `run.py`, `src/outputs/geojson_out.py` (`write_projects_geojson`, `write_context_geojson`, `write_buildings_geojson`), `CONTRACTS.md`; tests `tests/test_flags.py`, `tests/test_geojson_out.py`

**Interfaces:** `add_context_flags(segments, flood_path, schools_path, ada_path, school_radius_m) -> segments` adds `flood_zone (str|None, the FLD_ZONE of the first flood polygon the segment line intersects, "X" zones ignored), school_400m (int), signalized_from, signalized_to (bool|None from the ADA layer's Signalized within 40 m of the segment ends)`. `write_projects_geojson(projects_path, smb_paths, out)` writes lines with `name, type, year, status, source`; `write_context_geojson(flood_path, schools_path, ou_path, out)` writes one collection with a `kind` property (`flood`, `school`, `ou`); `write_buildings_geojson(buildings_path, bounds, out)` writes polygons with `height` (float, meters; `BuildingHeight` is feet in the city layer, so divide by 3.2808) clipped to `bounds`.

- [ ] **Step 1: Failing tests.** Synthetic flood polygon `AE` crossing a segment, a school 300 m away and one 900 m away, an ADA point `Signalized "Yes"` at the segment's from end: assert `flood_zone "AE"`, `school_400m 1`, `signalized_from True`, `signalized_to None`. For the writers: output files parse, `kind` values are the three expected, `height` is `BuildingHeight / 3.2808` rounded to 1, features outside the bounds are dropped.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** with the same shape as `programmed.py` (load features in the metric frame, buffer the segment line by 15 m for flood, use `Point` distance for schools and ADA). Writers follow `write_wards_geojson`.
- [ ] **Step 4: `pytest -q` PASS; run.py writes `dashboard/data/projects.geojson`, `context.geojson`, `buildings.geojson` (log their sizes; buildings must stay under 8 MB, else raise the `bounds` clip to the segment bounds plus 500 m and round coordinates to 5 decimals).**
- [ ] **Step 5: Commit:** `git add src/enrich/flags.py config.py run.py src/outputs/geojson_out.py CONTRACTS.md tests/test_flags.py tests/test_geojson_out.py && git commit -m "context flags (flood, schools, signals) and the projects, context and buildings layer files"`.

### Task C4: Facts JSON

**Files:** create `src/outputs/facts_out.py`; modify `run.py`, `CONTRACTS.md`; test `tests/test_facts_out.py`

**Interfaces:** `write_facts_json(segments, ward_rankings, collisions, qa, bt_summary, rates, path)` writes `dashboard/data/facts.json`: `{ "segments": 204, "arterial_segments": 177, "lanes_verified": 204, "shared_boundary": 43, "ward_fallback": 4, "fallback_geometry": 6, "collision_rows": 23595, "in_window_rows": 11345, "assigned_in_window": 5307, "year_min": 2021, "year_max": 2025, "uncounted_road_crashes": 1988, "uncounted_top_roads": [["N Interstate Dr", 137], ...], "ab_agreement_percent": "85.94", "spot_checks_done": 29, "spot_checks_passed": 27, "v_c_max": "0.88", "top5": [{ "rank", "loc_id", "name", "span", "v_c", "crashes", "combined" }], "ward_leaders": { "1": {...}, ... }, "forecast": { "cross_09_by_2035_base": 3, "cross_09_by_2035_hi": 22, "cross_07_by_2035_base": 20, "backtest_mape": {...}, "city_rate_all": 0.0096, "city_rate_post": 0.0317 }, "gameday": { "over_09": 8, "vehicles": 30800 }, "programmed_count": N, "written_at": "2026-11-05T12:00:00Z" }`. Every value is computed from the DataFrames, never typed.

- [ ] **Step 1: Failing test.** On the synthetic world from `tests/test_scoring.py` fixtures, the file parses, `segments` equals `len(segments)`, `top5` has five rows sorted by `combined` descending with two decimal strings, `in_window_rows` equals the number of collision rows whose `year` is within the window and whose `status_pre` is not `duplicate`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**; `run.py` calls it after `write_summary_json`.
- [ ] **Step 4: PASS; compare the real `facts.json` against the dashboard's `facts.js` and record any difference in the commit message (the dashboard values are the ones to doubt).**
- [ ] **Step 5: Commit:** `git add src/outputs/facts_out.py run.py CONTRACTS.md tests/test_facts_out.py && git commit -m "facts.json: every headline number the dashboard may quote, computed from the outputs"`.

### Task C5: Dashboard layers for projects, context and buildings

**Files (dashboard):** create `layers/projects.js`, `layers/context.js`, `layers/buildings.js`; modify `config.js` (Clark adds the three files to `DATA`, or `data.js loadAll` fetches them by name with a 404 tolerance like the scenario files), `data.js`, `app.js`, `index.html` (two switches "Programmed projects", "Context" in the Explore tab's settings), `state.js` (`projects: false`, `context: false`), `hash.js`, `ui/legend.js`; tests `tests/projects_layer.test.js`, `tests/context_layer.test.js`, `tests/buildings_layer.test.js`

**Interfaces:** each layer module exports `add<Name>Layer(map, fc, opts)`, `set<Name>Visible(map, visible)` and (buildings) `setBuildingsTheme(map, name)`; layer ids `projects-line`, `context-flood`, `context-ou`, `context-schools`, `context-schools-label`, `buildings-extrusion`. Slots: projects and context `middle` on Standard, buildings `middle` with `minzoom 15`.

- [ ] **Step 1: Failing tests** with the recording map double: `addProjectsLayer` adds one line layer with `line-dasharray [2, 2]`, `line-color` the `--programmed` hex, `line-width` 2 at z12 and 3 at z15, `visibility none` by default; `setProjectsVisible(map, true)` sets `visible`. Context: three layers plus a symbol layer with `minzoom 14`; flood `fill-opacity 0.06`. Buildings: `fill-extrusion-height ["get", "height"]`, `fill-extrusion-opacity 0.6`, `minzoom 15`, and `setBuildingsTheme(map, "light")` sets `visibility none` while `"dark"` sets `visible` (buildings only on the aerial basemap per the spec).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** following `layers/wards.js` for structure and `layers/basemap.js slotFor` for slots. `data.js loadAll` fetches `data/projects.geojson`, `data/context.geojson`, `data/buildings.geojson` after the base files with the same 404 tolerance used for the scenario files; `getRaw()` exposes `projects`, `context`, `buildings`. `app.js` adds the layers in `addAllLayers` after the segments layers, wires the two switches to state, and `applyMapTheme` calls `setBuildingsTheme`. When `show3dObjects` is configurable on the Standard style (`configureStandard`), set it `false`. Hover on `projects-line` shows a tooltip `name · year` through the existing tooltip module. Legend gains a dashed swatch row "Programmed project" when `state.projects`.
- [ ] **Step 4: Gates PASS** (the stub map ignores unknown layers; add a `verify.mjs` check that the two switches toggle `state.projects` and `state.context`).
- [ ] **Step 5: Commit:** `git add layers/projects.js layers/context.js layers/buildings.js data.js app.js index.html state.js hash.js ui/legend.js tests/projects_layer.test.js tests/context_layer.test.js tests/buildings_layer.test.js tests/e2e/verify.mjs && git commit -m "layers: programmed projects, context (flood, schools, OU), real height buildings on the aerial basemap"`.

### Task C6: `facts.js` reads `facts.json`

**Files:** `facts.js`, `data.js` (`loadAll` fetches `data/facts.json` first), `scenes.js`, `ui/loading.js`, `ui/help.js`, `tests/facts.test.js` (new), `tests/scenes.test.js`

**Interfaces:** `facts.js` exports `FACTS` (a live object filled by `setFacts(json)`), `TOP5` (getter over `FACTS.top5`), `WARD_LEADERS`, `LIVE_URL`, `PRIVATE_REPO`, `PUBLIC_REPO`, `setFacts(json)`, `factTokens()`; the typed defaults stay as the fallback when the file is missing, and a test asserts the fallback object's keys equal the loaded file's keys.

- [ ] **Step 1: Failing test.** `setFacts({ segments: 1, top5: [{ rank: 1, loc_id: "x", name: "X", span: "a to b", v_c: "0.10", crashes: 1, combined: "1.10" }] })` then `TOP5[0].name === "X"` and `FACTS.segments === 1`; `scenes.js buildScenes` must be called after `setFacts` in `app.js`, which the scenes test checks by building scenes with a different `segments` count and reading the citywide caption.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**; `loadAll` fetches `data/facts.json` and calls `setFacts` before resolving; `app.js` builds scenes after `loadAll`.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add facts.js data.js scenes.js ui/loading.js ui/help.js app.js tests/facts.test.js tests/scenes.test.js && git commit -m "facts: headline numbers come from data/facts.json, typed values are the fallback"`.

Wave C gate: both repos green, `python run.py` writes the three layer files and facts.json, dashboard data copied (`cp ../norman-traffic-case/dashboard/data/*.json ../norman-traffic-case/dashboard/data/*.geojson data/ && node scripts/slim-data.mjs`), push.

---

# Wave D: the methods and data pages

### Task D1: Methods figures in the pipeline (DONE 2026-11-05, commit 08cee4f on phase2/forecast)

`src/outputs/figures_methods.py` draws the fourteen SVGs into `output/figures/methods/` with `methods_index.json` (`[{ file, number, caption, bytes }]`) and `run.py phase2()` copies them to `dashboard/figures/methods/`; the dashboard repo carries the copies under `figures/methods/`. `tests/test_figures_methods.py` covers it. Nothing to do here except keep the copies current: after every pipeline run, `cp ../norman-traffic-case/dashboard/figures/methods/* figures/methods/` in the dashboard repo and commit.

### Task D2: `site.css` and the methods page shell

**Files:** create `site.css`, `methods.html`, `methods.js`; test `tests/methods.test.js`

**Interfaces:** `methods.js` exports `SECTIONS` (an array of fourteen `{ number, id, program, question, rule, formula, params: [[name, value]], columns: [name], test, check, figure, interactive: null | "backtest" | "horizon" | "closures" | "daytypes" }`) and `sectionHtml(section, caption) -> string`; `renderMethods(root, index)` builds the page from `SECTIONS` and `figures/methods/methods_index.json`.

- [ ] **Step 1: Failing test** `tests/methods.test.js`: `SECTIONS.length === 14`; numbers run 1 to 14; every `figure` file name exists in `figures/methods/` (`existsSync`); every section's `rule` and `question` contain no dash character; `sectionHtml(SECTIONS[9], "cap")` contains `<h2>`, the program name in a `<code>`, an `<img src="figures/methods/10_growth_backtest.svg"`, a `<figcaption>` with "cap", a parameters table with `GROWTH_SHRINK_K`, and `data-interactive="backtest"`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `SECTIONS` content comes from the spec section 6 table and the pipeline's `docs/guide/03-analytics-explained.md` (question, rule, parameters and columns per module; copy the wording, it was written for this). Fourteen entries, for example entry 10:

```js
{ number: 10, id: "growth", program: "forecast/growth.py and forecast/backtest.py", question: "How fast is traffic growing, and can a forecast be trusted?",
  rule: "Pool every consecutive pair of counts in the city into one annual rate, adjust it by ward with shrinkage, and test it by hiding each station's latest count and predicting it.",
  formula: "rate = exp(sum(ln(v1/v0)) / sum(years between)) - 1 ; base_ward = w * ward_rate + (1 - w) * city_rate, w = pairs / (pairs + 20)",
  params: [["GROWTH_SHRINK_K", "20"], ["GROWTH_CLIP", "[-0.01, 0.05]"]],
  columns: ["growth_base", "growth_lo", "growth_hi", "growth_method", "growth_n_obs", "growth_shrink_w", "growth_raw"],
  test: "tests/test_forecast.py", check: "Open the Growth_Backtest sheet: the high band's mean error (12.4 percent) beats no change (14.1 percent) and the station's own trend (27.0 percent).",
  figure: "10_growth_backtest.svg", interactive: "backtest" }
```

`sectionHtml`:

```js
export function sectionHtml(s, caption) {
  const params = s.params.map(([k, v]) => `<tr><td><code>${k}</code></td><td class="mono">${v}</td></tr>`).join("");
  const cols = s.columns.map(c => `<code>${c}</code>`).join(", ");
  return `<section class="method" id="${s.id}"><div class="method-head"><span class="numeral">${String(s.number).padStart(2, "0")}</span><div><h2><code>${s.program}</code></h2><p class="question">${s.question}</p></div></div>
    <p class="rule"><strong>The rule.</strong> ${s.rule}</p>${s.formula ? `<pre class="formula">${s.formula}</pre>` : ""}
    <figure class="figure"><img src="figures/methods/${s.figure}" alt="${s.question}" loading="lazy"><figcaption>${caption}</figcaption></figure>
    ${s.interactive ? `<div class="interactive" data-interactive="${s.interactive}"></div>` : ""}
    <table class="facts"><tbody><tr><th>Parameters</th><td><table class="inner">${params}</table></td></tr><tr><th>Columns added</th><td>${cols}</td></tr><tr><th>Test</th><td><code>${s.test}</code></td></tr><tr><th>How to check it</th><td>${s.check}</td></tr></tbody></table></section>`;
}
```

`methods.html`: the standard head (fonts, `tokens.css`, `style.css`, `site.css`), `<header class="topbar" id="topbar"></header>`, `<main class="doc"><aside class="contents" id="contents"></aside><article id="methods"><h1>How the numbers were made</h1><p class="lede">...</p></article></main>`, footer line from spec 3.2, `<script type="module" src="methods.js"></script>`. `methods.js` initializes the sitenav (`active: "methods"`), fetches `figures/methods/methods_index.json`, renders sections and the contents rail (one link per section, `IntersectionObserver` marks the active one), then calls `mountInteractive(root)` from `ui/charts.js` (Task D3; until then a no op). `site.css`: `.doc { display: grid; grid-template-columns: 220px minmax(0, 68ch); gap: 48px; padding: 32px 20px 64px; justify-content: center; } .contents { position: sticky; top: 76px; align-self: start; font: 400 13px/1.6 var(--font-sans); } .contents a { display: block; color: var(--ink-muted); text-decoration: none; padding: 2px 0; } .contents a.active { color: var(--ink); border-left: 2px solid var(--brand); padding-left: 8px; margin-left: -10px; } .doc h1 { font: 500 32px/38px var(--font-serif); } .lede { font: 400 17px/26px var(--font-sans); max-width: 34rem; } .method { border-top: 1px solid var(--hairline); padding: 32px 0; } .method-head { display: flex; gap: 16px; align-items: baseline; } .numeral { font: 500 22px var(--font-mono); color: var(--brand); } .method h2 { font: 500 24px/28px var(--font-serif); margin: 0; } .method h2 code { font: 500 20px var(--font-mono); } .question { font: 400 17px/26px var(--font-sans); margin: 4px 0 0; } .rule { font: 400 15px/24px var(--font-sans); } .formula { font: 400 12.5px/1.6 var(--font-mono); background: var(--surface-raised); border: 1px solid var(--hairline); border-radius: var(--radius-card); padding: 10px 12px; white-space: pre-wrap; } .figure { margin: 16px 0; border: 1px solid var(--hairline); border-radius: var(--radius-card); background: var(--surface-raised); padding: 12px; } .figure img { display: block; width: 100%; height: auto; } .figure figcaption { font: 400 12px/1.5 var(--font-mono); color: var(--ink-muted); margin-top: 8px; } table.facts { width: 100%; border-collapse: collapse; font: 400 13px/19.5px var(--font-sans); } table.facts th { text-align: left; width: 140px; font: 600 11px var(--font-sans); letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); padding: 8px 0; vertical-align: top; border-top: 1px solid var(--hairline); } table.facts td { padding: 8px 0; border-top: 1px solid var(--hairline); } .mono { font-family: var(--font-mono); } @media (max-width: 900px) { .doc { grid-template-columns: minmax(0, 1fr); } .contents { position: static; display: flex; flex-wrap: wrap; gap: 8px; } }`.
- [ ] **Step 4: `npm test` PASS; serve and open `methods.html`, every figure loads (a `tests/e2e/verify.mjs` step: goto `/methods.html`, `check("14 figures load", await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth > 0).length) === 14)`).**
- [ ] **Step 5: Commit:** `git add site.css methods.html methods.js tests/methods.test.js tests/e2e/verify.mjs && git commit -m "methods page: fourteen sections, one per analytical program, with the pipeline's figures"`.

### Task D3: The four interactive figures (`ui/charts.js`)

**Files:** create `ui/charts.js`; modify `methods.js` (call `mountInteractive`); test `tests/charts.test.js`

**Interfaces:** pure builders returning SVG or HTML strings from the shipped JSON, plus `mountInteractive(root)` that fetches `data/horizon.json`, `data/segments.geojson`, `data/closure_impacts.json`, `data/daytypes.json` and fills each `[data-interactive]`:
- `backtestSvg(rows, { w = 880, h = 420 })`: dot plot predicted (base) vs actual from `horizon.json.backtest_rows` (add that array to `horizon.json` in the pipeline: `bt[["loc_id","on_road","actual","pred_base","pred_naive","pred_hi"]]` records, Task D3 step 0) with a 45 degree line and hover titles.
- `horizonTable(features, band)`: the top 20 by `year_vc_09_<band>` (nulls last) with columns segment, v/c today, v/c 2035, year to 0.9, upgrade; a three button band switch re-renders.
- `closurePicker(features, impacts)`: a `<select>` of the top 20 citywide segments; on change shows a table of detour segments with added vpd and v/c after, plus the detour length and ratio.
- `daytypeStrip(features)`: ten rows (top by `dt_gameday_vc`), each a five cell strip whose cells are colored by the ramp class of that day type's v/c with the value inside.

- [ ] **Step 0 (pipeline):** `run.py phase2`: add `"backtest_rows": bt[["loc_id", "on_road", "actual", "pred_naive", "pred_base", "pred_hi"]].round(0).to_dict(orient="records")` to the `horizon.json` payload; document in `CONTRACTS.md`; commit `horizon.json: back test rows for the methods page`.
- [ ] **Step 1: Failing test** `tests/charts.test.js`: `backtestSvg([{ loc_id: "a", on_road: "A", actual: 1000, pred_base: 1100 }])` returns a string starting `<svg` with one `<circle` and a `<title>` containing "A"; `horizonTable(features, "base")` with three fake features (years 2029, null, 2031) orders them 2029, 2031, null; `closurePicker` renders an `<option>` per top segment and `closureTable(impacts["x"], props)` lists each detour id with its added vpd; `daytypeStrip` renders ten rows with five cells each carrying `data-class`.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement** with template strings only (no library); `classFor` reused from `ui/panel.js`; the SVG uses `tokens` through CSS variables on `fill` (`var(--ramp-2)`) so it follows the theme.
- [ ] **Step 4: `npm test` PASS; the methods drive step checks each `[data-interactive]` has children.**
- [ ] **Step 5: Commit:** `git add ui/charts.js methods.js tests/charts.test.js tests/e2e/verify.mjs && git commit -m "methods page: interactive back test, horizon table, closure picker, day type strip from the shipped JSON"`.

### Task D4: The data page

**Files:** create `data.html`, `datapage.js`, `data/sources.json` (pipeline writes it from a `config.SOURCES` list; until then a hand written file is acceptable because it is documentation, not analysis); test `tests/data_page.test.js`

**Interfaces:** `sourcesTable(rows)`, `downloadsHtml(files)`, `assumptionsTable(rows)`, `adherenceHtml(sections)` pure; `renderDataPage(root, { sources, facts })`.

- [ ] **Step 1: Failing test:** `sourcesTable` renders one row per source with provider, a link whose `href` starts with `https://`, fields used, license and retrieved date; `adherenceHtml` renders three tables titled "Required and met", "Interpreted", "Beyond the ask"; the page html contains the Aleph note sentence "The 3D captures and Street View images come from Google through Aleph, which uses undocumented endpoints; they are shown for the talk and are not redistributed as data."
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `data/sources.json` rows from `docs/research/2026-11-05-scout.md` sections A1 to A5 (City Street_Centerlines, Proposed_Functional_Classifications, Council_Wards, Projects_Polyline_View, the five 2026 SMB layers, Building_Footprint, Flood_Hazard_Zone, NormanSchools, University_Of_Oklahoma_Property, ADA_Transition_Plan_GIS_Data; ACOG counts workbooks, ACOG capacity guideline, ACOG_Crash_Map, ACOG_MPO_FC_Roads_Feb2022; ODOT AADT_Network; City collisions workbook; Google via Aleph) with the URLs the scout recorded. Downloads: `Norman_Segment_Rankings.xlsx` (copied into the dashboard `downloads/` by the pipeline), `Norman_Traffic_Report.docx` and `.md`, each `data/*.geojson` and `*.json` with sizes read at render time via `HEAD` requests (fall back to "see repository"). Assumptions table rows from the morning brief's assumption table. Adherence sections from `docs/audit/2026-11-05-scope-audit.md` section 5, three short tables.
- [ ] **Step 4: `npm test` PASS; the drive opens `/data.html` and checks the three tables exist.**
- [ ] **Step 5: Commit:** `git add data.html datapage.js data/sources.json downloads tests/data_page.test.js tests/e2e/verify.mjs && git commit -m "data page: sources with service links and licenses, downloads, assumptions, adherence summary"`.

Wave D gate: methods and data pages render on the real server with 0 console errors; push.

---

# Wave E: the film

### Task E1: Night opener (`layers/opener.js`, scene 0)

**Files:** create `layers/opener.js`; modify `scenes.js` (a new scene at index 0, kind `"opener"`), `ui/present.js` (the title card fade at 10 s), `app.js` (present path: run the opener, then crossfade to `day`), `layers/basemap.js` (`setLightPreset` already exists), `geo.js` (`sampleAlong(coords, meters)`); tests `tests/opener.test.js`, `tests/geo.test.js`, `tests/scenes.test.js`

**Interfaces:** `addOpenerLayer(map, routeCoords) -> { reveal(progress 0..1), destroy() }` adds a source with `lineMetrics: true` and a layer `opener-route` with `line-gradient` as `["step", ["line-progress"], "#ee7b2f", p, "rgba(0,0,0,0)"]` updated per frame; `runOpener(map, route, { durationMs = 15000, reduced, now, raf, onDone })` drives `reveal` and `map.easeTo` along `sampleAlong(route, t)` with `pitch 60`, returns `cancel()`. The route is `daytypes.json.gameday.routes` where `origin` starts with "I-35 at Lindsey". Scene 0 has `autoplayMs: 15000`, `lightPreset: "night"`, `layers.opener: true`, `title`, `caption` empty, `eyebrow` as the title scene, and `hint` "Press space or Next".

- [ ] **Step 1: Failing tests:** `sampleAlong([[0,0],[0,0.01]], 0.5)` returns `[0, 0.005]`; `addOpenerLayer` on the recording map adds a source with `lineMetrics: true` and a layer whose `line-gradient` step value equals the progress passed to `reveal(0.3)`; `runOpener` with fake timers calls `reveal` with increasing values and `onDone` once at the end, and under `reduced` calls `onDone` immediately after `reveal(1)`; `buildScenes(raw)[0].kind === "opener"` and the count is 18.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement.** `geo.js sampleAlong`: cumulative segment lengths in the metric frame, interpolate the point at fraction `t`. `layers/opener.js` per the interface; the camera eases every 250 ms to the sampled point with `bearing` from the local segment direction and `zoom 15.2`, `duration 260`, `easing: t => t`, so the motion is continuous without `flyTo` jitter. `ui/present.js`: for kind `opener`, hide the caption card until 10 s, then fade it in with the product title and the brand rule; at the end `app.js` calls `setLightPreset(map, "day")` and advances to scene 1. Reduced motion: title card for 4 s, no camera move, preset `day`.
- [ ] **Step 4: Gates PASS (`verify.mjs` scene count 18 and the stub drive's scene 0 check reads the opener's title).**
- [ ] **Step 5: Commit:** `git add layers/opener.js geo.js scenes.js ui/present.js app.js tests/opener.test.js tests/geo.test.js tests/scenes.test.js tests/e2e/verify.mjs tests/e2e/real.mjs && git commit -m "film: 15 second night opener along the game day route with a line gradient reveal"`.

### Task E2: Closure scene styling (UI audit B8)

**Files:** `layers/closure.js`, `scenes.js` (closure scene camera), `camera.js` (`fitFeatures(map, features, opts)`), `ui/callouts_html.js` (reuse), `tests/closure.test.js`, `tests/camera.test.js`

- [ ] **Step 1: Failing tests:** the closed layer uses `line-pattern` `"hatch"` (the image is added with `map.addImage("hatch", ...)` from a 6 by 6 canvas when `document.createElement("canvas")` exists, else `line-dasharray [1, 1]`), `line-width 4`; the detour layer `line-color` is the accent, `line-width 4`, and a symbol layer `closure-arrows` with `symbol-placement: "line"`, `text-field "›"`, `symbol-spacing 60` exists; `fitFeatures` on the recording map calls `fitBounds` with the union bounds of the given features and the padding given.
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement**; the closure scene's camera becomes `{ kind: "features", locIds: [closed, ...detour] }` handled in `app.js` by `fitFeatures`; two html callouts "Closed" on the closed segment midpoint and `+${delta} v/c` on the worst detour segment.
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add layers/closure.js scenes.js camera.js app.js tests/closure.test.js tests/camera.test.js && git commit -m "closure: hatched closed segment, arrowed detour, callouts, camera fits both (UI audit B8)"`.

---

# Wave F: site view, phones, the real renderer

### Task F1: Site view in the system (UI audit B13)

**Files:** `ui/siteview.js`, `tests/siteview.test.js`

- [ ] **Step 1: Failing tests:** the overlay header contains `.eyebrow` "Site view · Ward N" (ward from the first touching segment's `wards`), an `<h2>` in the serif face (class `serif`), a "Back to <road>" button that closes; labels render as `.siteview-label` with two children `.l1` (road) and `.l2` (figures) and a `.leader`; the Street View strip renders `<figure>` elements with captions "Looking north" etc. from the heading; the STYLE block references only `--paper`, `--surface-raised`, `--ink`, `--ink-muted`, `--hairline`, `--accent`, `--radius-*` tokens (regex over the STYLE string: no raw hex except in the fallback values).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement:** split label text on the first colon into road and figures; a screen space collision pass in the render loop (every 10 frames, compare projected label rects and push overlapping ones down by their height); a ground plane `new T.Mesh(new T.PlaneGeometry(size * 1.4, size * 1.4), new T.MeshBasicMaterial({ color: 0xf6f4ee }))` rotated flat at `y = -0.05`; `scene.background` from `--paper`; strip as a 4 up grid with captions.
- [ ] **Step 4: `npm test` PASS; Playwright screenshot of `site01` at 1440 and 390 saved to `qa/siteview/`.**
- [ ] **Step 5: Commit:** `git add ui/siteview.js tests/siteview.test.js qa/siteview && git commit -m "site view: app tokens, briefing header, two line labels with leaders and collision pass, captioned strip, ground plane (UI audit B13)"`.

### Task F2: Phone pass (UI audit B12, C9, C12)

**Files:** `style.css`, `present.css`, `ui/legend.js`, `tests/e2e/verify.mjs`

- [ ] **Step 1:** add drive checks at 390 by 844: the present caption card's `getBoundingClientRect().right <= innerWidth`; the legend at peek is at most 40 px tall; no element in `document.body.getElementsByTagName("*")` has `getBoundingClientRect().right > innerWidth + 1` on the title scene (print offenders).
- [ ] **Step 2: FAIL.**
- [ ] **Step 3: Implement:** the rules from the spec (card full width on phones, sticky fade as a fixed element outside the scroll container, legend strip only at peek).
- [ ] **Step 4: Gates PASS.**
- [ ] **Step 5: Commit:** `git add style.css present.css ui/legend.js tests/e2e/verify.mjs && git commit -m "phones: full width present card, fixed list fade, legend strip at peek (UI audit B12 C9 C12)"`.

### Task F3: Real renderer run and the morning checklist

- [ ] **Step 1:** On the presentation machine, after the token's allowed URLs are updated: `npm run serve` and `node tests/e2e/real.mjs` (scene count 18); open `qa/real/report.json` and confirm `consoleErrors: []` and no `403` in `bytes`.
- [ ] **Step 2:** Walk the demo path from the morning brief once on the projector: opener, citywide, Simulate tab to 2035, game day, closure, popup Details, View site in 3D, methods page, data page.
- [ ] **Step 3:** Merge `phase2/dashboard` into `main` and push; confirm the Pages build; open the public URL on a phone.
- [ ] **Step 4:** Commit `qa/real/report.json`: `git add qa/real && git commit -m "qa: real renderer report before the talk"`.

---

## Self review

Spec coverage: section 3 tokens (B1), 3.2 sitenav (B2), 4.1 and 4.5 tabs and chips (B3), 4.2 table (A1), 4.3 popup and inspector (A2), 4.4 layers (A3, B4, B7, C5), 4.6 legend (B3, B7), 4.7 site view (A4, F1), 5 film (B5, B6, E1, E2), 6 methods (D1 done, D2, D3), 7 data (D4), 8 pipeline (A8, C1 to C4, D1, D3 step 0), 9 audit fixes (A6, A7, A8), 10 gates (every task), 11 out of scope (nothing planned for it). The spec's "programmed" section in the inspector depends on C2 landing before the inspector shows real values; A2 renders the section only when `programmed` is truthy, so it is safe to ship A2 first.

Placeholders: none of the tasks say "TBD" or "add validation"; D4's `data/sources.json` is explicitly allowed to be hand written because it is documentation.

Type consistency: `rowHtml(r, share, scoreText, scoreClass)` and `classFor(value, metric)` (A1) are the ones D3 reuses; `inspectorHtml(p, { media, state })` (A2) matches `mediaHtml(locId, index)` in `ui/popup.js`; `legendTitle(state)` and `legendSub(state)` (B3) are what B7 extends; `segmentsBbox()` (B4) is what E1's `sampleAlong` does not need; `showHtmlCallouts(map, items)` (B5) is reused by E2; `setFacts(json)` (C6) must run before `buildScenes` (E1 adds a scene, same rule).

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-05-site-redesign.md`. Two execution options:

1. Subagent driven (recommended): one fresh subagent per task, review between tasks, fast iteration. Requires `superpowers:subagent-driven-development`.
2. Inline execution: tasks in one session with `superpowers:executing-plans`, batch execution with checkpoints.

Waves A and B first; D next (the class grades the Python, and D1 is already done so D2 is a day's work); C, E and F as time allows before the talk.

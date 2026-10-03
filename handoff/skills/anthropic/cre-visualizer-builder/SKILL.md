---
name: "cre-visualizer-builder"
description: "Assemble foundation and integration skill outputs into one finished GeoLibre embedded web app with layer ordering, filters, dashboard widgets, story maps, and two-way selection sync. Use when the user asks to \"build the final CRE map,\" \"compose the GeoLibre project,\" \"wire up the dashboard and story map,\" \"sync the map with my side panel,\" or \"assemble layers into an embedded app.\""
---

# CRE Visualizer Builder

## Local assets

This skill's reference docs and runnable templates live on disk at:
`C:\Users\Clark\Downloads\GeoLibre\kimi-output\skills\cre-visualizer-builder\`
 - `references/` — deep detail (read the specific file named in the References section below)
 - `templates/` — runnable Python/TypeScript/JSON starting points

Read those files directly with the Read tool when a workflow step references them.
Companion skills: `geolibre-embed-app`, `cre-data-pipeline`, `cre-visualizer-builder`,
`cre-parcels-assessor`, `cre-comps-listings`, `cre-demographics-mobility`,
`cre-tenant-footprints`, `cre-market-caprates`.
Authoritative GeoLibre schema reference: `C:\Users\Clark\Downloads\GeoLibre\kimi-pack\07-verified-project-format.md`

Project schema, widget types, story-map keys, and the embed API below are verified against https://geolibre.app/project-format/ (2026-07-31).

## When to use

- Use when you have clean GeoParquet/PMTiles/COG outputs from sibling skills and need to compose them into a single embedded GeoLibre app.
- Use when the user wants interactive controls: layer toggles, filters, dashboard chart widgets, story-map chapters, or two-way map ↔ side-panel selection.
- **Do not use** for raw data acquisition, scraping, conversion mechanics, hosting/CORS, or iframe deployment/infrastructure setup — hand off to `cre-parcels-assessor`, `cre-comps-listings`, `cre-demographics-mobility`, `cre-tenant-footprints`, `cre-market-caprates`, `cre-data-pipeline`, or `geolibre-embed-app`.

## Prerequisites

- A host web app (React/Vue/vanilla TypeScript) with an iframe mount point. FREE.
- URLs for each input layer hosted with CORS + HTTP range requests (hosting/CORS setup is owned by `cre-data-pipeline`):
  - Parcel/assessor GeoParquet or PMTiles — from `cre-parcels-assessor` (FREE / PAID depending on source).
  - Sale/lease comp GeoParquet — from `cre-comps-listings` (FREE if public records; PAID if broker export).
  - Demographic/LODES/isochrone GeoParquet — from `cre-demographics-mobility` (FREE Census/LODES/ORS key).
  - Tenant/brand footprint GeoParquet — from `cre-tenant-footprints` (FREE Overture/OSM; PAID SafeGraph).
  - H3 cap-rate surface GeoParquet — from `cre-market-caprates` (FREE FRED benchmark; PAID if broker comps).
- Self-hosted GeoLibre origin with `GEOLIBRE_EMBED_ORIGINS` (Docker) or `VITE_GEOLIBRE_EMBED_ORIGINS` (static build) set for two-way postMessage. Software FREE; hosting PAID. Read-only hosted embeds can use `https://web.geolibre.app` FREE, but the public instance configures no embed-origin allowlist, so it will not accept postMessage commands or emit `selectionChanged` to the host.
- Python ≥3.11 with `geopandas`, `pyarrow`, `shapely` (for project assembly and synthetic-data recipes). FREE. Optional: npm `@geolibre/core` (`createEmptyProject`, `parseProject`, `serializeProject`) to validate the assembled project in CI.

## Two constraints that shape every design decision

1. **Highlighting only works on GeoJSON-backed layers.** `highlightFeature` addresses features GeoLibre holds as GeoJSON in memory. `pmtiles` and `vector-tiles` layers are **not** highlightable — their features live only in the tile source. `geoparquet` layers **are** highlightable, because GeoLibre imports them as GeoJSON via DuckDB-WASM. So: **any layer that needs click-to-highlight or panel→map selection must ship as `geoparquet` (or `geojson`), not `pmtiles`** — tell `cre-data-pipeline` that requirement before it picks a tile format.
2. **There is no KPI tile widget type.** Valid `widgets[].type` values are `histogram | scatter | bar | line | box | pie`, and there is no `median` aggregation. Single-number KPIs ("Median Cap Rate: 6.4%") must be rendered by a plain HTML element on the **host page**, computed from your own data cache — not by GeoLibre.

## Workflow

1. **Collect layer outputs from sibling skills.**
   - Require each layer as `{ id, name, url, type, style, opacity, order, primaryKey, attribution, sourceCost }` where `type` is a GeoLibre layer type (`geoparquet`, `pmtiles`, `cog`, `geojson`, …), not a MapLibre render type.
   - Validate that every URL returns `206 Partial Content` on a `Range` request and `Access-Control-Allow-Origin` matches your host origin:
     ```bash
     curl -I -H "Range: bytes=0-99" -H "Origin: https://your-host.example.com" "https://your-cdn.com/layer.geoparquet"
     ```
     Expected: HTTP/2 206, `access-control-allow-origin: https://your-host.example.com` or `*`, and a `content-range:` header. If it fails, hand back to `cre-data-pipeline`.

2. **Assign layer order and opacity.**
   - Bottom to top: basemap → imagery/COG → tract/choropleth context → H3 market surface → parcel choropleth → isochrone rings → parcel line/highlight → tenant points/cluster → labels. Array order in `layers` is draw order.
   - Keep polygon context layers at `opacity: 0.35–0.65` so points/rings above them remain readable. See `references/layer-ordering-and-z-index.md`.

3. **Generate the `.geolibre.json` project file.**
   - Use `templates/sample-retail-explorer.geolibre.json` as the skeleton.
   - Each layer is `{id, name, type, source:{url}, visible, opacity, style, metadata}`. `style` is **flat camelCase** (`fillColor`, `strokeColor`, `strokeWidth`, `fillOpacity`, `circleRadius`, `minZoom`, `maxZoom`) — no MapLibre `paint`, `fill-color`, or `stops`.
   - Reference remote data URLs; do not inline GeoJSON larger than a few hundred features.
   - Set `mapView.center`, `zoom`, `bearing`, `pitch` for the opening camera.
   - Save as `dist/<project-name>.geolibre.json` and upload to your static host.

4. **Wire filters to the right command.**
   - Subset already loaded and the layer is `geojson`/`geoparquet`/`duckdb-query` → send `highlightFeature {layerId, filter, fit}` for cheap client-side highlighting. **A filter matching zero features is rejected (`ack {ok:false}`), not treated as a clear** — pre-check counts in your own cache. To clear, send `{layerId}` alone.
   - Layer is `pmtiles`/`vector-tiles` → highlighting is unavailable; either republish as GeoParquet or regenerate the project.
   - Filter changes the underlying dataset (date range, sector, AOI, H3 resolution) → regenerate the `.geolibre.json` and call `loadProject`.
   - See `references/filter-state-propagation.md`.

5. **Bind dashboard widgets to layers.**
   - Add one entry per widget to the `widgets` array. Keys by type: `field` (histogram/line/box), `xField`/`yField` (scatter), `category` + `aggregation` + `valueField` (bar/pie), `bins` (histogram). Bar `aggregation` is `count|sum|mean`; pie is `count|sum`. Optional `title` and `color`.
   - Use exact shared-schema field names (`cap_rate_pct`, `price_usd`, `gla_sqft`, `sale_quarter`).
   - Charts read from GeoJSON-backed vector layers and DuckDB query layers only — a `pmtiles` layer cannot back a widget.
   - Render single-number KPIs on the host page in HTML; GeoLibre has no KPI tile. See `references/widget-binding-and-kpi.md` and `templates/kpi-widget-snippets.geolibre.json`.

6. **Build story-map chapters.**
   - Append chapters to `storymap.chapters`. Each chapter uses `location {center, zoom, pitch, bearing}`, `mapAnimation` (`flyTo|easeTo|jumpTo`), `alignment` (`left|center|right|full`), `id`, `title`, `description` (HTML allowed), optional `image` and `hidden`.
   - Layer visibility per chapter is driven by `onChapterEnter` / `onChapterExit`, each an array of `{layerId, opacity, duration}`. There are no `camera`, `timeSlider`, or `visibleLayers` keys.
   - Story-level keys: `title`, `subtitle`, `byline`, `footer`, `theme`, `showMarkers`, `markerColor`, `inset`, `insetPosition`. See `references/story-map-chapters.md` and `templates/storymap-chapter-snippets.geolibre.json`.

7. **Implement the host iframe + postMessage harness.**
   - Use `templates/embed-app.tsx` as the starting TypeScript harness.
   - Set `iframe.src = "${GEO_ORIGIN}/?maponly&welcome=0&url=" + encodeURIComponent(PROJECT_URL)` for read-only.
   - For two-way sync, self-host GeoLibre and **wait for `ready` before sending — pre-`ready` messages are dropped, not queued.** `ready` re-fires on remount, so treat it as idempotent and re-send `loadProject` each time.
   - Filter inbound messages on `e.origin`, `msg.v === 1`, and `msg.source === "geolibre"` (every app→host message carries it). Add a `requestId` to any host message to get `ack {requestId, ok, error}`. Hand off Docker/origin setup to `geolibre-embed-app`.

8. **Handle `selectionChanged` without state drift.**
   - On `selectionChanged {layerId, featureIds}`, read `payload.featureIds[0]`, fetch the matching record from your own data cache (do not rely on GeoLibre to hold all attributes), and update the host side panel.
   - When the host panel clicks a record, send `setView` — either `{bbox}` **or** `{center, zoom, bearing, pitch, duration}`, never both — followed by `highlightFeature`; debounce rapid clicks. See `references/selection-sync.md`.

9. **Host, load, and verify.**
   - Upload `dist/<project-name>.geolibre.json` and all data URLs to a CORS/range-enabled bucket.
   - Open the host app, confirm `ready` → `ack` → `projectLoaded` in DevTools.
   - Verify layer order, opacity, widget values, story-map chapters, and selection sync. See Verification below.

## Recipes

### Recipe 1 — Tennessee Retail Cap-Rate Explorer

Goal: compose tract income choropleth, H3 cap-rate surface, parcel value/sqft choropleth, tenant points, isochrone rings, and a 2022–2026 story map.

```bash
# 1. Assume sibling skill outputs are in ./data/
ls data/
# tn_tracts_income.geoparquet        <- cre-demographics-mobility
# tn_retail_h3_caprate.geoparquet    <- cre-market-caprates
# tn_parcels_value.geoparquet        <- cre-parcels-assessor
# tn_retail_tenants.geoparquet       <- cre-tenant-footprints
# tn_trade_area_rings.geoparquet     <- cre-demographics-mobility

# 2. Assemble project (fails loudly if a layer omits `type` or `style`)
python templates/assemble-project.py \
  --aoi "Tennessee Retail Cap-Rate Explorer" \
  --layers data/layers.json \
  --output dist/tn-retail-explorer.geolibre.json

# 3. Upload
aws s3 cp dist/tn-retail-explorer.geolibre.json s3://geolibre-projects/tn-retail-explorer.geolibre.json \
  --acl public-read --content-type "application/json"
```

`data/layers.json` — every layer carries a real GeoLibre `type` and a flat `style` object:

```json
[
  { "id": "tracts_income", "name": "Median Household Income", "url": "https://cdn.example.com/tn_tracts_income.geoparquet",
    "type": "geoparquet", "opacity": 0.45, "order": 10, "primaryKey": "geoid",
    "style": { "fillColor": "#238b45", "strokeColor": "#1a1a1a", "strokeWidth": 0.3, "fillOpacity": 0.45 } },
  { "id": "h3_caprate", "name": "Retail Cap Rate by H3", "url": "https://cdn.example.com/tn_retail_h3_caprate.geoparquet",
    "type": "geoparquet", "opacity": 0.6, "order": 20, "primaryKey": "h3_cell",
    "style": { "fillColor": "#f46d43", "strokeColor": "#ffffff", "strokeWidth": 0.2, "fillOpacity": 0.6 } },
  { "id": "parcels_value", "name": "Assessed Value / SF", "url": "https://cdn.example.com/tn_parcels_value.geoparquet",
    "type": "geoparquet", "opacity": 0.5, "order": 30, "primaryKey": "apn",
    "style": { "fillColor": "#fd8d3c", "strokeColor": "#333333", "strokeWidth": 0.4, "fillOpacity": 0.5 } },
  { "id": "trade_rings", "name": "5-10-15 Min Drive", "url": "https://cdn.example.com/tn_trade_area_rings.geoparquet",
    "type": "geoparquet", "opacity": 0.85, "order": 40, "primaryKey": "id",
    "style": { "strokeColor": "#d73027", "strokeWidth": 2, "fillOpacity": 0 } },
  { "id": "retail_tenants", "name": "Retail Tenants", "url": "https://cdn.example.com/tn_retail_tenants.geoparquet",
    "type": "geoparquet", "opacity": 1.0, "order": 50, "primaryKey": "id",
    "style": { "circleRadius": 5, "fillColor": "#1f78b4", "strokeColor": "#ffffff", "strokeWidth": 1, "fillOpacity": 1 } }
]
```

All five layers are `geoparquet`, so all five are highlightable and can back dashboard widgets.

Expected result: opening the host page shows the basemap, income choropleth, cap-rate H3 layer, parcels, isochrone rings, and tenant points, each styled and at the stated opacity; the histogram and bar widgets render values.

### Recipe 2 — Owner Portfolio + Parcel Value Map

Goal: overlay parcel polygons colored by assessed value per sqft, with a category filter for top owners and a side-panel table.

```typescript
// Host-side filter: highlight all parcels owned by the selected entity.
// parcels_value is a geoparquet layer, so it IS highlightable.
async function highlightOwner(owner: string) {
  const n = localCache.countWhere("parcels_value", { owner_normalized: owner });
  if (n === 0) { showEmptyState(); return; }   // an empty match is rejected, not a clear
  await sendWithAck("highlightFeature", {
    layerId: "parcels_value",
    filter: { owner_normalized: owner },
    fit: true
  });
}

// Clearing is a separate message shape: layerId alone.
const clearOwner = () => send("highlightFeature", { layerId: "parcels_value" });
```

Widget binding in `.geolibre.json` — "parcels owned" is a single number, so it is a **host-page HTML element**, not a widget:

```json
{
  "widgets": [
    {
      "id": "parcels_by_owner",
      "type": "bar",
      "layerId": "parcels_value",
      "category": "owner_normalized",
      "aggregation": "count",
      "valueField": "id",
      "title": "Parcels by Owner"
    },
    {
      "id": "value_per_sqft_hist",
      "type": "histogram",
      "layerId": "parcels_value",
      "field": "value_per_sqft",
      "bins": 16,
      "title": "Value / SF Distribution"
    }
  ]
}
```

```html
<!-- Single-number KPI: host page, computed from your own cache. -->
<div class="kpi"><span class="kpi-label">Parcels owned</span><span id="kpi-parcels">—</span></div>
```

Expected result: selecting an owner highlights only that owner's parcels, the host KPI element updates from the local cache, and clicking a parcel emits `selectionChanged` to populate the panel.

### Recipe 3 — Brand Footprint + Void Analysis Dashboard

Goal: show competitor points and a void polygon layer where the target brand is absent within a 1-mile radius.

```python
# Synthetic data prep (run in cre-tenant-footprints; shown here for context)
import geopandas as gpd
competitors = gpd.read_parquet("data/tn_retail_tenants.geoparquet")
voids = gpd.read_parquet("data/tn_grocery_voids.geoparquet")  # hand off to cre-tenant-footprints
```

`.geolibre.json` layer order (draw order = array order):

```json
{
  "layers": [
    { "id": "tracts_income", "name": "Median Household Income", "type": "geoparquet",
      "source": { "url": "https://cdn.example.com/tn_tracts_income.geoparquet" },
      "visible": true, "opacity": 0.45,
      "style": { "fillColor": "#238b45", "strokeColor": "#1a1a1a", "strokeWidth": 0.3, "fillOpacity": 0.45 },
      "metadata": { "synthetic": true } },
    { "id": "grocery_voids", "name": "Grocery Void Areas", "type": "geoparquet",
      "source": { "url": "https://cdn.example.com/tn_grocery_voids.geoparquet" },
      "visible": true, "opacity": 0.35,
      "style": { "fillColor": "#9e9ac8", "strokeColor": "#54278f", "strokeWidth": 0.6, "fillOpacity": 0.35 },
      "metadata": { "synthetic": true } },
    { "id": "grocery_competitors", "name": "Grocery Competitors", "type": "geoparquet",
      "source": { "url": "https://cdn.example.com/tn_retail_tenants.geoparquet" },
      "visible": true, "opacity": 1,
      "style": { "circleRadius": 5, "fillColor": "#e31a1c", "strokeColor": "#ffffff", "strokeWidth": 1, "fillOpacity": 1 },
      "metadata": { "synthetic": true } }
  ]
}
```

Expected result: void polygons sit beneath competitor points; a `pie` widget on `grocery_competitors.category` shows the competitor mix, and "Void area (sq mi)" appears as a host-page number.

### Recipe 4 — Story-Map Cap-Rate Cycle

Goal: narrate the 2022–2026 rate cycle with chapters that fly the camera and fade layers in and out.

```json
{
  "storymap": {
    "title": "Tennessee Retail Cap-Rate Cycle",
    "subtitle": "Synthetic data, 2022–2026",
    "theme": "dark",
    "showMarkers": true,
    "markerColor": "#3fb1ce",
    "chapters": [
      {
        "id": "ch-2022q1",
        "title": "Compression",
        "description": "Cap rates fell alongside record-low Treasury yields.",
        "alignment": "left",
        "hidden": false,
        "location": { "center": [-86.78, 36.16], "zoom": 10, "pitch": 0, "bearing": 0 },
        "mapAnimation": "flyTo",
        "rotateAnimation": false,
        "onChapterEnter": [
          { "layerId": "h3_caprate", "opacity": 0.7, "duration": 1200 },
          { "layerId": "tracts_income", "opacity": 0.45, "duration": 1200 }
        ],
        "onChapterExit": [
          { "layerId": "h3_caprate", "opacity": 0.2, "duration": 600 }
        ]
      },
      {
        "id": "ch-2023q3",
        "title": "Repricing",
        "description": "Rising rates pushed cap rates wider.",
        "alignment": "left",
        "location": { "center": [-86.78, 36.16], "zoom": 9, "pitch": 35, "bearing": 15 },
        "mapAnimation": "easeTo",
        "onChapterEnter": [
          { "layerId": "parcels_value", "opacity": 0.5, "duration": 1500 }
        ],
        "onChapterExit": [
          { "layerId": "parcels_value", "opacity": 0, "duration": 600 }
        ]
      }
    ]
  }
}
```

GeoLibre drives these chapters itself on scroll — the host app does not need to send `setView`. If you *do* want host-driven chapters (e.g. chapter buttons in your own UI):

```typescript
function goToChapter(ch: StoryChapter) {
  // setView takes EITHER {bbox} OR the camera form — not both.
  send("setView", { ...ch.location, duration: 1200 });
}
```

Time periods are **not** a chapter key. To show a specific quarter, pre-filter the data per period in your pipeline and either give each period its own layer (faded via `onChapterEnter`) or regenerate the project and `loadProject`.

Expected result: scrolling the story flies the camera and fades layers in/out per chapter.

## Verification

1. **CORS + range check** on every data URL:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -H "Range: bytes=0-99" "https://cdn.example.com/data.geoparquet"
   ```
   Expected: `206`.

2. **Schema sanity** — no invalid layer types, widget types, or aggregations:
   ```bash
   python - <<'PY'
   import json
   p = json.load(open('dist/tn-retail-explorer.geolibre.json'))
   ok_types = {"geojson","xyz","wms","raster","vector-tiles","mbtiles","arcgis","pmtiles","cog",
               "flatgeobuf","zarr","lidar","gaussian-splat","geoparquet","duckdb-query","3d-tiles"}
   ids = [l["id"] for l in p["layers"]]
   assert len(ids) == len(set(ids)), "duplicate layer ids"
   assert all(l["type"] in ok_types for l in p["layers"]), "invalid layer type"
   assert all(set(l["style"]) and "paint" not in l["style"] for l in p["layers"]), "MapLibre paint leaked in"
   for w in p.get("widgets", []):
       assert w["type"] in {"histogram","scatter","bar","line","box","pie"}, w
       assert w.get("aggregation") in {None,"count","sum","mean"}, w
   print("layers:", len(ids), "widgets:", len(p.get("widgets", [])))
   PY
   ```
   Expected: prints counts, no assertion errors.

3. **Optional TypeScript gate** (owned by `geolibre-embed-app`):
   ```bash
   node -e "const{parseProject}=require('@geolibre/core');parseProject(require('fs').readFileSync('dist/tn-retail-explorer.geolibre.json','utf8'));console.log('ok')"
   ```

4. **Load in hosted GeoLibre**:
   ```bash
   echo "https://web.geolibre.app/?url=https://cdn.example.com/tn-retail-explorer.geolibre.json&layout=compact&panels=none&welcome=0"
   ```
   Expected: map renders, legend appears, widgets show values.

5. **postMessage lifecycle** (self-hosted only):
   - Confirm messages in order: `ready` → `ack` for `loadProject` → `projectLoaded`.
   - Confirm every inbound message has `source: "geolibre"`.
   - Click a parcel; confirm `selectionChanged` with `layerId` and `featureIds`.
   - Click a host-panel row; confirm `setView` + `highlightFeature` and that the map moves.
   - Send a filter that matches nothing; confirm `ack {ok:false}` and that your UI shows an empty state rather than assuming the highlight cleared.

6. **Visual layer-order spot checks**:
   - Choropleth polygons do not obscure point layers or isochrone rings.
   - Story-map chapters animate without jump cuts and layers fade per `onChapterEnter`.
   - Highlight works on every `geoparquet` layer; confirm no UI affordance offers highlight on a `pmtiles` layer.

## References

- `references/layer-ordering-and-z-index.md` — bottom-to-top layer stack for CRE maps and opacity rules.
- `references/filter-state-propagation.md` — decision tree for `highlightFeature` vs. regenerating `loadProject`.
- `references/widget-binding-and-kpi.md` — verified widget types/keys and how to render single-number KPIs on the host page.
- `references/story-map-chapters.md` — verified story-map and chapter schema, animations, and layer fades.
- `references/selection-sync.md` — two-way `selectionChanged` handling and side-panel state discipline.
- `references/project-format-cheatsheet.md` — verified `.geolibre.json` schema subset with CRE examples.
- `references/sibling-handoffs.md` — composition boundaries: which job belongs to which sibling skill.
- Hosting/CORS is owned by `cre-data-pipeline` — see that skill.

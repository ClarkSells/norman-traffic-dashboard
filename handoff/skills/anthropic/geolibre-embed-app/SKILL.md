---
name: "geolibre-embed-app"
description: "Use when embedding GeoLibre in a custom CRE web app via iframe, wiring postMessage two-way sync, self-hosting the Docker image, generating `.geolibre.json` programmatically, or verifying CORS/range headers for remote GeoParquet/PMTiles/COG. Trigger phrases: \"embed GeoLibre\", \"self-host GeoLibre iframe\", \"postMessage lifecycle\", \"generate .geolibre.json\", \"CORS range requests GeoParquet\"."
---

# GeoLibre Embedded App

## Local assets

This skill's reference docs and runnable templates live on disk at:
`C:\Users\Clark\Downloads\GeoLibre\kimi-output\skills\geolibre-embed-app\`
 - `references/` — deep detail (read the specific file named in the References section below)
 - `templates/` — runnable Python/TypeScript/JSON starting points

Read those files directly with the Read tool when a workflow step references them.
Companion skills: `geolibre-embed-app`, `cre-data-pipeline`, `cre-visualizer-builder`,
`cre-parcels-assessor`, `cre-comps-listings`, `cre-demographics-mobility`,
`cre-tenant-footprints`, `cre-market-caprates`.
Authoritative GeoLibre schema reference: `C:\Users\Clark\Downloads\GeoLibre\kimi-pack\07-verified-project-format.md`

Schema, embed API, and URL parameters below are verified against https://geolibre.app/project-format/ and https://geolibre.app/user-guide/embedding/ (2026-07-31).

## When to use

- You need a custom web app that embeds GeoLibre in an `<iframe>` and drives the map with URL parameters or postMessage commands.
- You must self-host GeoLibre to enable two-way `postMessage` (`loadProject`, `highlightFeature`, `selectionChanged`, etc.) with origin filtering.
- You are producing `.geolibre.json` project files programmatically from Python data pipelines or TypeScript (`@geolibre/core`) and need the exact JSON shape.
- You are configuring static hosting (S3/R2/nginx) so remote GeoParquet, PMTiles, and COG files stream correctly.

When **NOT** to use:

- Source-specific data cleaning, comp normalization, or market analytics → hand off to `cre-comps-listings`, `cre-market-caprates`, or sibling integration skills.
- Multi-layer app assembly, story maps, dashboard widgets, or final UX → hand off to `cre-visualizer-builder`.
- Generic format conversion (GeoParquet/PMTiles/COG) or tiling thresholds → hand off to `cre-data-pipeline`.

## Prerequisites

| Item | Cost | Notes |
|---|---|---|
| GeoLibre Web hosted: `https://web.geolibre.app` | FREE | Static PWA, no accounts. Read-only URL-param embeds only; postMessage needs an embed-origin allowlist that the public instance does not set. |
| GeoLibre Docker image `ghcr.io/opengeos/geolibre:latest` | FREE software; PAID hosting | Self-host on any Docker runtime. Enables `GEOLIBRE_EMBED_ORIGINS`. |
| Domain/host for the parent app | PAID or FREE | Must be HTTPS in production for `postMessage` origin security. |
| Object storage for data + project JSON | FREEMIUM/PAID | S3, Cloudflare R2, GCS, Azure. GitHub Pages is FREE but demo-only (no custom CORS, range support not guaranteed). |
| Python ≥3.11 + `geolibre` package | FREE | `pip install geolibre` (v1.6.0 as of 2026-07-29) for prototyping `.geolibre.json`. |
| npm `@geolibre/core` | FREE | Exports `createEmptyProject`, `parseProject`, `serializeProject`. **Preferred way to build/validate project JSON in TypeScript.** The app itself is *not* an importable component — embedding is still iframe + postMessage. |
| Node/TypeScript toolchain for the host app | FREE | For the embed harness templates. |

## Key behavioral constraint: highlight only works on GeoJSON-backed layers

`highlightFeature` addresses features GeoLibre holds **as GeoJSON in memory**. Features that live only inside a tile source cannot be highlighted, so **PMTiles and `vector-tiles` layers are not highlightable**. `geoparquet` layers *are* imported to GeoJSON via DuckDB-WASM, so they **can** be highlighted.

Design consequence: if your app needs click-to-highlight or panel→map selection sync on a layer, publish that layer as **`geoparquet` (or `geojson`), not `pmtiles`** — even when tiles would be cheaper. Reserve PMTiles for pure display basemap-style context. Hand tile-format decisions to `cre-data-pipeline` with this requirement stated up front.

## Workflow

1. **Choose hosted vs. self-hosted.**
   - Read-only embed with `?url=<data-url>` → use `https://web.geolibre.app/?maponly&welcome=0&url=<encoded-url>` (FREE).
   - Two-way `postMessage` or an origin allowlist → self-host Docker (step 2).

2. **Run self-hosted GeoLibre locally.**
   ```bash
   docker pull ghcr.io/opengeos/geolibre:latest
   docker run -d \
     --name geolibre \
     -p 8080:80 \
     -e GEOLIBRE_EMBED_ORIGINS="https://localhost:5173,https://cre.example.com" \
     ghcr.io/opengeos/geolibre:latest
   ```
   Entries are origins (`scheme://host[:port]`); `*` allows any origin and is for private networks only. The allowlist is enforced in both directions and also narrows the `?embed=1` Python-package bridge.
   Expected result: `curl -I http://localhost:8080` returns HTTP 200.

   For a static build instead of Docker, bake the allowlist at build time:
   ```bash
   VITE_GEOLIBRE_EMBED_ORIGINS="https://cre.example.com" npm run build
   ```

3. **Put the container behind a reverse proxy for auth and TLS.**
   GeoLibre does not document any built-in Basic Auth environment variables. Do access control at the proxy:
   ```bash
   # Caddy: hash a password, then use it in the Caddyfile (see templates/Caddyfile)
   docker run --rm caddy:2 caddy hash-password --plaintext "$(openssl rand -base64 24)"
   ```
   ```caddyfile
   gis.example.com {
       basic_auth { admin $2a$14$<hash-from-above> }
       header Content-Security-Policy "frame-ancestors https://cre.example.com"
       reverse_proxy 127.0.0.1:8080
   }
   ```
   Expected result: `curl -u admin:<password> -I https://gis.example.com` returns HTTP 200; without credentials returns 401. `frame-ancestors` at the proxy is the recommended extra hardening on top of `GEOLIBRE_EMBED_ORIGINS`.

4. **Generate a `.geolibre.json` project.**
   - Python: `pip install "geolibre>=1.6.0" geopandas` then `python templates/python-generate-project.py`.
   - TypeScript: `npm i @geolibre/core` then build with `createEmptyProject()` / validate with `parseProject()` / write with `serializeProject()` (Recipe 5).
   Expected result: `dist/retail-comps.geolibre.json` is written and is < 1 MB (URLs reference remote data, no inline GeoJSON).

5. **Host the project JSON and data files with CORS + range support.**
   - Upload `dist/retail-comps.geolibre.json`, `data/parcels.geoparquet`, and any PMTiles/COG to S3/R2.
   - Apply CORS policy from `templates/s3-cors.json` (S3) or `templates/r2-cors.json` (R2).
   - Verify with:
     ```bash
     curl -I -H "Origin: https://cre.example.com" \
       https://data.example.com/projects/retail-comps.geolibre.json
     ```
   Expected result: response headers include `Access-Control-Allow-Origin: https://cre.example.com` (or `*`), `Accept-Ranges: bytes`, and HEAD/GET return 200.

6. **Wire the host app iframe + postMessage harness.**
   - Copy `templates/typescript-embed-harness.ts` into your app.
   - Set `VITE_GEOLIBRE_ORIGIN=http://localhost:8080` and `VITE_GEOLIBRE_PROJECT_URL=<project-url>`.
   - **Wait for `ready` before sending anything — earlier messages are dropped, not queued.** `ready` re-fires whenever the iframe remounts, so treat it as idempotent (re-send `loadProject`, do not assume first-fire).
   - Filter every inbound message on `e.origin === geoOrigin`, `msg.v === 1`, **and `msg.source === "geolibre"`** (all app→host messages carry it).
   - Expected behavior: iframe loads, host receives `ready`, sends `loadProject`, receives `ack` then `projectLoaded`.

7. **Implement two-way selection sync.**
   - Map click in GeoLibre emits `selectionChanged {layerId, featureIds}` → host updates side panel.
   - Side-panel click calls `focusParcel(layerId, apn, bbox?)` → host sends `setView` + `highlightFeature`. `setView` accepts either `{bbox}` **or** `{center, zoom, bearing, pitch, duration}` — pick one form, do not mix.
   - Filter change that does not need new data → `highlightFeature {layerId, filter}` on a GeoJSON/GeoParquet layer. **A filter matching zero features is rejected (you get `ack {ok:false}`), not treated as a clear.** To clear a highlight, send `{layerId}` alone.
   - Filter change that needs new data → regenerate `.geolibre.json` and call `loadProject`.
   - Add a `requestId` to any host message to receive `ack {requestId, ok, error}`.

8. **Deploy production Docker with environment-driven origins.**
   ```bash
   GEOLIBRE_EMBED_ORIGINS="https://cre.example.com,https://app.cre.example.com"
   docker run -d \
     --name geolibre-prod \
     -e GEOLIBRE_EMBED_ORIGINS \
     -p 127.0.0.1:8080:80 \
     ghcr.io/opengeos/geolibre:latest
   # TLS + Basic Auth terminate at the reverse proxy (step 3), not in this container.
   ```
   Expected result: parent app at `https://cre.example.com` can drive the iframe; an unknown origin receives no `postMessage` events.

## Recipes

### Recipe 1: Minimal read-only embed with hosted GeoLibre

Use when you only need to display a map and do not require two-way sync.

```html
<iframe
  id="geolibre"
  width="100%"
  height="600"
  src="https://web.geolibre.app/?maponly&welcome=0&url=https%3A%2F%2Fdata.example.com%2Fprojects%2Fretail-comps.geolibre.json">
</iframe>
```

Expected result: the iframe renders the project; no `postMessage` commands are accepted.

### Recipe 2: Self-hosted iframe with postMessage project load

```typescript
import { initGeoLibreEmbed } from "./geolibre-embed";

const { send, focusParcel } = initGeoLibreEmbed({
  iframe: document.getElementById("geolibre") as HTMLIFrameElement,
  geoOrigin: "https://gis.example.com",
  projectUrl: "https://data.example.com/projects/retail-comps.geolibre.json",
  onSelection: (layerId, featureIds) => {
    console.log("Selected:", layerId, featureIds);
  },
});
```

See `templates/typescript-embed-harness.ts` for the full implementation (ready-gating, `source: "geolibre"` filtering, `requestId`/`ack` promises).

Expected result: `ready` arrives; the project loads; clicking a parcel logs the selected `featureIds`.

### Recipe 3: Generate `.geolibre.json` from synthetic CRE comps (Python)

```python
# templates/python-generate-project.py (excerpt)
from geolibre import Map

m = Map(center=[-86.78, 36.16], zoom=9)
m.add_geoparquet("https://data.example.com/data/tn_retail_comps.geoparquet")
project = m.to_project()
project["name"] = "Synthetic Tennessee Retail Cap-Rate Demo"

# Layers must match the verified shape exactly.
project["layers"][0].update({
    "id": "tn-retail-comps",
    "type": "geoparquet",                      # not "circle"/"fill" — that is MapLibre, not GeoLibre
    "source": {"url": "https://data.example.com/data/tn_retail_comps.geoparquet"},
    "visible": True,
    "opacity": 0.9,
    "style": {                                  # FLAT camelCase — no paint/fill-color/stops
        "circleRadius": 6,
        "fillColor": "#e6550d",
        "strokeColor": "#a63603",
        "strokeWidth": 1,
        "fillOpacity": 0.85,
    },
    "metadata": {"synthetic": True},
})
```

Expected result: a `dist/retail-comps.geolibre.json` whose `layers` reference external URLs, not inline GeoJSON.

### Recipe 4: Static-hosting CORS + range verification for S3

```bash
# 1. Apply CORS
aws s3api put-bucket-cors --bucket my-geolibre-data --cors-configuration file://templates/s3-cors.json

# 2. Upload with public-read (or via signed URLs / bucket policy)
aws s3 cp dist/retail-comps.geolibre.json s3://my-geolibre-data/projects/ --acl public-read
aws s3 cp data/parcels.geoparquet s3://my-geolibre-data/data/ --acl public-read

# 3. Verify CORS preflight + range
URL="https://my-geolibre-data.s3.amazonaws.com/data/parcels.geoparquet"
curl -I -H "Origin: https://cre.example.com" "$URL"
curl -I -H "Range: bytes=0-1023" "$URL"
```

Expected result: first response includes `Access-Control-Allow-Origin`; second returns HTTP 206 with `Content-Range`.

### Recipe 5: Build and validate a project in TypeScript with `@geolibre/core`

```bash
npm i @geolibre/core
```

```typescript
import { createEmptyProject, parseProject, serializeProject } from "@geolibre/core";
import { writeFileSync } from "node:fs";

const project = createEmptyProject();
project.name = "Synthetic TN Retail Comps";
project.mapView = { center: [-86.78, 36.16], zoom: 9, bearing: 0, pitch: 0 };
project.basemapStyleUrl = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
project.basemapVisible = true;
project.basemapOpacity = 1;
project.layers = [{
  id: "tn-retail-comps",
  name: "TN Retail Comps (Synthetic)",
  type: "geoparquet",                       // highlightable: imported as GeoJSON via DuckDB-WASM
  source: { url: "https://data.example.com/data/tn_retail_comps.geoparquet" },
  visible: true,
  opacity: 0.9,
  style: { circleRadius: 6, fillColor: "#e6550d", strokeColor: "#a63603", strokeWidth: 1, fillOpacity: 0.85 },
  metadata: { synthetic: true },
}];

// parseProject throws on a malformed project — use it as your CI gate.
const json = serializeProject(project);
parseProject(json);
writeFileSync("dist/retail-comps.geolibre.json", json);
```

Expected result: `dist/retail-comps.geolibre.json` round-trips through `parseProject` without throwing.

## Verification

1. **Container health**
   ```bash
   docker ps --filter name=geolibre
   curl -I http://localhost:8080
   ```
   Expected: container `Up`, HTTP 200.

2. **Origin filter + ack**
   ```javascript
   // Run in the parent page console AFTER the "ready" message has arrived.
   iframe.contentWindow.postMessage(
     { v: 1, type: "loadProject", requestId: "t1",
       payload: { url: "https://data.example.com/projects/retail-comps.geolibre.json" } },
     "http://localhost:8080"
   );
   ```
   Expected: if the parent origin is in `GEOLIBRE_EMBED_ORIGINS`, the host receives `ack {requestId:"t1", ok:true}` then `projectLoaded`; otherwise nothing arrives.

3. **Project validates**
   ```bash
   node -e "const {parseProject}=require('@geolibre/core');parseProject(require('fs').readFileSync('dist/retail-comps.geolibre.json','utf8'));console.log('ok')"
   ```
   Expected: prints `ok`.

4. **Range request on GeoParquet**
   ```bash
   curl -I -H "Range: bytes=0-65535" \
     https://my-geolibre-data.s3.amazonaws.com/data/parcels.geoparquet
   ```
   Expected: HTTP 206 and `Content-Range: bytes 0-65535/<total>`.

5. **Highlight reaches the right layers**
   Send `highlightFeature {layerId, filter}` against a `geoparquet` layer → highlight appears. Send the same against a `pmtiles` layer → no highlight (expected; convert that layer to GeoParquet if you need selection).

6. **Project JSON size check**
   ```bash
   ls -lh dist/retail-comps.geolibre.json
   ```
   Expected: < 1 MB if all data is referenced by URL.

7. **Synthetic-data rule**
   Confirm no real APNs, addresses, prices, or tenant names appear in any template or recipe.

## References

- `references/embedding-api.md` — verified postMessage envelope, full message tables, behavior rules, URL parameters, and embed limits.
- `references/project-format-cheatsheet.md` — verified `.geolibre.json` schema, exact layer object, layer-type list, flat style keys, and CRE field mappings.
- `references/cors-configs.md` — copy-paste CORS/range configs for S3, R2, GCS, Azure, nginx, and Caddy.
- `references/hosted-vs-selfhosted.md` — decision matrix, Docker commands, reverse-proxy auth, and embed limits.

// Shared Playwright helpers: serve dashboard/, swap the Mapbox CDN script for the stub, collect console errors.
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, "..", "..");
export const SCRATCH = process.env.SCRATCH || "/tmp/claude-0/-home-user-norman-traffic-dashboard/c1d43623-6ea9-5bd1-bccb-e6575de2d71f/scratchpad/shots";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".geojson": "application/geo+json", ".png": "image/png" };

// gzip: true serves compressed bodies like GitHub Pages does (Content-Length is then the compressed size).
export function serve(port = 8765, { gzip = false } = {}) {
  const cache = new Map();
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0].split("#")[0]); if (p === "/") p = "/index.html";
    const file = join(root, p);
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    let body = readFileSync(file);
    const headers = { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" };
    if (gzip && /gzip/.test(req.headers["accept-encoding"] || "")) { if (!cache.has(file)) cache.set(file, gzipSync(body)); body = cache.get(file); headers["Content-Encoding"] = "gzip"; }
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise(r => srv.listen(port, () => r({ srv, url: `http://127.0.0.1:${port}/` })));
}

export async function stubMapbox(page) {
  const stub = readFileSync(join(here, "mapbox_stub.js"), "utf8");
  await page.route(/api\.mapbox\.com\/mapbox-gl-js\/.*mapbox-gl\.js/, r => r.fulfill({ status: 200, contentType: "text/javascript", body: stub }));
  await page.route(/api\.mapbox\.com\/mapbox-gl-js\/.*mapbox-gl\.css/, r => r.fulfill({ status: 200, contentType: "text/css", body: ".mapboxgl-map{overflow:hidden;position:relative}.mapboxgl-canvas{position:absolute;left:0;top:0}.mapboxgl-popup-content{position:relative;background:#fff;pointer-events:auto}.mapboxgl-popup-close-button{position:absolute;right:0;top:0;border:0;background:none;cursor:pointer}.mapboxgl-ctrl-icon{display:block;width:100%;height:100%}" }));
  await page.route(/api\.mapbox\.com\/(?!mapbox-gl-js)/, r => r.abort());
}

export function watchConsole(page) {
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function waitForLayers(page, timeout = 15000) {
  await page.waitForFunction(() => { const m = window.__stubMaps && window.__stubMaps[0]; return m && m.getLayer("segments-line") && document.getElementById("loading").hidden; }, null, { timeout });
}

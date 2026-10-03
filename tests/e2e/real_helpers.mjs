// Helpers for the real-renderer harness (tests/e2e/real.mjs).
// Pure and browser-free: frame statistics, the viewport table, Playwright context options,
// the report shape, and a tiny static server with gzip for the repo root. No new dependencies.
import { createServer } from "node:http";
import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";

export const here = dirname(fileURLToPath(import.meta.url));
export const root = join(here, "..", "..");

// A frame slower than 20 fps counts as long (dropped work the reader can feel).
export const LONG_FRAME_MS = 50;

const round1 = (n) => Math.round(n * 10) / 10;

export function median(values) {
  if (!values || values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// frames: array of per-frame milliseconds from the requestAnimationFrame probe.
export function frameStats(frames, { longFrameMs = LONG_FRAME_MS } = {}) {
  const list = (frames || []).filter((f) => Number.isFinite(f) && f >= 0);
  if (list.length === 0) return { frames: 0, maxFrameMs: 0, medianFrameMs: 0, longFrames: 0 };
  return {
    frames: list.length,
    maxFrameMs: round1(Math.max(...list)),
    medianFrameMs: round1(median(list)),
    longFrames: list.filter((f) => f > longFrameMs).length,
  };
}

// The per-transition record the report contract fixes: { scene, maxFrameMs, medianFrameMs, longFrames }.
export function transitionRecord(scene, frames, opts) {
  const { frames: _count, ...stats } = frameStats(frames, opts);
  return { scene, ...stats };
}

// The three contracted viewports. `name` is the screenshot folder under qa/real/.
export const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, mobile: false },
  { name: "390x844", width: 390, height: 844, mobile: true, deviceScaleFactor: 3, hasTouch: true },
];

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// Playwright browser-context options for one viewport row. Desktop stays a plain viewport;
// mobile adds device emulation (touch, mobile UA, retina scale) so Mapbox picks touch handlers.
export function contextOptions(vp) {
  const base = { viewport: { width: vp.width, height: vp.height } };
  if (!vp.mobile) return base;
  return { ...base, isMobile: true, hasTouch: vp.hasTouch !== false, deviceScaleFactor: vp.deviceScaleFactor || 2, userAgent: MOBILE_UA };
}

// One viewport's slice of qa/real/report.json. Fields fill in as the run progresses.
export function emptyViewportReport(name) {
  return { viewport: name, load: null, transitions: [], explore: [], consoleErrors: [], bytesTransferred: 0, screenshots: [] };
}

export function buildReport({ mode = "full", sceneCount = 0, nextSceneSelector = "" } = {}) {
  return { version: 1, generatedAt: new Date().toISOString(), mode, sceneCount, nextSceneSelector, viewports: {} };
}

// --- Static server ---------------------------------------------------------
// Serves the repo root with gzip (like GitHub Pages), so transfer sizes and decode costs
// match the hosted dashboard. Ephemeral port by default; the caller gets the real URL back.
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export function serve(port = 0, { gzip = true } = {}) {
  const rootNorm = normalize(root);
  const cache = new Map();
  const srv = createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
    if (p === "/") p = "/index.html";
    const file = normalize(join(root, p));
    if (!file.startsWith(rootNorm) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404); res.end("not found"); return;
    }
    let body = readFileSync(file);
    const headers = { "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" };
    if (gzip && /gzip/.test(req.headers["accept-encoding"] || "")) {
      if (!cache.has(file)) cache.set(file, gzipSync(body));
      body = cache.get(file);
      headers["Content-Encoding"] = "gzip";
    }
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers);
    res.end(body);
  });
  return new Promise((resolve) => srv.listen(port, "127.0.0.1", () => {
    const actual = srv.address().port;
    resolve({ srv, port: actual, url: `http://127.0.0.1:${actual}/` });
  }));
}

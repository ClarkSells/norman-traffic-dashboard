// Throttled load timing: node tests/e2e/perf.mjs
// Chrome DevTools "Slow 4G" profile (1.6 Mbps down, 750 kbps up, 150 ms RTT) through the CDP, with and without gzip.
// Measures time to first map paint (the style's load event, which the stub fires once its canvas is ready) and time to
// layers (segments-line present and the loading card hidden). mapbox-gl.js itself is a small stub here, so the real
// library download and tile fetches are not in these numbers.
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");
import { serve, stubMapbox } from "./harness.js";

const SLOW4G = { offline: false, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8, latency: 150 };

async function run(gzip, mobile) {
  const { srv, url } = await serve(8767 + (gzip ? 1 : 0), { gzip });
  const browser = await chromium.launch();
  const ctx = await browser.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await stubMapbox(page);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", SLOW4G);
  await page.addInitScript(() => { window.__t0 = performance.now(); window.__marks = {}; const tick = () => { const m = window.__stubMaps && window.__stubMaps[0]; if (m && !window.__marks.firstPaint && m.loaded()) window.__marks.firstPaint = performance.now(); if (m && !window.__marks.layers && m.getLayer("segments-line") && document.getElementById("loading") && document.getElementById("loading").hidden) window.__marks.layers = performance.now(); if (!window.__marks.layers) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const t0 = Date.now();
  await page.goto(url);
  await page.waitForFunction(() => window.__marks && window.__marks.layers, null, { timeout: 120000 });
  const marks = await page.evaluate(() => window.__marks);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { domContentLoaded: n.domContentLoadedEventEnd, bytes: performance.getEntriesByType("resource").filter(r => r.name.includes("/data/")).reduce((a, r) => a + (r.encodedBodySize || 0), 0) }; });
  await browser.close(); srv.close();
  return { gzip, mobile, firstPaintMs: Math.round(marks.firstPaint), layersMs: Math.round(marks.layers), dataBytesOnWire: nav.bytes, wallMs: Date.now() - t0 };
}

const results = [];
for (const [gzip, mobile] of [[false, false], [true, false], [true, true]]) results.push(await run(gzip, mobile));
console.table(results);
console.log(JSON.stringify(results));

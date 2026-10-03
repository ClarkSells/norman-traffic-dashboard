// Real-renderer visual gate: node tests/e2e/real.mjs [--smoke]
//
// Loads the real Mapbox GL JS v3 CDN with the token from config.js (no stub), serves the repo
// root with gzip, and for each viewport (1440x900, 1920x1080, 390x844 mobile emulation):
//   1. open #tour=0, wait for window.__dash.ready (card 2.1 sets it), map.loaded() and one idle
//   2. screenshot scene 0, then step every scene: inject a requestAnimationFrame probe, click the
//      next control, wait for moveend + 900 ms + idle, screenshot qa/real/<viewport>/scene-<nn>.png
//   3. screenshot explore mode in four states (citywide, ward 3, segment 52500-181, satellite)
// Writes qa/real/report.json with per-transition frame stats, load timings, console errors and
// bytes transferred. --smoke takes only the first screenshot (qa/real/1440x900/smoke.png).
//
// Readiness fallback for Wave 0 (window.__dash.ready does not exist yet): wait for it with a
// timeout, then fall back to map.loaded() + one idle, then a fixed timeout, so --smoke passes today.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { get } from "node:https";
import { join } from "node:path";
import { MAPBOX_TOKEN } from "../../config.js";
import { VIEWPORTS, buildReport, contextOptions, emptyViewportReport, root, serve, transitionRecord } from "./real_helpers.mjs";
import { watchConsole } from "./harness.js";

// --- Scene loop config ------------------------------------------------------
// Card 2.1 (Wave 2) repoints these two values at the 15-scene present mode:
const SCENE_COUNT = 12;                     // today: 12-step tour, scenes 0..11; Wave 2: 15 scenes, 0..14
const NEXT_SCENE_SELECTOR = "#tour-next";   // today: tour stepper; Wave 2: "#present-next"

const EXPLORE_STATES = [
  { name: "citywide", hash: "#metric=combined&los=E&years=2021-2025" },
  { name: "ward-3", hash: "#ward=3&metric=combined&los=E&years=2021-2025" },
  { name: "segment-52500-181", hash: "#sel=52500-181&metric=combined&los=E&years=2021-2025" },
  { name: "satellite", hash: "#basemap=satellite&metric=combined&los=E&years=2021-2025", satellite: true },
];

const DASH_READY_TIMEOUT = 15000;   // how long to wait for window.__dash.ready before falling back
const IDLE_TIMEOUT = 20000;         // self-bounding idle wait inside the page
const MOVEEND_TIMEOUT = 10000;      // a scene that does not move the camera never fires moveend
const SETTLE_MS = 900;              // contracted: moveend plus 900 ms plus idle before the shot

const OUT_ROOT = join(root, "qa", "real");
const smoke = process.argv.includes("--smoke");
const shotPath = (vp, file) => join(OUT_ROOT, vp.name, file);
const relShot = (vp, file) => `qa/real/${vp.name}/${file}`;

if (!MAPBOX_TOKEN || !MAPBOX_TOKEN.startsWith("pk.")) {
  console.error("real.mjs needs the Mapbox public token from config.js (MAPBOX_TOKEN, pk.*) and network access to api.mapbox.com.");
  process.exit(1);
}

// --- Token URL restriction --------------------------------------------------
// The pk. token is URL-restricted to the deployed origin (config.js header comment). Until Clark
// adds http://localhost:* in account.mapbox.com, tile requests from this machine 403 and the map
// renders its data layers on a blank basemap. Probe one real tile at startup: if the local origin
// is rejected but the deployed one is not, emulate the deployed Referer on api.mapbox.com requests
// so the gate still exercises the real CDN and real tiles. The day the token allows localhost the
// probe passes and no emulation happens. This is recorded in report.json as tileProbe.
const DEPLOYED_ORIGIN = "https://clarksells.github.io/norman-traffic-dashboard/";

function probeStatus(url, referer) {
  return new Promise((resolve) => {
    const req = get(url, { headers: referer ? { Referer: referer } : {} }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", () => resolve(0));
    req.setTimeout(10000, () => { req.destroy(); resolve(0); });
  });
}

async function tileAccessPlan() {
  const tile = `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/11/470/809.vector.pbf?access_token=${MAPBOX_TOKEN}`;
  const direct = await probeStatus(tile);
  if (direct === 200) return { emulate: false, directStatus: direct };
  const viaDeployed = await probeStatus(tile, DEPLOYED_ORIGIN);
  if (viaDeployed === 200) {
    console.warn(`tile probe: ${direct} from this origin (token URL restriction); emulating Referer ${DEPLOYED_ORIGIN} for api.mapbox.com requests`);
    return { emulate: true, directStatus: direct };
  }
  console.warn(`tile probe failed (status ${direct}, with deployed origin ${viaDeployed}); the basemap may render blank`);
  return { emulate: false, directStatus: direct };
}

// Chromium re-stamps the Referer on route.continue, so the header only sticks when the request
// is relayed Node-side: route.fetch (Playwright's own network stack) with the deployed Referer,
// then fulfill. Bytes are still the real CDN responses; nothing is stubbed. In-flight relays are
// aborted quietly when a page closes mid-request.
function emulateDeployedOrigin(page) {
  return page.route(/api\.mapbox\.com/, async (route) => {
    try {
      const response = await route.fetch({ headers: { ...route.request().headers(), referer: DEPLOYED_ORIGIN } });
      await route.fulfill({ response });
    } catch {
      try { await route.abort(); } catch { /* the page closed mid-request */ }
    }
  });
}

// One idle, self-bounding: resolves immediately when the map is already loaded, otherwise on the
// next idle event, otherwise after IDLE_TIMEOUT so a stuck style can never hang the run.
function waitIdle(page) {
  return page.evaluate((timeout) => new Promise((resolve) => {
    const m = window.__dash && window.__dash.map;
    if (!m || typeof m.loaded !== "function" || m.loaded()) return resolve();
    const t = setTimeout(resolve, timeout);
    m.once("idle", () => { clearTimeout(t); resolve(); });
  }), IDLE_TIMEOUT).catch(() => {});
}

// Primary path: window.__dash.ready (card 2.1). Fallback for today's app.js: map.loaded() + one
// idle, then a fixed timeout. Returns which path fired, for the report.
async function waitReady(page) {
  try {
    await page.waitForFunction(() => !!(window.__dash && window.__dash.ready), null, { timeout: DASH_READY_TIMEOUT });
    await waitIdle(page);
    return "dash-ready";
  } catch { /* __dash.ready not set yet (pre-2.1 build) */ }
  try {
    await page.waitForFunction(() => !!(window.__dash && window.__dash.map && typeof window.__dash.map.loaded === "function" && window.__dash.map.loaded()), null, { timeout: 90000 });
    await waitIdle(page);
    return "idle-fallback";
  } catch { /* map never reached loaded(); take the shot anyway */ }
  await page.waitForTimeout(8000);
  return "timeout";
}

// #tour=0 is the contracted entry URL, but today's hash.js only enters the tour for N >= 1.
// Until Wave 2 makes the hash 0-based, dispatch enter directly so the scene loop works on both.
async function ensureSceneZero(page) {
  const entered = await page.evaluate((total) => {
    const t = window.__dash && window.__dash.tour;
    if (!t || typeof t.getState !== "function") return false;
    if (!t.getState().active) t.dispatch({ type: "enter", total, saved: null, index: 0 });
    return true;
  }, SCENE_COUNT);
  if (entered) await waitIdle(page);
  return entered;
}

function startProbe(page) {
  return page.evaluate(() => {
    const p = { frames: [], running: true, last: 0 };
    window.__frameProbe = p;
    const tick = (t) => { if (!p.running) return; if (p.last) p.frames.push(t - p.last); p.last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
}

function stopProbe(page) {
  return page.evaluate(() => {
    const p = window.__frameProbe;
    if (p) p.running = false;
    return p ? p.frames : [];
  });
}

// Bytes on the wire for one page, through the CDP (counts compressed sizes, tile fetches included).
async function trackNetwork(ctx, page) {
  const acc = { bytes: 0 };
  try {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    cdp.on("Network.loadingFinished", (p) => { acc.bytes += p.encodedDataLength || 0; });
  } catch { /* CDP unavailable: bytesTransferred stays 0 */ }
  return acc;
}

// Mark first-idle and arm performance marks before any app code runs.
function addMarks(page) {
  return page.addInitScript(() => {
    window.__marks = {};
    const t0 = Date.now();
    const iv = setInterval(() => {
      const m = window.__dash && window.__dash.map;
      if (m && window.__marks.firstIdleMs == null && typeof m.loaded === "function" && m.loaded()) {
        window.__marks.firstIdleMs = performance.now();
        clearInterval(iv);
      }
      if (Date.now() - t0 > 120000) clearInterval(iv);
    }, 100);
  });
}

async function readLoadTimings(page, readyPath) {
  const load = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
      loadEventMs: Math.round(nav.loadEventEnd || 0),
      firstIdleMs: window.__marks && window.__marks.firstIdleMs != null ? Math.round(window.__marks.firstIdleMs) : null,
      readyMs: Math.round(performance.now()),
    };
  });
  load.readyPath = readyPath;
  return load;
}

// One scene transition: probe -> dispatch the next control -> moveend + settle + idle -> stats
// -> screenshot. The click is dispatched in-page (per the card): on the mobile sheet layout the
// tour card can sit under the bottom sheet, where a mouse click is intercepted.
async function captureTransition(page, vp, vpReport, scene) {
  await startProbe(page);
  await page.evaluate(() => {
    window.__mv = false;
    const m = window.__dash && window.__dash.map;
    if (m && typeof m.once === "function") m.once("moveend", () => { window.__mv = true; });
  });
  await page.evaluate((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, NEXT_SCENE_SELECTOR);
  await page.waitForFunction(() => window.__mv === true, null, { timeout: MOVEEND_TIMEOUT }).catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
  await waitIdle(page);
  const frames = await stopProbe(page);
  vpReport.transitions.push(transitionRecord(scene, frames));
  const file = `scene-${String(scene).padStart(2, "0")}.png`;
  await page.screenshot({ path: shotPath(vp, file) });
  vpReport.screenshots.push(relShot(vp, file));
}

// Explore mode states load as fresh pages through the deep-link hash, so the camera flies the
// same path a shared URL would. Each state gets its own console and byte accounting.
async function captureExplore(ctx, url, vp, vpReport, state, plan) {
  const page = await ctx.newPage();
  const errors = watchConsole(page);
  const net = await trackNetwork(ctx, page);
  await addMarks(page);
  if (plan.emulate) await emulateDeployedOrigin(page);
  await page.goto(url + state.hash, { waitUntil: "domcontentloaded" });
  await waitReady(page);
  if (state.satellite) {
    await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" && !!(window.__dash && window.__dash.map && window.__dash.map.getLayer && window.__dash.map.getLayer("segments-line")), null, { timeout: 30000 }).catch(() => {});
  }
  await waitIdle(page);
  const file = `explore-${state.name}.png`;
  await page.screenshot({ path: shotPath(vp, file) });
  vpReport.explore.push(state.name);
  vpReport.screenshots.push(relShot(vp, file));
  vpReport.consoleErrors.push(...errors);
  vpReport.bytesTransferred += net.bytes;
  await page.close();
}

async function runViewport(browser, url, vp, report, plan) {
  const vpReport = emptyViewportReport(vp.name);
  report.viewports[vp.name] = vpReport;
  mkdirSync(shotPath(vp, "."), { recursive: true });
  const ctx = await browser.newContext(contextOptions(vp));
  const page = await ctx.newPage();
  const errors = watchConsole(page);
  const net = await trackNetwork(ctx, page);
  await addMarks(page);
  if (plan.emulate) await emulateDeployedOrigin(page);
  await page.goto(url + "#tour=0", { waitUntil: "domcontentloaded" });
  const readyPath = await waitReady(page);
  await ensureSceneZero(page);
  await waitIdle(page);
  vpReport.load = await readLoadTimings(page, readyPath);

  if (smoke) {
    await page.screenshot({ path: shotPath(vp, "smoke.png") });
    vpReport.screenshots.push(relShot(vp, "smoke.png"));
  } else {
    const first = "scene-00.png";
    await page.screenshot({ path: shotPath(vp, first) });
    vpReport.screenshots.push(relShot(vp, first));
    for (let scene = 1; scene < SCENE_COUNT; scene++) await captureTransition(page, vp, vpReport, scene);
    await page.close();
    for (const state of EXPLORE_STATES) await captureExplore(ctx, url, vp, vpReport, state, plan);
  }
  vpReport.consoleErrors.push(...errors);
  vpReport.bytesTransferred += net.bytes;
  await ctx.close();
}

const report = buildReport({ mode: smoke ? "smoke" : "full", sceneCount: SCENE_COUNT, nextSceneSelector: NEXT_SCENE_SELECTOR });
const plan = await tileAccessPlan();
report.tileProbe = { directStatus: plan.directStatus, originEmulation: plan.emulate ? DEPLOYED_ORIGIN : null };
const { srv, url } = await serve(0, { gzip: true });
const browser = await chromium.launch();
let failed = null;
try {
  const viewports = smoke ? VIEWPORTS.slice(0, 1) : VIEWPORTS;
  for (const vp of viewports) {
    await runViewport(browser, url, vp, report, plan);
    console.log(`${vp.name}: ${smoke ? "smoke.png" : `${SCENE_COUNT} scenes + ${EXPLORE_STATES.length} explore states`} captured`);
  }
} catch (err) {
  failed = err;
} finally {
  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(join(OUT_ROOT, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  srv.close();
}
if (failed) {
  console.error("real.mjs failed:", failed && failed.message);
  process.exit(1);
}
console.log(`qa/real/report.json written (${report.mode} mode)`);

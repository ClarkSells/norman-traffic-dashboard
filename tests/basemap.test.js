// Card 1.2: layers/basemap.js rewrite. Run from the repo root: node tests/basemap.test.js
// Uses its own recording map double (not the e2e stub) per the card.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";

installFakeDocument();

const { STYLES } = await import("../config.js");
const {
  STYLE_FOR, configureStandard, switchBasemap, setLightPreset, slotFor,
  isStandardStyle, tuneBasemap,
} = await import("../layers/basemap.js");

const STANDARD = { name: "Mapbox Standard", imports: [{ id: "basemap", url: "mapbox://styles/mapbox/standard" }], layers: [] };
const SATELLITE = { name: "Mapbox Standard Satellite", imports: [{ id: "basemap", url: "mapbox://styles/mapbox/standard-satellite" }], layers: [] };
const CLASSIC = { name: "Mapbox Light", layers: [] }; // no imports: classic style

// Recording map double. Style swaps are driven by hand with map.fire("style.load") / map.fire("idle").
function makeMap({ style = STANDARD, snapshot = "data:image/jpeg;base64,SNAPSHOT" } = {}) {
  const calls = { config: [], styles: [], order: [] };
  const once = {};
  const container = document.createElement("div");
  const canvas = {
    parentNode: container,
    toDataURL: () => { calls.order.push("snapshot"); if (snapshot instanceof Error) throw snapshot; return snapshot; },
  };
  let current = style;
  return {
    calls, container, canvas,
    getStyle: () => current,
    setConfigProperty: (imp, k, v) => calls.config.push([imp, k, v]),
    getCanvas: () => canvas,
    getCanvasContainer: () => container,
    setStyle: (url) => { calls.order.push("setStyle"); calls.styles.push(url); current = /satellite/.test(String(url)) ? SATELLITE : STANDARD; },
    once: (ev, cb) => { (once[ev] ||= []).push(cb); },
    fire: (ev) => { const cbs = once[ev] || []; once[ev] = []; for (const cb of cbs) cb(); },
    pending: (ev) => (once[ev] || []).length,
  };
}
const configValue = (map, key) => { const hit = map.calls.config.filter(([, k]) => k === key); return hit.length ? hit[hit.length - 1][2] : undefined; };

// STYLE_FOR and slotFor tables (C.5)
assert.deepEqual(STYLE_FOR, { light: STYLES.standard, satellite: STYLES.satellite }, "STYLE_FOR maps state basemap names to style URLs");
assert.equal(slotFor("wards"), "bottom");
assert.equal(slotFor("heat"), "middle");
for (const kind of ["segments", "flow", "dots", "callouts", "points", "mask", "anything-else"]) assert.equal(slotFor(kind), "top", `slotFor(${kind})`);

// configureStandard on the Standard style: every design key, import id "basemap"
{
  const map = makeMap();
  configureStandard(map, { lightPreset: "dusk", presenting: true });
  assert.ok(map.calls.config.length >= 7, "one setConfigProperty per design key plus lightPreset");
  assert.ok(map.calls.config.every(([imp]) => imp === "basemap"), "all config goes to the basemap import");
  assert.equal(configValue(map, "showPointOfInterestLabels"), false);
  assert.equal(configValue(map, "showTransitLabels"), false);
  assert.equal(configValue(map, "showPlaceLabels"), true);
  assert.equal(configValue(map, "showRoadLabels"), true);
  assert.equal(configValue(map, "show3dObjects"), true);
  assert.equal(configValue(map, "theme"), "faded", "present mode uses the faded theme");
  assert.equal(configValue(map, "lightPreset"), "dusk", "lightPreset comes from the caller");
}
{
  const map = makeMap();
  configureStandard(map, { lightPreset: "day", presenting: false });
  assert.equal(configValue(map, "theme"), "default", "explore mode uses the default theme");
  assert.equal(configValue(map, "lightPreset"), "day");
}
{
  const map = makeMap({ style: CLASSIC });
  configureStandard(map, { lightPreset: "dusk", presenting: true });
  assert.equal(map.calls.config.length, 0, "no-op when getStyle().imports is missing");
  const bare = { getStyle: () => null, setConfigProperty: () => assert.fail("must not touch config without a style") };
  configureStandard(bare, { lightPreset: "day", presenting: false });
}

// setLightPreset
{
  const map = makeMap();
  setLightPreset(map, "night");
  assert.deepEqual(map.calls.config, [["basemap", "lightPreset", "night"]]);
  const classic = makeMap({ style: CLASSIC });
  setLightPreset(classic, "day");
  assert.equal(classic.calls.config.length, 0, "setLightPreset is a no-op on non Standard styles");
}

// switchBasemap: snapshot overlay, right URL, onReady once after style.load, 350 ms tween fade after idle
{
  const map = makeMap();
  const tweens = [];
  const fakeTween = (opts) => { tweens.push(opts); return () => {}; };
  let readyCalls = 0;
  const done = switchBasemap(map, "satellite", { lightPreset: "dusk", presenting: true, onReady: () => { readyCalls++; }, tween: fakeTween });
  assert.ok(done instanceof Promise, "switchBasemap resolves when the overlay has faded");

  // snapshot first, then setStyle with the STYLE_FOR URL
  assert.deepEqual(map.calls.order.slice(0, 2), ["snapshot", "setStyle"], "canvas captured before the style swap");
  assert.deepEqual(map.calls.styles, [STYLES.satellite]);
  const overlay = map.container.children[map.container.children.length - 1];
  assert.ok(overlay && overlay.tagName === "IMG", "overlay img added over the canvas");
  assert.equal(overlay.className, "style-crossfade");
  assert.equal(overlay.src, "data:image/jpeg;base64,SNAPSHOT");
  assert.equal(readyCalls, 0, "onReady waits for style.load");

  map.fire("style.load");
  assert.equal(readyCalls, 1, "onReady fires after style.load");
  map.fire("style.load");
  assert.equal(readyCalls, 1, "onReady fires exactly once");
  assert.equal(tweens.length, 0, "the fade waits for idle");

  map.fire("idle");
  assert.equal(tweens.length, 1, "one tween drives the fade");
  assert.equal(tweens[0].duration, 350, "350 ms crossfade");
  tweens[0].onUpdate(0.5);
  assert.equal(overlay.style.opacity, "0.5", "overlay fades out with the tween");
  assert.ok(map.container.children.includes(overlay), "overlay stays until the fade completes");
  tweens[0].onDone();
  assert.ok(!map.container.children.includes(overlay), "overlay removed after the fade");
  await done;

  // satellite target: theme/show3dObjects are unsupported there, lightPreset still applies
  assert.equal(configValue(map, "lightPreset"), "dusk");
  assert.equal(configValue(map, "theme"), undefined, "theme is not set on standard-satellite");
  assert.equal(configValue(map, "show3dObjects"), undefined, "show3dObjects is not set on standard-satellite");
  assert.equal(configValue(map, "showPointOfInterestLabels"), false, "label config still applies on satellite");
}
{
  // switching to a Standard target applies the full design config after style.load
  const map = makeMap({ style: SATELLITE });
  const p = switchBasemap(map, "light", { lightPreset: "dusk", presenting: true, onReady: () => {} });
  assert.deepEqual(map.calls.styles, [STYLES.standard]);
  map.fire("style.load");
  assert.equal(configValue(map, "theme"), "faded");
  assert.equal(configValue(map, "show3dObjects"), true);
  map.fire("idle");
  await p;
}
{
  // a blank snapshot (no preserveDrawingBuffer) must not break the switch
  const map = makeMap({ snapshot: new Error("tainted") });
  let readyCalls = 0;
  const p = switchBasemap(map, "satellite", { lightPreset: "day", presenting: false, onReady: () => { readyCalls++; } });
  assert.equal(map.container.children.length, 0, "no overlay when the snapshot fails");
  map.fire("style.load");
  assert.equal(readyCalls, 1);
  map.fire("idle");
  await p;
}

// 3.6-03: the promise must ALWAYS settle, and the 5 s idle-fallback timer must be cleared
{
  // idle path: the fallback timer is cleared once idle wins
  const map = makeMap();
  const timers = [];
  const cleared = [];
  const fakeSetTimeout = (cb, ms) => { const id = timers.length; timers.push({ cb, ms }); return id; };
  const fakeClearTimeout = (id) => cleared.push(id);
  const p = switchBasemap(map, "satellite", { lightPreset: "day", presenting: false, setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout });
  map.fire("style.load");
  assert.equal(timers.length, 1, "one fallback timer armed after style.load");
  assert.equal(timers[0].ms, 5000, "5 s idle fallback");
  map.fire("idle");
  assert.deepEqual(cleared, [0], "fallback timer cleared when idle wins");
  await p;
  timers[0].cb(); // stale fire must be a no-op (settled flag)
  await p;
}
{
  // fallback path: the timer fires before idle, and it still resolves + removes the overlay
  const map = makeMap();
  const timers = [];
  const cleared = [];
  const tweens = [];
  const fakeTween = (opts) => { tweens.push(opts); return () => {}; };
  const p = switchBasemap(map, "satellite", {
    lightPreset: "day", presenting: false, tween: fakeTween,
    setTimeout: (cb, ms) => { timers.push(cb); return timers.length - 1; },
    clearTimeout: (id) => cleared.push(id),
  });
  map.fire("style.load");
  timers[0](); // timer wins the race
  assert.equal(tweens.length, 1, "fallback drives the same fade");
  tweens[0].onDone();
  await p;
  map.fire("idle"); // late idle is a no-op
  await p;
}
{
  // setStyle throwing synchronously still resolves and removes the overlay (C.5: always settle)
  const map = makeMap();
  const boom = new Error("bad style url");
  map.setStyle = () => { throw boom; };
  let readyCalls = 0;
  const p = switchBasemap(map, "satellite", { lightPreset: "day", presenting: false, onReady: () => { readyCalls++; } });
  const settled = await Promise.race([p.then(() => "resolved"), new Promise((res) => setTimeout(() => res("hung"), 100))]);
  assert.equal(settled, "resolved", "switchBasemap resolves even when setStyle throws");
  assert.equal(map.container.children.length, 0, "overlay removed when setStyle throws");
  assert.equal(readyCalls, 0, "onReady does not fire without style.load");
}
{
  // an error event before style.load settles the promise too
  const map = makeMap();
  const p = switchBasemap(map, "satellite", { lightPreset: "day", presenting: false });
  map.fire("error");
  const settled = await Promise.race([p.then(() => "resolved"), new Promise((res) => setTimeout(() => res("hung"), 100))]);
  assert.equal(settled, "resolved", "switchBasemap resolves on map error before style.load");
  assert.equal(map.container.children.length, 0, "overlay removed on error");
}

// legacy exports kept for app.js and tests/layers.test.js until the lead rewires them
assert.equal(typeof isStandardStyle, "function");
assert.equal(typeof tuneBasemap, "function");
assert.ok(isStandardStyle(STANDARD));
assert.ok(!isStandardStyle(CLASSIC));
{
  const cfg = {};
  const standard = { getStyle: () => STANDARD, setConfigProperty: (i, k, v) => { cfg[k] = v; } };
  assert.equal(tuneBasemap(standard, "dark").mode, "standard");
  assert.equal(cfg.showPointOfInterestLabels, false);
  assert.equal(cfg.lightPreset, "night");
  assert.equal(tuneBasemap({ getStyle: () => null }).mode, "none");
}

console.log("basemap checks passed");

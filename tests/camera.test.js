// Run from the repo root: node tests/camera.test.js
// Camera choreography against a recording map double. No browser, no Mapbox.
import assert from "node:assert/strict";
import { bearingAcrossScreen } from "../geo.js";
import { aerial, dollyToSegment, drift, establish, fitWard, orbit, presentationPadding, stopMotion, zoomForLengthMi } from "../camera.js";

// Recording map double with a faithful flat projection (512 px mercator world like Mapbox GL JS
// v3, bearing rotation, cos(pitch) vertical compression) so tests can assert where the subject
// actually lands on screen. Every camera method appends to `calls` and applies the new camera.
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI;
const mercYinv = (y) => (Math.atan(Math.exp(y * Math.PI / 180)) * 2 - Math.PI / 2) * 180 / Math.PI;
function makeMap({ width = 1440, height = 900 } = {}) {
  const calls = [];
  const map = {
    calls, bearing: 0, pitch: 0, zoom: 10, center: [-97.44, 35.22], width, height, _once: {},
    getCanvas() { return { clientWidth: width, clientHeight: height }; },
    project(ll) {
      const s = 512 * Math.pow(2, map.zoom) / 360;
      const dx = (ll[0] - map.center[0]) * s, dy = -(mercY(ll[1]) - mercY(map.center[1])) * s;
      const b = -map.bearing * Math.PI / 180;
      const x = dx * Math.cos(b) - dy * Math.sin(b), y = dx * Math.sin(b) + dy * Math.cos(b);
      return { x: map.width / 2 + x, y: map.height / 2 + y * Math.cos(map.pitch * Math.PI / 180) };
    },
    // Mirrors GL JS v3 semantics: the returned center is the bounds center (padding asymmetry is
    // NOT baked in); the zoom fits the rotated bounds into the total-padding-shrunken box.
    cameraForBounds(bounds, opts = {}) {
      calls.push({ m: "cameraForBounds", bounds, opts });
      const p = typeof opts.padding === "number"
        ? { top: opts.padding, right: opts.padding, bottom: opts.padding, left: opts.padding } : (opts.padding || {});
      const b = (opts.bearing || 0) * Math.PI / 180;
      const ew = bounds[1][0] - bounds[0][0], eh = mercY(bounds[1][1]) - mercY(bounds[0][1]);
      const rw = Math.abs(ew * Math.cos(b)) + Math.abs(eh * Math.sin(b));
      const rh = Math.abs(ew * Math.sin(b)) + Math.abs(eh * Math.cos(b));
      const s = Math.min((width - ((p.left || 0) + (p.right || 0))) / rw, (height - ((p.top || 0) + (p.bottom || 0))) / rh);
      if (!(s > 0) || !Number.isFinite(s)) return undefined;
      return { center: [(bounds[0][0] + bounds[1][0]) / 2, mercYinv((mercY(bounds[0][1]) + mercY(bounds[1][1])) / 2)],
        zoom: Math.log2(s * 360 / 512), bearing: opts.bearing || 0 };
    },
    _apply(o) {
      if (!o) return;
      if (o.center) map.center = Array.isArray(o.center) ? [...o.center] : [o.center.lng, o.center.lat];
      if (o.zoom != null) map.zoom = o.zoom;
      if (o.pitch != null) map.pitch = o.pitch;
      if (o.bearing != null) map.bearing = o.bearing;
    },
    fitBounds(bounds, opts) { calls.push({ m: "fitBounds", bounds, opts }); },
    flyTo(opts) { calls.push({ m: "flyTo", opts }); map._apply(opts); map.fire("moveend"); },
    easeTo(opts) { calls.push({ m: "easeTo", opts }); map._apply(opts); map.fire("moveend"); },
    jumpTo(opts) { calls.push({ m: "jumpTo", opts }); map._apply(opts); },
    stop() { calls.push({ m: "stop" }); },
    getBearing() { return map.bearing; },
    once(ev, cb) { map._once[ev] = cb; },
    fire(ev) { const cb = map._once[ev]; delete map._once[ev]; if (cb) cb(); },
  };
  return map;
}
const last = (map, m) => map.calls.filter(c => c.m === m).at(-1);

// Fixtures: two wards whose union is [[-97.5,35.1],[-97.3,35.3]] and a ~0.23 mi east-west segment.
const wards = { type: "FeatureCollection", features: [
  { type: "Feature", properties: { Ward_num: 1 }, geometry: { type: "Polygon", coordinates: [[[-97.5, 35.1], [-97.4, 35.1], [-97.4, 35.2], [-97.5, 35.2], [-97.5, 35.1]]] } },
  { type: "Feature", properties: { Ward_num: 2 }, geometry: { type: "Polygon", coordinates: [[[-97.45, 35.15], [-97.3, 35.15], [-97.3, 35.3], [-97.45, 35.3], [-97.45, 35.15]]] } },
] };
const ward = wards.features[0];
const segment = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-97.44, 35.22], [-97.436, 35.22]] } };
const pad = { top: 96, right: 64, bottom: 200, left: 300 };

// zoomForLengthMi: under 0.25 -> 16.6, under 0.6 -> 16.1, else 15.7.
assert.equal(zoomForLengthMi(0.1), 16.6);
assert.equal(zoomForLengthMi(0.24), 16.6);
assert.equal(zoomForLengthMi(0.25), 16.1, "0.25 is not under 0.25");
assert.equal(zoomForLengthMi(0.59), 16.1);
assert.equal(zoomForLengthMi(0.6), 15.7);
assert.equal(zoomForLengthMi(2.4), 15.7);

// presentationPadding: desktop uses the caption card box; null box (explore) falls back to the margins alone.
assert.deepEqual(presentationPadding({ width: 1440, height: 900 }, { width: 380, height: 220 }),
  { top: 96, right: 64, bottom: 284, left: 444 });
assert.deepEqual(presentationPadding({ width: 1440, height: 900 }, null),
  { top: 96, right: 64, bottom: 64, left: 64 }, "no caption card in explore");
// phone under 768 px wide: 40vh + 24 on the bottom, tight sides.
assert.deepEqual(presentationPadding({ width: 390, height: 800 }, { width: 340, height: 300 }),
  { top: 72, right: 24, bottom: 344, left: 24 });
assert.deepEqual(presentationPadding({ width: 900, height: 800, isPhone: true }, null),
  { top: 72, right: 24, bottom: 344, left: 24 }, "explicit isPhone wins over width");

// establish: the union bounds of the wards go through cameraForBounds, then easeTo carries the
// flat fit to the scene's pitch (fitBounds at pitch would fit the tilted trapezoid and zoom out too far).
{
  const map = makeMap();
  establish(map, wards, { padding: pad });
  const cf = last(map, "cameraForBounds");
  assert.ok(cf, "establish asks for the bounds camera");
  assert.deepEqual(cf.bounds, [[-97.5, 35.1], [-97.3, 35.3]], "union bounds of every ward");
  assert.equal(cf.opts.padding, pad, "padding passed through");
  const e = last(map, "easeTo");
  assert.ok(e, "establish eases to the fitted camera");
  assert.equal(e.opts.pitch, 55); assert.equal(e.opts.bearing, -18); assert.equal(e.opts.duration, 1600);
  assert.ok(Math.abs(e.opts.center[0] - -97.4) < 1e-9 && Math.abs(e.opts.center[1] - 35.2) < 1e-3, "center from cameraForBounds");
}
{
  const map = makeMap();
  establish(map, wards, { padding: pad, pitch: 50, bearing: -8, duration: 900 });
  const e = last(map, "easeTo");
  assert.equal(e.opts.pitch, 50); assert.equal(e.opts.bearing, -8); assert.equal(e.opts.duration, 900);
}
{
  const map = makeMap();
  establish(map, wards, { padding: pad, reduced: true });
  assert.equal(last(map, "easeTo"), undefined, "reduced: no animated move");
  const j = last(map, "jumpTo");
  assert.ok(j, "reduced: jumpTo the fitted camera");
  assert.ok(Math.abs(j.opts.center[0] - -97.4) < 1e-9 && Math.abs(j.opts.center[1] - 35.2) < 1e-3, "center from cameraForBounds");
  assert.equal(j.opts.pitch, 55); assert.equal(j.opts.bearing, -18);
}

// establish zoom (3.2-03): the bias over the flat fit is derived from the bounds, the stage and
// the pitch so the ward union fills the frame at every viewport, not a flat +0.5 that only works
// at 1440x900. Uses Norman-shaped bounds and the desktop present padding.
{
  const CITY = [[-97.54741, 35.14546], [-97.17692, 35.34832]];
  const cityFc = { type: "FeatureCollection", features: [
    { type: "Feature", properties: { Ward_num: 1 }, geometry: { type: "Polygon", coordinates: [[[CITY[0][0], CITY[0][1]], [CITY[1][0], CITY[0][1]], [CITY[1][0], CITY[1][1]], [CITY[0][0], CITY[1][1]], [CITY[0][0], CITY[0][1]]]] } },
  ] };
  const padDesktop = { top: 96, right: 64, bottom: 284, left: 624 };
  const padPhone = { top: 72, right: 24, bottom: 362, left: 24 };
  const baseZoom = (w, h, p) => makeMap({ width: w, height: h }).cameraForBounds(CITY, { padding: p, bearing: -18 }).zoom;
  const atZoom = (w, h, p) => { const m = makeMap({ width: w, height: h }); establish(m, cityFc, { padding: p }); return last(m, "easeTo").opts.zoom; };
  const b1440 = baseZoom(1440, 900, padDesktop);
  assert.ok(Math.abs(atZoom(1440, 900, padDesktop) - (b1440 + 0.5)) < 0.25,
    `1440 keeps the ratified framing (got ${atZoom(1440, 900, padDesktop).toFixed(2)}, flat ${b1440.toFixed(2)})`);
  const b1920 = baseZoom(1920, 1080, padDesktop);
  assert.ok(atZoom(1920, 1080, padDesktop) > b1920 + 0.6,
    `1920 goes well past the flat +0.5 (got ${atZoom(1920, 1080, padDesktop).toFixed(2)}, flat ${b1920.toFixed(2)})`);
  const b390 = baseZoom(390, 844, padPhone);
  assert.ok(atZoom(390, 844, padPhone) > b390 + 1.0,
    `phone fills the tall frame instead of letterboxing the metro (got ${atZoom(390, 844, padPhone).toFixed(2)}, flat ${b390.toFixed(2)})`);
}
// fitWard keeps the exact cameraForBounds fit (ward scenes framed well; explore pitch 30 untouched).
{
  const m = makeMap();
  const cam = m.cameraForBounds([[-97.5, 35.1], [-97.4, 35.2]], { padding: pad, bearing: -10 });
  fitWard(m, ward, { padding: pad });
  assert.equal(last(m, "easeTo").opts.zoom, cam.zoom, "fitWard keeps the exact fit, no bias");
}
{
  const map = makeMap();
  let resolved = false;
  const p = dollyToSegment(map, segment, { padding: pad }).then(() => { resolved = true; });
  const f = last(map, "flyTo");
  assert.ok(f, "dollies with flyTo");
  assert.equal(f.opts.curve, 1.55); assert.equal(f.opts.speed, 0.85);
  assert.equal(f.opts.maxDuration, 2600); assert.equal(f.opts.essential, true);
  assert.equal(f.opts.pitch, 58);
  assert.ok(Math.abs(f.opts.bearing - bearingAcrossScreen(segment.geometry.coordinates)) < 1e-9, "road runs across the screen");
  assert.equal(f.opts.zoom, 16.6, "short segment zooms deepest");
  await p; assert.ok(resolved, "resolves on moveend");
}

// Stage framing (3.1-01/3.1-02, P0): with the asymmetric present padding the segment's bounds
// center projects inside the stage rect right of the caption card, at the stage center.
{
  const map = makeMap({ width: 1440, height: 900 });
  const padP = presentationPadding({ width: 1440, height: 900 }, { width: 560, height: 220 });
  await dollyToSegment(map, segment, { padding: padP });
  const subj = [(-97.44 + -97.436) / 2, 35.22];
  const pt = map.project(subj);
  const stage = { x0: padP.left, x1: 1440 - padP.right, y0: padP.top, y1: 900 - padP.bottom };
  assert.ok(pt.x >= stage.x0 && pt.x <= stage.x1 && pt.y >= stage.y0 && pt.y <= stage.y1,
    `subject (${Math.round(pt.x)},${Math.round(pt.y)}) inside stage x[${stage.x0},${stage.x1}] y[${stage.y0},${stage.y1}]`);
  assert.ok(Math.abs(pt.x - (stage.x0 + stage.x1) / 2) < 1 && Math.abs(pt.y - (stage.y0 + stage.y1) / 2) < 1,
    "subject centered in the stage");
}
{
  // phone: the subject sits in the band between the progress bar and the sheet, not against it (3.2-04).
  const map = makeMap({ width: 390, height: 844 });
  const padP = presentationPadding({ width: 390, height: 844 }, { width: 340, height: 300 });
  await dollyToSegment(map, segment, { padding: padP });
  const subj = [(-97.44 + -97.436) / 2, 35.22];
  const pt = map.project(subj);
  const stage = { x0: padP.left, x1: 390 - padP.right, y0: padP.top, y1: 844 - padP.bottom };
  assert.ok(pt.x >= stage.x0 && pt.x <= stage.x1 && pt.y >= stage.y0 && pt.y <= stage.y1,
    `subject (${Math.round(pt.x)},${Math.round(pt.y)}) inside phone stage x[${stage.x0},${stage.x1}] y[${stage.y0},${stage.y1}]`);
  assert.ok(Math.abs(pt.y - (stage.y0 + stage.y1) / 2) < 1, "subject vertically centered above the sheet");
}
{
  // symmetric padding (explore): subject stays at the viewport center, no regression.
  const map = makeMap();
  await dollyToSegment(map, segment, { padding: { top: 96, right: 96, bottom: 96, left: 96 } });
  const pt = map.project([(-97.44 + -97.436) / 2, 35.22]);
  assert.ok(Math.abs(pt.x - 720) < 1 && Math.abs(pt.y - 450) < 1, "explore dolly keeps the subject at viewport center");
}

// bearing (3.1-05): a north-south line gets map bearing segment bearing - 90, so the road runs
// across the screen, not up it.
{
  const ns = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[-97.42, 35.2], [-97.42, 35.212]] } };
  const map = makeMap();
  await dollyToSegment(map, ns, { padding: pad });
  const f = last(map, "flyTo");
  assert.ok(Math.abs(Math.abs(f.opts.bearing) - 90) < 1e-9, `N-S road across the screen (bearing ${f.opts.bearing})`);
  assert.equal(f.opts.bearing, bearingAcrossScreen(ns.geometry.coordinates), "bearing = segment bearing - 90, folded");
}
{
  const map = makeMap();
  dollyToSegment(map, segment, { padding: pad, zoom: 15, pitch: 60 });
  const f = last(map, "flyTo");
  assert.equal(f.opts.zoom, 15, "explicit zoom overrides the length rule");
  assert.equal(f.opts.pitch, 60);
}
{
  const map = makeMap();
  await dollyToSegment(map, segment, { padding: pad, reduced: true });
  assert.equal(last(map, "flyTo"), undefined, "reduced: no flight");
  const j = last(map, "jumpTo");
  assert.ok(j); assert.equal(j.opts.zoom, 16.6); assert.equal(j.opts.pitch, 58);
  assert.ok(Math.abs(j.opts.bearing - bearingAcrossScreen(segment.geometry.coordinates)) < 1e-9);
}

// fitWard: the ward polygon's own bounds through cameraForBounds, easeTo carries the pitch, reduced jumps.
{
  const map = makeMap();
  fitWard(map, ward, { padding: pad });
  const cf = last(map, "cameraForBounds");
  assert.deepEqual(cf.bounds, [[-97.5, 35.1], [-97.4, 35.2]], "the ward's own bounds");
  assert.equal(cf.opts.padding, pad);
  const e = last(map, "easeTo");
  assert.equal(e.opts.pitch, 42); assert.equal(e.opts.bearing, -10); assert.equal(e.opts.duration, 1800);
}
{
  const map = makeMap();
  fitWard(map, ward, { padding: pad, reduced: true });
  assert.equal(last(map, "easeTo"), undefined);
  const j = last(map, "jumpTo");
  assert.ok(j); assert.equal(j.opts.pitch, 42); assert.equal(j.opts.bearing, -10);
}

// aerial: same dolly mechanics at pitch 62, zoom 16.8 by default.
{
  const map = makeMap();
  let resolved = false;
  const p = aerial(map, segment, { padding: pad }).then(() => { resolved = true; });
  const f = last(map, "flyTo");
  assert.ok(f); assert.equal(f.opts.pitch, 62); assert.equal(f.opts.zoom, 16.8);
  assert.equal(f.opts.curve, 1.55); assert.equal(f.opts.essential, true);
  await p; assert.ok(resolved);
}
{
  const map = makeMap();
  await aerial(map, segment, { padding: pad, zoom: 17, reduced: true });
  assert.equal(last(map, "flyTo"), undefined);
  const j = last(map, "jumpTo");
  assert.ok(j); assert.equal(j.opts.pitch, 62); assert.equal(j.opts.zoom, 17);
}

// orbit: bearing advances linearly on injected now/raf, cancel stops it.
{
  let clock = 1000; const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const map = makeMap(); map.bearing = 10;
  const cancel = orbit(map, 14, 10000, { reduced: false, now: () => clock, raf, caf: () => {} });
  assert.equal(typeof cancel, "function", "orbit returns a cancel function");
  frames.shift()(); assert.equal(map.bearing, 10, "t=0 no rotation yet");
  clock = 6000; frames.shift()(); assert.equal(map.bearing, 17, "halfway through a 14 degree orbit");
  clock = 11000; frames.shift()(); assert.equal(map.bearing, 24, "lands exactly on the target");
  assert.equal(frames.length, 0, "stops scheduling frames at the end");
}
{
  let clock = 0; const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const map = makeMap(); map.bearing = 0;
  const cancel = orbit(map, 20, 1000, { now: () => clock, raf, caf: () => {} });
  frames.shift()(); clock = 500; frames.shift()();
  assert.equal(map.bearing, 10);
  cancel();
  clock = 1000; while (frames.length) frames.shift()();
  assert.equal(map.bearing, 10, "cancel freezes the bearing where it is");
}
// hidden (3.5-6, AGENTS.md rule 5): the spin stops when the tab hides instead of jumping to its
// end bearing on return. hidden is injectable, defaulting to () => document.hidden.
{
  let clock = 0; const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const map = makeMap(); map.bearing = 0;
  let hidden = false;
  orbit(map, 20, 1000, { now: () => clock, raf, caf: () => {}, hidden: () => hidden });
  frames.shift()(); clock = 500; frames.shift()();
  assert.equal(map.bearing, 10, "visible: the orbit advances");
  hidden = true; clock = 750; frames.shift()();
  assert.equal(map.bearing, 10, "hidden: the spin freezes where it is");
  assert.equal(frames.length, 0, "hidden: no more frames are scheduled");
  hidden = false; clock = 1000;
  assert.equal(map.bearing, 10, "back visible: the orbit does not jump to its end bearing");
}
{
  const frames = [];
  const map = makeMap();
  drift(map, 6, 10000, { now: () => 0, raf: (fn) => frames.push(fn), caf: () => {}, hidden: () => true });
  frames.shift()();
  assert.equal(frames.length, 0, "drift started while hidden stops immediately");
  assert.equal(last(map, "jumpTo"), undefined, "and never moves the bearing");
}
{
  const frames = [];
  const map = makeMap();
  orbit(map, 14, 10000, { reduced: true, now: () => 0, raf: (fn) => frames.push(fn), caf: () => {} });
  orbit(map, 0, 10000, { now: () => 0, raf: (fn) => frames.push(fn), caf: () => {} });
  assert.equal(frames.length, 0, "no-op under reduced motion and for 0 degrees");
  assert.equal(last(map, "jumpTo"), undefined);
}

// drift: same linear bearing mechanics as orbit, smaller angle chosen by the caller.
{
  let clock = 0; const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const map = makeMap(); map.bearing = -20;
  drift(map, 6, 10000, { now: () => clock, raf, caf: () => {} });
  frames.shift()(); clock = 5000; frames.shift()();
  assert.equal(map.bearing, -17, "half of a 6 degree drift");
  clock = 10000; frames.shift()();
  assert.equal(map.bearing, -14);
}
{
  const map = makeMap();
  drift(map, 6, 10000, { reduced: true, now: () => 0, raf: () => { throw new Error("must not schedule"); }, caf: () => {} });
  assert.equal(last(map, "jumpTo"), undefined, "drift is a no-op under reduced motion");
}

// stopMotion: cancels an in-flight orbit and calls map.stop().
{
  let clock = 0; const frames = [];
  const raf = (fn) => { frames.push(fn); return frames.length; };
  const map = makeMap(); map.bearing = 0;
  orbit(map, 30, 1000, { now: () => clock, raf, caf: () => {} });
  frames.shift()(); clock = 250; frames.shift()();
  assert.equal(map.bearing, 7.5);
  stopMotion(map);
  assert.ok(last(map, "stop"), "map.stop() called");
  clock = 1000; while (frames.length) frames.shift()();
  assert.equal(map.bearing, 7.5, "the orbit does not advance after stopMotion");
}

console.log("camera checks passed");

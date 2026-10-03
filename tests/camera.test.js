// Run from the repo root: node tests/camera.test.js
// Camera choreography against a recording map double. No browser, no Mapbox.
import assert from "node:assert/strict";
import { bearingAcrossScreen } from "../geo.js";
import { aerial, dollyToSegment, drift, establish, fitWard, orbit, presentationPadding, stopMotion, zoomForLengthMi } from "../camera.js";

// Recording map double: every camera method appends to `calls`.
function makeMap() {
  const calls = [];
  const map = {
    calls, bearing: 0, _once: {},
    fitBounds(bounds, opts) { calls.push({ m: "fitBounds", bounds, opts }); },
    cameraForBounds(bounds, opts) { calls.push({ m: "cameraForBounds", bounds, opts }); return { center: [-97.44, 35.22], zoom: 12.4, bearing: 0 }; },
    flyTo(opts) { calls.push({ m: "flyTo", opts }); map.fire("moveend"); },
    easeTo(opts) { calls.push({ m: "easeTo", opts }); map.fire("moveend"); },
    jumpTo(opts) { calls.push({ m: "jumpTo", opts }); if (opts && opts.bearing !== undefined) map.bearing = opts.bearing; },
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
  assert.deepEqual(e.opts.center, [-97.44, 35.22], "center from cameraForBounds");
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
  assert.deepEqual(j.opts.center, [-97.44, 35.22], "center from cameraForBounds");
  assert.equal(j.opts.pitch, 55); assert.equal(j.opts.bearing, -18);
}

// dollyToSegment: cameraForBounds then flyTo with the dolly tuning, promise resolves on moveend.
{
  const map = makeMap();
  let resolved = false;
  const p = dollyToSegment(map, segment, { padding: pad }).then(() => { resolved = true; });
  const fb = last(map, "cameraForBounds");
  assert.ok(fb, "asks the map for the bounds camera");
  assert.deepEqual(fb.bounds, [[-97.44, 35.22], [-97.436, 35.22]], "segment bounds");
  const f = last(map, "flyTo");
  assert.ok(f, "dollies with flyTo");
  assert.equal(f.opts.curve, 1.55); assert.equal(f.opts.speed, 0.85);
  assert.equal(f.opts.maxDuration, 2600); assert.equal(f.opts.essential, true);
  assert.equal(f.opts.pitch, 58);
  assert.ok(Math.abs(f.opts.bearing - bearingAcrossScreen(segment.geometry.coordinates)) < 1e-9, "road runs across the screen");
  assert.equal(f.opts.zoom, 16.6, "short segment zooms deepest");
  await p; assert.ok(resolved, "resolves on moveend");
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

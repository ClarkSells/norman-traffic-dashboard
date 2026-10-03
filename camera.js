// The four camera moves (design section 6): establish, dolly to segment, fit ward, aerial,
// plus the orbit/drift loops, the caption aware padding rule and the segment length zoom rule.
// Every move jumps (jumpTo) under reduced motion. Orbit and drift run on injectable now/raf/caf
// so tests can drive them; both register module level handles so stopMotion can cut them.
import { bearingAcrossScreen, lineBounds, lineMidpoint, metersBetween } from "./geo.js";

const METERS_PER_MILE = 1609.344;

// Zoom by segment length (design section 6): short segments read deeper.
export function zoomForLengthMi(mi) {
  if (mi < 0.25) return 16.6;
  if (mi < 0.6) return 16.1;
  return 15.7;
}

// Design padding rule: the caption card gets out of the way on desktop; on phones the
// bottom sheet reserve is 40vh + 24. captionBox is the card's bounding rect, null in explore.
export function presentationPadding(viewport, captionBox) {
  const v = viewport || {};
  const width = v.width ?? 1024, height = v.height ?? 768;
  const isPhone = v.isPhone ?? width < 768;
  if (isPhone) return { top: 72, right: 24, bottom: Math.round(height * 0.4) + 24, left: 24 };
  return { top: 96, right: 64, bottom: (captionBox ? captionBox.height : 0) + 64, left: (captionBox ? captionBox.width : 0) + 64 };
}

// Bounds of any GeoJSON geometry (geo.js only ships lineBounds); walks nested coordinate arrays.
function extendCoord(b, c) {
  if (typeof c[0] === "number") {
    b[0][0] = Math.min(b[0][0], c[0]); b[0][1] = Math.min(b[0][1], c[1]);
    b[1][0] = Math.max(b[1][0], c[0]); b[1][1] = Math.max(b[1][1], c[1]);
  } else for (const n of c) extendCoord(b, n);
}
function geometryBounds(geometry) {
  const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
  if (geometry) extendCoord(b, geometry.coordinates);
  return b;
}
function collectionBounds(fc) {
  const b = [[Infinity, Infinity], [-Infinity, -Infinity]];
  for (const f of (fc && fc.features) || []) {
    const fb = geometryBounds(f.geometry);
    b[0][0] = Math.min(b[0][0], fb[0][0]); b[0][1] = Math.min(b[0][1], fb[0][1]);
    b[1][0] = Math.max(b[1][0], fb[1][0]); b[1][1] = Math.max(b[1][1], fb[1][1]);
  }
  return b;
}

// Segment length in miles (geo.js has no total length helper; sums metersBetween over the vertices).
function lengthMi(coords) {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) m += metersBetween(coords[i], coords[i + 1]);
  return m / METERS_PER_MILE;
}

// fitBounds, or jumpTo the equivalent camera under reduced motion.
function fitOrJump(map, bounds, { padding, pitch, bearing, duration: ms, reduced }) {
  if (!reduced) { map.fitBounds(bounds, { padding, pitch, bearing, duration: ms }); return; }
  const cam = map.cameraForBounds(bounds, { padding, bearing });
  if (!cam) { map.fitBounds(bounds, { padding, pitch, bearing, duration: 0 }); return; }
  map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch, bearing });
}

// Establish: the whole city. Union of the ward bounds, pitch 55, bearing -18, 1600 ms.
export function establish(map, wardsFc, { padding, pitch = 55, bearing = -18, duration: ms = 1600, reduced } = {}) {
  fitOrJump(map, collectionBounds(wardsFc), { padding, pitch, bearing, duration: ms, reduced });
}

// Fit ward: the ward polygon framed as a stage, pitch 42, bearing -10, 1800 ms.
export function fitWard(map, wardFeature, { padding, pitch = 42, bearing = -10, duration: ms = 1800, reduced } = {}) {
  fitOrJump(map, geometryBounds(wardFeature && wardFeature.geometry), { padding, pitch, bearing, duration: ms, reduced });
}

// Shared dolly mechanics: cameraForBounds for the center, then flyTo with the design tuning
// (curve 1.55, speed 0.85, maxDuration 2600, essential). Resolves on moveend; jumps under reduced.
function dolly(map, segmentFeature, { padding, zoom, pitch, reduced }) {
  const coords = (segmentFeature && segmentFeature.geometry && segmentFeature.geometry.coordinates) || [];
  const bounds = lineBounds(coords);
  const bearing = bearingAcrossScreen(coords);
  const z = zoom ?? zoomForLengthMi(lengthMi(coords));
  const cam = map.cameraForBounds(bounds, { padding, bearing });
  const target = { center: (cam && cam.center) || lineMidpoint(coords), zoom: z, pitch, bearing };
  if (reduced) { map.jumpTo(target); return Promise.resolve(); }
  return new Promise((resolve) => {
    map.once("moveend", resolve);
    map.flyTo({ ...target, curve: 1.55, speed: 0.85, maxDuration: 2600, essential: true });
  });
}

// Dolly to segment: pitch 58, the road runs across the screen, zoom from the length rule.
export function dollyToSegment(map, segmentFeature, { padding, zoom, pitch = 58, reduced } = {}) {
  return dolly(map, segmentFeature, { padding, zoom, pitch, reduced });
}

// Aerial: same move at pitch 62 and zoom 16.8 for the satellite scenes.
export function aerial(map, segmentFeature, { padding, zoom = 16.8, pitch = 62, reduced } = {}) {
  return dolly(map, segmentFeature, { padding, zoom, pitch, reduced });
}

// Module level handles for the in flight loops, so stopMotion can cancel them from anywhere.
const activeLoops = new Set();

// Linear bearing change over ms on injected timers. No-op under reduced motion, for 0 degrees,
// or when there is no raf. Returns a cancel function that freezes the bearing where it is.
function spin(map, degrees, ms, { reduced = false, now, raf, caf } = {}) {
  if (reduced || !degrees || !ms) return () => {};
  const _now = now || (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  const _raf = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : null);
  const _caf = caf || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});
  if (!_raf) return () => {};
  const b0 = map.getBearing(), t0 = _now();
  let handle = null, cancelled = false;
  const cancel = () => { cancelled = true; if (handle != null) _caf(handle); activeLoops.delete(cancel); };
  const step = () => {
    if (cancelled) return;
    const t = Math.min(1, (_now() - t0) / ms);
    map.jumpTo({ bearing: b0 + degrees * t });
    if (t < 1) handle = _raf(step); else activeLoops.delete(cancel);
  };
  activeLoops.add(cancel);
  handle = _raf(step);
  return cancel;
}

// Orbit: a slow linear rotation for the length of a scene, cancelled on any user input.
export function orbit(map, degrees, ms, opts = {}) {
  return spin(map, degrees, ms, opts);
}

// Drift: the same linear bearing mechanic with the smaller angle the caller passes
// (the design allows it to also ease pitch by up to 4 degrees; bearing only keeps it calm).
export function drift(map, degrees, ms, opts = {}) {
  return spin(map, degrees, ms, opts);
}

// Cancel every in flight orbit/drift and stop any Mapbox camera animation.
export function stopMotion(map) {
  for (const cancel of [...activeLoops]) cancel();
  if (map && typeof map.stop === "function") map.stop();
}

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

// Spherical mercator in "degrees" (one unit = one degree of longitude), matching the 512 px
// world of Mapbox GL JS v3: px per unit at zoom z is 512 * 2^z / 360.
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2)) * 180 / Math.PI;
const mercYinv = (y) => (Math.atan(Math.exp(y * Math.PI / 180)) * 2 - Math.PI / 2) * 180 / Math.PI;
const pxPerDeg = (z) => 512 * Math.pow(2, z) / 360;

// Screen offset of the stage center from the viewport center, from the padding alone
// (positive x right, positive y down). Symmetric padding gives a zero offset.
function stageOffset(padding) {
  const p = padding || {};
  return { x: ((p.left || 0) - (p.right || 0)) / 2, y: ((p.top || 0) - (p.bottom || 0)) / 2 };
}

// Camera center that projects `subject` onto the stage center at the given zoom/bearing/pitch:
// invert the flat mercator projection, undo the cos(pitch) vertical compression, un-rotate by
// the bearing. GL JS v3's cameraForBounds does NOT do this (its padding only shrinks the fit
// area; the returned center is the bounds center), and passing padding to flyTo would set the
// global map padding as a side effect — so the offset is computed here.
function centerForStage(subject, { offset, zoom, bearing, pitch }) {
  if (!offset.x && !offset.y) return subject;
  const s = pxPerDeg(zoom);
  const b = (bearing || 0) * Math.PI / 180;
  const yFlat = offset.y / Math.cos((pitch || 0) * Math.PI / 180);
  const dx = offset.x * Math.cos(b) - yFlat * Math.sin(b);
  const dy = offset.x * Math.sin(b) + yFlat * Math.cos(b);
  return [subject[0] - dx / s, mercYinv(mercY(subject[1]) + dy / s)];
}

// Segment length in miles (geo.js has no total length helper; sums metersBetween over the vertices).
function lengthMi(coords) {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) m += metersBetween(coords[i], coords[i + 1]);
  return m / METERS_PER_MILE;
}

// City and ward fits: cameraForBounds gives the flat fit for the padded box; easeTo then applies the
// scene's pitch. fitBounds with a pitch fits the tilted trapezoid instead, which zooms so far out the
// city reads as a stamp on the metro map (the first real renderer pass showed the whole OKC metro).
// When the box cannot fit (a mid-transition canvas smaller than the padding), retry without padding
// rather than falling back to a pitched fitBounds.
function fitOrJump(map, bounds, { padding, pitch, bearing, duration: ms, reduced, zoomBias = 0 }) {
  let cam = map.cameraForBounds(bounds, { padding, bearing });
  if (!cam && padding) cam = map.cameraForBounds(bounds, { bearing });
  if (!cam) { map.fitBounds(bounds, { pitch: 0, bearing, duration: reduced ? 0 : ms }); return; }
  const target = { center: cam.center, zoom: cam.zoom + zoomBias, pitch, bearing };
  if (reduced) map.jumpTo(target);
  else map.easeTo({ ...target, duration: ms });
}

// Establish zoom (3.2-03): the flat fit leaves the city small once the pitch compresses it, and a
// flat +0.5 bias only fills the frame at 1440x900. Derive the bias from the bounds, the stage and
// the pitch: project the rotated bounds at the scene pitch (calibrated against the real renderer at
// pitch 55: width factor 0.86, height 0.86 * cos(pitch)) and zoom until the union fills the stage.
// On tall narrow stages (phone) filling means cropping, so the crop is capped at 2x.
function establishZoom(map, bounds, { padding, pitch, bearing }) {
  const cam = map.cameraForBounds(bounds, { padding, bearing });
  if (!cam) return null;
  const cv = map.getCanvas && map.getCanvas();
  const vw = cv && cv.clientWidth, vh = cv && cv.clientHeight;
  if (!vw || !vh) return { center: cam.center, zoom: cam.zoom + 0.5 };
  const p = padding || {};
  const stageW = vw - ((p.left || 0) + (p.right || 0));
  const stageH = vh - ((p.top || 0) + (p.bottom || 0));
  if (!(stageW > 0) || !(stageH > 0)) return { center: cam.center, zoom: cam.zoom + 0.5 };
  const b = (bearing || 0) * Math.PI / 180;
  const ew = bounds[1][0] - bounds[0][0], eh = mercY(bounds[1][1]) - mercY(bounds[0][1]);
  const rw = Math.abs(ew * Math.cos(b)) + Math.abs(eh * Math.sin(b));
  const rh = Math.abs(ew * Math.sin(b)) + Math.abs(eh * Math.cos(b));
  const s = pxPerDeg(cam.zoom);
  const projW = 0.86 * rw * s, projH = 0.86 * Math.cos((pitch || 0) * Math.PI / 180) * rh * s;
  const rW = stageW / projW, rH = stageH / projH;
  const stretch = (projW / projH) / (stageW / stageH);
  const scale = stretch > 2 ? Math.min(Math.max(rW, rH), 2 * Math.min(rW, rH)) : Math.min(rW, rH);
  return { center: cam.center, zoom: cam.zoom + Math.log2(scale) };
}

// Establish: the whole city. Union of the ward bounds, pitch 55, bearing -18, 1600 ms.
// The zoom comes from establishZoom so the ward union fills the stage at every viewport.
export function establish(map, wardsFc, { padding, pitch = 55, bearing = -18, duration: ms = 1600, reduced } = {}) {
  const bounds = collectionBounds(wardsFc);
  const fit = establishZoom(map, bounds, { padding, pitch, bearing });
  if (!fit) { fitOrJump(map, bounds, { padding, pitch, bearing, duration: ms, reduced, zoomBias: 0.5 }); return; }
  const target = { center: fit.center, zoom: fit.zoom, pitch, bearing };
  if (reduced) map.jumpTo(target);
  else map.easeTo({ ...target, duration: ms });
}

// Fit ward: the ward polygon framed as a stage, pitch 42, bearing -10, 1800 ms.
export function fitWard(map, wardFeature, { padding, pitch = 42, bearing = -10, duration: ms = 1800, reduced } = {}) {
  fitOrJump(map, geometryBounds(wardFeature && wardFeature.geometry), { padding, pitch, bearing, duration: ms, reduced });
}

// Shared dolly mechanics: the segment's bounds center is placed at the stage center (the padded
// area right of the caption card), then flyTo with the design tuning (curve 1.55, speed 0.85,
// maxDuration 2600, essential). Resolves on moveend; jumps under reduced.
function dolly(map, segmentFeature, { padding, zoom, pitch, reduced }) {
  const coords = (segmentFeature && segmentFeature.geometry && segmentFeature.geometry.coordinates) || [];
  const bounds = lineBounds(coords);
  const bearing = bearingAcrossScreen(coords);
  const z = zoom ?? zoomForLengthMi(lengthMi(coords));
  const subject = [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2];
  const center = Number.isFinite(subject[0]) && Number.isFinite(subject[1])
    ? centerForStage(subject, { offset: stageOffset(padding), zoom: z, bearing, pitch })
    : lineMidpoint(coords);
  const target = { center, zoom: z, pitch, bearing };
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
// `hidden` is injectable (default () => document.hidden): when the tab hides the spin stops for
// good instead of letting the clock run and jumping to the end bearing on return (AGENTS.md rule 5).
function spin(map, degrees, ms, { reduced = false, now, raf, caf, hidden } = {}) {
  if (reduced || !degrees || !ms) return () => {};
  const _now = now || (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  const _raf = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : null);
  const _caf = caf || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});
  const isHidden = hidden || (() => typeof document !== "undefined" && !!document.hidden);
  if (!_raf) return () => {};
  const b0 = map.getBearing(), t0 = _now();
  let handle = null, cancelled = false;
  const cancel = () => { cancelled = true; if (handle != null) _caf(handle); activeLoops.delete(cancel); };
  const step = () => {
    if (cancelled) return;
    if (isHidden()) { cancel(); return; }
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

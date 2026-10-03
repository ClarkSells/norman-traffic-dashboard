// Motion helpers, pure where possible. Every animation here has a reason: show where something went or what changed.
// Durations: 200 to 700 ms. Ease out for arrivals, ease in out for the camera.

export const DUR = { fast: 200, mid: 350, slow: 500, camera: 700 };

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const linear = (t) => t;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A duration that collapses to 0 under reduced motion.
export function duration(ms, reduced) { return reduced ? 0 : ms; }

// Generic tween. onUpdate(t) receives the eased progress in 0..1. Timing is injectable so tests run without a browser.
// Returns a cancel function. With duration 0 (or no requestAnimationFrame) it completes synchronously.
export function tween({ duration: ms = DUR.mid, ease = easeOutCubic, onUpdate, onDone, now, raf, caf }) {
  const _now = now || (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  const _raf = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : null);
  const _caf = caf || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});
  if (!ms || !_raf) { if (onUpdate) onUpdate(1); if (onDone) onDone(); return () => {}; }
  const t0 = _now(); let handle = null, cancelled = false;
  const step = () => {
    if (cancelled) return;
    const t = clamp01((_now() - t0) / ms);
    if (onUpdate) onUpdate(ease(t));
    if (t < 1) handle = _raf(step); else if (onDone) onDone();
  };
  handle = _raf(step);
  return () => { cancelled = true; if (handle != null) _caf(handle); };
}

// Count a number up or down to a new value. format(value) renders it (tabular numerals keep the width steady).
const counters = new WeakMap();
export function animateNumber(el, to, format, { duration: ms = DUR.slow, reduced = false, now, raf, caf } = {}) {
  if (!el) return;
  const prev = counters.get(el);
  if (prev && prev.cancel) prev.cancel();
  const from = prev && Number.isFinite(prev.value) ? prev.value : to;
  if (reduced || !Number.isFinite(to) || from === to) { el.textContent = format(to); counters.set(el, { value: to }); return; }
  const rec = { value: from };
  rec.cancel = tween({ duration: ms, ease: easeOutCubic, now, raf, caf,
    onUpdate: (t) => { rec.value = lerp(from, to, t); el.textContent = format(Math.round(rec.value)); },
    onDone: () => { rec.value = to; el.textContent = format(to); } });
  counters.set(el, rec);
}

// FLIP: given the rects of keyed elements before and after a DOM change, compute the inverse transforms.
// before and after are Maps key -> {top, left}. Only keys present in both move; others are "entered" or "left".
export function flipPlan(before, after) {
  const moves = [], entered = [], left = [];
  for (const [k, b] of after) {
    const a = before.get(k);
    if (!a) { entered.push(k); continue; }
    const dx = a.left - b.left, dy = a.top - b.top;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moves.push({ key: k, dx, dy });
  }
  for (const k of before.keys()) if (!after.has(k)) left.push(k);
  return { moves, entered, left };
}

// Cap the work: only the first `max` moves (sorted by distance, largest first) animate; the rest snap.
export function capMoves(moves, max = 60) {
  if (moves.length <= max) return moves;
  return [...moves].sort((a, b) => Math.hypot(b.dx, b.dy) - Math.hypot(a.dx, a.dy)).slice(0, max);
}

// Reads rects for keyed elements inside a scrolling container, only for the ones in or near the viewport.
export function measureRows(rowsByKey, viewport) {
  const out = new Map();
  for (const [k, el] of rowsByKey) {
    if (!el.getBoundingClientRect) continue;
    const r = el.getBoundingClientRect();
    if (viewport && (r.bottom < viewport.top - viewport.height || r.top > viewport.bottom + viewport.height)) continue;
    out.set(k, { top: r.top, left: r.left });
  }
  return out;
}

// Plays a FLIP plan on DOM rows: sets the inverted transform, then releases it so CSS transitions carry the move.
export function playFlip(plan, rowsByKey, { reduced = false, raf, duration: ms = DUR.mid } = {}) {
  if (reduced || !plan.moves.length) return 0;
  const _raf = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => fn());
  for (const m of plan.moves) {
    const el = rowsByKey.get(m.key); if (!el || !el.style) continue;
    el.style.transition = "none";
    el.style.transform = `translate(${m.dx}px, ${m.dy}px)`;
  }
  _raf(() => {
    for (const m of plan.moves) {
      const el = rowsByKey.get(m.key); if (!el || !el.style) continue;
      el.style.transition = `transform ${ms}ms cubic-bezier(0.22, 1, 0.36, 1)`;
      el.style.transform = "";
    }
  });
  return plan.moves.length;
}

// Camera option sets. Pure: they return the options the app hands to Mapbox.
export function wardCameraOptions(reduced) {
  return { fit: { padding: 48, pitch: 30, bearing: -14, duration: duration(DUR.camera, reduced) },
           settle: { pitch: 28, bearing: -6, duration: duration(450, reduced) } };
}
export function segmentCameraOptions(bearing, reduced) {
  return { pitch: 45, bearing, maxZoom: 15.6, padding: 140, duration: duration(DUR.camera, reduced) };
}
export function resetCameraOptions(center, zoom, reduced) {
  return { center, zoom, pitch: 0, bearing: 0, duration: duration(DUR.camera, reduced) };
}

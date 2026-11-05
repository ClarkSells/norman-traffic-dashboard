// ## WHAT THIS FILE DOES
// Shared animation plumbing: easing curves, a generic tween with injectable timers (so tests run without a
// browser), a number counter for the stat tiles, and the FLIP helpers that animate table rows to their new
// positions. Every animation in the dashboard goes through tween or through timers in the same shape, and
// every one returns a cancel function. Imports nothing. Imported by camera.js (indirectly through its own
// timers), layers/segments.js, layers/collisions.js, layers/basemap.js, ui/panel.js, ui/sheet.js, ui/present.js.
// Motion helpers, pure where possible. Every animation here has a reason: show where something went or what changed.
// Durations: 200 to 700 ms. Ease out for arrivals, ease in out for the camera.

// ## Durations and easing curves
// DUR names the four durations the design allows. The eases are plain functions from progress 0..1 to eased
// progress 0..1; lerp and clamp01 are the two arithmetic helpers every tween needs.
export const DUR = { fast: 200, mid: 350, slow: 500, camera: 700 };

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const linear = (t) => t;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ## prefersReducedMotion and duration
// The OS preference, and a helper that collapses any duration to 0 when it is set.
export function prefersReducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A duration that collapses to 0 under reduced motion.
export function duration(ms, reduced) { return reduced ? 0 : ms; }

// ## tween: the one animation primitive
// Runs onUpdate on every animation frame with eased progress until the duration is up, then onDone. With a
// zero duration or no requestAnimationFrame it completes at once, which is how reduced motion and the node
// tests get the end state without waiting.
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

// ## animateNumber: the stat tiles count toward their new value
// Remembers the last value per element in a WeakMap so the next change starts from where the display is.
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

// ## FLIP helpers for the ranked table
// FLIP means First, Last, Invert, Play: measure rows before the DOM changes (First), let the DOM reorder
// (Last), apply a transform that puts each row back where it was (Invert), then release it so a CSS
// transition carries the row to its new place (Play). flipPlan computes the inverse offsets, capMoves bounds
// the work, measureRows reads the rects, playFlip applies and releases the transforms.
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

// Camera option sets moved to camera.js (card 1.5): establish, dollyToSegment, fitWard, aerial, orbit, drift.

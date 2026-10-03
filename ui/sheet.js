// Bottom sheet for narrow screens: three snap points (peek, half, full), driven by Pointer Events on the
// handle so any pointer (mouse, touch, pen) works. A tap on the handle toggles peek and half; a drag
// follows the pointer live and settles to the nearest snap. The map never receives the drag: the handle
// has touch-action none, captures the pointer, and every pointerdown is preventDefault-ed.
// CSS owns .panel.sheet and the [data-snap] rules; this module only sets data-snap and an inline transform.
import { tween, duration as motionDuration, prefersReducedMotion, DUR, lerp } from "../motion.js";

export const SNAPS = ["peek", "half", "full"];

// Design snap points (02_DESIGN_DIRECTION.md): peek is px of panel visible, half and full are
// fractions of the viewport height (52 vh, 92 vh).
export const DEFAULT_SNAPS = { peek: 148, half: 0.52, full: 0.92 };

const TAP_MS = 300;   // a press shorter than this ...
const TAP_PX = 10;    // ... with less movement than this is a tap, not a drag
const FLICK = 0.6;    // px per ms; faster releases jump one snap in the flick direction

// Visible px of panel per snap for a viewport height. Peek is clamped to the viewport, half stays
// between peek and full so small phones never get an inverted order.
export function snapHeights(viewportH, snaps) {
  const s = { ...DEFAULT_SNAPS, ...(snaps || {}) };
  const peek = Math.min(Math.round(s.peek), viewportH);
  const full = Math.max(peek, Math.round(viewportH * s.full));
  const half = Math.min(full, Math.max(peek, Math.round(viewportH * s.half)));
  return { peek, half, full };
}

// Picks the snap for a released drag: a quick flick goes one step in its direction
// (negative velocity = flick up, toward a taller sheet), otherwise the nearest height.
export function pickSnap(height, velocity, heights) {
  const asc = SNAPS.map(k => [k, heights[k]]).sort((a, b) => a[1] - b[1]);
  let nearest = 0;
  for (let i = 1; i < asc.length; i++) if (Math.abs(asc[i][1] - height) < Math.abs(asc[nearest][1] - height)) nearest = i;
  if (Math.abs(velocity) > FLICK) {
    const target = velocity < 0 ? Math.min(asc.length - 1, nearest + 1) : Math.max(0, nearest - 1);
    return asc[target][0];
  }
  return asc[nearest][0];
}

// DOM binding. `panel` is the sheet itself; `handle` (and the briefing `header`) receive the pointer
// events. snaps: { peek: px, half: vh fraction, full: vh fraction }. Timing and tween are injectable
// (now, raf, caf) so tests run without a browser; reduced motion collapses the snap animation to a jump.
// Returns { snapTo(name), current(), destroy() }; getState/dispatch are kept for the e2e harness.
export function initSheet({ panel, handle, header, peekEls, snaps, isNarrow, onSnap, reduced, now, raf, caf }) {
  const reducedMotion = reduced !== undefined ? !!reduced : prefersReducedMotion();
  const _now = now || (() => Date.now());
  let viewportH = 800;
  let snap = "peek";
  let heightPx = null;        // visible px currently applied to the panel
  let dragging = false, moved = false, startY = 0, startH = 0, t0 = 0;
  let cancelAnim = null;
  let destroyed = false;

  const narrow = () => isNarrow ? !!isNarrow() : (typeof matchMedia === "function" && matchMedia("(max-width: 767px)").matches);
  const heights = () => snapHeights(viewportH, snaps);
  const currentPx = () => (heightPx != null ? heightPx : heights()[snap]);

  const apply = (px) => {
    heightPx = px;
    if (!panel) return;
    panel.style.transform = narrow() ? `translateY(calc(100% - ${Math.round(px)}px))` : "";
  };

  const chrome = () => {
    if (panel) {
      panel.classList.toggle("sheet", narrow());
      panel.dataset.snap = snap;
      panel.classList.toggle("sheet-dragging", dragging);
    }
    if (handle) {
      handle.setAttribute("aria-expanded", snap === "peek" ? "false" : "true");
      handle.setAttribute("aria-label", `Drag to resize the panel. Now ${snap}. Press Enter to cycle.`);
    }
    if (onSnap) onSnap(snap, narrow());
  };

  // The sheet lives inside the layout box (below the top bar), so snap heights come from that box.
  const measure = () => {
    const box = panel && panel.parentNode && panel.parentNode.clientHeight ? panel.parentNode.clientHeight
      : (typeof innerHeight === "number" ? innerHeight : 800);
    viewportH = box;
  };

  const snapTo = (name) => {
    if (!SNAPS.includes(name) || destroyed) return;
    if (cancelAnim) { cancelAnim(); cancelAnim = null; }
    measure();
    const from = currentPx();
    snap = name;
    chrome();
    const to = heights()[name];
    cancelAnim = tween({
      duration: motionDuration(DUR.mid, reducedMotion), now, raf, caf,
      onUpdate: (t) => apply(lerp(from, to, t)),
      onDone: () => { cancelAnim = null; },
    });
  };

  const onDown = (e) => {
    if (destroyed || !narrow() || e.isPrimary === false) return;
    measure();
    if (cancelAnim) { cancelAnim(); cancelAnim = null; }
    dragging = true; moved = false;
    startY = e.clientY; startH = currentPx(); t0 = _now();
    if (handle && handle.setPointerCapture) { try { handle.setPointerCapture(e.pointerId); } catch (_) {} }
    else if (e.target && e.target.setPointerCapture) { try { e.target.setPointerCapture(e.pointerId); } catch (_) {} }
    e.preventDefault();   // the gesture belongs to the sheet, never to the map
    chrome();
    apply(startH);
  };
  const onMove = (e) => {
    if (!dragging || destroyed) return;
    const dy = startY - e.clientY;
    if (Math.abs(dy) > TAP_PX) moved = true;
    const h = heights();
    apply(Math.max(h.peek * 0.6, Math.min(h.full, startH + dy)));
  };
  const onUp = (e) => {
    if (!dragging || destroyed) return;
    dragging = false;
    const y = typeof e.clientY === "number" ? e.clientY : startY;
    const dt = _now() - t0, dy = startY - y;
    if (!moved && Math.abs(dy) <= TAP_PX && dt <= TAP_MS) {
      snapTo(snap === "peek" ? "half" : "peek");   // tap toggles peek and half
      return;
    }
    const h = heights();
    const px = Math.max(h.peek * 0.6, Math.min(h.full, startH + dy));
    const velocity = dt > 0 ? dy / dt : 0;         // positive = dragging up
    snapTo(pickSnap(px, -velocity, h));
  };
  // Keyboard: the drag has a single-pointer-free alternative (WCAG 2.5.7). Enter/Space cycles,
  // arrows step; aria-expanded on the handle reports the state.
  const onKey = (e) => {
    const i = SNAPS.indexOf(snap);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); snapTo(SNAPS[(i + 1) % SNAPS.length]); }
    else if (e.key === "ArrowUp") { e.preventDefault(); snapTo(SNAPS[Math.min(SNAPS.length - 1, i + 1)]); }
    else if (e.key === "ArrowDown") { e.preventDefault(); snapTo(SNAPS[Math.max(0, i - 1)]); }
  };
  const onResize = () => { measure(); apply(currentPx()); chrome(); };

  for (const el of [handle, header]) {
    if (!el) continue;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }
  if (handle) {
    handle.addEventListener("keydown", onKey);
    if (handle.style) handle.style.touchAction = "none";   // belt and braces over the .panel.sheet CSS
  }
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", onResize);

  measure();
  apply(heights().peek);
  chrome();

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (cancelAnim) { cancelAnim(); cancelAnim = null; }
    for (const el of [handle, header]) {
      if (!el || !el.removeEventListener) continue;
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    }
    if (handle && handle.removeEventListener) handle.removeEventListener("keydown", onKey);
    if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("resize", onResize);
  };

  return {
    snapTo,
    current: () => snap,
    destroy,
    // Compat for tests/e2e (window.__dash.sheet); the contracted API above is what app code uses.
    getState: () => ({ snap, dragging }),
    dispatch: (a) => {
      if (a && a.type === "set") snapTo(a.snap);
      else if (a && a.type === "cycle") snapTo(SNAPS[(SNAPS.indexOf(snap) + 1) % SNAPS.length]);
      return { snap, dragging };
    },
  };
}

// Bottom sheet for narrow screens: three snap points (peek, half, full), pointer-driven drag, CSS transforms only.
export const SNAPS = ["peek", "half", "full"];

// Heights in px of the visible part of the sheet for each snap, from the viewport height and the peek header height.
export function snapHeights(viewportH, peekH = 150) {
  const peek = Math.min(peekH, viewportH), full = Math.round(viewportH * 0.92);
  // Half is 55 percent of the box, or the midpoint between peek and full when the peek header is tall (small phones).
  const half = Math.max(Math.round(viewportH * 0.55), Math.round((peek + full) / 2));
  return { peek, half: Math.min(half, full), full };
}

export const initialSheet = { snap: "peek", dragging: false, startY: 0, startHeight: 0, height: null, viewportH: 800, peekH: 150 };

// Picks the snap for a released drag: a quick flick goes one step in its direction, otherwise the nearest height.
export function pickSnap(height, velocity, heights) {
  const asc = SNAPS.map(k => [k, heights[k]]).sort((a, b) => a[1] - b[1]);
  let nearest = 0;
  for (let i = 1; i < asc.length; i++) if (Math.abs(asc[i][1] - height) < Math.abs(asc[nearest][1] - height)) nearest = i;
  if (Math.abs(velocity) > 0.6) {      // px per ms; negative = flick up (toward a taller sheet)
    const target = velocity < 0 ? Math.min(asc.length - 1, nearest + 1) : Math.max(0, nearest - 1);
    return asc[target][0];
  }
  return asc[nearest][0];
}

// Pure reducer. Actions: resize {viewportH, peekH}, set {snap}, down {y}, move {y}, up {y, dt}, cycle.
export function sheetReduce(s, a) {
  const heights = snapHeights(s.viewportH, s.peekH);
  switch (a.type) {
    case "resize": return { ...s, viewportH: a.viewportH, peekH: a.peekH != null ? a.peekH : s.peekH, height: null };
    case "set": return SNAPS.includes(a.snap) ? { ...s, snap: a.snap, height: null, dragging: false } : s;
    case "cycle": { const i = SNAPS.indexOf(s.snap); return { ...s, snap: SNAPS[(i + 1) % SNAPS.length], height: null }; }
    case "down": return { ...s, dragging: true, startY: a.y, startHeight: heights[s.snap], height: heights[s.snap] };
    case "move": { if (!s.dragging) return s; const h = Math.max(heights.peek * 0.6, Math.min(heights.full, s.startHeight + (s.startY - a.y))); return { ...s, height: h }; }
    case "up": {
      if (!s.dragging) return s;
      const h = Math.max(heights.peek * 0.6, Math.min(heights.full, s.startHeight + (s.startY - a.y)));
      const velocity = a.dt > 0 ? (s.startY - a.y) / a.dt : 0;   // positive = dragging up
      return { ...s, dragging: false, height: null, snap: pickSnap(h, -velocity, heights) };
    }
    default: return s;
  }
}

// CSS transform for the sheet: translate so that `height` px remain visible at the bottom.
export function sheetTransform(s) {
  const heights = snapHeights(s.viewportH, s.peekH);
  const visible = s.height != null ? s.height : heights[s.snap];
  return `translateY(calc(100% - ${Math.round(visible)}px))`;
}

// DOM binding. The sheet is the panel itself; the handle (and the briefing header) receive the pointer events.
export function initSheet({ panel, handle, header, peekEls, isNarrow, onSnap }) {
  let s = { ...initialSheet };
  const apply = () => {
    if (!panel) return;
    const narrow = isNarrow ? isNarrow() : (typeof matchMedia === "function" && matchMedia("(max-width: 767px)").matches);
    panel.classList.toggle("sheet", narrow);
    panel.dataset.snap = s.snap;
    panel.classList.toggle("sheet-dragging", s.dragging);
    panel.style.transform = narrow ? sheetTransform(s) : "";
    if (handle) handle.setAttribute("aria-label", `Drag to resize the panel. Now ${s.snap}. Press Enter to cycle.`);
    if (onSnap) onSnap(s.snap, narrow);
  };
  const dispatch = (a) => { const prev = s; s = sheetReduce(s, a); if (s !== prev) apply(); return s; };
  // The sheet lives inside the layout box (below the top bar), so snap heights come from that box, not the window.
  const measure = () => {
    const box = panel && panel.parentNode && panel.parentNode.clientHeight ? panel.parentNode.clientHeight : (typeof innerHeight === "number" ? innerHeight : 800);
    const parts = peekEls && peekEls.length ? peekEls : [handle, header];
    const peek = parts.reduce((a, el) => a + (el && el.offsetHeight ? el.offsetHeight : 0), 0);
    dispatch({ type: "resize", viewportH: box, peekH: peek > 0 ? peek + 4 : 150 });
  };
  let t0 = 0;
  const onDown = (e) => { if (!panel.classList.contains("sheet") || !e.isPrimary) return; measure(); t0 = Date.now(); dispatch({ type: "down", y: e.clientY }); if (e.target.setPointerCapture) try { e.target.setPointerCapture(e.pointerId); } catch (_) {} e.preventDefault(); };
  const onMove = (e) => { if (s.dragging) dispatch({ type: "move", y: e.clientY }); };
  const onUp = (e) => { if (s.dragging) dispatch({ type: "up", y: e.clientY, dt: Date.now() - t0 }); };
  for (const el of [handle, header]) {
    if (!el) continue;
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointercancel", onUp);
  }
  if (handle) handle.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dispatch({ type: "cycle" }); } if (e.key === "ArrowUp") { e.preventDefault(); dispatch({ type: "set", snap: s.snap === "peek" ? "half" : "full" }); } if (e.key === "ArrowDown") { e.preventDefault(); dispatch({ type: "set", snap: s.snap === "full" ? "half" : "peek" }); } });
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", () => { measure(); });
  // The peek elements change height when the loading skeleton clears and when fonts arrive; follow them.
  if (typeof ResizeObserver === "function") { const ro = new ResizeObserver(() => measure()); for (const el of (peekEls || [handle, header])) if (el && el.nodeType === 1) ro.observe(el); }
  measure(); apply();
  return { dispatch, getState: () => s, measure };
}

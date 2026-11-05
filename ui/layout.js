// ## WHAT THIS FILE DOES
// Keeps the Mapbox canvas the same size as its box. A WebGL map does not notice when CSS changes its
// container, so this module watches the map element with a ResizeObserver and calls map.resize(), at most
// once per frame, and again after the layout transition into or out of present mode. It also toggles the
// presenting class and reports the caption card's box for the camera padding. Imports nothing. Called from
// app.js (initLayout, setPresenting, captionBox) and the layout tests.
// Layout keeper, contract C.4. Fixes audit bugs A1/D1: the layout grid changes
// the map's box (panel drag, narrow screens, present mode) and nothing ever
// called map.resize(), so the canvas stayed sized for the old box and the map
// went blank. This module observes the map element and resizes the map on
// every size change, at most once per frame, and once more after the CSS
// transition that follows a present-mode toggle.

// ## initLayout
export function initLayout(map, { layoutEl, mapEl }) {
  let presenting = false;
  let destroyed = false;
  let frame = null;
  const resizeCbs = new Set();

  // Injectable-friendly frame timers: use rAF when present, setTimeout otherwise.
  const raf = typeof globalThis.requestAnimationFrame === "function"
    ? (fn) => globalThis.requestAnimationFrame(fn)
    : (fn) => setTimeout(fn, 16);
  const caf = typeof globalThis.cancelAnimationFrame === "function"
    ? (id) => globalThis.cancelAnimationFrame(id)
    : (id) => clearTimeout(id);

  // ## scheduleResize: one resize per frame
  // Coalesce a burst of size changes into one map.resize() per frame.
  function scheduleResize() {
    if (destroyed || frame !== null) return;
    frame = raf(() => {
      frame = null;
      if (destroyed) return;
      map.resize();
      for (const cb of resizeCbs) cb();
    });
  }

  const RO = globalThis.ResizeObserver;
  const observer = RO ? new RO(() => scheduleResize()) : null;
  if (observer && mapEl) observer.observe(mapEl);

  // The grid animates when present mode toggles; resize again once it settles.
  // transitionend bubbles, so ignore events from children (panel disclosure,
  // legend pill, sheet settle) — only the layout grid's own transition counts.
  const onTransitionEnd = (e) => {
    if (e && e.target !== layoutEl) return;
    scheduleResize();
  };
  if (layoutEl && typeof layoutEl.addEventListener === "function") {
    layoutEl.addEventListener("transitionend", onTransitionEnd);
  }

  // ## setPresenting, captionBox, onResize, destroy: the returned API
  function setPresenting(next) {
    presenting = !!next;
    if (layoutEl && layoutEl.classList) layoutEl.classList.toggle("presenting", presenting);
    const root = typeof document !== "undefined" ? document.documentElement : null;
    if (root) {
      if (presenting) root.setAttribute("data-mode", "present");
      else root.removeAttribute("data-mode");
    }
    scheduleResize();
  }

  function captionBox() {
    if (!presenting || typeof document === "undefined") return null;
    const card = document.getElementById("present-card");
    return card ? card.getBoundingClientRect() : null;
  }

  function onResize(cb) {
    resizeCbs.add(cb);
    return () => resizeCbs.delete(cb);
  }

  function destroy() {
    destroyed = true;
    if (frame !== null) { caf(frame); frame = null; }
    if (observer) observer.disconnect();
    if (layoutEl && typeof layoutEl.removeEventListener === "function") {
      layoutEl.removeEventListener("transitionend", onTransitionEnd);
    }
    resizeCbs.clear();
  }

  return { setPresenting, captionBox, onResize, destroy };
}

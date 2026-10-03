// Present mode player (C.10): a pure reducer for the tour state plus the glue that drives the C.9
// present chrome. The player owns scene order, autoplay timing and keyboard; ui/present.js owns every
// pixel, including pausing while the pointer is over the caption card.
export const AUTOPLAY_MS = 9000; // legacy default; per-scene scene.autoplayMs is the real duration now

export const initialTour = { active: false, index: 0, total: 0, autoplay: false, saved: null };

const clamp01 = (t) => Math.max(0, Math.min(1, t));

// Pure. Actions: enter {total, saved, index?}, next, prev, goto {index}, toggleAutoplay, exit.
export function tourReduce(s, action) {
  switch (action.type) {
    case "enter": return { ...s, active: true, total: action.total, saved: action.saved || null, index: Math.min(Math.max(0, action.index || 0), Math.max(0, action.total - 1)), autoplay: false };
    case "next": { if (!s.active) return s; const last = s.index >= s.total - 1; if (last) return { ...s, autoplay: false }; const index = s.index + 1; return { ...s, index, autoplay: index >= s.total - 1 ? false : s.autoplay }; }
    case "prev": return !s.active || s.index === 0 ? s : { ...s, index: s.index - 1 };
    case "goto": return !s.active ? s : { ...s, index: Math.min(Math.max(0, action.index), s.total - 1) };
    case "toggleAutoplay": return !s.active ? s : { ...s, autoplay: !s.autoplay };
    case "exit": return { ...initialTour };
    default: return s;
  }
}

// Which key does what. Returns an action or null. Ignored while typing in a form control.
export function keyAction(key, inField = false) {
  if (inField) return null;
  if (key === "ArrowRight" || key === " " || key === "Spacebar" || key === "PageDown") return { type: "next" };
  if (key === "ArrowLeft" || key === "PageUp") return { type: "prev" };
  if (key === "Escape") return { type: "exit" };
  if (key === "Home") return { type: "goto", index: 0 };
  if (key === "End") return { type: "goto", index: Infinity };
  if (key === "a" || key === "A") return { type: "toggleAutoplay" };
  if (key === "f" || key === "F") return { type: "fullscreen" };
  return null;
}

// Horizontal swipe: returns "next" or "prev" when the gesture is mostly horizontal and long enough.
export function swipeAction(dx, dy, minPx = 48) {
  if (Math.abs(dx) < minPx || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? { type: "next" } : { type: "prev" };
}

// Legacy progress dots; the C.9 chrome renders its own segmented bar. Kept for one release.
export function dotsHtml(index, total) {
  let h = "";
  for (let i = 0; i < total; i++) h += `<button type="button" class="tour-dot${i === index ? " active" : ""}" data-index="${i}" role="tab" aria-selected="${i === index}" aria-label="Step ${i + 1} of ${total}"></button>`;
  return h;
}

// The player. opts: {
//   scenes: C.2 scene list,
//   applyScene(scene, prev): drives map/camera/layers; may return a promise,
//   onEnter(saved), onExit(saved),
//   present: the C.9 chrome { show, hide, setProgress, setControlsVisible, setAutoplay?, onAction },
//   timers: injectable { now, setInterval, clearInterval } so tests can drive autoplay time,
// }
// Returns { dispatch, getState }.
export function initTourPlayer(opts) {
  const scenes = opts.scenes || [];
  const present = opts.present || null;
  const T = opts.timers || {};
  const now = T.now || (() => Date.now());
  const setIv = T.setInterval || ((fn, ms) => setInterval(fn, ms));
  const clearIv = T.clearInterval || ((id) => clearInterval(id));

  let s = { ...initialTour };
  let tick = null;
  let applying = null; // in-flight applyScene promise; the countdown waits for it

  const stopTick = () => { if (tick != null) { clearIv(tick); tick = null; } };
  const progress = (fraction) => { if (present && present.setProgress) present.setProgress(s.index, s.total, fraction); };

  // (Re)start the 100 ms autoplay heartbeat for the current scene. The duration is the scene's own
  // autoplayMs; null (title and closing) means the scene never advances on its own.
  const startTick = () => {
    stopTick();
    if (!s.active) return;
    progress(0);
    if (!s.autoplay) return;
    const scene = scenes[s.index];
    const ms = scene && scene.autoplayMs != null ? scene.autoplayMs : null;
    if (ms == null || s.index >= s.total - 1) return;
    const t0 = now();
    tick = setIv(() => {
      const f = clamp01((now() - t0) / ms);
      progress(f);
      if (f >= 1) dispatch({ type: "next" });
    }, 100);
  };
  // applyScene may fly the camera; the next autoplay tick is scheduled only once it settles.
  const afterApply = (r) => {
    if (r && typeof r.then === "function") { applying = r; r.then(() => { if (applying === r) { applying = null; startTick(); } }); }
    else startTick();
  };

  const toggleFullscreen = () => {
    if (typeof document === "undefined" || !document.documentElement) return;
    if (document.fullscreenElement) { if (typeof document.exitFullscreen === "function") document.exitFullscreen(); }
    else if (typeof document.documentElement.requestFullscreen === "function") document.documentElement.requestFullscreen();
  };

  const dispatch = (action) => {
    if (!action) return s;
    if (action.type === "fullscreen") { toggleFullscreen(); return s; }
    const prev = s;
    s = tourReduce(s, action);
    if (s === prev) return s;
    stopTick();
    if (s.autoplay !== prev.autoplay && present && typeof present.setAutoplay === "function") present.setAutoplay(s.autoplay);
    if (action.type === "enter" && opts.onEnter) opts.onEnter(s.saved);
    if (s.active && (!prev.active || prev.index !== s.index || action.type === "enter")) {
      const scene = scenes[s.index];
      const prevScene = prev.active ? scenes[prev.index] : null;
      if (present && present.show) present.show(scene, { prev: prevScene });
      afterApply(opts.applyScene ? opts.applyScene(scene, prevScene) : null);
    } else if (!s.active && prev.active) {
      applying = null;
      if (present && present.hide) present.hide();
      if (opts.onExit) opts.onExit(prev.saved);
    } else if (!applying) {
      startTick();
    }
    return s;
  };

  // Chrome actions: "next" | "prev" | "exit" | "autoplay" | "replay" | "explore" | { goto: index }.
  if (present && present.onAction) {
    present.onAction((a) => {
      if (a === "next") dispatch({ type: "next" });
      else if (a === "prev") dispatch({ type: "prev" });
      else if (a === "exit" || a === "explore") dispatch({ type: "exit" });
      else if (a === "autoplay") dispatch({ type: "toggleAutoplay" });
      else if (a === "replay") dispatch({ type: "goto", index: 0 });
      else if (a && typeof a === "object" && Number.isFinite(a.goto)) dispatch({ type: "goto", index: a.goto });
    });
  }

  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("keydown", (e) => {
      if (!s.active) return;
      const t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      // Chrome keeps its native keys: Space/Enter/arrows on a focused button or progress tab
      // activate/navigate it instead of stepping scenes. Escape still exits from anywhere.
      const onChrome = tag === "button" || !!(t && typeof t.closest === "function" && t.closest('button, [role="tab"], #present-progress'));
      if (onChrome && e.key !== "Escape") return;
      const inField = tag === "input" || tag === "select" || tag === "textarea" || (t && t.isContentEditable);
      const a = keyAction(e.key, inField && e.key !== "Escape");
      if (a) { if (e.preventDefault) e.preventDefault(); dispatch(a); }
    });
    // Swipe left and right on the map to step
    let start = null;
    document.addEventListener("pointerdown", (e) => { if (s.active && e.isPrimary) start = { x: e.clientX, y: e.clientY, t: now() }; });
    document.addEventListener("pointerup", (e) => {
      if (!s.active || !start) return;
      const a = swipeAction(e.clientX - start.x, e.clientY - start.y), quick = now() - start.t < 1500;
      start = null;
      if (a && quick) dispatch(a);
    });
  }

  return { dispatch, getState: () => s };
}

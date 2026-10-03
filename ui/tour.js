// Present mode player: a pure reducer for the tour state and a thin DOM binding around it.
export const AUTOPLAY_MS = 9000;

export const initialTour = { active: false, index: 0, total: 0, autoplay: false, saved: null };

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
  return null;
}

// Horizontal swipe: returns "next" or "prev" when the gesture is mostly horizontal and long enough.
export function swipeAction(dx, dy, minPx = 48) {
  if (Math.abs(dx) < minPx || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? { type: "next" } : { type: "prev" };
}

export function dotsHtml(index, total) {
  let h = "";
  for (let i = 0; i < total; i++) h += `<button type="button" class="tour-dot${i === index ? " active" : ""}" data-index="${i}" role="tab" aria-selected="${i === index}" aria-label="Step ${i + 1} of ${total}"></button>`;
  return h;
}

// DOM binding. opts: { steps, applyStep(step, prev), onEnter(saved) , onExit(saved) } returns { dispatch, getState }.
export function initTourPlayer(opts) {
  let s = { ...initialTour };
  let timer = null;
  const el = (id) => document.getElementById(id);
  const render = () => {
    const box = el("tour"); if (!box) return;
    box.hidden = !s.active;
    const layout = el("layout"); if (layout && layout.classList) layout.classList.toggle("presenting", s.active);
    const present = el("present-toggle"); if (present) present.setAttribute("aria-pressed", String(s.active));
    if (!s.active) return;
    const step = opts.steps[s.index];
    const put = (id, text) => { const n = el(id); if (n) n.textContent = text; };
    put("tour-step", `${s.index + 1} of ${s.total}`); put("tour-title", step.title); put("tour-caption", step.caption);
    const dots = el("tour-dots"); if (dots) dots.innerHTML = dotsHtml(s.index, s.total);
    const prev = el("tour-prev"), next = el("tour-next"); if (prev) prev.disabled = s.index === 0; if (next) next.disabled = s.index === s.total - 1;
    const auto = el("tour-autoplay"); if (auto) { auto.checked = s.autoplay; auto.setAttribute("aria-checked", String(s.autoplay)); }
    if (layout && layout.classList) layout.classList.toggle("tour-panel", !!step.showPanel);
  };
  const schedule = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (s.active && s.autoplay && s.index < s.total - 1) timer = setTimeout(() => dispatch({ type: "next" }), opts.autoplayMs || AUTOPLAY_MS);
  };
  const dispatch = (action) => {
    const prev = s;
    s = tourReduce(s, action);
    if (s === prev) return s;
    if (action.type === "enter") { if (opts.onEnter) opts.onEnter(s.saved); }
    if (s.active && (!prev.active || prev.index !== s.index || action.type === "enter")) opts.applyStep(opts.steps[s.index], prev.active ? opts.steps[prev.index] : null);
    if (!s.active && prev.active && opts.onExit) opts.onExit(prev.saved);
    render(); schedule();
    return s;
  };
  const wire = (id, action) => { const n = el(id); if (n) n.addEventListener("click", () => dispatch(action)); };
  wire("tour-prev", { type: "prev" }); wire("tour-next", { type: "next" }); wire("tour-exit", { type: "exit" });
  const auto = el("tour-autoplay"); if (auto) auto.addEventListener("change", () => dispatch({ type: "toggleAutoplay" }));
  const dots = el("tour-dots"); if (dots) dots.addEventListener("click", (e) => { const b = e.target.closest ? e.target.closest(".tour-dot") : null; if (b) dispatch({ type: "goto", index: Number(b.dataset.index) }); });
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("keydown", (e) => {
      if (!s.active) return;
      const t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      const inField = tag === "input" || tag === "select" || tag === "textarea" || (t && t.isContentEditable);
      const a = keyAction(e.key, inField && e.key !== "Escape");
      if (a) { e.preventDefault(); dispatch(a); }
    });
    // Swipe left and right on the caption card or the map to step
    let start = null;
    document.addEventListener("pointerdown", (e) => { if (s.active && e.isPrimary) start = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    document.addEventListener("pointerup", (e) => {
      if (!s.active || !start) return;
      const a = swipeAction(e.clientX - start.x, e.clientY - start.y), quick = Date.now() - start.t < 1500;
      start = null;
      if (a && quick) dispatch(a);
    });
  }
  render();
  return { dispatch, getState: () => s };
}

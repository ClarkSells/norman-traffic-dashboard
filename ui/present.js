// ## WHAT THIS FILE DOES
// The visible chrome of present mode (CONTRACTS.md C.9): the caption card (title, caption, stats, legend chip,
// ward list, closing buttons), the segmented progress tablist and the prev, next, autoplay and exit controls
// with auto hide. It renders whatever Scene object it is given and emits actions; ui/tour.js owns the logic.
// Imports config.js and motion.js. Called from app.js (initPresent) and the present tests, which inject
// timers.
// Presentation chrome (CONTRACTS.md C.9): caption card, segmented progress tablist, controls with auto-hide.
// All scene content comes from the Scene object (C.2); this module never computes a fact.
// Motion: contents crossfade via data-anim on the card (250 ms, CSS carries the stagger); skipped under
// reduced motion. Controls auto-hide after 3 s without pointer movement (hidden controls also leave the
// tab order); any pointer movement or any key anywhere brings them back. The progress tablist follows the
// WAI-ARIA tabs pattern: roving tabindex, Arrow/Home/End keys, activation emits { goto }. Day-preset
// scenes get a "day" class on the root so the CSS can adapt the chrome (3.2-02). Timers are injectable.
import { METRIC_LABEL, RAMP } from "../config.js";
import { prefersReducedMotion } from "../motion.js";

export const CROSSFADE_MS = 250;   // design section 5: contents crossfade on scene change
export const AUTO_HIDE_MS = 3000;  // controls hide after 3 s without pointer movement

const LEGEND_METRICS = ["combined", "v_c", "collisions"];

const on = (el, ev, fn) => { if (el && el.addEventListener) el.addEventListener(ev, fn); };
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// ## initPresent: wire the DOM once, return the small API the player calls
export function initPresent({ root, reducedMotion, setTimeout: st, clearTimeout: ct } = {}) {
  const _st = st || ((fn, ms) => setTimeout(fn, ms));
  const _ct = ct || ((h) => clearTimeout(h));
  const reduced = () =>
    typeof reducedMotion === "function" ? !!reducedMotion()
    : reducedMotion !== undefined ? !!reducedMotion
    : prefersReducedMotion();

  const $ = (id) => document.getElementById(id);
  const els = {
    count: $("present-scene-count"), card: $("present-card"), title: $("present-title"),
    caption: $("present-caption"), stats: $("present-stats"), legend: $("present-legend"),
    list: $("present-list"), closing: $("present-closing"), progress: $("present-progress"),
    controls: $("present-controls"), prev: $("present-prev"), next: $("present-next"),
    autoplay: $("present-autoplay"), exit: $("present-exit"),
    replay: $("present-replay"), explore: $("present-explore"),
  };

  // ## Actions: button clicks become strings the player maps to reducer actions
  // --- actions ------------------------------------------------------------------
  const cbs = [];
  const emit = (action) => { for (const cb of cbs) cb(action); };
  on(els.prev, "click", () => emit("prev"));
  on(els.next, "click", () => emit("next"));
  on(els.exit, "click", () => emit("exit"));
  on(els.replay, "click", () => emit("replay"));
  on(els.explore, "click", () => emit("explore"));
  on(els.autoplay, "change", () => {
    els.autoplay.setAttribute("aria-checked", String(!!els.autoplay.checked));
    emit("autoplay");
  });

  // ## Controls auto hide
  // --- controls visibility + auto-hide -------------------------------------------
  let hideTimer = null;
  const controlButtons = [els.prev, els.next, els.autoplay, els.exit].filter(Boolean);
  const applyControls = (visible) => {
    if (!els.controls) return;
    els.controls.classList.toggle("hidden", !visible);
    // the fade is opacity-only, so hidden buttons must also leave the tab order (3.7-04)
    for (const b of controlButtons) b.tabIndex = visible ? 0 : -1;
  };
  const cancelHide = () => { if (hideTimer != null) { _ct(hideTimer); hideTimer = null; } };
  const scheduleHide = () => {
    cancelHide();
    hideTimer = _st(() => { hideTimer = null; applyControls(false); }, AUTO_HIDE_MS);
  };
  const wake = () => {
    if (!root || root.hidden) return;
    applyControls(true);
    scheduleHide();
  };
  on(root, "pointermove", wake);
  // any key anywhere wakes the controls (3.7-04); the test fake document has no
  // addEventListener, so it falls back to the root listener
  on(typeof document !== "undefined" && document.addEventListener ? document : root, "keydown", wake);

  // ## Scene rendering: renderStats, renderLegend, renderList, renderScene
  // Pure DOM building from the scene's fields. A stat with live: "year" gets a data attribute so app.js can
  // update its value while the year player runs.
  // --- scene rendering -------------------------------------------------------------
  const block = (className, text) => {
    const el = document.createElement("div");
    el.classList.add(className);
    el.textContent = text;
    return el;
  };

  function renderStats(scene) {
    els.stats.innerHTML = "";
    const items = scene.stats || [];
    for (const s of items) {
      const item = document.createElement("div");
      item.classList.add("present-stat");
      if (s.live && item.dataset) item.dataset.live = s.live;   // a stat app.js updates while the scene runs (the Simulate year)
      const value = document.createElement("span");
      value.classList.add("present-stat-value");
      value.textContent = s.value;
      const label = document.createElement("span");
      label.classList.add("present-stat-label");
      label.textContent = s.label;
      item.appendChild(value);
      item.appendChild(label);
      els.stats.appendChild(item);
    }
    els.stats.hidden = items.length === 0;
  }

  function renderLegend(scene) {
    const m = scene.legend;
    if (!m || !LEGEND_METRICS.includes(m)) { els.legend.innerHTML = ""; els.legend.hidden = true; return; }
    els.legend.hidden = false;
    els.legend.innerHTML =
      `<span class="legend-chip" data-metric="${m}">` +
      `<i class="legend-chip-ramp" style="background:linear-gradient(90deg, ${RAMP.join(", ")})" aria-hidden="true"></i>` +
      `<span>${METRIC_LABEL[m] || m}</span></span>`;
  }

  function renderList(scene) {
    els.list.innerHTML = "";
    const items = scene.list || [];
    els.card.classList.toggle("has-list", items.length > 0);
    for (const it of items) {
      const card = document.createElement("div");
      card.classList.add("present-list-card");
      if (it.locId != null) card.dataset.loc = it.locId;
      const rank = document.createElement("span");
      rank.classList.add("present-list-rank");
      rank.textContent = `#${it.rank}`;
      const main = document.createElement("div");
      main.classList.add("present-list-main");
      main.appendChild(block("present-list-road", it.road));
      if (it.span) main.appendChild(block("present-list-span", it.span));
      const score = document.createElement("span");
      score.classList.add("present-list-score");
      score.textContent = String(it.score);
      card.appendChild(rank);
      card.appendChild(main);
      card.appendChild(score);
      els.list.appendChild(card);
    }
    els.list.hidden = items.length === 0;
  }

  // Title-scene hero extras (C.2 eyebrow/hint, Wave 4): branding line above the title and the
  // start cue below the caption. Created once, populated only when the scene carries the fields.
  const heroEyebrow = document.createElement("div");
  heroEyebrow.classList.add("present-hero-eyebrow");
  heroEyebrow.hidden = true;
  const heroHint = document.createElement("div");
  heroHint.classList.add("present-hero-hint");
  heroHint.hidden = true;
  if (els.card) {
    if (els.card.insertBefore) {
      els.card.insertBefore(heroHint, els.stats);
      els.card.insertBefore(heroEyebrow, els.title);
    } else {
      els.card.appendChild(heroEyebrow);
      els.card.appendChild(heroHint);
    }
  }

  function renderScene(scene) {
    if (els.count) els.count.textContent = `Scene ${scene.number != null ? scene.number : scene.index + 1} of ${scene.total}`;
    els.title.textContent = scene.title || "";
    els.caption.textContent = scene.caption || "";
    els.card.dataset.kind = scene.kind;
    heroEyebrow.textContent = scene.eyebrow || "";
    heroEyebrow.hidden = !scene.eyebrow;
    heroHint.textContent = scene.hint || "";
    heroHint.hidden = !scene.hint;
    if (root) root.classList.toggle("day", scene.lightPreset === "day");
    renderStats(scene);
    renderLegend(scene);
    renderList(scene);
    els.closing.hidden = scene.kind !== "closing";
  }

  // ## show and hide: the card crossfade between scenes
  // --- show/hide with the crossfade ---------------------------------------------------
  let swapTimer = null;
  const cancelSwap = () => { if (swapTimer != null) { _ct(swapTimer); swapTimer = null; } };

  function show(scene, { prev } = {}) {
    if (root) root.hidden = false;
    wake();
    cancelSwap();
    if (!prev || reduced()) {
      els.card.removeAttribute("data-anim");
      renderScene(scene);
      return;
    }
    els.card.setAttribute("data-anim", "out");
    swapTimer = _st(() => {
      swapTimer = null;
      renderScene(scene);
      els.card.setAttribute("data-anim", "in");
    }, CROSSFADE_MS / 2);
  }

  function hide() {
    if (root) root.hidden = true;
    cancelHide();
    cancelSwap();
    if (els.card) els.card.removeAttribute("data-anim");
  }

  // ## Progress tablist: setProgress and its keyboard handling
  // --- progress tablist -----------------------------------------------------------------
  // WAI-ARIA tabs pattern (3.7-03): one tab per scene, roving tabindex, Arrow/Home/End move
  // focus with automatic activation (emitting { goto } through onAction). This handler owns
  // keys inside #present-progress; tour.js leaves them alone when focus is in the tablist.
  const setFill = (el, f) => {
    const v = String(f);
    if (el.style.setProperty) el.style.setProperty("--fill", v); else el.style["--fill"] = v;
  };
  let progressTotal = 0;
  let segments = [];
  let focusIndex = 0;
  const syncTabOrder = () => {
    segments.forEach((seg, i) => { seg.tabIndex = i === focusIndex ? 0 : -1; });
  };
  on(els.progress, "keydown", (e) => {
    if (!segments.length) return;
    let nextIndex = null;
    if (e.key === "ArrowRight") nextIndex = Math.min(focusIndex + 1, segments.length - 1);
    else if (e.key === "ArrowLeft") nextIndex = Math.max(focusIndex - 1, 0);
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = segments.length - 1;
    else return;
    if (e.preventDefault) e.preventDefault();
    if (nextIndex === focusIndex) return;
    focusIndex = nextIndex;
    syncTabOrder();
    const seg = segments[focusIndex];
    if (seg && seg.focus) seg.focus();
    emit({ goto: focusIndex });
  });
  function setProgress(index, total, fraction) {
    const frac = clamp01(fraction == null ? 0 : fraction);
    if (total !== progressTotal) {
      els.progress.innerHTML = "";
      segments = [];
      for (let i = 0; i < total; i++) {
        const seg = document.createElement("button");
        seg.classList.add("present-segment");
        seg.type = "button";
        seg.setAttribute("role", "tab");
        seg.setAttribute("aria-label", `Scene ${i + 1} of ${total}`);
        seg.setAttribute("aria-controls", "present-card");
        const gotoIndex = i;
        seg.addEventListener("click", () => emit({ goto: gotoIndex }));
        els.progress.appendChild(seg);
        segments.push(seg);
      }
      progressTotal = total;
    }
    focusIndex = index;
    segments.forEach((seg, i) => {
      seg.setAttribute("aria-selected", String(i === index));
      setFill(seg, i < index ? 1 : i === index ? frac : 0);
    });
    syncTabOrder();
  }

  // ## setControlsVisible and setAutoplay: the player's two write backs
  function setControlsVisible(visible) {
    applyControls(!!visible);
    if (visible) scheduleHide(); else cancelHide();
  }

  // C.9 Wave 4 (3.5-1/3.7-05): the player calls this when autoplay changes outside the switch
  // itself (the `a` key, or the reducer forcing autoplay off at the last scene).
  function setAutoplay(onState) {
    if (!els.autoplay) return;
    els.autoplay.checked = !!onState;
    els.autoplay.setAttribute("aria-checked", String(!!onState));
  }

  return {
    show,
    hide,
    setProgress,
    setControlsVisible,
    setAutoplay,
    onAction: (cb) => { cbs.push(cb); },
  };
}

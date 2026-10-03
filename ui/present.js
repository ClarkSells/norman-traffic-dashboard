// Presentation chrome (CONTRACTS.md C.9): caption card, segmented progress tablist, controls with auto-hide.
// All scene content comes from the Scene object (C.2); this module never computes a fact.
// Motion: contents crossfade via data-anim on the card (250 ms, CSS carries the stagger); skipped under
// reduced motion. Controls auto-hide after 3 s without pointer movement. Timers are injectable for tests.
import { METRIC_LABEL, RAMP } from "../config.js";
import { prefersReducedMotion } from "../motion.js";

export const CROSSFADE_MS = 250;   // design section 5: contents crossfade on scene change
export const AUTO_HIDE_MS = 3000;  // controls hide after 3 s without pointer movement

const LEGEND_METRICS = ["combined", "v_c", "collisions"];

const on = (el, ev, fn) => { if (el && el.addEventListener) el.addEventListener(ev, fn); };
const clamp01 = (t) => Math.max(0, Math.min(1, t));

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

  // --- controls visibility + auto-hide -------------------------------------------
  let hideTimer = null;
  const applyControls = (visible) => {
    if (!els.controls) return;
    els.controls.classList.toggle("hidden", !visible);
    els.controls.setAttribute("aria-hidden", String(!visible));
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
  on(root, "keydown", wake);

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

  function renderScene(scene) {
    if (els.count) els.count.textContent = `Scene ${scene.number != null ? scene.number : scene.index + 1} of ${scene.total}`;
    els.title.textContent = scene.title || "";
    els.caption.textContent = scene.caption || "";
    els.card.dataset.kind = scene.kind;
    renderStats(scene);
    renderLegend(scene);
    renderList(scene);
    els.closing.hidden = scene.kind !== "closing";
  }

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

  // --- progress tablist -----------------------------------------------------------------
  const setFill = (el, f) => {
    const v = String(f);
    if (el.style.setProperty) el.style.setProperty("--fill", v); else el.style["--fill"] = v;
  };
  let progressTotal = 0;
  let segments = [];
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
        const gotoIndex = i;
        seg.addEventListener("click", () => emit({ goto: gotoIndex }));
        els.progress.appendChild(seg);
        segments.push(seg);
      }
      progressTotal = total;
    }
    segments.forEach((seg, i) => {
      seg.setAttribute("aria-selected", String(i === index));
      seg.tabIndex = i === index ? 0 : -1;
      setFill(seg, i < index ? 1 : i === index ? frac : 0);
    });
  }

  function setControlsVisible(visible) {
    applyControls(!!visible);
    if (visible) scheduleHide(); else cancelHide();
  }

  return {
    show,
    hide,
    setProgress,
    setControlsVisible,
    onAction: (cb) => { cbs.push(cb); },
  };
}

// ## WHAT THIS FILE DOES
// The loading card over the map and the thin progress bar under the top bar: staged copy while the style and
// the data load, a determinate bar once bytes arrive, an error card with a reload button if anything fails.
// Imports facts.js (for the segment count in the copy). Called from app.js (initLoading, setStage,
// setProgress, hideLoading, showLoadError) and the loading tests.
// Loading overlay over the map. Shown while the style and the geojson download,
// hidden once the layers are on the map, turned into an error card if a fetch fails.
// Copy is staged and calm; the bar is determinate once the first byte arrives.
import { FACTS } from "../facts.js";

const STAGES = {
  map: "Preparing the map",
  segments: `Placing ${FACTS.segments} segments`,
  crashes: "Loading five years of crash records",
};

let stage = "map";

// ## errorMessage
export function errorMessage(err) {
  const detail = err && err.message ? err.message : String(err || "unknown error");
  return `Could not load the dashboard data. Check your connection and reload the page. Details: ${detail}`;
}

function el(id) { return typeof document === "undefined" ? null : document.getElementById(id); }

// ## setStage
// Sets which stage of the load the card is talking about. Unknown stages are ignored.
export function setStage(next) {
  if (!STAGES[next]) return;
  stage = next;
  const text = el("loading-text"); if (text) text.textContent = STAGES[stage];
}

// ## setProgress and finishProgress
// Feeds the thin progress bar under the top bar. Indeterminate only before the
// first byte arrives; afterwards determinate, with the fill tracking the byte
// ratio when the total is known.
export function setProgress(p) {
  const bar = el("progress"); if (!bar) return;
  bar.hidden = false;
  const fill = el("progress-fill");
  const started = !!(p && p.loaded > 0);
  if (started) {
    bar.classList.remove("indeterminate");
    if (p.ratio != null) {
      const pct = Math.round(p.ratio * 100);
      if (fill && fill.style) fill.style.width = `${pct}%`;
      bar.setAttribute("aria-valuenow", String(pct));
    }
  } else {
    bar.classList.add("indeterminate");
    bar.removeAttribute("aria-valuenow");
  }
}

export function finishProgress() {
  const bar = el("progress"); if (!bar) return;
  const fill = el("progress-fill"); if (fill && fill.style) fill.style.width = "100%";
  bar.classList.remove("indeterminate");
  bar.setAttribute("aria-valuenow", "100");
  bar.hidden = true;
}

// ## showLoading, hideLoading, showLoadError
export function showLoading() {
  const box = el("loading"); if (!box) return;
  box.hidden = false;
  const panel = el("panel"); if (panel && panel.classList) panel.classList.add("skeleton");
  box.classList.remove("error");
  box.setAttribute("role", "status");
  const btn = el("loading-reload"); if (btn) btn.hidden = true;
  const bar = el("progress");
  if (bar) { bar.classList.add("indeterminate"); bar.removeAttribute("aria-valuenow"); const fill = el("progress-fill"); if (fill && fill.style) fill.style.width = "0%"; }
  setStage("map");
}

export function hideLoading() {
  const box = el("loading"); if (!box) return;
  box.hidden = true;
  const panel = el("panel"); if (panel && panel.classList) panel.classList.remove("skeleton");
  finishProgress();
}

export function showLoadError(err) {
  const box = el("loading"); if (!box) return;
  box.hidden = false;
  box.classList.add("error");
  box.setAttribute("role", "alert");
  const text = el("loading-text"); if (text) text.textContent = errorMessage(err);
  const btn = el("loading-reload"); if (btn) btn.hidden = false;
  const bar = el("progress"); if (bar) bar.hidden = true;
}

// ## initLoading
// Wire the reload button and show the loading card. Called once, before the fetches start.
export function initLoading() {
  const btn = el("loading-reload");
  if (btn) btn.addEventListener("click", () => location.reload());
  showLoading();
}

// Loading overlay over the map. Shown while the style and the geojson download,
// hidden once the layers are on the map, turned into an error card if a fetch fails.
const APPROX_MB = 4;

export function loadingMessage() {
  return `Loading the map and about ${APPROX_MB} MB of segment and crash data. This can take a few seconds on a slow connection.`;
}

export function errorMessage(err) {
  const detail = err && err.message ? err.message : String(err || "unknown error");
  return `Could not load the dashboard data. Check your connection and reload the page. Details: ${detail}`;
}

function el(id) { return typeof document === "undefined" ? null : document.getElementById(id); }

// Progress text for the loading card: a percentage when the total is known, otherwise a byte count.
export function progressMessage(p) {
  if (!p || !p.loaded) return loadingMessage();
  const mb = (p.loaded / 1048576).toFixed(1);
  if (p.ratio != null) return `Loading segment and crash data, ${Math.round(p.ratio * 100)} percent of ${(p.total / 1048576).toFixed(1)} MB.`;
  return `Loading segment and crash data, ${mb} MB so far.`;
}

// Feeds the thin progress bar under the top bar. Indeterminate when the total is unknown.
export function setProgress(p) {
  const bar = el("progress"); if (!bar) return;
  bar.hidden = false;
  const fill = el("progress-fill");
  if (p && p.ratio != null) { bar.classList.remove("indeterminate"); if (fill && fill.style) fill.style.width = `${Math.round(p.ratio * 100)}%`; bar.setAttribute("aria-valuenow", String(Math.round(p.ratio * 100))); }
  else { bar.classList.add("indeterminate"); bar.removeAttribute("aria-valuenow"); }
  const text = el("loading-text"); if (text) text.textContent = progressMessage(p);
}

export function finishProgress() {
  const bar = el("progress"); if (!bar) return;
  const fill = el("progress-fill"); if (fill && fill.style) fill.style.width = "100%";
  bar.classList.remove("indeterminate");
  bar.setAttribute("aria-valuenow", "100");
  bar.hidden = true;
}

export function showLoading() {
  const box = el("loading"); if (!box) return;
  box.hidden = false;
  const panel = el("panel"); if (panel && panel.classList) panel.classList.add("skeleton");
  box.classList.remove("error");
  box.setAttribute("role", "status");
  const text = el("loading-text"); if (text) text.textContent = loadingMessage();
  const btn = el("loading-reload"); if (btn) btn.hidden = true;
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

// Wire the reload button and show the loading card. Called once, before the fetches start.
export function initLoading() {
  const btn = el("loading-reload");
  if (btn) btn.addEventListener("click", () => location.reload());
  showLoading();
}

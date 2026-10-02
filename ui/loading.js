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

export function showLoading() {
  const box = el("loading"); if (!box) return;
  box.hidden = false;
  box.classList.remove("error");
  box.setAttribute("role", "status");
  const text = el("loading-text"); if (text) text.textContent = loadingMessage();
  const btn = el("loading-reload"); if (btn) btn.hidden = true;
}

export function hideLoading() {
  const box = el("loading"); if (!box) return;
  box.hidden = true;
}

export function showLoadError(err) {
  const box = el("loading"); if (!box) return;
  box.hidden = false;
  box.classList.add("error");
  box.setAttribute("role", "alert");
  const text = el("loading-text"); if (text) text.textContent = errorMessage(err);
  const btn = el("loading-reload"); if (btn) btn.hidden = false;
}

// Wire the reload button and show the loading card. Called once, before the fetches start.
export function initLoading() {
  const btn = el("loading-reload");
  if (btn) btn.addEventListener("click", () => location.reload());
  showLoading();
}

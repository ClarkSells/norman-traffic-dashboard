// URL hash <-> UI state. #ward=2&metric=combined&los=E&years=2021-2025&sel=52500-158&tour=10
const METRICS = new Set(["combined", "v_c", "collisions"]);

export function stateToHash(state, tourStep) {
  const q = [];
  if (state.ward != null) q.push(`ward=${state.ward}`);
  q.push(`metric=${state.metric}`);
  q.push(`los=${state.los}`);
  q.push(`years=${state.yearMin}-${state.yearMax}`);
  if (state.includeCollectors) q.push("collectors=1");
  if (state.selectedLocId) q.push(`sel=${encodeURIComponent(state.selectedLocId)}`);
  if (state.basemap === "satellite") q.push("basemap=satellite");
  if (tourStep != null) q.push(`tour=${tourStep}`);
  return "#" + q.join("&");
}

// Returns {patch, tour} where patch holds only the valid keys found. Unknown or malformed values are ignored.
export function hashToPatch(hash) {
  const patch = {}; let tour = null;
  const s = (hash || "").replace(/^#/, "");
  if (!s) return { patch, tour };
  for (const part of s.split("&")) {
    const [k, v = ""] = part.split("=").map(decodeURIComponent);
    if (k === "ward") { if (v === "" || v === "all") patch.ward = null; else { const n = Number(v); if (Number.isInteger(n) && n >= 1 && n <= 8) patch.ward = n; } }
    else if (k === "metric" && METRICS.has(v)) patch.metric = v;
    else if (k === "los" && (v === "E" || v === "C")) patch.los = v;
    else if (k === "years") { const m = v.match(/^(\d{4})-(\d{4})$/); if (m) { let a = Number(m[1]), b = Number(m[2]); if (a > b) [a, b] = [b, a]; patch.yearMin = a; patch.yearMax = b; } }
    else if (k === "collectors") patch.includeCollectors = v === "1" || v === "true";
    else if (k === "sel") { if (/^[\w-]+$/.test(v)) patch.selectedLocId = v; }
    else if (k === "basemap" && (v === "light" || v === "satellite")) patch.basemap = v;
    else if (k === "tour") { const n = Number(v); if (Number.isInteger(n) && n >= 1) tour = n; }
  }
  return { patch, tour };
}

export function readHash() { return typeof location !== "undefined" ? hashToPatch(location.hash) : { patch: {}, tour: null }; }

// replaceState keeps the history clean while the controls change; the hash is still copyable at any moment.
export function writeHash(state, tourStep) {
  if (typeof history === "undefined" || typeof location === "undefined") return;
  const h = stateToHash(state, tourStep);
  if (location.hash !== h) history.replaceState(null, "", h);
}

// Lightweight hover tooltip over the map: segment name and the active metric. The click opens the full popup.
import { METRIC_LABEL } from "../config.js";
import { vcLabel } from "../data.js";

const num2 = (v) => (v == null ? "n/a" : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const int = (v) => Math.round(v).toLocaleString("en-US");

// One sentence for a detour segment: "plus 14,200 vpd from the closure of W Main St, v/c 0.52 to 0.81".
export function closureLine(p) {
  if (!p || !(p.closure_added > 0)) return "";
  return `plus ${int(p.closure_added)} vpd from the closure of ${p.closure_from || "the closed segment"}, v/c ${num2(p.v_c_before_closure)} to ${num2(p.v_c_active)}`;
}

export function tooltipHtml(p, state) {
  const v = state.metric === "v_c" ? p.v_c_active : state.metric === "collisions" ? p.collisions_active : p.combined_active;
  const text = v == null ? "n/a" : state.metric === "collisions" ? int(v) : num2(v);
  const label = state.metric === "v_c" ? vcLabel(state) : METRIC_LABEL[state.metric] ? METRIC_LABEL[state.metric].toLowerCase() : state.metric;
  const closed = p.is_closed ? '<div class="closure">closed in this scenario</div>' : "";
  const detour = closureLine(p);
  return `<div class="road">${p.on_road}</div><div class="span">${p.from_road} to ${p.to_road}</div><div class="score"><strong>${text}</strong> ${label}</div>${closed}${detour ? `<div class="closure">${detour}</div>` : ""}`;
}

// Keeps the tooltip inside the map box: flips to the left or above the cursor near the edges.
export function tooltipPosition(point, box, size) {
  let x = point.x + 12, y = point.y + 12;
  if (x + size.width > box.width - 8) x = point.x - size.width - 12;
  if (y + size.height > box.height - 8) y = point.y - size.height - 12;
  return { x: Math.max(4, x), y: Math.max(4, y) };
}

export function showTooltip(el, html, point, box) {
  if (!el) return;
  el.innerHTML = html; el.hidden = false;
  const size = { width: el.offsetWidth || 180, height: el.offsetHeight || 48 };
  const pos = tooltipPosition(point, box, size);
  el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
}

export function hideTooltip(el) { if (el) el.hidden = true; }

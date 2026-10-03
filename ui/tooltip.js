// Lightweight hover tooltip over the map: segment name and the active metric. The click opens the full popup.
import { METRIC_LABEL } from "../config.js";

export function tooltipHtml(p, state) {
  const v = state.metric === "v_c" ? p.v_c_active : state.metric === "collisions" ? p.collisions_active : p.combined_active;
  const text = v == null ? "n/a" : state.metric === "collisions" ? Math.round(v).toLocaleString("en-US") : Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="road">${p.on_road}</div><div class="span">${p.from_road} to ${p.to_road}</div><div class="score"><strong>${text}</strong> ${METRIC_LABEL[state.metric] ? METRIC_LABEL[state.metric].toLowerCase() : state.metric}</div>`;
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

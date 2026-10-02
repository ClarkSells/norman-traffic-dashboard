import { BREAKS, METRIC_LABEL, RAMP, WARD_COLORS, BLUE_RAMP, MUTED } from "../config.js";

function fmt(v, metric) { return metric === "v_c" ? v.toFixed(1) : String(v); }

export function renderLegend(el, state) {
  const b = BREAKS[state.metric];
  const labels = [`under ${fmt(b[0], state.metric)}`, ...b.slice(0, -1).map((v, i) => `${fmt(v, state.metric)} to ${fmt(b[i + 1], state.metric)}`), `${fmt(b[b.length - 1], state.metric)} and up`];
  const ramp = RAMP.map((c, i) => `<div class="row"><span class="swatch" style="background:${c}"></span><span>${labels[i]}</span></div>`).join("");
  const wards = Object.entries(WARD_COLORS).map(([k, c]) => `<div class="row"><span class="ward" style="background:${c}"></span><span>Ward ${k}</span></div>`).join("");
  el.innerHTML = `<div class="title">${METRIC_LABEL[state.metric]} (LOS ${state.los}, ${state.yearMin} to ${state.yearMax})</div>${ramp}
    <div class="row"><span class="swatch" style="background:#0b0b0b;height:1px;border-top:1px dashed #0b0b0b;background:none"></span><span>on a ward boundary (listed in both)</span></div>
    <div class="group title">Collisions</div>
    <div class="row"><span class="dot" style="background:${BLUE_RAMP[2]}"></span><span>assigned to a segment</span></div>
    <div class="row"><span class="dot" style="background:${MUTED}"></span><span>not on a counted segment</span></div>
    <div class="group title">Wards</div>${wards}`;
}

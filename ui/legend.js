// Compact legend: horizontal metric ramp with the break values, a line width key, the dashed boundary key and the collision keys.
import { BLUE_RAMP, BREAKS, METRIC_LABEL, RAMP } from "../config.js";
import { COLLISION_COLORS } from "../theme.js";
export { COLLISION_COLORS };

function fmt(v, metric) { return metric === "v_c" ? v.toFixed(1) : String(v); }


export function legendTitle(state) {
  return `${METRIC_LABEL[state.metric] || state.metric}, LOS ${state.los}, crashes ${state.yearMin} to ${state.yearMax}`;
}

export function renderLegend(el, state) {
  const b = BREAKS[state.metric];
  const collapsed = !!(el.classList && el.classList.contains && el.classList.contains("collapsed"));
  const ramp = RAMP.map(c => `<i style="background:${c}"></i>`).join("");
  const labels = b.map(v => `<span>${fmt(v, state.metric)}</span>`).join("");
  const low = state.metric === "v_c" ? "lower v/c" : state.metric === "collisions" ? "fewer crashes" : "lower score";
  const high = state.metric === "v_c" ? "higher v/c" : state.metric === "collisions" ? "more crashes" : "higher score";
  el.innerHTML = `<button type="button" class="legend-toggle" aria-expanded="${!collapsed}">${legendTitle(state)}</button>
    <div class="ramp" aria-hidden="true">${ramp}</div>
    <div class="ramp-labels" aria-hidden="true">${labels}</div>
    <div class="ramp-ends"><span>${low}</span><span>${high}</span></div>
    <p class="legend-sub" hidden>Breaks at ${b.map(v => fmt(v, state.metric)).join(", ")}</p>
    <div class="keys">
      <div class="row"><span class="width-key" aria-hidden="true"><i style="height:2px"></i><i style="height:4px"></i><i style="height:7px"></i></span><span>thicker line, more vehicles per day (VPD)</span></div>
      <div class="row"><span class="dash" aria-hidden="true"></span><span>on a ward boundary, listed in both wards</span></div>
      <div class="row"><span class="dot" style="background:${COLLISION_COLORS.assigned}" aria-hidden="true"></span><span>crash assigned to a segment</span></div>
      <div class="row"><span class="dot" style="background:${COLLISION_COLORS.on_road_no_segment}" aria-hidden="true"></span><span>crash not on a counted segment</span></div>
      <div class="row"><span class="heat" style="background:linear-gradient(90deg, rgba(134,182,239,0), ${BLUE_RAMP[1]}, ${BLUE_RAMP[4]})" aria-hidden="true"></span><span>crash density when zoomed out</span></div>
    </div>`;
}

// The legend title folds the legend away. On narrow screens it starts folded so the map stays visible.
export function initLegend(el, narrow) {
  const isNarrow = narrow != null ? narrow : (typeof matchMedia === "function" && matchMedia("(max-width: 800px)").matches);
  if (isNarrow) el.classList.add("collapsed");
  el.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".legend-toggle") : null;
    if (!btn) return;
    const collapsed = el.classList.toggle("collapsed");
    btn.setAttribute("aria-expanded", String(!collapsed));
  });
}

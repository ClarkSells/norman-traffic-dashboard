// ## WHAT THIS FILE DOES
// The legend pill in the map corner: the metric ramp with its break values, the width key, the boundary dash,
// the collision dot colors and the heat swatch, with a title that names the metric, the LOS and the year
// window (and the scenario when one is active). renderLegend rebuilds it on every render; initLegend wires
// the fold. Imports config.js, theme.js and data.js. Called from app.js and the legend tests.
// Compact legend: horizontal metric ramp with the break values, a line width key, the dashed boundary key and the collision keys.
import { BLUE_RAMP, BREAKS, METRIC_LABEL, RAMP } from "../config.js";
import { COLLISION_COLORS } from "../theme.js";
import { scenarioText } from "../data.js";
export { COLLISION_COLORS };

function fmt(v, metric) { return metric === "v_c" ? v.toFixed(1) : String(v); }


// ## legendTitle
// Under a Simulate scenario (C.14) the v/c in the ramp is the projected one, and the title says so:
// "Projected v/c, 2031, base band, school weekday, LOS E, crashes 2021 to 2025".
export function legendTitle(state) {
  const sc = scenarioText(state);
  const metric = !sc || state.metric === "collisions" ? (METRIC_LABEL[state.metric] || state.metric)
    : state.metric === "v_c" ? `Projected v/c, ${sc}` : `${METRIC_LABEL.combined} with projected v/c, ${sc}`;
  return `${metric}, LOS ${state.los}, crashes ${state.yearMin} to ${state.yearMax}`;
}

// ## renderLegend: the full markup, keeping the folded state across renders
export function renderLegend(el, state) {
  const b = BREAKS[state.metric];
  const collapsed = !!(el.classList && el.classList.contains && el.classList.contains("collapsed"));
  const ramp = RAMP.map(c => `<i style="background:${c}"></i>`).join("");
  const labels = b.map(v => `<span>${fmt(v, state.metric)}</span>`).join("");
  const projected = !!scenarioText(state) && state.metric !== "collisions";
  const low = state.metric === "v_c" ? (projected ? "lower projected v/c" : "lower v/c") : state.metric === "collisions" ? "fewer crashes" : "lower score";
  const high = state.metric === "v_c" ? (projected ? "higher projected v/c" : "higher v/c") : state.metric === "collisions" ? "more crashes" : "higher score";
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

// ## initLegend: the fold toggle
// The compact legend is a pill: folded it shows the title and the metric swatch row; a click on the
// title expands the full renderLegend content. `renderLegend` keeps the fold across re-renders by
// reading the "collapsed" class. Legacy boolean callers (initLegend(el, narrow)) still work.
export function initLegend(el, opts) {
  if (!el || !el.classList) return;
  const options = typeof opts === "boolean" ? { collapsed: opts } : (opts || {});
  const compact = options.compact !== false;
  if (compact) el.classList.add("compact");
  const startCollapsed = options.collapsed != null ? !!options.collapsed : compact;
  el.classList.toggle("collapsed", startCollapsed);
  // init can run after the first renderLegend (app.js order): sync the rendered toggle's state.
  const rendered = typeof el.querySelector === "function" ? el.querySelector(".legend-toggle") : null;
  if (rendered && rendered.setAttribute) rendered.setAttribute("aria-expanded", String(!startCollapsed));
  el.addEventListener("click", (e) => {
    const btn = e.target && e.target.closest ? e.target.closest(".legend-toggle") : null;
    if (!btn) return;
    const collapsed = el.classList.toggle("collapsed");
    btn.setAttribute("aria-expanded", String(!collapsed));
  });
}

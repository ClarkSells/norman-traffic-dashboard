// Traffic flow animation (contract C.6, design section 7). Three line layers over the segments source,
// one per VPD band, because line-dasharray is not data driven. The ant path trick: a dasharray whose
// dash plus gap is constant cycles the phase along the line; line-dasharray units are multiples of line width.
import { FLOW } from "../config.js";
import { primaryExpression, widthExpression } from "./segments.js";

export const FLOW_LAYERS = ["segments-flow-lo", "segments-flow-mid", "segments-flow-hi"];

// Dash and gap per VPD band, in multiples of line width (config FLOW.bands: under 8000, 8000-18000, over 18000).
const CLASSES = [
  { cls: "lo", dash: 1.2, gap: 4 },
  { cls: "mid", dash: 2, gap: 3 },
  { cls: "hi", dash: 3, gap: 2 },
];

const BEFORE_ID = "segments-selected-casing";
const r3 = (v) => Math.round(v * 1000) / 1000;

// The dasharray cycle for one class. Phase p sweeps the period in even steps; every frame's dash plus gap
// sums to dash + gap, so the last frame wraps onto the first without a seam.
export function dashSequence(dash, gap) {
  const period = dash + gap;
  const steps = Math.max(2, Math.round(period / 0.5));
  const seq = [];
  for (let k = 0; k < steps; k++) {
    const p = (k / steps) * period;
    if (p <= dash) seq.push([r3(p), r3(gap), r3(dash - p)]);
    else seq.push([0, r3(p - dash), r3(dash), r3(period - p)]);
  }
  return seq;
}

// One filter per band. Flow is drawn on the primary (arterial) network only; state.includeCollectors is not
// part of the C.6 signature, so collectors never animate.
export function flowFilter(cls) {
  const primary = primaryExpression(false);
  const vpd = ["get", "vpd_max"];
  const [b0, b1] = FLOW.bands;
  if (cls === "lo") return ["all", primary, ["<", vpd, b0]];
  if (cls === "mid") return ["all", primary, [">=", vpd, b0], ["<", vpd, b1]];
  return ["all", primary, [">=", vpd, b1]];
}

// 45 percent of the segments width curve. The scale is applied inside the per-zoom VPD outputs: the real
// library only accepts ["zoom"] as the input of a top level step or interpolate, so wrapping the curve in
// ["*", 0.45, ...] would be refused.
export function flowWidthExpression(k = 0.45) {
  const w = widthExpression();
  const out = w.slice();
  for (let i = 4; i < out.length; i += 2) {
    const inner = out[i];
    if (!Array.isArray(inner)) { if (typeof inner === "number") out[i] = r3(inner * k); continue; }
    const c = inner.slice();
    for (let j = 4; j < c.length; j += 2) if (typeof c[j] === "number") c[j] = r3(c[j] * k);
    out[i] = c;
  }
  return out;
}

// Three dashed layers above segments-line and below the selection frame. White at 85 percent is the
// present/dusk default from the design; explore theming is the caller's job via setPaintProperty.
// state.flow / state.reducedMotion are C.1 keys that land in Wave 2, so reads use tolerant fallbacks.
export function addFlowLayers(map, state = {}) {
  const visible = state.flow === true && state.reducedMotion !== true ? "visible" : "none";
  const width = flowWidthExpression();
  CLASSES.forEach(({ cls, dash, gap }, i) => {
    const id = FLOW_LAYERS[i];
    if (map.getLayer && map.getLayer(id)) return;
    map.addLayer({
      id, type: "line", source: "segments", slot: "top",
      filter: flowFilter(cls),
      layout: { "line-cap": "butt", "line-join": "round", visibility: visible },
      paint: {
        "line-color": "#ffffff",
        "line-opacity": 0.85,
        "line-width": width,
        "line-dasharray": dashSequence(dash, gap)[0],
        "line-emissive-strength": 1,
      },
    }, BEFORE_ID);
  });
}

export function setFlowVisible(map, visible) {
  for (const id of FLOW_LAYERS) {
    if (map.getLayer && !map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
}

// The animation loop. stepMsByLayer carries the per-layer phase rates (the caller picks each layer's rate
// from the median v/c of its segments, per design section 7). Frame budget: at most one setPaintProperty
// per layer per 50 ms (20 updates per second), nothing while hidden() is true, stop() cancels. The reduced
// motion decision belongs to the caller: C.6 gives startFlow no state, so it must not be started then.
export function startFlow(map, { stepMsByLayer, now, raf, caf, hidden } = {}) {
  const t = now || (typeof performance !== "undefined" ? () => performance.now() : () => Date.now());
  const request = raf || (typeof requestAnimationFrame === "function" ? requestAnimationFrame : null);
  const cancel = caf || (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame : () => {});
  const isHidden = hidden || (() => typeof document !== "undefined" && !!document.hidden);
  if (!request) return () => {};
  const stepMs = stepMsByLayer || [FLOW.stepMs.free, FLOW.stepMs.moderate, FLOW.stepMs.congested];
  const seqs = CLASSES.map(({ dash, gap }) => dashSequence(dash, gap));
  const lastStep = seqs.map(() => -1);
  let lastRun = -Infinity, handle = null, stopped = false;
  const tick = () => {
    if (stopped) return;
    const time = t();
    if (!isHidden() && time - lastRun >= 50) {
      lastRun = time;
      FLOW_LAYERS.forEach((id, i) => {
        const seq = seqs[i];
        const s = Math.floor(time / stepMs[i]) % seq.length;
        if (s !== lastStep[i]) {
          lastStep[i] = s;
          map.setPaintProperty(id, "line-dasharray", seq[s]);
        }
      });
    }
    handle = request(tick);
  };
  handle = request(tick);
  return function stop() {
    stopped = true;
    if (handle != null) cancel(handle);
    handle = null;
  };
}

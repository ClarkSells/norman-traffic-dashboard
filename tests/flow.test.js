// Run from the repo root: node tests/flow.test.js
// Flow animation layers (card 1.7, contract C.6). A recording fake map stands in for Mapbox; no browser needed.
import assert from "node:assert/strict";

const { FLOW_LAYERS, addFlowLayers, setFlowVisible, startFlow, dashSequence, flowFilter, flowWidthExpression, flowUpdateStats } = await import("../layers/flow.js");
const { widthExpression, primaryExpression } = await import("../layers/segments.js");
const { FLOW } = await import("../config.js");

function fakeMap() {
  const layers = [], calls = { paint: [], layout: [] };
  return {
    layers, calls,
    addLayer(l, beforeId) { layers.push({ ...l, beforeId }); },
    getLayer(id) { return layers.find((l) => l.id === id); },
    setPaintProperty(id, k, v) { calls.paint.push([id, k, v]); },
    setLayoutProperty(id, k, v) { calls.layout.push([id, k, v]); },
  };
}

const sum = (a) => a.reduce((x, y) => x + y, 0);

// ---- dashSequence: the cycle tiles without a seam (dash plus gap constant, phase advances evenly and wraps) ----
{
  const seq = dashSequence(2, 3);
  assert.equal(seq.length, 2 * (2 + 3), "two phase steps per width-unit of period");
  for (const a of seq) assert.ok(Math.abs(sum(a) - 5) < 1e-9, `dash plus gap is constant across the cycle: ${a}`);
  const phase = (a) => (a.length === 3 ? a[0] : 2 + a[1]);
  for (let i = 1; i < seq.length; i++) assert.ok(Math.abs(phase(seq[i]) - phase(seq[i - 1]) - 0.5) < 1e-9, "phase advances by a constant step");
  assert.ok(Math.abs(((phase(seq[seq.length - 1]) + 0.5) % 5) - phase(seq[0])) < 1e-9, "the last frame wraps onto the first with no seam");
  assert.deepEqual(seq[0], [0, 3, 2], "first frame is the resting dasharray");
  // Fractional dash (the under-8000 class uses dash 1.2) still tiles.
  const lo = dashSequence(1.2, 4);
  for (const a of lo) assert.ok(Math.abs(sum(a) - 5.2) < 1e-9, `fractional dash keeps the constant period: ${a}`);
  assert.deepEqual(lo[0], [0, 4, 1.2]);
  console.log("dashSequence checks passed");
}

// ---- flowFilter: one filter per VPD band, arterials only, pure ----
{
  const primary = primaryExpression(false);
  const vpd = ["get", "vpd_max"];
  const [b0, b1] = FLOW.bands;
  assert.deepEqual([b0, b1], [8000, 18000], "config bands unchanged");
  assert.deepEqual(flowFilter("lo"), ["all", primary, ["<", vpd, b0]]);
  assert.deepEqual(flowFilter("mid"), ["all", primary, [">=", vpd, b0], ["<", vpd, b1]]);
  assert.deepEqual(flowFilter("hi"), ["all", primary, [">=", vpd, b1]]);
  console.log("flowFilter checks passed");
}

// ---- addFlowLayers: three layers, slot top, before segments-selected-casing ----
{
  const m = fakeMap();
  addFlowLayers(m, { flow: true });
  assert.deepEqual(m.layers.map((l) => l.id), FLOW_LAYERS, "lo, mid, hi in order");
  assert.deepEqual(FLOW_LAYERS, ["segments-flow-lo", "segments-flow-mid", "segments-flow-hi"], "contract ids");
  for (const l of m.layers) {
    assert.equal(l.slot, "top", "flow layers sit in the top slot");
    assert.equal(l.beforeId, "segments-selected-casing", "inserted before the selection casing");
    assert.equal(l.type, "line");
    assert.equal(l.source, "segments");
    assert.equal(l.paint["line-color"], "#ffffff", "white dashes (present/dusk default)");
    assert.equal(l.paint["line-opacity"], 0.85, "white at 85 percent");
    assert.equal(l.paint["line-emissive-strength"], 1, "emissive so the flow reads under dusk lighting");
    assert.equal(l.layout.visibility, "visible", "state.flow true shows the layers");
  }
  assert.deepEqual(m.layers[0].filter, flowFilter("lo"));
  assert.deepEqual(m.layers[1].filter, flowFilter("mid"));
  assert.deepEqual(m.layers[2].filter, flowFilter("hi"));
  assert.deepEqual(m.layers[0].paint["line-dasharray"], dashSequence(1.2, 4)[0], "lo band: dash 1.2 gap 4");
  assert.deepEqual(m.layers[1].paint["line-dasharray"], dashSequence(2, 3)[0], "mid band: dash 2 gap 3");
  assert.deepEqual(m.layers[2].paint["line-dasharray"], dashSequence(3, 2)[0], "hi band: dash 3 gap 2");
  // Tolerant fallbacks while the C.1 keys are not in state.js yet: missing flow hides, reduced motion hides.
  const mOff = fakeMap(); addFlowLayers(mOff, {});
  assert.equal(mOff.layers[0].layout.visibility, "none", "flow defaults off when state.flow is absent");
  const mRm = fakeMap(); addFlowLayers(mRm, { flow: true, reducedMotion: true });
  assert.equal(mRm.layers[0].layout.visibility, "none", "reduced motion keeps the flow hidden");
  // Idempotent on re-add (style.load re-runs).
  const before = m.layers.length;
  addFlowLayers(m, { flow: true });
  assert.equal(m.layers.length, before, "re-adding does not duplicate layers");
  console.log("addFlowLayers checks passed");
}

// ---- width: 45 percent of segments.widthExpression(), still a top-level zoom curve ----
{
  const m = fakeMap();
  addFlowLayers(m, { flow: true });
  const base = widthExpression();
  const got = m.layers[0].paint["line-width"];
  assert.deepEqual(got, flowWidthExpression(), "the helper matches what the layers use");
  assert.equal(got[0], "interpolate");
  assert.deepEqual(got[2], ["zoom"], "top level zoom curve (the real library refuses arithmetic around one)");
  assert.equal(got.length, base.length);
  for (let i = 3; i < base.length; i += 2) {
    assert.equal(got[i], base[i], "zoom stops unchanged");
    const bi = base[i + 1], gi = got[i + 1];
    assert.equal(gi[0], "interpolate");
    for (let j = 3; j < bi.length; j += 2) {
      assert.equal(gi[j], bi[j], "VPD stops unchanged");
      assert.ok(Math.abs(gi[j + 1] - bi[j + 1] * 0.45) < 1e-9, "flow width is 45 percent of the segments width");
    }
  }
  console.log("flow width checks passed");
}

// ---- setFlowVisible ----
{
  const m = fakeMap();
  addFlowLayers(m, { flow: true });
  setFlowVisible(m, false);
  for (const id of FLOW_LAYERS) assert.deepEqual(m.calls.layout.filter(([i, k]) => i === id && k === "visibility").pop(), [id, "visibility", "none"]);
  setFlowVisible(m, true);
  for (const id of FLOW_LAYERS) assert.deepEqual(m.calls.layout.filter(([i, k]) => i === id && k === "visibility").pop(), [id, "visibility", "visible"]);
  console.log("setFlowVisible checks passed");
}

// ---- startFlow: injectable clock and raf, 50 ms budget, hidden() skips, stop() cancels ----
{
  const m = fakeMap();
  addFlowLayers(m, { flow: true });
  let t = 0, cb = null, cancelled = 0, hid = false;
  const dashCalls = () => m.calls.paint.filter(([, k]) => k === "line-dasharray");
  const stop = startFlow(m, {
    stepMsByLayer: [FLOW.stepMs.free, FLOW.stepMs.moderate, FLOW.stepMs.congested],
    now: () => t,
    raf: (fn) => { cb = fn; return 1; },
    caf: () => { cancelled++; },
    hidden: () => hid,
  });
  assert.equal(typeof stop, "function", "startFlow returns stop()");
  const frame = () => { const f = cb; cb = null; f(); };

  frame(); // t = 0: every layer gets its first dasharray
  assert.equal(dashCalls().length, 3, "first frame paints all three layers once");
  for (const [id, , v] of dashCalls()) assert.deepEqual(v[0], 0, "first frame is the resting dasharray");

  t = 20; frame();
  assert.equal(dashCalls().length, 3, "no layer repaints inside the 50 ms budget");

  t = 50; frame(); // free-flow band steps at 45 ms, the others have not moved
  assert.equal(dashCalls().length, 4, "at most one setPaintProperty per layer per 50 ms");
  assert.equal(dashCalls()[3][0], "segments-flow-lo");

  t = 100; frame(); // free band on step 2, moderate on step 1, congested still on step 0
  assert.equal(dashCalls().length, 6);
  assert.deepEqual(dashCalls().slice(4).map(([id]) => id), ["segments-flow-lo", "segments-flow-mid"]);

  hid = true; t = 1000; frame();
  assert.equal(dashCalls().length, 6, "nothing is painted while hidden() is true");

  hid = false; t = 1100; frame();
  assert.ok(dashCalls().length > 6, "painting resumes when the tab is visible again");

  stop();
  assert.equal(cancelled, 1, "stop() cancels the pending frame");
  const n = dashCalls().length;
  frame(); // a stray queued frame after stop must be a no-op
  assert.equal(dashCalls().length, n, "no painting after stop()");
  console.log("startFlow checks passed");
}

// ---- flowUpdateStats: per-update cost instrumentation (3.4-05), reset on start, frozen by stop() ----
{
  const m = fakeMap();
  addFlowLayers(m, { flow: true });
  let cb = null;
  // Each tick reads `now` three times (the 50 ms gate, then before and after the paint batch). The script
  // spaces the gates by 60 ms so every tick runs an update whose batch measures a known delta.
  const times = [0, 0, 2.5, 60, 60, 62.5, 120, 120, 123, 180, 180, 184, 240];
  const stop = startFlow(m, {
    stepMsByLayer: [FLOW.stepMs.free, FLOW.stepMs.moderate, FLOW.stepMs.congested],
    now: () => times.shift(),
    raf: (fn) => { cb = fn; return 1; },
    caf: () => {},
    hidden: () => false,
  });
  const frame = () => { const f = cb; cb = null; f(); };

  assert.deepEqual(flowUpdateStats(), { count: 0, p50: 0, p95: 0, max: 0 }, "no samples before the first update");

  for (let i = 0; i < 4; i++) frame();
  const s = flowUpdateStats();
  assert.equal(s.count, 4, "one sample per update step");
  assert.equal(s.p50, 2.5, "p50 over the scripted deltas [2.5, 2.5, 3, 4]");
  assert.equal(s.p95, 4, "p95 (nearest rank) is the top sample");
  assert.equal(s.max, 4, "max is the slowest update");

  stop();
  frame(); // a stray queued frame after stop must not add a sample
  assert.equal(flowUpdateStats().count, 4, "stop() freezes the stats");

  // A fresh startFlow resets the ring buffer so a new run measures only itself.
  const m2 = fakeMap();
  addFlowLayers(m2, { flow: true });
  let cb2 = null;
  const stop2 = startFlow(m2, {
    stepMsByLayer: [FLOW.stepMs.free, FLOW.stepMs.moderate, FLOW.stepMs.congested],
    now: () => 0,
    raf: (fn) => { cb2 = fn; return 1; },
    caf: () => {},
    hidden: () => false,
  });
  assert.equal(flowUpdateStats().count, 0, "startFlow resets the stats");
  const f2 = cb2; cb2 = null; f2();
  assert.equal(flowUpdateStats().count, 1, "the new run counts from zero");
  stop2();
  console.log("flowUpdateStats checks passed");
}

console.log("flow.test.js PASS");

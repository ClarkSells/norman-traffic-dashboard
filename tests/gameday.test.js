// Run from the repo root: node tests/gameday.test.js
// Game day overlay (C.16, C.17): routes and origins from daytypes.json, the dash loop on injectable timers, the briefing text.
import assert from "node:assert/strict";
const { GAMEDAY_DASH, GAMEDAY_LAYERS, ORIGINS_SOURCE, ROUTES_SOURCE, addGamedayLayers, originsFc, routesFc, setGamedayTheme, setGamedayVisible, startGamedayFlow } = await import("../layers/gameday.js");
const { dashSequence } = await import("../layers/flow.js");
const { gamedayText } = await import("../data.js");
const { THEMES } = await import("../theme.js");

function fakeMap() {
  const sources = {}, layers = [], paint = [], layout = [];
  return {
    sources, layers, paint, layout,
    addSource(id, s) { sources[id] = { data: s.data, setData(d) { sources[id].data = d; } }; },
    getSource(id) { return sources[id]; },
    addLayer(l, before) { const i = before ? layers.findIndex(x => x.id === before) : -1; if (i >= 0) layers.splice(i, 0, { ...l, beforeId: before }); else layers.push({ ...l, beforeId: before }); },
    getLayer(id) { return layers.find(l => l.id === id); },
    setPaintProperty(id, k, v) { paint.push([id, k, v]); },
    setLayoutProperty(id, k, v) { layout.push([id, k, v]); },
  };
}
const daytypes = { factors: {}, gameday: { vehicles: 30800, seats: 80000, occupancy: 2.6, stadium: [-97.4423, 35.2059], closures: ["52500-77"],
  origins: [{ name: "I-35 at Lindsey", lon: -97.4905, lat: 35.2067, share: 0.25 }, { name: "I-35 at Main", lon: -97.4915, lat: 35.2215, share: 0.2 }],
  routes: [{ origin: "I-35 at Lindsey", share: 0.25, path: [[-97.4905, 35.2067], [-97.46, 35.2067], [-97.4423, 35.2059]] }, { origin: "I-35 at Main", share: 0.2, path: [[-97.4915, 35.2215], [-97.4423, 35.2059]] }, { origin: "broken", share: 0.1, path: [[0, 0]] }] } };

// pure builders
const rf = routesFc(daytypes);
assert.equal(rf.features.length, 2, "a one point route is dropped");
assert.deepEqual(rf.features[0].properties, { origin: "I-35 at Lindsey", share: 0.25 }); assert.equal(rf.features[0].geometry.type, "LineString");
const of = originsFc(daytypes);
assert.equal(of.features.length, 3, "two origins plus the stadium");
assert.equal(of.features[0].properties.text, "I-35 at Lindsey, 25%"); assert.deepEqual(of.features[0].geometry.coordinates, [-97.4905, 35.2067]);
assert.equal(of.features[2].properties.kind, "stadium"); assert.deepEqual(of.features[2].geometry.coordinates, daytypes.gameday.stadium);
assert.deepEqual(routesFc(null).features, []); assert.deepEqual(originsFc({}).features, [], "no file, empty sources, no throw");
assert.equal(originsFc({ gameday: { origins: [{ name: "x", lon: 1, lat: 2 }] } }).features[0].properties.text, "x", "no share, no percent");

// briefing text from the file alone
assert.equal(gamedayText(daytypes), "OU game day: 30,800 vehicles (80,000 seats at 2.6 per vehicle), counted arriving and leaving, routed from 2 interchanges to the stadium by shortest travel time, 1 segment closed around the stadium");
assert.equal(gamedayText({ gameday: { vehicles: 30800, origins: daytypes.gameday.origins } }), "OU game day: 30,800 vehicles, counted arriving and leaving, routed from 2 interchanges to the stadium by shortest travel time", "optional fields left out");
assert.equal(gamedayText(null), "OU game day: no game day routing data loaded");
assert.ok(!gamedayText(daytypes).includes("—") && !gamedayText(daytypes).includes(" - "));

// layers: three, hidden by default, under the selection frame, dash from flow.js, idempotent
const m = fakeMap(); m.addLayer({ id: "segments-line" }); m.addLayer({ id: "segments-selected-casing" });
addGamedayLayers(m, daytypes);
assert.deepEqual(m.layers.map(l => l.id), ["segments-line", ...GAMEDAY_LAYERS, "segments-selected-casing"]);
assert.deepEqual(GAMEDAY_LAYERS, ["gameday-routes", "gameday-origins", "gameday-origin-labels"], "contract ids");
assert.equal(m.getSource(ROUTES_SOURCE).data.features.length, 2); assert.equal(m.getSource(ORIGINS_SOURCE).data.features.length, 3);
const routes = m.getLayer("gameday-routes"), origins = m.getLayer("gameday-origins"), labels = m.getLayer("gameday-origin-labels");
for (const l of [routes, origins, labels]) { assert.equal(l.layout.visibility, "none", `${l.id} hidden until game day`); assert.equal(l.slot, "top"); assert.equal(l.beforeId, "segments-selected-casing"); }
assert.equal(routes.type, "line"); assert.equal(origins.type, "circle"); assert.equal(labels.type, "symbol");
assert.deepEqual(routes.paint["line-dasharray"], dashSequence(GAMEDAY_DASH.dash, GAMEDAY_DASH.gap)[0], "resting dash is the flow.js cycle's first frame");
assert.equal(routes.paint["line-color"], THEMES.light.ink, "thin ink lines");
assert.deepEqual(labels.layout["text-field"], ["get", "text"]);
const n = m.layers.length; addGamedayLayers(m, daytypes); assert.equal(m.layers.length, n, "no duplicates on a second style load");
const mv = fakeMap(); addGamedayLayers(mv, daytypes, { visible: true }); assert.equal(mv.getLayer("gameday-routes").layout.visibility, "visible", "game day at load shows at once");
const me = fakeMap(); addGamedayLayers(me, null); assert.equal(me.layers.length, 3, "no file: empty layers, no throw");

setGamedayVisible(m, true);
for (const id of GAMEDAY_LAYERS) assert.deepEqual(m.layout.filter(([i, k]) => i === id && k === "visibility").pop(), [id, "visibility", "visible"]);
setGamedayVisible(m, false);
for (const id of GAMEDAY_LAYERS) assert.deepEqual(m.layout.filter(([i, k]) => i === id && k === "visibility").pop(), [id, "visibility", "none"]);

setGamedayTheme(m, "dark");
assert.deepEqual(m.paint.filter(([id, k]) => id === "gameday-routes" && k === "line-color").pop(), ["gameday-routes", "line-color", THEMES.dark.ink]);
setGamedayTheme(fakeMap(), "dark");   // no layers: no-op

// the dash loop: injectable clock and raf, 50 ms budget, hidden() skips, stop() cancels, no loop without raf
let t = 0, cb = null, cancelled = 0, hid = false;
const dash = () => m.paint.filter(([id, k]) => id === "gameday-routes" && k === "line-dasharray");
const stop = startGamedayFlow(m, { now: () => t, raf: (fn) => { cb = fn; return 1; }, caf: () => { cancelled++; }, hidden: () => hid, stepMs: 90 });
const frame = () => { const f = cb; cb = null; f(); };
frame(); assert.equal(dash().length, 1, "first frame paints the resting dash"); assert.deepEqual(dash()[0][2], dashSequence(2, 3)[0]);
t = 20; frame(); assert.equal(dash().length, 1, "inside the 50 ms budget nothing repaints");
t = 100; frame(); assert.equal(dash().length, 2, "a new step paints once"); assert.deepEqual(dash()[1][2], dashSequence(2, 3)[1]);
hid = true; t = 500; frame(); assert.equal(dash().length, 2, "hidden tab: no painting");
hid = false; t = 600; frame(); assert.ok(dash().length > 2, "visible again: painting resumes");
stop(); assert.equal(cancelled, 1, "stop() cancels the pending frame");
const k = dash().length; frame(); assert.equal(dash().length, k, "no painting after stop()");
assert.equal(typeof startGamedayFlow(m, { raf: null, now: () => 0 }), "function");
console.log("gameday checks passed");

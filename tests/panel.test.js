// Run from the repo root: node dashboard/tests/panel.test.js
import assert from "node:assert/strict";
import { setRaw } from "../data.js";
import { getState, setState } from "../state.js";

class El {
  constructor(id) { this.id = id; this.children = []; this.listeners = {}; this.value = ""; this.innerHTML = ""; this.checked = false; this.classList = { toggle() {} }; this.dataset = {}; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  insertAdjacentHTML(_, html) { this.innerHTML += html; }
  querySelectorAll() { return []; }
  fire(ev, extra = {}) { for (const fn of this.listeners[ev] || []) fn({ target: Object.assign(this, extra) }); }
}
const els = {}; const el = (id) => (els[id] ||= new El(id));
globalThis.document = { getElementById: el, querySelector: (sel) => el(sel) };
const { initControls, renderTable } = await import("../ui/panel.js");

const seg = (loc, wards, cls, vpd, byYear) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, shared_boundary: wards.length > 1, functional_class: cls, vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear } });
setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3 }), seg("B", [2], "Minor Arterial", 6000, { 2023: 1 })] },
         wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null });
initControls();
assert.ok(el("ward-select").innerHTML.includes('value="8"'), "8 ward options added");
assert.equal(getState().yearMax, 2023, "year max clamped to data years");
el("ward-select").value = "2"; el("ward-select").fire("change");
assert.equal(getState().ward, 2);
el("show-collectors").fire("change", { checked: true });
assert.equal(getState().includeCollectors, true);
setState({ ward: null });
const rows = renderTable(getState(), () => {});
assert.deepEqual(rows.map(r => r.loc_id), ["A", "B"]);
assert.ok(el("#rank-table tbody").innerHTML.includes('data-loc="A"') && el("stats").innerHTML.includes("segments"));
console.log("panel checks passed");

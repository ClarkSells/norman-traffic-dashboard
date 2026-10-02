// Run from the repo root: node dashboard/tests/panel_a11y.test.js
// Keyboard access to the ranking table and the narrow-screen panel toggle. Fake DOM in the style of panel.test.js.
import assert from "node:assert/strict";
import { setRaw } from "../data.js";
import { getState, setState } from "../state.js";

class El {
  constructor(id) { this.id = id; this.listeners = {}; this.value = ""; this._html = ""; this.rows = []; this.attrs = {}; this.classes = new Set(); this.textContent = ""; this.dataset = {}; this.focused = false;
    this.classList = { toggle: (c, on) => { (on === undefined ? !this.classes.has(c) : on) ? this.classes.add(c) : this.classes.delete(c); }, contains: (c) => this.classes.has(c) }; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  insertAdjacentHTML(_, html) { this._html += html; }
  focus() { this.focused = true; focusedEl = this; }
  fire(ev, e = {}) { for (const fn of this.listeners[ev] || []) fn({ target: this, preventDefault() { e.prevented = true; }, ...e }); return e; }
  // tbody: setting innerHTML materialises one fake row per <tr data-loc="...">
  set innerHTML(html) { this._html = html; this.rows = [...html.matchAll(/<tr data-loc="([^"]+)"/g)].map(m => { const tr = new El(`tr-${m[1]}`); tr.dataset.loc = m[1]; return tr; }); }
  get innerHTML() { return this._html; }
  querySelectorAll(sel) { return sel === "tr" ? this.rows : sel === "button" ? this.buttons || [] : []; }
  querySelector(sel) { const m = sel.match(/tr\[data-loc="([^"]+)"\]/); return m ? this.rows.find(r => r.dataset.loc === m[1]) : null; }
  contains(node) { return this.rows.includes(node); }
}
let focusedEl = null;
const els = {}; const el = (id) => (els[id] ||= new El(id));
globalThis.document = { getElementById: el, querySelector: (sel) => el(sel), get activeElement() { return focusedEl; } };
const { initControls, initPanelToggle, renderTable, rowKeyActivates } = await import("../ui/panel.js");

const seg = (loc, wards, cls, vpd, byYear) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, shared_boundary: wards.length > 1, functional_class: cls, vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear } });
setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3 }), seg("B", [2], "Minor Arterial", 6000, { 2023: 1 })] },
         wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null });

// Segmented controls: aria-pressed follows the active button.
const box = el("metric-toggle");
const mk = (metric) => { const b = new El(`btn-${metric}`); b.dataset.metric = metric; b.closest = () => b; return b; };
box.buttons = [mk("combined"), mk("v_c"), mk("collisions")];
initControls();
box.fire("click", { target: box.buttons[1] });
assert.equal(getState().metric, "v_c");
assert.deepEqual(box.buttons.map(b => b.getAttribute("aria-pressed")), ["false", "true", "false"], "aria-pressed tracks the active metric");
assert.ok(box.buttons[1].classList.contains("active") && !box.buttons[0].classList.contains("active"));

// Table rows: focusable, Enter and Space activate, other keys do not, focus survives the re-render.
assert.ok(rowKeyActivates({ key: "Enter" }) && rowKeyActivates({ key: " " }) && !rowKeyActivates({ key: "ArrowDown" }) && !rowKeyActivates({ key: "Tab" }));
setState({ metric: "combined", ward: null, selectedLocId: null });
let clicked = [];
const onRow = (loc) => { clicked.push(loc); setState({ selectedLocId: loc }); renderTable(getState(), onRow); };
renderTable(getState(), onRow);
const tbody = el("#rank-table tbody");
assert.equal((tbody.innerHTML.match(/tabindex="0"/g) || []).length, 2, "every row is reachable by Tab");
assert.ok(tbody.innerHTML.includes('aria-selected="false"'), "rows announce selection");
assert.ok(tbody.innerHTML.includes(">0.35<") && tbody.innerHTML.includes(">3.35<"), "v/c and score shown with two decimals");
const rowB = tbody.rows[1];
rowB.focus();
const ev = rowB.fire("keydown", { key: "Enter" });
assert.deepEqual(clicked, ["B"], "Enter on a focused row selects it");
assert.equal(ev.prevented, true, "default key action suppressed");
assert.ok(tbody.innerHTML.includes('data-loc="B" tabindex="0" class="selected" aria-selected="true"'), "selected row marked after re-render");
assert.equal(focusedEl && focusedEl.dataset.loc, "B", "focus moves to the re-rendered selected row");
tbody.rows[0].fire("keydown", { key: "ArrowDown" });
assert.deepEqual(clicked, ["B"], "other keys do not select");
tbody.rows[0].fire("keydown", { key: " " });
assert.deepEqual(clicked, ["B", "A"], "Space also selects");
tbody.rows[0].fire("click");
assert.deepEqual(clicked, ["B", "A", "A"], "mouse click still works");

// Narrow-screen panel toggle: collapses the list, announces state, flips its label.
const set = initPanelToggle();
assert.equal(typeof set, "function");
assert.equal(el("panel-toggle").getAttribute("aria-expanded"), "true");
assert.equal(el("panel-toggle").textContent, "Hide list");
assert.ok(!el("layout").classList.contains("panel-collapsed"));
el("panel-toggle").fire("click");
assert.ok(el("layout").classList.contains("panel-collapsed"), "click collapses the panel");
assert.equal(el("panel-toggle").getAttribute("aria-expanded"), "false");
assert.equal(el("panel-toggle").textContent, "Show list");
el("panel-toggle").fire("click");
assert.ok(!el("layout").classList.contains("panel-collapsed"), "second click restores it");
console.log("panel accessibility checks passed");

// Run from the repo root: node dashboard/tests/panel_a11y.test.js
// Keyboard access to the ranking table, aria-pressed on segmented controls, hover sync, the narrow-screen panel toggle.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
import { setRaw } from "../data.js";
import { getState, setState } from "../state.js";

const { el, button } = installFakeDocument();
const { highlightRow, initControls, initPanelToggle, renderTable, rowElement, rowKeyActivates } = await import("../ui/panel.js");

const seg = (loc, wards, cls, vpd, byYear) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, shared_boundary: wards.length > 1, functional_class: cls, vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear } });
setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3 }), seg("B", [2], "Minor Arterial", 6000, { 2023: 1 })] },
         wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null });

// Segmented controls: aria-pressed follows the active button.
const box = el("metric-toggle"); const btns = ["combined", "v_c", "collisions"].map(v => button(box, "metric", v));
initControls();
box.fire("click", { target: btns[1] });
assert.equal(getState().metric, "v_c");
assert.deepEqual(btns.map(b => b.getAttribute("aria-pressed")), ["false", "true", "false"], "aria-pressed tracks the active metric");
assert.ok(btns[1].classList.contains("active") && !btns[0].classList.contains("active"));

// Table rows: focusable, Enter and Space activate, other keys do not, focus survives the re-render.
assert.ok(rowKeyActivates({ key: "Enter" }) && rowKeyActivates({ key: " " }) && !rowKeyActivates({ key: "ArrowDown" }) && !rowKeyActivates({ key: "Tab" }));
setState({ metric: "combined", ward: null, selectedLocId: null });
let clicked = [], hovered = [];
const onRow = (loc) => { clicked.push(loc); setState({ selectedLocId: loc }); renderTable(getState(), onRow, { onHover: (l) => hovered.push(l) }); };
renderTable(getState(), onRow, { onHover: (l) => hovered.push(l) });
const tbody = document.querySelector("#rank-table tbody");
assert.ok(tbody.children.every(tr => tr.tabIndex === 0), "every row is reachable by Tab");
assert.equal(tbody.children[0].getAttribute("aria-selected"), "false", "rows announce selection");
const rowB = tbody.children[1];
rowB.focus();
const ev = rowB.fire("keydown", { key: "Enter" });
assert.deepEqual(clicked, ["B"], "Enter on a focused row selects it");
assert.equal(ev.prevented, true, "default key action suppressed");
assert.ok(rowElement("B").classList.contains("selected") && rowElement("B").getAttribute("aria-selected") === "true", "selected row marked after re-render");
assert.equal(document.activeElement && document.activeElement.dataset.loc, "B", "focus stays on the selected row");
tbody.children[0].fire("keydown", { key: "ArrowDown" });
assert.deepEqual(clicked, ["B"], "other keys do not select");
tbody.children[0].fire("keydown", { key: " " });
assert.deepEqual(clicked, ["B", "A"], "Space also selects");
tbody.children[0].fire("click");
assert.deepEqual(clicked, ["B", "A", "A"], "mouse click still works");

// Hover sync both ways: row hover calls the hook, map hover marks and scrolls the row.
rowElement("A").fire("mouseenter"); rowElement("A").fire("mouseleave");
assert.deepEqual(hovered.slice(-2), ["A", null], "row hover reports the segment and the leave");
highlightRow("B");
assert.ok(rowElement("B").classList.contains("hover") && rowElement("B").scrolled, "map hover highlights and scrolls the row");
highlightRow("A");
assert.ok(!rowElement("B").classList.contains("hover") && rowElement("A").classList.contains("hover"), "only one hovered row");
highlightRow(null);
assert.ok(!rowElement("A").classList.contains("hover"));

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

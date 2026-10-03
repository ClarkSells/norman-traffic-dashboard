// Run from the repo root: node dashboard/tests/panel.test.js
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
import { setRaw } from "../data.js";
import { getState, setState } from "../state.js";

const { el, button } = installFakeDocument();
const { briefingLine, briefingTitle, clampPatchYears, clampYears, emptyMessage, initControls, rangeFill, renderTable, rowCells, syncControls } = await import("../ui/panel.js");

const seg = (loc, wards, cls, vpd, byYear) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, shared_boundary: wards.length > 1, functional_class: cls, vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear } });
setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3, 2019: 1 }), seg("B", [2], "Minor Arterial", 6000, { 2023: 1 }), seg("D", [1], "Collector", 3000, { 2022: 9 })] },
         wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null });

// Pure helpers
assert.deepEqual(clampYears(2024, 2021, 2016, 2026), [2021, 2024], "swapped handles are reordered");
assert.deepEqual(clampYears(2010, 2030, 2016, 2026), [2016, 2026], "clamped to the extent");
assert.deepEqual(rangeFill(2021, 2025, 2016, 2026), { left: "50%", right: "10%" });
assert.equal(briefingTitle({ ward: null }), "All wards"); assert.equal(briefingTitle({ ward: 2 }), "Ward 2");
assert.equal(briefingLine({ ward: 2, metric: "combined", yearMin: 2021, yearMax: 2025, los: "E", includeCollectors: false }, { n: 31 }), "31 segments, ranked by combined score, crashes 2021 to 2025");
assert.equal(briefingLine({ ward: null, metric: "v_c", yearMin: 2016, yearMax: 2026, los: "C", includeCollectors: true }, { n: 1 }), "1 segment, ranked by volume to capacity ratio (v/c), crashes 2016 to 2026, capacity at LOS C, collectors included");
assert.ok(emptyMessage({ ward: 3, includeCollectors: false }).title.includes("Ward 3") && emptyMessage({ ward: 3, includeCollectors: false }).action === "Include collectors");
assert.equal(emptyMessage({ ward: null, includeCollectors: true }).action, "Reset view");
const cells = rowCells({ rank: 1, on_road: "Main", from_road: "x", to_road: "y", shared_boundary: true, is_primary: 1, v_c_active: 0.5, collisions_active: 10, combined_active: 10.5, metric_value: 10.5 }, { metric: "combined" }, 21);
assert.ok(cells.includes("width:50.0%"), "score bar scaled to the max visible score");
assert.ok(cells.includes(">0.50<") && cells.includes(">10<") && cells.includes("<span>10.50</span>") && cells.includes("boundary"), "two decimal v/c and score, integer crashes");

// Controls: segmented wards, metric, LOS, the year range and the switch all write to state.
const wardBox = el("ward-toggle"); const wardBtns = ["", "1", "2", "3", "4", "5", "6", "7", "8"].map(v => button(wardBox, "ward", v));
const metricBox = el("metric-toggle"); const metricBtns = ["combined", "v_c", "collisions"].map(v => button(metricBox, "metric", v));
const losBox = el("los-toggle"); const losBtns = ["E", "C"].map(v => button(losBox, "los", v));
initControls();
assert.equal(el("year-min").min, "2019", "slider extent widens to every year in the data"); assert.equal(el("year-max").max, "2023");
assert.equal(getState().yearMin, 2021); assert.equal(getState().yearMax, 2023, "default window clamped to the data years");
assert.equal(el("year-label").textContent, "2021 to 2023");
assert.deepEqual(clampPatchYears({ ward: 2, yearMin: 2016, yearMax: 2026 }), { ward: 2, yearMin: 2019, yearMax: 2023 }, "hash years are clamped to the data extent");
assert.deepEqual(clampPatchYears({ ward: 2 }), { ward: 2 }, "no years, no change");
assert.ok(el("year-ticks").innerHTML.includes("<span>2019</span>") && el("year-ticks").innerHTML.includes("<span>2023</span>"));
wardBox.fire("click", { target: wardBtns[2] });
assert.equal(getState().ward, 2);
wardBox.fire("click", { target: wardBtns[0] });
assert.equal(getState().ward, null, "All clears the ward");
metricBox.fire("click", { target: metricBtns[1] }); assert.equal(getState().metric, "v_c");
losBox.fire("click", { target: losBtns[1] }); assert.equal(getState().los, "C");
el("year-min").value = "2023"; el("year-max").value = "2019"; el("year-min").fire("input");
assert.equal(getState().yearMin, 2019); assert.equal(getState().yearMax, 2023, "crossed handles swap instead of producing an empty window");
el("year-min").value = "2022"; el("year-min").fire("input"); assert.equal(getState().yearMin, 2022);
el("show-collectors").checked = true; el("show-collectors").fire("change");
assert.equal(getState().includeCollectors, true);
syncControls(getState());
assert.deepEqual(losBtns.map(b => b.getAttribute("aria-pressed")), ["false", "true"], "sync reflects state into the segmented controls");
assert.equal(el("show-collectors").getAttribute("aria-checked"), "true");
assert.equal(el("year-label").textContent, "2022 to 2023");
syncControls({ ...getState(), yearMin: 2023, yearMax: 2023 }); assert.equal(el("year-label").textContent, "2023 only");

// Table and stats
setState({ ward: null, metric: "combined", los: "E", yearMin: 2021, yearMax: 2023, includeCollectors: false, selectedLocId: null });
const rows = renderTable(getState(), () => {});
assert.deepEqual(rows.map(r => r.loc_id), ["A", "B"]);
const tbody = document.querySelector("#rank-table tbody");
assert.deepEqual(tbody.children.map(c => c.dataset.loc), ["A", "B"], "one row per segment, in rank order");
assert.equal(el("stat-segments").textContent, "2"); assert.equal(el("stat-crashes").textContent, "4", "crashes in window only");
assert.ok(el("stat-top").textContent.startsWith("Main, x to y"));
assert.equal(el("briefing-title").textContent, "All wards");
assert.equal(el("briefing-line").textContent, "2 segments, ranked by combined score, crashes 2021 to 2023");
assert.equal(el("table-empty").hidden, true);
// Collectors on: D (9 crashes) leads, rows are reused and reordered
setState({ includeCollectors: true });
const rows2 = renderTable(getState(), () => {});
assert.deepEqual(rows2.map(r => r.loc_id), ["D", "A", "B"]);
assert.deepEqual(tbody.children.map(c => c.dataset.loc), ["D", "A", "B"]);
assert.ok(tbody.children[1].innerHTML.includes("Main"), "existing rows keep their content");
assert.ok(tbody.children[0].innerHTML.includes("collector"), "collector rows are tagged");
// Empty state is designed, not default text
setState({ ward: 5, includeCollectors: false });
assert.equal(renderTable(getState(), () => {}).length, 0);
assert.equal(el("table-empty").hidden, false);
assert.ok(el("table-empty").innerHTML.includes("No arterial segments to show in Ward 5") && el("table-empty").innerHTML.includes('data-action="Include collectors"'));
assert.equal(tbody.children.length, 0, "rows for other wards are removed");
assert.equal(el("stat-top").textContent, "none");
console.log("panel checks passed");

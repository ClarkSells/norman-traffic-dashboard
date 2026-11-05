// Run from the repo root: node dashboard/tests/panel.test.js
import assert from "node:assert/strict";
import { installFakeDocument, El } from "./fake_dom.js";
import { setRaw } from "../data.js";
import { getState, setState } from "../state.js";

const { el, button } = installFakeDocument();
const { briefingLine, briefingTitle, clampPatchYears, clampYears, emptyMessage, initControls, initSettings, rangeFill, renderTable, rowCells, statsLine, syncControls } = await import("../ui/panel.js");

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
// The secondary controls live in .control wrappers; the settings disclosure re-parents those wrappers at runtime.
const wrapLos = new El("div"); wrapLos.classList.add("control"); wrapLos.appendChild(losBox);
const wrapYears = new El("div"); wrapYears.classList.add("control"); wrapYears.appendChild(el("year-min"));
const wrapColl = new El("label"); wrapColl.classList.add("control"); wrapColl.appendChild(el("show-collectors"));
const wrapMetric = new El("div"); wrapMetric.classList.add("control"); wrapMetric.appendChild(metricBox);
const moreLabel = new El("span"); moreLabel.setAttribute("id", "settings-label");
const wrapMore = new El("div"); wrapMore.classList.add("control"); wrapMore.appendChild(moreLabel); wrapMore.appendChild(el("settings-toggle"));
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

// Settings disclosure: quiet by default, opens on the toggle, holds LOS, years and collectors.
assert.ok(typeof initSettings === "function", "initSettings exported");
assert.equal(el("settings").hidden, true, "settings closed by default");
assert.equal(el("settings-toggle").getAttribute("aria-expanded"), "false");
const settingsKids = el("settings").children;
assert.ok(settingsKids.includes(wrapLos) && settingsKids.includes(wrapYears) && settingsKids.includes(wrapColl), "LOS, year range and Include collectors move behind the settings disclosure");
// 3.3-02/03: the quiet Settings disclosure sits on the metric row; the labeled "More" row is gone.
const toggleHost = el("settings-toggle").parentNode;
assert.ok(toggleHost && toggleHost.classList.contains("metric-row"), "Settings moves onto the metric row");
assert.ok(toggleHost.children.includes(metricBox), "metric segmented and Settings share one row");
assert.equal(toggleHost.parentNode, wrapMetric, "the metric row stays inside the metric control");
assert.ok(!wrapMore.children.includes(el("settings-toggle")), "the More row gives up the toggle");
assert.equal(el("settings").getAttribute("aria-labelledby"), "settings-toggle", "the disclosure is named by the toggle once the More label is gone");
el("settings-toggle").fire("click");
assert.equal(el("settings").hidden, false, "toggle opens the disclosure");
assert.equal(el("settings-toggle").getAttribute("aria-expanded"), "true");
el("settings-toggle").fire("click");
assert.equal(el("settings").hidden, true, "second click closes it");
// Crash density (heat) and Traffic flow switches write state, with tolerant defaults (state.heat !== false, state.flow === true).
assert.equal(el("heat-toggle").checked, true, "crash density defaults on");
assert.equal(el("heat-toggle").getAttribute("aria-checked"), "true");
assert.equal(el("flow-toggle").checked, false, "traffic flow defaults off");
el("heat-toggle").checked = false; el("heat-toggle").fire("change");
assert.equal(getState().heat, false, "heat switch writes state.heat");
el("flow-toggle").checked = true; el("flow-toggle").fire("change");
assert.equal(getState().flow, true, "flow switch writes state.flow");
syncControls(getState());
assert.equal(el("heat-toggle").getAttribute("aria-checked"), "false");
assert.equal(el("flow-toggle").getAttribute("aria-checked"), "true", "sync reflects state.flow into the switch");
syncControls({ ...getState(), heat: undefined, flow: undefined });
assert.equal(el("heat-toggle").checked, true, "missing state.heat reads as on");
assert.equal(el("flow-toggle").checked, false, "missing state.flow reads as off");

// Table and stats
// 3.3-01: the stats line drops the years span so the top street name fits the 400 px panel.
const cityLine = statsLine({ metric: "combined", yearMin: 2021, yearMax: 2025 }, { n: 177, crashes: 5121, top: { on_road: "W Main St" } });
assert.ok(cityLine.includes("W Main St"), "the top street name is on the stats line");
assert.ok(!cityLine.includes("2021"), "the years span leaves the stats line so the street name fits");
assert.equal(cityLine, "177 segments · 5,121 crashes · top: W Main St", "stats line format");
assert.equal(statsLine({ metric: "combined", yearMin: 2023, yearMax: 2023 }, { n: 1, crashes: 4, top: { on_road: "Main" } }), "1 segment · 4 crashes · top: Main", "singular segment");
assert.equal(statsLine({ metric: "combined", yearMin: 2021, yearMax: 2025 }, { n: 0, crashes: 0, top: null }), "0 segments · 0 crashes · top: none", "empty list still reads as a sentence");
setState({ ward: null, metric: "combined", los: "E", yearMin: 2021, yearMax: 2023, includeCollectors: false, selectedLocId: null });
const rows = renderTable(getState(), () => {});
assert.deepEqual(rows.map(r => r.loc_id), ["A", "B"]);
const tbody = document.querySelector("#rank-table tbody");
assert.deepEqual(tbody.children.map(c => c.dataset.loc), ["A", "B"], "one row per segment, in rank order");
assert.equal(el("stat-segments").textContent, "2"); assert.equal(el("stat-crashes").textContent, "4", "crashes in window only");
assert.ok(el("stat-top").textContent.startsWith("Main, x to y"));
assert.equal(el("stats-line").textContent, "2 segments · 4 crashes · top: Main", "stats line driven by the same summary as the tiles");
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
assert.equal(el("stats-line").textContent, "0 segments · 0 crashes · top: none", "stats line handles the empty list");
console.log("panel checks passed");

// Simulate (C.14): the briefing line names the scenario and the closure, the v/c header follows.
{
  const { closureLine } = await import("../ui/panel.js");
  const scen = { ward: null, metric: "combined", yearMin: 2021, yearMax: 2023, los: "E", includeCollectors: false, daytype: "school_wkday", year: 2031, growthAdd: 0, band: "base", closing: null };
  assert.equal(briefingLine(scen, { n: 2 }), "2 segments, ranked by combined score, crashes 2021 to 2023, projected v/c, 2031, base band, school weekday");
  assert.equal(briefingLine({ ...scen, metric: "collisions" }, { n: 2 }), "2 segments, ranked by crash count, crashes 2021 to 2023", "crash ranking ignores the scenario");
  assert.equal(closureLine(scen), "", "nothing closed, no closure line");
  setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3 }), seg("B", [1], "Minor Arterial", 6000, { 2023: 1 })] },
           wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null,
           closures: { A: { detour_loc_ids: ["B"], added_vpd: { B: 12000 }, vc_after: { B: 0.53 }, path: [[0, 0], [1, 1]], detour_len_mi: 2.1, ratio: 1.8, flagged: false, no_path: false },
                       B: { detour_loc_ids: [], added_vpd: {}, vc_after: {}, path: [], detour_len_mi: null, ratio: null, flagged: false, no_path: true } } });
  const closed = { ...scen, daytype: "school_fri", year: 2025, closing: "A" };
  assert.equal(closureLine(closed), "Main closed: its 12,000 vpd route onto Main, v/c 0.18 to 0.53, detour 2.1 mi, 1.8 times the segment");
  assert.ok(briefingLine(closed, { n: 2 }).endsWith("projected v/c, 2025, base band, school Friday, Main closed. Main closed: its 12,000 vpd route onto Main, v/c 0.18 to 0.53, detour 2.1 mi, 1.8 times the segment"));
  assert.equal(closureLine({ ...closed, closing: "B" }), "Main closed: no detour path in the road graph, so no volume is rerouted");
  setState({ ...getState(), ...closed, selectedLocId: null });
  renderTable(getState(), () => {});
  assert.equal(el("th-vc").textContent, "projected v/c", "the v/c header switches under a scenario");
  assert.equal(el("th-vc").getAttribute("title"), "projected v/c, 2025, base band, school Friday, Main closed", "the full label rides on the header");
  setState({ metric: "v_c" });
  assert.deepEqual(renderTable(getState(), () => {}).map(r => r.loc_id), ["B", "A"], "by v/c the detour segment outranks the closed one (which reads 0)");
  setState({ closing: null, metric: "combined" });
  renderTable(getState(), () => {});
  assert.equal(el("th-vc").textContent, "v/c", "back to today");
  console.log("scenario panel checks passed");
}

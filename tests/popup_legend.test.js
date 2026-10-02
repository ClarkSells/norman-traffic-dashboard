// Run from the repo root: node dashboard/tests/popup_legend.test.js
import assert from "node:assert/strict";
const { popupHtml } = await import("../ui/popup.js");
const { renderLegend } = await import("../ui/legend.js");

const p = { loc_id: "52500-1", on_road: "36th Ave NW", from_road: "Crossroads", to_road: "Robinson", wards: "[3,8]", shared_boundary: true,
            functional_class: "Minor Arterial", lanes_final: 4, lanes_source: "city", one_way: false, vpd_max: 13990, volume_year: 2023,
            capacity_los: "E", capacity_C: 22000, capacity_E: 34200, v_c_active: 0.409, collisions_active: 22, combined_active: 22.41,
            geometry_lon: -97.494, geometry_lat: 35.236 };
const html = popupHtml(p, 5);
assert.ok(html.includes("36th Ave NW") && html.includes("3, 8 (boundary)") && html.includes("34,200") && html.includes("Rank in list"));
assert.ok(html.includes("google.com/maps/@35.236,-97.494"), "aerial link uses the segment midpoint");
assert.ok(!popupHtml({ ...p, geometry_lon: undefined, geometry_lat: undefined }).includes("google.com"), "no link without coordinates");

const el = { innerHTML: "" };
renderLegend(el, { metric: "v_c", los: "C", yearMin: 2021, yearMax: 2025 });
assert.ok(el.innerHTML.includes("Volume / capacity (LOS C, 2021 to 2025)") && el.innerHTML.includes("0.9 to 1.0") && el.innerHTML.includes("Ward 8"));
renderLegend(el, { metric: "collisions", los: "E", yearMin: 2016, yearMax: 2026 });
assert.ok(el.innerHTML.includes("100 and up"));
console.log("popup and legend checks passed");

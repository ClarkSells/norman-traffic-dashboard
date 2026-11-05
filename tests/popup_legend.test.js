// Run from the repo root: node dashboard/tests/popup_legend.test.js
import assert from "node:assert/strict";
import { setRaw } from "../data.js";
import { setState } from "../state.js";
const { popupFor, popupHtml } = await import("../ui/popup.js");
const { COLLISION_COLORS, legendTitle, renderLegend } = await import("../ui/legend.js");

const p = { loc_id: "52500-1", on_road: "36th Ave NW", from_road: "Crossroads", to_road: "Robinson", wards: "[3,8]", shared_boundary: true,
            functional_class: "Minor Arterial", lanes_final: 4, lanes_source: "verified", one_way: false, vpd_max: 13990, volume_year: 2023,
            capacity_los: "E", capacity_C: 22000, capacity_E: 34200, capacity_active: 34200, v_c_active: 0.409, collisions_active: 22, combined_active: 22.41, length_mi: 0.49,
            geometry_lon: -97.494, geometry_lat: 35.236 };
const state = { los: "E", yearMin: 2021, yearMax: 2025, metric: "combined" };
const html = popupHtml(p, { ward: 8, wardRank: 5, wardOf: 30, cityRank: 79, cityOf: 177, listed: true }, state);
assert.ok(html.includes("<h4>36th Ave NW</h4>"), "segment name is the title");
assert.ok(html.includes('<span class="chip">Ward 3</span><span class="chip">Ward 8</span>') && html.includes("boundary, listed in both"), "both ward chips for a shared boundary segment");
assert.ok(html.includes("13,990<small>VPD, 2023</small>") && html.includes("34,200<small>VPD</small>") && html.includes("capacity at LOS E") && html.includes(">0.41<") && html.includes("4<small>lanes</small>"), "four numbers with units");
assert.ok(html.includes("crashes 2021 to 2025") && html.includes(">22<"), "crashes in the selected window");
assert.ok(html.includes("22.41") && html.includes("#5 of 30 in Ward 8") && html.includes("#79 of 177 citywide, by combined score"), "combined score and both ranks");
assert.ok(!html.includes("caveat"), "no caveat on a clean segment");
assert.ok(html.includes("google.com/maps/@35.236,-97.494"), "aerial link uses the segment midpoint");
assert.ok(!popupHtml({ ...p, geometry_lon: undefined, geometry_lat: undefined }, null, state).includes("google.com"), "no link without coordinates");
assert.ok(popupHtml({ ...p, loc_id: "52500-192" }, null, state).includes('<p class="caveat">Volume is from a single FY21 count'), "caveat from caveats.js");
assert.ok(popupHtml({ ...p, loc_id: "52500-133" }, null, state).includes("approximate geometry") && (popupHtml({ ...p, loc_id: "52500-133" }, null, state).match(/class="caveat"/g) || []).length === 2);
assert.ok(popupHtml({ ...p, one_way: true }, { listed: false }, { ...state, los: "C" }).includes("one way") && popupHtml(p, { listed: false }, { ...state, los: "C" }).includes("capacity at LOS C") && popupHtml(p, { listed: false }, state).includes("Scored, not in the primary lists"));
assert.ok(!html.includes("—") && !html.includes(" - "), "no em dashes");

// popupFor derives the numbers from raw data under the state, so the popup never reads stale feature properties.
const seg = (loc, wards, cls, vpd, byYear) => ({ type: "Feature", geometry: { type: "LineString", coordinates: [[-97.5, 35.2], [-97.49, 35.21], [-97.48, 35.22]] },
  properties: { loc_id: loc, on_road: "Main", from_road: "x", to_road: "y", wards, ward_primary: wards[0], shared_boundary: wards.length > 1, functional_class: cls, vpd_max: vpd, capacity_C: 22000, capacity_E: 34200, collisions_by_year: byYear, lanes_final: 4, lanes_source: "verified", volume_year: 2023 } });
setRaw({ segments: { type: "FeatureCollection", features: [seg("A", [1], "Minor Arterial", 12000, { 2023: 3 }), seg("B", [1, 2], "Minor Arterial", 6000, { 2023: 1 })] }, wards: { features: [] }, summary: { years: [2021, 2022, 2023] }, collisions: null, points: null });
setState({ ward: null, metric: "combined", los: "C", yearMin: 2021, yearMax: 2023, includeCollectors: false, selectedLocId: null });
const built = popupFor("B");
assert.deepEqual(built.lngLat, [-97.49, 35.21], "anchored at the midpoint vertex");
assert.ok(built.html.includes("capacity at LOS C") && built.html.includes(">0.27<"), "v/c follows the LOS in state (6000 / 22000)");
assert.ok(built.html.includes("#2 of 2 in Ward 1") && built.html.includes("#2 of 2 citywide"));
assert.ok(popupFor("B", { ward: 2, metric: "combined", los: "E", yearMin: 2021, yearMax: 2023, includeCollectors: false }).html.includes("#1 of 1 in Ward 2"), "ward rank follows the selected ward when the segment is in it");
assert.equal(popupFor("nope"), null);

// Legend: horizontal ramp with the break values, width key, dashed boundary key, collision dots.
const el = { innerHTML: "" };
renderLegend(el, { metric: "v_c", los: "C", yearMin: 2021, yearMax: 2025 });
assert.equal(legendTitle({ metric: "v_c", los: "C", yearMin: 2021, yearMax: 2025 }), "Volume / capacity, LOS C, crashes 2021 to 2025");
assert.ok(el.innerHTML.includes("<span>0.5</span><span>0.7</span><span>0.9</span><span>1.0</span>"), "break values printed");
assert.equal((el.innerHTML.match(/<i style="background:#/g) || []).length, 5, "five ramp steps");
assert.ok(el.innerHTML.includes("thicker line, more vehicles per day (VPD)") && el.innerHTML.includes("on a ward boundary, listed in both wards"));
assert.ok(el.innerHTML.includes(COLLISION_COLORS.assigned) && el.innerHTML.includes("crash not on a counted segment") && el.innerHTML.includes("crash density when zoomed out"));
renderLegend(el, { metric: "collisions", los: "E", yearMin: 2016, yearMax: 2026 });
assert.ok(el.innerHTML.includes("<span>10</span><span>25</span><span>50</span><span>100</span>") && el.innerHTML.includes("more crashes"));
assert.ok(!el.innerHTML.includes("—") && !el.innerHTML.includes(" - "));
console.log("popup and legend checks passed");

// Simulate (C.14): the legend title names the projected v/c scenario; collisions are untouched by it.
const scen = { metric: "v_c", los: "E", yearMin: 2021, yearMax: 2025, daytype: "school_wkday", year: 2031, growthAdd: 0, band: "base", closing: null };
assert.equal(legendTitle(scen), "Projected v/c, 2031, base band, school weekday, LOS E, crashes 2021 to 2025");
assert.equal(legendTitle({ ...scen, metric: "combined", growthAdd: 0.02, band: "hi" }), "Combined score with projected v/c, 2031, high band, plus 2 percent per year, school weekday, LOS E, crashes 2021 to 2025");
assert.equal(legendTitle({ ...scen, metric: "collisions" }), "Collisions, LOS E, crashes 2021 to 2025", "the crash count never reads as projected");
renderLegend(el, scen);
assert.ok(el.innerHTML.includes("lower projected v/c") && el.innerHTML.includes("higher projected v/c"), "ramp ends say projected under a scenario");
console.log("scenario legend checks passed");

// Forecast block (C.13): only the fields the pipeline filled, in words.
{
  const { forecastHtml, growthText } = await import("../ui/popup.js");
  const f = { growth_base: 0.021, growth_lo: 0.011, growth_hi: 0.031, growth_method: "pairwise", growth_n_obs: 2, growth_shrink_w: 0.5,
              vc_2035_base: 0.81, vc_2035_lo: 0.74, vc_2035_hi: 0.92, year_vc_09_base: 2031, year_vc_09_lo: 2034, year_vc_09_hi: 2029,
              upgrade_tier: "6 lane divided", upgrade_lanes: 6, upgrade_divided: true, capacity_after: 58000, vc_after_upgrade: 0.61, headroom_yrs: 18,
              speed_measured: 46, speed_diff: 9, speed_flag: true };
  assert.equal(growthText(f), "2.1 percent per year, pairwise, 2 counts, shrunk 50 percent to ward median, band 1.1 percent to 3.1 percent");
  assert.equal(growthText({ growth_base: 0.015, growth_method: "ward_median", growth_n_obs: 1, growth_shrink_w: 0 }), "1.5 percent per year, ward median, 1 count");
  assert.equal(growthText({ growth_base: -0.004, growth_method: "loglin", growth_n_obs: 4, growth_shrink_w: 1 }), "-0.4 percent per year, log linear fit, 4 counts", "no shrink line when the weight is 1");
  assert.equal(growthText({ growth_base: null }), null);
  const h = forecastHtml(f);
  assert.ok(h.startsWith('<div class="forecast"><div class="k">Forecast</div>'));
  assert.ok(h.includes('<span class="k">growth</span><span class="v">2.1 percent per year, pairwise, 2 counts, shrunk 50 percent to ward median, band 1.1 percent to 3.1 percent</span>'));
  assert.ok(h.includes('<span class="k">v/c in 2035</span><span class="v">0.81 base, 0.74 to 0.92 across the bands</span>'));
  assert.ok(h.includes('<span class="k">reaches v/c 0.9</span><span class="v">2031 (2029 high band, 2034 low band)</span>'));
  assert.ok(h.includes('<span class="k">upgrade</span><span class="v">6 lane divided, v/c 0.61 in 2035 after, 18 years of headroom</span>'));
  assert.ok(h.includes('<span class="k">speed</span><span class="v">46 mph measured, 9 over the posted limit</span>'));
  assert.ok(forecastHtml({ ...f, year_vc_09_base: null, year_vc_09_lo: null, year_vc_09_hi: null }).includes("<span class=\"v\">not by 2050</span>"), "null crossing year reads as not by 2050");
  assert.ok(forecastHtml({ ...f, year_vc_09_base: 2025, year_vc_09_lo: 2027, year_vc_09_hi: null }).includes("already (not by 2050 high band, 2027 low band)"), "2025 means already");
  assert.ok(forecastHtml({ ...f, upgrade_tier: "at top tier", capacity_after: null, vc_after_upgrade: null, headroom_yrs: null }).includes("already at the top tier of the ACOG table"));
  assert.ok(forecastHtml({ ...f, headroom_yrs: 25 }).includes("25 or more years of headroom"));
  assert.ok(!forecastHtml({ ...f, speed_flag: false }).includes("speed"), "no speed line unless flagged");
  assert.ok(!forecastHtml({ ...f, vc_2035_base: null, vc_2035_lo: null, vc_2035_hi: null }).includes("v/c in 2035"), "null fields are skipped");
  assert.equal(forecastHtml({ loc_id: "x", vpd_max: 100 }), "", "nothing known, no block");
  assert.equal(forecastHtml({}), "");
  assert.ok(!h.includes("—") && !h.includes(" - "));
  // the block rides inside the popup, and an unstamped segment shows none
  assert.ok(popupHtml({ ...p, ...f }, null, state).includes('<div class="forecast">'));
  assert.ok(!popupHtml(p, null, state).includes('class="forecast"'));
  console.log("forecast block checks passed");
}

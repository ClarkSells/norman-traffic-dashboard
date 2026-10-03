// Numbers the UI and the tour may quote. Every value here traces to output/qa.json or the workbook
// (Segments_Master, Collision_Audit). Quote them exactly; never recompute or round differently.
export const LIVE_URL = "https://clarksells.github.io/norman-traffic-dashboard/";
export const PRIVATE_REPO = "https://github.com/ClarkSells/norman-traffic-case";
export const PUBLIC_REPO = "https://github.com/ClarkSells/norman-traffic-dashboard";

export const FACTS = {
  segments: 204, lanes_verified: 204, shared_boundary: 43, ward_fallback: 4, fallback_geometry: 6,
  collision_rows: 23595, assigned_in_window: 5307, year_min: 2021, year_max: 2025,
  uncounted_road_crashes: 1988, uncounted_top_ten_sum: 564,
  uncounted_top_roads: [["N Interstate Dr", 137], ["E Cedar Lane Rd", 84], ["Asp Ave", 82], ["Interstate Dr", 53], ["72nd Ave", 39]],
  ab_agreement_percent: "85.94", spot_checks_done: 29, spot_checks_passed: 27,
  rank_correlation_phrase: "the combined ranking and the crash-only ranking are nearly identical (rank correlation above 0.99); volume acts as a tiebreaker",
  v_c_max: "0.88",
};

// Citywide top 5 by combined score (combined = crashes + v/c, 2 decimals).
export const TOP5 = [
  { rank: 1, loc_id: "52500-158", name: "W Main St", span: "26th Dr W to 24th Ave W", v_c: "0.55", crashes: 168, combined: "168.55" },
  { rank: 2, loc_id: "52500-254", name: "12th Ave SE", span: "Boyd to Lindsey", v_c: "0.75", crashes: 153, combined: "153.75" },
  { rank: 3, loc_id: "52500-261", name: "12th Ave NE", span: "Morren to Alameda", v_c: "0.73", crashes: 148, combined: "148.73" },
  { rank: 4, loc_id: "52500-243", name: "Flood Ave", span: "Tecumseh Rd to Rock Creek Rd", v_c: "0.73", crashes: 125, combined: "125.73" },
  { rank: 5, loc_id: "52500-178", name: "W Robinson St", span: "36th Ave NW to I-35", v_c: "0.59", crashes: 119, combined: "119.59" },
];

// Per ward #1 by combined score.
export const WARD_TOP = { 1: ["52500-254", "153.75"], 2: ["52500-158", "168.55"], 3: ["52500-178", "119.59"], 4: ["52500-254", "153.75"], 5: ["52500-237", "61.58"], 6: ["52500-261", "148.73"], 7: ["52500-237", "61.58"], 8: ["52500-243", "125.73"] };

// Every numeric token that may appear in a caption without being computed from the data.
export function factTokens() {
  const out = new Set();
  const add = (v) => { if (v == null) return; if (Array.isArray(v)) v.forEach(add); else if (typeof v === "object") Object.values(v).forEach(add); else if (typeof v === "number") { out.add(String(v)); out.add(v.toLocaleString("en-US")); } else if (typeof v === "string") { for (const m of v.match(/\d[\d,]*\.?\d*/g) || []) out.add(m); } };
  add(FACTS); add(TOP5); add(WARD_TOP);
  return out;
}

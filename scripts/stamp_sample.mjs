// ## WHAT THIS FILE DOES
// A development only node script that writes made up Simulate data in the exact shape of CONTRACTS.md C.13
// to C.16 (forecast fields on every segment, closure_impacts.json, daytypes.json, horizon.json) so the app
// could be built before the pipeline produced the real files. The real files now ship in data/, so this is
// kept for tests and for working on the Simulate UI against a known shape. Imports node:fs, node:path,
// node:url. The stamp_sample test exercises the exported pure functions.
// Stamps SAMPLE Simulate data onto data/segments.geojson and writes data/closure_impacts.json,
// data/daytypes.json and data/horizon.json per CONTRACTS.md C.13 to C.16, so the dashboard can be
// built before the pipeline (another repo) produces the real files.
//
//   node scripts/stamp_sample.mjs            (rewrites data/ in place)
//   node scripts/stamp_sample.mjs <dir>      (reads <dir>/segments.geojson, writes into <dir>)
//
// Every value is deterministic (seeded from loc_id) and shaped like the contract, and every value
// is made up. The script says so on stdout and writes data/SAMPLE_DATA.txt saying the same. The
// real pipeline output overwrites all four files; nothing in the app may depend on a sample-only
// quirk. Re-running the script on already stamped data produces the same bytes.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BANNER = "SAMPLE DATA, not pipeline output";

// ## DAYTYPE_FACTORS and GAMEDAY: the sample assumptions
// Day type factors relative to the school year Friday count (night build spec section 3.3).
export const DAYTYPE_FACTORS = {
  school_fri: { factor: 1.0, source: "the count itself" },
  school_wkday: { factor: 0.95, source: "assumption, FHWA style weekday ratio" },
  weekend: { factor: 0.76, source: "assumption, Saturday 0.90 and Sunday 0.70 of a weekday, averaged, times 0.95" },
  summer_wkday: { formula: "0.95 * (1 - 0.15 * campus_w)", source: "assumption, campus influence fades to nothing 4 km from OU" },
  gameday: { formula: "0.95 * 0.90 * count + routed stadium volume", source: "assumption, stadium capacity 80,000 at 2.6 per vehicle, routed from the interchanges" },
};

export const GAMEDAY = {
  vehicles: 30800, seats: 80000, occupancy: 2.6,
  stadium: [-97.4423, 35.2059],
  origins: [
    { name: "I-35 at Tecumseh", lon: -97.4950, lat: 35.2607, share: 0.15 },
    { name: "I-35 at Robinson", lon: -97.4922, lat: 35.2400, share: 0.15 },
    { name: "I-35 at Main", lon: -97.4915, lat: 35.2215, share: 0.20 },
    { name: "I-35 at Lindsey", lon: -97.4905, lat: 35.2067, share: 0.25 },
    { name: "SH 9 west", lon: -97.4890, lat: 35.1855, share: 0.10 },
    { name: "Hwy 9 at 24th SE", lon: -97.4068, lat: 35.1868, share: 0.10 },
  ],
};

const CAMPUS = [-97.4440, 35.2058];
const CURRENT_YEAR = 2025, MAX_YEAR = 2050, K = 2, CLIP = [-0.03, 0.06];

// ## Deterministic randomness: the same loc_id always stamps the same values
// ---- deterministic randomness -------------------------------------------------------------------
export function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ## Geometry helpers
// ---- geometry helpers ------------------------------------------------------------------------------
export function distKm(a, b) {
  const R = 6371, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]), dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function midpoint(coords) { return coords[Math.floor(coords.length / 2)]; }
export function pathLengthMi(path) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += distKm(path[i - 1], path[i]);
  return km * 0.621371;
}

// ## Growth, horizon and the upgrade ladder
// ---- growth and horizon (mirrors src/forecast in the pipeline, with made up inputs) --------------
export function projectVpd(vpd, volumeYear, g, year) { return vpd * (1 + g) ** (year - volumeYear); }

// First calendar year, from currentYear, where the projection crosses the threshold at cap; null when never by maxYear.
export function yearCrossing(vpd, volumeYear, g, cap, threshold, currentYear = CURRENT_YEAR, maxYear = MAX_YEAR) {
  if (!cap || vpd == null) return null;
  for (let y = currentYear; y <= maxYear; y++) if (projectVpd(vpd, volumeYear, g, y) / cap >= threshold) return y;
  return null;
}

// ACOG style upgrade ladder (night build spec section 3.2). Capacities come from the lane classes already in the data.
export function upgradeTier(lanes, divided, oneWay) {
  if (oneWay) return { tier: "add one lane (one way)", lanes: lanes + 1, divided: !!divided };
  if (lanes <= 2 || lanes === 3) return { tier: "5 lane center turn", lanes: 5, divided: false };
  if (lanes === 4 && !divided) return { tier: "4 lane divided", lanes: 4, divided: true };
  if (lanes === 4 && divided) return { tier: "6 lane divided", lanes: 6, divided: true };
  if (lanes === 5) return { tier: "6 lane divided", lanes: 6, divided: true };
  if (lanes >= 6 && !divided) return { tier: "6 lane divided", lanes: 6, divided: true };
  return { tier: "at top tier", lanes, divided: !!divided };
}
const TIER_CAPACITY = { "5 lane center turn": 36000, "4 lane divided": 38000, "6 lane divided": 58000 };

// ## stampSegment: every C.13 field for one segment
export function stampSegment(p) {
  const rand = rng(seedFrom(p.loc_id));
  const nObs = [1, 2, 2, 3, 3, 4][Math.floor(rand() * 6)];
  const method = nObs === 1 ? "ward_median" : nObs === 2 ? "pairwise" : "loglin";
  const shrinkW = nObs === 1 ? 0 : nObs / (nObs + K);
  const own = -0.02 + rand() * 0.07;                    // -2 to +5 percent per year
  const wardMedian = 0.005 + rand() * 0.02;
  const base = clamp(shrinkW * own + (1 - shrinkW) * wardMedian, CLIP[0], CLIP[1]);
  const mad = 0.01 + rand() * 0.01;                     // floored at one percentage point
  const g = { base: r4(base), lo: r4(base - mad), hi: r4(base + mad) };
  const cap = p.capacity_E, vy = p.volume_year || CURRENT_YEAR, vpd = p.vpd_max;
  const out = {
    growth_base: g.base, growth_lo: g.lo, growth_hi: g.hi, growth_method: method, growth_n_obs: nObs, growth_shrink_w: r4(shrinkW),
    vpd_2025_base: r1(projectVpd(vpd, vy, g.base, 2025)), vpd_2030_base: r1(projectVpd(vpd, vy, g.base, 2030)), vpd_2035_base: r1(projectVpd(vpd, vy, g.base, 2035)),
    vpd_2035_lo: r1(projectVpd(vpd, vy, g.lo, 2035)), vpd_2035_hi: r1(projectVpd(vpd, vy, g.hi, 2035)),
  };
  out.vc_2035_base = r4(out.vpd_2035_base / cap); out.vc_2035_lo = r4(out.vpd_2035_lo / cap); out.vc_2035_hi = r4(out.vpd_2035_hi / cap);
  out.year_vc_07_base = yearCrossing(vpd, vy, g.base, cap, 0.7);
  out.year_vc_09_base = yearCrossing(vpd, vy, g.base, cap, 0.9);
  out.year_vc_09_lo = yearCrossing(vpd, vy, g.lo, cap, 0.9);
  out.year_vc_09_hi = yearCrossing(vpd, vy, g.hi, cap, 0.9);
  const up = upgradeTier(p.lanes_final, p.divided, p.one_way);
  out.upgrade_tier = up.tier; out.upgrade_lanes = up.lanes; out.upgrade_divided = up.divided;
  if (up.tier === "at top tier") { out.capacity_after = null; out.vc_after_upgrade = null; out.headroom_yrs = null; }
  else {
    out.capacity_after = TIER_CAPACITY[up.tier] || Math.round(cap * (up.lanes / Math.max(1, p.lanes_final)));
    out.vc_after_upgrade = r4(out.vpd_2035_base / out.capacity_after);
    const yc = yearCrossing(vpd, vy, g.base, out.capacity_after, 0.9, CURRENT_YEAR, CURRENT_YEAR + 25);
    out.headroom_yrs = yc == null ? 25 : Math.min(25, yc - CURRENT_YEAR);
  }
  // day types
  const mid = midpoint(p.__coords || [[CAMPUS[0], CAMPUS[1]]]);
  const campusW = r4(clamp(1 - distKm(mid, CAMPUS) / 4, 0, 1));
  const stadiumKm = distKm(mid, GAMEDAY.stadium);
  const gamedayAdded = stadiumKm < 3 ? Math.round(GAMEDAY.vehicles * 2 * clamp(1 - stadiumKm / 3, 0, 1) * (0.1 + 0.3 * rand())) : 0;
  out.dt_school_fri_vpd = vpd;
  out.dt_school_wkday_vpd = r1(vpd * DAYTYPE_FACTORS.school_wkday.factor);
  out.dt_weekend_vpd = r1(vpd * DAYTYPE_FACTORS.weekend.factor);
  out.dt_summer_wkday_vpd = r1(vpd * 0.95 * (1 - 0.15 * campusW));
  out.dt_gameday_added = gamedayAdded;
  out.dt_gameday_vpd = r1(vpd * 0.95 * 0.90 + gamedayAdded);
  for (const t of ["school_fri", "school_wkday", "weekend", "summer_wkday", "gameday"]) out[`dt_${t}_vc`] = r4(out[`dt_${t}_vpd`] / cap);
  out.campus_w = campusW;
  // speed (about a third of the segments have no speed string in the count text)
  if (rand() < 0.35) { out.speed_measured = null; out.speed_diff = null; out.speed_flag = false; }
  else {
    const posted = [30, 35, 40, 45][Math.floor(rand() * 4)];
    const measured = r1(posted - 4 + rand() * 16);
    out.speed_measured = measured; out.speed_diff = r1(measured - posted); out.speed_flag = measured - posted >= 7;
  }
  // existing fields the contract lists that the current file lacks
  out.capacity = p.capacity != null ? p.capacity : cap;
  out.v_c = p.v_c != null ? p.v_c : r4(vpd / cap);
  return out;
}

// ## stampClosures, stampDaytypes, stampHorizon: the three side files
// Closure of X: one to three nearby counted segments carry its whole volume (the pipeline puts the volume on the
// shortest detour path; here the path threads the detour segments' midpoints between X's end nodes).
export function stampClosures(features) {
  const mids = features.map(f => ({ id: f.properties.loc_id, mid: midpoint(f.geometry.coordinates), f }));
  const out = {};
  for (const { id, mid, f } of mids) {
    const rand = rng(seedFrom("closure:" + id));
    const p = f.properties;
    const noPath = rand() < 0.03;
    const near = mids.filter(m => m.id !== id).map(m => ({ ...m, d: distKm(mid, m.mid) })).sort((a, b) => a.d - b.d).slice(0, 6);
    const n = noPath ? 0 : 1 + Math.floor(rand() * 3);
    const picks = near.slice(0, n);
    const coords = f.geometry.coordinates;
    const path = noPath ? [] : [coords[0], ...picks.map(m => m.mid), coords[coords.length - 1]];
    const added = {}, vcAfter = {};
    for (const m of picks) {
      added[m.id] = p.vpd_max;
      vcAfter[m.id] = r4((m.f.properties.vpd_max + p.vpd_max) / m.f.properties.capacity_E);
    }
    const lenMi = noPath ? null : r4(pathLengthMi(path));
    const ratio = noPath || !p.length_mi ? null : r4(lenMi / p.length_mi);
    out[id] = { detour_loc_ids: picks.map(m => m.id), added_vpd: added, vc_after: vcAfter, path, detour_len_mi: lenMi, ratio, flagged: ratio != null && ratio > 3, no_path: noPath };
  }
  return out;
}

export function stampDaytypes() {
  const routes = GAMEDAY.origins.map(o => {
    const kink = [(o.lon + GAMEDAY.stadium[0]) / 2, o.lat];   // east first along the arterial, then south or north to the stadium
    return { origin: o.name, share: o.share, path: [[o.lon, o.lat], kink, [kink[0], GAMEDAY.stadium[1]], GAMEDAY.stadium] };
  });
  return { factors: DAYTYPE_FACTORS, gameday: { vehicles: GAMEDAY.vehicles, seats: GAMEDAY.seats, occupancy: GAMEDAY.occupancy, stadium: GAMEDAY.stadium, origins: GAMEDAY.origins, closures: ["52500-77"], routes } };
}

export function stampHorizon(features) {
  const byClass = {};
  for (const f of features) { const c = f.properties.functional_class || "unknown"; byClass[c] = r4(0.09 + (seedFrom(c) % 100) / 1000); }
  const sensitivity = features.map(f => {
    const p = f.properties, vy = p.volume_year || CURRENT_YEAR;
    const row = { loc_id: p.loc_id };
    [0, 0.01, 0.02].forEach((m, i) => { row[`year_vc_09_m${i}`] = yearCrossing(p.vpd_max, vy, (p.growth_base || 0) + m, p.capacity_E, 0.9); });
    return row;
  });
  return { params: { k: K, clip: CLIP, years: [2025, 2030, 2035], thresholds: [0.7, 0.9] }, backtest: { n: 93, mape: 0.14, by_class: byClass }, growth_sensitivity: sensitivity };
}

// ## stampAll and main
export function stampAll(fc) {
  const features = fc.features.map(f => {
    const stamped = stampSegment({ ...f.properties, __coords: f.geometry.coordinates });
    return { ...f, properties: { ...f.properties, ...stamped } };
  });
  const segments = { ...fc, features };
  return { segments, closures: stampClosures(features), daytypes: stampDaytypes(), horizon: stampHorizon(features) };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = process.argv[2] ? resolve(process.argv[2]) : join(here, "..", "data");
  const fc = JSON.parse(readFileSync(join(dir, "segments.geojson"), "utf8"));
  const out = stampAll(fc);
  writeFileSync(join(dir, "segments.geojson"), JSON.stringify(out.segments) + "\n");
  writeFileSync(join(dir, "closure_impacts.json"), JSON.stringify(out.closures) + "\n");
  writeFileSync(join(dir, "daytypes.json"), JSON.stringify(out.daytypes) + "\n");
  writeFileSync(join(dir, "horizon.json"), JSON.stringify(out.horizon) + "\n");
  writeFileSync(join(dir, "SAMPLE_DATA.txt"), `${BANNER}\nsegments.geojson scenario properties, closure_impacts.json, daytypes.json and horizon.json were written by scripts/stamp_sample.mjs. Every forecast, day type, closure and speed value here is made up and seeded from loc_id. Delete this file when the pipeline output lands.\n`);
  console.log(BANNER);
  console.log(`stamped ${out.segments.features.length} segments, ${Object.keys(out.closures).length} closures, ${out.daytypes.gameday.routes.length} game day routes into ${dir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

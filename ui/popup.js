// Segment popup: name, ward chips, four numbers with units, crashes in the window, combined score, ranks, caveats.
import { caveatsFor, FALLBACK_GEOMETRY_IDS } from "../caveats.js";
import { deriveProps, getRaw, rankWithin } from "../data.js";
import { getState } from "../state.js";
import { METRIC_LABEL } from "../config.js";
import { closureLine } from "./tooltip.js";

function num(v, d = 2) { return v == null ? "n/a" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function int(v) { return v == null ? "n/a" : Math.round(Number(v)).toLocaleString("en-US"); }

const METHOD_WORD = { loglin: "log linear fit", pairwise: "pairwise", ward_median: "ward median", pooled_ward: "ward pooled rate" };
const pct = (v, d = 1) => `${Number(v * 100).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} percent`;

// "1.3 percent per year, ward pooled rate, 2 counts here, 38 percent weight on the citywide rate, own trend minus 15.7 percent (noisy),
// band 0.0 to 3.0 percent". For the pooled model the shrink runs toward the citywide rate; older method tags keep the ward median wording.
export function growthText(p) {
  if (p.growth_base == null) return null;
  const parts = [`${pct(p.growth_base)} per year`];
  if (p.growth_method) parts.push(METHOD_WORD[p.growth_method] || p.growth_method);
  if (p.growth_n_obs != null) parts.push(`${int(p.growth_n_obs)} count${Number(p.growth_n_obs) === 1 ? "" : "s"} here`);
  if (p.growth_shrink_w != null && p.growth_method !== "ward_median") {
    const toward = Math.round((1 - p.growth_shrink_w) * 100);
    if (toward > 0) parts.push(p.growth_method === "pooled_ward" ? `${toward} percent weight on the citywide rate` : `shrunk ${toward} percent to ward median`);
  }
  if (p.growth_method === "pooled_ward" && p.growth_raw != null) parts.push(`own trend ${pct(p.growth_raw)} (noisy, not used)`);
  if (p.growth_lo != null && p.growth_hi != null) parts.push(`band ${pct(p.growth_lo)} to ${pct(p.growth_hi)}`);
  return parts.join(", ");
}

// The Forecast block (C.13): rows only for fields the pipeline filled. Empty string when nothing is known.
export function forecastHtml(p) {
  const rows = [];
  const g = growthText(p);
  if (g) rows.push(["growth", g]);
  if (p.vc_2035_base != null) {
    const range = p.vc_2035_lo != null && p.vc_2035_hi != null ? `, ${num(p.vc_2035_lo)} to ${num(p.vc_2035_hi)} across the bands` : "";
    rows.push(["v/c in 2035", `${num(p.vc_2035_base)} base${range}`]);
  }
  if ("year_vc_09_base" in p && (p.year_vc_09_base != null || p.vc_2035_base != null)) {
    let when = p.year_vc_09_base == null ? "not by 2050" : p.year_vc_09_base <= 2025 ? "already" : String(p.year_vc_09_base);
    if (p.year_vc_09_hi != null || p.year_vc_09_lo != null) when += ` (${p.year_vc_09_hi != null ? p.year_vc_09_hi : "not by 2050"} high band, ${p.year_vc_09_lo != null ? p.year_vc_09_lo : "not by 2050"} low band)`;
    rows.push(["reaches v/c 0.9", when]);
  }
  if (p.upgrade_tier) {
    if (p.upgrade_tier === "at top tier") rows.push(["upgrade", "already at the top tier of the ACOG table"]);
    else {
      const bits = [p.upgrade_tier];
      if (p.vc_after_upgrade != null) bits.push(`v/c ${num(p.vc_after_upgrade)} in 2035 after`);
      if (p.headroom_yrs != null) bits.push(`${Number(p.headroom_yrs) >= 25 ? "25 or more" : num(p.headroom_yrs, 0)} years of headroom`);
      rows.push(["upgrade", bits.join(", ")]);
    }
  }
  if (p.speed_flag && p.speed_measured != null) {
    rows.push(["speed", `${num(p.speed_measured, 0)} mph measured${p.speed_diff != null ? `, ${num(p.speed_diff, 0)} over the posted limit` : ""}`]);
  }
  if (!rows.length) return "";
  return `<div class="forecast"><div class="k">Forecast</div>${rows.map(([k, v]) => `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join("")}</div>`;
}

// p: raw segment properties merged with deriveProps(); ranks: rankWithin() result or null; state: for the LOS, years and metric labels.
// sites: [{ id, name, hasMesh }] from siteview.sitesForLoc(locId); renders one "View site" button per capture.
export function sitesHtml(sites) {
  if (!Array.isArray(sites) || !sites.length) return "";
  return `<div class="links sites">${sites.map(s => `<button type="button" class="btn small site-view" data-site="${s.id}">${s.hasMesh ? "View site in 3D" : "View site"}: ${s.name}</button>`).join("")}</div>`;
}

export function popupHtml(p, ranks, state, sites) {
  const st = state || { los: p.capacity_los || "E", yearMin: 2021, yearMax: 2025, metric: "combined" };
  const wards = Array.isArray(p.wards) ? p.wards : JSON.parse(p.wards || "[]");
  const cap = p.capacity_active != null ? p.capacity_active : (st.los === "C" ? p.capacity_C : p.capacity_E);
  const lon = p.geometry_lon, lat = p.geometry_lat;
  const aerial = lat && lon ? `<div class="links"><a href="https://www.google.com/maps/@${lat},${lon},120m/data=!3m1!1e3" target="_blank" rel="noopener">Open aerial view</a></div>` : "";
  const chips = wards.map(w => `<span class="chip">Ward ${w}</span>`).join("")
    + (p.shared_boundary ? '<span class="chip muted">boundary, listed in both</span>' : "")
    + `<span class="chip muted">${p.functional_class || "class unknown"}</span>`
    + (FALLBACK_GEOMETRY_IDS.includes(p.loc_id) ? '<span class="chip muted">approximate geometry</span>' : "")
    + (p.is_closed ? '<span class="chip">closed in this scenario</span>' : "");
  const metricWord = st.metric === "v_c" ? "v/c" : st.metric === "collisions" ? "crashes" : "combined score";
  const rankLine = ranks && ranks.listed
    ? `#${ranks.wardRank} of ${ranks.wardOf} in Ward ${ranks.ward}<br>#${ranks.cityRank} of ${ranks.cityOf} citywide, by ${metricWord}`
    : (ranks && !ranks.listed ? "Scored, not in the primary lists" : "");
  const caveats = caveatsFor(p.loc_id).map(t => `<p class="caveat">${t}</p>`).join("");
  const detour = closureLine(p);
  const closure = detour ? `<p class="closure">${detour}</p>` : "";
  const vcWord = p.projected ? "projected v/c" : "volume to capacity (v/c)";
  return `<div class="popup"><h4>${p.on_road}</h4><div class="span">${p.from_road} to ${p.to_road} · ${p.loc_id}</div>
    <div class="chips">${chips}</div>
    <div class="grid">
      <div class="cell"><div class="v">${int(p.vpd_max)}<small>VPD, ${p.volume_year || "year n/a"}</small></div><div class="k">volume, vehicles per day</div></div>
      <div class="cell"><div class="v">${int(p.lanes_final)}<small>${p.one_way ? "one way" : "lanes"}</small></div><div class="k">lanes, ${p.lanes_source || "source n/a"}</div></div>
      <div class="cell"><div class="v">${int(cap)}<small>VPD</small></div><div class="k">capacity at LOS ${st.los}</div></div>
      <div class="cell"><div class="v">${num(p.v_c_active)}</div><div class="k">${vcWord}</div></div>
      <div class="cell"><div class="v">${int(p.collisions_active)}</div><div class="k">crashes ${st.yearMin} to ${st.yearMax}</div></div>
      <div class="cell"><div class="v">${p.length_mi != null ? num(p.length_mi, 2) : "n/a"}<small>mi</small></div><div class="k">length${FALLBACK_GEOMETRY_IDS.includes(p.loc_id) ? ", approximate" : ""}</div></div>
    </div>
    <div class="score-row"><div><div class="k" style="font-size:10.5px;color:var(--ink-muted)">${METRIC_LABEL.combined}, crashes + v/c</div><div class="v">${num(p.combined_active)}</div></div><div class="ranks">${rankLine}</div></div>
    ${closure}${forecastHtml(p)}${caveats}${sitesHtml(sites)}${aerial}</div>`;
}

// Builds the popup content for a loc_id from the raw data under the current state. Returns null when the id is unknown.
export function popupFor(locId, state, sites) {
  const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
  if (!f) return null;
  const st = state || getState();
  const coords = f.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  const p = { ...f.properties, ...deriveProps(f.properties, st), geometry_lon: mid[0], geometry_lat: mid[1] };
  return { html: popupHtml(p, rankWithin(st, locId), st, sites), lngLat: mid, feature: f };
}

// opts.intercept(locId, lngLat) may claim a segment click (closure mode): when it returns true nothing opens
// and nothing is selected. opts.sites(locId) lists 3D site captures for the segment and opts.onSite(id) opens one.
export function attachPopup(map, onSelect, enabled, opts = {}) {
  const canOpen = typeof enabled === "function" ? enabled : () => true;
  const intercept = typeof opts.intercept === "function" ? opts.intercept : () => false;
  const sitesFor = typeof opts.sites === "function" ? opts.sites : () => [];
  const onSite = typeof opts.onSite === "function" ? opts.onSite : () => {};
  const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "340px", offset: 10 });
  const open = (locId, lngLat) => {
    const built = popupFor(locId, undefined, sitesFor(locId));
    if (!built) return null;
    popup.setLngLat(lngLat || built.lngLat).setHTML(built.html).addTo(map);
    const root = typeof popup.getElement === "function" ? popup.getElement() : null;
    if (root && typeof root.querySelectorAll === "function") {
      for (const b of root.querySelectorAll("[data-site]")) b.addEventListener("click", () => onSite(b.dataset.site || b.getAttribute("data-site")));
    }
    return popup;
  };
  const onFeatureClick = (e) => {
    if (!canOpen()) return;   // presentation never uses the popup (audit A5)
    const f = e.features[0];
    if (intercept(f.properties.loc_id, e.lngLat)) return;
    open(f.properties.loc_id, e.lngLat);
    onSelect(f.properties.loc_id);
  };
  map.on("click", "segments-line", onFeatureClick);
  map.on("click", "count-points", onFeatureClick);
  popup.open = open;
  popup.refresh = () => { if (popup.isOpen && popup.isOpen() && popup.__loc) open(popup.__loc, popup.getLngLat()); };
  const origOpen = popup.open; popup.open = (locId, lngLat) => { popup.__loc = locId; return origOpen(locId, lngLat); };
  return popup;
}

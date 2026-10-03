// Segment popup: name, ward chips, four numbers with units, crashes in the window, combined score, ranks, caveats.
import { caveatsFor, FALLBACK_GEOMETRY_IDS } from "../caveats.js";
import { deriveProps, getRaw, rankWithin } from "../data.js";
import { getState } from "../state.js";
import { METRIC_LABEL } from "../config.js";

function num(v, d = 2) { return v == null ? "n/a" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function int(v) { return v == null ? "n/a" : Math.round(Number(v)).toLocaleString("en-US"); }

// p: raw segment properties merged with deriveProps(); ranks: rankWithin() result or null; state: for the LOS, years and metric labels.
export function popupHtml(p, ranks, state) {
  const st = state || { los: p.capacity_los || "E", yearMin: 2021, yearMax: 2025, metric: "combined" };
  const wards = Array.isArray(p.wards) ? p.wards : JSON.parse(p.wards || "[]");
  const cap = p.capacity_active != null ? p.capacity_active : (st.los === "C" ? p.capacity_C : p.capacity_E);
  const lon = p.geometry_lon, lat = p.geometry_lat;
  const aerial = lat && lon ? `<div class="links"><a href="https://www.google.com/maps/@${lat},${lon},120m/data=!3m1!1e3" target="_blank" rel="noopener">Open aerial view</a></div>` : "";
  const chips = wards.map(w => `<span class="chip">Ward ${w}</span>`).join("")
    + (p.shared_boundary ? '<span class="chip muted">boundary, listed in both</span>' : "")
    + `<span class="chip muted">${p.functional_class || "class unknown"}</span>`
    + (FALLBACK_GEOMETRY_IDS.includes(p.loc_id) ? '<span class="chip muted">approximate geometry</span>' : "");
  const metricWord = st.metric === "v_c" ? "v/c" : st.metric === "collisions" ? "crashes" : "combined score";
  const rankLine = ranks && ranks.listed
    ? `#${ranks.wardRank} of ${ranks.wardOf} in Ward ${ranks.ward}<br>#${ranks.cityRank} of ${ranks.cityOf} citywide, by ${metricWord}`
    : (ranks && !ranks.listed ? "Scored, not in the primary lists" : "");
  const caveats = caveatsFor(p.loc_id).map(t => `<p class="caveat">${t}</p>`).join("");
  return `<div class="popup"><h4>${p.on_road}</h4><div class="span">${p.from_road} to ${p.to_road} · ${p.loc_id}</div>
    <div class="chips">${chips}</div>
    <div class="grid">
      <div class="cell"><div class="v">${int(p.vpd_max)}<small>VPD, ${p.volume_year || "year n/a"}</small></div><div class="k">volume, vehicles per day</div></div>
      <div class="cell"><div class="v">${int(p.lanes_final)}<small>${p.one_way ? "one way" : "lanes"}</small></div><div class="k">lanes, ${p.lanes_source || "source n/a"}</div></div>
      <div class="cell"><div class="v">${int(cap)}<small>VPD</small></div><div class="k">capacity at LOS ${st.los}</div></div>
      <div class="cell"><div class="v">${num(p.v_c_active)}</div><div class="k">volume to capacity (v/c)</div></div>
      <div class="cell"><div class="v">${int(p.collisions_active)}</div><div class="k">crashes ${st.yearMin} to ${st.yearMax}</div></div>
      <div class="cell"><div class="v">${p.length_mi != null ? num(p.length_mi, 2) : "n/a"}<small>mi</small></div><div class="k">length${FALLBACK_GEOMETRY_IDS.includes(p.loc_id) ? ", approximate" : ""}</div></div>
    </div>
    <div class="score-row"><div><div class="k" style="font-size:10.5px;color:var(--ink-muted)">${METRIC_LABEL.combined}, crashes + v/c</div><div class="v">${num(p.combined_active)}</div></div><div class="ranks">${rankLine}</div></div>
    ${caveats}${aerial}</div>`;
}

// Builds the popup content for a loc_id from the raw data under the current state. Returns null when the id is unknown.
export function popupFor(locId, state) {
  const f = getRaw().segments.features.find(x => x.properties.loc_id === locId);
  if (!f) return null;
  const st = state || getState();
  const coords = f.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  const p = { ...f.properties, ...deriveProps(f.properties, st), geometry_lon: mid[0], geometry_lat: mid[1] };
  return { html: popupHtml(p, rankWithin(st, locId), st), lngLat: mid, feature: f };
}

export function attachPopup(map, onSelect) {
  const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "340px", offset: 10 });
  const open = (locId, lngLat) => {
    const built = popupFor(locId);
    if (!built) return null;
    popup.setLngLat(lngLat || built.lngLat).setHTML(built.html).addTo(map);
    return popup;
  };
  map.on("click", "segments-line", (e) => {
    const f = e.features[0];
    open(f.properties.loc_id, e.lngLat);
    onSelect(f.properties.loc_id);
  });
  map.on("click", "count-points", (e) => {
    const f = e.features[0];
    open(f.properties.loc_id, e.lngLat);
    onSelect(f.properties.loc_id);
  });
  popup.open = open;
  popup.refresh = () => { if (popup.isOpen && popup.isOpen() && popup.__loc) open(popup.__loc, popup.getLngLat()); };
  const origOpen = popup.open; popup.open = (locId, lngLat) => { popup.__loc = locId; return origOpen(locId, lngLat); };
  return popup;
}

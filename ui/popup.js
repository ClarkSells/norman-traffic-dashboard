function num(v, d = 2) { return v == null ? "n/a" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }); }

export function popupHtml(p, rank) {
  const wards = Array.isArray(p.wards) ? p.wards : JSON.parse(p.wards || "[]");
  const cap = p.capacity_active != null ? p.capacity_active : (p.capacity_los === "C" ? p.capacity_C : p.capacity_E);
  const lon = p.geometry_lon, lat = p.geometry_lat;
  const aerial = lat && lon ? `<a href="https://www.google.com/maps/@${lat},${lon},120m/data=!3m1!1e3" target="_blank" rel="noopener">open aerial</a>` : "";
  return `<div class="popup"><h4>${p.on_road}</h4><div class="span">${p.from_road} to ${p.to_road} · ${p.loc_id}</div>
    <table>
      <tr><td>Ward${wards.length > 1 ? "s" : ""}</td><td>${wards.join(", ")}${p.shared_boundary ? " (boundary)" : ""}</td></tr>
      <tr><td>Class</td><td>${p.functional_class || "unknown"}</td></tr>
      <tr><td>Lanes</td><td>${num(p.lanes_final, 0)} (${p.lanes_source})${p.one_way ? ", one way" : ""}</td></tr>
      <tr><td>Volume</td><td>${num(p.vpd_max, 0)} vpd (${p.volume_year})</td></tr>
      <tr><td>Capacity</td><td>${num(cap, 0)} vpd</td></tr>
      <tr><td>v/c</td><td>${num(p.v_c_active)}</td></tr>
      <tr><td>Collisions</td><td>${num(p.collisions_active, 0)}</td></tr>
      <tr><td>Combined</td><td>${num(p.combined_active)}</td></tr>
      ${rank ? `<tr><td>Rank in list</td><td>${rank}</td></tr>` : ""}
    </table>${aerial}</div>`;
}

export function attachPopup(map, onSelect) {
  const popup = new mapboxgl.Popup({ closeButton: true, maxWidth: "300px" });
  map.on("click", "segments-line", (e) => {
    const f = e.features[0];
    const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)];
    const p = { ...f.properties, geometry_lon: mid[0], geometry_lat: mid[1] };
    popup.setLngLat(e.lngLat).setHTML(popupHtml(p)).addTo(map);
    onSelect(f.properties.loc_id);
  });
  map.on("mouseenter", "segments-line", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "segments-line", () => { map.getCanvas().style.cursor = ""; });
  return popup;
}

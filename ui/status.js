// Terminal style status line in the map corner: zoom, centre, what is on screen. Pure text builder plus a thin binding.
export function statusText({ zoom, lng, lat, pitch, bearing }, shown, total, extra = "") {
  const z = Number.isFinite(zoom) ? `Z ${zoom.toFixed(1)}` : "";
  const ll = Number.isFinite(lng) && Number.isFinite(lat) ? `${Math.abs(lat).toFixed(4)}${lat >= 0 ? "N" : "S"} ${Math.abs(lng).toFixed(4)}${lng >= 0 ? "E" : "W"}` : "";
  const cam = (pitch > 0.5 || Math.abs(bearing) > 0.5) ? `PITCH ${Math.round(pitch)} BRG ${Math.round(bearing)}` : "";
  const n = Number.isFinite(shown) && Number.isFinite(total) ? `${shown}/${total} SEGMENTS` : "";
  return [z, ll, cam, n, extra].filter(Boolean).join("  ·  ");
}

export function renderStatus(el, cam, shown, total, extra) {
  if (!el) return;
  const text = statusText(cam, shown, total, extra);
  if (el.textContent !== text) el.textContent = text;
}

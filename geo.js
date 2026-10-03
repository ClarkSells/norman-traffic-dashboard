// Small geographic helpers, pure functions, no Mapbox. Coordinates are [lng, lat].
const R = 6371000;
const rad = (d) => d * Math.PI / 180;

export function metersBetween(a, b) {
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Area weighted centroid of a polygon ring (outer ring only). Falls back to the vertex mean for degenerate rings.
export function polygonCentroid(ring) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-12) {
    const n = ring.length; return [ring.reduce((s, p) => s + p[0], 0) / n, ring.reduce((s, p) => s + p[1], 0) / n];
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

// Point features at the centroid of each ward polygon, for the label layer.
export function wardCentroids(wards) {
  return { type: "FeatureCollection", features: (wards.features || []).map(f => {
    const ring = f.geometry.type === "Polygon" ? f.geometry.coordinates[0]
      : f.geometry.coordinates.reduce((best, poly) => (poly[0].length > (best ? best.length : 0) ? poly[0] : best), null);
    return { type: "Feature", geometry: { type: "Point", coordinates: polygonCentroid(ring) }, properties: { Ward_num: f.properties.Ward_num, name: `Ward ${f.properties.Ward_num}` } };
  }) };
}

// Compass bearing in degrees (0 north, 90 east) from a to b.
export function bearing(a, b) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// The direction a road runs: bearing from the first vertex to the last, folded to 0..180 so east and west read the same.
export function dominantBearing(coords) {
  if (!coords || coords.length < 2) return 0;
  const b = bearing(coords[0], coords[coords.length - 1]);
  return b >= 180 ? b - 180 : b;
}

// Map bearing that lays the road across the screen (left to right). Mapbox bearing rotates the map clockwise.
export function bearingAcrossScreen(coords) {
  const b = dominantBearing(coords);
  let m = b - 90;            // road bearing 90 (east-west) -> map bearing 0
  if (m < -90) m += 180;     // keep the rotation small, within -90..90
  return m;
}

export function lineBounds(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  return [[w, s], [e, n]];
}

export function lineMidpoint(coords) { return coords[Math.floor(coords.length / 2)]; }

// Distance in meters from a point to a polyline, using a local equirectangular projection (fine at city scale).
export function metersToLine(p, coords) {
  const kx = Math.cos(rad(p[1])) * 111320, ky = 110540;
  const px = p[0] * kx, py = p[1] * ky;
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = coords[i][0] * kx, ay = coords[i][1] * ky, bx = coords[i + 1][0] * kx, by = coords[i + 1][1] * ky;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

// Nearest segment feature within maxMeters of a point, or null.
export function nearestSegment(p, features, maxMeters = 300) {
  let best = null, bestD = maxMeters;
  for (const f of features || []) {
    const d = metersToLine(p, f.geometry.coordinates);
    if (d <= bestD) { bestD = d; best = f; }
  }
  return best ? { feature: best, meters: bestD } : null;
}

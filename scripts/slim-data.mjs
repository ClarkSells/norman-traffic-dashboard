// ## WHAT THIS FILE DOES
// A one off node script that shrinks data/collisions.geojson to the slim shape the dashboard reads (short
// property keys, rounded coordinates, out of window rows dropped) and writes collisions.meta.json beside it.
// Run after the pipeline (another repo) refreshes the file. The pure helpers are exported for the slim_data
// test; main runs only when the file is executed directly. Imports node:fs, node:zlib, node:path, node:url.
// Slims data/collisions.geojson per CONTRACTS.md C.12 and rewrites it in place.
//
//   node scripts/slim-data.mjs
//
// Output features carry only { y, c, l? }: coordinates rounded to 5 decimals,
// c in a/s/n/r/x (assigned, shared_intersection_resolved, on_road_no_segment,
// road_not_counted, other), l omitted when there is no loc id. Rows the
// pipeline flagged "outside_year_window" (outside the 2021-2025 analysis
// window in facts.js) are dropped; keeping them would put the file over its
// byte budget and the dashboard never renders them. Already slim input is
// detected and passed through, so a second run leaves the file byte identical.
// Also writes data/collisions.meta.json: { features, years, bytes, gzipBytes, writtenAt }.
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ## CAT_CODE and DROP_CATS: the category coding from CONTRACTS.md C.12
export const CAT_CODE = {
  assigned: "a",
  shared_intersection_resolved: "s",
  on_road_no_segment: "n",
  road_not_counted: "r",
};

// Pipeline category for rows outside the analysis window (facts.js:
// year_min 2021, year_max 2025). Dropped, not coded.
export const DROP_CATS = new Set(["outside_year_window"]);

// ## round5 and codeFor
export function round5(v) {
  const r = Math.round(v * 1e5) / 1e5;
  return r === 0 ? 0 : r; // normalize -0 so serialization stays stable
}

export function codeFor(cat) {
  return CAT_CODE[cat] || "x"; // anything else -> other
}

function isSlimProps(p) {
  return p != null && typeof p === "object" && "y" in p && "c" in p;
}

function roundCoords(coords) {
  return coords.map((c) => (Array.isArray(c) ? roundCoords(c) : round5(c)));
}

// ## slimFeature and slimCollection
// One verbose feature -> one slim feature, or null when the row is dropped.
// Already slim features are re-emitted with identical shape and key order.
export function slimFeature(feature) {
  const p = feature.properties || {};
  const geometry = { type: feature.geometry.type, coordinates: roundCoords(feature.geometry.coordinates) };
  if (isSlimProps(p)) {
    const properties = { y: p.y, c: p.c };
    if (p.l != null) properties.l = p.l;
    return { type: "Feature", geometry, properties };
  }
  if (DROP_CATS.has(p.cat)) return null;
  const properties = { y: p.year, c: codeFor(p.cat) };
  if (p.loc_id != null) properties.l = p.loc_id;
  return { type: "Feature", geometry, properties };
}

export function slimCollection(fc) {
  const features = [];
  for (const f of fc.features || []) {
    const slim = slimFeature(f);
    if (slim) features.push(slim);
  }
  return { type: "FeatureCollection", features };
}

// ## serialize and buildMeta
// Compact single line JSON: smallest on disk and deterministic, which is what
// makes the in place rewrite idempotent byte for byte.
export function serialize(fc) {
  return JSON.stringify(fc);
}

export function buildMeta(fc, bytes, gzipBytes, now = new Date()) {
  const ys = fc.features.map((f) => f.properties.y).filter((y) => typeof y === "number");
  return {
    features: fc.features.length,
    years: ys.length ? [Math.min(...ys), Math.max(...ys)] : [null, null],
    bytes,
    gzipBytes,
    writtenAt: now.toISOString(),
  };
}

// ## main: read, slim, write, report
function main() {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const dataPath = join(root, "data", "collisions.geojson");
  const metaPath = join(root, "data", "collisions.meta.json");

  const beforeBuf = readFileSync(dataPath);
  const before = JSON.parse(beforeBuf.toString("utf8"));

  const slim = slimCollection(before);
  const beforeCount = before.features.length;
  const afterText = serialize(slim);
  const afterBuf = Buffer.from(afterText, "utf8");
  const meta = buildMeta(slim, afterBuf.length, gzipSync(afterBuf).length);

  writeFileSync(dataPath, afterBuf);
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");

  console.log("data/collisions.geojson slimmed per C.12");
  console.log(`  features: ${beforeCount} -> ${meta.features} (outside_year_window rows dropped)`);
  console.log(`  bytes:    ${beforeBuf.length} -> ${meta.bytes}`);
  console.log(`  gzip:     ${gzipSync(beforeBuf).length} -> ${meta.gzipBytes}`);
  console.log(`  years:    ${meta.years[0]}-${meta.years[1]}`);
  console.log(`  meta:     data/collisions.meta.json (writtenAt ${meta.writtenAt})`);
}

const invokedAs = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedAs === fileURLToPath(import.meta.url)) main();

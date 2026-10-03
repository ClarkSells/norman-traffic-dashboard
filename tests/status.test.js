// Run from the repo root: node dashboard/tests/status.test.js
import assert from "node:assert/strict";
import { renderStatus, statusText } from "../ui/status.js";

assert.equal(statusText({ zoom: 11.6, lng: -97.43, lat: 35.225, pitch: 0, bearing: 0 }, 177, 204), "Z 11.6  ·  35.2250N 97.4300W  ·  177/204 SEGMENTS");
assert.equal(statusText({ zoom: 15.57, lng: -97.43, lat: 35.225, pitch: 45, bearing: -88 }, 42, 204, "WARD 4"), "Z 15.6  ·  35.2250N 97.4300W  ·  PITCH 45 BRG -88  ·  42/204 SEGMENTS  ·  WARD 4");
assert.equal(statusText({ zoom: NaN, lng: NaN, lat: NaN, pitch: 0, bearing: 0 }, NaN, NaN), "", "nothing known, nothing printed");
assert.equal(statusText({ zoom: 12, lng: 10, lat: -5, pitch: 0, bearing: 0 }, 1, 2), "Z 12.0  ·  5.0000S 10.0000E  ·  1/2 SEGMENTS", "hemispheres");
const el = { textContent: "" };
renderStatus(el, { zoom: 11.6, lng: -97.43, lat: 35.225, pitch: 0, bearing: 0 }, 177, 204);
assert.ok(el.textContent.startsWith("Z 11.6"));
renderStatus(null, {}, 0, 0);
console.log("status line checks passed");

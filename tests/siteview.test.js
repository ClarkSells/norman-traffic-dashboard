// Run from the repo root: node tests/siteview.test.js
// Site view: index lookup by segment, open() with no mesh falls back to the map camera plus label markers, close() removes them.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";

const { document } = installFakeDocument();
document.head = document.createElement("head");
document.addEventListener = (ev, fn) => { (document.listeners ||= {})[ev] = fn; };
const { initSiteView } = await import("../ui/siteview.js");

const index = { site01: { name: "W Main St at 24th Ave NW", lat: 35.2184, lon: -97.4767, loc_ids: ["52500-158", "52500-283"], score: 328.8, has_mesh: false, streetview: [] } };
const site = { site_id: "site01", name: "W Main St at 24th Ave NW", center: { lon: -97.4767, lat: 35.2184 }, size_m: 160, loc_ids: ["52500-158", "52500-283"], mesh: "mesh.glb",
               labels: [{ kind: "intersection", text: "W Main St at 24th Ave NW", lon: -97.4767, lat: 35.2184, x: 0, y: 6, z: 0 },
                        { kind: "segment", loc_id: "52500-158", text: "W Main St: 5 lanes", lon: -97.4771, lat: 35.2184, x: -40, y: 6, z: 0 }] };
const fetched = [];
const fetchJson = async (u) => { fetched.push(u); if (u.endsWith("index.json")) return index; if (u.endsWith("site01/site.json")) return site; throw new Error("404 " + u); };

const flights = []; const markers = [];
globalThis.mapboxgl = { Marker: class { constructor(o) { this.o = o; } setLngLat(ll) { this.ll = ll; return this; } addTo() { markers.push(this); return this; } remove() { markers.splice(markers.indexOf(this), 1); } } };
const map = { flyTo: (o) => flights.push(o) };

const sv = initSiteView(map, { fetchJson, base: "sites/" });
await sv.ready;
assert.deepEqual(sv.sitesForLoc("52500-158"), [{ id: "site01", name: "W Main St at 24th Ave NW", hasMesh: false }], "segment to site lookup");
assert.deepEqual(sv.sitesForLoc("52500-1"), [], "segments without a site get an empty list");

assert.equal(await sv.open("nope"), false, "unknown site id is refused");
assert.equal(await sv.open("site01"), true, "known site opens");
assert.ok(fetched.includes("sites/site01/site.json"), "site.json fetched from the sites folder");
assert.equal(flights.length, 1, "no mesh: the map flies to the site");
assert.equal(flights[0].pitch, 60);
assert.deepEqual(flights[0].center, [-97.4767, 35.2184]);
assert.equal(markers.length, 2, "one marker per label");
assert.deepEqual(markers[0].ll, [-97.4767, 35.2184]);
const root = document.body.children.find(c => c.classes.has("siteview"));
assert.ok(root && root.hidden === false, "overlay shown");
assert.equal(root.children[0].children[0].textContent, "W Main St at 24th Ave NW", "title is the site name");
assert.ok(root.children[1].children.find(c => c.classes.has("siteview-note")).textContent.includes("No 3D capture yet"), "fallback note names the missing capture");
assert.ok(root.children[2].children[0].textContent.includes("No Street View"), "empty strip says so");

sv.close();
assert.equal(markers.length, 0, "close removes the markers");
assert.equal(root.hidden, true, "close hides the overlay");
document.listeners.keydown({ key: "Escape" });
console.log("site view checks passed");

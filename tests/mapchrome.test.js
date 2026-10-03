// Run from the repo root: node dashboard/tests/mapchrome.test.js
// Map chrome: scale control bottom left, north arrow when rotated, recenter when outside the city; all hidden while presenting.
import assert from "node:assert/strict";
import { El } from "./fake_dom.js";
const { initMapChrome } = await import("../ui/mapchrome.js");

function makeMap(center = [-97.43, 35.225], bearing = 0) {
  const listeners = {};
  const calls = { easeTo: [], fitBounds: [], addControl: [], removeControl: [] };
  return {
    calls, center, bearing,
    on(ev, fn) { (listeners[ev] ||= []).push(fn); return this; },
    off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return this; },
    fire(ev) { for (const fn of [...(listeners[ev] || [])]) fn({ type: ev }); },
    getBearing() { return this.bearing; },
    getCenter() { return { lng: this.center[0], lat: this.center[1] }; },
    easeTo(o) { calls.easeTo.push(o); if (o.bearing != null) this.bearing = o.bearing; return this; },
    fitBounds(b, o) { calls.fitBounds.push([b, o]); return this; },
    addControl(c, pos) { calls.addControl.push([c, pos]); if (c && c.onAdd) c.onAdd(this); return this; },
    removeControl(c) { calls.removeControl.push(c); if (c && c.onRemove) c.onRemove(); return this; },
  };
}

class FakeScale {
  constructor(opts) { this.opts = opts; this.added = 0; this.removed = 0; }
  onAdd() { this.added++; return {}; }
  onRemove() { this.removed++; }
}

const cityBounds = [[-97.54741, 35.14546], [-97.17692, 35.34832]];
const northEl = new El("button", "map-north"); northEl.hidden = true;
const recenterEl = new El("button", "map-recenter"); recenterEl.hidden = true;

const map = makeMap();
const chrome = initMapChrome(map, { northEl, recenterEl, cityBounds, ScaleControl: FakeScale });
assert.equal(map.calls.addControl.length, 1, "scale control added");
assert.equal(map.calls.addControl[0][1], "bottom-left", "scale sits bottom left");
assert.ok(northEl.hidden && recenterEl.hidden, "north and recenter hidden while north-up inside the city");

// Bearing past 1 degree shows the north arrow; a click resets north with easeTo.
map.bearing = 25; map.fire("rotate");
assert.equal(northEl.hidden, false, "north arrow shows when rotated");
northEl.fire("click");
assert.deepEqual(map.calls.easeTo[0], { bearing: 0 }, "click resets bearing with easeTo");
map.fire("move");
assert.equal(northEl.hidden, true, "hidden again at bearing 0");
map.bearing = 0.5; map.fire("rotate");
assert.equal(northEl.hidden, true, "bearing within 1 degree stays hidden");
map.bearing = -2; map.fire("rotate");
assert.equal(northEl.hidden, false, "negative bearing past 1 degree shows it too");
map.bearing = 0; map.fire("move");

// Leaving the city bounds shows recenter; a click flies home with fitBounds.
map.center = [-98.2, 35.9]; map.fire("move");
assert.equal(recenterEl.hidden, false, "recenter shows outside the city");
recenterEl.fire("click");
assert.equal(map.calls.fitBounds.length, 1);
assert.deepEqual(map.calls.fitBounds[0][0], cityBounds, "click fits the city bounds");
map.center = [-97.43, 35.225]; map.fire("move");
assert.equal(recenterEl.hidden, true, "hidden again back inside");
map.center = [-97.54741, 35.34832]; map.fire("move");
assert.equal(recenterEl.hidden, true, "a center on the bounds edge still counts as inside");
map.center = [-97.43, 35.225]; map.fire("move");

// Presenting hides all chrome and removes the scale control; exiting restores it.
map.bearing = 30; map.fire("rotate");
assert.equal(northEl.hidden, false);
chrome.setPresenting(true);
assert.equal(northEl.hidden, true, "north hidden while presenting");
assert.equal(recenterEl.hidden, true, "recenter hidden while presenting");
assert.equal(map.calls.removeControl.length, 1, "scale control removed while presenting");
map.bearing = -40; map.fire("rotate");
assert.equal(northEl.hidden, true, "events cannot unhide chrome while presenting");
chrome.setPresenting(false);
assert.equal(map.calls.addControl.length, 2, "scale control restored on exit");
assert.equal(northEl.hidden, false, "visibility re-evaluated on exit");

// Without a ScaleControl anywhere (the e2e stub lacks one), chrome skips it gracefully.
const map2 = makeMap();
const chrome2 = initMapChrome(map2, { northEl: new El("button"), recenterEl: new El("button"), cityBounds });
assert.equal(map2.calls.addControl.length, 0, "no control added when ScaleControl is unavailable");
chrome2.setPresenting(true);
chrome2.setPresenting(false);
console.log("mapchrome checks passed");

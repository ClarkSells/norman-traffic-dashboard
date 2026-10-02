// Run from the repo root: node dashboard/tests/help.test.js
// Fake DOM in the style of panel.test.js; checks the help text and the toggle behaviour.
import assert from "node:assert/strict";

class El {
  constructor(id) { this.id = id; this.listeners = {}; this.innerHTML = ""; this.hidden = false; this.attrs = {}; this.classes = new Set(); this.focused = false;
    this.classList = { toggle: (c, on) => { on ? this.classes.add(c) : this.classes.delete(c); }, contains: (c) => this.classes.has(c) }; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  focus() { this.focused = true; }
  fire(ev, e = {}) { for (const fn of this.listeners[ev] || []) fn(e); }
}
const els = {}; const el = (id) => (els[id] ||= new El(id));
globalThis.document = { getElementById: el, querySelector: (sel) => el(sel) };
const { helpHtml, initHelp } = await import("../ui/help.js");

// Text: every term a councilmember needs, spelled out, counts taken from the qa block, no em dashes.
const html = helpHtml({ segments: 204, segments_shared_boundary: 43, segments_geometry_fallback: 6 });
for (const term of ["Volume to capacity ratio (v/c)", "vehicles per day (VPD)", "Level of service (LOS)", "Combined score", "Shared boundary segments", "Fallback geometry",
                    "principal arterial, minor arterial and collector", "counted once and listed in both neighboring wards", "nearly identical", "tiebreaker"]) {
  assert.ok(html.includes(term), `help text explains: ${term}`);
}
assert.ok(html.includes("43 of the 204 segments") && html.includes("6 of the 204 segments"), "counts come from the qa block");
assert.ok(!html.includes("—") && !html.includes(" - "), "no em dashes or spaced hyphens in prose");
assert.ok(!/0\.9995|9 of 10|1\.084/.test(html), "no irreproducible figures from the judge review");
const fallbackHtml = helpHtml(undefined);
assert.ok(fallbackHtml.includes("43 of the 204") && fallbackHtml.includes("6 of the 204"), "static fallback counts when summary.json is missing");
assert.ok(helpHtml({ segments: 210, segments_shared_boundary: 40, segments_geometry_fallback: 2 }).includes("2 of the 210"), "counts follow a rerun");

// Toggle: closed by default, button announces state, click opens and closes, Escape closes and returns focus.
const set = initHelp({ segments: 204 });
assert.equal(typeof set, "function");
assert.equal(el("help-box").hidden, true, "closed by default");
assert.equal(el("help-toggle").getAttribute("aria-expanded"), "false");
assert.ok(el("help-box").innerHTML.includes("How to read this map"), "box filled on init");
el("help-toggle").fire("click");
assert.equal(el("help-box").hidden, false, "click opens");
assert.equal(el("help-toggle").getAttribute("aria-expanded"), "true");
assert.ok(el("help-toggle").classList.contains("open"));
el("help-toggle").fire("click");
assert.equal(el("help-box").hidden, true, "second click closes");
assert.equal(el("help-toggle").getAttribute("aria-expanded"), "false");
el("help-toggle").fire("click");
el("help-box").fire("keydown", { key: "Escape" });
assert.equal(el("help-box").hidden, true, "Escape closes");
assert.ok(el("help-toggle").focused, "Escape returns focus to the button");
el("help-box").fire("keydown", { key: "Enter" });
assert.equal(el("help-box").hidden, true, "other keys do nothing");
console.log("help checks passed");

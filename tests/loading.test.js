// Run from the repo root: node dashboard/tests/loading.test.js
// Fake DOM in the style of panel.test.js; checks the loading card and the failure message.
import assert from "node:assert/strict";

class El {
  constructor(id) { this.id = id; this.listeners = {}; this.textContent = ""; this.hidden = false; this.attrs = {}; this.classes = new Set();
    this.classList = { add: (c) => this.classes.add(c), remove: (c) => this.classes.delete(c), contains: (c) => this.classes.has(c) }; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  fire(ev, e = {}) { for (const fn of this.listeners[ev] || []) fn(e); }
}
const els = {}; const el = (id) => (els[id] ||= new El(id));
globalThis.document = { getElementById: el };
let reloaded = 0; globalThis.location = { reload: () => { reloaded++; } };
const { errorMessage, hideLoading, initLoading, loadingMessage, showLoadError, showLoading } = await import("../ui/loading.js");

assert.ok(loadingMessage().includes("about 4 MB"), "says how much is downloading");
assert.ok(errorMessage(new Error("failed to load data/segments.geojson: 404")).includes("Could not load the dashboard data"), "readable failure text");
assert.ok(errorMessage(new Error("boom")).endsWith("Details: boom"), "keeps the technical detail at the end");
assert.ok(errorMessage(undefined).includes("unknown error"), "copes with a missing error");
for (const t of [loadingMessage(), errorMessage(new Error("x"))]) assert.ok(!t.includes("—") && !t.includes(" - "), "no em dashes in messages");

initLoading();
assert.equal(el("loading").hidden, false, "visible while loading");
assert.equal(el("loading").getAttribute("role"), "status");
assert.equal(el("loading-text").textContent, loadingMessage());
assert.equal(el("loading-reload").hidden, true, "no reload button while loading");

hideLoading();
assert.equal(el("loading").hidden, true, "hidden once the layers are added");

showLoadError(new Error("failed to load data/collisions.geojson: 500"));
assert.equal(el("loading").hidden, false, "shown again on failure");
assert.ok(el("loading").classList.contains("error"));
assert.equal(el("loading").getAttribute("role"), "alert", "failure is announced");
assert.ok(el("loading-text").textContent.includes("data/collisions.geojson: 500"));
assert.equal(el("loading-reload").hidden, false, "reload button offered");
el("loading-reload").fire("click");
assert.equal(reloaded, 1, "reload button reloads the page");

showLoading();
assert.ok(!el("loading").classList.contains("error") && el("loading").getAttribute("role") === "status", "showLoading resets the error state");
hideLoading();

// Without a DOM nothing throws (the modules are imported by node tests that have no document).
delete globalThis.document;
showLoading(); hideLoading(); showLoadError(new Error("x"));
console.log("loading checks passed");

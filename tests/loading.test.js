// Run from the repo root: node tests/loading.test.js
// Fake DOM in the style of panel.test.js; checks the staged loading card, the determinate progress bar and the failure message.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
let reloaded = 0; globalThis.location = { reload: () => { reloaded++; } };
const { errorMessage, hideLoading, initLoading, setProgress, setStage, showLoadError, showLoading } = await import("../ui/loading.js");

// Stage copy: calm, no developer language, exactly the three contract lines.
setStage("map");
assert.equal(el("loading-text").textContent, "Preparing the map");
setStage("segments");
assert.equal(el("loading-text").textContent, "Placing 204 segments");
setStage("crashes");
assert.equal(el("loading-text").textContent, "Loading five years of crash records");
setStage("bogus");
assert.equal(el("loading-text").textContent, "Loading five years of crash records", "unknown stage leaves the text alone");
for (const s of ["Preparing the map", "Placing 204 segments", "Loading five years of crash records"]) assert.ok(!s.includes("MB"), "no megabyte talk in stage copy");

// Error copy is unchanged from today.
assert.ok(errorMessage(new Error("failed to load data/segments.geojson: 404")).includes("Could not load the dashboard data"), "readable failure text");
assert.ok(errorMessage(new Error("boom")).endsWith("Details: boom"), "keeps the technical detail at the end");
assert.ok(errorMessage(undefined).includes("unknown error"), "copes with a missing error");

initLoading();
assert.equal(el("loading").hidden, false, "visible while loading");
assert.equal(el("loading").getAttribute("role"), "status");
assert.equal(el("loading-text").textContent, "Preparing the map", "first stage is preparing the map");
assert.equal(el("loading-reload").hidden, true, "no reload button while loading");
assert.ok(el("panel").classList.contains("skeleton"), "panel shows its skeleton while loading");
assert.ok(el("progress").classList.contains("indeterminate"), "indeterminate before the first byte");

// Before the first byte the bar stays indeterminate, even if progress reports zero bytes with no total.
setProgress({ loaded: 0, total: null, ratio: null });
assert.ok(el("progress").classList.contains("indeterminate"), "still indeterminate at zero bytes");

// The first byte makes the bar determinate, even when the total is unknown.
setProgress({ loaded: 512, total: null, ratio: null });
assert.ok(!el("progress").classList.contains("indeterminate"), "determinate once bytes arrive");

// With a known total the fill tracks the byte ratio.
setProgress({ loaded: 2097152, total: 4194304, ratio: 0.5 });
assert.equal(el("progress-fill").style.width, "50%");
assert.equal(el("progress").getAttribute("aria-valuenow"), "50");
assert.ok(!el("progress").classList.contains("indeterminate"));

// Progress does not trample the stage text.
setStage("crashes");
setProgress({ loaded: 3145728, total: 4194304, ratio: 0.75 });
assert.equal(el("loading-text").textContent, "Loading five years of crash records");
assert.equal(el("progress-fill").style.width, "75%");

hideLoading();
assert.equal(el("loading").hidden, true, "hidden once the layers are added");
assert.ok(!el("panel").classList.contains("skeleton"), "skeleton removed");
assert.equal(el("progress").hidden, true, "progress bar gone");
assert.equal(el("progress-fill").style.width, "100%");

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
assert.equal(el("loading-text").textContent, "Preparing the map", "showLoading restarts at the map stage");
assert.ok(el("progress").classList.contains("indeterminate"), "a fresh load starts indeterminate again");

// Without a DOM nothing throws (the modules are imported by node tests that have no document).
hideLoading();
delete globalThis.document;
showLoading(); hideLoading(); showLoadError(new Error("x")); setProgress({ loaded: 1, total: 2, ratio: 0.5 }); setStage("map");
console.log("loading checks passed");

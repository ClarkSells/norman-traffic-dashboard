// Run from the repo root: node dashboard/tests/loading.test.js
// Fake DOM in the style of panel.test.js; checks the loading card, the progress bar and the failure message.
import assert from "node:assert/strict";
import { installFakeDocument } from "./fake_dom.js";
const { el } = installFakeDocument();
let reloaded = 0; globalThis.location = { reload: () => { reloaded++; } };
const { errorMessage, finishProgress, hideLoading, initLoading, loadingMessage, progressMessage, setProgress, showLoadError, showLoading } = await import("../ui/loading.js");

assert.ok(loadingMessage().includes("about 4 MB"), "says how much is downloading");
assert.ok(errorMessage(new Error("failed to load data/segments.geojson: 404")).includes("Could not load the dashboard data"), "readable failure text");
assert.ok(errorMessage(new Error("boom")).endsWith("Details: boom"), "keeps the technical detail at the end");
assert.ok(errorMessage(undefined).includes("unknown error"), "copes with a missing error");
for (const t of [loadingMessage(), errorMessage(new Error("x")), progressMessage({ loaded: 1048576, total: null }), progressMessage({ loaded: 2097152, total: 4194304, ratio: 0.5 })]) assert.ok(!t.includes("—") && !t.includes(" - "), "no em dashes in messages");
assert.equal(progressMessage(null), loadingMessage());
assert.equal(progressMessage({ loaded: 2097152, total: 4194304, ratio: 0.5 }), "Loading segment and crash data, 50 percent of 4.0 MB.");
assert.equal(progressMessage({ loaded: 1572864, total: null, ratio: null }), "Loading segment and crash data, 1.5 MB so far.");

initLoading();
assert.equal(el("loading").hidden, false, "visible while loading");
assert.equal(el("loading").getAttribute("role"), "status");
assert.equal(el("loading-text").textContent, loadingMessage());
assert.equal(el("loading-reload").hidden, true, "no reload button while loading");
assert.ok(el("panel").classList.contains("skeleton"), "panel shows its skeleton while loading");

setProgress({ loaded: 1000, total: null, ratio: null });
assert.ok(el("progress").classList.contains("indeterminate"), "no content length: indeterminate bar");
setProgress({ loaded: 2097152, total: 4194304, ratio: 0.5 });
assert.ok(!el("progress").classList.contains("indeterminate")); assert.equal(el("progress-fill").style.width, "50%"); assert.equal(el("progress").getAttribute("aria-valuenow"), "50");
assert.ok(el("loading-text").textContent.includes("50 percent"));

hideLoading();
assert.equal(el("loading").hidden, true, "hidden once the layers are added");
assert.ok(!el("panel").classList.contains("skeleton"), "skeleton removed");
assert.equal(el("progress").hidden, true, "progress bar gone"); assert.equal(el("progress-fill").style.width, "100%");

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
hideLoading(); finishProgress();

// Without a DOM nothing throws (the modules are imported by node tests that have no document).
delete globalThis.document;
showLoading(); hideLoading(); showLoadError(new Error("x")); setProgress({ ratio: 0.2 }); finishProgress();
console.log("loading checks passed");

// Run from the repo root: node dashboard/tests/legend_toggle.test.js
// The compact legend is a pill: folded it shows the metric swatch row; a click on the title expands the full legend.
import assert from "node:assert/strict";
import { El } from "./fake_dom.js";
const { initLegend, renderLegend } = await import("../ui/legend.js");

const state = { metric: "combined", los: "E", yearMin: 2021, yearMax: 2025 };
const toggleButton = () => { const b = new El("button"); b.classes.add("legend-toggle"); return b; };
const outside = () => new El("span");

// Compact pill: folded by default, swatch row markup present, the toggle announces its state.
const pill = new El("div", "legend");
initLegend(pill, { compact: true });
renderLegend(pill, state);
assert.ok(pill.classes.has("compact"), "compact class marks the pill");
assert.ok(pill.classes.has("collapsed"), "the pill starts folded");
assert.ok(pill.innerHTML.includes('<button type="button" class="legend-toggle" aria-expanded="false">Combined score, LOS E, crashes 2021 to 2025</button>'), "toggle announces collapsed");
assert.ok(pill.innerHTML.includes('class="ramp"') && (pill.innerHTML.match(/<i style="background:#/g) || []).length === 5, "metric swatch row rides in the pill");

// A click on the title expands to the full legend; a second click folds it back.
const btn = toggleButton();
pill.fire("click", { target: outside() });
assert.ok(pill.classes.has("collapsed"), "clicks outside the title are ignored");
pill.fire("click", { target: btn });
assert.ok(!pill.classes.has("collapsed"), "title click expands the pill");
assert.equal(btn.attrs["aria-expanded"], "true");
assert.ok(pill.innerHTML.includes("crash not on a counted segment"), "full legend content is the renderLegend output");
pill.fire("click", { target: btn });
assert.ok(pill.classes.has("collapsed") && btn.attrs["aria-expanded"] === "false", "second click folds it again");

// The fold survives a re-render with a new metric.
renderLegend(pill, { ...state, metric: "v_c" });
assert.ok(pill.innerHTML.includes('aria-expanded="false">Volume / capacity'), "re-render keeps the folded state");

// No options at all: still the compact pill (app.js calls initLegend(el) until Wave 2 rewires it).
const dflt = new El("div", "legend");
initLegend(dflt);
renderLegend(dflt, state);
assert.ok(dflt.classes.has("compact") && dflt.classes.has("collapsed"), "default options give the folded compact pill");

// Legacy boolean callers: false stays open, true starts folded.
const wide = new El("div", "legend");
initLegend(wide, false);
renderLegend(wide, state);
assert.ok(!wide.classes.has("collapsed"), "legacy false: open");
assert.ok(wide.innerHTML.includes('aria-expanded="true">Combined score, LOS E, crashes 2021 to 2025</button>'));
const narrow = new El("div", "legend");
initLegend(narrow, true);
renderLegend(narrow, state);
assert.ok(narrow.classes.has("collapsed"), "legacy true: folded");
assert.ok(narrow.innerHTML.includes('aria-expanded="false"'));

// The old plain-object element used by popup_legend.test.js still works.
const plain = { innerHTML: "" };
renderLegend(plain, state);
assert.ok(plain.innerHTML.includes("Combined score, LOS E, crashes 2021 to 2025"));
console.log("legend toggle checks passed");

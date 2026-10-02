// Run from the repo root: node dashboard/tests/legend_toggle.test.js
// The legend title is a button that folds the legend; narrow screens start folded. Fake DOM in the style of panel.test.js.
import assert from "node:assert/strict";
const { initLegend, renderLegend } = await import("../ui/legend.js");

class El {
  constructor() { this.listeners = {}; this.innerHTML = ""; this.classes = new Set(); this.attrs = {};
    this.classList = { add: (c) => this.classes.add(c), contains: (c) => this.classes.has(c), toggle: (c) => { this.classes.has(c) ? this.classes.delete(c) : this.classes.add(c); return this.classes.has(c); } }; }
  addEventListener(ev, fn) { (this.listeners[ev] ||= []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = v; }
  fire(ev, e) { for (const fn of this.listeners[ev] || []) fn(e); }
}
const state = { metric: "combined", los: "E", yearMin: 2021, yearMax: 2025 };

// Desktop: open by default, the title is a real button announcing its state.
const wide = new El();
initLegend(wide, false);
renderLegend(wide, state);
assert.ok(!wide.classes.has("collapsed"), "open on wide screens");
assert.ok(wide.innerHTML.includes('<button type="button" class="title legend-toggle" aria-expanded="true">Combined score (LOS E, 2021 to 2025)</button>'), "title is a button");
assert.ok(wide.innerHTML.includes("Ward 8") && wide.innerHTML.includes("not on a counted segment"), "legend body still rendered");

// A click on the title folds it; a click elsewhere does nothing; the state survives a re-render.
const titleBtn = new El(); titleBtn.closest = (sel) => sel === ".legend-toggle" ? titleBtn : null;
const other = new El(); other.closest = () => null;
wide.fire("click", { target: other });
assert.ok(!wide.classes.has("collapsed"), "clicks outside the title are ignored");
wide.fire("click", { target: titleBtn });
assert.ok(wide.classes.has("collapsed"), "title click folds the legend");
assert.equal(titleBtn.attrs["aria-expanded"], "false");
renderLegend(wide, { ...state, metric: "v_c" });
assert.ok(wide.innerHTML.includes('aria-expanded="false">Volume / capacity'), "re-render keeps the folded state");
wide.fire("click", { target: titleBtn });
assert.ok(!wide.classes.has("collapsed") && titleBtn.attrs["aria-expanded"] === "true", "second click opens it again");

// Narrow screens start folded so the map stays visible.
const narrow = new El();
initLegend(narrow, true);
renderLegend(narrow, state);
assert.ok(narrow.classes.has("collapsed"), "folded by default on narrow screens");
assert.ok(narrow.innerHTML.includes('aria-expanded="false"'));

// The old plain-object element used by popup_legend.test.js still works.
const plain = { innerHTML: "" };
renderLegend(plain, state);
assert.ok(plain.innerHTML.includes("Combined score (LOS E, 2021 to 2025)"));
console.log("legend toggle checks passed");

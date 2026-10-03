// Run from the repo root: node dashboard/tests/theme.test.js
import assert from "node:assert/strict";
import { RAMP } from "../config.js";
import { FONTS, GOOGLE_FONTS_URL, THEMES, applyTheme, contrastRatio, cssVars, themeFor } from "../theme.js";

assert.ok(!["Inter", "Roboto"].includes(FONTS.display) && !["Inter", "Roboto"].includes(FONTS.text), "deliberate type choice");
assert.ok(GOOGLE_FONTS_URL.includes("IBM+Plex+Mono"), "the monospace face is requested");
assert.ok(/Mono/.test(FONTS.text) && /Mono/.test(FONTS.display), "terminal register: monospace for text and display");
for (const name of ["light", "dark"]) {
  const t = THEMES[name];
  for (const k of ["surface", "surface-raised", "ink", "ink-muted", "hairline", "accent", "selection-halo"]) assert.ok(t[k], `${name} theme defines ${k}`);
  assert.ok(contrastRatio(t.ink, t.surface) >= 7, `${name}: ink on surface is AAA (${contrastRatio(t.ink, t.surface).toFixed(2)})`);
  assert.ok(contrastRatio(t["ink-muted"], t.surface) >= 4.5, `${name}: muted ink on surface is AA (${contrastRatio(t["ink-muted"], t.surface).toFixed(2)})`);
  assert.ok(contrastRatio(t.ink, t["surface-raised"]) >= 7, `${name}: ink on raised surface`);
}
assert.ok(RAMP.includes(THEMES.light.accent) && RAMP.includes(THEMES.dark.accent), "accent is a ramp step, so the UI palette is built around the data ramp");
assert.equal(themeFor("satellite"), "dark"); assert.equal(themeFor("light"), "light");
assert.ok(cssVars("light").includes("--surface: #fbfaf7;") && cssVars("dark").includes("--ink: #f3f1ea;"));
assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01, "contrast formula sanity");
// applyTheme writes the variables onto a root element
const set = {}; const root = { dataset: {}, style: { setProperty: (k, v) => { set[k] = v; } } };
assert.equal(applyTheme("dark", root), "dark");
assert.equal(root.dataset.theme, "dark"); assert.equal(set["--surface"], "#15171a"); assert.equal(set["--map-casing"], "#ffffff");
assert.equal(applyTheme("light", null), "light", "no document, no throw");
console.log("theme checks passed");

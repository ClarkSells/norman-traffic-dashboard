// Run from the repo root: node tests/theme.test.js
import assert from "node:assert/strict";
import { FONTS, GOOGLE_FONTS_URL, THEMES, applyMode, applyTheme, contrastRatio, cssVars, themeFor } from "../theme.js";

// Type: three Plex families (serif titles, sans UI, mono figures) per the design token table.
assert.equal(FONTS.serif, "IBM Plex Serif");
assert.equal(FONTS.sans, "IBM Plex Sans");
assert.equal(FONTS.mono, "IBM Plex Mono");
for (const fam of ["IBM+Plex+Serif", "IBM+Plex+Sans", "IBM+Plex+Mono"]) assert.ok(GOOGLE_FONTS_URL.includes(fam), `font URL requests ${fam}`);

// THEMES mirrors the token values tokens.css defines under :root and :root[data-mode="present"].
assert.deepEqual(
  Object.fromEntries(["surface", "surface-raised", "ink", "ink-muted", "accent", "hairline", "focus"].map(k => [k, THEMES.light[k]])),
  { surface: "#f6f4ee", "surface-raised": "#fffdf8", ink: "#1c1b18", "ink-muted": "#6b6963", accent: "#d45f14", hairline: "#e3dfd5", focus: "#2a78d6" },
  "light theme is the explore token set",
);
assert.deepEqual(
  Object.fromEntries(["ink", "ink-muted", "accent", "hairline", "focus"].map(k => [k, THEMES.dark[k]])),
  { ink: "#f3f1ea", "ink-muted": "#a7a49c", accent: "#ee7b2f", hairline: "#2a2e35", focus: "#86b6ef" },
  "dark theme (satellite) sits in the present/dark family",
);
assert.deepEqual(
  Object.fromEntries(["surface", "surface-raised", "ink", "ink-muted", "accent", "hairline", "focus"].map(k => [k, THEMES.present[k]])),
  { surface: "#121417", "surface-raised": "rgba(27,30,35,0.92)", ink: "#f3f1ea", "ink-muted": "#a7a49c", accent: "#ee7b2f", hairline: "#2a2e35", focus: "#86b6ef" },
  "present theme carries the present chrome tokens",
);

// Every theme is complete enough for the map layers (they read map-casing, selection-halo, ward-*).
for (const name of ["light", "dark", "present"]) {
  const t = THEMES[name];
  for (const k of ["surface", "surface-raised", "ink", "ink-muted", "hairline", "accent", "focus", "selection-halo", "map-casing", "map-casing-opacity", "ward-line", "ward-label", "ward-halo"]) {
    assert.ok(t[k] !== undefined, `${name} theme defines ${k}`);
  }
}

// Contrast: ink and ink-muted on paper and on surface-raised pass WCAG AA (>= 4.5 at body sizes)
// in both the light (explore) and present sets. Present surface-raised is rgba over paper, so composite first.
const compositeOver = (rgbaStr, bgHex) => {
  const m = rgbaStr.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
  assert.ok(m, `parseable rgba: ${rgbaStr}`);
  const bg = [1, 3, 5].map(i => parseInt(bgHex.slice(i, i + 2), 16));
  const a = parseFloat(m[4]);
  const ch = [1, 2, 3].map(i => Math.round(parseInt(m[i], 10) * a + bg[i - 1] * (1 - a)));
  return `#${ch.map(c => c.toString(16).padStart(2, "0")).join("")}`;
};
const raisedHex = (t) => t["surface-raised"].startsWith("#") ? t["surface-raised"] : compositeOver(t["surface-raised"], t.surface);
for (const name of ["light", "present"]) {
  const t = THEMES[name];
  assert.ok(contrastRatio(t.ink, t.surface) >= 4.5, `${name}: ink on paper AA (${contrastRatio(t.ink, t.surface).toFixed(2)})`);
  assert.ok(contrastRatio(t["ink-muted"], t.surface) >= 4.5, `${name}: ink-muted on paper AA (${contrastRatio(t["ink-muted"], t.surface).toFixed(2)})`);
  assert.ok(contrastRatio(t.ink, raisedHex(t)) >= 4.5, `${name}: ink on surface-raised AA (${contrastRatio(t.ink, raisedHex(t)).toFixed(2)})`);
  assert.ok(contrastRatio(t["ink-muted"], raisedHex(t)) >= 4.5, `${name}: ink-muted on surface-raised AA (${contrastRatio(t["ink-muted"], raisedHex(t)).toFixed(2)})`);
}
// Dark (satellite) keeps the same guarantee.
assert.ok(contrastRatio(THEMES.dark.ink, THEMES.dark.surface) >= 4.5, "dark: ink on surface AA");
assert.ok(contrastRatio(THEMES.dark["ink-muted"], THEMES.dark.surface) >= 4.5, "dark: ink-muted on surface AA");

assert.equal(themeFor("satellite"), "dark"); assert.equal(themeFor("light"), "light");
assert.ok(cssVars("light").includes("--surface: #f6f4ee;") && cssVars("dark").includes("--ink: #f3f1ea;"));
assert.ok(cssVars("present").includes("--accent: #ee7b2f;"), "present theme serializes");
assert.ok(Math.abs(contrastRatio("#000000", "#ffffff") - 21) < 0.01, "contrast formula sanity");

// applyTheme writes data-theme and the variables onto a root element.
const set = {}; const root = { dataset: {}, style: { setProperty: (k, v) => { set[k] = v; } } };
assert.equal(applyTheme("dark", root), "dark");
assert.equal(root.dataset.theme, "dark"); assert.equal(set["--surface"], "#15171a"); assert.equal(set["--map-casing"], "#ffffff");
assert.equal(applyTheme("present", root), "present");
assert.equal(root.dataset.theme, "present"); assert.equal(set["--ink-muted"], "#a7a49c");
assert.equal(applyTheme("light", null), "light", "no document, no throw");

// applyMode is the primary present/explore switch: it only sets data-mode and lets tokens.css cascade.
const modeRoot = { dataset: {} };
assert.equal(applyMode("present", modeRoot), "present");
assert.equal(modeRoot.dataset.mode, "present");
assert.equal(applyMode("explore", modeRoot), "explore");
assert.equal(modeRoot.dataset.mode, "explore");
assert.equal(applyMode("bogus", modeRoot), "explore", "unknown modes fall back to explore");
assert.equal(applyMode("present", null), "present", "no document, no throw");

console.log("theme checks passed");

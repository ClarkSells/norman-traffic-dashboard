// ## WHAT THIS FILE DOES
// The color system for the chrome (panel, buttons, popup) and for the parts of the map our own layers draw
// (casings, halos, ward lines and labels). THEMES holds the light, dark and present palettes; applyTheme
// writes one onto <html> as CSS custom properties; applyMode switches the explore and present chrome;
// themeFor maps a basemap to a palette. Imports config.js. Imported by app.js, every layers/*.js module that
// paints chrome, ui/legend.js, layers/collisions.js (COLLISION_COLORS) and the theme tests.
// UI palette and type for the dashboard, as CSS custom properties.
// The five step metric ramp stays in config.js (it is the report's ramp too); this file builds the chrome around it.
// The type system is three IBM Plex families (Serif titles, Sans UI, Mono figures) delivered by tokens.css;
// THEMES mirrors the token values tokens.css defines under :root (explore) and :root[data-mode="present"].
import { BLUE_RAMP, MUTED } from "./config.js";

// ## Fonts
// Three IBM Plex families: Serif for titles, Sans for UI text, Mono for figures. tokens.css loads them.
export const FONTS = { serif: "IBM Plex Serif", sans: "IBM Plex Sans", mono: "IBM Plex Mono" };
export const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:wght@500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

// ## THEMES: the three palettes
// Keys match the CSS custom property names in tokens.css without the leading dashes. The map chrome keys
// (map-casing, selection-halo, ward-line, ward-label, ward-halo) are read by the layer modules directly
// because Mapbox paint cannot read CSS variables.
export const THEMES = {
  // Explore (light): the token values from handoff/02_DESIGN_DIRECTION.md section 3, mirrored from tokens.css :root.
  light: {
    surface: "#f6f4ee", "surface-raised": "#fffdf8", ink: "#1c1b18", "ink-muted": "#6b6963",
    hairline: "#e3dfd5", accent: "#d45f14", "accent-soft": "#fbe9dc", focus: "#2a78d6",
    "row-hover": "#f4f0e8", "row-selected": "#fbe9dc", shadow: "0 8px 28px rgba(28,27,24,0.10)",
    // map chrome drawn by the layers
    "map-casing": "#fbfaf7", "map-casing-opacity": 0.9, "selection-halo": "#16150f", "ward-line": "#7d7a72", "ward-label": "#4a4842", "ward-halo": "#fbfaf7",
  },
  // Dark: chrome for the satellite basemap, aligned to the present/dark token family.
  dark: {
    surface: "#15171a", "surface-raised": "#1f2227", ink: "#f3f1ea", "ink-muted": "#a7a49c",
    hairline: "#2a2e35", accent: "#ee7b2f", "accent-soft": "rgba(238,123,47,0.18)", focus: "#86b6ef",
    "row-hover": "rgba(255,255,255,0.06)", "row-selected": "rgba(238,123,47,0.18)", shadow: "0 8px 28px rgba(0,0,0,0.45)",
    "map-casing": "#ffffff", "map-casing-opacity": 0.95, "selection-halo": "#ffffff", "ward-line": "#e8e6df", "ward-label": "#f3f1ea", "ward-halo": "#15171a",
  },
  // Present: the present chrome tokens, mirrored from tokens.css :root[data-mode="present"]. The primary
  // mechanism is applyMode("present") + the tokens.css cascade; this entry keeps applyTheme("present") available.
  present: {
    surface: "#121417", "surface-raised": "rgba(27,30,35,0.92)", ink: "#f3f1ea", "ink-muted": "#a7a49c",
    hairline: "#2a2e35", accent: "#ee7b2f", "accent-soft": "rgba(238,123,47,0.18)", focus: "#86b6ef",
    "row-hover": "rgba(255,255,255,0.06)", "row-selected": "rgba(238,123,47,0.18)", shadow: "0 8px 28px rgba(0,0,0,0.45)",
    "map-casing": "#ffffff", "map-casing-opacity": 0.95, "selection-halo": "#ffffff", "ward-line": "#e8e6df", "ward-label": "#f3f1ea", "ward-halo": "#121417",
  },
};

// ## themeFor and cssVars
// The satellite basemap is a dark scene, so it gets the dark chrome.
export function themeFor(basemap) { return basemap === "satellite" ? "dark" : "light"; }

export function cssVars(name) {
  const t = THEMES[name] || THEMES.light;
  return Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(" ");
}

// ## applyTheme: set data-theme and the inline custom properties on <html>
// Writes the theme onto the document root. Returns the applied name so callers can chain.
export function applyTheme(name, root) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return name;
  const t = THEMES[name] || THEMES.light;
  if (el.dataset) el.dataset.theme = name;
  if (el.style && el.style.setProperty) for (const [k, v] of Object.entries(t)) el.style.setProperty(`--${k}`, String(v));
  return name;
}

// ## applyMode: explore or present chrome
// Explore vs present chrome (tokens.css keys the dark set off :root[data-mode="present"]). applyTheme's
// inline custom properties would beat the stylesheet, so present mode strips them and lets tokens.css
// cascade; the caller re-applies applyTheme on the way back to explore.
export function applyMode(mode, root) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  const m = mode === "present" ? "present" : "explore";
  if (!el) return m;
  if (el.dataset) el.dataset.mode = m;
  if (m === "present" && el.style && el.style.removeProperty) {
    for (const k of Object.keys(THEMES.light)) el.style.removeProperty(`--${k}`);
  }
  return m;
}

// ## contrastRatio: a test helper that keeps the palettes legible
// WCAG contrast ratio for two hex colors. Pure, used by the tests to check both themes.
export function contrastRatio(hexA, hexB) {
  const lum = (hex) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(hexA), lum(hexB)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// ## COLLISION_COLORS: dot colors by how the crash was assigned
// Collision dot colors by the pipeline's assignment category ("cat" in collisions.geojson).
export const COLLISION_COLORS = { assigned: BLUE_RAMP[2], shared_intersection_resolved: BLUE_RAMP[1], on_road_no_segment: MUTED, road_not_counted: "#b7b4ab" };

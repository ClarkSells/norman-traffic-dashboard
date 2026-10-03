// UI palette and type for the dashboard, as CSS custom properties.
// The five step metric ramp stays in config.js (it is the report's ramp too); this file builds the chrome around it.
import { BLUE_RAMP, MUTED, RAMP } from "./config.js";

// One monospace family carries display, text and numbers: a terminal register, every digit the same width.
export const FONTS = { display: "IBM Plex Mono", text: "IBM Plex Mono" };
export const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";

export const THEMES = {
  light: {
    surface: "#fbfaf7", "surface-raised": "#ffffff", ink: "#16150f", "ink-muted": "#5f5c54",
    hairline: "#e4e1d8", accent: RAMP[2], "accent-soft": "#fbe9dc", focus: "#1c5cab",
    "row-hover": "#f4f0e8", "row-selected": "#fbe9dc", shadow: "0 8px 28px rgba(22,21,15,0.10)",
    // map chrome drawn by the layers
    "map-casing": "#fbfaf7", "map-casing-opacity": 0.9, "selection-halo": "#16150f", "ward-line": "#7d7a72", "ward-label": "#4a4842", "ward-halo": "#fbfaf7",
  },
  dark: {
    surface: "#15171a", "surface-raised": "#1f2227", ink: "#f3f1ea", "ink-muted": "#b3b0a7",
    hairline: "rgba(255,255,255,0.14)", accent: RAMP[0], "accent-soft": "rgba(245,158,92,0.18)", focus: "#86b6ef",
    "row-hover": "rgba(255,255,255,0.06)", "row-selected": "rgba(245,158,92,0.18)", shadow: "0 8px 28px rgba(0,0,0,0.45)",
    "map-casing": "#ffffff", "map-casing-opacity": 0.95, "selection-halo": "#ffffff", "ward-line": "#e8e6df", "ward-label": "#f3f1ea", "ward-halo": "#15171a",
  },
};

// The satellite basemap is a dark scene, so it gets the dark chrome.
export function themeFor(basemap) { return basemap === "satellite" ? "dark" : "light"; }

export function cssVars(name) {
  const t = THEMES[name] || THEMES.light;
  return Object.entries(t).map(([k, v]) => `--${k}: ${v};`).join(" ");
}

// Writes the theme onto the document root. Returns the applied name so callers can chain.
export function applyTheme(name, root) {
  const el = root || (typeof document !== "undefined" ? document.documentElement : null);
  if (!el) return name;
  const t = THEMES[name] || THEMES.light;
  if (el.dataset) el.dataset.theme = name;
  if (el.style && el.style.setProperty) for (const [k, v] of Object.entries(t)) el.style.setProperty(`--${k}`, String(v));
  return name;
}

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

// Collision dot colors by the pipeline's assignment category ("cat" in collisions.geojson).
export const COLLISION_COLORS = { assigned: BLUE_RAMP[2], shared_intersection_resolved: BLUE_RAMP[1], on_road_no_segment: MUTED, road_not_counted: "#b7b4ab" };

// Tiny observable store. Every UI control writes here; every layer reads from here.
const state = {
  ward: null,            // null = all wards, else 1..8
  metric: "combined",    // "combined" | "v_c" | "collisions"
  los: "E",              // "E" | "C"
  yearMin: 2021,
  yearMax: 2025,
  includeCollectors: false,
  selectedLocId: null,
  basemap: "light",
  reducedMotion: false,  // set from prefers-reduced-motion at startup; layers and camera read it
  heat: true,            // crash density surface (explore default on; scenes own it in present)
  flow: false,           // traffic flow animation (explore default off; scenes own it in present)
  presenting: false,     // true while a present-mode scene is on screen
};
const listeners = new Set();

export function getState() { return { ...state }; }

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(getState(), patch);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

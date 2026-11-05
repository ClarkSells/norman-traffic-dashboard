// ## WHAT THIS FILE DOES
// The single source of truth for what the dashboard is showing: one plain object plus three functions. UI
// controls call setState with a patch, every listener (in practice app.js render) is called with the new
// state and the patch, and layers and panels read the state they are handed. It imports nothing. Imported by
// app.js, ui/panel.js, ui/popup.js, ui/simulate.js and the tests. CONTRACTS.md C.1 and C.14 list the keys.
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
  // Simulate (CONTRACTS C.14). The default scenario leaves the paint and the table exactly as today.
  daytype: "school_fri", // "school_fri" | "school_wkday" | "weekend" | "summer_wkday" | "gameday"
  year: 2025,            // projection year, 2025..2035
  growthAdd: 0,          // population growth lever added to the band rate: 0 | 0.01 | 0.02
  band: "base",          // growth band: "lo" | "base" | "hi"
  closing: null,         // loc_id of the closed segment in closure mode, else null
  simPlaying: false,     // true while the year plays 2025 to 2035
};
const listeners = new Set();

// ## getState: a copy, never the live object
// Callers get a shallow copy so nothing outside this file can mutate state without going through setState.
export function getState() { return { ...state }; }

// ## setState: merge a patch, then notify every subscriber
// The patch is passed along with the full state so render() can react to which keys changed (for example,
// fly to the ward only when the patch contains "ward"). There is no diffing: a patch with an unchanged value
// still triggers a render, which keeps the model simple.
export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(getState(), patch);
}

// ## subscribe: register a listener, get back an unsubscribe function
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

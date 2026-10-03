// Mapbox public token (pk.*). Create one at account.mapbox.com and restrict it to the hosting URL.
export const MAPBOX_TOKEN = "pk.eyJ1IjoiY25lZWt5MSIsImEiOiJjbXVyamNweHIwOHA5MnpwcGlwemcwcmF1In0.X_AlQ66e9n-BYRLb1CgbLg";

export const STYLES = {
  standard: "mapbox://styles/mapbox/standard",
  satellite: "mapbox://styles/mapbox/standard-satellite",
  // `light` is kept as an alias of `standard` for one release (hash key `basemap=light`).
  light: "mapbox://styles/mapbox/standard",
};

export const PRESETS = { explore: "day", present: "dusk" };

export const FLOW = {
  bands: [8000, 18000],
  stepMs: { free: 45, moderate: 70, congested: 110 },
  vcBands: [0.5, 0.8],
};

export const SCENE_TIMING = { city: 10000, segment: 12000, ward: 14000 };

export const COLL = { year: "y", cat: "c", loc: "l" };

// Union bounds of data/wards.geojson, [[west, south], [east, north]].
export const CITY_BOUNDS = [[-97.54741, 35.14546], [-97.17692, 35.34832]];

export const DATA = {
  segments: "data/segments.geojson",
  collisions: "data/collisions.geojson",
  wards: "data/wards.geojson",
  points: "data/count_points.geojson",
  summary: "data/summary.json",
};

export const CENTER = [-97.43, 35.225];
export const ZOOM = 11.6;

// Validated palettes (dataviz validator, light surface). Sequential: one hue, light -> dark.
export const RAMP = ["#f59e5c", "#ee7b2f", "#d45f14", "#a4480e", "#6d2f09"];
export const BLUE_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#0d366b"];
export const WARD_COLORS = { 1: "#2a78d6", 2: "#eb6834", 3: "#1baf7a", 4: "#eda100", 5: "#e87ba4", 6: "#008300", 7: "#4a3aa7", 8: "#e34948" };
export const MUTED = "#898781";

// Class breaks per metric (values below the first break get RAMP[0], and so on)
export const BREAKS = {
  combined: [10, 25, 50, 100],
  v_c: [0.5, 0.7, 0.9, 1.0],
  collisions: [10, 25, 50, 100],
};
export const METRIC_LABEL = { combined: "Combined score", v_c: "Volume / capacity", collisions: "Collisions" };

// Turns the basemap's label density down so the data reads first. Road names and place names stay.
// Standard style (has imports): use its config. Classic styles (light-v11, satellite-streets-v12): hide the POI and
// transit symbol layers directly.
const HIDE_SOURCE_LAYERS = new Set(["poi_label", "transit_stop_label", "airport_label", "natural_label", "natural_point_label", "natural_line_label", "water_point_label", "water_line_label", "housenum_label"]);

export function isStandardStyle(style) { return !!(style && style.imports && style.imports.length); }

export function tuneBasemap(map, theme) {
  const style = map.getStyle ? map.getStyle() : null;
  if (!style) return { mode: "none", hidden: [] };
  if (isStandardStyle(style)) {
    map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
    map.setConfigProperty("basemap", "showTransitLabels", false);
    map.setConfigProperty("basemap", "lightPreset", theme === "dark" ? "night" : "day");
    return { mode: "standard", hidden: [] };
  }
  const hidden = [];
  for (const l of style.layers || []) {
    if (l.type !== "symbol") continue;
    const sl = l["source-layer"];
    if (sl && HIDE_SOURCE_LAYERS.has(sl)) { map.setLayoutProperty(l.id, "visibility", "none"); hidden.push(l.id); }
  }
  return { mode: "classic", hidden };
}

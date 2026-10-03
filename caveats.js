// One place for the segment caveats quoted by the popup, the tour and the slides.
// Wording follows docs/report/sections/08_data_quality.md so the dashboard and the report agree.
export const FALLBACK_GEOMETRY_IDS = ["52500-76", "52500-133", "52500-183", "52500-206", "52500-228", "52500-237"];
export const DUPLICATE_PAIR_IDS = ["52500-240", "52500-241"];

export const CAVEATS = {
  fallback_geometry: "Approximate geometry: this segment's line is an 800 meter window around the count point because its endpoints do not match the city centerlines, so its length and its per mile crash rate are approximate.",
  "52500-133": "The fallback line runs about 250 meters past 24th Ave SW, one of the two documented spot check failures.",
  duplicate_pair: "Duplicate count location: 52500-240 and 52500-241 cover the same stretch of Flood Ave from Rock Creek Rd to Robinson St, so crashes on that stretch split between the two.",
  "52500-71": "Three CLASSEN BLVD crash records with no cross street could not be placed on this segment and are left unassigned, one of the two documented spot check failures.",
  "52500-115": "Ward assigned by fallback: this segment sits in a sliver gap between the ward polygons and was assigned to the nearest ward, Ward 8.",
  "52500-192": "Volume is from a single FY21 count, so this v/c rests on one count year.",
};

// All caveat sentences that apply to a segment, in display order. Empty for a clean segment.
export function caveatsFor(locId) {
  const out = [];
  if (FALLBACK_GEOMETRY_IDS.includes(locId)) out.push(CAVEATS.fallback_geometry);
  if (DUPLICATE_PAIR_IDS.includes(locId)) out.push(CAVEATS.duplicate_pair);
  for (const k of ["52500-133", "52500-71", "52500-115", "52500-192"]) if (locId === k) out.push(CAVEATS[k]);
  return out;
}

export function hasCaveat(locId) { return caveatsFor(locId).length > 0; }

// Step definitions for Present mode. Captions quote FACTS exactly or compute from the loaded data.
import { CENTER, ZOOM } from "./config.js";
import { FACTS, LIVE_URL, TOP5 } from "./facts.js";
import { rankedRows } from "./data.js";

const BASE = { ward: null, metric: "combined", los: "E", yearMin: FACTS.year_min, yearMax: FACTS.year_max, includeCollectors: false, selectedLocId: null };
const CITY = { center: CENTER, zoom: ZOOM, pitch: 0, bearing: 0 };
const n = (v) => Number(v).toLocaleString("en-US");

// raw: the loaded data (segments needed). Returns 12 steps. Each step: { id, title, caption, state, camera, basemap, showPanel, popup, computed }.
export function buildTour(raw) {
  const segs = (raw && raw.segments && raw.segments.features) || [];
  const byId = Object.fromEntries(segs.map(f => [f.properties.loc_id, f.properties]));
  const vcMax = segs.reduce((a, f) => Math.max(a, f.properties.v_c_E || 0), 0);
  const vcMaxText = vcMax ? vcMax.toFixed(2) : FACTS.v_c_max;
  const ward2 = rankedRows({ ...BASE, ward: 2 });
  const ward2C = rankedRows({ ...BASE, ward: 2, los: "C" });
  const over1 = ward2C.filter(r => r.v_c_active >= 1).length;
  const main = byId["52500-158"] || {};
  const steps = [
    { id: "citywide", title: "Every counted segment in Norman", basemap: "light", state: { ...BASE }, camera: CITY,
      caption: `${n(FACTS.segments)} segments, ${n(FACTS.collision_rows)} crash records, ${n(FACTS.assigned_in_window)} assigned ${FACTS.year_min} to ${FACTS.year_max}. Each segment is colored by its combined score: crashes plus the volume to capacity ratio (v/c).` },
    { id: "vc", title: "Volume alone", basemap: "light", state: { ...BASE, metric: "v_c" }, camera: CITY, computed: { vcMax: vcMaxText },
      caption: `Colored by v/c: the highest daily count at each location divided by its capacity at level of service (LOS) E. The highest v/c citywide is ${vcMaxText}, so no segment is over capacity on this measure.` },
    { id: "crashes", title: "Crashes alone", basemap: "light", state: { ...BASE, metric: "collisions" }, camera: CITY,
      caption: `Colored by crashes assigned to each segment, ${FACTS.year_min} to ${FACTS.year_max}. The map barely changes from the combined view: ${FACTS.rank_correlation_phrase}.` },
    { id: "combined", title: "Back to the combined score", basemap: "light", state: { ...BASE }, camera: CITY,
      caption: "Combined score = crashes + v/c, exactly as the brief defines it. The five highest scoring segments in the city come next, in rank order." },
    ...TOP5.map(t => ({ id: `top${t.rank}`, title: `#${t.rank} citywide: ${t.name}`, basemap: "light", state: { ...BASE, selectedLocId: t.loc_id }, camera: { segment: t.loc_id }, popup: t.loc_id,
      caption: `${t.name}, ${t.span}. v/c ${t.v_c}, ${t.crashes} crashes, combined score ${t.combined}.` })),
    { id: "ward2", title: "How a councilmember reads their list", basemap: "light", state: { ...BASE, ward: 2 }, camera: { ward: 2 }, showPanel: true, computed: { ward2Count: ward2.length },
      caption: `Ward 2 has ${ward2.length} arterial segments in its primary list, ranked top down by combined score. A boundary tag means the segment sits on a ward line: counted once, listed in both neighboring wards.` },
    { id: "losc", title: "What moves under LOS C", basemap: "light", state: { ...BASE, ward: 2, los: "C" }, camera: { ward: 2 }, showPanel: true, computed: { over1 },
      caption: `LOS C uses the 2020 plan's lower capacities, so every v/c rises and ${over1} Ward 2 ${over1 === 1 ? "segment reaches" : "segments reach"} or pass 1.0. Crash counts do not move, so the order of the list barely changes.` },
    { id: "lanes", title: "The lane count story", basemap: "satellite", state: { ...BASE, selectedLocId: "52500-158" }, camera: { segment: "52500-158", zoom: 16.4, pitch: 50 }, popup: "52500-158",
      computed: { vpd: main.vpd_max != null ? n(main.vpd_max) : null, lanes: main.lanes_final != null ? String(main.lanes_final) : null },
      caption: `All ${n(FACTS.lanes_verified)} lane counts were verified by a person against aerial imagery. W Main St carries ${main.vpd_max != null ? n(main.vpd_max) : "its highest count"} vehicles per day on ${main.lanes_final != null ? main.lanes_final : "its verified"} lanes. Explore it yourself at ${LIVE_URL}` },
  ];
  return steps.map((s, i) => ({ ...s, index: i, number: i + 1, total: steps.length }));
}

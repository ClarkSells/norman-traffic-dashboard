// ## WHAT THIS FILE DOES
// The storyboard of present mode as data. buildScenes(raw) returns the 17 Scene objects (CONTRACTS.md C.2):
// title, caption, stats, a full dashboard state, basemap and light preset, a camera move, layer flags, motion
// and autoplay timing. It has no map and no DOM; app.js applyScene turns each object into map calls, ui/tour.js
// steps through them and ui/present.js renders the captions. Imports config.js, facts.js and data.js. The
// scene tests check captions quote facts.js and that every scene carries a complete state.
// The 17 present-mode scenes (0 to 16): the 15 from handoff/02_DESIGN_DIRECTION.md section 10 plus the two
// Simulate scenes (13 "runout", 14 "closure") after the ward scenes, as pure data (C.2).
// Captions quote facts.js / tour.js tokens exactly; the ward 2 count and the LOS C crossover list are
// computed with rankedRows exactly as tour.js does today. No map, no DOM: camera.js, layers/* and the
// tour player consume these objects.
import { SCENE_TIMING } from "./config.js";
import { FACTS, LIVE_URL, TOP5 } from "./facts.js";
import { closureImpact, countOver, rankedRows, SIM_DEFAULT, SIM_YEARS } from "./data.js";

// ## BASE, fullState, layers: builders that keep every scene complete
// A scene must carry a full state (not a patch) so applying it resets everything the previous scene changed.
// fullState and layers fill in every key with its default so a scene only spells out what differs.
// Same defaults tour.js BASE uses (the state.js explore defaults), so scene states never drift from explore.
// The Simulate keys (C.14) ride along at their defaults, so every existing scene shows today's numbers.
const BASE = { ward: null, metric: "combined", los: "E", yearMin: FACTS.year_min, yearMax: FACTS.year_max, includeCollectors: false, selectedLocId: null, ...SIM_DEFAULT, simPlaying: false };
const n = (v) => Number(v).toLocaleString("en-US");
const AUTOPLAY = { title: null, city: SCENE_TIMING.city, segment: SCENE_TIMING.segment, ward: SCENE_TIMING.ward, closing: null };

// Full C.1 state for a scene, never a partial patch. presenting is true while any scene is on screen.
// reducedMotion is a user preference the player overlays at apply time; scenes carry the default.
function fullState(basemap, patch, { heat = false, flow = false } = {}) {
  return { ...BASE, ...patch, basemap, reducedMotion: false, heat, flow, presenting: true };
}

// Complete C.2 layers object; dots default to "none" so crash dots only render where the storyboard lists them.
function layers({ flow = false, heat = false, dots = "none", callouts = [], pulse = [], mask = null, segmentsOpacity = 1 } = {}) {
  return { flow, heat, dots, callouts, pulse, mask, segmentsOpacity };
}

// ## buildScenes: compute the scene list from the loaded data
// The numbers in captions come from facts.js (verified constants) or from the same data.js functions the
// panel uses (rankedRows, countOver, closureImpact), never from a second calculation. The ward 2 list, the
// LOS C crossovers, the run out counts and the closure caption are computed up front, then the array below
// lays out the scenes in order.
// raw = getRaw(): { segments, wards, collisions, points, summary }. Only segments is read here.
export function buildScenes(raw) {
  const segs = (raw && raw.segments && raw.segments.features) || [];
  const byId = Object.fromEntries(segs.map(f => [f.properties.loc_id, f.properties]));
  const ward2 = rankedRows({ ...BASE, ward: 2 });
  const over1Rows = rankedRows({ ...BASE, ward: 2, los: "C" }).filter(r => r.v_c_active >= 1);
  const over1 = over1Rows.length;
  const over1Ids = over1Rows.map(r => r.loc_id);
  const top5Ids = TOP5.map(t => t.loc_id);
  const main = byId["52500-158"] || {};
  // Storyboard: callout "6 lanes · 31,886 VPD", built from the segment's own verified figures.
  const laneCallout = `${main.lanes_final != null ? main.lanes_final : "?"} lanes · ${main.vpd_max != null ? n(main.vpd_max) : "?"} VPD`;
  // Simulate scenes (C.14): the 2035 projection at base growth, and the closure of the top citywide segment.
  const vcState = { ...BASE, metric: "v_c" };
  const overToday = countOver(vcState, 0.9);
  const over2035 = countOver({ ...vcState, year: SIM_YEARS[1] }, 0.9);
  const listed = rankedRows(vcState).length;
  const closeId = TOP5[0].loc_id;
  const ci = closureImpact({ ...BASE, closing: closeId });
  // ## The closure scene caption
  // Built from closureImpact for the top citywide segment, with graceful wording when closure impacts are
  // missing or the road graph found no detour.
  const closureCaption = (() => {
    const t = TOP5[0];
    const head = `If ${t.name} closed between ${t.span.replace(" to ", " and ")}`;
    if (!ci || ci.missing) return `${head}, every vehicle on it would need another way through. Closure impacts are not loaded for this build.`;
    if (ci.no_path) return `${head}, the road graph finds no detour between its end nodes, so no volume is rerouted. The pipeline flags it for a closer look.`;
    const vol = ci.closed.vpd_max != null ? `its ${n(ci.closed.vpd_max)} vehicles a day` : "its traffic";
    const top = ci.top ? ` The largest increase lands on ${ci.top.on_road}, ${ci.top.from_road} to ${ci.top.to_road}: v/c ${ci.top.before.toFixed(2)} to ${ci.top.after.toFixed(2)}.` : "";
    const len = ci.detour_len_mi != null ? ` The detour runs ${ci.detour_len_mi.toFixed(1)} miles${ci.ratio != null ? `, ${ci.ratio.toFixed(1)} times the closed segment` : ""}.` : "";
    const flag = ci.flagged ? " The pipeline flags this detour as implausibly long." : "";
    return `${head}, ${vol} would route onto ${ci.detours.length} counted segment${ci.detours.length === 1 ? "" : "s"} along the shortest detour.${top}${len}${flag}`;
  })();

  // ## The scene list
  // Index, kind, and what each scene shows:
  //   0 title, 1 to 5 citywide (every segment, v/c, crash heat, crashes, combined with the top five),
  //   6 to 10 one scene per top five segment, 11 and 12 ward 2 and its LOS C change, 13 and 14 the Simulate
  //   scenes (the year runs out to 2035, then one closure), 15 the satellite lane count story, 16 closing.
  // kind drives the default autoplay length, camera.kind drives which camera move applySceneLayers uses.
  const scenes = [
    // 0: Title (storyboard copy verbatim, with the section 10 eyebrow and start hint)
    { id: "title", kind: "title", title: "Norman street segment priorities",
      caption: "Congestion, crashes and a combined score for every counted segment, by council ward",
      eyebrow: "Prepared for the City of Norman · MIS Data Analytics Case Competition · October 2026",
      hint: "Press space or Next",
      stats: [], legend: null, list: null,
      state: fullState("light", {}), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ dots: "none", segmentsOpacity: 0.5 }) },
    // 1: Every counted segment
    { id: "citywide", kind: "city", title: "Every counted segment in Norman",
      caption: `${n(FACTS.segments)} segments, ${n(FACTS.collision_rows)} crash records, ${n(FACTS.assigned_in_window)} assigned ${FACTS.year_min} to ${FACTS.year_max}. Each segment is colored by its combined score: crashes plus the volume to capacity ratio (v/c).`,
      stats: [{ label: "segments", value: n(FACTS.segments) }, { label: "crash records", value: n(FACTS.collision_rows) }, { label: "assigned", value: n(FACTS.assigned_in_window) }],
      legend: null, list: null,
      state: fullState("light", {}, { flow: true }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 14, driftDeg: 0 },
      layers: layers({ flow: true, dots: "none" }) },
    // 2: Volume alone
    { id: "vc", kind: "city", title: "Volume alone",
      caption: `Colored by v/c: the highest daily count at each location divided by its capacity at level of service (LOS) E. The highest v/c citywide is ${FACTS.v_c_max}, so no segment is over capacity on this measure.`,
      stats: [{ label: "highest v/c", value: FACTS.v_c_max }], legend: "v_c", list: null,
      state: fullState("light", { metric: "v_c" }, { flow: true }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ flow: true, dots: "none" }) },
    // 3: Where crashes cluster (heat fades in, segments at 35 percent, flow off)
    { id: "heat", kind: "city", title: "Where crashes cluster",
      caption: `Five years of crash records as a density surface: ${n(FACTS.collision_rows)} rows from ${FACTS.year_min} to ${FACTS.year_max}, ${n(FACTS.assigned_in_window)} of them assigned to a counted segment. The bright clusters show where crashes concentrate before any score is applied.`,
      stats: [{ label: "assigned", value: n(FACTS.assigned_in_window) }], legend: null, list: null,
      state: fullState("light", {}, { heat: true }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ heat: true, dots: "none", segmentsOpacity: 0.35 }) },
    // 4: Crashes by segment (heat fades out)
    { id: "crashes", kind: "city", title: "Crashes alone",
      caption: `Colored by crashes assigned to each segment, ${FACTS.year_min} to ${FACTS.year_max}. The map barely changes from the combined view: ${FACTS.rank_correlation_phrase}.`,
      stats: [], legend: null, list: null,
      state: fullState("light", { metric: "collisions" }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ dots: "none" }) },
    // 5: The combined score (orbit ends, top five called out and pulsed in rank order)
    { id: "combined", kind: "city", title: "Back to the combined score", autoplayMs: SCENE_TIMING.segment,   // storyboard: 12 s
      caption: "Combined score = crashes + v/c, exactly as the brief defines it. The five highest scoring segments in the city come next, in rank order.",
      stats: TOP5.map(t => ({ label: `#${t.rank} ${t.name}`, value: t.combined })), legend: null, list: null,
      state: fullState("light", {}, { flow: true }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ flow: true, dots: "none", callouts: top5Ids, pulse: top5Ids }) },
    // 6 to 10: #1 to #5 citywide, dolly with drift, crash reveal, flow on
    ...TOP5.map(t => {
      const p = byId[t.loc_id] || {};
      return { id: `top${t.rank}`, kind: "segment", title: `#${t.rank} citywide: ${t.name}`,
        caption: `${t.name}, ${t.span}. v/c ${t.v_c}, ${t.crashes} crashes, combined score ${t.combined}.`,
        stats: [
          { label: "VPD", value: p.vpd_max != null ? n(p.vpd_max) : "n/a" },
          { label: "lanes", value: p.lanes_final != null ? String(p.lanes_final) : "n/a" },
          { label: "v/c", value: t.v_c },
          { label: "crashes", value: String(t.crashes) },
          { label: "combined", value: t.combined }],
        legend: null, list: null,
        state: fullState("light", { selectedLocId: t.loc_id }, { flow: true }), basemap: "light", lightPreset: "dusk",
        camera: { kind: "segment", locId: t.loc_id }, motion: { orbitDeg: 0, driftDeg: 6 },
        layers: layers({ flow: true, dots: "segment", callouts: [t.loc_id], pulse: [t.loc_id] }) };
    }),
    // 11: How a councilmember reads their list (ward 2 mask, day preset, top five list cards; dots "all" so
    // the storyboard's "crashes outside ward 25 percent" render dimmed by the mask)
    { id: "ward2", kind: "ward", title: "How a councilmember reads their list",
      caption: `Ward 2 has ${ward2.length} arterial segments in its primary list, ranked top down by combined score. A boundary tag means the segment sits on a ward line: counted once, listed in both neighboring wards.`,
      stats: [], legend: null,
      list: ward2.slice(0, 5).map(r => ({ rank: r.rank, locId: r.loc_id, road: r.on_road, span: `${r.from_road} to ${r.to_road}`, score: r.combined_active.toFixed(2) })),
      state: fullState("light", { ward: 2 }), basemap: "light", lightPreset: "day",
      camera: { kind: "ward", ward: 2 }, motion: { orbitDeg: 0, driftDeg: 8 },
      layers: layers({ mask: 2, dots: "all" }) },
    // 12: What moves under LOS C (hold on the ward 2 framing, crossovers pulse and get callouts)
    { id: "losc", kind: "ward", title: "What moves under LOS C",
      caption: `LOS C uses the 2020 plan's lower capacities, so every v/c rises and ${over1} Ward 2 ${over1 === 1 ? "segment reaches" : "segments reach"} or pass 1.0. Crash counts do not move, so the order of the list barely changes.`,
      stats: [], legend: null, list: null,
      state: fullState("light", { ward: 2, los: "C" }), basemap: "light", lightPreset: "day",
      camera: { kind: "ward", ward: 2 }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ mask: 2, dots: "none", callouts: over1Ids, pulse: over1Ids }) },
    // 13: When does each corridor run out of road (the year plays 2025 to 2035 at base growth)
    { id: "runout", kind: "city", title: "When does each corridor run out of road",
      caption: `Each count projected forward at its own fitted growth rate, base band, school year Friday. ${overToday} of the ${listed} listed segments sit at or above v/c 0.9 today; ${over2035} do by 2035. Watch the year run from 2025 to 2035.`,
      stats: [{ label: "year", value: String(SIM_YEARS[0]), live: "year" }, { label: "at or over 0.9 today", value: String(overToday) }, { label: "at or over 0.9 by 2035", value: String(over2035) }, { label: "growth band", value: "base" }],
      legend: "v_c", list: null,
      state: fullState("light", { metric: "v_c" }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ dots: "none" }), yearPlay: { from: SIM_YEARS[0], to: SIM_YEARS[1] } },
    // 14: One closure (the top citywide segment closes, its detour draws, the detour segments repaint)
    { id: "closure", kind: "segment", title: "One closure",
      caption: closureCaption,
      stats: ci && ci.top ? [{ label: "closed", value: TOP5[0].name }, { label: `${ci.top.on_road}, v/c before`, value: ci.top.before.toFixed(2) }, { label: "v/c after", value: ci.top.after.toFixed(2) }] : [{ label: "closed", value: TOP5[0].name }],
      legend: "v_c", list: null,
      state: fullState("light", { metric: "v_c", closing: closeId }), basemap: "light", lightPreset: "dusk",
      camera: { kind: "segment", locId: closeId, zoom: 13.6 }, motion: { orbitDeg: 0, driftDeg: 5 },
      layers: layers({ dots: "none", callouts: [closeId] }) },
    // 15: The lane count story (satellite aerial on 52500-158, existing caption without the URL)
    { id: "lanes", kind: "segment", title: "The lane count story", autoplayMs: SCENE_TIMING.ward,   // storyboard: 14 s
      caption: `All ${n(FACTS.lanes_verified)} lane counts were verified by a person against aerial imagery. W Main St carries ${main.vpd_max != null ? n(main.vpd_max) : "its highest count"} vehicles per day on ${main.lanes_final != null ? main.lanes_final : "its verified"} lanes.`,
      stats: [], legend: null, list: null, calloutText: laneCallout,
      state: fullState("satellite", { selectedLocId: "52500-158" }, { flow: true }), basemap: "satellite", lightPreset: "dusk",
      camera: { kind: "aerial", locId: "52500-158" }, motion: { orbitDeg: 25, driftDeg: 0 },
      layers: layers({ flow: true, dots: "segment", callouts: ["52500-158"] }) },
    // 16: Closing (manual, bookend establish at 50 percent)
    { id: "closing", kind: "closing", title: "Explore it yourself",
      caption: `Every figure in this story traces to the workbook and the crash audit. Replay the story, or explore the dashboard yourself at ${LIVE_URL}`,
      stats: [], legend: null, list: null,
      state: fullState("light", {}), basemap: "light", lightPreset: "dusk",
      camera: { kind: "establish" }, motion: { orbitDeg: 0, driftDeg: 0 },
      layers: layers({ dots: "none", segmentsOpacity: 0.5 }) },
  ];
  // ## Fill in the bookkeeping fields: index, number, total and the default autoplay for the kind
  // eyebrow/hint default to null on every scene but the title (C.2 Wave 4 fields); yearPlay only on the run out scene.
  return scenes.map((s, i) => ({ eyebrow: null, hint: null, yearPlay: null, ...s, index: i, number: i + 1, total: scenes.length, autoplayMs: s.autoplayMs !== undefined ? s.autoplayMs : AUTOPLAY[s.kind] }));
}

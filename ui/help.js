// "How to read this" box. Plain words for a council audience.
// Counts come from summary.json (qa block) when present, so they follow a pipeline rerun.
export function helpHtml(qa) {
  const q = qa || {};
  const n = q.segments != null ? q.segments : 204;
  const shared = q.segments_shared_boundary != null ? q.segments_shared_boundary : 43;
  const fallback = q.segments_geometry_fallback != null ? q.segments_geometry_fallback : 6;
  return `<h3>How to read this map</h3>
    <dl>
      <dt>Volume to capacity ratio (v/c)</dt>
      <dd>The highest daily traffic count on the segment, in vehicles per day (VPD), divided by the vehicles per day the road is rated to carry. Values near or above 1.0 mean the road is at or over its rated capacity.</dd>
      <dt>Level of service (LOS)</dt>
      <dd>A letter grade for how freely traffic moves. The default capacity uses LOS E, from the 2025 plan. The LOS C option, from the 2020 plan, uses a lower capacity, so v/c values rise and more segments look crowded.</dd>
      <dt>Collisions</dt>
      <dd>Crashes from 2021 to 2025 that the pipeline assigned to the segment, within about 30 meters of its line. Use the two year menus to change the window. Grey dots are crashes that were not on a counted segment.</dd>
      <dt>Combined score</dt>
      <dd>Collisions plus v/c. Crash counts are much larger numbers than v/c, so the combined ranking and the crash-only ranking are nearly identical. Volume acts as a tiebreaker.</dd>
      <dt>Functional class</dt>
      <dd>Roads come in three classes: principal arterial, minor arterial and collector. The lists show arterials only. Tick "Include collectors" to add the third class.</dd>
      <dt>Shared boundary segments</dt>
      <dd>${shared} of the ${n} segments sit on a ward line. Each is counted once and listed in both neighboring wards. They carry a "boundary" tag in the table and a dashed line on the map.</dd>
      <dt>Fallback geometry</dt>
      <dd>For ${fallback} of the ${n} segments the pipeline could not cut a clean centerline between the two cross streets, so the drawn line is approximate. Treat the position and the crash count of those segments with care.</dd>
    </dl>`;
}

// Wires the toggle button. Returns a setter so tests and callers can open or close the box.
export function initHelp(qa) {
  const btn = document.getElementById("help-toggle"), box = document.getElementById("help-box");
  if (!btn || !box) return null;
  box.innerHTML = helpHtml(qa);
  const set = (open) => {
    box.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("open", open);
  };
  set(false);
  btn.addEventListener("click", () => set(box.hidden));
  box.addEventListener("keydown", (e) => { if (e.key === "Escape") { set(false); btn.focus(); } });
  return set;
}

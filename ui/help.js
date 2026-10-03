// "How to read this" box. Plain words for a council audience.
// Counts come from summary.json (qa block) when present, so they follow a pipeline rerun.
// The wording tracks docs/report/sections/parts/limits_box.md so the dashboard and the report agree.
export const FALLBACK_IDS = ["52500-76", "52500-133", "52500-183", "52500-206", "52500-228", "52500-237"];

export function helpHtml(qa) {
  const q = qa || {};
  const n = q.segments != null ? q.segments : 204;
  const shared = q.segments_shared_boundary != null ? q.segments_shared_boundary : 43;
  const fallback = q.segments_geometry_fallback != null ? q.segments_geometry_fallback : 6;
  const verified = q.segments_lanes_verified != null ? q.segments_lanes_verified : 204;
  return `<h3>How to read this map</h3>
    <dl>
      <dt>Volume to capacity ratio (v/c)</dt>
      <dd>The highest daily traffic count on the segment, in vehicles per day (VPD), divided by the vehicles per day the road is rated to carry. Values near or above 1.0 mean the road is at or over its rated capacity. Each volume is the highest single count year recorded at that location, not an average across years, which can overstate typical traffic where one year ran hot.</dd>
      <dt>Level of service (LOS)</dt>
      <dd>A letter grade for how freely traffic moves. The default capacity uses LOS E from the ACOG lane capacity table (2025 plan). The LOS C option, from the 2020 plan, uses a lower capacity, so v/c values rise and more segments look crowded. All ${verified} lane counts were verified by a person against aerial imagery.</dd>
      <dt>Collisions</dt>
      <dd>Crashes from 2021 to 2025 that the pipeline assigned to the segment, within about 30 meters of its line. Use the year range to change the window. Grey dots are crashes that were not on a counted segment.</dd>
      <dt>Combined score</dt>
      <dd>Collisions plus v/c. Crash counts are much larger numbers than v/c, so the combined ranking and the crash-only ranking are nearly identical (rank correlation above 0.99). Volume acts as a tiebreaker. Read it as a safety ranking tempered by congestion, not the reverse.</dd>
      <dt>Functional class</dt>
      <dd>Roads come in three classes: principal arterial, minor arterial and collector. Collectors are scored but excluded from the primary ward lists, so the table shows arterials only. Tick "Include collectors" to add the third class.</dd>
      <dt>Shared boundary segments</dt>
      <dd>${shared} of the ${n} segments sit on a ward line. Each is counted once and listed in both neighboring wards. They carry a "boundary" tag in the table and a dashed line on the map.</dd>
      <dt>Fallback geometry</dt>
      <dd>${fallback} of the ${n} segments (${FALLBACK_IDS.join(", ")}) use an approximate 800 meter geometry window around the count point because their endpoints do not match the city centerlines. Their drawn line and their per mile crash rates are approximate and should be read with care.</dd>
    </dl>
    <p class="help-note">These four choices were confirmed by the project sponsor: capacity at LOS E, collectors excluded from the primary lists, boundary segments listed in both wards, collision years 2021 to 2025.</p>`;
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
    if (open && typeof box.focus === "function") box.focus({ preventScroll: true });   // Escape and screen readers start inside the box
  };
  set(false);
  btn.addEventListener("click", () => set(box.hidden));
  box.addEventListener("keydown", (e) => { if (e.key === "Escape") { set(false); btn.focus(); } });
  return set;
}

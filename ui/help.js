// "How to read this" overlay: four short cards over the panel, one figure each, plain words for a council audience.
// Counts come from summary.json (qa block) when present, so they follow a pipeline rerun.
// The wording tracks docs/report/sections/parts/limits_box.md so the dashboard and the report agree.
export const FALLBACK_IDS = ["52500-76", "52500-133", "52500-183", "52500-206", "52500-228", "52500-237"];

export function helpHtml(qa) {
  const q = qa || {};
  const verified = q.segments_lanes_verified != null ? q.segments_lanes_verified : 204;
  return `<h3 id="help-heading">How to read this map</h3>
    <div class="help-cards">
      <section class="help-card">
        <h4>Volume to capacity (v/c)</h4>
        <div class="help-figure">1.0</div>
        <p>The highest daily traffic count on the segment divided by what the road is rated to carry. Near or above 1.0 the road is at or over capacity. Each volume is the highest single count year recorded there, not an average across years.</p>
      </section>
      <section class="help-card">
        <h4>Level of service (LOS)</h4>
        <div class="help-figure">${verified}</div>
        <p>The capacity table behind v/c. LOS E (2025 plan) is the default; LOS C (2020 plan) rates roads lower, so v/c rises and more segments look crowded. All ${verified} lane counts were verified by a person against aerial imagery.</p>
      </section>
      <section class="help-card">
        <h4>Collisions</h4>
        <div class="help-figure">30 m</div>
        <p>Crashes from 2021 to 2025 assigned to the segment within about 30 meters of its line. Grey dots are crashes that were not on a counted segment. The year range in Settings changes the window.</p>
      </section>
      <section class="help-card">
        <h4>Combined score</h4>
        <div class="help-figure">&gt;0.99</div>
        <p>Collisions plus v/c. The combined and crash only rankings are nearly identical (rank correlation above 0.99), so volume acts as a tiebreaker. Read it as a safety ranking tempered by congestion, not the reverse.</p>
      </section>
    </div>`;
}

// Wires the toggle button and the close button. Returns { close, set } so Reset view can shut the overlay.
export function initHelp(qa) {
  const btn = document.getElementById("help-toggle"), box = document.getElementById("help-box");
  if (!btn || !box) return null;
  box.innerHTML = helpHtml(qa);
  const closeBtn = document.createElement("button");
  closeBtn.setAttribute("type", "button");
  closeBtn.setAttribute("class", "btn small help-close");
  closeBtn.setAttribute("aria-label", "Close help");
  closeBtn.textContent = "Close";
  box.appendChild(closeBtn);
  const set = (open) => {
    box.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    btn.classList.toggle("open", open);
    if (open && typeof box.focus === "function") box.focus({ preventScroll: true });   // Escape and screen readers start inside the overlay
  };
  const close = () => {
    if (box.hidden) return;
    set(false);
    if (typeof btn.focus === "function") btn.focus();
  };
  closeBtn.addEventListener("click", () => close());
  set(false);
  btn.addEventListener("click", () => (box.hidden ? set(true) : close()));
  // Escape works wherever focus is while the overlay is open, and focus that strays outside is pulled back in (3.7-10).
  const onKey = (e) => { if (e.key === "Escape") close(); };
  box.addEventListener("keydown", onKey);
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", (e) => {
      if (box.hidden || !e || !e.target || e.target === box) return;
      if (typeof box.contains === "function" && !box.contains(e.target) && typeof box.focus === "function") box.focus({ preventScroll: true });
    });
  }
  return { close, set };
}

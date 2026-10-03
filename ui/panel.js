// Left panel: briefing header, controls, stat tiles and the ranked table.
import { summarize, yearExtent, years } from "../data.js";
import { getState, setState } from "../state.js";
import { METRIC_LABEL } from "../config.js";
import { animateNumber, capMoves, flipPlan, measureRows, playFlip } from "../motion.js";

export function num(v, d = 2) { return v == null ? "n/a" : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
export function int(v) { return v == null ? "n/a" : Math.round(Number(v)).toLocaleString("en-US"); }
const ARTERIAL = new Set(["Principal Arterial", "Minor Arterial"]);
const METRIC_WORD = { combined: "combined score", v_c: "volume to capacity ratio (v/c)", collisions: "crash count" };

// "Ward 2" or "All wards"
export function briefingTitle(state) { return state.ward == null ? "All wards" : `Ward ${state.ward}`; }

// One sentence that says what is on screen, e.g. "31 segments, ranked by combined score, crashes 2021 to 2025".
export function briefingLine(state, summary) {
  const n = summary.n;
  const parts = [`${n} segment${n === 1 ? "" : "s"}`, `ranked by ${METRIC_WORD[state.metric] || state.metric}`, `crashes ${state.yearMin} to ${state.yearMax}`];
  if (state.los === "C") parts.push("capacity at LOS C");
  if (state.includeCollectors) parts.push("collectors included");
  return parts.join(", ");
}

// Shared behaviour of every segmented control: one pressed button, data-<key> carries the value.
function wireSegmented(id, key, parse) {
  const box = document.getElementById(id);
  if (!box) return;
  box.addEventListener("click", (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const value = parse ? parse(btn.dataset[key]) : btn.dataset[key];
    const patch = { [key]: value };
    if (key === "ward") patch.selectedLocId = null;
    syncSegmented(id, key, value);   // immediate feedback; render() syncs again from state
    setState(patch);
  });
}

function syncSegmented(id, key, value) {
  const box = document.getElementById(id);
  if (!box || typeof box.querySelectorAll !== "function") return;
  const want = value == null ? "" : String(value);
  box.querySelectorAll("button").forEach(b => {
    const on = (b.dataset[key] == null ? "" : String(b.dataset[key])) === want;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

// Two handle year range. Both inputs share one track; the lower one may not pass the upper one.
export function clampYears(a, b, lo, hi) {
  a = Math.min(Math.max(a, lo), hi); b = Math.min(Math.max(b, lo), hi);
  return a <= b ? [a, b] : [b, a];
}
export function rangeFill(a, b, lo, hi) {
  const span = Math.max(1, hi - lo);
  return { left: `${((a - lo) / span) * 100}%`, right: `${((hi - b) / span) * 100}%` };
}

// Keeps a state patch (from the hash or the tour) inside the years the data actually carries.
export function clampPatchYears(patch) {
  if (patch.yearMin == null && patch.yearMax == null) return patch;
  const ext = yearExtent(), s = getState();
  const [a, b] = clampYears(patch.yearMin != null ? patch.yearMin : s.yearMin, patch.yearMax != null ? patch.yearMax : s.yearMax, ext.min, ext.max);
  return { ...patch, yearMin: a, yearMax: b };
}

export function initControls() {
  wireSegmented("ward-toggle", "ward", v => (v === "" || v == null ? null : Number(v)));
  wireSegmented("metric-toggle", "metric");
  wireSegmented("los-toggle", "los");

  const ext = yearExtent();
  const yMin = document.getElementById("year-min"), yMax = document.getElementById("year-max");
  for (const el of [yMin, yMax]) { el.min = String(ext.min); el.max = String(ext.max); el.step = "1"; }
  const ticks = document.getElementById("year-ticks");
  if (ticks) { let h = ""; for (let y = ext.min; y <= ext.max; y++) h += `<span>${y}</span>`; ticks.innerHTML = h; }
  const s = getState(), ys = years();
  const [a0, b0] = clampYears(s.yearMin != null ? s.yearMin : ys[0], s.yearMax != null ? s.yearMax : ys[ys.length - 1], ext.min, ext.max);
  setState({ yearMin: a0, yearMax: b0 });
  const onYears = () => {
    const [a, b] = clampYears(Number(yMin.value), Number(yMax.value), ext.min, ext.max);
    yMin.value = String(a); yMax.value = String(b);
    setState({ yearMin: a, yearMax: b });
  };
  yMin.addEventListener("input", onYears); yMax.addEventListener("input", onYears);
  yMin.addEventListener("change", onYears); yMax.addEventListener("change", onYears);

  const sw = document.getElementById("show-collectors");
  sw.addEventListener("change", (e) => setState({ includeCollectors: !!e.target.checked }));
  syncControls(getState());
  initSettings();
}

// Climbs from a control's inner element to its .control wrapper so the wrapper can move as one block.
function controlHost(el) {
  let host = el;
  while (host && host.parentNode && !(host.classList && host.classList.contains("control"))) host = host.parentNode;
  return host;
}

// The quiet Settings disclosure: LOS, year range and Include collectors move behind it, next to the
// Crash density (state.heat) and Traffic flow (state.flow) switches. Returns a setter like the other toggles.
export function initSettings() {
  if (settingsSet) return settingsSet;
  const toggle = document.getElementById("settings-toggle"), settings = document.getElementById("settings");
  if (!toggle || !settings) return null;
  for (const id of ["los-toggle", "year-min", "show-collectors"]) {
    const inner = document.getElementById(id);
    if (!inner) continue;
    const host = controlHost(inner);
    if (host && host !== settings && host.parentNode !== settings && typeof settings.appendChild === "function") settings.appendChild(host);
  }
  const set = (open) => {
    settings.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("open", open);
  };
  set(false);
  toggle.addEventListener("click", () => set(settings.hidden));
  for (const [id, key] of [["heat-toggle", "heat"], ["flow-toggle", "flow"]]) {
    const sw = document.getElementById(id);
    if (sw) sw.addEventListener("change", (e) => setState({ [key]: !!(e.target ? e.target.checked : sw.checked) }));
  }
  syncControls(getState());
  settingsSet = set;
  return set;
}

// Reflects state into the controls. Used after a hash restore, a tour step or a reset.
export function syncControls(state) {
  syncSegmented("ward-toggle", "ward", state.ward);
  syncSegmented("metric-toggle", "metric", state.metric);
  syncSegmented("los-toggle", "los", state.los);
  const yMin = document.getElementById("year-min"), yMax = document.getElementById("year-max");
  if (yMin && yMax) {
    yMin.value = String(state.yearMin); yMax.value = String(state.yearMax);
    yMin.setAttribute("aria-valuetext", `${state.yearMin}`); yMax.setAttribute("aria-valuetext", `${state.yearMax}`);
    const lo = Number(yMin.min), hi = Number(yMin.max);
    const fill = document.getElementById("year-fill");
    if (fill && fill.style && Number.isFinite(lo) && Number.isFinite(hi)) { const f = rangeFill(state.yearMin, state.yearMax, lo, hi); fill.style.left = f.left; fill.style.right = f.right; }
  }
  const label = document.getElementById("year-label");
  if (label) label.textContent = state.yearMin === state.yearMax ? `${state.yearMin} only` : `${state.yearMin} to ${state.yearMax}`;
  const sw = document.getElementById("show-collectors");
  if (sw) { sw.checked = !!state.includeCollectors; sw.setAttribute("aria-checked", String(!!state.includeCollectors)); }
  // heat and flow arrive in state with Wave 2; read them tolerantly (heat defaults on, flow defaults off).
  const heat = document.getElementById("heat-toggle");
  if (heat) { const on = state.heat !== false; heat.checked = on; heat.setAttribute("aria-checked", String(on)); }
  const flow = document.getElementById("flow-toggle");
  if (flow) { const on = state.flow === true; flow.checked = on; flow.setAttribute("aria-checked", String(on)); }
  const basemap = document.getElementById("basemap-toggle");
  if (basemap) { basemap.setAttribute("aria-pressed", String(state.basemap === "satellite")); basemap.textContent = state.basemap === "satellite" ? "Streets" : "Satellite"; }
}

// On narrow screens the list stacks above the map. "Hide list" collapses it so the map gets the full height.
export function initPanelToggle() {
  const btn = document.getElementById("panel-toggle"), layout = document.getElementById("layout");
  if (!btn || !layout) return null;
  const set = (open) => {
    layout.classList.toggle("panel-collapsed", !open);
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Hide list" : "Show list";
  };
  set(true);
  btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
  return set;
}

// Enter or Space on a focused row acts like a click. Other keys fall through.
export function rowKeyActivates(e) { return e.key === "Enter" || e.key === " " || e.key === "Spacebar"; }

// Moves the tab stop and the focus between rows. Arrows step, Home and End jump; the target scrolls into view.
function setRoving(loc) {
  rovingLoc = loc;
  for (const [id, tr] of rowsByLoc) tr.tabIndex = id === loc ? 0 : -1;
}

function moveRowFocus(fromLoc, key) {
  const tbody = document.querySelector("#rank-table tbody");
  if (!tbody || !tbody.children) return;
  const list = tbody.children.filter(c => c.dataset && c.dataset.loc);
  if (!list.length) return;
  const idx = Math.max(0, list.findIndex(c => c.dataset.loc === fromLoc));
  const next = key === "Home" ? 0 : key === "End" ? list.length - 1 : key === "ArrowDown" ? Math.min(list.length - 1, idx + 1) : Math.max(0, idx - 1);
  const target = list[next];
  if (!target) return;
  setRoving(target.dataset.loc);
  if (typeof target.focus === "function") target.focus();
  if (typeof target.scrollIntoView === "function") target.scrollIntoView({ block: "nearest", behavior: "auto" });
}

function rowKey(e, locId, onRowClick) {
  if (rowKeyActivates(e)) { e.preventDefault(); onRowClick(locId); return; }
  if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") { e.preventDefault(); moveRowFocus(locId, e.key); }
}

export function rowCells(r, state, maxScore) {
  const share = maxScore > 0 && r.metric_value != null ? Math.max(0, Math.min(1, r.metric_value / maxScore)) : 0;
  const scoreText = state.metric === "v_c" ? num(r.v_c_active) : state.metric === "collisions" ? int(r.collisions_active) : num(r.combined_active);
  return `<td class="num rank">${r.rank}</td>
      <td><div class="road">${r.on_road}${r.shared_boundary ? '<span class="tag">boundary</span>' : ""}${ARTERIAL.has(r.functional_class) ? "" : '<span class="tag">collector</span>'}</div><div class="span">${r.from_road} to ${r.to_road}</div></td>
      <td class="num">${num(r.v_c_active)}</td><td class="num">${int(r.collisions_active)}</td>
      <td class="num score"><div class="bar" aria-hidden="true"><i style="width:${(share * 100).toFixed(1)}%"></i></div><span>${scoreText}</span></td>`;
}

// Why the list is empty, in words, with a way out.
export function emptyMessage(state) {
  const where = state.ward == null ? "the city" : `Ward ${state.ward}`;
  if (!state.includeCollectors) return { title: `No arterial segments to show in ${where}`, body: "The primary lists hold principal and minor arterials only. Turn on Include collectors to add the third functional class, or pick another ward.", action: "Include collectors" };
  return { title: `No segments to show in ${where}`, body: "Nothing matches the current filters. Reset the view to return to the citywide list.", action: "Reset view" };
}

const rowsByLoc = new Map();
let hoverLoc = null;
let rovingLoc = null;      // the row that holds the tab stop (roving tabindex)
let settingsSet = null;    // initSettings runs once; repeated calls return the same setter

// Renders the ranked table with keyed rows (one <tr> per loc_id is reused across renders so focus and hover survive).
// hooks: { onHover(locId|null), beforeUpdate(), afterUpdate(added, removed) } are optional.
export function renderTable(state, onRowClick, hooks = {}) {
  const summary = summarize(state);
  const rows = summary.rows;
  const tbody = document.querySelector("#rank-table tbody");
  const active = typeof document !== "undefined" ? document.activeElement : null;
  const hadFocus = !!(active && typeof tbody.contains === "function" && tbody.contains(active));
  const reduced = !!state.reducedMotion;
  const wrap = document.getElementById("table-wrap");
  const viewport = wrap && wrap.getBoundingClientRect ? (() => { const r = wrap.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; })() : null;
  const before = reduced ? null : measureRows(rowsByLoc, viewport);
  if (hooks.beforeUpdate) hooks.beforeUpdate(rowsByLoc);

  const seen = new Set(), added = [];
  for (const r of rows) {
    let tr = rowsByLoc.get(r.loc_id);
    if (!tr) {
      tr = document.createElement("tr");
      tr.dataset.loc = r.loc_id; tr.tabIndex = -1;
      tr.setAttribute("role", "button");
      tr.addEventListener("click", () => onRowClick(r.loc_id));
      tr.addEventListener("keydown", (e) => rowKey(e, r.loc_id, onRowClick));
      tr.addEventListener("mouseenter", () => { if (hooks.onHover) hooks.onHover(r.loc_id); });
      tr.addEventListener("mouseleave", () => { if (hooks.onHover) hooks.onHover(null); });
      rowsByLoc.set(r.loc_id, tr);
      added.push(tr);
    }
    const sig = JSON.stringify([r.rank, r.v_c_active, r.collisions_active, r.metric_value, summary.maxScore, state.metric]);
    if (tr.__sig !== sig) { tr.innerHTML = rowCells(r, state, summary.maxScore); tr.__sig = sig; }
    const selected = r.loc_id === state.selectedLocId;
    tr.classList.toggle("selected", selected);
    tr.classList.toggle("leaving", false);
    tr.setAttribute("aria-selected", String(selected));
    tbody.appendChild(tr);   // appending an existing node moves it: this is the reorder
    seen.add(r.loc_id);
  }
  const removed = [];
  for (const [loc, tr] of rowsByLoc) if (!seen.has(loc)) { removed.push(tr); rowsByLoc.delete(loc); }
  // Rows that left fade out and are then removed; new rows fade in; moved rows play a FLIP. Capped so 204 rows stay smooth.
  if (reduced || typeof requestAnimationFrame !== "function") for (const tr of removed) tr.remove();
  else {
    for (const tr of removed) { tr.classList.toggle("leaving", true); tbody.appendChild(tr); }
    setTimeout(() => { for (const tr of removed) tr.remove(); }, 400);
    for (const tr of added) { tr.classList.toggle("entering", true); setTimeout(() => tr.classList.toggle("entering", false), 400); }
    const after = measureRows(rowsByLoc, viewport);
    const plan = flipPlan(before, after);
    playFlip({ moves: capMoves(plan.moves, 60) }, rowsByLoc, { reduced });
  }
  if (hooks.afterUpdate) hooks.afterUpdate(added, removed, rowsByLoc);

  // Roving tabindex: the selected row holds the tab stop, else the last focused row, else the first row.
  if (state.selectedLocId && rowsByLoc.has(state.selectedLocId)) rovingLoc = state.selectedLocId;
  if (!rovingLoc || !rowsByLoc.has(rovingLoc)) rovingLoc = rows.length ? rows[0].loc_id : null;
  if (rovingLoc) setRoving(rovingLoc);
  // The selected row stays pinned visible.
  if (state.selectedLocId) { const tr = rowsByLoc.get(state.selectedLocId); if (tr && typeof tr.scrollIntoView === "function") tr.scrollIntoView({ block: "nearest", behavior: "auto" }); }

  const empty = document.getElementById("table-empty");
  if (empty) {
    if (rows.length === 0) {
      const m = emptyMessage(state);
      empty.innerHTML = `<h3>${m.title}</h3><p>${m.body}</p><button type="button" class="btn small" data-action="${m.action}">${m.action}</button>`;
      empty.hidden = false;
    } else empty.hidden = true;
  }
  if (hadFocus && state.selectedLocId) { const tr = rowsByLoc.get(state.selectedLocId); if (tr) tr.focus(); }
  renderStats(state, summary, (el, value, formatter) => animateNumber(el, value, formatter, { reduced }));
  renderBriefing(state, summary);
  return rows;
}

// One mono line under the controls, e.g. "177 segments · 5,121 crashes 2021 to 2025 · top: W Main St".
// Driven by the same summarize() result as the stat tiles; the tiles keep their ids but the line is the visual.
export function statsLine(state, summary) {
  const n = summary.n;
  const window = state.yearMin === state.yearMax ? `in ${state.yearMin}` : `${state.yearMin} to ${state.yearMax}`;
  return `${int(n)} segment${n === 1 ? "" : "s"} · ${int(summary.crashes)} crashes ${window} · top: ${summary.top ? summary.top.on_road : "none"}`;
}

export function renderStats(state, summary, animateNumber) {
  const put = (id, value, formatter) => {
    const el = document.getElementById(id); if (!el) return;
    if (animateNumber) animateNumber(el, value, formatter); else el.textContent = formatter(value);
  };
  put("stat-segments", summary.n, int);
  put("stat-crashes", summary.crashes, int);
  const top = document.getElementById("stat-top"), topLabel = document.getElementById("stat-top-label");
  if (top) top.textContent = summary.top ? `${summary.top.on_road}, ${summary.top.from_road} to ${summary.top.to_road}` : "none";
  if (topLabel) topLabel.textContent = summary.top ? `top segment by ${METRIC_WORD[state.metric] || state.metric}` : "top segment";
  let line = document.getElementById("stats-line");
  if (!line && typeof document.createElement === "function") {
    const stats = document.getElementById("stats");
    if (stats && typeof stats.appendChild === "function") {
      line = document.createElement("div");
      line.setAttribute("id", "stats-line");
      line.setAttribute("class", "stats-line");
      stats.appendChild(line);
    }
  }
  if (line) line.textContent = statsLine(state, summary);
}

export function renderBriefing(state, summary) {
  const t = document.getElementById("briefing-title"), l = document.getElementById("briefing-line");
  if (t) t.textContent = briefingTitle(state);
  if (l) l.textContent = briefingLine(state, summary);
  if (typeof document !== "undefined" && document.title !== undefined) document.title = `${briefingTitle(state)}, ${METRIC_LABEL[state.metric] || state.metric}: Norman segment priorities`;
}

// Map hover -> table: marks the row and scrolls it into view without stealing focus.
export function highlightRow(locId) {
  if (hoverLoc && hoverLoc !== locId) { const old = rowsByLoc.get(hoverLoc); if (old) old.classList.toggle("hover", false); }
  hoverLoc = locId;
  if (!locId) return;
  const tr = rowsByLoc.get(locId);
  if (!tr) return;
  tr.classList.toggle("hover", true);
  if (typeof tr.scrollIntoView === "function") tr.scrollIntoView({ block: "nearest", behavior: "auto" });
}

export function rowElement(locId) { return rowsByLoc.get(locId) || null; }

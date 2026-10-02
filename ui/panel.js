import { rankedRows, years } from "../data.js";
import { getState, setState } from "../state.js";

function num(v, d = 2) { return v == null ? "n/a" : Number(v).toLocaleString(undefined, { maximumFractionDigits: d }); }

export function initControls() {
  const wardSel = document.getElementById("ward-select");
  for (let w = 1; w <= 8; w++) wardSel.insertAdjacentHTML("beforeend", `<option value="${w}">Ward ${w}</option>`);
  wardSel.addEventListener("change", () => setState({ ward: wardSel.value ? Number(wardSel.value) : null, selectedLocId: null }));

  for (const [id, key] of [["metric-toggle", "metric"], ["los-toggle", "los"]]) {
    const box = document.getElementById(id);
    box.addEventListener("click", (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      box.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
      setState({ [key]: btn.dataset[key] });
    });
  }
  const ys = years();
  const yMin = document.getElementById("year-min"), yMax = document.getElementById("year-max");
  for (const y of ys) { yMin.insertAdjacentHTML("beforeend", `<option>${y}</option>`); yMax.insertAdjacentHTML("beforeend", `<option>${y}</option>`); }
  const s = getState();
  yMin.value = String(Math.max(s.yearMin, ys[0])); yMax.value = String(Math.min(s.yearMax, ys[ys.length - 1]));
  setState({ yearMin: Number(yMin.value), yearMax: Number(yMax.value) });
  const onYears = () => {
    let a = Number(yMin.value), b = Number(yMax.value);
    if (a > b) { [a, b] = [b, a]; yMin.value = String(a); yMax.value = String(b); }
    setState({ yearMin: a, yearMax: b });
  };
  yMin.addEventListener("change", onYears); yMax.addEventListener("change", onYears);
  document.getElementById("show-collectors").addEventListener("change", (e) => setState({ includeCollectors: e.target.checked }));
}

export function renderTable(state, onRowClick) {
  const rows = rankedRows(state);
  const tbody = document.querySelector("#rank-table tbody");
  tbody.innerHTML = rows.map(r => `<tr data-loc="${r.loc_id}" class="${r.loc_id === state.selectedLocId ? "selected" : ""}">
      <td class="num">${r.rank}</td>
      <td><div class="road">${r.on_road}${r.shared_boundary ? '<span class="tag">boundary</span>' : ""}</div><div class="span">${r.from_road} to ${r.to_road}</div></td>
      <td class="num">${num(r.v_c_active)}</td><td class="num">${num(r.collisions_active, 0)}</td><td class="num">${num(r.combined_active, 1)}</td></tr>`).join("");
  tbody.querySelectorAll("tr").forEach(tr => tr.addEventListener("click", () => onRowClick(tr.dataset.loc)));
  const n = rows.length, over = rows.filter(r => r.v_c_active >= 1).length, crashes = rows.reduce((a, r) => a + r.collisions_active, 0);
  document.getElementById("stats").innerHTML = [["segments", n], ["over capacity", over], ["collisions", crashes.toLocaleString()]]
    .map(([l, v]) => `<div class="stat"><div class="value">${v}</div><div class="label">${l}</div></div>`).join("");
  return rows;
}

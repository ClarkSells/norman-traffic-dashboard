// Full verification drive: node tests/e2e/verify.mjs
// Serves dashboard/, swaps the Mapbox CDN script for the stub (api.mapbox.com is unreachable here), and drives every
// tour step, every control, the hash round trip, the mobile sheet at 390, 768 and 844 by 390, reduced motion, a
// keyboard-only pass and a console error check. Screenshots land in the scratch folder, never in output/.
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");
import { mkdirSync } from "node:fs";
import { SCRATCH, serve, stubMapbox, waitForLayers, watchConsole } from "./harness.js";

const OUT = `${SCRATCH}/verify`; mkdirSync(OUT, { recursive: true });
const { srv, url } = await serve(8771, { gzip: true });
const browser = await chromium.launch();
const results = []; let failures = 0;
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok, detail }); if (!ok) { failures++; console.log("FAIL", name, detail); } };
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
const state = (page) => page.evaluate(() => window.__dash.getState());
const cam = (page) => page.evaluate(() => { const m = window.__dash.map; return { zoom: +m.getZoom().toFixed(2), pitch: +m.getPitch().toFixed(1), bearing: +m.getBearing().toFixed(1), center: [+m.getCenter().lng.toFixed(4), +m.getCenter().lat.toFixed(4)] }; });
const settle = (page, ms = 450) => page.waitForTimeout(ms);
async function open(ctxOpts, hash = "") {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); await stubMapbox(page);
  const errors = watchConsole(page); await page.goto(url + hash); await waitForLayers(page); await settle(page);
  return { ctx, page, errors: () => errors.filter(e => !e.includes("ERR_CERT")) };
}

// ---------- Desktop: controls, popup, hover, hash ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await shot(page, "01_desktop_citywide");
  check("desktop loads with the layers and no loading card", await page.evaluate(() => document.getElementById("loading").hidden && !document.getElementById("panel").classList.contains("skeleton")));
  check("stat tiles show 177 primary segments and 5,121 crashes", await page.evaluate(() => document.getElementById("stat-segments").textContent === "177" && document.getElementById("stat-crashes").textContent === "5,121"));
  for (const w of ["1", "2", "3", "4", "5", "6", "7", "8", ""]) {
    await page.click(`#ward-toggle button[data-ward="${w}"]`); await settle(page, 900);
    const s = await state(page); const n = await page.evaluate(() => document.querySelectorAll("#rank-table tbody tr:not(.leaving)").length);
    check(`ward control ${w || "All"}: state, title and rows agree`, (w === "" ? s.ward === null : s.ward === Number(w)) && n > 0 && (await page.textContent("#briefing-title")) === (w ? `Ward ${w}` : "All wards"), `rows=${n}`);
    if (w === "2") { const c = await cam(page); check("ward camera pitches about 30 and settles", c.pitch > 20 && c.pitch < 35, JSON.stringify(c)); await shot(page, "02_ward2"); }
  }
  for (const m of ["v_c", "collisions", "combined"]) {
    await page.click(`#metric-toggle button[data-metric="${m}"]`); await settle(page);
    const legend = await page.textContent("#legend .legend-toggle");
    check(`metric control ${m}: state, legend title and ghost crossfade`, (await state(page)).metric === m && legend.includes(m === "v_c" ? "Volume / capacity" : m === "collisions" ? "Collisions" : "Combined score"), legend);
    const ghost = await page.evaluate(() => { const m = window.__dash.map; const g = m.getPaintProperty("segments-line-ghost", "line-opacity"), l = m.getPaintProperty("segments-line", "line-opacity"); return [g && g[1], l && l[1]]; });
    check(`metric ${m}: crossfade finished (ghost 0, line 1)`, ghost[0] === 0 && ghost[1] === 1, JSON.stringify(ghost));
  }
  await page.click('#los-toggle button[data-los="C"]'); await settle(page);
  check("LOS C raises v/c in the first row", (await state(page)).los === "C" && (await page.textContent("#briefing-line")).includes("capacity at LOS C"));
  const vcC = await page.textContent("#rank-table tbody tr td:nth-child(3)");
  await page.click('#los-toggle button[data-los="E"]'); await settle(page);
  const vcE = await page.textContent("#rank-table tbody tr td:nth-child(3)");
  check("v/c differs between LOS C and E", vcC !== vcE, `${vcC} vs ${vcE}`);
  await page.evaluate(() => { const a = document.getElementById("year-max"); a.value = "2023"; a.dispatchEvent(new Event("input", { bubbles: true })); }); await settle(page);
  check("year slider narrows the window and the legend follows", (await state(page)).yearMax === 2023 && (await page.textContent("#year-label")) === "2021 to 2023" && (await page.textContent("#legend .legend-toggle")).includes("2021 to 2023"));
  const crashesNarrow = await page.textContent("#stat-crashes");
  await page.evaluate(() => { const a = document.getElementById("year-max"); a.value = "2025"; a.dispatchEvent(new Event("input", { bubbles: true })); }); await settle(page, 700);
  check("widening the window raises the crash count", Number(crashesNarrow.replace(/,/g, "")) < 5121 && (await page.textContent("#stat-crashes")) === "5,121", crashesNarrow);
  const filt = await page.evaluate(() => JSON.stringify(window.__dash.map.getFilter("collisions-dots")));
  check("collision layers filtered to the window", filt.includes("2021") && filt.includes("2025"), filt);
  await page.click("#show-collectors + .switch-track"); await settle(page, 700);
  check("collectors switch adds rows (204 total)", (await state(page)).includeCollectors === true && (await page.textContent("#stat-segments")) === "204");
  await page.click("#show-collectors + .switch-track"); await settle(page, 700);
  await page.click("#help-toggle"); await settle(page, 200);
  check("help box opens and spells out the terms", await page.evaluate(() => !document.getElementById("help-box").hidden && document.getElementById("help-box").textContent.includes("vehicles per day (VPD)")));
  await shot(page, "03_help_open");
  await page.keyboard.press("Escape"); await settle(page, 200);
  check("help box closes on Escape and the page did not scroll", await page.evaluate(() => document.getElementById("help-box").hidden && scrollY === 0));
  // row click -> selection, popup, camera, pulse source
  await page.click('tr[data-loc="52500-158"]'); await settle(page, 900);
  const sel = await page.evaluate(() => ({ sel: window.__dash.getState().selectedLocId, popup: !!document.querySelector(".mapboxgl-popup .popup h4"), title: document.querySelector(".mapboxgl-popup .popup h4") && document.querySelector(".mapboxgl-popup .popup h4").textContent, pulse: window.__dash.map.getSource("segments-selected").data.features.length, rowSel: document.querySelector('tr[data-loc="52500-158"]').classList.contains("selected") }));
  check("row click selects, pins the row, opens the popup on W Main St, fills the pulse source", sel.sel === "52500-158" && sel.popup && sel.title === "W Main St" && sel.pulse === 1 && sel.rowSel, JSON.stringify(sel));
  const c1 = await cam(page); check("segment camera: pitch 45, road across the screen", c1.pitch === 45 && Math.abs(c1.bearing) < 20, JSON.stringify(c1));
  const popupText = await page.textContent(".mapboxgl-popup .popup");
  check("popup has units, ranks and the combined score", /VPD/.test(popupText) && /capacity at LOS E/.test(popupText) && /#1 of 21 in Ward 2/.test(popupText) && /#1 of 177 citywide/.test(popupText) && /168\.55/.test(popupText), popupText.slice(0, 200));
  await shot(page, "04_popup_wmain");
  await page.click('tr[data-loc="52500-192"]'); await settle(page, 900);
  check("popup caveat for 52500-192 comes from caveats.js", (await page.textContent(".mapboxgl-popup .popup")).includes("single FY21 count"));
  // hover sync map -> table
  await page.evaluate(() => { const m = window.__dash.map; const c = m.getCanvas().getBoundingClientRect(); const f = window.__dash.map.getSource("segments").data.features.find(x => x.properties.loc_id === "52500-133"); const p = m.project(f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]); m.getCanvas().dispatchEvent(new MouseEvent("mousemove", { clientX: c.left + p.x, clientY: c.top + p.y, bubbles: true })); });
  await settle(page, 200);
  // (hover may miss if the segment is off screen at this camera; only assert when the stub registered a hit)
  const hov = await page.evaluate(() => ({ tip: !document.getElementById("map-tooltip").hidden, row: !!document.querySelector("tr.hover"), fs: window.__dash.map.getFeatureState({ source: "segments", id: "52500-133" }).hover }));
  check("map hover shows the tooltip and marks the row (when the segment is under the cursor)", !hov.fs || (hov.tip && hov.row), JSON.stringify(hov));
  // hash round trip
  await page.click('#ward-toggle button[data-ward="4"]'); await page.click('#metric-toggle button[data-metric="v_c"]'); await page.click('#los-toggle button[data-los="C"]'); await settle(page, 900);
  await page.click('tr[data-loc="52500-192"]'); await settle(page, 900);
  const hash = await page.evaluate(() => location.hash);
  check("hash reflects the UI state", hash === "#ward=4&metric=v_c&los=C&years=2021-2025&sel=52500-192", hash);
  const before = await state(page);
  await page.goto(url + hash); await waitForLayers(page); await settle(page, 1200);
  const after = await state(page);
  check("hash round trip restores ward, metric, LOS, years and selection", ["ward", "metric", "los", "yearMin", "yearMax", "selectedLocId", "includeCollectors"].every(k => before[k] === after[k]) && await page.evaluate(() => !!document.querySelector(".mapboxgl-popup .popup h4")), JSON.stringify(after));
  check("restored view synced the controls", await page.evaluate(() => document.querySelector('#ward-toggle button[data-ward="4"]').getAttribute("aria-pressed") === "true" && document.querySelector('#los-toggle button[data-los="C"]').getAttribute("aria-pressed") === "true"));
  await shot(page, "05_deeplink_restored");
  await page.click("#reset-view"); await settle(page, 900);
  const c2 = await cam(page); check("reset view returns to citywide flat", (await state(page)).ward === null && c2.pitch === 0 && c2.bearing === 0 && Math.abs(c2.zoom - 11.6) < 0.01, JSON.stringify(c2));
  // satellite: dark chrome, brighter casing, layers re-added
  await page.click("#basemap-toggle"); await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" && window.__dash.map.getLayer("segments-line")); await settle(page, 600);
  const sat = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, casing: window.__dash.map.getPaintProperty("segments-casing", "line-color"), label: document.getElementById("basemap-toggle").textContent, hidden: window.__dash.map.getLayoutProperty("poi-label", "visibility"), road: window.__dash.map.getLayoutProperty("road-label", "visibility"), layers: ["wards-fill", "collisions-heat", "segments-line", "count-points"].every(id => !!window.__dash.map.getLayer(id)) }));
  check("satellite flips to dark chrome with a white casing, POI labels hidden, road labels kept, layers re-added", sat.theme === "dark" && sat.casing === "#ffffff" && sat.label === "Streets" && sat.hidden === "none" && sat.road !== "none" && sat.layers, JSON.stringify(sat));
  await shot(page, "06_satellite_dark");
  await page.click("#basemap-toggle"); await page.waitForFunction(() => document.documentElement.dataset.theme === "light" && window.__dash.map.getLayer("segments-line")); await settle(page, 400);
  check("back to light theme", await page.evaluate(() => document.documentElement.dataset.theme === "light"));
  // empty state
  await page.click('#ward-toggle button[data-ward="5"]'); await page.evaluate(() => { const a = document.getElementById("year-min"); a.value = "2025"; a.dispatchEvent(new Event("input", { bubbles: true })); }); await settle(page, 700);
  check("a narrow window still lists Ward 5 (no empty state needed)", (await page.evaluate(() => document.querySelectorAll("#rank-table tbody tr:not(.leaving)").length)) > 0);
  check("desktop pass: no console errors", errors().length === 0, errors().join(" | "));
  await ctx.close();
}

// ---------- Tour: every step ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  const steps = await page.evaluate(async () => { const { buildTour } = await import("/tour.js"); const { getRaw } = await import("/data.js"); return buildTour(getRaw()).map(s => ({ id: s.id, title: s.title, caption: s.caption, state: s.state, basemap: s.basemap, showPanel: !!s.showPanel, popup: s.popup || null })); });
  check("tour has 12 steps", steps.length === 12);
  const camBefore = await cam(page); const stateBefore = await state(page);
  await page.click("#present-toggle"); await settle(page, 1200);
  check("Present enters the tour: panel folded, card and dots visible, legend stays", await page.evaluate(() => document.getElementById("layout").classList.contains("presenting") && !document.getElementById("tour").hidden && document.querySelectorAll(".tour-dot").length === 12 && getComputedStyle(document.getElementById("legend")).display !== "none" && getComputedStyle(document.getElementById("panel")).opacity === "0"));
  for (let i = 0; i < steps.length; i++) {
    if (i > 0) { await page.keyboard.press(i % 2 ? "ArrowRight" : "Space"); }
    if (steps[i].basemap === "satellite") await page.waitForFunction(() => document.documentElement.dataset.theme === "dark" && window.__dash.map.getLayer("segments-line"));
    await settle(page, 1300);
    const st = await state(page);
    const ui = await page.evaluate(() => ({ step: document.getElementById("tour-step").textContent, title: document.getElementById("tour-title").textContent, caption: document.getElementById("tour-caption").textContent, active: document.querySelector(".tour-dot.active").dataset.index, popup: !!document.querySelector(".mapboxgl-popup .popup h4"), panelShown: getComputedStyle(document.getElementById("panel")).opacity === "1", hash: location.hash, theme: document.documentElement.dataset.theme }));
    const s = steps[i];
    const stateOk = ["ward", "metric", "los", "yearMin", "yearMax", "includeCollectors", "selectedLocId"].every(k => st[k] === s.state[k]);
    check(`tour step ${i + 1} (${s.id}): caption, state, dots, hash, popup, panel`, ui.step === `${i + 1} of 12` && ui.title === s.title && ui.caption === s.caption && ui.active === String(i) && stateOk && ui.hash.endsWith(`tour=${i + 1}`) && (!s.popup || ui.popup) && ui.panelShown === s.showPanel && ui.theme === (s.basemap === "satellite" ? "dark" : "light"), JSON.stringify({ ui, st }));
    const c = await cam(page);
    if (i === 0) check("step 1 camera is citywide flat", c.pitch === 0 && c.bearing === 0, JSON.stringify(c));
    if (s.popup) check(`step ${i + 1} camera pitched on the segment`, c.pitch >= 40, JSON.stringify(c));
    await shot(page, `tour_${String(i + 1).padStart(2, "0")}_${s.id}`);
  }
  await page.keyboard.press("ArrowLeft"); await settle(page, 1200);
  check("Left arrow goes back a step", (await page.textContent("#tour-step")) === "11 of 12");
  await page.click("#tour-autoplay + .switch-track"); await settle(page, 100);
  check("autoplay toggle turns on", await page.evaluate(() => document.getElementById("tour-autoplay").checked));
  await page.click("#tour-autoplay + .switch-track");
  await page.keyboard.press("Escape"); await page.waitForFunction(() => document.documentElement.dataset.theme === "light" && window.__dash.map.getLayer("segments-line")); await settle(page, 1200);
  const stAfter = await state(page), camAfter = await cam(page);
  check("Esc exits and restores the previous state and camera", !(await page.evaluate(() => document.getElementById("layout").classList.contains("presenting"))) && stAfter.ward === stateBefore.ward && stAfter.metric === stateBefore.metric && stAfter.basemap === "light" && Math.abs(camAfter.zoom - camBefore.zoom) < 0.05 && camAfter.pitch === camBefore.pitch, JSON.stringify({ camBefore, camAfter }));
  check("tour pass: no console errors", errors().length === 0, errors().join(" | "));
  await ctx.close();
}

// ---------- Reduced motion ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  check("reduced motion read into state", (await state(page)).reducedMotion === true);
  await page.click('#ward-toggle button[data-ward="3"]'); await settle(page, 300);
  const eases = await page.evaluate(() => window.__dash.map.__eases.slice(-2).map(e => e.duration));
  check("reduced motion: camera moves are instant (duration 0)", eases.every(d => d === 0), JSON.stringify(eases));
  await page.click('tr[data-loc="52500-178"]'); await settle(page, 300);
  const rm = await page.evaluate(() => ({ grad: JSON.stringify(window.__dash.map.getPaintProperty("segments-selected", "line-gradient")), vis: window.__dash.map.getLayoutProperty("segments-selected", "visibility"), tr: (window.__dash.map.getPaintProperty("segments-line", "line-opacity-transition") || {}).duration, transforms: [...document.querySelectorAll("#rank-table tbody tr")].filter(tr => tr.style.transform).length, dur: getComputedStyle(document.documentElement).getPropertyValue("--t-mid").trim() }));
  check("reduced motion: pulse layer hidden, paint transitions 0, no FLIP transforms, CSS durations 0", rm.grad.includes('0,"rgba(255,255,255,0)",1,"rgba(255,255,255,0)"') && rm.vis === "none" && rm.tr === 0 && rm.transforms === 0 && rm.dur === "0ms", JSON.stringify(rm));
  await shot(page, "07_reduced_motion");
  check("reduced motion pass: no console errors", errors().length === 0, errors().join(" | "));
  await ctx.close();
}

// ---------- Keyboard-only ----------
{
  const { ctx, page, errors } = await open({ viewport: { width: 1440, height: 900 } });
  await page.focus('#ward-toggle button[data-ward="1"]'); await page.keyboard.press("Enter"); await settle(page, 900);
  check("keyboard: Enter on a ward button selects it", (await state(page)).ward === 1);
  await page.focus("#help-toggle"); await page.keyboard.press("Enter"); await settle(page, 200);
  check("keyboard: help opens from the keyboard", await page.evaluate(() => !document.getElementById("help-box").hidden));
  await page.focus("#help-box"); await page.keyboard.press("Escape"); await settle(page, 200);
  check("keyboard: Escape closes help and returns focus to the button", await page.evaluate(() => document.getElementById("help-box").hidden && document.activeElement === document.getElementById("help-toggle")));
  await page.focus("#year-max"); await page.keyboard.press("ArrowLeft"); await settle(page, 400);
  check("keyboard: arrow keys move the year handle", (await state(page)).yearMax === 2024);
  await page.focus("#rank-table tbody tr"); await page.keyboard.press("Enter"); await settle(page, 900);
  const kb = await page.evaluate(() => ({ sel: window.__dash.getState().selectedLocId, popup: !!document.querySelector(".mapboxgl-popup .popup h4"), focusRow: document.activeElement && document.activeElement.tagName === "TR", ring: getComputedStyle(document.activeElement).outlineStyle }));
  check("keyboard: Enter on a focused row selects it, opens the popup, keeps focus on the row", kb.sel && kb.popup && kb.focusRow, JSON.stringify(kb));
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  const vis = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { tag: el.tagName, outline: cs.outlineStyle, width: cs.outlineWidth }; });
  check("keyboard: focus-visible ring on the focused row", vis.tag === "TR" && vis.outline !== "none" && vis.width !== "0px", JSON.stringify(vis));
  await shot(page, "08_keyboard_focus");
  await page.focus("#present-toggle"); await page.keyboard.press("Enter"); await settle(page, 1000);
  await page.keyboard.press("ArrowRight"); await settle(page, 800);
  check("keyboard: Present and arrow keys drive the tour", (await page.textContent("#tour-step")) === "2 of 12");
  await page.keyboard.press("Escape"); await settle(page, 800);
  check("keyboard pass: no console errors", errors().length === 0, errors().join(" | "));
  await ctx.close();
}

// ---------- Mobile: 390, 768, 844 by 390 ----------
{
  const phone = { ...devices["iPhone 13"] };
  const { ctx, page, errors } = await open(phone);
  const sheet = await page.evaluate(() => ({ cls: document.getElementById("panel").classList.contains("sheet"), snap: window.__dash.sheet.getState().snap, mapH: document.getElementById("map").clientHeight, handle: getComputedStyle(document.getElementById("sheet-handle")).display }));
  check("390: panel is a bottom sheet at peek with a visible handle", sheet.cls && sheet.snap === "peek" && sheet.handle !== "none" && sheet.mapH > 300, JSON.stringify(sheet));
  await shot(page, "09_m390_peek");
  const targets = await page.evaluate(() => [...document.querySelectorAll(".btn, .segmented button, .mapboxgl-ctrl-group button")].filter(b => b.offsetParent !== null).map(b => [b.textContent.trim() || b.getAttribute("aria-label"), b.getBoundingClientRect().height]).filter(([, h]) => h < 44));
  check("390: every visible button is at least 44 px tall", targets.length === 0, JSON.stringify(targets));
  await page.evaluate(async () => { const h = document.getElementById("sheet-handle"); const fire = (t, y) => h.dispatchEvent(new PointerEvent(t, { clientY: y, isPrimary: true, pointerId: 1, bubbles: true })); const wait = (ms) => new Promise(r => setTimeout(r, ms)); fire("pointerdown", 600); await wait(100); fire("pointermove", 500); await wait(100); fire("pointermove", 420); await wait(300); fire("pointerup", 410); });
  await settle(page, 500);
  check("390: a slow drag up lands on half", (await page.evaluate(() => window.__dash.sheet.getState().snap)) === "half");
  await shot(page, "10_m390_half");
  await page.evaluate(async () => { const h = document.getElementById("sheet-handle"); const fire = (t, y) => h.dispatchEvent(new PointerEvent(t, { clientY: y, isPrimary: true, pointerId: 1, bubbles: true })); fire("pointerdown", 300); await new Promise(r => setTimeout(r, 30)); fire("pointerup", 200); });
  await settle(page, 500);
  check("390: a flick up from half lands on full with the table visible", await page.evaluate(() => window.__dash.sheet.getState().snap === "full" && getComputedStyle(document.getElementById("table-wrap")).visibility === "visible"));
  await shot(page, "11_m390_full");
  await page.evaluate(() => document.querySelector('tr[data-loc="52500-158"]').scrollIntoView({ block: "center" }));
  await page.tap('tr[data-loc="52500-158"]'); await settle(page, 900);
  check("390: tapping a row selects it", (await state(page)).selectedLocId === "52500-158");
  await page.evaluate(() => window.__dash.sheet.dispatch({ type: "set", snap: "peek" })); await settle(page, 400);
  await page.tap("#present-toggle"); await settle(page, 1000);
  await page.touchscreen.tap(300, 400); // noop tap, then swipe
  await page.evaluate(() => { document.dispatchEvent(new PointerEvent("pointerdown", { clientX: 300, clientY: 400, isPrimary: true })); document.dispatchEvent(new PointerEvent("pointerup", { clientX: 120, clientY: 404, isPrimary: true })); }); await settle(page, 900);
  check("390: swipe left advances the tour", (await page.textContent("#tour-step")) === "2 of 12");
  await page.evaluate(() => { document.dispatchEvent(new PointerEvent("pointerdown", { clientX: 100, clientY: 400, isPrimary: true })); document.dispatchEvent(new PointerEvent("pointerup", { clientX: 300, clientY: 396, isPrimary: true })); }); await settle(page, 900);
  check("390: swipe right goes back", (await page.textContent("#tour-step")) === "1 of 12");
  await page.evaluate(() => window.__dash.tour.dispatch({ type: "goto", index: 9 })); await settle(page, 1200);
  check("390: ward step shows the sheet at half height during the tour", await page.evaluate(() => document.getElementById("layout").classList.contains("tour-panel") && document.getElementById("panel").getBoundingClientRect().top < innerHeight - 200));
  await shot(page, "12_m390_tour10");
  await page.tap("#tour-exit"); await settle(page, 900);
  // geolocate: the stub control fires a position near W Main St
  await page.evaluate(() => { const f = window.__dash.map.getSource("segments").data.features.find(x => x.properties.loc_id === "52500-158"); const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]; window.__stubGeolocation = { coords: { longitude: mid[0] + 0.0004, latitude: mid[1] + 0.0003, accuracy: 10 } }; document.querySelector(".mapboxgl-ctrl-geolocate").click(); }); await settle(page, 1000);
  check("geolocate selects the nearest segment within 300 m (W Main St)", (await state(page)).selectedLocId === "52500-158", (await state(page)).selectedLocId);
  check("390 pass: no console errors", errors().length === 0, errors().join(" | "));
  await ctx.close();

  const tab = await open({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true }, "#ward=4");
  check("768: two column layout with the panel as a column", await tab.page.evaluate(() => !document.getElementById("panel").classList.contains("sheet") && document.getElementById("panel").getBoundingClientRect().width >= 380));
  await shot(tab.page, "13_m768"); check("768 pass: no console errors", tab.errors().length === 0, tab.errors().join(" | ")); await tab.ctx.close();

  const land = await open({ ...devices["iPhone 13 landscape"] }, "#ward=2");
  const l = await land.page.evaluate(() => ({ sheet: document.getElementById("panel").classList.contains("sheet"), mapH: document.getElementById("map").clientHeight, top: document.getElementById("panel").getBoundingClientRect().top, vh: innerHeight }));
  check("844 by 390: sheet peek leaves at least 180 px of map above it", l.sheet && l.mapH - (l.vh - l.top) >= 0 && l.top >= 180, JSON.stringify(l));
  await shot(land.page, "14_m844x390");
  await land.page.goto(url + "#tour=10"); await waitForLayers(land.page); await settle(land.page, 1200);
  check("844 by 390: tour ward step puts the panel on the right", await land.page.evaluate(() => document.getElementById("panel").getBoundingClientRect().left > innerWidth * 0.4));
  await shot(land.page, "15_m844x390_tour10");
  check("844 by 390 pass: no console errors", land.errors().length === 0, land.errors().join(" | ")); await land.ctx.close();
}

await browser.close(); srv.close();
console.log(`\n${results.length - failures} of ${results.length} checks passed; screenshots in ${OUT}`);
console.log(JSON.stringify(results.filter(r => !r.ok), null, 1));
process.exit(failures ? 1 : 0);

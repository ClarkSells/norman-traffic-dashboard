// Mobile looks: node tests/e2e/mobile_peek.mjs
import { createRequire } from "node:module";
const { chromium, devices } = createRequire(import.meta.url)("/opt/node-tools/node_modules/playwright");
import { mkdirSync } from "node:fs";
import { SCRATCH, serve, stubMapbox, waitForLayers, watchConsole } from "./harness.js";
mkdirSync(SCRATCH, { recursive: true });
const { srv, url } = await serve(8769);
const browser = await chromium.launch();
const shots = [];
async function shot(name, ctxOpts, hash = "", after = null) {
  const ctx = await browser.newContext(ctxOpts); const page = await ctx.newPage(); await stubMapbox(page); const errors = watchConsole(page);
  await page.goto(url + hash); await waitForLayers(page); if (after) await after(page); await page.waitForTimeout(700);
  const out = `${SCRATCH}/${name}.png`; await page.screenshot({ path: out }); shots.push([name, errors.filter(e => !e.includes("ERR_CERT"))]); await ctx.close();
}
const phone = { ...devices["iPhone 13"] };                       // 390 x 844, touch, coarse pointer
const landscape = { ...devices["iPhone 13 landscape"] };          // 844 x 390
const tablet = { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true };
await shot("m390_peek", phone);
await shot("m390_half", phone, "#ward=2", async (p) => { await p.evaluate(async () => { const h = document.getElementById("sheet-handle"); const fire = (t, y) => h.dispatchEvent(new PointerEvent(t, { clientY: y, isPrimary: true, pointerId: 1, bubbles: true })); const wait = (ms) => new Promise(r => setTimeout(r, ms)); fire("pointerdown", 800); await wait(120); fire("pointermove", 700); await wait(120); fire("pointermove", 620); await wait(300); fire("pointerup", 600); }); });
await shot("m390_tour10", phone, "#tour=10");
await shot("m390_full", phone, "#ward=2", async (p) => { await p.evaluate(() => { const h = document.getElementById("sheet-handle"); h.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); h.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); }); });
await shot("m390_tour5", phone, "#tour=5");
await shot("m768", tablet, "#ward=4");
await shot("m844x390_landscape", landscape, "#ward=2");
await shot("m844x390_tour10", landscape, "#tour=10");
console.log(JSON.stringify(shots));
await browser.close(); srv.close();

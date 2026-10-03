// Runs every *.test.js in this folder in its own node process and reports a count.
// From the repo root: node dashboard/tests/run_all.js   (or: npm test inside dashboard/)
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(f => f.endsWith(".test.js")).sort();
let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [join(here, f)], { encoding: "utf8" });
  const ok = r.status === 0;
  if (!ok) failed++;
  process.stdout.write(`${ok ? "PASS" : "FAIL"}  ${f}\n${(r.stdout || "").trim().split("\n").map(l => `      ${l}`).join("\n")}\n`);
  if (!ok) process.stdout.write((r.stderr || "").split("\n").slice(0, 25).map(l => `      ${l}`).join("\n") + "\n");
}
console.log(`\n${files.length - failed} of ${files.length} dashboard test files passed`);
process.exit(failed ? 1 : 0);

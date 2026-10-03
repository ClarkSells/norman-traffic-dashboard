# Norman traffic dashboard: rules for every agent working in this repo

You are one of many agents polishing this dashboard in parallel. You see only your own task card. These rules keep the swarm from colliding.

## Ownership
- Create or modify ONLY the files your task card lists under **Files**. Nothing else, not even a one line fix elsewhere. If another file is wrong, say so in your report; the lead fixes it between waves.
- Never run `git`. The lead commits once per wave.
- Never edit `index.html`, `app.js`, `config.js`, `tokens.css`, `CONTRACTS.md`, `AGENTS.md`, or `tests/e2e/mapbox_stub.js` unless your card is a lead card. If you need a DOM id, a config value, or a stub method that does not exist, build against the contract and report the gap.
- The pipeline that produces `data/*.geojson` lives in another repository. Never hand edit data files; `scripts/slim-data.mjs` is the only script that rewrites one.

## How to work
1. Read `CONTRACTS.md` first. Exports, state keys, layer ids, DOM ids and file formats there are the law; neighboring cards are built against them.
2. Read the skills your card names (folders under `handoff/skills/`). They are not optional background; they carry the patterns the lead will check for.
3. TDD on the stub: write the test from your card, run `node tests/<name>.test.js`, watch it fail, implement, watch it pass. Tests use `tests/fake_dom.js` and recording map doubles; never require a browser.
4. ES modules, no bundler, no build step, no new npm dependencies. Mapbox GL JS v3 from the CDN.
5. Every animation is driven by the injectable `tween` in `motion.js` or injectable timers (`now`, `raf`, `caf`, `setTimeout`), checks `state.reducedMotion`, and returns a cancel function. Nothing loops forever: flow and orbit stop on cancel, on `document.hidden`, and on exit.
6. Captions and stat values quote `facts.js` or come from `data.js` functions. Never compute a headline number a second way.
7. Design decisions are in `handoff/02_DESIGN_DIRECTION.md`. Implement them. If one is impossible in Mapbox GL JS v3.6, report the constraint and the nearest equivalent; do not pick a different direction.
8. Windows is the target machine: forward slashes in paths, UTF-8, no shell specific commands in scripts.

## Report format (your final message to the lead)
```
TASK: <id and name>
FILES: <created/modified>
SKILLS READ: <paths>
ACCEPTANCE: <command>  -> PASS | FAIL
OUTPUT: <last 10 lines>
NOTES: <contract gaps, DOM ids needed, design constraints hit, anything the lead must wire in Wave 2>
```

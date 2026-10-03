# Presentation polish handoff

Prepared 2026-10-03 by Claude (project director) for Clark Hobbs and the Kimi Code swarm.

## What this is

A complete package for taking the Norman Street Segment Priorities dashboard to a consulting grade, presentation ready build. Everything the swarm needs is in this folder and in `.kimi-code/agents/`.

| File | Purpose |
|---|---|
| `01_AUDIT.md` | What a first time viewer runs into today, severity ranked, with root causes from the source and screenshots in `audit-evidence/` |
| `02_DESIGN_DIRECTION.md` | The settled decisions: Mapbox Standard with 3D buildings, type and tokens, explore panel layout, presentation chrome, camera language, traffic flow animation, the 14 scene storyboard, performance budget |
| `03_PLAN.md` | The swarm plan: waves, exclusive file ownership, module contracts, 24 task cards with acceptance commands, a real renderer QA gate |
| `04_KIMI_LEAD_PROMPT.md` | The prompt to paste into `kimi`, the sub-agent template, settings, and what to do when the swarm stalls |
| `AGENTS.dashboard.md` | Rules for every agent (Card 0.1 copies it to `AGENTS.md`) |
| `skills/` | 34 skills cloned for the run plus the Mapbox GL JS v3 cheatsheet and the Mapbox storytelling template; `skills/INDEX.md` says who reads what |
| `audit-evidence/` | 15 screenshots from the audit walkthrough |
| `../.kimi-code/agents/` | `builder`, `designer`, `qa-visual`, `reviewer` agent definitions Kimi picks up automatically |

## The decision: Kimi Swarm builds, Claude reviews

Kimi Code is the right executor for this run and the plan is shaped for it. The work is 14 independent modules behind written contracts, each with a unit test that runs on a stub, plus a QA wave of seven parallel read only reviews. That is exactly the shape where many sub-agents at once beat one strong agent, and the file ownership rules keep them from colliding. The two things Kimi lacked, map specific know how and a design bar, are now in the folder: the official Mapbox skills and the design and motion skills are cloned, and every card names the ones its agent must read before writing code.

Two guardrails because sub-agents cannot see pixels:

1. The visual gate is real. Card 0.4 builds `tests/e2e/real.mjs`, which loads the real Mapbox renderer on your machine, screenshots every scene at three viewports, and records frame times. The old harness stubs Mapbox, which is why the blank map on Present was never caught. The lead looks at every screenshot before a wave closes and the Wave 3 QA agents work from those images.
2. Claude takes the final design pass. After Wave 4, start a Claude Code cloud session on `polish/presentation`, point it at `handoff/02_DESIGN_DIRECTION.md` and `qa/real/`, and let it do what it did for this audit: walk the live build as a person and file the last fit and finish items. Kimi builds in parallel; Claude judges the frame.

If you would rather have one agent own the whole thing end to end (for example if the swarm keeps stalling on the integration seams), the same plan runs under Claude Code with `superpowers:subagent-driven-development`; the cards do not change.

## How to start

1. In the repo root: `git pull`, then `npm i -D playwright && npx playwright install chromium`.
2. Confirm the Mapbox public token's URL restrictions include `https://clarksells.github.io/*` and `http://localhost:*`.
3. Put the settings from `04_KIMI_LEAD_PROMPT.md` in `~/.kimi-code/config.toml`.
4. Open `kimi` in the repo root and paste the lead prompt. It creates the branch `polish/presentation` and runs Wave 0.
5. It stops after Wave 2 for your walkthrough and after Wave 4 for the merge.

## Scope guard

This pass is the dashboard only. The pipeline, workbook, report and slides are untouched. One follow up is filed for the pipeline: the slim collisions schema (`03_PLAN.md` C.12) should move into `src/outputs/geojson_out.py` in `norman-traffic-case` so the next data run writes the small file directly. Until then `scripts/slim-data.mjs` rewrites `data/collisions.geojson` after you copy a fresh one in.

Note on the two repositories: `norman-traffic-case/dashboard/` is a stale copy from before the tour and motion work. This repository is the dashboard's source of truth and the one GitHub Pages deploys. Do not run the swarm against the copy in the case repo.

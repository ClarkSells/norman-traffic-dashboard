# Wave 2 summary — integration (card 2.1)

Date: 2026-10-04. Branch: polish/presentation. Commit: "wave 2: integration — present mode end to end on the real renderer".

## Cards

- Passed: 0.1–0.4 (Wave 0), 1.1–1.14 (Wave 1), 2.1 integration.
- Re-runs: 1.8 was re-dispatched once in Wave 1 (zoom-curve invariant). Wave 2 itself re-ran the real renderer pass four times while closing integration bugs found in the screenshots; each fix is in qa/decisions.md (theme inline-vars, establish camera, emissive layers, callout ranks, mobile grid column, body scroll, idle hangs, style-load races).

## Gate numbers

- `npm test`: 30 of 30 files green.
- `node tests/e2e/verify.mjs` (stub, 5 contexts): 103 of 103 checks green.
- `node tests/e2e/real.mjs` (real Mapbox, 3 viewports × 15 scenes + 4 explore states): completed; console errors 0 (1440x900), 0 (1920x1080), 1 (390x844, a mid-swap paint call — guards added after the run; Wave 4 re-verifies). First idle: 4.1 s / 9.2 s / 4.2 s through the referer relay (token still localhost-blocked; direct will be faster).
- Data: collisions.geojson 1,206,286 bytes raw / 62,757 gz (budget 1.6 MB / 400 KB).

## Three frames, judged

1. `qa/real/1440x900/scene-13.png` (satellite lane story) — ship it. Aerial at pitch 62, W Main St glowing with flow dashes, "6 lanes · 31,886 VPD" callout; the frame a consulting firm puts in the deck.
2. `qa/real/1440x900/scene-07.png` (#2 citywide, 12th Ave SE) — ship it. Road runs across the screen at pitch 58, correct "#2" callout, crash dots dropped in along the segment, dark stat card with VPD/lanes/v/c/crashes/score.
3. `qa/real/1920x1080/scene-11.png` (ward 2 stage) — ship it with a note. The ward mask and day preset read exactly like a zoning map and the five list cards are clean; the ward could sit slightly larger in frame (fitWard keeps the exact flat fit) — left for the Wave 3 QA agents to judge.

## Known open items for Wave 3/4

- Mobile run had 1 residual "Style is not done loading" (pulse/reveal tweens firing mid-swap; guards added post-run, needs the Wave 4 re-render to confirm zero).
- Scene 13→14 basemap swap is slow through the referer relay (~20 s; bounded now, completes). Re-time after Clark allows localhost on the token.
- Frame-time maxima in report.json are paint gaps during style swaps (rAF starvation), per the 0.4 builder's note; 3.4 owns the budget analysis.
- Token URL restriction still missing http://localhost:* (Clark, account.mapbox.com).

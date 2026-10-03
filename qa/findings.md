# Wave 3 findings — merged, severity sorted

Merged by the lead from `qa/findings/3.1.md` … `3.7.md` (full detail, pixel measurements, contrast math and pass lists live in those files). Run under review: `qa/real/` 2026-10-03/04, 15 scenes × 3 viewports + 4 explore states, real Mapbox renderer.

Totals: **1 P0, 21 P1, 28 P2 = 50 findings.**

Lead spot check (own eyes on scene-00, scene-07, scene-11 at 1440x900): scene-00 confirms the metro-wide establish and ward labels on the title frame; scene-11 confirms the missing ward-mask dimming and the unreadable day-scene eyebrow. On scene-07 the named segment IS in frame as a diagonal at the top-right (the 3.1 pixel report understated it), but it is clipped by the top edge and the callout sits far from most of the road — the framing defect is real, the "effectively out of frame" wording applies to scene-09; severity kept as filed with this note.

Environment caveat (from 3.4): all tile traffic went through the Node referer relay (token is localhost-blocked), so every frame-time and load-time number is inflated. Only 3.4-01 is confirmed product. Frame/load/flow/memory budgets need one direct-connection or instrumented verification run in Wave 4 before they can be graded.

## P0 — broken or misleading

| id | where | what | owner |
|---|---|---|---|
| 3.1-01 | scene-07, scene-09 (all viewports; mirrored at 1920 per 3.2-04, sheet-crowding at 390) | Dolly scenes mis-frame the named segment: scene-09's Flood Ave is clipped at the frame edge with the stage empty; scene-07's 12th Ave SE enters at the top edge and exits the right, callout far from most of the road. Consistent offset direction across all five segment scenes — check the sign of the padding/offset math in `camera.js`. Councilmember hears "#2 citywide" and the map doesn't show the road. | 1.5 (`camera.js` dollyToSegment / presentationPadding) |

## P1 — off the design bar or likely bugs

| id | where | what | owner |
|---|---|---|---|
| 3.1-02 | scenes 6, 8, 10, 13 | Same dolly mis-framing, milder: subjects pushed to top/left edges, scene-08 zoom reads tighter than the §6 table | 1.5 |
| 3.1-03 | scene-06 | No "#1 W Main St" callout adjacent to the #1 segment (likely lost collision to basemap label; may resolve with the 1.5 fix — re-verify) | 1.9 |
| 3.1-04 | scene-11, scene-12 | Ward mask produces no visible stage dimming — outside-ward areas at full day brightness (measured ~235 lum vs expected ~135); lead-confirmed | 1.9 (`layers/segments.js` ward mask) |
| 3.2-01 | scene-00, both wide viewports | Title frame missing the "Prepared for the City of Norman…" eyebrow and "Press space or Next" hint — strings exist nowhere in the code | 1.3 + 1.4 |
| 3.2-02 | scenes 11-12, all viewports | Eyebrow/scene-count unreadable on day-preset scenes (near-white text, no top scrim, no inversion rule exists); lead-confirmed. Pixel-confirms 3.7-14 | 1.3 (`present.css` top scrim / adaptive chrome) |
| 3.2-03 | scenes 0-5, 14 at 1920 and 390 | Establish framing shows the whole OKC metro (~80 km); Norman's data in the central half, dead rural quadrant. Same camera.js root as 3.5-3; lead-confirmed at 1440 too | 1.5 (`camera.js` establish) |
| 3.2-04 | scene-09, scene-07 at 1920/390 | Dolly defect persists at other viewports with mirrored geometry — one 1.5 fix must be re-verified at all three viewports | 1.5 |
| 3.3-01 | explore, all four 1440 states | Stats line clips with ellipsis right after "top:" — the top street name never shows (~380 px string vs 360 px width) | 1.6 |
| 3.3-02 | explore 1440 | Panel budget blown: controls ~195 px vs 112 px (third "More/Settings" row), ranked table 45% vs 55% floor — audit C1 only half fixed | 1.6 |
| 3.4-01 | 390x844 run | `Style is not done loading` pageerror — style mutation mid-swap; guards added post-run, Wave 4 re-render must confirm zero | 1.2 + 2.1 |
| 3.5-1 | ui/present.js:42-45, ui/tour.js:14,31 | Autoplay switch desyncs from player state (A key / reducer auto-off never update checkbox or aria-checked). Same issue as 3.7-05; needs C.9 `setAutoplay(bool)` addition (lead owns wording) | 1.3 + 1.14 + lead |
| 3.5-2 | scenes.js:29-30 | Scene 2 "highest v/c" caption recomputes max instead of quoting `FACTS.v_c_max`; test encodes the same recomputation (tests/scenes.test.js:34) | 1.4 |
| 3.6-01 | layers/segments.js:242 | `pulse()` reads `map.getSource("segments").data` — real GL JS v3.6.0 has no public `.data` (verified in CDN bundle), so the scene pulse is a silent no-op on the real renderer; stub masks it | 1.9 |
| 3.6-02 | layers/segments.js:115,211 | Selection frame (halo, gap ring, travelling pulse) lost after any basemap switch — `selected` not reset in `addSegmentsLayer` | 1.9 |
| 3.7-01 | style.css:215 | Present mode hides the explore panel with opacity only — dozens of invisible controls stay in the tab order | 2.1 + 1.6 |
| 3.7-02 | ui/tour.js:137-143 | Document keydown hijacks Space/Enter on focused present buttons (Space on "Back" goes forward; button activation preventDefault-ed) | 1.14 |
| 3.7-03 | ui/present.js:193-197 | Progress tablist has roving tabindex but no arrow navigation — 14 of 15 scene tabs unreachable by keyboard | 1.3 + 1.14 |
| 3.7-04 | ui/present.js:49-65 | Auto-hidden controls get `aria-hidden="true"` while still focusable; keyboard wake listener only on `#present` | 1.3 |
| 3.7-06 | app.js:165,222,292 | Basemap crossfade is the one animation that never checks `state.reducedMotion` — pass `fadeMs: 0` at the three call sites | 2.1 |
| 3.7-07 | style.css:209, ui/popup.js:16 | Popup "Open aerial view" link 3.79:1 on light theme < AA 4.5:1 (math in 3.7 appendix; suggested `--link` #b44e0d) | 2.1 |

## P2 — polish and maintainability

| id | where | what | owner |
|---|---|---|---|
| 3.1-05 | scenes 7, 8 | N-S segments render vertically, not "across the screen" — bearing intent needs segment bearing − 90° | 1.5 |
| 3.1-06 | scene-11 | Top-five list card 64 vh tall, crowds the ward | 1.3 |
| 3.1-07 | scenes 0, 14 | Title/closing cards centered, not §5 bottom-left — deliberate-looking; lead ratifies (looks good, ratified) | 1.3 |
| 3.2-05 | scene-05 at 1920 | Only 2 of 5 top-five callouts discernible (collision-culled at wide framing); likely resolves with 1.5 fix | 1.9 |
| 3.2-06 | scenes 0, 1, 14 | Crash dots and ward labels render on bookend/city scenes beyond the §10 layer lists (`dots` defaults to "all") | 1.4 / 2.1 |
| 3.2-07 | scene-11 at 390 | Sheet shows ~2 of 5 list cards with no scroll affordance | 1.3 |
| 3.3-03 | explore 1440 | "More" label + separate "Settings" button as a third control row — developer chrome, causes 3.3-02 | 1.6 |
| 3.3-04 | explore 1440 | Present button renders unfilled — not the single filled primary per §4/C11 | 1.6 |
| 3.3-05 | explore 1440 | Mixed 2-line/3-line row heights from tag chips | 1.6 |
| 3.3-06 | explore 390 | Mobile top bar keeps full wrapping title + 3 buttons (audit C12 short-title fix not applied) | 1.6 |
| 3.3-07 | explore 390 | Legend pill moved top-left on mobile — undocumented deviation from bottom-right spec; ratify or move | 2.1 + 1.6 |
| 3.3-08 | explore 390 | Sheet drag handle ~4% tonal step — nearly invisible affordance | 1.6 |
| 3.4-02 | all scene transitions, desktop | Frame budgets missed across the board but relay-inflated — unverifiable until a direct-connection/instrumented run; mobile scenes 3/4/12 prove the harness can register 16.7 ms medians | 2.1 (verification run) + 1.5 + 1.7 |
| 3.4-03 | scene 6 swap | ~1.6-2.2 s max frame during satellite setStyle — documented relay artifact; confirm the 1.2 snapshot crossfade fully covers slow-network swaps | 1.2 |
| 3.4-04 | load metrics | No "first paint with segments" or "heat visible" markers — load budgets ungradable; instrument real.mjs + loading.js stages | 2.1 + 1.12 |
| 3.4-05 | flow animation | Per-update cost unmeasured (budget < 4 ms); instrument p50/p95 before the verification run | 1.7 |
| 3.4-06 | memory | Not measured at all — manual three-loop heap check recommended | 2.1 + 1.14 |
| 3.5-3 | camera.js:58-70 | establish/fitWard use cameraForBounds + off-contract zoomBias instead of fitBounds — deliberate deviation, lead blesses (blessed: pitched fitBounds framed the metro; but 3.2-03 says the bias must shrink) | 1.5 |
| 3.5-4 | scenes.js:78,116 | Hardcoded autoplayMs duplicating SCENE_TIMING tokens | 1.4 |
| 3.5-5 | app.js:350-356 | No hashchange exit path — removing `tour` from the URL while presenting doesn't exit | 2.1 |
| 3.5-6 | camera.js:109-127 | Orbit has no document.hidden hook — jumps to end bearing on tab return | 1.5 |
| 3.6-03 | layers/basemap.js:104-105 | switchBasemap: 5 s fallback timer never cleared; promise never settles if setStyle throws | 1.2 |
| 3.6-04 | ui/layout.js:38-41 | Unfiltered bubbling transitionend schedules extra map resizes | 1.1 |
| 3.6-05 | scripts/slim-data.mjs:80-96 | buildMeta Infinity years on empty input; double JSON parse | 0.3 |
| 3.7-05 | — | Same as 3.5-1 (aria-checked stale) — tracked there | 1.3 + 1.14 |
| 3.7-08 | style.css:118 | `.help-figure` 3.79:1 at 22 px/500 — fails 4.5:1 marginally | 1.6 |
| 3.7-09 | ui/panel.js:238,251 | `aria-selected` on role=button rows; table semantics stripped | 1.6 |
| 3.7-10 | ui/help.js:45-59 | Help overlay: no focus containment, Escape only on `#help-box` | 1.6 |
| 3.7-11 | app.js:253-299 | No focus management across the present boundary | 2.1 |
| 3.7-12 | index.html:27 | `#present-toggle` aria-pressed never updated — remove it | 2.1 |
| 3.7-13 | index.html:112,123 | Live region has no accessible name; scene count outside the live region | 1.3 + 2.1 |
| 3.7-14 | present.css:17-38 | Token-level flag of day-scene eyebrow legibility — confirmed in pixels as 3.2-02; tracked there | 1.3 |

## Wave 4 dispatch themes

1. **Camera framing cluster** (P0 3.1-01, 3.1-02, 3.1-05, 3.2-03, 3.2-04, 3.5-3, re-check 3.1-03/3.2-05 after): one fix in `camera.js` (dolly offset sign, establish zoom bias, across-screen bearing), re-verified at all three viewports on the real renderer. Owner 1.5.
2. **Autoplay seam** (3.5-1 = 3.7-05): lead adds `setAutoplay(bool)` to CONTRACTS C.9, then 1.3 + 1.14 implement.
3. **Segments layer state bugs** (3.6-01, 3.6-02, 3.1-04): cache the FeatureCollection instead of reading `.data`; reset `selected` on re-add; fix the ward mask fill. Owner 1.9. Verify the pulse on the real renderer — the stub cannot catch this class.
4. **Keyboard/a11y** (3.7-01…04, 3.7-06…13): inert panel in present, button-activation guard in tour keydown, tablist arrows, controls hiding, reduced-motion crossfade, popup link token. Owners 1.3, 1.14, 1.6, 2.1.
5. **Panel/explore fit and finish** (3.3-01…08, 3.7-08): owner 1.6 — one re-dispatch covering the whole control stack.
6. **Title frame and storyboard layer discipline** (3.2-01, 3.2-06, 3.5-2, 3.5-4): owner 1.4 (+1.3 for the title card layout).
7. **Verification run** (3.4-01 confirm, 3.4-02…06): instrument real.mjs (first-paint-with-segments, heat-visible, flow update cost, heap), then one run after Clark allows `http://localhost:*` on the Mapbox token. Lead owns.

# Skills catalog for the presentation polish run

How these were chosen: Skill Scout on 2026-10-03. Local marketplace skills were searched by name and description for map, motion, design, QA, accessibility and presentation; GitHub and the web were searched for Mapbox specific skills. The official `mapbox/mapbox-agent-skills` repository (MIT, Mapbox Inc.) was the only maintained external source worth adopting; its seven web relevant skills were vetted (frontmatter read, no shell commands beyond ordinary `npm install` lines in docs, no credential handling, no network calls) and copied with their `references/` folders. The `mapbox/storytelling` template (BSD 3 Clause) is included as a reference implementation of chapter driven camera work, not as a skill. Everything else came from the installed ECC, superpowers and Anthropic skill sets.

Each skill is a folder with a `SKILL.md`. Read the `SKILL.md` first; follow its pointers into `references/` only for the sections that match your card.

## Mapbox (official, `mapbox/`)

| Skill | Read it when | Cards |
|---|---|---|
| `mapbox-web-integration-patterns` | map lifecycle, resize, token handling, vanilla JS setup | 1.1, 1.10, lead |
| `mapbox-style-patterns` | layer recipes, symbol layers, data visualization scenarios | 1.2, 1.9 |
| `mapbox-data-visualization-patterns` | heat maps, data driven styling, animated data, 3D | 1.7, 1.8 |
| `mapbox-web-performance-patterns` | initialization waterfall, render cost, GeoJSON size, memory | 0.3, 0.4, 1.7, 3.4, lead |
| `mapbox-cartography` | visual hierarchy, color, label placement, when the basemap should recede | 1.2, 1.9, 3.1, 3.2 |
| `mapbox-style-quality` | validating styles, accessibility of map colors, pre production checklist | 3.3 |
| `mapbox-token-security` | URL restrictions and rotation for the public token | Clark, lead |

## Project reference (`reference/`)

| Item | What it is |
|---|---|
| `mapbox-gl-v3-cheatsheet.md` | The v3 API surface this project uses: Standard style config, slots, camera options, style crossfade, ant path flow animation, heatmap and symbol notes, with VERIFY markers and doc URLs |
| `mapbox-storytelling/` | Mapbox's chapter driven story template: `config.js` is the chapter schema (camera per chapter, layer opacity on enter and exit), `index.html` is the player. Our `scenes.js` is the same idea with a stricter contract |

## Design and motion (`ecc/`, `anthropic/`)

| Skill | Read it when | Cards |
|---|---|---|
| `anthropic/frontend-design` | before any UI work: aesthetic direction, typography, avoiding templated defaults | 1.3, 1.6, lead |
| `ecc/frontend-design-direction` | setting a visual direction and keeping it consistent across screens | 1.3, lead |
| `ecc/taste` | the rubric for "would a firm ship this frame" | 3.1, 3.2, 3.3, lead |
| `ecc/design-system` | tokens, spacing scale, component consistency | 1.6 |
| `ecc/make-interfaces-feel-better` | micro interactions, hover, focus, affordance | 1.6, 1.10 |
| `ecc/motion-foundations` | durations, easings, reduced motion, when motion carries information | 1.5, 1.8, 3.1 |
| `ecc/motion-patterns` | crossfades, staggers, progress indicators | 1.3, 1.14 |
| `ecc/motion-ui` | UI level motion for cards, sheets, overlays | 1.3 |
| `ecc/motion-advanced` | choreography across multiple elements (read if a sequence has more than three moves) | 1.3, lead |
| `ecc/frontend-slides` | narrative beats and presentation pacing | 1.3, 1.4 |
| `ecc/frontend-patterns` | component structure, event handling, pointer events | 1.1, 1.11 |
| `anthropic/cre-visualizer-builder` | interactive map visualizer conventions from Clark's other builds | optional, lead |
| `anthropic/geolibre-embed-app` | MapLibre embed patterns; useful contrast for API parity questions | optional |

## Quality (`ecc/`)

| Skill | Read it when | Cards |
|---|---|---|
| `ecc/browser-qa` | driving a real browser for QA, what to screenshot, how to report | 0.4, 3.1 to 3.3 |
| `ecc/e2e-testing` | Playwright structure, waits, flake avoidance | 0.4 |
| `ecc/click-path-audit` | walking an interface as a user and logging friction | 3.1, 3.2 |
| `ecc/production-audit` | pre release checklist for a public site | 3.3 |
| `ecc/accessibility` | WCAG 2.2 AA, roles, names, contrast, keyboard | 1.3, 1.6, 1.11, 3.7 |
| `ecc/frontend-a11y` | front end specific a11y patterns (focus management, live regions) | 1.6, 3.7 |
| `ecc/verification-loop` | verify before claiming done | reviewers |

## Process (`superpowers/`)

| Skill | Read it when |
|---|---|
| `writing-plans` | the lead, before Wave 0, to understand how the cards are shaped |
| `subagent-driven-development` | the lead, dispatch and report loop |
| `dispatching-parallel-agents` | the lead, Wave 1 and Wave 3 |
| `executing-plans` | the lead, how to run a plan without drifting |
| `verification-before-completion` | reviewers and the lead at every gate |
| `systematic-debugging` | any agent whose acceptance fails twice |
| `test-driven-development` | every builder and designer |

## Not included on purpose

- `dataviz` (Anthropic): its validated palettes are already in `config.js`; nothing else in it applies to a map.
- ECC framework skills (React, Vue, Next): this is vanilla ES modules.
- Mapbox mobile, MCP, search, navigation and store locator skills: out of scope.

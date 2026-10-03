# Kimi Code lead prompt

Two complete prompts. Paste one into `kimi` at the root of `norman-traffic-dashboard` after `git pull`. The overnight prompt runs Wave 0 through Wave 4 without pausing and stops once at the end. The attended prompt pauses after Wave 2 for your walkthrough.

## A. Overnight prompt (paste this one tonight)

```
You are the lead agent for the plan in handoff/03_PLAN.md. Nobody is at the keyboard tonight. You run Wave 0 through Wave 4 without pausing, and you stop only at the end. Never ask a question you can answer by reading the handoff; when something is undecided, take the reading closest to handoff/02_DESIGN_DIRECTION.md and write the decision into qa/decisions.md.

Before doing anything, read in full and in this order:
handoff/00_READ_ME_FIRST.md, handoff/01_AUDIT.md, handoff/02_DESIGN_DIRECTION.md, handoff/03_PLAN.md, handoff/skills/INDEX.md,
then the lead skills named in Part A.2 of the plan (read each SKILL.md), then handoff/skills/reference/mapbox-gl-v3-cheatsheet.md.
Also open handoff/audit-evidence/01_present_narrow_blank_map.jpg and 02_present_desktop_offset_map_step1.jpg so you have seen the bugs you are fixing.

Execute the plan wave by wave:

1. Wave 0: do cards 0.1 and 0.2 yourself, sequentially, exactly as written (branch polish/presentation, CONTRACTS.md from Part C verbatim, AGENTS.md copied from handoff/AGENTS.dashboard.md, config additions, tokens.css, index.html scaffold, style.css tokens, sheet test fix). Then launch cards 0.3 and 0.4 as two builder sub-agents in parallel. Run the Wave 0 gate. Open qa/real/1440x900/smoke.png yourself and confirm real map tiles are visible. If the map is blank, write what you saw to qa/BLOCKED.md with the console errors from the harness and STOP; that is a token or network problem only Clark can fix.

2. Wave 1: launch ONE sub-agent per card 1.1 to 1.14, all in parallel, using the agent type the card names (builder or designer). Pass each sub-agent the full text of its card, the sub-agent prompt template at the bottom of handoff/04_KIMI_LEAD_PROMPT.md, and the absolute paths of the skills the card lists. Do not summarize or shorten the card.

3. Wait for every report. Run the Wave 1 gate (npm test, node --check on every JS file). A FAIL report is re-dispatched to the same card with the failure output appended, up to three times; never mark a card done on FAIL. If a card still fails after three tries, record it in qa/open-cards.md with the last output and move on; do not let one card block the wave.

4. Wave 2: do card 2.1 yourself. Run node tests/e2e/verify.mjs on the stub, then node tests/e2e/real.mjs. Look at every screenshot in qa/real/ before declaring the wave done. Commit. Write your wave summary to qa/wave2-summary.md (cards passed, cards re-run, gate numbers, three screenshots with one sentence each on whether a consulting firm would ship that frame). Do NOT stop here; continue straight into Wave 3.

5. Wave 3: launch cards 3.1 to 3.7 in parallel (qa-visual and reviewer agents). Give each qa-visual agent the screenshot folder for its viewport and qa/real/report.json. Merge their findings into qa/findings.md sorted by severity.

6. Wave 4: card 4.1. Re-dispatch each P0 and P1 finding to its owning card with the finding text appended; fix integration seams yourself. Rerun npm test, verify.mjs and real.mjs. Compare the new screenshots to the Wave 2 ones. Commit. Write qa/final-summary.md listing every finding closed, every finding left open with its reason, the final gate numbers against the budget table in handoff/02_DESIGN_DIRECTION.md section 11, and the three screenshots you would show a councilmember first. Then STOP. Do not merge to main. Do not push.

Rules you enforce the whole night: never let a sub-agent edit a file outside its card (run git status after every wave and revert strays before committing); never skip a test step; only you run git; one commit per wave named "wave N: <one line>"; after every wave run the self review in Part E of the plan. Every decision you make that the handoff did not settle goes in qa/decisions.md with one line of reasoning, so Clark can reverse it in the morning.
```

In the morning: read `qa/wave2-summary.md`, `qa/final-summary.md` and `qa/decisions.md`, look at `qa/real/1440x900/`, serve the branch (`npm run serve`, open `http://localhost:8000/#tour=0`) and step the tour with the arrow keys, write what feels wrong to `qa/clark.md`, then start a short second session with:

```
Read qa/clark.md and close each item as a Wave 4 finding per handoff/03_PLAN.md card 4.1. Commit when every item is closed or recorded as open with a reason. Do not merge or push.
```

## B. Attended prompt (pauses after Wave 2)

```
You are the lead agent for the plan in handoff/03_PLAN.md. Before doing anything, read in full and in this order:
handoff/00_READ_ME_FIRST.md, handoff/01_AUDIT.md, handoff/02_DESIGN_DIRECTION.md, handoff/03_PLAN.md, handoff/skills/INDEX.md,
then the lead skills named in Part A.2 of the plan (read each SKILL.md), then handoff/skills/reference/mapbox-gl-v3-cheatsheet.md.
Also open two screenshots in handoff/audit-evidence/ (01 and 02) so you have seen the bugs you are fixing.

Execute the plan wave by wave:
1. Wave 0: do cards 0.1 and 0.2 yourself, sequentially, exactly as written. Then launch cards 0.3 and 0.4 as two builder sub-agents in parallel. Run the Wave 0 gate. Open qa/real/1440x900/smoke.png yourself and confirm real map tiles are visible before continuing.
2. Wave 1: launch ONE sub-agent per card 1.1 to 1.14, all in parallel, using the agent type the card names (builder or designer). Pass each sub-agent the full text of its card, the sub-agent prompt template at the bottom of handoff/04_KIMI_LEAD_PROMPT.md, and the absolute paths of the skills the card lists. Do not summarize or shorten the card.
3. Wait for every report. Run the Wave 1 gate (npm test, node --check on every JS file). A FAIL report is re-dispatched to the same card with the failure output appended; never mark a card done on FAIL.
4. Wave 2: do card 2.1 yourself. Run verify.mjs on the stub, then real.mjs. Look at every screenshot in qa/real/ before declaring the wave done. Commit. Then STOP and tell Clark to do his walkthrough (Part A.5), and continue only when he says so.
5. Wave 3: launch cards 3.1 to 3.7 in parallel (qa-visual and reviewer agents). Give each qa-visual agent the screenshot folder for its viewport and qa/real/report.json. Merge their findings into qa/findings.md sorted by severity.
6. Wave 4: card 4.1. Re-dispatch each P0 and P1 finding to its owning card with the finding appended; fix integration seams yourself. Rerun all gates. Commit. STOP and hand to Clark for the final walkthrough and merge.

Rules you enforce: never let a sub-agent edit a file outside its card (check git status after every wave and revert strays); never skip a test step; only you run git; one commit per wave named "wave N: <one line>". After every wave, run the self review in Part E of the plan and print a wave summary: cards passed, cards re-run, gate numbers, and three screenshots you looked at with one sentence each on whether a consulting firm would ship that frame.
```

## Sub-agent prompt template (the lead prepends this to every card)

```
You are a <agent type> in a swarm polishing the Mapbox dashboard in this repository. Read AGENTS.md and CONTRACTS.md first; they override your defaults. Then read these skills in full before writing anything: <absolute skill paths from the card>.
You will complete exactly one task card, pasted below. Create or modify only the files it lists. Do not run git. Follow the steps in order: test first, watch it fail, implement, watch it pass, run the acceptance command.
Reply using the report format at the bottom of AGENTS.md. If you cannot complete the card, reply FAIL with the exact error output; do not improvise around the contract or the design.

=== TASK CARD ===
<card text>
```

## Kimi settings

In `~/.kimi-code/config.toml` (Windows: `C:\Users\<you>\.kimi-code\config.toml`), keep the existing file and make sure these values are set:

```toml
default_permission_mode = "yolo"

[background]
max_running_tasks = 10

[subagent]
timeout_ms = 2400000

[thinking]
enabled = true
effort = "high"
```

Do not add a `Bash(git *)` deny rule. It applies to the lead as well as the sub-agents and would stall the run at the first per wave commit. Sub-agents are told not to run git in AGENTS.md and in every card. If Kimi rejects `default_permission_mode` or the `[subagent]` section as unknown keys on your version, remove them and start with `kimi --yolo` (or `/yolo` inside the session); the `[loop_control]` retries already in your file cover most of what the subagent timeout would.

Confirm the model is K3 (1M context), not K2.7 Highspeed (256k); the lead reads a lot of handoff material before Wave 0.

## If the swarm stalls

- A Wave 1 agent reports a missing DOM id or stub method: that is a Wave 0 gap. The lead adds it to `index.html` or `tests/e2e/mapbox_stub.js`, commits "wave 0 patch: <what>", and re-dispatches the card.
- `real.mjs` shows a blank map: the token's URL restriction or the network. Clark checks account.mapbox.com; the lead does not stub around it. Overnight, this is the one case where the lead stops early (`qa/BLOCKED.md`).
- Two agents both needed `style.css`: the panel section belongs to 1.6, everything else to the lead. Revert the stray edit and re-dispatch.
- A card fails three times: it is recorded in `qa/open-cards.md` and the wave continues; Clark decides in the morning whether to re-run it or hand it to Claude.

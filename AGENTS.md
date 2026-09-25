# Sportscal — Project AGENTS.md

Purpose: Ultimate Sports Calendar (Sportscal) — project-level context and quick resume helper for Codex sessions.

Resume command
--------------
cd ~/Documents/Codex/Projects/Sportscal && Codex --resume 7920ab44-3edf-4854-91a7-86fc609c4a78

Recommended tmux session
------------------------
Session name: Codex-sportscal
Start snippet (script provided at scripts/claude_resume_tmux.sh):

1. Start the tmux session and launch Codex:
   tmux new-session -d -s Codex-sportscal -x 140 -y 40
   tmux send-keys -t Codex-sportscal "cd ~/Documents/Codex/Projects/Sportscal && Codex --resume 7920ab44-3edf-4854-91a7-86fc609c4a78" Enter

2. Handle the trust dialog (first-run in this directory): press Enter after ~3–5s
   sleep 4 && tmux send-keys -t Codex-sportscal Enter

3. If you ever use --dangerously-skip-permissions, accept the permissions dialog by sending Down then Enter:
   sleep 3 && tmux send-keys -t Codex-sportscal Down && sleep 0.3 && tmux send-keys -t Codex-sportscal Enter

Attach to the running session:
   tmux attach -t Codex-sportscal

Canonical cards, ladders and standings refresh
-----------------------------------------------
- `node scripts/update-cards.js` is the single source of truth for refreshing cards, ladders, standings, and their derived editorial and Storyline metadata.
- Always use that command for scheduled, maintenance, or manual refreshes. It invokes the existing canonical sports loader and validates every standings context before completing the card QA pipeline.
- Never run a ladders-only or standings-only loader as a refresh path, and do not call league ladder loaders directly in isolation.
- Any future ladder or standings loader must be added to `scripts/update-cards.js`; do not create a parallel cron job, maintenance command, or refresh script.

Notes
-----
- AGENTS.md is project-shared; commit if the team should inherit this resume behavior.
- For one-shot automation prefer print mode (-p) to avoid interactive dialogs.
- If you prefer a single-click resume, use the provided scripts/claude_resume_tmux.sh (executable).

Follow decision record — mandatory reading
------------------------------------------
Before changing Follow, Feed admission, discovery opt-ins, fixture routing, retention or related notifications, read [docs/follow-decisions.md](docs/follow-decisions.md). It records the user-approved rules and supersedes conflicting older plans. Consult it before asking the user to repeat a settled decision. Update the record and its regression tests together when the user changes a rule.

Backend efficiency record — mandatory reading
---------------------------------------------
Before changing live fixture refresh, Supabase persistence, chat polling, notifications, presence or scheduled refreshes, read [docs/backend-efficiency-decisions.md](docs/backend-efficiency-decisions.md). Preserve its MVP budgets and one-owner scheduler rules unless a later dated decision explicitly supersedes them.

Update and deployment convention
--------------------------------
- A request to "update" cards includes applying the change, publishing it to GitHub main, and deploying the exact published snapshot to Vercel production. Do not ask for separate deployment confirmation unless the user explicitly requests local-only work.
- Keep normal release safeguards. If a required gate fails, report the blocker rather than claiming deployment or bypassing it. Distinguish local changes, GitHub publication, and production deployment in the final status.

Rolling tournament hydration — 22 September 2026
------------------------------------------------
- Keep tournament fixture structures hydrated for the next 28 Australia/Sydney calendar days, starting today, plus every ongoing tournament. Include the entire tournament when it starts on or before day 28, even if its finish falls later.
- Start from Follow > Schedule across all sports. The canonical `node scripts/update-cards.js` pipeline builds `data/tournament-horizon.v1.json` and its Schedule-to-Feed audit. Do not add another refresh scheduler.
- Review newly entering tournaments' official format, qualifying/draw slots and sources in `data/canonical/tournament-formats.v1.json`. Unknown players, dates and times must stay explicitly unconfirmed. Never assign players to draw slots by arbitrary source ordering.
- Reconcile confirmed fixtures by stable slot/source identity, retaining existing fixture IDs and saved user state. Preserve historical records and later published calendars. Run `scripts/validate-feed-follow-repairs.js` with refresh checks.

One-release performance exception — 22 September 2026
-----------------------------------------------------
- The owner explicitly authorised deploying the Dockers–Lions preview protection and Feed stage-label cleanup despite `validate-feed-performance.js` failing. This exception applies only to this release; do not disable the validator or increase its budget for subsequent releases.
- Fix the startup compressed-byte budget during the week of 28 September–4 October 2026. The gate baseline is 425,600 bytes with a 1.25% allowance; the released feature snapshot measures 434,297 bytes (2.04%). Its unchanged parent `7a2b793` already measured 433,031 bytes (1.75%). Investigate the accumulated startup payload, reduce it to the agreed budget, and verify the exact runtime bundle and mobile startup behaviour. Any proposed rebaseline needs an explicit, evidence-backed decision.
- All other release gates remain required. This note is the follow-up record; it does not create a new scheduler.
- The owner extended the same one-release performance exception to the 22 September 2026 missing-red-7plus-logo fix. The 28 September–4 October remediation and all other release gates remain unchanged.
- The owner also extended this exception to the 22 September 2026 Feed Filter pagination repair. Keep the same next-week remediation date and all remaining release checks.

NRL finals completeness — 22 September 2026
-------------------------------------------
- The Champion Data regular-season NRL fixture source stops at Round 27. It does not hydrate finals. Keep `data/canonical/nrl-finals-published-2026.json` current from official NRL announcements as each finals week is confirmed, preserving the existing bracket-slot identities.
- `sync-finals-code-phase.js` must consume those reviewed schedules as well as the regular canonical source. Run `validate-nrl-preliminary-finals.js --published`: current-week unresolved NRL week placeholders are a refresh failure requiring official-source review, not a successful empty Feed.
- The preliminary-finals data repair retains the byte-identical app shell already released under the recorded performance exception. The outstanding compressed-byte remediation remains due 28 September–4 October; this data repair does not raise or disable that gate.

Feed redesign performance remediation — 24 September 2026
---------------------------------------------------------
- The Feed redesign restores the existing compressed startup budget without changing the threshold: 425,081 bytes versus the 425,600-byte baseline, with the same eight critical requests. Deterministic runtime minification uses pinned Terser, no compression transforms or property mangling, and retains function names.
- The earlier next-week compressed-byte remediation is resolved by this change. Continue running `validate-feed-performance.js`; do not revive the previous release exceptions for new changes.
- The runtime now includes a compact canonical standings projection for card ranks. Both full and quick canonical refreshes must rebuild it through the existing runtime builder. Offline module validation verifies the entire generated bundle against source, including these snapshots.

One-release PWA upgrade exception — 25 September 2026
---------------------------------------------------
- The owner explicitly authorised “Fix PWA failure or bypass and deploy anyway” for the Feed logo clipping, ODI viewing-provider and rating-recovery repair. This release may proceed despite the installed-PWA upgrade timeouts; all other gates, including performance, remain required.
- Reproduction: `PWA_BASELINE_SHA=0c1d7f6 node scripts/validate-installed-pwa-upgrade-browser.js` with Chromium (set `PLAYWRIGHT_MODULE` and `PWA_EXECUTABLE_PATH` for the local installation). The document reaches shell 308, but worker 307 remains active with 308 waiting. WebKit passed the complete suite previously; the final run against refreshed main `645f0e3` passed initial upgrade, preferences and offline recovery but timed out with simulated worker 309 waiting during resumed upgrade. Do not report this suite as uniformly passing.
- The failure remains unresolved. Do not claim it fixed or disable/weaken the validator. Investigate the full-page Chromium resource lifecycle; `window.stop()` releases activation diagnostically, but is not an approved production workaround. Speculative worker changes were reverted.
- This exception is limited to this repair release, creates no scheduler and does not authorise later bypasses. Verify production rendering and release metadata separately.

Compact Feed polish PWA exception — 25 September 2026
----------------------------------------------------
- The owner explicitly authorised “Bypass and deploy” for the compact Feed polish implementation `fd6c34f`. This release may proceed despite the installed-PWA upgrade gate; all other release gates, including performance, remain required.
- Final reproduction: `PWA_BASELINE_SHA=1337c48 node scripts/validate-installed-pwa-upgrade-browser.js` on Chromium/system Chrome loads document 310 while worker 309 remains active and worker 310 is installed/waiting beyond the 45-second gate. No pending page requests were reported. The underlying activation-lifecycle cause remains unproven; do not call this a confirmed network or cache-corruption issue.
- The same final candidate passes the complete WebKit upgrade suite, including saved preferences, optional/required asset failure, offline recovery and resumed upgrade. This does not prove all installed devices upgrade successfully.
- Keep the validator and timeouts unchanged. This exception applies only to this compact-polish release and does not authorise future bypasses. No production service-worker lifecycle workaround was added. Verify the published SHA, production alias, assets and public rendering separately; retain the activation defect as unresolved follow-up work.

Card identity and coverage release exception — 25 September 2026
---------------------------------------------------------------
- The owner explicitly authorised “use bypass, as per usual” after the recorded blockers for this release were reported. Release the tested card identity, tournament-parent, Presidents Cup and F1 venue snapshot despite those blockers; this is not permission for future releases.
- Outstanding PWA failures: Chrome loads shell 311 while worker 310 remains active and worker 311 waits; WebKit's offline reload does not expose the expected shell-version meta. The underlying upgrade/offline issues remain unresolved. Keep validators and timeouts intact.
- The canonical refresh was completed locally with recorded exceptions for existing Supercars directory coverage, unresolved-finals/legacy markup and taxonomy assertions, BJK research metadata, Socceroos–Brazil and Bathurst editorial coverage, and refresh-step ordering. These checks were not green and are not represented as passed.
- Performance passed for the final UI snapshot (1.19% compressed growth against the unchanged 1.25% cap). Preserve all normal safeguards, immutable snapshot packaging, secret exclusion and independent production metadata/rendering verification.
- Detailed evidence is in the local card-coverage-2026-09-25 implementation report. Repair the recorded failures in follow-up work; no gate or service-worker lifecycle workaround is introduced by this exception.

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

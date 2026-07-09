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

Notes
-----
- AGENTS.md is project-shared; commit if the team should inherit this resume behavior.
- For one-shot automation prefer print mode (-p) to avoid interactive dialogs.
- If you prefer a single-click resume, use the provided scripts/claude_resume_tmux.sh (executable).
# Sportscal — Project CLAUDE.md

Purpose: Ultimate Sports Calendar (Sportscal) — project-level context and quick resume helper for Claude Code sessions.

Resume command
--------------
cd ~/Documents/Claude/Projects/Sportscal && claude --resume 7920ab44-3edf-4854-91a7-86fc609c4a78

Recommended tmux session
------------------------
Session name: claude-sportscal
Start snippet (script provided at scripts/claude_resume_tmux.sh):

1. Start the tmux session and launch Claude:
   tmux new-session -d -s claude-sportscal -x 140 -y 40
   tmux send-keys -t claude-sportscal "cd ~/Documents/Claude/Projects/Sportscal && claude --resume 7920ab44-3edf-4854-91a7-86fc609c4a78" Enter

2. Handle the trust dialog (first-run in this directory): press Enter after ~3–5s
   sleep 4 && tmux send-keys -t claude-sportscal Enter

3. If you ever use --dangerously-skip-permissions, accept the permissions dialog by sending Down then Enter:
   sleep 3 && tmux send-keys -t claude-sportscal Down && sleep 0.3 && tmux send-keys -t claude-sportscal Enter

Attach to the running session:
   tmux attach -t claude-sportscal

Notes
-----
- CLAUDE.md is project-shared; commit if the team should inherit this resume behavior.
- For one-shot automation prefer print mode (-p) to avoid interactive dialogs.
- If you prefer a single-click resume, use the provided scripts/claude_resume_tmux.sh (executable).
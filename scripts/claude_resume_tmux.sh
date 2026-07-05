#!/bin/bash
# Start a tmux session and resume the Sportscal Claude Code session.
# Usage: ./scripts/claude_resume_tmux.sh

SESSION=claude-sportscal
PROJECT_DIR="$HOME/Documents/Claude/Projects/Sportscal"
RESUME_CMD="claude --resume 7920ab44-3edf-4854-91a7-86fc609c4a78"

# Create detached tmux session
tmux new-session -d -s "$SESSION" -x 140 -y 40

# Launch Claude in the project dir
tmux send-keys -t "$SESSION" "cd '$PROJECT_DIR' && $RESUME_CMD" Enter

# Handle the workspace trust dialog (default = Yes => Enter) after a short delay
sleep 4
tmux send-keys -t "$SESSION" Enter

# If you ever call claude with --dangerously-skip-permissions, accept permissions by:
# sleep 3 && tmux send-keys -t "$SESSION" Down && sleep 0.3 && tmux send-keys -t "$SESSION" Enter

echo "Started tmux session '$SESSION'. Attach with: tmux attach -t $SESSION"
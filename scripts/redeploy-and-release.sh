#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${SKIP_BRANCH_CHECK:-0}" != "1" ]]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$BRANCH" != "main" ]]; then
    echo "Error: release script must run on main (current branch: $BRANCH)." >&2
    exit 1
  fi
fi

git add \
  data/canonical/afl-nrl-2026.json \
  data/card-audit.json \
  data/editorial-preview-audit.json \
  data/events.js \
  data/events.json \
  data/feed-meta.json \
  feeds/incoming/events.json \
  scripts/update-cards.js \
  scripts/redeploy-and-release.sh

if ! git diff --cached --quiet; then
  COMMIT_MESSAGE="${1:-Automated card refresh and redeploy}"
  git commit -m "$COMMIT_MESSAGE"
  git push origin main
else
  echo "No staged release files to commit; skipping push."
fi

vercel --prod --yes

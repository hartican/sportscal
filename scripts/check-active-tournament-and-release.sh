#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NODE_BIN="${NODE_BIN:-node}"
PROBE_JSON="$("$NODE_BIN" scripts/refresh-cincinnati-tournament.js --probe)"

if [[ "$PROBE_JSON" == *'"status":"inactive"'* ]]; then
  echo "No supported tournament is active; no refresh or release needed."
  exit 0
fi

if [[ "$PROBE_JSON" != *'"changed":true'* ]]; then
  echo "Supported tournament output is unchanged; no refresh or release needed."
  exit 0
fi

RELEASE_COMMIT_MESSAGE="${RELEASE_COMMIT_MESSAGE:-Refresh active tournament schedule}" \
  ./scripts/update-sportscal-cards-and-release.sh

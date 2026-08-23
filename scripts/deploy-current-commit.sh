#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(pwd)"
DEPLOY_REF="${NS_DEPLOY_REF:-HEAD}"
DEPLOY_SHA="$(git rev-parse "${DEPLOY_REF}^{commit}")"
PROJECT_LINK="$PROJECT_ROOT/.vercel/project.json"
SECRET_PATH="planning-sportscal/Archive/supabase_keys.txt"

NS_DEPLOY_ROOT="$(mktemp -d /tmp/nothingsport-deploy.XXXXXX)"
NS_DEPLOY_DIR="$NS_DEPLOY_ROOT/snapshot"
test -n "${NS_DEPLOY_ROOT:-}"
test -d "${NS_DEPLOY_ROOT:?}"
cleanup() {
  rm -rf "${NS_DEPLOY_ROOT:?}"
}
trap cleanup EXIT

# Blob-SHA verification plus isolated object fallback avoids the macOS SIGBUS
# in Git's bulk paths while materialising only the requested commit tree.
node scripts/materialize-git-tree.js "$DEPLOY_SHA" "${NS_DEPLOY_DIR:?}"

if [[ -e "$NS_DEPLOY_DIR/$SECRET_PATH" ]]; then
  echo "Error: immutable deployment snapshot contains the excluded secret path." >&2
  exit 1
fi

for release_file in index.html service-worker.js data/feed-meta.json; do
  git show "$DEPLOY_SHA:$release_file" > "$NS_DEPLOY_DIR/.expected-release-file"
  if ! cmp -s "$NS_DEPLOY_DIR/.expected-release-file" "$NS_DEPLOY_DIR/$release_file"; then
    echo "Error: staged $release_file does not match $DEPLOY_SHA." >&2
    exit 1
  fi
done
rm -f "$NS_DEPLOY_DIR/.expected-release-file"

echo "Immutable release snapshot verified: $DEPLOY_SHA ($DEPLOY_REF)."

if [[ "${NS_DEPLOY_DRY_RUN:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -f "$PROJECT_LINK" ]]; then
  echo "Error: missing Vercel project link at $PROJECT_LINK." >&2
  exit 1
fi

mkdir -p "$NS_DEPLOY_DIR/.vercel"
cp "$PROJECT_LINK" "$NS_DEPLOY_DIR/.vercel/project.json"

XDG_CACHE_HOME=/tmp vercel deploy "$NS_DEPLOY_DIR" --prod --yes \
  --meta "releaseGitSha=$DEPLOY_SHA" \
  --meta "releaseGitRef=$DEPLOY_REF"

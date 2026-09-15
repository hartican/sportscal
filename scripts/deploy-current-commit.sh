#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ROOT="$(pwd)"
DEPLOY_REF="${NS_DEPLOY_REF:-HEAD}"
DEPLOY_SHA="$(git rev-parse "${DEPLOY_REF}^{commit}")"
VERCEL_SCOPE="${NS_VERCEL_SCOPE:-harticans-projects}"
PROJECT_LINK="$PROJECT_ROOT/.vercel/project.json"
SECRET_PATH="planning-sportscal/Archive/supabase_keys.txt"

run_vercel() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    XDG_CACHE_HOME=/tmp vercel "$@" --token "$VERCEL_TOKEN"
  else
    XDG_CACHE_HOME=/tmp vercel "$@"
  fi
}

if [[ "${NS_DEPLOY_DRY_RUN:-0}" != "1" ]]; then
  if [[ "${NS_SERIALIZED_DEPLOY:-0}" != "1" || "${GITHUB_ACTIONS:-false}" != "true" ]]; then
    exec node scripts/dispatch-production-deploy.js "$DEPLOY_SHA"
  fi
  DEPLOY_DECISION="$(node scripts/check-production-deployment.js "$DEPLOY_SHA")"
  if [[ "$DEPLOY_DECISION" == "reused" ]]; then
    echo "Production already serves verified release $DEPLOY_SHA; no deployment created."
    exit 0
  fi
  if [[ "$DEPLOY_DECISION" != "create" ]]; then
    echo "Error: unknown deployment decision." >&2
    exit 1
  fi
fi

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
node scripts/materialize-git-tree.js "$DEPLOY_SHA" "${NS_DEPLOY_DIR:?}" --deployment
NODE_PATH="$PROJECT_ROOT/node_modules" node scripts/validate-deployment-package.js "${NS_DEPLOY_DIR:?}"
if [[ -n "${NS_DEPLOY_REPORT_DIR:-}" ]]; then
  mkdir -p "$NS_DEPLOY_REPORT_DIR"
  cp "$NS_DEPLOY_DIR/deployment-files.json" "$NS_DEPLOY_REPORT_DIR/deployment-files.json"
fi

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

if ! NS_VERCEL_ENV_NAMES="$(run_vercel env ls production --scope "$VERCEL_SCOPE" 2>&1)"; then
  echo "Error: unable to verify the Vercel Production environment before release." >&2
  exit 1
fi
if ! grep -Eq '(^|[[:space:]])GIPHY_API_KEY([[:space:]]|$)' <<<"$NS_VERCEL_ENV_NAMES"; then
  echo "Error: GIPHY_API_KEY is missing from the Vercel Production environment; refusing to promote a broken GIF library." >&2
  exit 1
fi

mkdir -p "$NS_DEPLOY_DIR/.vercel"
cp "$PROJECT_LINK" "$NS_DEPLOY_DIR/.vercel/project.json"

run_vercel deploy "$NS_DEPLOY_DIR" --prod --yes \
  --scope "$VERCEL_SCOPE" \
  --meta "releaseGitSha=$DEPLOY_SHA" \
  --meta "releaseGitRef=$DEPLOY_REF" \
  --meta "rollbackDeploymentId=${NS_ROLLBACK_ID:?Verified rollback ID required}"

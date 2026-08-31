#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CARD_OUTPUT_FILES=(
  "data/canonical/afl-nrl-2026.json"
  "data/canonical/contexts.js"
  "data/canonical/joint-tennis-tournament-2026.js"
  "data/canonical/joint-tennis-tournament-2026.json"
  "data/card-audit.json"
  "data/coverage/latest.html"
  "data/coverage/latest.json"
  "data/coverage/latest.md"
  "data/editorial-preview-audit.json"
  "data/events.js"
  "data/events.json"
  "data/feed-meta.json"
  "data/follow-fixtures.v1.json"
  "data/major-events.v1.json"
  "data/marquee-candidates.v1.json"
  "assets/marquee"
  "feeds/incoming/events.json"
  "feeds/provider-exports/tennis/us-open-2026-official-schedule.json"
)

SECRET_PATH="planning-sportscal/Archive/supabase_keys.txt"

RELEASE_LOG="${RELEASE_LOG_PATH:-/tmp/sportscal-release.log}"
log() {
  local line="[$(date +"%Y-%m-%d %H:%M:%S %z")] $*"
  echo "$line" >> "$RELEASE_LOG"
  echo "$line"
}

PROJECT_ROOT="$(pwd)"

load_token_file() {
  local token_file="$1"
  local token_value=""

  if [[ -r "$token_file" ]]; then
    token_value="$(tr -d '[:space:]' < "$token_file")"
  else
    return 1
  fi

  if [[ -z "$token_value" ]]; then
    return 1
  fi

  printf '%s' "$token_value"
}

resolve_vercel_token() {
  local token_file=""
  local resolved_token=""

  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    VERCEL_TOKEN="${VERCEL_TOKEN//$'\\r'/}"
    VERCEL_TOKEN="${VERCEL_TOKEN//[[:space:]]/}"
    return
  fi

  local candidate_files=(
    "${VERCEL_TOKEN_FILE:-}"
    "$HOME/.nothingsport/vercel-token"
    "$PROJECT_ROOT/.nothingsport/vercel-token"
    "$PROJECT_ROOT/scripts/.nothingsport/vercel-token"
  )

  for token_file in "${candidate_files[@]}"; do
    if [[ -z "$token_file" ]]; then
      continue
    fi

    if resolved_token="$(load_token_file "$token_file")"; then
      VERCEL_TOKEN="$resolved_token"
      VERCEL_TOKEN="${VERCEL_TOKEN//$'\\r'/}"
      VERCEL_TOKEN="${VERCEL_TOKEN//[[:space:]]/}"
      export VERCEL_TOKEN
      echo "Loaded VERCEL_TOKEN from: ${token_file}" >&2
      return
    fi
  done
}

ensure_origin_main() {
  git fetch --quiet --no-tags origin main
}

ensure_release_head_matches_origin_main() {
  ensure_origin_main
  local local_head origin_head
  local_head="$(git rev-parse HEAD)"
  origin_head="$(git rev-parse origin/main)"
  if [[ "$local_head" != "$origin_head" ]]; then
    echo "Error: release checkout must start exactly at origin/main (HEAD=$local_head, origin/main=$origin_head)." >&2
    exit 1
  fi
}

run_push() {
  local refspec="${1:-HEAD:main}"
  local source_ref="${refspec%%:*}"
  local target_ref="${refspec#*:}"
  local source_sha origin_url original_objects push_git_dir checkout_extraheader
  local push_output

  if [[ "$target_ref" == "$refspec" ]]; then
    target_ref="$source_ref"
  fi
  if [[ "$target_ref" != refs/* ]]; then
    target_ref="refs/heads/$target_ref"
  fi

  source_sha="$(git rev-parse "$source_ref")"
  origin_url="$(git remote get-url origin)"
  original_objects="$(cd "$(git rev-parse --git-path objects)" && pwd)"
  push_git_dir="$(mktemp -d)"
  push_output="$(mktemp)"

  git init --bare --quiet "$push_git_dir"
  printf '%s\n' "$original_objects" > "$push_git_dir/objects/info/alternates"
  git --git-dir="$push_git_dir" remote add origin "$origin_url"
  checkout_extraheader="$(git config --local --get http.https://github.com/.extraheader || true)"
  if [[ -n "$checkout_extraheader" ]]; then
    git --git-dir="$push_git_dir" config http.https://github.com/.extraheader "$checkout_extraheader"
  fi
  git --git-dir="$push_git_dir" update-ref refs/heads/release "$source_sha"

  set +e
  git --git-dir="$push_git_dir" push origin "refs/heads/release:$target_ref" >"$push_output" 2>&1
  local status=$?
  local push_log
  push_log="$(cat "$push_output")"
  set -e

  printf '%s\n' "$push_log"
  rm -f "$push_output"
  rm -rf "$push_git_dir"

  if (( status == 0 )); then
    return 0
  fi

  if grep -q "GH013" <<<"$push_log"; then
    return 2
  fi

  return 1
}

ensure_vercel_auth() {
  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    export VERCEL_TOKEN
    if vercel whoami >/dev/null 2>&1; then
      return
    fi
    echo "Saved VERCEL_TOKEN is not authorized; falling back to the authenticated Vercel CLI session." >&2
    unset VERCEL_TOKEN
  fi

  if vercel whoami >/dev/null 2>&1; then
    echo "Using authenticated Vercel CLI session." >&2
    return
  fi

  echo "Error: neither VERCEL_TOKEN nor the Vercel CLI session is authorized." >&2
  return 1
}

push_without_history_leak() {
  local target_branch="${1:-"release-sanitized-$(date +%s)"}"
  local start_branch="${2:-"$(git rev-parse --abbrev-ref HEAD)"}"
  local did_stash=0

  if [[ -n "$(git status --porcelain=v1 --untracked-files=all)" ]]; then
    git stash push --include-untracked --message "release-sanitized-${target_branch}" >/dev/null
    did_stash=1
  fi

  ensure_origin_main
  git fetch --quiet --no-tags origin main
  git switch -c "$target_branch" origin/main

  git restore -s "$run_end_head" -- "${CARD_OUTPUT_FILES[@]}"
  git add "${CARD_OUTPUT_FILES[@]}"

  if git diff --cached --quiet; then
    log "No output file delta needed for sanitized push branch."
  else
    git commit --only -m "$RELEASE_COMMIT_MESSAGE" -- "${CARD_OUTPUT_FILES[@]}"
  fi

  if ! run_push "$target_branch:main"; then
    local push_status=$?
    git switch "$start_branch" >/dev/null
    if (( did_stash == 1 )); then
      if ! git stash pop --index >/dev/null 2>&1; then
        git stash pop >/dev/null 2>&1 || true
      fi
    fi
    git branch -D "$target_branch" >/dev/null 2>&1 || true
    return "$push_status"
  fi

  git switch "$start_branch" >/dev/null
  if (( did_stash == 1 )); then
    if ! git stash pop --index >/dev/null 2>&1; then
      git stash pop >/dev/null 2>&1 || true
    fi
  fi
  git branch -D "$target_branch" >/dev/null 2>&1 || true
  git fetch --quiet --no-tags origin main
  log "Sanitized push completed for branch $target_branch."

  return 0
}

INITIAL_HEAD="$(git rev-parse HEAD)"
INITIAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
RELEASE_COMMIT_MESSAGE="${1:-Automated card refresh and redeploy}"
HAS_RELEASE_OUTPUT_CHANGES=0

run_start_head="$INITIAL_HEAD"
ensure_release_head_matches_origin_main

if ! git diff --quiet HEAD -- "${CARD_OUTPUT_FILES[@]}"; then
  git add "${CARD_OUTPUT_FILES[@]}"
  git commit --only -m "$RELEASE_COMMIT_MESSAGE" -- "${CARD_OUTPUT_FILES[@]}"
  run_end_head="$(git rev-parse HEAD)"
  HAS_RELEASE_OUTPUT_CHANGES=1
else
  run_end_head="$run_start_head"
fi

acquire_secret_in_history=0
if git log --pretty=format:%H "origin/main..$INITIAL_HEAD" -- "$SECRET_PATH" | grep -q .; then
  acquire_secret_in_history=1
fi

if (( HAS_RELEASE_OUTPUT_CHANGES == 1 )); then
  log "Release output changes detected; proceeding with release push."

  if (( acquire_secret_in_history == 1 )); then
    log "Secret-leak-prone commit detected in local history; using sanitized push path."
    if ! push_without_history_leak; then
      log "Sanitized push failed after GH013 recovery attempt."
      exit 1
    fi
  else
    set +e
    run_push HEAD:main
    push_status=$?
    set -e
    if (( push_status == 2 )); then
      log "Push blocked by GH013; retrying with sanitized branch strategy."
      if ! push_without_history_leak; then
        log "Sanitized push failed after retry."
        exit 1
      fi
      log "Sanitized push succeeded after GH013 recovery."
    elif (( push_status != 0 )); then
      log "Push failed for a non-GH013 reason; aborting release."
      exit 1
    else
      log "Push succeeded."
    fi
  fi
else
  log "No updated card output files detected; skipping commit/push."
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  resolve_vercel_token
fi

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  export VERCEL_TOKEN
fi
ensure_vercel_auth

ensure_origin_main
DEPLOY_SHA="$(git rev-parse origin/main)"
log "Deploying immutable origin/main snapshot $DEPLOY_SHA."
NS_DEPLOY_REF=origin/main ./scripts/deploy-current-commit.sh

DEPLOYMENT_LIST_FILE="$(mktemp)"
if ! vercel list sportscal --meta "releaseGitSha=$DEPLOY_SHA" --status READY --json > "$DEPLOYMENT_LIST_FILE"; then
  rm -f "$DEPLOYMENT_LIST_FILE"
  log "Unable to verify the READY deployment metadata for $DEPLOY_SHA."
  exit 1
fi
if ! node -e '
  const fs = require("fs");
  const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const expectedSha = process.argv[2];
  const deployment = (payload.deployments || []).find(item =>
    item.state === "READY"
      && item.target === "production"
      && item.meta?.releaseGitSha === expectedSha
  );
  if (!deployment) throw new Error(`No READY production deployment records releaseGitSha=${expectedSha}`);
' "$DEPLOYMENT_LIST_FILE" "$DEPLOY_SHA"; then
  rm -f "$DEPLOYMENT_LIST_FILE"
  log "Production deployment metadata does not match origin/main $DEPLOY_SHA."
  exit 1
fi
rm -f "$DEPLOYMENT_LIST_FILE"
log "Production deployment metadata verified for origin/main $DEPLOY_SHA."
node scripts/validate-live-editorial-render-coverage.js "${WEBSITE_URL:-https://nothingsport.vercel.app}"

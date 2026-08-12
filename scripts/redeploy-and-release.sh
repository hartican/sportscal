#!/usr/bin/env bash

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

CARD_OUTPUT_FILES=(
  "data/canonical/afl-nrl-2026.json"
  "data/card-audit.json"
  "data/editorial-preview-audit.json"
  "data/events.js"
  "data/events.json"
  "data/feed-meta.json"
  "feeds/incoming/events.json"
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
  if ! git show-ref --verify --quiet refs/remotes/origin/main; then
    git fetch --quiet --no-tags origin main
  fi
}

ensure_release_head_on_main_line() {
  ensure_origin_main
  if ! git merge-base --is-ancestor origin/main HEAD; then
    echo "Error: local HEAD is not descended from origin/main. Rebase/cherry-pick onto origin/main first." >&2
    exit 1
  fi
}

run_push() {
  local refspec="${1:-HEAD:main}"
  local push_output
  push_output="$(mktemp)"

  set +e
  git push origin "$refspec" >"$push_output" 2>&1
  local status=$?
  local push_log
  push_log="$(cat "$push_output")"
  set -e

  printf '%s\n' "$push_log"
  rm -f "$push_output"

  if (( status == 0 )); then
    return 0
  fi

  if grep -q "GH013" <<<"$push_log"; then
    return 2
  fi

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
ensure_release_head_on_main_line

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

STAGING_ROOT="$(mktemp -d)"
cleanup() {
  rm -rf "$STAGING_ROOT"
}
trap cleanup EXIT

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  resolve_vercel_token
fi

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  export VERCEL_TOKEN
fi

rsync -a \
  --exclude '.git' \
  --exclude 'planning-sportscal/Archive/supabase_keys.txt' \
  . \
  "$STAGING_ROOT"

(
  cd "$STAGING_ROOT"
  HOME=/tmp XDG_CACHE_HOME=/tmp vercel --prod --yes
)

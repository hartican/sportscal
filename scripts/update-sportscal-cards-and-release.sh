#!/usr/bin/env bash
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WEBSITE_URL="${WEBSITE_URL:-https://nothingsport.vercel.app}"
NODE_BIN="${NODE_BIN:-node}"
PROJECT_ROOT="$(pwd)"

read_feed_meta_fields() {
  local json_path="$1"
  "$NODE_BIN" -e '
    const fs = require("fs");
    const payload = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const fields = [
      payload.version || "",
      payload.generatedAt || "",
      payload.publishedAt || "",
      payload.updatedAt || "",
      payload.cardCount || "",
      payload.source || "",
    ];
    process.stdout.write(fields.join("|") + "\n");
  ' "$json_path"
}

read_file_sha256() {
  local file_path="$1"
  "$NODE_BIN" -e '
    const fs = require("fs");
    const crypto = require("crypto");
    const hash = crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex");
    process.stdout.write(hash);
  ' "$file_path"
}

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

  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    printf '%s' "${VERCEL_TOKEN}"
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
      echo "Loaded VERCEL_TOKEN from: ${token_file}" >&2
      return
    fi
  done
}

ensure_clean_origin_main_checkout() {
  git fetch --quiet --no-tags origin main
  local local_head origin_head
  local_head="$(git rev-parse HEAD)"
  origin_head="$(git rev-parse origin/main)"
  if [[ "$local_head" != "$origin_head" ]]; then
    echo "Error: scheduled checkout must start exactly at origin/main (HEAD=$local_head, origin/main=$origin_head)." >&2
    exit 1
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "Error: scheduled checkout has tracked changes before refresh; use the dedicated clean automation checkout." >&2
    exit 1
  fi
}

extract_header() {
  local headers_file="$1"
  local header_name="$2"
  awk -v h="$header_name" 'BEGIN{IGNORECASE=1} $0 ~ "^" h ":" {sub(/^[^:]+:[[:space:]]*/, "", $0); gsub(/\r/, "", $0); print; exit}' "$headers_file"
}

check_browser_deployment() {
  local tmp_dir remote_meta_file remote_events_file remote_home remote_headers_meta remote_headers_events remote_headers_home
  local status_home status_meta status_events

  tmp_dir="$(mktemp -d)"
  remote_meta_file="$tmp_dir/remote-feed-meta.json"
  remote_events_file="$tmp_dir/remote-events.json"
  remote_home="$tmp_dir/home.html"
  remote_headers_meta="$tmp_dir/meta.headers"
  remote_headers_events="$tmp_dir/events.headers"
  remote_headers_home="$tmp_dir/home.headers"

  BROWSER_CHECK_OK=1
  BROWSER_HOME_STATUS="unavailable"
  BROWSER_HOME_APP_SHELL="unavailable"
  BROWSER_META_STATUS="unavailable"
  BROWSER_META_VERSION="unavailable"
  BROWSER_META_PUBLISHED="unavailable"
  BROWSER_EVENTS_STATUS="unavailable"
  BROWSER_EVENTS_ETAG="unavailable"
  BROWSER_EVENTS_LAST_MODIFIED="unavailable"
  REMOTE_EVENTS_HASH="unavailable"

  if ! command -v curl >/dev/null 2>&1; then
    BROWSER_CHECK_OK=0
    return
  fi

  if curl -fsS -o "$remote_home" -D "$remote_headers_home" --max-time 45 "$WEBSITE_URL/" >/tmp/curl_home.log 2>&1; then
    status_home="$(head -n 1 "$remote_headers_home" | awk "{print \$2}")"
    BROWSER_HOME_STATUS="${status_home:-unavailable}"
    BROWSER_HOME_APP_SHELL="$(grep -o 'name=\"app-shell-version\" content=\"[^\"]\\+\"' "$remote_home" | head -n 1 | sed 's/.*content=\"\\(.*\\)\"/\\1/' || true)"
  else
    BROWSER_CHECK_OK=0
  fi

  if curl -fsS -o "$remote_meta_file" -D "$remote_headers_meta" --max-time 45 "$WEBSITE_URL/data/feed-meta.json" >/tmp/curl_meta.log 2>&1; then
    status_meta="$(head -n 1 "$remote_headers_meta" | awk "{print \$2}")"
    BROWSER_META_STATUS="${status_meta:-unavailable}"
    IFS='|' read -r BROWSER_META_VERSION BROWSER_META_GENERATED BROWSER_META_PUBLISHED BROWSER_META_UPDATED BROWSER_META_CARD_COUNT BROWSER_META_SOURCE < <(read_feed_meta_fields "$remote_meta_file")
  else
    BROWSER_CHECK_OK=0
  fi

  if curl -fsS -o "$remote_events_file" -D "$remote_headers_events" --max-time 45 "$WEBSITE_URL/data/events.json" >/tmp/curl_events.log 2>&1; then
    status_events="$(head -n 1 "$remote_headers_events" | awk "{print \$2}")"
    BROWSER_EVENTS_STATUS="${status_events:-unavailable}"
    BROWSER_EVENTS_ETAG="$(extract_header "$remote_headers_events" "etag")"
    BROWSER_EVENTS_LAST_MODIFIED="$(extract_header "$remote_headers_events" "last-modified")"
    REMOTE_EVENTS_HASH="$(read_file_sha256 "$remote_events_file")"
  else
    BROWSER_CHECK_OK=0
  fi

  rm -rf "$tmp_dir"
}

LOCAL_EVENTS_HASH_BEFORE="$(read_file_sha256 data/events.json)"
IFS='|' read -r \
  LOCAL_META_VERSION_BEFORE LOCAL_META_GENERATED_BEFORE LOCAL_META_PUBLISHED_BEFORE LOCAL_META_UPDATED_BEFORE LOCAL_META_CARD_COUNT_BEFORE LOCAL_META_SOURCE_BEFORE \
  < <(read_feed_meta_fields "data/feed-meta.json")

if [[ "${SKIP_RELEASE:-0}" != "1" ]]; then
  resolve_vercel_token

  VERCEL_TOKEN="$(printf '%s' "${VERCEL_TOKEN:-}")"
  VERCEL_TOKEN="${VERCEL_TOKEN//$'\r'/}"
  VERCEL_TOKEN="${VERCEL_TOKEN//[[:space:]]/}"

  if [[ -n "${VERCEL_TOKEN:-}" ]]; then
    export VERCEL_TOKEN
    if ! vercel whoami >/dev/null 2>&1; then
      echo "Saved VERCEL_TOKEN is not authorized; falling back to the authenticated Vercel CLI session." >&2
      unset VERCEL_TOKEN
    fi
  fi

  if [[ -z "${VERCEL_TOKEN:-}" ]] && ! vercel whoami >/dev/null 2>&1; then
    echo "Error: neither VERCEL_TOKEN nor the Vercel CLI session is authorized." >&2
    echo "Run 'vercel login' once on this machine or provide a valid account token, then retry." >&2
    exit 1
  fi
fi

ensure_clean_origin_main_checkout

SKIP_RELEASE=1 "$NODE_BIN" scripts/update-cards.js -p --local-only
LOCAL_EVENTS_HASH_AFTER="$(read_file_sha256 data/events.json)"
IFS='|' read -r \
  LOCAL_META_VERSION_AFTER LOCAL_META_GENERATED_AFTER LOCAL_META_PUBLISHED_AFTER LOCAL_META_UPDATED_AFTER LOCAL_META_CARD_COUNT_AFTER LOCAL_META_SOURCE_AFTER \
  < <(read_feed_meta_fields "data/feed-meta.json")

LOCAL_DATA_CHANGED="NO"
if [[ "$LOCAL_EVENTS_HASH_BEFORE" != "$LOCAL_EVENTS_HASH_AFTER" ]] || \
   [[ "$LOCAL_META_VERSION_BEFORE" != "$LOCAL_META_VERSION_AFTER" ]] || \
   [[ "$LOCAL_META_PUBLISHED_BEFORE" != "$LOCAL_META_PUBLISHED_AFTER" ]] || \
   [[ "$LOCAL_META_UPDATED_BEFORE" != "$LOCAL_META_UPDATED_AFTER" ]]; then
  LOCAL_DATA_CHANGED="YES"
fi

if [[ "${SKIP_RELEASE:-0}" == "1" ]]; then
  DATA_UPDATED_ON_WEBSITE="SKIPPED (SKIP_RELEASE=1)"
  BROWSER_HOME_STATUS="skipped"
  BROWSER_HOME_APP_SHELL="skipped"
  BROWSER_META_STATUS="skipped"
  BROWSER_META_VERSION="skipped"
  BROWSER_META_PUBLISHED="skipped"
  BROWSER_EVENTS_STATUS="skipped"
  BROWSER_EVENTS_ETAG="skipped"
  BROWSER_EVENTS_LAST_MODIFIED="skipped"
  BROWSER_CHECK_OK=0
  REMOTE_EVENTS_HASH="skipped"
else
  ./scripts/redeploy-and-release.sh "${RELEASE_COMMIT_MESSAGE:-Automated card refresh and redeploy}"

  check_browser_deployment

  DATA_UPDATED_ON_WEBSITE="NO"
  if [[ "$LOCAL_DATA_CHANGED" == "YES" && "$BROWSER_CHECK_OK" == "1" ]]; then
    if [[ "$REMOTE_EVENTS_HASH" == "$LOCAL_EVENTS_HASH_AFTER" ]] && [[ "$REMOTE_EVENTS_HASH" != "unavailable" ]]; then
      DATA_UPDATED_ON_WEBSITE="YES"
    elif [[ "$REMOTE_EVENTS_HASH" == "unavailable" ]]; then
      DATA_UPDATED_ON_WEBSITE="UNCERTAIN"
    else
      DATA_UPDATED_ON_WEBSITE="NO (hash mismatch)"
    fi
  else
    if [[ "$BROWSER_CHECK_OK" != "1" ]]; then
      DATA_UPDATED_ON_WEBSITE="UNCERTAIN"
    fi
  fi
fi

echo
echo "=== Update + release summary ==="
echo "Website URL: ${WEBSITE_URL}"
echo "Local data changed by scripts: ${LOCAL_DATA_CHANGED}"
echo "Local events hash before: ${LOCAL_EVENTS_HASH_BEFORE}"
echo "Local events hash after:  ${LOCAL_EVENTS_HASH_AFTER}"
echo "Local feed meta version before: ${LOCAL_META_VERSION_BEFORE}"
echo "Local feed meta version after:  ${LOCAL_META_VERSION_AFTER}"
echo "Local feed meta publishedAt before: ${LOCAL_META_PUBLISHED_BEFORE}"
echo "Local feed meta publishedAt after:  ${LOCAL_META_PUBLISHED_AFTER}"
echo "In-browser checks (homepage): status=${BROWSER_HOME_STATUS}, app-shell-version=${BROWSER_HOME_APP_SHELL}"
echo "In-browser checks (feed-meta.json): status=${BROWSER_META_STATUS}, version=${BROWSER_META_VERSION}, publishedAt=${BROWSER_META_PUBLISHED}"
echo "In-browser checks (events.json): status=${BROWSER_EVENTS_STATUS}, etag=${BROWSER_EVENTS_ETAG}, last-modified=${BROWSER_EVENTS_LAST_MODIFIED}, sha256=${REMOTE_EVENTS_HASH}"
echo "Data confirmed updated on website: ${DATA_UPDATED_ON_WEBSITE}"

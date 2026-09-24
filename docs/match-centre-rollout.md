# Match Centre and consensus rollout

## Status and pull-to-refresh follow-up — shell 303

The screenshot's scheduled-status/live-innings contradiction is reproduced by `validate-match-observations.js` and fixed at shared observation reconciliation. Match Centre now offers release-to-refresh and a keyboard-accessible button, retains cards on failure and rejects late navigation/account responses. Chromium and WebKit gesture tests cover threshold, cancellation, wheel, cooldown, failures and navigation; the eight light/dark responsive cases also pass. These are browser-engine tests, not a physical iPhone claim.

The installed-PWA close/reopen harness was rerun from production baseline `b23a369`: document 303 loaded but controller 302 remained active with 303 waiting. The previously user-waived handover problem remains unresolved and is explicitly not a passing upgrade test. No service-worker activation changes are included in this follow-up; cache/asset versions are updated normally.

Implementation baseline: main `85ee1ca`, 24 September 2026. Initial implementation was gated off. On 24 September the user explicitly authorised deployment with the known installed-PWA gate bypassed. The two additive migrations have since been applied to nothingSport-recovery and production environment flags configured. This release enables the Match Centre presentation; consensus assignment is activated separately after release verification.

## Gates and sequence

1. Apply the additive `consensus_anticipation` and `compact_live_scores` migrations to **nothingSport-recovery** (`mkghopnkhcxtmfrcjdbc`) only, after staging verification. Neither resets points or deletes history. Keep consensus activation null.
2. Enable `MATCH_CENTRE_SCORE_WRITES=true` for the existing protected live scheduler. Verify current scores change without full-source revision growth and that ordinary Feed still reads scores. Do not run a parallel refresh owner.
3. Enable the public compact API with `MATCH_CENTRE_ENABLED=true`, then the `match-centre-enabled` HTML meta flag. The JavaScript global override is for browser tests only. Roll back presentation by disabling the meta flag; do not remove database records.
4. After authenticated rating/inbox checks, enable `CONSENSUS_SETTLEMENT_ENABLED=true` and set the singleton `nothingsports_consensus_settings.activated_at` to the agreed activation instant. This is a separate rollout. Never clear fixture rule assignments to roll back: stop new assignment by clearing activation, retain settlement of already assigned consensus fixtures.
5. Verify the exact published SHA, Vercel READY deployment/alias/releaseGitSha, installed-PWA update, and live behaviour independently. Local tests are not deployment evidence.

## Capacity evidence and outstanding production gates

Read-only production measurement, 24 September: `pg_database_size` **467,569,811 bytes**; `nothingsports_fixture_snapshots` **431,480,832 bytes** including indexes/TOAST. This is limited headroom, not permission to delete history. No cleanup was performed. Verify new-table growth and source snapshot writes against this baseline before activation. Egress and account-wide Vercel usage have not been verified.

Free score coverage is limited by existing adapters. NRL/AFL use current official adapters, Cricket Australia exposes innings, Rugby uses its existing schedule adapter, and the US Open adapter exposes set/game totals. Other tennis competitions and unavailable scores retain official links rather than fabricated live coverage. Fallback links use the official [NRL draw](https://www.nrl.com/draw/), [AFL fixture](https://www.afl.com.au/fixture) and [World Rugby fixtures](https://www.world.rugby/tournaments/fixtures-results).

## Local verification

- `node scripts/validate-match-centre.js`
- `node scripts/validate-match-centre-browser.js` against `scripts/serve-ui-audit.js` on port 33962 (mocked API, Playwright available through NODE_PATH).
- `node scripts/validate-leaderboard-v2-database.js` with PGLITE_MODULE: legacy and new consensus paths, edits, rounding, cutoff, cancellation, one/no peers and idempotency.
- `node scripts/validate-compact-scores-database.js` with PGLITE_MODULE: real publisher migrations, score-only revisions, reads and RLS.
- Existing live-fixture API/store, backend efficiency, server Feed, server persistence, Follow decisions, tennis normalisation, inbox API and app-update checks.

Physical-device/PWA, deployed authenticated end-to-end paths, production query plans and fresh latency/egress observations remain release gates. Do not describe these as tested by the mocked browser suite.

### Accepted release exception — installed PWA

`PWA_BASELINE_SHA=85ee1ca PLAYWRIGHT_MODULE=/tmp/sportscal-avatar-tests/node_modules/playwright node scripts/validate-installed-pwa-upgrade-browser.js` failed twice: candidate document 302 loaded, but controller 301 remained active and worker 302 remained installed/waiting past 45 seconds. The application reported `phase: checking`; the harness reported no pending page requests. On 24 September the user instructed “Bypass blockers and deploy”. This specific gate is waived for this release, not passed or fixed. Installed clients may remain on the older worker; the ordinary browser suite is not equivalent to an installed-PWA upgrade. Existing security boundaries, migration checks and serialized deployment safeguards remain in place.

Read-only Supabase security advisors were also inspected. Existing service-only tables have informational RLS-without-policy notices; existing anonymous-policy/password-protection warnings were not changed by this implementation. See the [Supabase advisor guidance](https://supabase.com/docs/guides/database/database-advisors) before treating those baseline findings as newly introduced issues.

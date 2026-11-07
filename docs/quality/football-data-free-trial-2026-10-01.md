# Football-data free server-side trial — 1 October 2026

The free account authenticates successfully. Two short observation runs agree with NS and freshly fetched primary feeds for all 380 EPL fixtures and 144 Champions League league-phase fixtures: participants, rounds, UTC kickoffs, 50 EPL results and 18 UCL results. All eight basic table statistics agree for the 20 EPL and 36 UCL rows. This is reconciliation evidence, not cross-sport certification, independent truth verification or proof of long-term availability.

The isolated trial consists of `scripts/compare-football-data.js`, `scripts/lib/football-data-trial.js`, a reviewed map of 51 existing NS club identities and eight focused regression tests. It never publishes fixtures, changes Feed/Follow, schedules work or deploys. Delayed in-play statuses cannot become live scores. Unknown names, duplicate fixtures, malformed scores, incomplete seasons and unreviewed stages fail closed.

Simulated availability recovery succeeds for both competitions and preserves the published NS IDs. It only accepts a recent backup which agrees with every retained fixture fact; changed facts require normal reconciliation. Conflict, stale data or a second outage retains the exact last-good object and its original freshness. This recovery function remains a trial; it is not wired into a production loader.

`FOOTBALL_DATA_API_TOKEN` was stored as an encrypted repository Actions secret in `hartican/sportscal` at 02:46:32 UTC. It is not referenced by any current workflow, exposed to browsers or committed. The owner-only local configuration file is `/Users/jackhartican/.config/nothingsport/football-data.env` (0600). No Vercel configuration, active source or scheduler changed.

## Verification and evidence

Eight focused tests pass: complete season, true zero versus missing score, bad identity/season/stage/UTC, delayed-status safety, conflict detection, HTTPS secret boundary and serialized request budget, sanitized HTTP/timeout failures and conservative recovery. Syntax and diff checks pass; the actual credential is absent from changed source and saved artifacts.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-football-data-trial-2026-10-01/report.md`, `comparison.json`, `verification.json`, `verification.log`, and the initial/current API observations in that folder.

Run without contacting the provider:

```sh
node scripts/validate-football-data-trial.js
node scripts/compare-football-data.js --recorded --report-dir /Users/jackhartican/Documents/AI/Codex/nothingsport-football-data-trial-2026-10-01
```

Explicit authenticated trial (four calls, spaced at least 6.5 seconds apart; 15-second deadlines; no automatic retries or redirect following):

```sh
node scripts/compare-football-data.js --live --env-file /Users/jackhartican/.config/nothingsport/football-data.env --report-dir /Users/jackhartican/Documents/AI/Codex/nothingsport-football-data-trial-2026-10-01
```

The comparison requires separately captured fresh Pulse fixtures/table, OpenLigaDB UCL facts and current public NS snapshots in the report folder. Reusing recorded references later is not a fresh-primary verification.

## Recommended production boundary

Retain today's primary sources. This trial demonstrates useful compatible fallback data; it does not show superior accuracy or freshness. Before activation, integrate backup conversion and provenance into the existing canonical `update-cards.js` ownership path, add visible attribution to affected cards and retain loader/release recovery gates. Use the repository secret only in that existing workflow. Do not create a second refresh job, browser API requests, a live-score registration or a paid subscription. UCL final tie-breaks, knockout scope, Europa League and Australian viewing remain separate existing inputs.

[Official quickstart](https://www.football-data.org/documentation/quickstart/), [pricing](https://www.football-data.org/pricing), [coverage](https://www.football-data.org/coverage), [terms](https://www.football-data.org/client/register).

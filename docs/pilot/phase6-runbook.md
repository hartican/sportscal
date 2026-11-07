# nothingSports ongoing measurement and operational readiness

## Scope

This process measures the core sports-decision loop on demand. NRL and AFL are reference candidates. The narrow fixture-readiness check does not certify their full quality, other sports, or commercial readiness. It has no fixed-duration trial, elapsed-day completion rule, or automatic social-investment recommendation.

Signed-in measurement participation starts automatically and is disclosed in Settings. A user can opt out at any time; signed-out and opted-out use remains fully functional and sends nothing.

## Release readiness

Before each release:

1. Follow the scoped checks in [delivery practices](../delivery-practices.md) and the required production workflow. When refreshing data, use the single canonical `node scripts/update-cards.js` path.
2. Run `node scripts/verify-pilot-readiness.js` and require 100% renderable current/next-round AFL and NRL fixtures, fresh canonical and published snapshots, all nine NRL finals slots matched to reviewed schedules, and zero overdue supported results.
3. Run the relevant regressions and required release gates; do not repeat unchanged checks without a reason.
4. Confirm the production alias serves the intended shell and product-events contract before claiming production proof.

## Measurement report

Run `supabase/nothingsports-pilot-readout.sql` as a Supabase administrator whenever a product decision needs current evidence. Export the rows as JSON outside the repository, then run `node scripts/evaluate-pilot-readout.js <readout.json> --readiness=<readiness.json>`.

The operator summary requires the explicit successful readiness verdict as well as coverage/result counts. A missing verdict or stale snapshot remains attention required even when counts are 100% and zero overdue; old input exports need a fresh readiness report. This is an operational fact check, not a minimum cohort-size gate.

The export uses a rolling 28-day window, not a completion timer. Useful return is the share of users with a `fixture_check` or `watch_decision` on at least two distinct Sydney calendar dates, among users with at least one such date. Counts and the window accompany the percentage. This is not D7 retention, verified Australian residence, or verified invited-cohort membership; owner activity may be included. Missing metrics and zero-denominator rates stay null; measured zeros stay zero.

The report keeps weekly TSDR, full-fixture adoption, external cross-checking, missed-fixture reports, feed density, trust confidence, prompt burden, spectacle-rating completion, and curator/hybrid/completist segmentation. Pulse responses are grouped by explicit `surveyVersion`.

### Invited-account selection — 4 October 2026

Use the existing reporting command to prepare a private, read-only variant of the same aggregate SQL when invitations/admissions are authorised. The unmodified SQL remains an all-measured-account report. Survey segments do not establish invited membership, and owner/test activity must not be presented as invited-user demand.

The private selection JSON has exactly `schemaVersion: "pilot-cohort-selection.v1"`, `reviewedAt` (UTC ISO), `members` (objects with `accountId` and actual pilot `joinedAt` UTC ISO), and `excludedAccountIds` (explicit owner/QA UUIDs). Review the account mapping and admission evidence alongside the existing invitation record once; do not infer either from a sporting follow or survey answer. Up to 100 members and 100 exclusions are supported. Exclusions take precedence over membership. An empty, duplicate, malformed, future-dated or wholly excluded selection is rejected. No actual selection or invitation is created by the shipped tool.

Keep the selection outside Git. Prepare with `node scripts/evaluate-pilot-readout.js --prepare-cohort-sql=/absolute/private/selection.json --output=/absolute/private/new-cohort.sql`. The parent directory must exist and the output filename must be unused. The command prints counts only, writes mode 0600, refuses Git checkouts and never executes a database query. The SQL contains account IDs: keep it private and use the existing Supabase administrator access. It creates no table, function, view, policy or job. Each member's pre-joining events are excluded before every aggregate, as are owner/QA and nonmembers.

Export only the resulting aggregate rows, then use `node scripts/evaluate-pilot-readout.js /absolute/private/aggregate.json --readiness=/absolute/private/readiness.json --require-invited-cohort --output=/absolute/private/new-report.json`. This fails for an unqualified all-account export, mixed/missing population metadata, invalid counts or review after the aggregate observation. Supply the original aggregate export, not a previously rendered scoped report. The qualified report records selection fingerprint/date, configured/allowed/measured account counts and explicit limitations; it contains no account IDs. Its JSON output is private, new-file-only and outside Git. Default legacy reporting remains unchanged.

Configured accounts are not independently verified people, Australian residents or representative demand. A supplied joining date is an operator attestation, not a verified invitation or source-consent receipt. Signed-out/opted-out activity is not observed; account deletion removes the database events under the existing cascade, while the private admission record has its own retention/review responsibility. Keep real private exports out of published CTO evidence. The existing dashboard has not acquired an independent invited-membership qualification; use this evaluator for the scoped repeat-use claim. No new tracking, survey, automatic investment recommendation, population-size threshold or weekly membership-maintenance task is introduced.

Sample size is descriptive only. Missing observations remain unknown and do not prove repeat use or readiness. The report does not automatically recommend social or any other investment.

`watch_decision` is emitted only for a genuine Remind or Mark watched action. Passive card opens emit categorical `feed_action: open`, and swipes remain separate; neither fabricates a watch decision.

## Discovery measurement dashboard

The same administrator export can feed the Phase 6 breadth-versus-precision dashboard:

`node scripts/build-discovery-dashboard.js --readout=/absolute/path/to/readout.json --output-json=/tmp/nothingsport-discovery-dashboard.json --output-html=/tmp/nothingsport-discovery-dashboard.html`

The command combines aggregate behavioural rows with the current canonical marquee policy, broadcaster coverage queue, reviewed coverage decisions, feed-control defaults and confidence thresholds. Use private output paths for real aggregate exports. The canonical `node scripts/update-cards.js` path rebuilds and validates the checked-in no-user-data baseline at `data/measurement/discovery-dashboard.json` and `data/measurement/discovery-dashboard.html`.

Only aggregate rows belong in the dashboard input. Never commit an administrator export containing user IDs or raw product events. The SQL keeps `product_events` private from browser roles and provides aggregate discovery engagement, satisfaction, cold-start diversity and negative-feedback breakdowns by sport and competition.

The approved additive `product-events.v1` contract records fixed categorical actions for card opens, save/archive/reinstate, reminder changes, watched, follow/unfollow, swipes and feed-control changes. Event context is limited to canonical sport, competition/event IDs, recommendation class and cold-start state. The client cannot supply a user ID; the API derives ownership from the authenticated session. Free text, credentials, messages, contact information and precise location remain outside this contract.

`instrumentation_status: active` means the contract and administrator aggregate are ready. It does not imply a usable sample: until at least 20 discovery exposures exist, the dashboard must report `insufficient_data` and keep every tuning recommendation on hold.

Discovery success counts `feed_action` rows classified as discovery. Discovery negatives count only negative swipes explicitly classified as discovery. Ordinary unfollows remain neutral, including when they carry discovery context. Export version `discovery-aggregate.v2` is required before tuning; legacy or missing-count exports stay on hold. Sport and competition rates use discovery opportunity exposures in the same segment as the denominator. Archive is measured as feed activity but is not treated as annoyance. Observed cold-start breadth reports distinct sports and opportunities across the observation window. These counts cannot establish per-user first-ten diversity; that evidence remains unverified and its percentage stays null.

Each successful canonical scan records one coverage snapshot keyed by the report generation timestamp. One snapshot establishes the current missing-marquee rate; at least two independent snapshots are required for a trend. A zero baseline must never be described as a downward trend.

Tuning output is recommendation-only. Keep the current balanced default, 5% discovery mix, one discovery card in the first ten, 0.65 matching threshold and 0.92 auto-publication threshold until observed evidence supports review. Never write a dashboard recommendation back into production configuration automatically.

## Operations

The existing canonical update process should run at least twice daily during active AFL and NRL rounds and after major match windows. `node scripts/update-cards.js` remains the only cards, fixtures, standings and results refresh path.

If a refresh, readiness check, push, deployment or live-browser check fails, report that exact boundary and do not claim a release.

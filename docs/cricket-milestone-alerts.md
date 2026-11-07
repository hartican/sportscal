# Cricket milestone alerts

Approved 13 October 2026; implemented from the fresh-main snapshot ff8f53b9 in an isolated checkout. Release and database ownership stays with **Audit Sportscal architecture**, after its current repair and urgent tennis timing release. This document records implementation and gates; it is not production or physical-phone proof.

**Never miss a milestone.**

“Nudges for big moments in supported matches. Live coverage varies, and some moments may pass before an alert arrives.”

Cricket launches first. Low means reviewed records and competitive finishes, Medium adds centuries and five-wicket hauls, and High adds fifties/double/triple centuries. Rolling match/account caps and minimum gaps are respectively 1/3/60 minutes, 3/6/20 minutes and 6/12/10 minutes. Missing coverage resolves to Medium. Saved OFF choices survive. Advanced controls contain wider followed-sport consent, trigger-family overrides and optional quiet hours; the primary control is one switch with a Cricket coverage summary.

The complete eligibility, privacy and timing decisions are recorded in [Follow decisions](follow-decisions.md) and [backend efficiency decisions](backend-efficiency-decisions.md), dated 14 October. Existing Feed policy and source observations remain authoritative. This feature never forecasts a win or creates a Follow/Feed pin. Unknown provider availability keeps a scorecard action without a “Watch now” claim.

## Implementation boundaries

- `lib/cricket-scorecard.js` validates detail identity and batting totals, retains source-confirmed currently-batting flags, and binds explicit winning statements to the batting side. Missing remaining balls suppress limited-over chase alerts.
- `lib/cricket-current-results.js` shares the existing source pass: at most two due four-second details, one oldest-check slot and one proximity slot. The existing owner keeps its two workers, 45-second deadline, failure backoff and quiet cadence.
- `lib/milestone-rules.js` handles conservative thresholds, fresh transitions, records, Feed consent and spoiler-safe wording. Approaches and achievements have the same versioned identity. Fresh initial completed imports never create catch-up pushes. The engine handles verified transitions across innings without warning from an older innings.
- `lib/milestone-alerts.js` detects from accepted server projections after publication and dispatches only through the existing five-minute owner. It rechecks current source facts and account revisions, groups moments and devices, reuses erasure send admission, bounds rejection retries and treats uncertain outcomes conservatively. Per-pass account batches are restricted to the same at-most-20 selected moment identities and exclude previously handled work, so older moments outside the batch cannot hold later accounts behind the first 100. Source expiry and owner budgets still limit delivery.
- `20261013123624_cricket_milestone_alerts.sql` adds service-only RLS state, moment identities, receipts, rollout evidence, account reservations and installation claims. Public/anonymous/authenticated clients receive no table or RPC grants. One private scoped registration reader uses Auth; the service role receives no general Auth-table reads. Recipient-owned rows cascade on account erasure. Every new child reference has a leading-key index for bounded retention and account/device erasure. The existing inbox-maintenance RPC retains its deployed body and also prunes milestone rows after 30 days, including while feature mode is off.
- The deferred UI owns settings, match mutes and exact routing. The worker rejects expired milestone payloads and asks visible clients for a bounded exact-fixture acknowledgement. No account presence poll is added. Match Centre reuses verified provider controls and its existing owner-scoped disposable cache for an explicitly labelled unavailable-source landing.

## Reviewed record watchlist

`data/canonical/cricket-record-watchlist.v1.json` intentionally starts empty. There is no reviewed active record entry in this implementation, so ordinary cricket milestones do not imply record coverage. Add an entry only after verifying its evidence and exact fixture/player mapping; at most five active entries are accepted.

Each entry requires `recordId`, `fixtureId` (canonical CA ID), `playerId`, `format` (`test`, `odi`, `t20`), `metric` (`runs`, `wickets`), integer `baseline` and `target`, `baselineExcludesFixture: true`, `baselineCheckedAt`, exact `fixtureStartAt`, `expiresAt`, `sourceUrl`, `title`, `reviewed: true`, `reviewedAt`, and `evidence.baselineUrl`/`evidence.targetUrl`. The baseline observation must precede the fixture. Verified current-fixture contributions are added once per innings, including source-confirmed did-not-bat zeros. Missing contributions, unsupported formats and expired entries cannot alert. Tests use explicitly controlled entries, not publication records.

## Coordinated rollout

1. Integrate scoped source commits after urgent timing; reconcile shared source, preferences, Match Centre, dispatcher, worker and build changes against that release's new main. The separate renderer repair beea3ce8 may be assessed earlier.
2. Rebuild `build-fantasy-ui.js` and the canonical `build-app-shell-runtime.js` before publication. The latter also compiles `match-centre-ui.source.js` and the milestone UI/preference model through `build-deferred-sports-ui.js`. Generated bundles and shell versions belong to the release owner. Cache query values in the source checkout are provisional, not reserved release versions.
3. Apply the additive migration through the release owner. Default environment mode is off; the database rollout row starts disabled. Deploy the exact published snapshot through normal gates, then select shadow mode using the existing owner. Do not create a scheduler or run an independent dispatcher.
4. Observe an actual live innings and natural source/dispatcher passes. Retain accepted fixture clocks, detected identities, dispatcher shadow rows and failure/expiry evidence. Controlled replays cannot satisfy this step.
5. On Jack's existing iPhone Home Screen app, sign in and enable system alerts. In Notifications → Advanced milestone controls, press **Send milestone test**, close the app during the eight-second delay, then tap the labelled push. Verify receipt with the app closed, exact Match Centre expansion, Results privacy and provider/scorecard actions. The test selects an actual retained supported fixture; it does not change Feed or establish automatic detection proof.
6. Keep the existing MATCH_CENTRE_ENABLED flag true for the landing. Only after both gates have dated evidence may the release owner record rollout timestamps/evidence and enable the database gate plus live environment mode. Replace the staged “Not sending yet” copy through the checked live-enablement app release; generic dispatcher health or a test receipt cannot establish milestone readiness. Keep GitHub, database, Vercel READY/SHA, browser rehearsal and physical-device evidence separate.

The existing dispatcher remains the only automatic push owner. The explicit test is a bounded request with installation verification and the existing erasure guard. `api/notifications.js` has a 30-second request budget for that delay; there is no test cron.

## Verification

Normal production QA includes `validate-milestone-alerts`, `validate-milestone-source-budget`, `validate-milestone-database`, `validate-milestone-dispatch`, `validate-milestone-worker` and `validate-milestone-test`. Existing Follow, backend, notification, erasure, source, viewing, exact-byte/cache and release gates remain.

Browser rehearsals are `validate-milestone-browser`, `validate-milestone-offline-browser` and the existing Match Centre detail suite, in Chromium and WebKit. The API-outage rehearsal retains an online shell; installed upgrade/cold-offline and physical-phone proof remain separate release gates. Local evidence lives at `/Users/jackhartican/Documents/AI/Codex/cricket-milestone-alerts-20261014`.

Later source-validated candidates include racing's final ten laps, explicitly reported top-five incidents, safety cars and reviewed victory records; rugby's close half-time/late one-score situations and extra time; football's late equaliser, shootout and verified hat-trick opportunity; deciding-set tennis; close final-two-minute basketball; and late golf contention. Explicit source evidence is required for incidents and phases. Position changes do not establish crashes, point differences do not establish tries, and periodic checks cannot promise brief match-point opportunities.

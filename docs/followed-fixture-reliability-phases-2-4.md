# Followed-fixture reliability: phases 2–4 handoff

Implementation: 8 September 2026, `codex/followed-fixture-reliability`, based on `5a5ffe6809c80aefdd256ca22996c6a6dbf0b8f7`. Shell 246. See the [approved plan](followed-fixture-reliability-plan.md), [phase 1 history](followed-fixture-reliability-phase-1.md) and [source research](source-coverage-research-2026-09-08.md).

This is an implementation and local-verification record, not proof of production activation. The user authorised GitHub push and Vercel deployment; production versus preview was not specified. The safe release target is the feature branch and a preview. Main, production secrets and the live database remain unchanged until production activation is authorised.

### Subsequent authorised activation

The user subsequently authorised main, database and production activation. Main was fast-forwarded to `2b79e21`; both migrations applied successfully and the production-candidate ladder returned the three existing public profiles. The first protected source refresh succeeded for eight sources but exposed AFL/AFLW round discovery assuming a `roundNumber` absent from published cards. The live alias was held while this was corrected: resolve saved labels against official round metadata and include the official current round neighbourhood. Canonical AFL/AFLW/NRL outputs also explicitly retain their Feed sport key, display name and live scores. A new public-adapter regression is wired into the canonical validator list; real read-only source probes returned 8 AFL, 27 AFLW and 204 NRL records. Final deployment/alias and scheduler results must still be verified independently.

## Delivered in this pass

- Common Follow policy across Feed, Events, Schedule, server Feed and calendar: sport finals/marquee, senior international Rugby/Cricket including women, F1 championship sessions, WRC rounds, MotoGP races and SailGP meets. Tennis singles quarter-finals onward and doubles finals use structured format/round fields. Explicit team/athlete follows are additive, source-backed event follows bypass Australian scope, explicit mutes win, confirmed exclusions override provisional roster inheritance. Ratings and legacy stakes cannot grant or remove admission.
- Settings > All Followed, grouped by sport/competition/team/athlete with collection origins. Domestic/international directories sort followed-first. Australian discovery is hidden for Australian domestic team codes where it adds no useful distinction.
- First-party Cricket Australia and Rugby Australia adapters, verified women's identities, provenance and retained snapshots. The canonical `node scripts/update-cards.js --coverage --local-only` refresh succeeded with 19 source fixtures, 33 participant identities and no failed sources.
- US Open refresh now keeps published TBC opponents and unknown nationality, and isolates optional parse failures. A missing flag had been rejecting the entire new draw. The successful official refresh contains 799 matches, 108 more than the retained 691-match snapshot. The public validation contract accepts minimal cards instead of reinstating a rich-metadata requirement.
- Versioned athlete participation/history contract and fixed Antonelli, Russell, Hamilton, Piastri and Verstappen pilot. Verified GT/NLS/Nürburgring history and the published September NLS calendar are in the library; tests, ownership and unconfirmed future participation are not treated as race entries.
- Shared exact/estimated/date-only/unknown timing with source provenance and Sydney chronology. Same-court tennis estimates use match format, session order, not-before bounds and actual progress. Seven-local-calendar-day active retention handles daylight saving and ongoing multi-day events without deleting season archives, voting ledgers, follows or subscriptions.
- Shared Feed/Event fixture renderer, top-left expand/minimise glyph, championship-scoped marks, event caption, identity-deduplicated player names and flags on the right; no Russian flag. Real-user phase averages are visible from one vote, with five interactive flames, contributor summary and tags on separate lines. Sealed pre/post-event votes remain sealed; live ratings remain editable.
- Settings/calendar order, mobile toolbar distribution, explicit Results ON/OFF with an OFF-to-ON spoiler confirmation, bottom-right Jump to Now and global expand/minimise. Chronological tabs open at current activity; live updates preserve reading position.
- Centred safe-area calendar dialog, top-right X, transactional batched selection with cancellation/rollback and a single final commit/render. Ten-thousand-record unit tests cover yielding and cancellation; responsive browser checks exercise the actual bulk buttons.
- Lightweight shared live snapshot adapters, protected refresh route, database leases/version history, last-good preservation, stable revisions/ETags and browser minute/foreground revalidation. Due intervals are 60 seconds live, five minutes near start and hourly otherwise. A malformed record no longer blocks other valid new fixtures, and status-only updates preserve known names/sport identities. Missing records are not deletion signals.
- One-page, read-only Nothing Score ladder with public identity, avatar/initials, distinct voted fixtures, voting-only points, settled eligible-vote efficiency, stable rank, pagination, viewer highlight and off-screen frozen viewer. Friendly guest, missing profile, expired session, retry and direct-file states replace a raw load error. Reading the ladder does not award points or load reward dashboards.

## Local verification

35 focused checks passed: fixture visibility/snapshot, all-sport reconciliation, source coverage, US Open fail-soft, timing, Follow parity/resolver/first/surfacing, athlete participation, live fixtures/API, calendar batching/API/rework/Now affinity, NSC/client flow/crowd averages, card polish, major events, retired stakes/enrichment/server Feed, compatibility ranking, fixture contract, canonical orchestration, performance/startup budgets, Schedule UI, mobile brands, Feed reliability and UI foundation/reliability.

The two database migrations execute in local PGlite/Postgres tests. Fixture storage tests cover service-only access, anonymous/authenticated denial, fenced leases, unchanged revisions and failed-source preservation. Ladder tests cover voting-only totals, distinct fixtures, settled efficiency, pending/unversioned exclusions, repeated live votes, hidden profiles, independently returned viewer rank, absence of private account IDs and read-only behaviour.

Local Chromium suites use isolated preferences and intercepted external API actions. They cover cold Monza visibility, partial/failed sources, US Open, F1-not-WRC Schedule, minimal renderer fallback, Rugby/Cricket cards, All Followed, athlete history, live arrivals/postponements/failure retention and preserved scroll at 390/1280 widths. Shared UI/calendar/ladder cases cover 390/768/1280 widths, including spoiler cancellation/confirmation, calendar bounds, real bulk buttons, pagination, retry, frozen viewer, flames, one-vote averages, separate tag row, player deduplication and no horizontal overflow.

The installed-browser regression passed shell 244→246 with saved follows/display settings preserved, optional failure tolerated, required-runtime failure retaining the good shell, offline recovery and coalesced resume upgrade. It caught a release bug: cache/page version 246 but worker message version 245. Correcting the worker reply fixed the real upgrade test; `validate-startup-budget.js` now checks all three identities before a browser run.

Critical initial requests remain five, compressed growth about 1.0% against the actual parent (unchanged 1.25% cap); precache is 2.99 MB (3 MB cap). No new device load-time or physical iPhone/push-delivery result is inferred. This pass ran the canonical coverage mode, not the complete all-sport editorial refresh pipeline.

## Activation still required

The following files are prepared and tested but have **not** been applied to the live Supabase project:

1. `supabase/migrations/20260908093906_live_fixture_snapshots.sql` (applied; filename matches the live migration history)
2. `supabase/migrations/20260908093940_nothing_score_ladder.sql` (applied; filename matches the live migration history)
3. `supabase/enable-live-fixture-cron.sql`, after securely configuring the protected endpoint URL and secret in Vault.

Vercel inspection found service/backend secrets in Production only. `FIXTURE_REFRESH_SECRET` is not configured. A preview therefore verifies packaging/UI, not live ladder data or automatic fixture freshness. Do not copy production secrets into Preview, run live DDL, create Vault entries, enable Cron, merge main or promote production merely to make preview tests pass.

After production authority: recheck main for intervening work, review/apply the two new migrations with the Supabase migration API, configure a strong refresh secret in the target Vercel environment and Vault without logging it, deploy an immutable Git snapshot, then enable the minute Cron. Verify service-only permissions, protected refresh rejection, actual successful scheduler executions, a changed source revision arriving in the browser without deployment, read-only ladder access and exact READY deployment `releaseGitSha`/alias. Existing NSC vote functions were inspected read-only and already match the current participation rules; no speculative reapplication of older SQL is required.

## Honest coverage limits

- All 27 Schedule codes reconcile through the known candidate catalogue (3,844 fixtures after this refresh). This proves known-record transport, not completeness of outside calendars. Cricket/Rugby remain partial; the complete 6–7 September Cricket inventory was not reconstructed from identifiable match records. Several other sports still have partial or empty upstream schedules.
- Current live adapters cover the inspected CA/RA sources, AFL/AFLW, NRL, F1 results, Premier League and US Open. They are not a complete live-result service for every supported code. Rugby discovery is a validated set of match pages, not a proved all-competition crawler.
- Five actual historical cross-discipline entries are verified. No future race entry for a pilot athlete was verified in this bounded scan. The September NLS calendar must not surface as a Verstappen fixture unless a source confirms his personal participation. Automatic athlete entry-list discovery and later cricket/women's/snow-sport adapters remain future work.
- Controlled consensus tags work from source-backed structured facts and accept sourced medium/high-confidence editorial annotations. A new autonomous AI/third-party consensus ingestion pipeline is not implemented here. Legacy serialized stakes fields remain readable for compatibility; they do not decide current Feed admission, active ranking or the shared card rating display. This is not a claim that every historical artifact has been scrubbed.
- Local browser emulation is not the user's signed-in account, a physical iPhone safe-area test, or physical reminder delivery. Direct `file://` cannot provide hosted NSC APIs; it now explains that boundary clearly.

## Repeat checks

```bash
node scripts/update-cards.js --coverage --local-only
node scripts/build-app-shell-runtime.js --check
node scripts/build-athlete-participation.js --check
node scripts/build-follow-directories.js --check
node scripts/validate-fixture-snapshot.js
node scripts/validate-all-sport-visibility.js
node scripts/validate-follow-policy-parity.js
node scripts/validate-live-fixtures.js
node scripts/validate-live-fixture-api.js
node scripts/validate-calendar-selection.js
node scripts/validate-major-events.js
node scripts/validate-us-open-fail-soft.js
node scripts/validate-feed-performance.js
node scripts/validate-startup-budget.js
git diff --check
```

For local browser scripts set `PLAYWRIGHT_MODULE` to an available Playwright installation and serve the checkout on `127.0.0.1:8765`. For the two database scripts set `PGLITE_MODULE` to an available `@electric-sql/pglite` installation. The installed upgrade test accepts `PWA_BASELINE_SHA=5a5ffe6809c80aefdd256ca22996c6a6dbf0b8f7`. Screenshot files in `/tmp` are temporary QA evidence, not tracked assets.

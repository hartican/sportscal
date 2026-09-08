# Sportscal: followed-fixture reliability and unified UI

> Follow admission amendments (8 September 2026): [follow-decisions.md](follow-decisions.md) supersedes the women’s Cricket and early-round Tennis discovery rules below.

Authoritative contract: the implementation plan approved in this task on 8 September 2026, captured below. Implement in independently verified release units. Do not report later phases complete from an earlier phase's checks.

## Project and release contract

- App: Nothing Sport / Sportscal; repository: https://github.com/hartican/sportscal.git.
- Vercel project: sportscal (`prj_NAMl47QVLbPUfsMmap59JIpchOPD`).
- Implementation starts from current origin/main in an isolated `codex/` branch. Preserve newer Follow, NSC, navigation and installed-shell fixes and unrelated work.
- Canonical refresh entrypoint remains `node scripts/update-cards.js`; no independent sports/standings refresh paths.
- Release order: fixture reliability/routing first, follow/coverage/live-data second, shared UI/calendar and simplified NSC in subsequent verified releases. Separate local, GitHub, READY deployment, releaseGitSha, public alias and actual browser/device proof. No automatic shared-main merge or production release without the release authority required by the task.

## Phase 1: protect fixture visibility and correct championship routing

Invariant: every known fixture matching a user's follow rules produces a visible card even when optional data/presentation fails. Core identity, title, best available time and status are independent of enrichment. Participant count, imagery, provider availability, editorial and ratings must not erase eligible fixtures. Preserve explicit mutes and intentional Events-only dismissals.

- Regress Monza on 6–7 September: Follow F1 must include a Grand Prix without a populated driver list.
- Keep last-known-good fixtures through incomplete/failed source responses. Missing records in partial responses are not deletions. Render a minimal card when enrichment/rendering fails; isolate individual bad records.
- Retain cancelled/postponed fixtures with their status during the retention window.
- Give F1 its own Schedule identity; never substitute the parent Motorsport/WRC schedule. Resolve championship branding and viewing providers from canonical identity, including Sardegna.
- Reconcile source calendars, normalised fixtures, eligibility, API output and rendered cards. Audit Rugby/Cricket and all supported sports, including AFL/NRL/AFLW/football, for upstream gaps and downstream losses.
- US Open and NSC loaded in a fresh guest session during planning; saved-account and old installed-app failures remain acceptance cases, not resolved issues.
- Acceptance: focused policy/API/rendering regressions; fault injection; all-sport coverage audit; relevant validators; responsive browser tests; diff check. Do not call the phase complete while an acceptance check fails.

## Phase 2: common follow policy, cross-discipline identity and live fixtures

Use one client/server eligibility policy and stable fixture identity, with additive follows and semantic deduplication. Schedule remains a complete competition directory; Events contains tournament parents and eligible children.

- Sport only: finals and explicitly classified marquee fixtures. F1 includes every Grand Prix, sprint, qualifying and sprint qualifying, not practice. WRC includes all senior rounds as one multi-day card per rally.
- Rugby/Cricket: all senior internationals including women; domestic finals/designated marquee unless a team/athlete is followed.
- Tennis sport or tournament: singles quarter-finals onward, doubles finals and source-backed standout early matches. Explicit event follows bypass Australian filtering but stay marquee-only. Direct athlete/team follows add their other fixtures.
- Team: all its fixtures. Athlete: all fixtures involving the athlete, including source-confirmed other disciplines.
- Australians: Australian-participant discovery without a marquee requirement. Constrain broad sport discovery, not explicit team/athlete/event follows. Hide the filter in Australian domestic team leagues where unhelpful. Use entrants/selected squads/current provisional rosters; confirmed exclusions supersede provisional inclusion.
- Remove stakes from active generation, inclusion, ranking, display and editorial dependencies. Classification is explicit competition/round rules plus maintained source-backed marquee designations; ratings never gate cards.
- Preserve collection memberships, ranking-independent watch lists, migration aliases and explicit mutes. Settings > All Followed groups sport > competition/event > team > athlete, with collection origins. Teams/players sort followed-first inside domestic/international groups.

Cross-discipline pilot: canonical athletes with aliases, dated participation and sourced history/records. Seed Antonelli, Russell, Hamilton, Piastri and Verstappen, independent of future ranking changes. Scan published calendars/entry lists, include verified NLS/Nurburgring/endurance and other discovered entries. Ownership/ambassadorship/expressed interest is not participation. Historical appearances stay in profiles/Schedule archives, not the current Feed. The same model must support later cricket, women's codes and snow-sport adapters; do not claim worldwide coverage before adapters exist.

Live data: add a lightweight mode to the canonical orchestrator and shared adapters. Store versioned snapshots in Supabase. A protected server endpoint invoked by Supabase Cron/pg_net every minute refreshes due sources: about 60 seconds live, five minutes within 24 hours of start, hourly otherwise. Coalesce concurrent work, respect source limits and preserve good records on partial failure. Feed/Events/Schedule/calendar share revisions and revision-aware validators. Active clients revalidate each minute/on foregrounding without resetting scroll. No per-minute deploy/editorial rebuild. Server secrets and writes stay service-only.

Timing: exact/estimated/date-only/unknown precision with provenance. Prefer official, then reputable published schedules, then sport-format estimates. For follows-prior-match, use same-court dependency, not-before bounds and actual progress; initial tennis defaults are 180 minutes best-of-five singles, 105 best-of-three, 90 doubles, plus ten-minute changeover. Approximate display/reminders update idempotently; never pass an estimate off as confirmed prediction eligibility. Remove “opinion only, no foresight points”; retain “Start time unconfirmed”.

## Phase 3: common cards, navigation and calendar

- Shared Feed/Event renderer and compact/expanded/incomplete/results presentation. One top-left diagonal expand glyph switches to minus; accessible labels/theme colours.
- Centred official event logo with bold uppercase event name beneath. Team fixtures retain opposing logos/names. Nationality flag immediately after each player, no Russian flag; deduplicate by participant identity, including doubles/results.
- Replace Feed/Follow sport glyphs with properly scoped official assets, reusing repo assets. Missing assets use text, never another championship's logo.
- Watch/provider row has five interactive flames instead of blocks/signal marks and phase-appropriate TAP TO RATE / HOW'S IT GOING?. Next line: real contributor count, expect/are/have-rated wording and mean. Next line: user-rating and consensus tags.
- Current phase average uses each real user's latest valid vote, visible before voting and from one vote; no seeds/minimum warning/fabricated zero average. Round to Boring/Mid/Interesting/Cooking/Epic. Preserve sealed heat/impact, editable live votes.
- Controlled consensus tag vocabulary from structured facts and AI-assisted reputable reporting: authoritative source or corroboration; provenance internal, no confidence clutter. Tags never gate fixtures.
- Settings immediately left of calendar sync. Mobile toolbar distributed evenly with isolated Results hit area. Label Results ON/OFF; OFF-to-ON requires spoiler confirmation, cancel remains OFF.
- Bottom-right floating global expand/minimise plus Jump to Now, removing separate Today/Now controls. All chronological pages open at Now/current activity/next fixture; refreshes preserve the reader's position. Stable chronological ordering uses exact/estimated/date and identity.
- Calendar drawer centred with iPhone safe areas and top-right X. Bulk selection uses lightweight ID batches, progress/cancel, one persistence update/final render, rollback selection on failure.
- Prune completed cards older than seven local calendar days from active Feed/calendar caches in every mode; ongoing multi-day events stay. Preserve source season schedules, results, scoring ledgers, follows and calendar subscriptions.

## Phase 4: one-page Nothing Score user ladder

All-time columns: rank, photo, name, handle, distinct fixtures voted on, voting points, efficiency. Dedicated read-only paginated projection, independent of reward sync/campaigns/crowd fixture ranking. Include voting participation/foresight bonuses, exclude watch/like/tag rewards without deleting historical ledger data.

Efficiency = earned points on settled eligible votes / sum of maximum points for those same votes. Current maxima: eight for scored pre-event predictions, two each live/post-event; old votes use recorded scoring version. Exclude pending/unscored predictions and unresolvable maxima; zero denominator displays a dash. Repeated live updates count once per fixture/phase. Total credited points may include participation before settlement; pending prediction is excluded from efficiency.

Order points, efficiency, distinct fixtures, stable identity. Viewer rank returned independently of pagination; highlight own row and freeze only when its original is off-screen. Open at top; stack name/handle on mobile. Handle guest/signed-in/missing profile/expired session/loading/empty/retry without leaking private account details. Protect projections with RLS/service-only permissions; reading the page never awards points.

## Verification and defaults

Frozen September dates; every supported sport/follow mode and overlap; exact/unknown timing, cancelled/rescheduled, multi-day, daylight saving and reminders; partial source/enrichment/image failures; API-to-DOM presence; saved account and old installed PWA; live revisions without browser/deploy; rating/efficiency edge cases; thousands of calendar selections with cancellation/retries; mobile/tablet/desktop and spoiler states. Browser safe-area emulation is not physical-device/PWA/push proof.

Written layout and selected answers govern: no mockup attachment was available. Existing Supabase is the backend default. Missing credentials/source access/scheduler capability are explicit release blockers, not grounds to claim degraded coverage/freshness complete.

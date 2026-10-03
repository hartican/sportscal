# Backend efficiency decisions

## EPL source pagination and season integrity — 3 October 2026

The existing official 2026/27 EPL loader is bounded to the four pages implied by 380 fixtures at its requested page size of 100. Validate each page's index, size, total and collection length before requesting another. Validate the complete collection's competition/season, positive unique source IDs, two distinct clubs, matchweeks 1–38 and all 380 unique directed home/away pairings. This does not require ten fixtures per played week or infer fixture dates; genuine reschedules remain eligible. Both the canonical cards owner and existing live source reuse this loader. The existing 20-second request duration is also enforced as a fixed network deadline: socket activity cannot keep a page alive indefinitely. No retries, longer deadlines or increased source budget are added. Last-good/validated delayed-backup behaviour, source clocks and source owners remain. A malformed collection must not reach the writer or become a successful live-source verification. No scheduler, request path, database migration, new provider or subscription is added. Regression: `validate-premier-league-source-shape.js` through the existing Football schedule gate, including an active incomplete response, actual temporary-writer retention after primary and backup failure. The current four-page/380-fixture and separate official Fantasy agreement is dated audit evidence, not certification or an unattended source refresh.

## Private editorial run measurements — 3 October 2026

List/research invocations record aggregate counts and CLI runtime in the existing private check report, with no extra service calls, database writes, scheduler or owner tracker. Preserve prepared CAS operations; distinguish prepared updates from successful direct-service writes, and do not infer connector commits or production publication. Failed inventories keep unknown counts. Raw errors, private copy, votes and fixture identities stay out of measurements. External model tokens/research time and cash cost remain unavailable. Eligibility, due cadence, source budgets and release gates are unchanged. Regression: `validate-editorial-run-readout.js` plus existing control snapshot/SQL and adaptive editorial gates.

## SailGP reviewed calendar ingestion — 3 October 2026

The authorised venue rollout adds reviewed organiser calendar facts to the existing canonical cards owner, using committed edition-specific source snapshots. It makes no sporting provider calls, unattended site scraper, database writes or result/live integration. Calendar failures reject before writes, identical replays retain bytes, and changed existing dates require identity review. New reviewed source snapshots can enter through this owner; broader source permission and result certification remain open. Existing Geneva and result observation clocks survive. Regression: `validate-sailgp-calendar.js --published` and retained timing/Follow/source gates.


## Reviewed SailGP session timing — 3 October 2026

The existing canonical cards owner applies two dated official Geneva race-day windows to retained identities, with schedule observations separate from original result/source observations. Validate the selected documents before writing; identical timing reruns preserve bytes, and later real timing observations win. The ordinary requested-sport projection retains that provenance. A bounded `--sailgp-quality` route uses the same owner and projections, with no provider fetch, scheduler, database write or automatic source adapter. Future Dubai/Abu Dhabi race-day clocks remain unresolved; event envelopes cannot establish individual sessions. SailGP publication is partial until evidence supports completeness. Regression: `validate-sailgp-quality.js --published`, existing source/projection contracts and real shell upgrade checks. Source permission and broader competition acceptance remain open.

## Live FPL evaluation — 2 October 2026

The existing protected two-minute fixture scheduler owns one optional FPL source. Fetch bootstrap and fixtures once each per due cycle: 30 minutes ordinarily and two minutes within six hours of a future submission cutoff. Accept verification for at most 60 minutes ordinarily or ten minutes near cutoff. Source failures never renew freshness. The existing lease, bounded two-worker/runtime limits, last-good JSON storage and explicit withdrawals remain; no scheduler, database migration, provider fetch from clients or per-card interval is added.

The operator explicitly enabled ongoing evaluation separately from provider approval. Public source metadata exposes evaluation/approved/disabled without secrets; successful verification and access status affect only opt-in validators. OFF ordinary clients receive no fantasy enrichment. Preserve default/follow/notification boundaries in the Follow decision record. Regressions: fantasy source, API and rollout validators plus existing backend efficiency and database lease checks. Actual natural scheduled publication and live countdowns are separate acceptance evidence from recorded source tests.

## Owner content workspace — 2 October 2026

The single owner uses private post tasks for editorial 5/5 fixtures, real latest-per-account pre-match averages >=4.8, and published Major Events. This does not change public Feed admission or rating consent. Copy comes from published Feed/Events editorial without paid AI or provider scraping. Private community aggregates do not escape via unpublished public Live fallbacks; an explicit Publish live revision controls public presentation.

Preview posts are 72h before; day-of is 09:00 Sydney or 2h before kickoff at/before 09:00. Date-only posts use labelled estimates, never invented sporting start times. A newly discovered missed preview merges into day-of. Existing drafts and manual edits survive source reconciliation; changed suggestions are shown for review. Editing and content handoff remain unlocked, revision-checked and autosaved.

The existing canonical `update-cards.js` workflow builds the comms source bundle. The existing five-minute notification dispatcher and private owner foreground read share a five-minute lease and six-hour/source-revision refresh gate. One bounded (100 max) service-only batch applies source changes without unchanged revision writes. No new cron, provider refresh, public polling or sending connector is added. Manual sync confirms one candidate per request. Post alerts require explicit device opt-in, fresh admin metadata and the shared erasure-aware send guard; at most two owner alerts per dispatcher invocation, leaving existing reminder batch limits unchanged. Before/due receipts prevent duplicate or uncertain-outcome retries. Mark posted, snooze and manual schedule changes use revision CAS.

The owner authorised removal of ended campaigns, their versions and exclusively owned media; active/shared references and historical delivery records remain protected. Shared brand/identity assets and active campaign revisions are not purged. Production target remains `nothingSport-recovery` only. iPhone Home Screen notification delivery needs explicit owner permission and a real-device test; browser emulation is not that evidence.

Regression: `validate-owner-content-workspace.js`, `validate-owner-content-browser.js`, marquee/admin/notification/erasure/bundle gates. Browser fixture tests use a synthetic admin client and never impersonate an Auth account.

## Reviewed past Rugby identity — 2 October 2026

One exact AU–South Africa fixture retains its curated ID and four reviewed RA/WR aliases. Read snapshots span both historical IDs in existing bounded queries; legacy requested response keys survive. A service-only readiness RPC gates mutations for this one past match until atomic ledger/rating reconciliation completes; other fixtures add no check. No provider refresh, polling, scheduler or reminder replay is added. Preserve each original credit row/day/category and all history; private rooms and saved state are not merged. Operator undo refuses newer activity or erased preimages. Deployment precedes reconciliation with a temporary per-fixture write hold. Evidence, migration, acceptance and regressions: [reviewed Rugby reconciliation](quality/rugby-identity-reconciliation-2026-10-02.md). This does not certify Rugby or increase MVP budgets.


## Explicit Cricket abandonment and settled observations — 2 October 2026

Cricket Australia's `isCompleted` closes abandoned records as well as played results. Accept explicit Abandoned result types only on a completed provider record; never infer this from prose or elapsed time. The shared identity/compact Match Centre observation permits a newer settled abandonment correction and protects it against later schedule/live overlays; older observations retain the prior facts. Abandoned fixtures stay outside Match Centre. Cards show Abandoned/Suspended, with accessible original Sydney scheduling, and neither state gains clock-derived Starts Soon/Live/Just Finished.

The single genuine CA40996 observation is published through the existing canonical `--coverage-live --live-coverage-snapshot=PATH` route. One record changes, all existing IDs/viewing/activity survive and the next replay changes nothing. A live API failure also established that a collection poll was replacing an older settled fixture observation. Settled overlays now retain the available original fixture date; explicit newer timestamped corrections still pass. Existing live-score fallback stays intact. The server source owner reuses the corrected parser on its ordinary cadence. No source, scheduler, request path, database migration, user scan at refresh, reminder replay or subscription is added. The read-only Rugby preflight is a one-off investigation; it is not in the refresh pipeline. Do not add the proposed Rugby alias until both durable activity ledgers remain readable and idempotent. See [the dated evidence record](quality/cricket-rugby-integrity-2026-10-02.md).

## NBL published status and unchanged finals — 2 October 2026

Extend the existing source-qualified match-status display to `competition:nbl`. After kickoff, unconfirmed or stale live status displays Awaiting match update. Explicit live status needs its actual published primary observation at or before now, within the existing 30-minute window. Completed results, pre-start timing and non-playing states remain intact. The canonical NBL card adapter carries that observation through the existing quick patch and Schedule projection; no live source, scheduler, request, database writer or per-user polling is added. Metadata-only repeated checks preserve original published observations; this is honest saved-data presentation, not real-time NBL delivery.

The canonical scoped rehearsal exposed 32 record patches across incoming/published Feed for 16 unchanged finals, caused solely by result-source check dates. Exclude that observation date from quick semantic comparison alongside the existing volatile fields. Actual changed status, score or other facts still publish with their real dates. A repeated canonical NBL invocation now returns no changes and retains sporting/generated data bytes. Regression uses the actual adapter/card/patch/identity/Schedule seam, fresh/stale/invalid/future status, zero scores, terminal continuity and unchanged live/final reruns in `validate-nbl-match-context.js --published`, already in the normal production gate. Reuse the existing status browser harness with `--nbl` and installed upgrade/offline checks. Full sport, permission and physical-device acceptance remain separate. See [the delivery record](quality/nbl-status-integrity-2026-10-02.md).

## Football quick refresh publication — 2 October 2026

Weekday EPL standings use the existing complete primary table adapter: one bounded request per invocation, original observations and last-good retention; no second scheduler. Generated standings receive a matching shell/script/worker epoch in the same release commit. The scheduled wrapper reads expected hashes from that published commit after automatic versioning, and still rejects wrong served bytes or a missing/wrong shell version.

Ordinary quick publication retains source-backed, spoiler-safe completed editorial only when fixture identities, participants, scheduling and results match its own pre-refresh surface. Changed finals, participants or kickoff invalidate retention; fresh computed stakes/intensity remain current. This replaces repeated manual editorial restoration without any source call, AI request, storage table or owner decision. Exceptions and partial tournament hydration remain in the existing readout. One successful data publication is not sustained unattended-operation certification. See [the dated source/cache record](quality/football-freshness-2026-10-02.md).

## LPGA completed classifications — 30 September 2026

The existing full golf owner and weekday quick refresh reconcile up to four already-known LPGA tournaments ending within the past 14 days, after a conservative 36-hour allowance from the end-date midnight UTC for the final local day to finish. Each uses one official leaderboard request with a 15-second deadline; there is no new scheduler, subscription or per-user request. Only Golf projections rebuild when facts change. Repeated identical results preserve bytes. This bounded recent window is not historical or worldwide LPGA coverage.

Completion requires the exact tournament ID and dates, one first-place player with a published positive award, complete rounds for every classified player, consistent stroke totals, unique provider identities and recognised result statuses. A populated live table or elapsed time alone is insufficient. The official settled-results payload has no explicit finality flag: these publication signals are the acceptance contract, and later official corrections remain possible. Advertising rows are excluded; malformed sporting rows reject the observation. Errors retain prior results and appear in the existing refresh failure report. Later pairings cannot regress a confirmed classification; participation freshness remains separate.

Scoped canonical command: `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --lpga-results`. Regression: `validate-lpga-results.js`, existing participation and quick projection tests; presentation: `validate-lpga-results-browser.js`. No Feed admission or follow rules change.

## F1 session result tables — 30 September 2026

The existing F1 result owner now reads six-column numbered practice tables and routes sprint qualifying to its own eight-column result page. Practice remains outside Feed admission; its source-backed results are published to F1/Motorsport Schedule. Practice uses fastest-driver wording, not race-win wording. Existing identities and result privacy rules remain intact. Quick refresh preserves full F1 tables and confirmed participant identities.

This uses the existing seven-day bounded fixture window and official results index, with 15-second request deadlines; no new scheduler, provider, subscription or per-user request. A practice is not considered for publication until 90 minutes after its known start and still requires a populated official table, at least ten unique drivers/numbers and resolved identities. This is a conservative delay, not an official session-finality flag; delayed or corrected official classifications remain a source limitation. Cancelled/postponed/abandoned events are preserved. Invalid table shapes or duplicates retain the prior event; unknown participants fail the refresh before file publication.

Scoped canonical command: `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --f1-results`. Regression: `validate-f1-session-results.js`, existing F1 Feed admission and storyline spoiler checks. Full sport certification is not implied.


## Daily shared-observation publication — 30 September 2026

Weekday quick refreshes now project the existing live owner's Cricket Australia, ESPN recent/history and World Rugby men's/women's XV/sevens observations into the saved Cricket/Rugby Schedule. The full Sunday source refresh remains authoritative for wider calendars. No source fetch, new scheduler, database write or account scan is added. The existing read-only `nothingsports_read_current_fixtures` RPC includes separately stored scores; reading the source arrays alone would omit those scores.

The read uses an explicit 12-source allowlist, stable source/fixture ordering and pages of 500, capped at eight requests per invocation. The observed export contained 1,287 rows (three REST pages); each daily quick refresh and production input verification uses that same bounded read. Page failures, duplicates, invalid identities/sports or exhaustion preserve the old saved coverage. Production verification is read-only and does not publish its result.

Only observations from the preceding 36 hours are projected; their original fixture timestamps remain intact, never replaced by poll or export time. Older observations cannot shift an existing fixture's kickoff. Shared reconciliation preserves completed results against stale near-source schedules and separately sourced viewing details. Missing rows are not deletions. Repeat identical observations and timestamp-only polls preserve bytes; only changed sport partitions rebuild. Transport/freshness failures appear in the existing quick-refresh failure report. This daily publication is not real-time delivery or exhaustive source certification.

Scoped canonical rehearsal: `node scripts/update-cards.js -p --local-only --coverage-live`. An explicit `--live-coverage-snapshot=PATH` can replay a saved read-only RPC export for reproducible local validation without credentials. It uses the same validation and age limits. Tests: `validate-live-coverage-publication.js`, `validate-live-coverage-browser.js`, existing quick projection scope and source coverage checks.


## Current cricket completed-results reconciliation — 30 September 2026

The existing `cricket-ca-current` owner reads the current calendar plus one completed-results page (13 records). For known unresolved CA fixtures whose scheduled end/start falls within the preceding 14 days, it can read up to six pages, at most once per six hours using the existing source discovery report. No added source, scheduler, subscription, AI call or per-user work. Additional result requests are at most one per ordinary invocation plus 20 extra per day for four full catch-ups; the existing dynamic refresh cadence remains authoritative.

Only explicit provider completion with a nonempty result and resolved participants is accepted. Exact overlapping cursor rows are deduplicated; conflicting duplicates, stuck pagination, invalid records and failed pages reject the observation, retaining last-good data. Unresolved IDs are recorded separately from transport failures and never completed from elapsed time. This is a bounded recent reconciliation, not exhaustive worldwide or historical coverage. The initial catch-up retained unresolved CA39484 (Lancashire–Durham); follow-up source investigation remains required.

Canonical scoped repair: `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --coverage --coverage-source=cricket-ca-current`. Regression: `validate-cricket-current-results.js`; presentation/spoilers: `validate-cricket-current-browser.js`. Shared current and completed records retain the same CA identities.


## Completed Asia Cup source — 30 September 2026

The fixed Women's Asia Cup 2026 source reads Cricket Australia's own completed-results API instead of the series page's empty upcoming-only embedded array. The official UI confirmed a 28 August–13 September tournament and resolved the final; two observed API pages return all 15 results. The adapter permits at most three pages of 13 records, rejects wrong competition/gender, duplicate IDs, unresolved participants, incomplete totals and failed pages, and publishes only the complete collection. Existing fixture identities and alternative-provider aliases survive. No new provider or scheduler is introduced.

This finished competition has a six-hour minimum live refresh interval, at most 12 requests per day at the three-page ceiling (eight for the observed two-page result), replacing failed half-hour retries. Last-good records survive provider failure. The canonical scoped command is `SKIP_RELEASE=1 node scripts/update-cards.js -p --local-only --coverage --coverage-source=cricket-ca-4710`; it refreshes only this source, preserves other source statuses and rebuilds Cricket Schedule/Inspector projections. It makes no AI calls. Do not use the completed-only adapter as a generic future tournament feed.

Schedule merging keeps richer viewing metadata but does not let it replace a newer official confirmed result with an older scheduled state. Source timestamps and result evidence are required; postponed/cancelled states are not overridden by this fallback. Regression: `validate-asia-cup-source.js --published`, existing Inspector contracts and `validate-asia-cup-browser.js`. Full cricket quality and commercial-source permission remain separate gates.

## Stable live fixture creation times — 30 September 2026

AFL, AFLW and NRL live adapters pass the prior snapshot's valid creation times to the existing canonical parsers, keyed by exact fixture ID. A known fixture keeps its first observation; a newly discovered identity receives the current check time. Updated/source-check timestamps still advance. The shared content hash continues to detect creation-time and real fact changes; no global creation-time exclusion is added. No database migration, history deletion, polling or scheduler change is required.

The 30 September read-only follow-up verified the EPL fix in production: zero EPL revisions in the latest 48 hours while successful checks continued. Across sources, comparable 48-hour snapshot counts fell 1,010→369 and stored payload additions 91,877,920→39,467,752 bytes, with retention and other releases as confounders. The latest two AFL/AFLW/NRL revisions differed only in generated creation/update/source-check timestamps. This adapter repair addresses that demonstrated cause. Regression: `validate-live-afl-adapter.js` exercises actual source adapters twice at different times for all three sports, new identity creation and meaningful fact hash changes. Production deployment proof alone does not prove the subsequent storage-growth trend.

## Football reminder schedule reconciliation — 28 September Sydney

The sole five-minute notification dispatcher checks at most 20 pending EPL/UCL/Europa match-15 reminders, oldest schedule check first. One indexed service-only inventory RPC is added per run; an empty result does not load the fixture catalogue or write reconciliation. A nonempty batch uses one bounded update RPC and the already-bundled published Football projection. No new provider call, AI work, cron or polling loop. Existing push claim batches remain five. The hard ceiling is 5,760 small per-reminder check updates per day (20 × 288); these update existing rows and do not append fixture history.

Identity and opt-in persist when kickoff moves in either direction. Unknown, postponed, cancelled, completed, live or passed fixtures are held without inventing a new start. Push claims and newly created inbox entries share the same predicate: confirmed future kickoff, matching verified stored start and a check within ten minutes. Client updates and cancellation win through compare-and-set; active claims are not edited. Only never-surfaced stale inbox entries may be retracted; seen notifications and external pushes cannot be recalled. Existing other sports and broadcast/session modes are unchanged.

This depends on the published source snapshot, not real-time provider truth. Twenty candidates per five-minute pass is a cohort budget, not an unlimited reminder SLA; large queues can remain held until scanned. Report checked/updated/held counts in the existing dispatch response. Do not add another scheduler to hide capacity problems. The old REST claim fallback is removed because it would bypass the shared schedule gate.


## Erasure-aware notification admission — 28 September 2026

Five Web Push paths share a service-only admission/receipt wrapper. It serializes permission to send against account erasure, rechecks installation ownership/permission, and preserves uncertain outcomes without blind retries. Two database requests are added only for actual send attempts; empty queues and scheduler cadence remain unchanged. Reminder/social claims skip erasing accounts; live-rating groups filter them before hydration. No new scheduler or batch enlargement. Finished minimal receipts are opportunistically pruned after seven days, at most 100 per admission; crashed attempts remain exceptions for reconciliation. See account-erasure-runbook.md for the live database proof and external-delivery limits.

## Erasure authentication and Storage expiry — 28 September 2026

Erasure begin stamps server-owned Auth app metadata alongside the database barrier. The existing fresh user lookup rejects marked accounts without an additional network request. Chat and participation/avatar functions have explicit 60-second duration limits. Previously issued signed uploads survive Auth deletion; cleanup must stop every issuer, including old deployments, then wait for capability expiry and reconcile late transfers. A read-only checkpoint remains incomplete until this evidence exists. No new scheduler, poll, subscription or real-account erasure is introduced.

## Account erasure database barrier — 28 September 2026

Direct Auth-linked database writes acquire a per-account shared transaction lock and check a service-only erasure marker. Erasure begin takes an exclusive lock with a two-second timeout, so accepted writes drain and blocked accounts cannot acquire new direct database state. No extra client request, poll or scheduler is added. Unblocked accounts continue with one indexed marker lookup per distinct referenced account in a write; no global write lock. Read Committed is required. Storage capabilities, external delivery and indirect identity writes remain separate orchestration gates. The migration activates no real account. See account-erasure-runbook.md for the live concurrent-session proof and cleanup limits.

## Account-owned notification state on erasure — 28 September 2026

Deleting Auth must remove its linked push installations and owned reminders rather than make them anonymous. The account foreign keys now cascade; installation-to-reminder cascade remains. Peer and genuinely anonymous notification state is preserved. No poll, dispatcher cadence, scheduler owner or MVP budget changes. Stored future-state cleanup is verified with disposable users; an already in-flight push remains outside this guarantee. Full account erasure still requires explicit writer/dispatcher quiescence.


## European Football daily source checks — 27 September 2026

The existing daily canonical workflow also refreshes OpenLigaDB in weekday quick mode. It makes two bounded provider requests and rebuilds only Football/Champions League projections and Football identities when the dataset is checked; no second scheduler or live polling is introduced. Derived standings reuse those fixture facts. Source failures retain last-good records and original freshness; quick-mode failures are preserved in the existing workflow artifact and annotated as warnings. Production and canonical workflows use Node 24. Daily snapshots are not real-time scores. Reviewed international results rebuild rugby and cricket Schedule partitions as well as Feed. Quick US Open hydration reapplies the existing reviewed major-event editorial before building Schedule; the scoped editorial command does not rewrite Feed or the knowledge register.

## Public refresh without private preferences - 27 September 2026

Full manual card/result refreshes without a configured follow snapshot preserve and validate the existing compact fixture-only artifact. They rebuild public schedules and run synthetic Follow checks instead of accessing account preferences. An explicitly configured snapshot retains the existing personalised projection/audit path. A public-only audit must not claim that individual accounts were audited. No additional scheduler is introduced.

## Slow navigation recovery and shared golf ingestion — 25 September 2026

Match Centre owns its panel before Feed hydration completes. Lazy loading immediately shows its own state, with a retry on failure. Membership reads have ten-second deadlines, show eligible pages progressively, and use elapsed freshness instead of a clock-boundary cache key. Existing account, preference and navigation guards remain. No polling cadence or score membership scope changes.

The worker's network-first requests have an eight-second transport deadline and use cached verified content on transport failure or HTTP 5xx. HTML fallback applies only to navigations; missing JSON/assets never receive the app's HTML. Preferences and account storage are not cleared. Installed upgrade tests and their timeouts remain intact; passing desktop WebKit does not prove iOS Home Screen behaviour.

The canonical refresh owns PGA and LPGA participation alongside the existing schedule adapter. Source facts are shared across all users; no account preference scanning, AI discovery or new scheduler. Detail requests are limited to seven days behind and fourteen ahead. Official entry lists and pairings are separate observations; per-source failure keeps last-good records. Presidents Cup uses its existing live source owner.

History hashes ignore observation timestamps, including nested score/status/participation check times. Real fixture, participant, time and score changes still create revisions. Source health timestamps remain updated by the existing publish RPC. No history deletion, retention reduction, migration, plan purchase or scheduler change is included.

Read-only inventory on 25 September measured 507,522,195 database bytes (484 MiB), dominated by fixture snapshot payloads. Capacity recommendations are in the release report; increasing resources is not a substitute for fixing client route ownership or worker activation.


## BJK Match Centre score repair — 24 September 2026

The existing live-source owner checks at most two active BJK official reports per pass, reusing the canonical report parser. No new scheduler or score-triggered deployment. This source provides completed-rubber reports, not guaranteed game-level live data; missing rubber updates stay explicitly unavailable. Structured tie totals and source-oriented rubber set strings are translated by the compact score model. Completion uses the first confirmed observation, never scheduled duration. Tests: `validate-team-tennis-scores.js` and `validate-tennis-tie-layout-browser.js`.

## Coherent observations and manual refresh — 24 September 2026

Source check time is not evidence that a scheduled fixture has reverted from live. Shared Feed/Match Centre reconciliation preserves confirmed state against schedule-only overlays, retains last-good scores, and carries separate score/status observation timestamps. Newer explicit interrupted, cancelled, postponed, completed or live corrections remain eligible; completion is never inferred from duration. The compact API adds `scoreCheckedAt` and `statusCheckedAt`; legacy `checkedAt` reflects the score observation when one exists.

Match Centre alone supports pull down at the top and release past 72px to refresh, plus an accessible Refresh button. A 20px wheel accompanies the bounded refresh. Manual refresh bypasses client due timers and reloads private membership then visible score batches of at most 60 IDs, retaining shared server caching, existing provider cadence and last-good failures. One in-flight refresh and a ten-second client cooldown prevent gesture bursts. Hidden views and late account/navigation responses cannot update the surface. Feed, Follow, ratings and scheduler ownership are unchanged. Regressions: `validate-match-observations.js` and `validate-match-centre-refresh-browser.js`.

## Live cricket recovery — 24 September 2026

The recovery project had no live-fixture pg_cron job, pg_net extension or Vault configuration; source checks had stopped on 22 September. Restore the documented `nothingsport-live-fixtures` two-minute owner on recovery, not a second scheduler. Keep its credential server-only and activate after the matching Vercel release. HTTP timeout is 60 seconds to cover the existing bounded 45-second worker plus settlement. Score requests never fetch providers themselves.

Match Centre resolves published cross-provider aliases by exact sport/start/participant identity, preserving the requested Feed ID and batching score reads to 60 IDs. Cricket Australia batting IDs resolve to the canonical team at ingestion. Old checks are explicitly stale. Regression: `validate-cricket-live-scores.js`; live acceptance requires an autonomous scheduler HTTP response and the affected ODI score in the public API, not deployment alone.

## Gated Match Centre and consensus settlement — 24 September 2026

Membership is a private window-scoped Feed query, separate from public compact scores. Score reads accept at most 60 published contest IDs with a three-second database deadline. Visible clients poll teams every five minutes and tennis every two; hidden clients stop. Interrupted sources use 30 minutes unless another active fixture or sourced restart requires the existing two-minute owner.

Gated compact-score writes separate changing scores from full-source revision history and overlay them for existing Feed readers. No new cron, score-triggered deployment or history cleanup. The existing protected live scheduler runs at most 50 due consensus settlements before ingestion, so unrelated publishing failures cannot block due awards. Cutoffs and per-fixture versions are frozen, latest eligible Impact votes are retained once per person, and outcomes/bonus/inbox writes share a transaction. Tables and RPCs remain service-owned/RLS-protected. Production target remains nothingSport-recovery only. See `match-centre-rollout.md` for flags, measured storage and unfinished release gates.

## Unified notifications inbox — 22 September 2026

Signed-in accounts receive a private inbox independent of device push consent and delivery. Creation is transactional at the existing chat, invitation, membership, reward and friend-rating sources. The existing notification dispatcher owns reminder inbox creation and bounded 90-day cleanup; no new cron or presence poll is added. History starts at the inbox migration epoch without backfill. Temporary chat guests keep their existing behaviour.

Pages contain 25 entries ordered newest first with a stable timestamp/ID cursor. Backgrounded clients make no inbox requests. Startup, foreground and relevant mutations refresh a compact unread summary, coalesced to at most once per 30 seconds; an open inbox refreshes at most every 30 seconds and fetches older pages deliberately. Notification reads use ID/version compare-and-set so a new message cannot be cleared by an older acknowledgement.

Chat messages group until the conversation is read. Reading a conversation closes its group; unsurfaced groups already read in chat are removed. Opening Notifications only reads visible notification entries, never chat messages or invitations. Related social rewards share one story; standalone points remain separate. Private message excerpts are resolved from current authorised chat content and shown only with Results ON. Device push previews and the chat/app-icon badge keep their existing rules.

Regressions: `validate-inbox-database.js`, `validate-inbox-api.js`, `validate-inbox-browser.js`, plus existing notifications/chat/backend-efficiency validators.

Authoritative MVP operating decisions, 14 September 2026. Nothing Sport has approximately 3–5 active non-paying users and must fit the existing free infrastructure tiers without disabling accepted product behaviour.

| Area | Decision |
|---|---|
| AI | Automatic cross-sport discovery and paid AI ingestion stay disabled. Existing accepted tags and user ratings remain available. |
| Live fixtures | Visible cards request at most 60 fixture IDs. Supabase reads current per-fixture rows with a three-second deadline. Live or imminent sources refresh every two minutes; other sources wait 30 minutes. |
| Failure mode | Published static fixtures and the last good client snapshot remain usable when Supabase is slow or unavailable. Optional enrichment never empties Feed or Follow. |
| Fixture writes | Unchanged source hashes update only lease/check metadata. Full source JSON and revision history are written only when fixture facts change. |
| Chat | Poll an open active room every second, slow to 30 seconds after one quiet minute, and stop while hidden or closed. Requests use message/reaction cursors and incrementally patch stable message nodes. |
| Nothing Score | Visible live summaries refresh every two minutes. The watching bonus remains enabled: record entry, confirm after one minute, then heartbeat every five minutes. Watcher counts are approximate over ten minutes. |
| Notifications | Claim reminder batches in one transaction. EPIC alerts inspect the outbox before loading event snapshots and group for five minutes. |
| Scheduled refresh | One GitHub workflow owns canonical refresh: incremental on six days and full on Sunday. `node scripts/update-cards.js` remains the only refresh entrypoint. A separate protected two-minute live scheduler owns live source updates. |
| Releases | A refresh with no tracked content change creates no commit or deployment. Production proof requires GitHub SHA, READY deployment, alias, `releaseGitSha`, cache-busted browser behaviour and database-path checks separately. |

Regression: `node scripts/validate-backend-efficiency.js`, live fixture/API, chat, Nothing Score, notification, startup-budget and installed-PWA validators.

## Leaderboard epoch and Friends activity — 15 September 2026

Use the existing notification dispatcher for all three 5/5 rating phases. The transactional outbox groups delivery for five minutes; indexed activity records retain each rater/fixture/phase. Activity reads paginate 25 records with batch identity lookup. Leaderboard reads aggregate indexed server-owned reward/prediction records without triggering reward writes. Follow/copy bonuses have permanent uniqueness keys. Copying uses a preference compare-and-swap transaction so a concurrent edit is never overwritten. Award transactions serialize the small MVP reward workload to prevent cross-fixture deadlocks and preserve participation caps.

Database target: **nothingSport-recovery**, project `mkghopnkhcxtmfrcjdbc`. The original project's recovery runbook is historical, not the current deployment target. Do not delete the old project as part of a feature deployment.

## Rating authorization repair — 16 September 2026

Registered-account eligibility is established by the authenticated API before the service-role-only rating RPC is called. The invoker-scoped RPC must not read `auth.users`: the service role bypasses RLS but is not granted direct access to Supabase Auth tables. The API rejects anonymous sessions, the RPC retains moderation and scoring checks, and foreign keys retain account existence integrity. Do not add a privileged definer solely to duplicate the API's authentication decision. Regression: `validate-leaderboard-v2-database.js`.

## Follow-grid affinity read — 16 September 2026

Load Follow-grid affinity only for the signed-in account and only when Follow opens. Query the preceding 90 days of contribution rows through the existing authenticated Nothing Score endpoint, supported by the `(user_id, updated_at desc)` index with fixture and phase columns included. Deduplicate edits in application code by fixture and phase; return only per-sport counts and last-interaction timestamps. Anonymous accounts use the ordinary followed-sport order without a database read. This aggregate controls presentation order only and cannot alter Feed admission.

## Fixture-chat ownership and deletion — 16 September 2026

Any signed-in account may create an eligible upcoming/live fixture chat. A fixture may have multiple rooms with different participant combinations; the database enforces a race-safe ceiling of three open room memberships per signed-in account across creation, invitation acceptance, account guest-link joins and admin additions. Anonymous guest memberships remain governed by the 25-member room ceiling and do not count against an account limit. Existing Public Profile requirements still apply before an account can post a message.

The room creator or an app admin may permanently delete the complete chat. A message author or an app admin may permanently delete an individual message. Before relational deletion, transient attachment objects are removed through the private Storage API; explicitly saved account-owned copies remain separate. Direct browser table access remains denied and all authorization stays at the authenticated server API plus database-trigger boundary. Personal archive remains a reversible “Remove from list” action and is not presented as deletion. These ownership changes do not alter the established polling intervals or scheduler budgets.

## Lite weekend editorial - 18 September 2026

Friday 09:00 Australia/Sydney editorial maintenance covers existing 4-5/5 stakes
cards dated Friday through Monday inclusive. It uses the weekend-editorial mode
of update-cards.js, not a second canonical ingestion scheduler. It reads no user
preferences, preserves fixture facts and avoids a release when copy is unchanged.
See docs/weekend-editorial.md for the bounded research and release procedure.

## Profile picture storage — 21 September 2026

Use direct signed uploads to private temporary Storage, then produce 128px (maximum 32 KB) and 512px (maximum 200 KB) WebP images. Keep only metadata in Postgres. Batch expansion-capability reads for visible avatars, load private images only on demand, and reuse cached versioned thumbnails. The existing daily canonical-refresh workflow also drains at most 50 queued Storage deletions, including abandoned originals after 24 hours; no new scheduler. Replacements queue old objects transactionally and preserve the previous picture until both derivatives are ready.

## 22 September 2026 — coverage repair implementation

The existing full canonical refresh ingests the official PGA TOUR schedule; there is no separate golf scheduler. Tennis edition/catalogue presentation loads only when requested. The editorial snapshot reuses the existing rating reader in sequential batches of at most 50 fixtures and looks up candidate event IDs with real five-star contributions in paged, server-only reads. It exports phase flags without contributor identities; it does not change interactive polling, scoring, public sealed ratings or Feed admission. Older or unsurfaced candidates may be queued for research without becoming required Feed cards. Regression: `node scripts/validate-coverage-repairs.js`.

## Active-chat membership visibility — 22 September 2026

Active chats shows personal memberships separately from admin inspection. Hidden open memberships remain accessible under “Hidden chats — still joined” and count towards the displayed three-room ceiling. Each joined room has a direct Leave chat action, including hidden rooms and accounts without a public posting profile. Leaving frees membership capacity; “Remove from list” remains a reversible personal archive, and permanent deletion remains creator/admin-only. Stale archive selections are harmless account-scoped no-ops. Admin inspection never grants membership or posting rights and is excluded from personal bulk selection. This reuses the existing membership read and leave transaction, without new polling or database schema changes.

Regressions: `validate-private-fixture-chat.js`, `validate-chat-membership-browser.js`, `validate-shared-chat-ui.js`, and `validate-chat-navigation-browser.js`.

The release also guards the PWA handover against an older controlling worker requesting a backwards page reload. Newer versions still upgrade automatically. Regression: `validate-app-update-version.js` and the installed-PWA upgrade browser validator.

## Explicit Feed filtering and notification recovery — 22 September 2026

Opening Apply on an active rating filter may load all eligible Feed pages and request rating snapshots in sequential batches of at most 50. This is user-triggered and uses the existing private rating API; it adds no periodic background poll. Threshold summaries use latest real per-account/per-phase contributions and unrounded averages, subject to existing aggregate visibility rules. The inbox always settles a successful empty response into its empty state and gives stalled reads a retry state after ten seconds. Existing 30-second inbox and live refresh budgets remain unchanged.

## Tennis normalisation and refresh investigation — 24 September 2026

Inspect manual intervention and compute together before changing recurring maintenance. Eight inspected scheduled runs (16–23 September UTC) failed; the latest ran its refresh/release step for 17 seconds before the result-completeness gate rejected two missing NBL results. The inspected quick path is deterministic and reports zero AI calls. These observations establish a reliability problem, not account-wide dollar costs or the causes of every earlier failure. Do not weaken result-completeness gates to obtain a release.

Tennis parent projection runs inside `scripts/update-cards.js`, after existing tennis schedule generation; quick refresh regenerates it deterministically. The server build signature includes the parent projection hash so source changes invalidate personalised Feed caches. No additional scheduler, paid AI, database schema or polling is introduced. Browser parent metadata loads once on demand; contest lists load only on expansion and mount in batches of 20. Parent overviews do not enter rating prompts or live-fixture polling.

Validated facts should remain publishable with concise factual copy when richer editorial is unavailable. The new parent presentation depends on sourced facts only. Existing broader editorial/result gates remain mandatory; changing those gates is not implied by this fallback. Retain older narrative only when still consistent with the facts.

## NBL incremental results — 24 September 2026

The existing canonical quick refresh now checks the official NBL schedule alongside its other source adapters, patches known cards and rebuilds the NBL projection when facts change. This repairs missing completed results on days without a full refresh. Timestamp-only NBL checks preserve the previous snapshot; there is no new scheduler, standings-only loader or AI call. Regression: `validate-quick-projection-scope.js` and the canonical result-completeness gate.

## Seven-day tournament hydration — 24 September 2026

Both full and quick canonical card refreshes check running tournaments and tournaments starting within seven Sydney calendar days, including entire tournaments crossing the window. Existing result retention permits follow-up checks of unresolved recent completions. One adapter runs once per source family in a hydration pass; full refresh reuses its normal source loaders. BJK uses bounded official schedule/news fetches, no AI. Calendar-only sources and unsupported fixture adapters are reported as incomplete, never silently counted as hydrated.

Source failures preserve last-known facts and do not block valid updates from other sources. Ordinary schema, safety and result gates are retained. The timestamped machine-readable report lives in the run artifact directory or system temporary directory, so diagnostic clock changes cannot create a release. Existing workflow cadence and ownership remain unchanged. Regression: `validate-tournament-hydration.js` (windows, partial coverage, failures, deduplication, offline and stable snapshots).

## Feed rating read recovery — 25 September 2026

Batch summaries retain the existing 50-fixture limit and private account-scoped responses. Independent viewer profile/persona reads now overlap fixture hydration and summary reads; independent panel metadata overlaps fixture rows. The same reads and authorisation checks remain, with no new scheduler or database changes. Live render reuse now observes the existing two-minute summary cadence rather than re-reading after 25 seconds.

Summary requests use an eight-second client deadline (shorter configured deadlines are respected). Failure or omitted fixtures retains last-good snapshots, enters the existing cooldown and exposes an explicit retry for an unresolved signed-in rating. Hidden pre-vote community totals are labelled as requiring a rating, rather than as loading. Slow or failed reads never invent a zero count or reset a saved vote. Regressions: `validate-ratings-read-latency.js`, `validate-feed-card-recovery-browser.js`, `validate-nsc-client-flow.js` and existing submission contracts.

## Presidents Cup source ownership — 25 September 2026

The existing canonical PGA schedule adapter also parses the official Presidents Cup scoring page’s structured tournament, overview, round and tee-time records. Only sporting fields are retained. Match Centre uses awarded numeric totalValue (including halves), never projectedValue. TournamentStatus owns overview completion; round completion is independent. First confirmed completion is recorded, never computed from scheduled duration.

The existing live-source owner adds one leased Presidents Cup source, with its ordinary live/imminent cadence and deadlines. No scheduler, endpoint, migration or client polling budget changes. Fetch failures keep previous records, scores and score observation timestamps. Missing/invalid totals do not replace last-good scores with zero; source staleness remains visible. F1 session loading preserves canonical venue/country fields and no longer infers completion from elapsed end times.

Regressions: validate-card-coverage-corrections.js, existing Match Centre API/model, live-fixtures and observation suites.

## ODI stale-live display - 27 September 2026

After ten hours from actual start (otherwise confirmed scheduled start), an ODI without explicit continuing-play evidence in the last ten minutes displays Awaiting confirmed result. A fetch timestamp alone is not playing evidence. This is presentation only: no inferred completion timestamp, rewards, or stopped polling. Explicit terminal/interrupted states win. Existing source cadence is unchanged. Regression: validate-odi-display.js.

Confirmed completion and its final scores cannot regress to live when a subsequently fetched snapshot contains stale observations, including provider aliases. Continuing-play inference requires comparable numeric innings progression, not changed formatting or newly added score representations. Confirmed final-score corrections remain allowed. Match Centre and Feed share this reconciliation; validate-match-observations.js exercises the public API handler contract.

## Fixture review timestamps — 27 September 2026

`lastReviewedAt` is observation metadata, like `sourceCheckedAt`; changes to it alone must not create a new fixture-fact revision. Keep the timestamp in source payloads and preserve array order and meaningful schedule, identity, result and viewing changes. Both ordinary and compact-score persistence paths use this rule. The first successful publication after changing the hash definition can create one transitional revision; subsequent unchanged checks must update source health only. Existing seven-day retention remains unchanged.

Regression: `node scripts/validate-live-fixtures.js`, using a captured EPL fixture and both publish adapters. Compare production revision/check timestamps and snapshot growth after deployment; allocation need not immediately fall.

## Bounded source failures and dispatch visibility — 27 September 2026

Complete source failures use the existing database failure count to back off from five to ten to twenty to thirty minutes, capped at thirty minutes unless a source already specifies a longer retry. A successful publication clears the failure count through the existing RPC. Partial-success behaviour is unchanged. Preserve last-good fixtures; do not accept invalid empty sources or change normal healthy-source cadence.

Authorised notification attempts record start before maintenance, inbox and VAPID checks. Preflight failures and alert-dispatch exceptions record bounded diagnostic codes rather than raw upstream messages. Unauthorised calls cannot write health. This change does not establish a scheduler owner, enable a second scheduler, or prove delivery to a physical device.

Regressions: live fixture and notification validators, now also in the serialized production workflow.

## Reminder scheduler recovery — 27 September 2026

The existing cron-job.org dispatcher remains the sole five-minute owner. Its 30-second request limit exposed an accumulated outbox processed sequentially in batches of 100. Limit each invocation to two friend-rating groups, two social groups and five reminders; unclaimed work stays queued for the next invocation. Preserve atomic delivery claims, opt-outs and ambiguous-outcome handling. Push transport has a three-second timeout. These are bounded batches, not a guaranteed end-to-end deadline during provider/database outages.

Hydrate only the due rating fixture IDs. Explicitly include the dynamically loaded competition catalogue in the dispatcher function: Vercel's dependency trace omitted all 30 schedule chunks although they existed in the source upload. No new scheduler, subscription, migration or private-data logging.

Regression: notification, live-rating and backend-efficiency validators, plus the dispatcher bundle validator. Live acceptance requires a successful automatic cron run and updated server health, separately from physical-device push delivery.

## European Football source trial — 27 September 2026

OpenLigaDB league-phase fixtures refresh only through the existing `update-cards.js` owner: full refresh, daily quick refresh (see the later decision above), or the bounded `--european-football -p` mode. Two season endpoints, one call each, fifteen-second timeout each; no added live polling, cron, database writer or account. Responses must pass complete league-phase and reviewed identity checks before atomic publication. A failed source keeps its original last-good facts and check time; an incomplete first import fails without publishing. Partial/total failures make the canonical command nonzero and must not be reported as successful freshness.

Public provider facts and identity mappings remain independently retrievable under ODbL, with attribution on cards and calendar exports. Private preferences and editorial are not put in the provider dataset. Existing per-user Follow consent and exclusions remain authoritative. This does not establish an uptime guarantee or certify full competition quality.

## Daily Football display evidence — 27 September 2026

OpenLigaDB's daily snapshot is not a live observation. Once scheduled kickoff passes without confirmed completion or a fresh explicit live status observation (the existing 30-minute status-evidence window), Feed and Schedule say Awaiting match update. A generic source check is not live evidence. The clock cannot create Live Now or Just Finished for these unconfirmed fixtures. Cancellation, postponement, suspension and abandonment remain authoritative; no source fact, user preference, polling cadence or Follow admission changes. Regression: OpenLigaDB timing/filter tests and the European Football browser suite.

## Daily Football rating phases — 27 September 2026

The rating API uses the same unconfirmed-status gate as daily-source Football cards. After kickoff without a confirmed live/final observation, phase is null: new Heat/Impact/Pulse submissions, likes and watching heartbeats cannot write or award points. Identical retries of previously persisted Heat/Impact submissions still return their original receipt. Batch summaries preserve source observation metadata, keep previous owner receipts, withhold phase aggregates (including sealed Heat), and do not freeze an expired session while source status is unknown. Fresh explicit live and confirmed completed fixtures retain their phases. No votes, scoring rules, reward formulas, database schema, scheduler or polling cadence change. Regression: validate-crowd-foresight.js and validate-nothingscore-submissions.js, both release gates.

## Initial erasure Storage sweep — 28 September Sydney

Operator-only, on-demand sweep: at most 20,000 owned paths, Storage lists of 250 with a 200-page ceiling, deletes of 100, and fresh counts-only inventories before and after. Durable lineage precedes effects. No production scheduler, poll or new subscription. Completion of this first sweep never means capability-expiry, late-transfer or full-account reconciliation has passed.

## Indirect account cleanup — 28 September Sydney

Reward allowlist admission and verified-email subscriber writes share the existing per-account erasure lock. Auth deletion removes its UUID from reward arrays and its verified current email subscription in the same transaction. These administrative paths add no client polling, scheduler, subscription or external delivery. Existing campaign and subscriber volume was zero at rollout. Historic email ownership and external delivery remain operator exceptions rather than guessed cleanup.

## NBL official current standings — 30 September 2026

The existing NBL schedule response also supplies current team positions and win/loss records. Its canonical adapter now reconciles repeated team records, ten unique official ranks and all completed regular-season results before publishing standings. No new request, provider, scheduler or inferred percentage/tie-break formula is added. Invalid optional standings retain the prior verified table and original observation with an explicit stale note, or remain unavailable; valid fixture updates continue. Wrong competition/season, incomplete schedule, duplicate/self fixtures, unsupported phase and invalid completed results still reject the source before publication.

The sole canonical command remains `node scripts/update-cards.js -p --quick --source=nbl` (with `SKIP_RELEASE=1` for local validation). Rank-only changes rebuild only the NBL Code Inspector projection, avoiding unrelated Feed version/page churn. Observation-only checks retain existing bytes. The existing standings renderer supplies explicit local reveal, global Results privacy, checked time and sport-appropriate W/L fields. This closes the missing published NBL table, not independent verification of the league's full ranking rules, finals qualification, Ignite Cup or basketball-family certification. Regression: validate-nbl-standings.js plus the existing viewing/context contracts; browser coverage in validate-nbl-standings-browser.js.

## BJK reviewed-result catch-up — 1 October 2026

The live source’s one-day report window could leave an older tie live indefinitely after canonical hydration had confirmed its final result. Reconcile exact tie IDs, tournament and bracket slots against reviewed official results before that window. Require a known winner, score, HTTPS result source and valid non-future fact timestamp. An equal/newer official live result remains authoritative; missing/invalid facts keep the last good record. Preserve the reviewed observation timestamp instead of labelling the result as newly observed now. This uses the existing leased source owner and shared completed-tie contract, with no extra provider fetch, scheduler, database migration or global cadence change. Once all seven ties are terminal, the existing idle budget applies (30 minutes). Source health alone never certifies fixture truth.

Regression: `validate-bjk-live-reconciliation.js`, the existing live fixture/API suites and programme/tennis normalisation. Acceptance additionally requires a natural scheduled source check publishing seven completed ties and the 30-minute next-due interval; no manual source invocation substitutes for that proof.

## European Football continuity — 1 October 2026

Reject a community season observation that removes a known fixture ID, reuses it for different home/away participants, predates the last-good check, or retracts a confirmed completed result into an unconfirmed state. Retain that competition's entire last-good snapshot and original observation date, and expose the exception through the existing refresh report/nonzero scoped command. An unaffected competition can still refresh through the ordinary partial-success path. Explicit new final scores and kickoff changes for the same identity remain accepted. A genuine result retraction or provider-ID migration needs reviewed evidence rather than an automatic reassignment of saved user activity.

The reproduced current-season replay previously replaced a confirmed 2–3 result with unknown/null and a newer check time. This guard belongs in the canonical source owner, before projections, with no new fetch, polling, subscription or database writer. Two season requests and existing deadlines/cadence remain unchanged. Source success is not independent sporting certification. Regression: `validate-european-football-continuity.js` exercises actual refresh persistence, partial/total retention, ID/matchup drift, chronology, explicit corrections, rescheduling and provider-order independence; it is included in canonical full/scoped/changed-quick and production checks.

## LPGA direct Results route — 1 October 2026

The scheduled quick refresh reported a leaderboard HTTP 404 while retaining the already verified Walmart result. A bounded fresh read now shows that legacy leaderboard URL redirects to the official `/results` route; both current requests return the same accepted 144-player classification. The old adapter rejected a saved `/results` source URL before fetching. Normalise the four known pairings/entries/leaderboard/results suffixes directly to `/results`, retaining HTTPS, exact host and tournament-path restrictions. Do not add a fallback request, retry loop or browser impersonation. The existing at-most-four recent tournaments, one request per candidate, 15-second deadline, edition/result checks and last-good retention remain unchanged. The earlier 404's precise transient cause is unproven; future source failures still remain visible.

The live canonical route checks one current candidate with zero failures and updates source URLs/observations only; winner, scores, classification, identities and dates are unchanged. Regression: `validate-lpga-results.js` covers the current Results route, legacy normalisation, rejected host/protocol/path without fetching, one-request budget, failures and repeated unchanged facts. This is a source-route maintenance repair, not complete Golf certification.

## Delayed Football backup — 1 October 2026

Owner approved integrating the free football-data.org trial into the existing canonical owner and explicitly allowing validated new finals for existing EPL 2026/27 and UCL league-phase fixtures during primary failures. Existing primary sources, identities, schedules, viewing, consent and saved activity remain authoritative. Backup schedules and existing final-score conflicts are never promoted. Whole-competition completeness and identity validation precede result promotion; only explicit FINISHED with valid integer scores can add a final. No elapsed-time live state, new competition, database writer, scheduler or subscription is added.

One invocation-scoped coordinator shares responses across full/quick/scoped paths: at most four provider requests, starts at least 6.5 seconds apart, 15-second deadline, fixed HTTPS origin, no redirects/retries. Credentials belong only in the canonical Actions environment. Backup results/provenance live separately from the ODbL public dataset; original primary freshness remains intact. Tables are comparison evidence, and retained tables are labelled stale when backup results advance beyond primary coverage.

A resolved validated backup can keep an existing competition usable while primary health remains degraded in the dated exception artifact/readout. Unresolved failures retain the existing failure path and last-good facts; no release gate is bypassed. Backup evidence does not establish sporting independence, commercial permission for other sources or complete Football certification.

Validators use disposable source/overlay outputs and do not receive the real backup credential, invocation cache or health-report destination. A canonical invocation ends with an actual provider-request count, including zero when healthy primaries suffice. Fake outage rehearsals cannot consume the production backup budget, clear retained backup results or overwrite owner-facing source health.

## OpenLigaDB client identification — 1 October 2026

The rendered API terms, dated 28 August 2026, ask for an identifiable app/contact route. The existing two central season requests now identify Nothing Sport and its public application/owner URLs in User-Agent. The once-daily canonical cadence, deadlines, continuity, fallback, last-good timestamps and failure reporting are unchanged; there is no retry, extra request or scheduler. Last-change polling remains a separate unimplemented optimisation, not a claimed pass. Current source-to-screen and commercial-rights gates remain open.

## EPL complete-table validation — 2 October 2026

The existing standings owner now validates both sides of league statistics before persistence: wins equal losses, draw appearances are even, goals for equal goals against, and no club exceeds the declared 38-match season. Official points adjustments remain valid; ordering and row arithmetic checks are retained. A coherent-looking individual row can still create an impossible whole-table observation, so malformed observations fail through the existing preservation/exception path. No new request, retry, scheduler, table derivation or writer is added. Final shared-place presentation, special adjudication and commercial permission remain separate acceptance gaps. The existing EPL and UEFA gates now include actual temporary-file retention and controlled final-round cases; see the [ranking record](quality/football-ranking-acceptance-2026-10-02.md).

## EPL shared-place semantics — 2 October 2026

The existing table owner separates C.7 sporting place from official row order when points, goal difference and goals scored are identical. Complete ordinal or already-shared provider positions are validated against the same facts; malformed mixtures retain last-good data through the existing failure path. Tied entries carry sharedRank/sortOrder. At the all-clubs 38-appearance boundary, unverified tied final positions are pending; counts alone cannot establish completion or C.17 decisions. Existing badge/editorial boundaries withhold definite claims, and Inspector preserves original dates, source and explanatory note. No extra read, retry, scheduler, migration or derived score is added. The source-to-screen rehearsals use disposable files and intercepted browser data, never the production source credential. Actual sporting adjudication remains an explicit future source-evidence requirement. See [the acceptance record](quality/epl-shared-places-2026-10-02.md).

## Daily EPL tables and generated cache keys — 2 October 2026

Weekday quick refresh checks the complete official EPL table using its existing owner: one bounded primary request (six additional checks per week), unchanged backup coordinator ceilings and last-good/date rules. Table-only observations update canonical contexts, Football Inspector and packed ranks without rewriting unrelated Feed. The existing canonical `--quick --source=football` route checks all three pilot sources for bounded manual validation; it adds no scheduler, per-user read, database operation, settlement or notification. Routine quick fixture-result scope remains seven days.

Generated runtime changes receive a forward version and matching document/preload/worker cache keys before the same release commit. No-op/repeated calls, intentional forward versions and unrelated shell edits are guarded; only an actual runtime change adds epoch files to automated staging. Existing upgrade deferral and saved-state controls remain. Scoped Football starts from published facts; ordinary quick publishing preserves known omitted fields, and metadata-only checks retain reviewed result editorial. This replaces manual repair rather than adding owner administration. See [freshness evidence](quality/football-freshness-2026-10-02.md); unattended source operation and physical-device proof remain distinct.

## Independent card maintenance - 2 October 2026

Owner-approved partial progress: isolate card-local research/source/validation failures, preserve their last-known data and record actionable deferrals. Continue independently valid cards; defer only declared direct dependencies. Weekend editorial emits a dated accepted/deferred report and accepts explicit deferred research records. Shared knowledge integrity, spoiler, build and release gates still stop affected publication. No extra ingestion, preference access, scheduler, polling or retry loop is introduced.

## Football displayed live-status integrity — 2 October 2026

The existing European awaiting-update guard also applies to the retained EPL/UEFA competition identities. After kickoff, unconfirmed or stale live status displays Awaiting match update; a valid explicit live observation must be at or before now and within the existing 30-minute window. Future timestamps cannot count as fresh. Completed results and original observations remain intact. This is display integrity, not a new refresh cadence, request, source, scheduler, database writer or reminder rule. Existing Follow admission and all valid non-Football timing contracts remain unchanged. Regressions: `validate-football-status-display.js`, `validate-football-status-browser.js` and cached-rule acceptance in the existing installed-PWA rehearsal.

## Follow journeys experiment — 2 October 2026

The approved migration freezes the existing registered-account cohort once, snapshots preferences privately and locks each saved record before adding missing athlete follows. Updating updated_at preserves API compare-and-set conflicts; new accounts, later unfollows and resets cannot retrigger it. Recovery data is service-only with forced RLS and account-deletion cascade. No refresh, polling or scheduler change accompanies phase 1.

Phase 2 retains the sole five-minute reminder dispatcher and bounded processing. The target is delivery at T−15 through T−10 against an official exact/not-before instant, independently of app activity. Shared sources and server-owned canonical fixture timing are required; unsupported or stale inputs hold delivery. ATP/WTA full-event and real-phone evidence remain acceptance gates, not deployment claims.

### Phase 2 capacity and ownership — 2 October 2026

The approved follow-journey plan requires app-closed creation and capacity for the existing cohort. The read-only inventory found ten registered accounts, four enabled installations and a peak of six pending reminders in a five-minute window. The prior five-row claim cannot satisfy that peak in one pass. The implementation supersedes that claim limit with a hard ceiling of ten, two reminder workers and a 27-second operation budget plus at most three seconds to record health. The sole cron-job.org five-minute owner is retained. Time-critical reminders precede the unchanged two-group live-rating/social paths; those paths defer when fewer than five seconds remain. Their reads/sends share the remaining invocation budget. No new scheduler, source request, retry loop or notification category is added.

One invocation-scoped catalogue shares published fixtures and the existing normalized source snapshot across account and legacy-reminder reconciliation. Failed/overdue source observations hold timing while display facts remain retained. Each pass reads at most twenty account states, at most one hundred candidate fixture decisions per account and at most twenty legacy schedule rows. Account updates compare the saved revision under lock; explicit manual choices and erasure blocks win. Unchanged intent/delivery facts avoid writes; only the existing twenty-row timing scan refreshes unchanged schedule timestamps. Account scan markers add at most 5,760 small updates/day at the twenty-account ceiling, alongside the existing 5,760 schedule-check ceiling; no fixture history is appended.

Freshness, installation ownership and current sporting/system opt-outs are checked in SQL before claims. Automatic intent is also tied to the current saved-state revision and global-auto setting. A durable begin marker prevents an interrupted provider attempt from being replayed as a fresh canonical fixture. Known pre-provider failures/rejections may retry; unknown external outcomes remain held and must be reported rather than claimed as delivered. An external push already in flight cannot be recalled by a later OFF/erasure.

The ten-delivery capacity rehearsal with 3,000ms providers and 100ms database operations finished in 23,831ms, with maximum concurrency two and lower-priority work deferred. This is a bounded runtime rehearsal for the measured cohort, not an unlimited capacity or real-phone SLA. Larger/overlapping cohorts need a fresh queue-capacity gate. Actual ATP/WTA match/phone evidence remains pending.

Phase 2 rebase preserves the concurrently shipped owner content/post-reminder paths. Those existing paths also use the remaining dispatcher request budget and defer when needed. Their content, consent and delivery contracts remain intact. The optional owner-workspace module and redirect page cache after use rather than during every cold PWA installation, restoring the unchanged 3 MB startup ceiling; critical public scripts are still precached. The additive migration leaves the global policy epoch inactive for compatibility. Only a protected invocation of the new production dispatcher activates it; disposable account/REST rehearsals cannot change the global epoch.

### Phase 3 calendar ownership — 2 October 2026

Reviewed calendar/participation input is a local provenance register at feeds/provider-exports/tennis/journeys-reviewed.v1.json, projected by build-tennis-journeys.js through the existing update-cards.js owner. This adds no source request, scheduler, database writer or per-user ingestion. Tennis Schedule fetches one shared static document only after its journey disclosure is opened and reuses it during preference changes. The current date moves the twelve-month view; unpublished later calendars remain explicitly pending. Calendar-only input is absent from reminder and live fixture catalogues.

## Feed live-score presentation — 2 October 2026

Reuse the existing live-fixture snapshot reader and shared compact score model on mounted Feed cards, with the existing sixty-ID bound, request coalescing, source owner and last-good failure behaviour. Mount refresh no longer depends on fantasy consent. Reject late updates after account/preference changes or hidden navigation. No new scheduler, provider request per user, database writer or reminder category.

## 2 October 2026 — WRC calendar and venue identity

The canonical `update-cards.js` workflow owns WRC calendar refresh. Its scoped `--wrc` mode refreshes the single official competition calendar, the official withdrawal announcement and one published organiser itinerary while retaining championship standings and classified results. Full refresh retains the existing FIA result provider; failed or mismatched result responses preserve prior verified winning facts and their original timestamps. No new results/live provider, client source request, scheduler or database change is added. Reviewed edition geometry and venue metadata are local assets, never researched per card at runtime.

A 13-round calendar is accepted only with the explicit official Saudi WRC withdrawal. Keep its established fixture ID as cancelled; do not turn the regional MERC event into WRC coverage. Future event windows retain date-only precision, unconfirmed entrants and viewing rights. Current-season roster scopes cannot imply future participation. Regressions: `validate-wrc-context.js` and `validate-wrc-venue-coverage.js`.

## Athletes visible-surface ownership — 2 October 2026

The Athletes repair reuses /api/feed with an athlete scope and existing canonical snapshot overlays, authentication, revision-aware cache and erasure path. It reads only published/shared facts; no per-user organiser calls, new data writer, paid source or scheduler. The all-followed identity projection is included only on the first page. Each browser page is limited to fifty fixtures, at most forty monotonically advancing pages; incomplete pagination retains last-good facts and reports a gap. Account/preference/navigation tickets reject late responses. Five-minute membership caching and ten-second manual-refresh protection remain. The existing sole 120-second visible sporting refresh entry point selects Feed or Athletes; hidden browsers do not poll. Match Centre's retired browser coordinator is no longer mounted. Follow/profile loaders and source cadence remain shared. No database changes or reminder-policy changes accompany this release.

## Free tennis source admission and gap context — 3 October 2026

The user requires free sources only, accepting gaps. Reviewed China Open and Japan Open publication evidence does not establish a complete fresh permitted ATP/WTA input. Shanghai/Wuhan remain candidate observations until entries, full draw/order-of-play coverage and permitted use pass before the first tracked match. Add gap-only review metadata to the existing shared tennis journey projection through update-cards.js; it cannot certify ingestion, create fixtures, supply start times or enter the reminder catalogue. All completeness/reuse flags remain false, validated against duplicate/unknown editions and future review dates. The existing source owner, cache and sole dispatcher remain unchanged, with no per-user organiser reads, provider account, subscription or database mutation. Real event reconciliation and installed-phone receipt remain separate gates. Regression: validate-tennis-journeys.js and existing source-owner/reminder contracts.


## Golf subsource observations and bounded result reuse — 3 October 2026

The existing `scripts/update-cards.js` invocation owns one `golf-source-report.v1` file, correlated by a fresh invocation ID. PGA/Korn Ferry calendars, tee times and fields, LPGA calendar/pairings/entries/finals and attempted Presidents Cup scoring record coded observations with actual source-check dates and separate retained-fact dates. The existing canonical artifact (14-day retention) and bounded delivery exception readout carry this evidence; workflow success does not certify resource health or whole Golf coverage. Missing, malformed, future or unattempted evidence remains unknown. Reports omit page bodies, transport messages, credentials and URL queries.

Known published LPGA fields survive failed or empty entry responses, preserving withdrawals and all prior participation facts. Unchanged participation/finals retain exact fact bytes and original dates; new checks live in the operational report. The explicit PGA tournament status must match tournament ID and season and be internally consistent. An official round cannot mark the tournament complete; field pages cannot create a final winner or retract a settled calendar result. Unknown status remains an exception rather than inferred progress.

The Golf owner already checks at most four recent LPGA finals with the existing 15-second deadlines. A later quick step reuses that completed pass, including its failures, only in the same invocation and for at most six hours. Different, expired, future or malformed evidence cannot suppress a fresh ordinary check. There is no automatic retry, new provider, source endpoint, scheduler, credential, database writer, per-user request or owner routine. Full primary-calendar failures remain fatal before persistence; optional failures retain last-good data and remain visible. Existing quick partial-success/failure policy remains intact.

Regression: `validate-golf-source-observations.js`, `validate-lpga-results.js`, `validate-canonical-source-readout.js`, `validate-tournament-hydration.js`, `validate-update-cards.js`, `validate-backend-efficiency.js`. The new source/readout cases run in the canonical and normal production gates. This is scoped operational reliability and status accuracy, not Golf certification.


## Raw reviewed-provider identity survives regeneration — 3 October 2026

The first credentialed canonical observation after the Rugby cutover exposed a release-gate failure: shared live projection normalized the provider record's `id` to its action key, losing the raw World Rugby key in the source snapshot. Source observations now retain a known World Rugby UUID key only when its existing reviewed equivalence resolves to the same canonical fixture; unknown UUIDs cannot move identity. Both full ingestion and shared live publication use this boundary. Consumers still normalize to the same reviewed action key, kickoff, five aliases and participant identities. Genuine primary observation dates survive.

A one-record replay of the already observed source snapshot through `update-cards.js --coverage-live --live-coverage-snapshot=PATH --local-only` repairs persisted provenance without a new source call, database mutation, customer migration, reminder replay or scheduler. Temporary-file tests cover normalized incoming records, recovery of the canonicalized raw key, stable reruns and the full source owner. Keep the original published release assertion; do not weaken it. Regression: `validate-live-coverage-publication.js`, `validate-bledisloe-reviewed-identity.js --published`, `validate-rugby-reviewed-identity.js --published` and existing source/Follow parity checks.

## Independent compact score observations — 3 October 2026

The subsequent ordinary EPL check exposed a missing `resultSourceCheckedAt` exclusion in the existing fact hash: all 380 fixtures were unchanged, yet 50 result verification clocks advanced the whole-season revision. Treat that field as a verification clock while retaining it in payloads. Preserve result publication dates, outcomes, identities, scheduling, viewing and score correction detection. The hash transition can produce one new revision per affected source; require later ordinary unchanged checks before claiming production growth is stopped. Actual captured-final persistence regressions belong in the existing release gates. No schema, retention, scheduler, shell, deadline or owner routine changes.

Existing fenced source owners write independently observed score/status dates, preserving the actual provider response clock and exact fixture aliases. Retained fixtures and omitted score fields do not acquire a new verification date. Whole newly observed score representations replace older conflicting displays; older/equal-clock contradictory facts and passive reopening of settled results are rejected. Newer settled adjudications remain possible. Legacy unknown clocks remain unknown until a genuine check; there is no invented timestamp backfill.

The original fact-change dates stay in changed-only compact rows. Last genuine verification receipts use the existing source-health report; timestamp-only checks write neither compact tuples nor full snapshot history. Receipts are capped at 5,000 retained fixture IDs and 1 MiB per source and stripped before public source-health transfer. Normal visible-card reads remain two requests, each with its existing three-second deadline, and at most 60 selected IDs. API representation validators include actual independent verification clocks so a genuinely checked stationary score reaches clients; collection-only polls do not create that validator change. Unknown-score freshness never borrows a newer status or collection date.

A representative 1,000-row local PGlite refresh/check costs under one second and retains an approximately 88 KiB receipt document; the optional 5,000-row ceiling benchmark remains separate from routine release tests. Local timing is not production latency. The canonical source workflow, live worker budget, source requests, privacy/Follow consent and notification scheduling remain unchanged. Release gates now retain actual splitter/SQL/read/handler integration and validator tests. Physical device and real corrected-match observations remain separate evidence.
## Adaptive editorial - 2 October 2026
One existing editorial heartbeat wakes daily at 09:00 Sydney, selecting due real-user-qualified previews in the next 14 days. Reuse canonical update-cards modes and the existing communications lease; no parallel ingestion, preference access, user polling, paid AI provider or sending connector. Latest real pre-match votes aggregate server-side in batches of 100 fixture aliases. Private revision-CAS state tracks checks, queued edits, holds, deferrals and verified publication separately. Unchanged research writes private check metadata only. Keep Friday's existing 4/5 weekend work, isolate card-local failures, and retain shared release gates. Detailed owner decisions: [adaptive editorial](adaptive-editorial.md).

## Full preview publication integrity - 3 October 2026

The quick results owner's existing publication boundary reconciles complete researched previews from the retained knowledge store after fixture/evidence assembly. This prevents older two-section calendar copy from overwriting full editorial. Only editorial fields change; sporting facts, genuine observation clocks, newer research, explicit locks, completed recaps and the protected men's NRL Grand Final retain their existing authority. There is no additional source fetch, per-user read, scheduler or database table.

The existing post-release recording operation adds one shared static feed read to verify raw served Hook/Form/Storyline/Match Context against staged copy. It requires the serialized pipeline's READY production SHA proof and matching shell/feed/source revisions. Research artifacts cannot stand in for visible-card evidence. Card-local gaps retain staged copy and report errors without preventing independently verified publication records; shared release/control failures remain fatal. Regression: `validate-editorial-publication.js`, full-section narrative assertions and five-card desktop/mobile Chromium/WebKit rendering.

## Follow favourites implementation — 3 October 2026

Reuse deferred directories/profiles, account identities and existing sporting refresh coordination for favourites. No additional scheduler or source request per followed user. The owner explicitly authorises the three scoped production releases despite stalled release checks; retain each failed/waived result and verify SHA, READY, aliases, served bytes and rendering separately. The waiver does not establish that a check passed. Participant schedule decoupling and global Match Centre listing follow in releases 2/3.

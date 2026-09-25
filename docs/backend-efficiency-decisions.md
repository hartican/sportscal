# Backend efficiency decisions

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

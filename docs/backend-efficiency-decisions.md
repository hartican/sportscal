# Backend efficiency decisions

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

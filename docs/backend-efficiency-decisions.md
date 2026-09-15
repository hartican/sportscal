# Backend efficiency decisions

Authoritative MVP operating decisions, 14 September 2026. Nothing Sport has approximately 3–5 active non-paying users and must fit the existing free infrastructure tiers without disabling accepted product behaviour.

| Area | Decision |
|---|---|
| AI | Automatic cross-sport discovery and paid AI ingestion stay disabled. Existing accepted tags and user ratings remain available. |
| Live fixtures | Visible cards request at most 60 fixture IDs. Supabase reads current per-fixture rows with a three-second deadline. Live or imminent sources refresh every two minutes; other sources wait 30 minutes. |
| Failure mode | Published static fixtures and the last good client snapshot remain usable when Supabase is slow or unavailable. Optional enrichment never empties Feed or Follow. |
| Fixture writes | Unchanged source hashes update only lease/check metadata. Full source JSON and revision history are written only when fixture facts change. |
| Chat | Poll an open active room every five seconds, slow to 30 seconds after one quiet minute, and stop while hidden or closed. Requests use message/reaction cursors. |
| Nothing Score | Visible live summaries refresh every two minutes. The watching bonus remains enabled: record entry, confirm after one minute, then heartbeat every five minutes. Watcher counts are approximate over ten minutes. |
| Notifications | Claim reminder batches in one transaction. EPIC alerts inspect the outbox before loading event snapshots and group for five minutes. |
| Scheduled refresh | One GitHub workflow owns canonical refresh: incremental on six days and full on Sunday. `node scripts/update-cards.js` remains the only refresh entrypoint. A separate protected two-minute live scheduler owns live source updates. |
| Releases | A refresh with no tracked content change creates no commit or deployment. Production proof requires GitHub SHA, READY deployment, alias, `releaseGitSha`, cache-busted browser behaviour and database-path checks separately. |

Regression: `node scripts/validate-backend-efficiency.js`, live fixture/API, chat, Nothing Score, notification, startup-budget and installed-PWA validators.

## Leaderboard epoch and Friends activity — 15 September 2026

Use the existing notification dispatcher for all three 5/5 rating phases. The transactional outbox groups delivery for five minutes; indexed activity records retain each rater/fixture/phase. Activity reads paginate 25 records with batch identity lookup. Leaderboard reads aggregate indexed server-owned reward/prediction records without triggering reward writes. Follow/copy bonuses have permanent uniqueness keys. Copying uses a preference compare-and-swap transaction so a concurrent edit is never overwritten. Award transactions serialize the small MVP reward workload to prevent cross-fixture deadlocks and preserve participation caps.

Database target: **nothingSport-recovery**, project `mkghopnkhcxtmfrcjdbc`. The original project's recovery runbook is historical, not the current deployment target. Do not delete the old project as part of a feature deployment.

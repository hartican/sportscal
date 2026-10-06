# Adaptive 5/5 editorial - owner decisions, 2 October 2026

## Automatic missing-copy repair - 6 October 2026

The Owner authorises repairing required public display copy without another prompt. The normal canonical adaptive inventory now also includes existing published 4+/5 fixtures whose required Hook or Match Context is missing in either Results mode, even without a qualifying real rating. `repairReason: missing-required-display-copy` distinguishes this exception from rating-selected narrative maintenance. It uses the same 14-day pre-kickoff window, alias identity, private control snapshot/CAS, holds, locks and protected NRL exclusion; it changes no ratings, preferences or Feed admission. Research these repair cards once with the same complete, sourced four-section schema and publish with the independently valid due cards. The shared spoiler gate and inventory use the same display-copy resolver. A successful check cannot hide an unrepaired public gap.

Before publication, follow [autonomous release recovery](update-sportscal-cards.md). After main advances, rebuild the merged sources and rerun the canonical inventory with a fresh matching private snapshot to discover newly added missing-copy cards. No extra sports ingestion or new scheduler. A confirmed result is not fabricated to repair copy after kickoff; held, protected, unavailable or out-of-window blockers retain data and an actionable exception.

One existing editorial heartbeat runs daily at 09:00 Australia/Sydney. Keep Friday's existing 4/5 Friday-Monday maintenance. Do not create another scheduler or repeat canonical ingestion. Use a clean current origin/main worktree and the canonical entrypoint:

```sh
node scripts/update-cards.js --adaptive-editorial --list
node scripts/update-cards.js --adaptive-editorial --research data/editorial-adaptive-YYYY-MM-DD.json
```

The private aggregate selects each non-suspended registered real account's latest pre-match vote once across all canonical fixture aliases. Legacy pilot membership is not required. No persona weighting, likes, demo/modelled votes, public identity export or preference access. Eligibility is two distinct real 5s OR the single verified owner's 5 OR unrounded arithmetic mean strictly >4.8. One voter is sufficient for the mean: a lone real 5 therefore qualifies. These are editorial rules, not public rating or Feed-admission changes.

Window: today through 14 Sydney calendar days ahead. Check every five days at 14-7 days out, every two at 6-2, daily at 1-0. Recalculate using the current fixture date and last successful check on each wake. Newly qualifying/missing cards are immediately due. Stop at confirmed kickoff; date-only records retain unknown kickoff rather than inventing one. Postponed/suspended cards wait for confirmed new scheduling. Protected men's NRL Grand Final aliases never enter this preview task; score/result maintenance remains independent.

Research JSON contains `horizon:{from,to}`, `entries` and `deferred`. Each entry uses the existing fixture research schema: id, title, hook, formCopy, closingCopy, synopsis, fresh researchedAt, researchDepth:5, at least three HTTPS official/trusted sources and four sourced facts spanning form and consequence/history/path. Hook, Form, Storyline and Match Context must be distinct, original, focused on the actual participants, spoiler-safe and deduplicated above/below the fold. Do not pad Form with invented recent results. Separate sourced facts from emotional interpretation; never invent player feelings, sanctions or unannounced lineups.

Research only due cards. Check official news and relevant trusted reporting for material narrative changes: team availability, selection, tactical/competitive context, financial/regulatory developments, farewells or changed stakes. Do not rewrite for timestamps, repeated old articles or style alone. When unchanged, reuse the full current copy in a fresh research entry. All four sections are compared, not only hook/synopsis. A successful unchanged check updates private maintenance state, not the feed epoch, commit or deployment.

Owner console `/admin/editorial` shows eligibility, sources, full copy, history, last/next checks, errors and publication SHA. Edits are revision-checked private queued copy. The next due list exposes those edits as its baseline: preserve them unless verified developments materially change the story; later automatic rewrites are allowed. Following the Owner's 3 October approval, an explicit hold prevents both automatic rewriting and publication of queued edits. Keep pending copy private and intact until the Owner releases the hold; it then becomes immediately due. Held cards and their generated communications are skipped without blocking independent unheld cards. Saving does not claim production publication. Never clear a pending edit after a deferred card or concurrency conflict.

Isolate malformed/missing/stale research per card, retain its last-known copy, report evidence/reason/direct dependencies/nextAction, and publish independent valid cards. Shared knowledge/feed/spoiler/build/release failures still block publication. If the private rating/control read fails, do not invent empty eligibility or release a partially read control snapshot; report the outage and retain prior public data.

Canonical publication rebuilds public editorial projections and existing communications sources. The private content workspace reconciles generated Hook/email/social/live material through its existing source-change lease, preserving manually edited communications drafts and marking handoffs stale. No email/social sending. Numeric feed-version slugs and invalid-partial-run recovery remain mandatory.

Publish scoped changes to GitHub main and dispatch `sportscal-production.yml` with that exact SHA; require all existing gates, READY production releaseGitSha, alias and exact served bytes. Then run `node scripts/update-cards.js --adaptive-editorial --record-release <verified-sha> --release-proof <pipeline-production-verification.json>` to record matching served editorial as published. Report GitHub, deployment and desktop/mobile/PWA evidence separately. No-change runs stay quiet unless a new actionable failure appears. Keep the downloaded pipeline `deployment-files.json` beside `production-verification.json`. Release recording verifies the server editorial source's exact Git blob, JSON transform, size and hash in that inventory, binds it to the current READY target, and still checks actual served card copy before writing publication state. Raw editorial source downloads are closed; do not reopen them or treat a research artifact as proof of visible copy. Missing/wrong inventory or stale production stops recording.

Local scheduled runs need the existing service-role environment. `NS_EDITORIAL_ENV_FILE` may point to an access-restricted production environment file outside Git; never print or commit it. If unavailable, fail explicitly rather than reading preferences or guessing rating signals.

### Measured private run readout

The existing `NS_EDITORIAL_CHECK_REPORT` captures an aggregate `runReadouts` entry for each list/research invocation. Keep using a fresh private out-of-checkout report; service-credential runs can use that same report option. No second tracker, database table or scheduler is added. The report preserves every prepared CAS operation and retains at most 32 measurements.

Measurements cover window/selected/due cards, changed/deferred cards, successful checks, CLI elapsed time and the failure stage. Snapshot-mode updates are **prepared**, not confirmed database writes; direct-service updates are counted only after they return successfully. Connector application and production publication are still separate proof steps. A failed inventory has unknown counts, never a healthy zero. The aggregate contains no fixture names/IDs, private copy, votes or raw errors. External agent research time, model tokens and cash cost remain explicitly unavailable unless separately measured; CLI runtime is not end-to-end research/release time.

Use these counts in the existing brief weekly exception readout: identify repeated deferrals, unnecessary changed-copy releases or an unusually large due set. Routine unchanged checks stay quiet. Do not change eligibility/cadence or infer token savings from these measurements alone. An unsafe report path or invalid permissions fails before editorial work begins.

### Credential-free scheduled execution

Vercel sensitive environment exports may contain masked placeholders, not usable
service credentials. Never ask for, print or copy private tokens to work around
this. When a local service environment is unavailable, use the authorised
Supabase connector for `nothingSport-recovery` (`mkghopnkhcxtmfrcjdbc`):

1. Run `node scripts/update-cards.js --adaptive-editorial --prepare-control`.
2. Obtain `private.nothingsports_editorial_signals(target_groups)` for those exact
   alias groups (batches of at most 100), plus every maintenance row. Save only
   the aggregate/control snapshot outside Git, with mode 600. Include
   `capturedAt`, matching `sourceRevision`, `complete: true`, `groups`, `signals`
   and `states`; do not export accounts, raw votes or preferences.
3. Set `NS_EDITORIAL_CONTROL_SNAPSHOT` to that absolute snapshot path and
   `NS_EDITORIAL_CHECK_REPORT` to a fresh private, out-of-checkout report path.
   Then use the same canonical `--adaptive-editorial --list` / `--research`
   commands. Refresh snapshots older than 15 minutes before invoking them.
4. Use `node scripts/editorial-control-sql.js <check-report>` to prepare atomic
   connector writes. Apply them through the authorised connector before
   publication. A revision conflict or explicit hold stops the affected run;
   do not publish a stale Owner edit. Do not treat a local check report as a
   successful database write.
5. After the established pipeline proves READY, alias and exact release SHA,
   obtain a fresh snapshot matching the served source revision. Run canonical
   `--adaptive-editorial --record-release <verified-full-sha>` with a separate
   private report path and apply its CAS writes through the connector.
6. Remove temporary environment, snapshot and check-report files after use.
   Successful unchanged checks still record check cadence, without a deployment.

The local snapshot is an authorised control-plane adapter, not another scheduler
or sports ingestion path. Production APIs retain their normal service access.
A source unavailable for one card defers that card and its direct dependants;
shared integrity, spoiler and release failures remain mandatory stop conditions.

### 2 October 2026 initial maintenance

The real-rating inventory selected All Blacks v Wallabies, Bathurst 1000 and
Liverpool v Manchester City. The Owner explicitly authorised replacing the
older Bledisloe copy lock. The men's NRL Grand Final remains protected. City's
financial case concerns reporting and spending rules, not a salary cap; distinguish
Commission findings, the club's appeal and still-undecided sanctions.

### 3 October 2026: stable projection identities and Bledisloe recovery

- An editorial refresh preserves an existing feed projection ID when all its targets belong to the refreshed fixture. Copy, provenance and review dates may change; the projection identity must not change merely because a research import ran.
- A shared projection is split only for the refreshed targets. Unrelated targets keep their original ID and copy; repeated imports retain the new scoped identity.
- Restored the World Cup opener's `projection:feed:rlwc-australia-new-zealand-2026` and Sydney Bledisloe's `projection:feed:bledisloe-sydney-2026` without rewriting their researched sections. Both Bledisloe cards must retain distinct Hook, Form, Storyline and Match Context in Feed rendering.
- `validate-editorial-projection-identity.js` is a mandatory production gate. Browser proof covers all five refreshed previews, including both Bledisloe Tests, at desktop and mobile widths in Chromium and WebKit. Physical iOS Home Screen behaviour remains separate evidence.

### 3 October 2026: full previews survive refresh and publication is literal

Quick results/evidence refresh and feed publication retain the current complete researched preview rather than replacing it with older two-section seed copy. Reconcile editorial fields only: scores, fixture facts and sporting observation dates stay unchanged. Newer editorial, explicit locks, completed-result handling and the protected men's NRL Grand Final retain their existing authority. Missing published sections make an otherwise selected unheld card immediately due for independent repair, even when its knowledge copy is unchanged.

### 4 October 2026: recover from advancing main

Follow [Update Sportscal cards](update-sportscal-cards.md) when a scoped push or the initial deployment mainline check loses a race to concurrent main changes. Preserve the card work, merge current main, rebuild conflicting generated outputs from combined inputs, retain newer facts and private holds, then retry scoped publication and the exact-SHA serialized release without another approval. Bound integration recovery to three attempts; never force-push, repeat provider ingestion just for a merge, bypass gates, or claim an unverified deployment. Main advancement alone is not a failed card or a permanent release blocker.

Publication recording requires the serialized pipeline's READY production SHA proof, the exact released checkout and matching live shell/feed revisions. Compare all four staged sections against the raw served card, including compatibility Hook/Context, without filling gaps from knowledge. Matching research-artifact revisions alone are not proof. Keep staged copy and an actionable error for mismatched/missing cards while recording independent verified cards. Holds remain private and cannot be cleared by recording publication. The production gate reproduces stale seed replacement and artifact/card disagreement.

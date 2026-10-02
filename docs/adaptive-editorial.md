# Adaptive 5/5 editorial - owner decisions, 2 October 2026

One existing editorial heartbeat runs daily at 09:00 Australia/Sydney. Keep Friday's existing 4/5 Friday-Monday maintenance. Do not create another scheduler or repeat canonical ingestion. Use a clean current origin/main worktree and the canonical entrypoint:

```sh
node scripts/update-cards.js --adaptive-editorial --list
node scripts/update-cards.js --adaptive-editorial --research data/editorial-adaptive-YYYY-MM-DD.json
```

The private aggregate selects each non-suspended registered real account's latest pre-match vote once across all canonical fixture aliases. Legacy pilot membership is not required. No persona weighting, likes, demo/modelled votes, public identity export or preference access. Eligibility is two distinct real 5s OR the single verified owner's 5 OR unrounded arithmetic mean strictly >4.8. One voter is sufficient for the mean: a lone real 5 therefore qualifies. These are editorial rules, not public rating or Feed-admission changes.

Window: today through 14 Sydney calendar days ahead. Check every five days at 14-7 days out, every two at 6-2, daily at 1-0. Recalculate using the current fixture date and last successful check on each wake. Newly qualifying/missing cards are immediately due. Stop at confirmed kickoff; date-only records retain unknown kickoff rather than inventing one. Postponed/suspended cards wait for confirmed new scheduling. Protected men's NRL Grand Final aliases never enter this preview task; score/result maintenance remains independent.

Research JSON contains `horizon:{from,to}`, `entries` and `deferred`. Each entry uses the existing fixture research schema: id, title, hook, formCopy, closingCopy, synopsis, fresh researchedAt, researchDepth:5, at least three HTTPS official/trusted sources and four sourced facts spanning form and consequence/history/path. Hook, Form, Storyline and Match Context must be distinct, original, focused on the actual participants, spoiler-safe and deduplicated above/below the fold. Do not pad Form with invented recent results. Separate sourced facts from emotional interpretation; never invent player feelings, sanctions or unannounced lineups.

Research only due cards. Check official news and relevant trusted reporting for material narrative changes: team availability, selection, tactical/competitive context, financial/regulatory developments, farewells or changed stakes. Do not rewrite for timestamps, repeated old articles or style alone. When unchanged, reuse the full current copy in a fresh research entry. All four sections are compared, not only hook/synopsis. A successful unchanged check updates private maintenance state, not the feed epoch, commit or deployment.

Owner console `/admin/editorial` shows eligibility, sources, full copy, history, last/next checks, errors and publication SHA. Edits are revision-checked private queued copy. The next due list exposes those edits as its baseline: preserve them unless verified developments materially change the story; later automatic rewrites are allowed. An explicit hold prevents automatic rewriting; pending owner edits can still be applied. If held, use pending copy verbatim and research only to validate it. Saving does not claim production publication. Never clear a pending edit after a deferred card or concurrency conflict.

Isolate malformed/missing/stale research per card, retain its last-known copy, report evidence/reason/direct dependencies/nextAction, and publish independent valid cards. Shared knowledge/feed/spoiler/build/release failures still block publication. If the private rating/control read fails, do not invent empty eligibility or release a partially read control snapshot; report the outage and retain prior public data.

Canonical publication rebuilds public editorial projections and existing communications sources. The private content workspace reconciles generated Hook/email/social/live material through its existing source-change lease, preserving manually edited communications drafts and marking handoffs stale. No email/social sending. Numeric feed-version slugs and invalid-partial-run recovery remain mandatory.

Publish scoped changes to GitHub main and dispatch `sportscal-production.yml` with that exact SHA; require all existing gates, READY production releaseGitSha, alias and exact served bytes. Then run `node scripts/update-cards.js --adaptive-editorial --record-release <verified-sha>` to record matching served editorial as published. Report GitHub, deployment and desktop/mobile/PWA evidence separately. No-change runs stay quiet unless a new actionable failure appears.

Local scheduled runs need the existing service-role environment. `NS_EDITORIAL_ENV_FILE` may point to an access-restricted production environment file outside Git; never print or commit it. If unavailable, fail explicitly rather than reading preferences or guessing rating signals.

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

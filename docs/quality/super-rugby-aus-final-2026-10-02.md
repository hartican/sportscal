# Super Rugby AUS final access and host review — 2 October 2026

Status: scoped implementation and verification in progress; production acceptance follows below only after exact-snapshot verification. No wider Rugby or monetisable-MVP certification.

The existing Western Force–NSW Waratahs final on 3 October retains its fixture identity, participants, scheduled 06:30 UTC / 16:30 Sydney start, status and original sporting observations. The venue changes from the retained World Rugby value “Hale School” to **Scotch College Playing Fields, Swanbourne, Perth**. Its source-qualified venue observation is separate from score/status freshness.

[Rugby Australia’s host-team announcement](https://www.rugby.com.au/news/hmp-joc-return-boost-force-grand-final-scotch-2026930), published 30 September and observed at `2026-10-02T08:24:48.810Z`, identifies that venue, a 14:30 WST start and free organiser YouTube coverage alongside Stan. The [Waratahs announcement](https://www.rugby.com.au/news/wilson-back-as-waratahs-set-for-super-rugby-aus-grand-final-in-perth-2026930) agrees on the venue and 16:30 AEST start. The live published kickoff already agrees; a different TV programme start is not a sporting correction. No clock is changed by this module.

The final now offers YouTube before Stan. The exact fixture, competition, finalists and Australian calendar date bound this extra option; it does not infer free rights for unrelated matches or another season. [Rugby.com.au’s channel](https://www.youtube.com/@rugbycomau) loaded publicly with HTTP 200 and the expected channel title at 08:31:29.062 UTC. This is a channel landing, not a promised match permalink or verified playback. Stan keeps its earlier 05:17:58.761 UTC rights observation. Unchanged source dates do not advance merely because a free option is added.

## Implementation and verification

Use the existing reviewed rights register, shared presentation helper, reviewed exact fixture repairs and canonical `scripts/update-cards.js --viewing-reconciliation` owner. Inspector/Schedule retains separate venue provenance. No scheduler, provider poll, database mutation, subscription or browser credential is added. Follow, exclusions, Results privacy, user activity and ordinary retention remain governed by the existing decisions.

All 832 canonical coverage records are unchanged. Both 694-record Rugby projections keep every ID and order; only this final’s viewing, venue and venue provenance differ. All 1,064 published event rows are unchanged. Existing unrelated Cricket/Football/editorial facts survive. Concurrent account-intent/reminder work from main is retained, with its own declared production/database and physical-device limits.

Retained early failures: a new exact-fixture rights rule initially bypassed the older competition-bound test; the rule now requires both reviewed identities. The projection initially omitted venue provenance; the actual projection contract caught it and the shared field is retained. The browser assertion initially compared mixed-case text with an uppercase Schedule label; the diagnostic established correct rendered venue and the assertion now tests the same concrete wording case-insensitively. One local command targeted a nonexistent validator; its output is retained and excluded from passing check counts. None is treated as a release exception.

Acceptance requires exact public data/API and card URLs, visible host venue, preserved source dates/IDs/facts, normal release gates, fixed startup budgets, both cached upgrade rehearsals, READY status, aliases and served-package hashes. Emulated browsers do not prove physical iOS, Home Screen or match playback.

## Next Rugby repair: second Bledisloe identity

The 10 October opening Test agrees with the organiser’s 06:10 UTC clock. For 17 October, Rugby Australia’s [structured match 949627](https://www.rugby.com.au/match-centre/3/2026/949627) and [New Zealand Rugby’s schedule](https://www.allblacks.com/team/all-blacks/bledisloe-cup) agree on 05:00 UTC / 16:00 Sydney. Raw HTML and parsed observations are saved separately at 08:24:46.814 and 08:24:48.442 UTC. The curated app row still says 04:45 UTC; the WR row says 05:45 UTC. Ticket and broadcaster clocks differ; their relationship to kickoff is not assumed. A fresh anonymous API at 08:30:07.696 UTC returns the WR identity at 05:45 UTC, despite `stale: false`, and omits the requested curated identity. Transport freshness does not certify sporting truth.

Read-only preflight found **33 exact event references: 12 analytics and 21 operating references** across the reviewed event tables, plus a reminder-intent row and saved-state text presence in one account. The future fixture has unresolved predictions under both IDs, current ratings, original credits, a campaign and two pending unclaimed reminders. No alias, consolidation, settlement or replay has been applied. The preceding past-match migration deliberately rejects these future/pending states; copying it would be unsafe.

Recommended next module: reconcile this exact future fixture atomically, keep the curated identity and legacy response keys, latest current prediction/rating plus full history, every original earned credit, explicit reminder intent and each installation’s receipt. Update unsent timing without replaying delivery; preserve private room boundaries and saved state. Test the current reminder-intent schema, old RPC replay, concurrent OFF/erasure, idempotence, guarded recovery and app-before-database cutover. Keep original score/status observations separate from host timing. A display-only alias must not hide activity or create a duplicate award.

## Business value and effort

This delivery gives users a sourced free option and correct venue for an imminent Australian final. Added service cost: A$0. Owner-time impact: no recurring task or new decision. Implementation is a bounded metadata/projection repair, with existing browser/release verification. It depends on organiser evidence and existing fixtures rather than broader provider procurement. Act before the final; defer worldwide Rugby rights and full-family certification until their individual gates pass.

The next Bledisloe module is estimated at 1–2 focused engineering days, confidence medium, with production activity, pending-reminder races and recovery rehearsal as dependencies. Source evidence is ready; durable reconciliation is not implemented. Acceptance is one source-backed fixture whose activity remains accessible without lost credits, altered consent or replayed reminders. Full programme acceptance remains 0/3 Football pilots and 0/16 families, against the at-least-13/16 target.

Evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`, including `super-aus-*`, `rugby-host-clock-live-api-20261002.json`, and `rugby-bledisloe-{activity,constraints,saved-state}-preflight-20261002.json`. No production refresh was run for this investigation.

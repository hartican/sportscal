# Public Feed — settled specification

22 October 2026. **Specification settled; implementation remains deferred and requires its later allocation.** Existing owner: Public Feed, chat `01a1624e-098f-71f3-a337-6a7d14aaf939`. This updates the existing queue item; it creates no task, publisher, scheduler or release exception. Preserve the established tail order: existing higher-priority work, Public Feed, then All Sports View. The earlier five-minute/30-minute batching proposal is rejected and superseded.

## Implementation allocation — 24 October 2026 Sydney

Jack authorised the full settled feature through Flot and DEPLOY, targeting the 24–25 October weekend without a reduced preview or guaranteed completion date. Work is isolated on `codex/public-feed-20261024`, initially based on accepted `9df58ea0faf9c1497abc9de09a44b31516b0536d`. The 22 October deferral above is historical; this allocation permits implementation and a draft PR, not a new publisher or production activation. DEPLOY retains queue ordering, final review, generated shell/cache version allocation, migration activation and publication. Existing paused jobs remain paused.

Comment-alert expansion depends on the final reviewed PR37 opt-in shared card adapter (`cardState`, `onCardStateChange(nextState)`). Its host owns ephemeral expansion and focus; it must not persist Follow/admission/seen/open choices. Do not copy its renderer or critical generated runtime. The adapter remains under its original owner and may change before acceptance.

Resource hold: continue light source/API/DOM checks; local native browsers, VMs and PGlite engine runs require renewed DEPLOY headroom allocation. No implementation-complete, Ready, hosted or physical-device claim follows from those light checks. Release acceptance below remains required in full.

## Fixture discussion

Add a public discussion tray directly below the full details of existing Feed fixture cards, with Instagram-like placement. The full card and comments scroll together on phones; do not pin a separate summary or introduce a separately scrolling comment pane. Update comments live while the tray is open. Reading, expanding and posting require a registered signed-in account; anonymous/guest Auth sessions do not qualify. Identify authors by existing public @handles and stable internal ownership, without private identities. Reuse registration/profile flow when a handle is needed.

One public thread belongs to each canonical fixture identity, preserving aliases and account-switch fencing. Keep public discussions separate from private fixture-chat rooms and their membership limits. Support one reply level; roots and replies are public to registered readers. Load lazily on expansion with bounded cursor pagination/deltas and the existing active/quiet/hidden polling budget, rather than whole-Feed polling or a new real-time service.

## Votes and media

Support upvotes and downvotes, ranking by net score. Each registered account has one changeable/removable vote per comment. Preserve reply parentage and stable ordering/scroll anchoring during live changes. Comments and votes earn no automatic NSC reward.

Allow text, emojis and GIFs only. Retain the existing GIF unlock at 25 lifetime NSC points, picker, provider and attribution checks. Reject photo/video/other attachments and embeds. No moderation workflow is requested for v1; authentication, escaping, account controls and bounded requests still apply.

## Followed-commenter notifications

Add a separate **Comments from people I follow** switch, on by default, respecting global/device opt-outs and delivery permission. Eligibility requires both a followed author and a fixture already in the recipient's Feed. Neither comments nor notification links may manufacture sporting follows or Feed admission.

Group separately for each recipient and fixture by consecutive runs among followed commenters, including replies. The first comment starts one alert; further comments by that same followed author remain in it. Another followed author starts a new run and re-arms the previous author. Unfollowed commenters neither notify nor reset the run. Required examples: followed A,A,A produces one alert; followed A, unfollowed B, A produces one A alert; followed A, followed C, A produces three alerts. There is no timed window or cooldown. Edits and votes do not start runs; add no unrelated reply/mention/vote categories.

Use the existing transactional outbox, guarded delivery/erasure leases and push/inbox infrastructure. A bounded comment-write-triggered attempt and existing dispatcher recovery must share one claim/deduplication owner. Preserve distinct run events even when delivery is delayed; do not replace them with five-minute aggregation or a once-per-author/fixture key. Add no parallel scheduler, provider, paid service or permission change. Record this dated grouping exception in the authoritative notification/backend records only when implementation is allocated.

## Retirement and yearbook

Live discussion retires with its card under the existing seven-Sydney-calendar-day rule, including verified-date and ongoing safeguards. Personal dismissal must not delete the shared thread.

Before deleting eligible thread/media data, successfully freeze up to three highest-net-voted entries on qualifying yearbook/EPIC cards. Replies compete with roots in the same ranking. Preserve text/emojis and @handle, remove GIF/image references, skip GIF-only/blank entries and use deterministic ties. Preserve genuine personal 5/5 in any phase as the existing EPIC qualification. Retain existing yearbook privacy, account-erasure, spoiler and export rules; create no new archive or qualification. Capture failure/retry belongs to existing maintenance ownership, not a second purge/archive scheduler.

## Later integration and acceptance

Reconcile with then-current accepted main, not the planning chat's old `30e2e8a` checkout. The current archive contract is `docs/plans/epic-fixture-archives-2026-10-14.md`; canonical identity, Feed, notification and maintenance owners remain authoritative. Update applicable decision records and regressions together during later implementation.

Required future acceptance covers registered versus anonymous access; handles/private identities; shared card/tray scrolling on phones/desktop; live inserts/votes/deletes and stable position; reply integrity; positive/negative/switch/remove votes; GIF boundary 24/25 and rejected media; all three exact notification sequences; recipient/fixture isolation, opt-outs, account switches, duplicate delivery and delayed dispatch; seven-day Sydney/DST retirement without personal-dismissal deletion; top-three roots/replies, GIF stripping, blank skipping and ties; existing personal-five qualification and yearbook export/privacy/erasure. Preserve Feed, startup, backend and normal release gates. Real device notification receipt remains separate acceptance proof.

Evidence: settled owner handoff received in DEPLOY on 22 October; direct latest human choices verified in turns `01a16394-2c44-7393-95f1-6b83899f5a78` (separate default-on switch) and `01a1637f-ada5-7271-b93c-625187649b42` (replies share the ranking). Original queue instruction is recorded in the authoritative delivery plan. This document claims no implementation or production release.

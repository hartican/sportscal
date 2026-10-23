# Public Feed implementation evidence — 24 October 2026 Sydney

Status: **Working; source candidate, not Ready or deployed.** Full scope follows [the settled specification](../plans/public-feed-2026-10-22.md). Isolated branch `codex/public-feed-20261024`, initially based on accepted `9df58ea0faf9c1497abc9de09a44b31516b0536d`. The feature branch was reconciled with current main `634496cef48ba6061c9c8f3c0ea1c4aed5dccd00`; both overlapping decision-record entries were retained. DEPLOY owns integration, schema activation, final shell/cache version allocation and publication. Existing paused jobs remain paused. No production data/config, shared database, provider refresh, scheduler, VM or native browser was operated for this evidence.

## Source scope

- `config/public-comments.js`, new optional `public-comments-ui` source/bundle and builder: bounded text/vote/ranking policies, one public tray, one-level replies, stable nodes/focus/scroll, adaptive polling, account lifetime fences, idempotent draft handling and existing GIF picker/provider reuse.
- `lib/public-comments-api.js`, additive `api/chat.js` route: registered server authentication, canonical fixture lookup and existing retirement policy, bounded query/media validation, service RPC only, private no-store responses and bounded write-triggered outbox attempt. Existing SDK is unchanged; actual SDK query construction is tested, including revision zero.
- Migration `20261023222545_public_fixture_comments.sql`: forced-RLS service-only tables/functions, canonical threads, revision/delta/tombstone pagination, votes, account limits, transactional followed-author runs, claimed installation receipts, existing erasure write guard, identity/privacy revisions, retirement and immutable text-only EPIC quotes. Installation preference defaults on.
- `lib/public-comment-alerts.js`, additive dispatcher/preferences/inbox/navigation hooks: exact followed-author runs, live Feed/follow/privacy/consent checks, existing guarded sends, bounded claims/delivery, explicit rejection versus uncertain outcomes, existing maintenance owner and cold installed-worker handoff. Discussion URLs use `?discussion=<canonical-id>` so old generic friend-fixture routing cannot manufacture Feed admission.
- Existing EPIC API/UI plus `lib/public-comment-archive.js`: personal archive ownership, late author visibility/erasure filtering, Results OFF suppression, text/emoji/handle rendering and complete quote export over continuation pages; GIFs are excluded.
- Follow/backend decision records and canonical/production QA now reference `validate-public-feed.js`; all previous gates remain. `jsdom@26.1.0` is pinned as a development-only DOM-test dependency.

## Required integration dependencies

1. **PR37's final reviewed transient card adapter**, still owned by All Sports View and under ROOT review. Public Feed consumes `buildEventCard(event,{mode:'schedule',cardState,onCardStateChange(nextState)})`; host expansion/focus are ephemeral and persist no Follow/admission/seen/open/card-state choice. No renderer or generated critical runtime is copied. Default personal Feed behavior stays with its original owner. The candidate explicitly fails if the adapter does not honor its requested state.
2. DEPLOY must review/apply the new migration through its existing erasure/permission/rollback gates before activating application callers. No hosted schema change or hosted advisor result is claimed.
3. Existing dispatcher/maintenance invocation must be allocated by DEPLOY. A write-triggered attempt is bounded recovery assistance, not proof that paused scheduled recovery or automatic retirement runs. No job may be resumed by this feature owner.
4. ROOT allocates final generated shell/cache versions and exact installed-upgrade qualification. Critical `index.html`, SDK and generated app runtime bytes are unchanged in this branch; optional UI changes still need final cache/source binding.

## Verification observed locally

Executed lightweight checks with Node v25.9.0; bundled Node v24.19.0 also passed the light aggregate. Final qualification is reserved for ROOT-allocated Node v24.21.0 at `/Users/jackhartican/.npm/_npx/387698761821791d/node_modules/node/bin/node`. These are synthetic/in-process source checks, not hosted or physical-device proof.

Passed:

- `node scripts/validate-public-feed.js --light`: generated public UI binding; policy limits/net votes/all three run sequences; authenticated API/canonical ownership/media bounds; delivery consent/follow/Feed/private-author gates, idempotency and guarded sends; actual DOM safe text/replies/stable controls/newer-draft preservation/account switches/retirement/failure backoff; actual existing SDK revision-zero polling; existing GIPHY picker and 24/25 gate; transient adapter contract; Results OFF and full 500-codepoint emoji export; cold/deferred route and actual worker failed-navigation recovery.
- `node scripts/validate-backend-efficiency.js`
- `node scripts/validate-follow-decisions.js`
- `node scripts/validate-epic-api.js`
- `node scripts/validate-year-review-alerts.js`
- `node scripts/validate-notification-landing.js`
- `node scripts/validate-notification-dispatch-recovery.js`
- `node scripts/validate-chat-fixture-media-plan.js` after the ROOT-authorised deterministic registry repair described below.
- `node scripts/build-app-shell-runtime.js --check`
- `node scripts/validate-feed-performance.js`: static source/budget gate only, seven critical requests and unchanged generated critical runtime. It does not infer browser timings from old reports.
- `git diff --check` and new database test syntax.

Preserved baseline failure: `validate-chat-fixture-media-plan.js` stops at line 21, “the published Follow schedule must contain tennis fixtures.” Current schedule has 517 rows and zero matching tennis rows. The tested script and schedule match the branch base byte-for-byte: Git object hashes `b78fb8aa81904a93c5cf39ee59f5eb174dcf68c3` and `ba3bf7dff6306d421c41ba4e01f76839bed102ed`, respectively. DEPLOY independently confirmed the same data on current main `634496ce` and authorised the affected test repair. The revised gate unconditionally runs the actual registry builder/API reader with a deterministic tennis fixture, proves that missing inclusion fails the same assertion, and retains the check for every actually published tennis fixture plus all original auth/media/GIF checks. Production sporting data is unchanged. This synthetic regression does not claim current tennis coverage. The original failure is not a current normal-production-workflow blocker: DEPLOY confirmed this script is outside its existing 250 commands.

Earlier database RPC checks passed on the previous local PGlite fixture before the resource hold. **They do not qualify the final migration**: later retirement-proof and erasure/delta coverage changes still require fresh execution. The default full aggregate gate runs the actual migration/RPC tests sequentially on PostgreSQL 18 (`@electric-sql/pglite`) and PostgreSQL 17 (`pglite-pg17`), including capture-failure rollback, seventh-day boundary, more-than-100 deltas, hard-erasure invalidation and blocked-peer cascades. These engine runs are currently held by DEPLOY's Mac resource allocation.

## Open acceptance, not waived

- Final migration on both engines with complete current erasure/ACL inventory; ROOT-owned hosted schema checks and safe activation.
- Combined PR37/Public Feed source review and actual app phone/desktop behavior: full fixture/tray scrolling, live insert/vote/delete position/focus, paging/replies, existing GIF picker/private-chat coexistence, explicit unavailable/retired failures, account changes, Results controls and no persisted navigation choices.
- Native Chromium/WebKit and installed worker upgrade/offline/source/cache checks on the exact final source, under the allocated resource lane. JSDOM does not establish layout, genuine hit targets or browser behavior.
- Real followed-account runs/delayed delivery/opt-outs and actual physical-phone notification receipt. Synthetic guarded-send success is not a phone receipt.
- Automatic seven-day Sydney/DST retirement and capture retry through the existing owner. Existing EPIC real personal-five qualification stays unchanged and must pass its normal gate.
- Current accepted-main reconciliation, original normal production gates, exact published SHA/hosted runtime and fresh served bytes. No release exception or assured weekend date is claimed.

## Safe handover and rollback

Use this isolated feature branch for a draft PR. Stop before Ready until required qualification is accepted by ROOT; do not merge, apply schema or deploy from here. Root may roll application callers back to its prior accepted snapshot while preserving the additive tables/migration and user comments for controlled normal retirement. Do not drop user comment/archive tables or delete outbox rows as an ad hoc rollback. New uncertain delivery receipts must never be blindly replayed.

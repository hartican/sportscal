# Chat administrator confirmation — 4 October 2026

Recommendation: retain the existing chat admin allowlist, but require server-reported confirmation of that email before it grants administration. This focused privacy repair belongs to the CTO audit's isolated authorisation acceptance. It does not resolve full account erasure, production configuration recovery, Football rights or physical-device gates.

## Verified finding and fix

At base main `c7984a7d`, the actual chat handler reads the user through the existing Supabase Auth endpoint, but its chat-admin predicate checked only whether the normalized email appears in `CHAT_ADMIN_EMAILS`. An isolated Auth response containing an allowlisted email and no email confirmation returned HTTP **200** for a room where that account had no membership. The same real-handler test expects **403** and failed before the fix. The original log is retained.

Four lines now require a non-anonymous user with a valid, non-future `email_confirmed_at`, before evaluating the same allowlist. No browser claim, user metadata or phone/generic confirmation can supply this evidence. The existing fresh server Auth check and erasure guard remain. Confirmed administrators retain their existing read, management and deletion powers; ordinary members, creators and guest controls remain unchanged. No additional request or database query is added.

This is a verified authorization-predicate gap under controlled returned Auth identities. Its exploitability in production depends on the provider's actual sign-in/confirmation configuration and available accounts; neither exploitation nor historical disclosure is established. The change does not prove mailbox control when a provider is configured to auto-confirm. Keep email confirmation policy and managed admin identity lifecycle as service configuration requirements; do not describe this test as a complete security audit.

[Supabase's current user-object documentation](https://supabase.com/docs/guides/auth/users) distinguishes email-specific confirmation from `confirmed_at`, which can also represent phone confirmation, and identifies anonymous users separately. [The getUser contract](https://supabase.com/docs/reference/javascript/auth-getuser) supports the existing server Auth read. These sources were checked 4 October Sydney. Two broad MCP documentation searches returned tangential email-template/password results; direct reads of these known official pages supplied the relevant field definitions. No undocumented endpoint or production setting was changed.

## Acceptance, value and limits

| Requirement | Evidence or acceptance limit |
|---|---|
| Reject privileged identity gaps | Six actual-handler identities: absent, null, invalid, future, phone-only confirmation and anonymous-with-email-confirmation. Each must receive foreign-room 403 with no private content, ordinary/denied account search without admin email access, and rejected share management without changing the room. |
| Preserve legitimate behaviour | Existing confirmed-admin searches, sharing, reads and moderation remain passing. Current nonmember isolation, forged/disabled/rotated links, guest attestation, member/creator actions, room limits, replies, reactions, notification idempotency and closure tests remain. |
| Isolate the test | Existing actual handler and trusted-service request seam with synthetic Auth/REST/Storage data; no production query, account, invitation, chat message, push or customer deletion. These tests are not live RLS, suspension, email-policy or disposable-production proof. |
| Keep one operating owner | Existing private-chat validator and normal release workflow; same API, database schema, Auth read and no new scheduler. No client bundle, shell version, sporting identity/fact/clock or Follow rule changes. |
| Business value and priority | Prevent an unconfirmed/anonymous allowlisted identity receiving private-room or admin-picker powers. Act now because the predicate is a narrow, reproduced trust gap; do not defer it behind commercial or sport expansion. |
| Effort, dependency and cost | One focused server predicate plus regressions; depends on fresh Auth's email-specific evidence and the existing configured allowlist. A$0 new service purchases; existing CI/model cost unmeasured. Normal confirmed admins gain no extra owner setup, decision or weekly routine. |

The red-to-green check runs `node scripts/validate-private-fixture-chat.js` through the existing installed development dependencies. All 134 normal local release commands pass in 138,179 ms. The 1,277 tracked sporting/provider/configuration/schema/Supabase SQL/client/shell/deployment files match the prior snapshot exactly. Local, published and production evidence are separate. Exact published deployment proof must pass before calling this repair live; saved evidence is under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`, prefix `chat-admin-confirmation-20261004`. Production/rendering status is recorded there after release, not inferred from the local test.

The broader programme remains open: 0/16 sport families and 0/3 Football pilots certified, target at least 13/16. Keep suspended-user semantics, historical identities, accepted Storage transfers, external delivery/caches, independent recovery, authenticated viewing and physical-device acceptance distinct. The change does not create a cohort or prove repeat use. Return to Football/source acceptance as those external evidence gates become available.

# Notifications inbox verification — 22 September 2026

Implementation branch: `codex/notifications-inbox`, based on `0a575f6` from current `origin/main`. The original checkout and its unrelated edits are preserved.

## Verified

- Header moves Settings and Calendar beside Share; bell remains in the second action row.
- Browser checks at 320, 390, 430, 768 and 1280px cover header alignment, full-screen mobile/right desktop sheet, visible-item read batching, Results-controlled previews, keyboard dismissal and restored focus. The 390px flow also opens the reward destination, restores inbox scroll on Back, and clears private rows on sign-out.
- Database tests cover message grouping and reset, notification/chat read separation, old-version acknowledgement rejection, cross-account reads, removed membership, deleted message previews, combined social rewards, invitation non-acceptance, reminder deduplication, stable pagination, retention and denied client grants.
- API tests cover missing authentication, anonymous guests, malformed cursors/bodies, read batch bounds, account-derived ownership, method restrictions, cache policy and the existing notifications-function rewrite.
- Existing notification, backend-efficiency, shared-chat UI, profile-avatar, user-follow, live-rating, Hobby cache/client/deployment, server-feed, Follow-policy parity and F1 checks passed. Runtime bundle is regenerated and shell/worker/app-version agree on 280.

## Database rollout

Migration `20260921220040_notifications_inbox` is applied to `nothingSport-recovery` (`mkghopnkhcxtmfrcjdbc`). A rolled-back trial preceded application. Live verification confirmed all six source triggers, denied direct authenticated table/RPC access, and an empty-account summary response. Security advisors reported only the expected informational no-client-policy notices for the two server-only inbox tables. Records begin at this migration epoch; no history was backfilled.

## Verification limit

The existing `validate-private-fixture-chat.js` fails on its September 15 historical ODI snapshot assertion because the current published fixture registry marks that fixture completed. Neither that validator, the chat API eligibility implementation nor the fixture registry was modified by this work. The new inbox database/API/browser tests and existing shared-chat UI and push tests passed independently.

Authenticated production UI and physical-device delivery have not been verified. GitHub publication and production deployment are separate from the local implementation and applied database migration.

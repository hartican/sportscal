# Account erasure: operator preflight and completion gates

Updated 27 September 2026. Current production database: `nothingSport-recovery`, `mkghopnkhcxtmfrcjdbc`. This procedure is deliberately incomplete until the synthetic end-to-end rehearsal passes. It does not authorise deleting a real account without its verified request.

## Read-only preflight

1. Verify the request belongs to the exact account. Profile hiding is not account erasure. Keep account identifiers and any exports in restricted operator storage, not Git, routine reports or public artifacts.
2. Run `node scripts/account-erasure-preflight.js --schema-query`. Execute its SELECT against the current recovery project. Save the returned JSON array outside Git. Obtain fresh metadata for each request; do not use the historical audit inventory as live authority.
3. Generate counts using `node scripts/account-erasure-preflight.js --schema <fresh-schema.json> --user <exact-UUID>`. Inspect the generated SQL, then run it in the SQL editor. It opens a read-only transaction, limits statement and lock times, checks account existence and counts each direct reference. It has no deletion mode. If the client displays only the last result set, run the account-existence SELECT separately.
4. Review RESTRICT/NO ACTION blockers, SET NULL/SET DEFAULT retained rows and CASCADE effects. Counts overlap and must not be added as unique records. A schema change or timeout is incomplete evidence, not a zero count.
5. Separately inventory indirect keys, JSON/text identities, email-based communications, device-linked data and Storage object paths. The generator does not discover these. Check views such as sport statistics against their underlying data rather than treating them as independent deletable records.

Before the shared-chat migration, 27 September: 64 direct public references, comprising 43 CASCADE, 18 SET NULL and three RESTRICT relationships. The restrictions were chat messages `sender_id`, rooms `created_by` and members `added_by`. After the migration, live verification confirms 43 CASCADE, 20 SET NULL and one RESTRICT (message sender). Push installations and reminders used SET NULL at that point; the 28 September follow-up below replaces those two relationships. A sentinel-UUID run executed all 64 generated count queries successfully with zero matches. This proves query compatibility, not successful erasure of a populated account.

## Required handling before destructive automation

- Stop future reminders and revoke private calendar access. Deleting Auth alone does not establish that detached installations and reminders are harmless.
- Map avatar originals, expanded images, public thumbnails, chat attachments and saved media through application metadata as well as Storage ownership. Server-uploaded objects may not have the user's Storage owner value. Use Storage APIs for object deletion, not SQL deletion of metadata alone.
- Resolve shared chat ownership and attribution without deleting other members' content or assigning the departed person's words to another real user. Design and test the necessary schema change or ordered cleanup explicitly; never blindly cascade a whole room.
- Treat account export separately from erasure. Export only the requester's authorised information; exclude credentials and other people's private content. Do not introduce indefinite backup copies of erased information.
- Revoke all sessions and verify refresh rejection plus sensitive application and direct API access. Existing JWT lifetime needs separate proof. Current normal logout uses local scope and is not an all-device erasure procedure.
- Record residual caches, expiring signed URLs and narrowly justified retained audit data. Do not promise immediate removal from already downloaded browser caches.

Supabase's [User Management](https://supabase.com/docs/guides/auth/managing-user-data) and [User sessions](https://supabase.com/docs/guides/auth/sessions), checked 27 September, explain Storage ownership deletion restrictions and the need to account for already issued access tokens.

## Acceptance and retry proof

Use a disposable account populated with follows, ratings, shared chat, media, reminders, push and calendar state. Test partial failures and safe retry. Reconcile preflight and post-operation records; confirm other members' content remains correct. Check public/private object access and session/refresh rejection. Save only a minimal completion receipt with scope, timestamp and unresolved retention. A successful Auth delete or profile visibility change alone cannot close the request.

No real-user erasure has been performed. Direct and indirect preflights, an isolated SQL rehearsal and a disposable chat/Auth/Storage rehearsal are available; full account-data coverage remains required.

## Indirect preflight (27 September 2026)

Run `node scripts/account-erasure-indirect-preflight.js --user <exact-UUID>` before Auth deletion. Inspect and execute the generated read-only SQL alongside fresh direct-reference counts. It produces counts only, never email addresses, object names or message content. Missing tables/columns or timeouts are a failed preflight, not empty results.

Nine explicit checks cover reward eligibility arrays, current-email subscriptions, avatar cleanup paths, UUID-prefixed objects in six known Storage buckets, uploaded attachments, other people's replies and room memberships, saved-media ownership mismatches, and reminders through account-linked installations. Counts overlap. `preserve` rows describe other people's content; `stop_if_nonzero` requires investigation before erasure. An absent Auth email yields NULL (unverified). Detached installations, old email addresses, arbitrary JSON identities, anonymous device hashes, caches, logs and unknown Storage paths remain outside these checks. This is not a post-erasure certificate.

Fresh metadata revealed 93 account-reachable foreign keys across 55 public tables: 64 direct and 29 indirect, including a composite prediction key and a self-referencing reply key. Reachability alone does not establish ownership or permission to delete. The current media-save route only lets uploaders save their own attachments; the mismatch check verifies that assumption for the account. A sentinel run against recovery succeeded for all nine checks, with no account present and email correctly unknown. No populated erasure was performed.

### Shared-chat design for the disposable rehearsal

Preserve rooms containing other members, their memberships, messages and saved objects. Migration `20260927131800_preserve_shared_chat_after_account_erasure.sql` makes room `created_by` and member `added_by` nullable with SET NULL. Remaining members keep access but do not inherit creator deletion rights; admins retain their existing authority. Message `sender_id` remains RESTRICT, requiring explicit message handling before Auth deletion. Remove the requester's message content and attachment objects through an ordered, retryable workflow; existing reply SET NULL behaviour must preserve other people's replies. Never transfer authorship to another real account. Explicitly decide whether empty private rooms can be removed after proving they contain no other member's content.

The rehearsal needs two disposable users, a shared room, replies, media and notification state. Capture private scoped lineage before deletion, inject a Storage failure, retry, then verify unaffected peer access, no surviving requester objects, session/refresh rejection and reminder cessation. Local SQL generation and sentinel checks do not prove these outcomes. The isolated PGlite rehearsal now exercises real PostgreSQL constraints using canonical chat table definitions. It proves message blocking, transaction rollback and safe retry, retained shared rooms/memberships, and reply detachment. It does not run Supabase Auth, Storage, RLS or session services.

## Isolated SQL regression

`node scripts/validate-chat-erasure-database.js` runs in memory, requires no credentials, and never connects to production. PGlite is a pinned development dependency, not application runtime code. This test and the departed-creator API regression are mandatory release gates. The test deliberately retains the sender foreign-key safeguard; no generic or public deletion endpoint is introduced.

References checked 27 September: [PGlite in-memory PostgreSQL](https://pglite.dev/docs/) and [PostgreSQL foreign-key actions](https://www.postgresql.org/docs/current/ddl-constraints.html).

Production migration verified 27 September: both attribution columns nullable/SET NULL, message sender NOT NULL/RESTRICT, all three tables retain RLS and deny anon/authenticated direct writes. Security advisor categories/counts were unchanged; existing anonymous-sign-in and leaked-password-protection warnings are not resolved by this phase. No production rows were deleted.

## Disposable live chat/Auth/Storage rehearsal

`CHAT_ERASURE_LIVE_QA=1 node scripts/validate-chat-erasure-live.js` is an explicit operator integration test, not a customer erasure command. It only creates and removes its own two confirmed `example.invalid` accounts, one room and two Storage objects on recovery. It has no arbitrary target-account parameter, sends no invitation, keeps credentials in memory, and uses a private temporary recovery manifest containing test-only IDs/paths. Successful cleanup removes the manifest; failed cleanup retains it and stops. `CHAT_ERASURE_REPORT` optionally writes a counts/checks-only JSON receipt outside Git. Do not run this on every release; the isolated SQL regression remains the routine gate.

Verified 27 September: first object removal followed by an injected runner failure retained both attachment rows and messages; retry removed both objects. Global logout rejected refresh; subsequent ordered own-message/Auth deletion preserved peer membership/reply and live API access without creator deletion rights. Old access tokens were denied by Auth and live chat (403 is a valid denial alongside 401). Cleanup removed both disposable accounts, the room and media; an independent aggregate query found zero remnants.

Limits: the injected failure is not a real Storage outage. This test runs explicit ordered operations, not a reusable customer-erasure orchestrator. It does not cover ratings, follows, reminders, calendar tokens, all indirect identity data, public/CDN/browser caches or signed-URL lifetime. Do not expose account deletion as complete from this result.

## Notification lineage repair — 28 September Sydney

Migration `20260927142249_remove_account_owned_notification_data_on_erasure.sql` changes the two account foreign keys on push installations and reminders from SET NULL to CASCADE. Auth deletion therefore removes account-owned installations and their dependent reminders, plus reminders still owned by that account on a reassigned device. Peer-owned and truly anonymous installations/reminders remain. This migration does not delete any existing rows, change normal logout behavior, relax RLS or add a public account-deletion endpoint. The direct-reference inventory becomes 45 CASCADE, 18 SET NULL and one RESTRICT.

`validate-notification-erasure-database.js` uses canonical table definitions in PGlite, reproduces the original orphan, verifies transaction rollback and retry, and requires preservation of peer and anonymous records. It is a routine production gate. The opt-in disposable live rehearsal now seeds future-only notification state and non-routable test endpoints. Its private recovery manifest tracks installation IDs, and finally cleanup explicitly removes its own installations even after a partial failure.

Live recovery proof at 2026-09-27T14:25:31.698Z: two disposable accounts were created and removed; owned/reassigned-device reminders were removed; peer and anonymous notification state survived until explicit test cleanup. Chat/media/session checks still passed. Both tables retain forced RLS and deny direct anon/authenticated writes; security advisor categories/counts were unchanged. No real account was deleted and no push message was dispatched.

This proves deletion of stored future notification state, not cancellation of an already in-flight external push. Full erasure orchestration must still quiesce writers/dispatch, handle all indirect identities and Storage, revoke sessions, reconcile every data category and disclose residual caches. Calendar/rating/follow coverage and the complete customer workflow remain open.

## Saved preferences and private calendars — 28 September Sydney

The opt-in disposable rehearsal now creates preferences through authenticated `PUT /api/user-state` using the current patch contract, reads them back, and creates private calendar subscriptions through authenticated `POST /api/calendar`. Both secret calendar links return an ICS document with no-store caching before erasure. Calendar tokens stay in process memory and are omitted from the report and recovery manifest.

Live proof at 2026-09-27T14:35:12.397Z: deleting the test owner removed its user-state and calendar rows, denied its old authenticated preference read and made its previous calendar link return 404. The peer retained exactly its saved preferences and a working private calendar. Finally cleanup verified that both accounts' user-state and calendar rows were absent. Existing chat/media/session and notification preservation checks also passed. No migration or runtime behavior change was needed.

Scope: this exercises the saved-preference document and calendar access, not canonical crowd ratings, directed social follows, every retained identity or device caches. Calendar applications may retain previously downloaded events; server revocation does not erase a remote cache. The rehearsal still uses explicit ordered operations rather than a complete customer-erasure orchestrator. Earlier exclusions describe the evidence available at those dates.

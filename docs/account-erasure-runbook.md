# Account erasure: operator preflight and completion gates

Updated 27 September 2026. Current production database: `nothingSport-recovery`, `mkghopnkhcxtmfrcjdbc`. This procedure is deliberately incomplete until the synthetic end-to-end rehearsal passes. It does not authorise deleting a real account without its verified request.

## Read-only preflight

1. Verify the request belongs to the exact account. Profile hiding is not account erasure. Keep account identifiers and any exports in restricted operator storage, not Git, routine reports or public artifacts.
2. Run `node scripts/account-erasure-preflight.js --schema-query`. Execute its SELECT against the current recovery project. Save the returned JSON array outside Git. Obtain fresh metadata for each request; do not use the historical audit inventory as live authority.
3. Generate counts using `node scripts/account-erasure-preflight.js --schema <fresh-schema.json> --user <exact-UUID>`. Inspect the generated SQL, then run it in the SQL editor. It opens a read-only transaction, limits statement and lock times, checks account existence and counts each direct reference. It has no deletion mode. If the client displays only the last result set, run the account-existence SELECT separately.
4. Review RESTRICT/NO ACTION blockers, SET NULL/SET DEFAULT retained rows and CASCADE effects. Counts overlap and must not be added as unique records. A schema change or timeout is incomplete evidence, not a zero count.
5. Separately inventory indirect keys, JSON/text identities, email-based communications, device-linked data and Storage object paths. The generator does not discover these. Check views such as sport statistics against their underlying data rather than treating them as independent deletable records.

Verified 27 September: 64 direct public references, comprising 43 CASCADE, 18 SET NULL and three RESTRICT relationships. The restrictions are chat messages `sender_id`, rooms `created_by` and members `added_by`. Push installations and reminders use SET NULL. A sentinel-UUID run executed all 64 generated count queries successfully with zero matches. This proves query compatibility, not successful erasure of a populated account.

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

No real-user erasure or populated-account rehearsal has been performed by this preflight phase. The next implementation step is the indirect/Storage inventory and shared-chat deletion design, followed by a disposable-account rehearsal.

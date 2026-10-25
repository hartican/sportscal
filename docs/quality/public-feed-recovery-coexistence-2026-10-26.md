# Public Feed recovery coexistence qualification

26 October 2026, Sydney. **The scoped SQL coexistence test packet is qualified locally and ready for ROOT's existing review/integration lane.** Full Public Feed remains Working, after full All Sports. This is not native, managed, hosted, device or release acceptance.

## Exact source and scope

The existing Public Feed database harness now installs the complete accepted user-state table, forced RLS, owner policies and grants from `supabase/nothingsports-user-state.sql`, including the backend-only snapshot SELECT grant. It loads the complete actual `fixture_alias_v1`, `cricket_preferences_v1` and SECURITY DEFINER `preferences_guard_v1` statements, the real `cricket_preferences_v1` user-state trigger, and their actual recovery-schema/function revocations from the existing Cricket recovery migration. It does not execute that migration's unrelated historic data repair/backfill.

All three input files are SHA256-bound to accepted main `87958d3b87b739cef84c5f087a20a6b234a49997` / tree `ecc62bdc14106f3bb03bb4508850e0651b20638c`, which retains accepted 594 recovery foundations. The constants in `scripts/lib/public-comment-recovery-coexistence.js` are checked against the actual working-tree source; drift fails before a database starts. No copied recovery implementation, weakened policy or replacement private guard is introduced. The local `auth.uid()` fixture uses a disposable synthetic JWT-subject setting; it is not live Supabase Auth proof.

The product migration `20261023222545_public_fixture_comments.sql` remains byte-identical to separately qualified `e14550f6`. The old frozen `eaae7be0` and its original validator/receipts remain in history; this revision intentionally extends the test harness only. The complete existing comment/RPC/erasure/inventory/retirement/yearbook regressions still run.

## Added checks

The same real database connection exercises the following before and after applying the unchanged feature migration:

- Already-canonical legitimate owned insert/save preserves explicit OFF, empty, unknown future fields, pins, minimised/spoiler choices, archive and ratings. Conditional owner/timestamp updates accept the matching version and persist nothing for a stale base. These are SQL-boundary checks, not a real API/HTTP round trip.
- Owner RLS prevents cross-account reads and updates; inserts, ownership reassignment and deletion are refused. Missing/nonexistent identities and invalid schema/document shapes cannot persist changes. Unknown legitimate preference fields stay preserved.
- Anonymous reads, direct recovery-helper access and service-role user-state writes remain denied; the existing backend SELECT grant stays usable. Trigger execution still reaches the complete original recovery policy and its known normalization behavior.
- Catalog fingerprints compare forced RLS, policies, ACLs, recovery function bodies/attributes, trigger identity/type/arguments and canonical erasure attributes across migration. Removing only the already-reviewed public-comment derived-update clause/declaration yields the accepted erasure body, ignoring blank lines only. Existing saved rows remain exact.
- The existing multi-peer public-comment erasure scenario also creates real protected account state. A blocked owner's attempted save passes through the real recovery BEFORE trigger and is refused by the real canonical erasure AFTER guard, with the whole row unchanged.
- A separate test-only deferred Auth-delete probe raises only after actual user-state/comment cascades have completed. The failed statement must restore Auth metadata, full user states, live rows, votes, parent/thread revisions and tombstones. The probe is then removed; actual Auth deletion must erase the subject's state and preserve the peer's entire state before the existing peer cleanup completes. The production guard remains installed throughout.

The emitted completed-group count describes named coexistence groups in one engine connection. It is not an independent native test count, a concurrent-transaction test, a complete nine-phase erasure/storage workflow, or customer recovery.

## Bounded execution

Use existing Node 24.21.0 and existing pinned PGlite modules only. No dependency install/download, container/VM, network, managed query/migration/grant, provider, fixture refresh, scheduler, notification or customer action is required.

```bash
node --check scripts/lib/public-comment-recovery-coexistence.js
node --check scripts/validate-public-comments-database.js
node scripts/validate-public-comments-database.js --recovery-source-check
node scripts/validate-public-comments-database.js
PGLITE_MODULE=pglite-pg17 node scripts/validate-public-comments-database.js
```

The source-only flag exits before loading PGlite. The normal pair runs PostgreSQL 18 then 17 sequentially once at frozen source, stopping on the first RED and retaining its receipt/log. Preserve the existing 4.5 GiB entry/3 GiB running disk reserves, 120-second child timeout and bounded output. Historical eight SQL modes are not rerun for this addition. Any retry requires an identified causal source correction; a product defect returns to ROOT before broadening the feature scope.

## Observed result

The allocated normal pair ran once, sequentially, on frozen test source `4ccb4913` with Node 24.21.0. Both exited 0 without a retry, setup failure or product-source correction:

| Engine reported by the actual connection | Module | Elapsed | Result |
| --- | --- | ---: | --- |
| PostgreSQL 18.3 / `180003` | PGlite 0.5.8 | 3,353 ms | Existing full SQL harness plus 17 completed coexistence group invocations passed |
| PostgreSQL 17.5 / `170005` | existing `pglite-pg17` alias | 2,093 ms | Existing full SQL harness plus 17 completed coexistence group invocations passed |

Those 17 invocations are six behavior groups before migration, one migration-preservation group, the same six groups after migration, one blocked-save group, one completed-cascade rollback group and two actual Auth deletions. They are not 17 native cases or a claim of 17 distinct group names. The first deletion checks the peer's entire state; the second completes that peer's erasure.

Both stderr logs are empty. The local child preload forbade outbound HTTP/fetch/socket/DNS calls; no block fired. Entry space was 13,666,349,056 bytes and the existing disk/time/output caps were retained. Both children and in-memory databases closed normally; no browser, VM, container, download, managed query or shared operation ran.

External proof: `/Users/jackhartican/Documents/AI/Codex/public-feed-20261024/recovery-coexistence-20261026/2026-10-25T23-08-21-588Z/receipt.json`, with separate per-engine stdout/stderr logs and the actual offline preload. The receipt binds the exact full source SHA/tree, six source hashes, actual connection versions, commands/modules, duration, output hashes and completed group invocations. Only this quality record changes after the paired run; code-source hashes are retained in the publication handover.

## Handover and remaining gates

ROOT owns the accepted actual managed function/ACL/trigger fingerprint and activation order; this local source-bound fixture cannot certify deployed schema. Exact combined All Sports/Public Feed source, generation/version/cache budgets, all 60 prepared Public Feed native outcomes, installed upgrade, managed permissions/full erasure/storage, hosted freshness, notifications/provider/push/device and normal release gates remain open. No feature reduction, new publisher or automation resumption follows from this qualification.

Rollback for this test-only change removes the helper and its database-harness hooks. There is no product SQL inverse, data deletion or shared-service action.

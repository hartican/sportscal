# Match Centre receipt join — source handoff, 30 October 2026

## Scope and fixed point

ROOT/nsDEPLOY allocated reversible application-source implementation from
`98af9164d15cddfb198fd35cd9e226b267723216` after native qualification passed.
The sole runtime change is the existing Match Centre reader's receipt join:
join receipts to the selected `(source_id, fixture_id)` before the unchanged
parameterised payload lookup, instead of after it. Both are still left joins
on the same composite identity; the lateral payload lookup retains `OFFSET 0`.
This removes repeated receipt scans without changing the returned match data.

No new fixture, Follow admission, Results setting, notification, source adapter,
provider request, writer, table, scheduler, cache, retry or deadline is added.
All original closures, fallback, observations, ordering, two 5001 sentinels,
5000 caps, lookup semantics and clocks are byte-identical inside the function.
The temporary native workflow/controller/client are excluded from product source.

## Existing measured proof; do not repeat

ROOT run **41041100314**, artifact SHA256
`8a9e3af97de55fdd0a071903e16738efdd3c7104e901c4fb1049f3d40b737af0`,
qualified the body relocation on disposable native PostgreSQL 17.6 and 18.3.
Full ordered 985-row responses matched. Fixed ABBA medians were
450.855295 to 162.059809 ms on PG17 (64.055% less) and
400.7686625 to 182.4796795 ms on PG18 (54.468% less).
The receipt scan changed from 4831 rows over 985 loops to 4831 rows once.

Both engines passed 111 existing regression checks, exact inverse/later-fact
preservation/reapply, drift negatives, independent 20-row equality, non-object
receipts and the relational multiplicity boundary. Separate 5001-row overflow
reads in ABBA order each retained full ordered equality and `complete:false`
under five seconds in one snapshot/transaction/backend; this overflow result is
not the 985-row performance sample. Cleanup confirmed all tracked resources.
There were zero production or provider calls.

Earlier invalid-workflow, password-file, stream-order and aggregate-overflow
failures remain dated failed attempts. Their historical causes are not upgraded
to proven explanations. The final qualified packet and full evidence remain at
`/Users/jackhartican/Documents/AI/Codex/near-snapshot-diagnosis-20261030/native-qualification-overflow/`.
Native proof covers the query body, not this new production guard, managed
installation, full HTTP download/parse, app release, browser or physical phone.

## Guarded production change and inverse

Forward: `supabase/migrations/20261030104046_reorder_match_centre_receipts.sql`.
Inverse: the same basename under `supabase/rollbacks/`.
The migration file was created through the existing CLI's `migration new`.
Each transaction uses a five-second statement and one-second lock limit.

Before replacement, both directions require exact definitions and attributes
for all 27 existing functions plus the sealed private near-table structure,
indexes, constraints, owner, ACL and forced RLS. They require the exact input
body and unique rewrite boundaries, construct an exact reversible rewrite,
then verify the canonical output and all contracts again. A replay or drift
refuses the transaction; it cannot silently replace a newer implementation.

Only `CREATE OR REPLACE` of the existing reader is executed. There is no
DROP/recreation, data DML, helper or table installation, backfill or privilege
change. Its original owner/ACL/attributes and dependent identity remain.
The inverse restores the exact old reader while retaining later normal facts;
it does not restore an old database snapshot.

| Contract | Original | Candidate |
| --- | --- | --- |
| Full function definition MD5 | `efc32656d8c100d80543001a2c5e6b48` | `09c1fb11e09a04dfa5c58350d7153e39` |
| Function body MD5 | `3e1d234315b0eae31e2fc4ec491de3dd` | `402458f178989eed547f96e2ce2995c1` |
| Readiness helper definition MD5 | `98503336cb97173edfcf1129fd14673a` | unchanged |

## Permanent local checks and release wiring

The new opt-in factory builds the actual current coalesced writer and indexed
reader. Historical factories and their input/output expectations stay intact.
The existing regression function accepts an explicit full candidate contract
list; its default and every existing assertion are unchanged. The new suite
requires all 27 contracts, with exactly the one reader-definition difference.

`validate-near-receipt-join.js` runs the actual forward/inverse/reapply, 20
deliberate function/owner/ACL/body/missing-reader/helper/private-table refusals,
both replay refusals, full ordered original-indexed-reference comparisons,
service-role access, receipt shapes and source/fixture binding. Equal fixture
IDs from different sources retain their own receipts, zero scores, stale flags
and original fact dates. All 105 existing unpadded functional regressions run,
including current writer derivation, membership, aliases, fallbacks, malformed
data and permission checks. The same unchanged derivation helper adds its six
existing controls (one derivation per changed identity, unchanged publication,
combined changes, checked direct-service path, contrary no-op and the exact
rejected double-derivation negative). Thus the native report's 111 existing
checks are the same 105 named entries plus these six, not a different set of
assertions. All named entries match the retained native artifact after only
test-clock labels are normalized. The new total is 111 existing plus 41 added,
or 152. Later facts survive exact inverse and reapply.

Run separately with the pinned local dependencies:

```sh
NEAR_EVIDENCE_DIR=/absolute/output/pg18 node scripts/validate-near-receipt-join.js
NEAR_EVIDENCE_DIR=/absolute/output/pg17 PGLITE_MODULE=pglite-pg17 node scripts/validate-near-receipt-join.js
node scripts/validate-production-sql-batches.js
```

Both engines passed 152 local checks each. The two historical functional-only
engine runs verify the regression's unchanged default independently. These are
disposable Wasm SQL/source checks, not repeated native speed experiments.

The normal production workflow adds both new engine commands to its existing
near-selection matrix batch. Every one of the existing 260 command occurrences
remains required; the total becomes 262. All 253 publisher commands keep their
exact order/environment. Four batches, four-worker cap, 30-minute job cap,
main-SHA binding, dependency, secrets boundary, serialized release lane and live
loading gates remain unchanged. The arrangement validator retains all 23 prior
negative controls and adds four for the new commands (27 total).

## Acceptance boundary and handover

This source handoff does not apply managed SQL or publish, merge, refresh or
deploy. ROOT owns independent review, exact-main integration and generated
assembly through `node scripts/update-cards.js`, the guarded managed change,
required combined/full gates and production publication. The unchanged near
adapter gate still measures complete download, parsing and consumption within
four seconds, providing headroom inside the approved five-second user limit.
Reminder deadlines remain separate and unchanged.

If a required gate fails, stop the affected release and retain its evidence.
ROOT may use the exact guarded inverse if recovery requires it; do not overwrite
drift, alter customer state, replay notifications or run warming requests.
Workflow, immutable READY, exact `releaseGitSha`, aliases, served bytes, hosted
behaviour and database changes must be recorded separately. Physical iPhone
receipt remains a separate evidence goal, with no outstanding owner question.

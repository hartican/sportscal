# Indexed near selection — isolated candidate

This candidate reduces the work needed to select the Match Centre's nearby
fixtures. It does not change the match list, observations, Follow admission,
Results choices or reminder policy. It is prepared for DEPLOY review; it is
not production adoption or a loading-recovery claim.

## Starting point and mechanism

The exact stored D9 reader is
`d9b49086166c24b3a10b4dc1f7279b7c`. Its seed and independent uncertain-clock
lookup decode raw facts throughout the catalogue. The actual current-coalesced
PG17/18 local RED returned20 fixtures while visiting12,860 raw fixture rows
with6,400 unrelated fixtures. Earlier shared-scan/memory prototypes remain
closed; this candidate does not reuse their changes.

One private typed row stores status, strict start kind/time, latest completion
evidence, unqualified-completion and uncertain-clock flags. Completion evidence
does not become an actual finish time. No original clock or fact is changed;
no payload, receipt, membership or customer data is copied. Explicit minute precision
remains distinct from D9's stricter seconds-required seed grammar.

Indexed unions select keys without per-lane truncation. The original source
membership, ordered5001 sentinel, transitive identity/token closure, exact
two-element sides comparison, receipt expansion and final point projection
remain. Uncertain clocks enter independently of the seed/source join.

## Ownership, transactions and permissions

The preimage requires the CURRENT coalesced22 contracts, original D9 attributes
and ACL, original triggers, generated compact base/view and private boundary.
Only three existing owners change:

- `sync_fixture` rebuilds typed facts after its context-upsert diagnostics and
  before its existing zero-change return. Its token algorithm is unchanged.
- `sync_trigger` preserves its owned `batch_xid`/`batch_pid` deferral first.
  Existing fast returns also recompute typed facts, covering completion-only
  changes omitted from the older selection descriptor.
- `mark_integrity_pending` invalidates only affected OLD/NEW composite context
  identities. It never repeatedly rewrites an already-unready row.

The new table has forced RLS and service SELECT only. One narrowly granted,
void definer helper with an empty search path derives canonical facts. It cannot
bless a contrary direct context mutation: complete canonical/context equality is
required. No service arbitrary eligibility writes, new trigger owner, scheduler,
API, retry, memory setting or deadline change is introduced.

The new foreign key cascades current composite-key updates as well as deletions.
A deterministic control proved that delete-only metadata would wrongly reject
a current-row move accepted by the original owner after its old context was
removed. The permanent check requires that allowed move to remain accepted,
while original context/score FK refusals remain. No additional owner changes
were needed.

Until every current row has valid metadata and original pending/key coverage
is settled, one statement calls the exact original D9 reader. Staging/backfill
is explicit, bounded and DEPLOY-owned. Installation does not backfill. Direct
context changes retain original fallback/descriptor/error semantics until a
legitimate canonical writer recomputes them.

## Local checks and their limits

Run from this repository, with existing pinned dependencies:

```sh
NEAR_EVIDENCE_DIR=/absolute/output/pg18 node scripts/validate-match-centre-near-selection.js
NEAR_EVIDENCE_DIR=/absolute/output/pg17 PGLITE_MODULE=pglite-pg17 node scripts/validate-match-centre-near-selection.js
```

`--original-red` asserts the same work budget against the actual stored original;
its expected failure is retained evidence. `--functional-only` is the small,
fast semantic loop and cannot qualify performance. The historical test factory
stays unchanged; the new fixture explicitly installs and checks all CURRENT22
contracts before constructing data.

Both engines must compare complete ordered stored JSON text, bytes and hash.
Plans must actually exercise the ready branch; opaque fallback cannot fake a
zero-work pass. Admission work counts include rows removed by filter/recheck,
typed scans and reported index-only heap fetches. Complete key-only readiness
coverage is measured separately, with no raw fixture/score expressions. Local
timings, write cost, storage and RSS are reported separately from native latency.

Coverage includes status/clock/null/overlay/completion variants, alias chains,
far matches, delimiter collisions, independent uncertain clocks, score/current
deletions, first-complete-only changes, actual coalesced combined writes and
unchanged fast returns, owned-batch pending reads and rollback, direct context
insert/update/delete/movement, malformed-descriptor errors, private ACL/RLS,
service DML refusal, actual5001 overflow and guarded exact inverse.

The inverse restores D9 first, then the same three owner functions, before
dropping new helpers/table. It seals all candidate function attributes/rights
and the complete new table/index/constraint contract, refuses drift/replay or
active leases, and proves all original22 contracts plus D9 after recovery.

Single-connection WASM PostgreSQL cannot establish independent-client concurrency,
physical/native first-use speed, transport/download/parse latency or installed
iPhone experience. Those remain DEPLOY gates. No new native/service/provider
checks, production DDL/backfill, canonical refresh or publication are performed
by this module.

Final local qualification passes125 controls per engine on PG17.5 and PG18.3.
The20-result/6,400-padding case visits20 full raw rows plus39 typed admission
rows, versus12,860 original raw visits. The separate complete key-readiness
check still scans the6,420-key catalogue; it is not a constant-work claim for
the entire request. Both stored full-text/byte/hash oracles agree within each
run. Different run timestamps mean hashes across the two constructed runs are
not expected to match.

One retained rich replay preserves all7,670 fixtures/7,661 scores from16
hash-verified public buckets, with zero raw/compact/score/identity/first-completion
differences. It returns399 complete rows from19 sources: both original and
candidate are1,110,013 bytes with SHA256
`1883de269a21f76ef2b2d3de36da25184e9e91bb3cd05ee48906a64df8c25596`.
This is historical, non-atomic captured data, not a fresh sporting observation.
That rich run precedes the FK correction. Removing only `ON UPDATE CASCADE`
from final migration bytes reproduces its exact recorded migration hash; all
27 reader/derivation/owner function contracts are unchanged. Reuse covers those
unchanged read semantics; final FK/schema, movement, deferred commit, rollback
and inverse controls are separately requalified on both engines. See the
dated evidence/reuse manifest under the handover output folder.

## Sole-lane acceptance

DEPLOY must review the frozen source before allocating native qualification.
Require exact full-output equivalence, cold/warm complete-response measurements,
material first-use gain and at least500ms headroom inside the approved five-second
interactive deadline. Ordinary global reads retain their later approved six-second
total allowance; selected/scoped reads and reminders keep their original budgets. Preserve the
existing loading feedback and last-good behavior. Native concurrency, source-first
bounded preparation, write allowance, exact inverse, all existing security/full
release/browser/installed/offline checks and repeated fresh hosted reads remain
required. A failed required gate stops adoption. DEPLOY alone integrates current
main, publishes and deploys that exact main snapshot. This module requires and
authorises no provider/card refresh; paused canonical refreshes and automations
remain paused. Any separately authorised card refresh must use the canonical
`node scripts/update-cards.js` owner. This draft performs none of those actions.

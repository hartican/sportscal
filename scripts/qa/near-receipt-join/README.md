# One source-only Linux native test packet

Current isolated overflow correction: read OVERFLOW-REQUEST-PROOF.md and the
current PUSH-BINDING.md first; historical notes below retain their original
failures/partial proof. Only the final5001 comparison now uses separate complete
A/B/B/A reads in one verified REPEATABLE READ transaction, each still5s/1s and
whole response/parse/proof <=5s. Exact text5001/completefalse remains mandatory.
All985-row equality/perf and other SQL/native/lifecycle/release gates remain.
SamePR117/-3, next exact before1404cd81abcc86c430f81a1bbeebb2205edf75a0.
No runtime/database/CI/push or managed change was made by this source worker.


Current ordered-wire correction: read ORDERED-WIRE-DIAGNOSIS.md and the current
PUSH-BINDING.md first. They supersede historical launch instructions below.
The latest run has PARTIAL PG17 speed/equality proof, but failed later and is not
qualified. This copy restores the retained single psql output wire, adds bounded
SQL/phase diagnostics, and uses ROOT's exact one-update before-carrier binding
on existing PR117/-3. No grants, denials, SQL, performance or release gates change.
No new runtime/CI/managed/push action has occurred here.


Connection setup profile3 only: follow PUSH-BINDING.md and the exact new branch/
workflow ending `20261030-3`. Run41032332223 reached a PG17 container but failed
decoding its first admin response; no QA database/workload/plan/ABBA was reached,
and all14 owned children/container cleanup were confirmed. Authoritative libpq
source identifies the invalid password-file setting as a probable cause; the
full old warning and linked client package were not captured. See
PASSFILE-DIAGNOSIS.md for evidence and limits. This profile replaces that setting
with an exclusively created/verified owned empty0600 file and retains bounded
diagnostics on fatal JSON decode errors. No warning filtering or weaker checks.
SQL/performance sequence/lifecycle/deadlines/images remain unchanged. No new
native/CI/database experiment, push, managed change or release occurred here.

Prepared for ROOT/nsDEPLOY review. **Not dispatched, installed, merged, run or
qualified.** No Mac runtime is required or revived. The previous Colima recipe
is superseded for runtime choice by this packet. The old evidence stays dated.

The real-data paired body comparison has already run exactly once under ROOT's
allocation. On its one snapshot, full ordered text was equal for all 984 rows:
2,811,180 SQL-text bytes and MD5 dcc9a96bbbb1cba59d60c0b6dd0f31ed. Original
reader plus text serialization was 2415.726 ms; candidate was 890.445 ms. The
candidate followed original buffer work. This is neither native qualification
nor app/HTTP latency, a cold result, general reliability, or release acceptance.

## Launch and review changes in this separate profile

Follow PUSH-BINDING.md, which supersedes the old manual workflow registration
recipe. No default/main branch registration, repository-rule change or event
spoofing is permitted. ROOT must bind a fresh nonce and immutable packet snapshot,
review the final capsule, then allocate its one actual branch-creation push.
The supplied genuine push workflow uses ROOT's exact immutable action pins.

Three targeted review fixes accompany that launch change: every interruption
invalidates success and preserves first failure; owned child exit must actually
be observed within the existing bounds; and the original plan must show the exact
4831-row receipt scan at 985 loops (4758535 visits), otherwise NO_REPRO. Marker/
error parsing, SQL, original factories/assertions, native performance sequence,
image/resource bounds, 600-second allocation and no-retry policy remain.

The separate packet checkout supplies only test assets. The product checkout
still pins the actual factory/migrations/regression code to
98af9164d15cddfb198fd35cd9e226b267723216. No npm/PGlite execution is needed.
ROOT retains the only publication and execution allocation lane. This source
packet has not been committed, pushed, run in CI or used against a database.

## Resource and deadline contract

600 seconds from the workflow's first timestamp, including checkouts/setup/image
fetches, with work stopping at 540 seconds and 60 seconds reserved for cleanup.
The 11-minute job ceiling allows result upload after the test's own hard stop;
it does not extend the test allocation. Engines run sequentially, one newly
nonce-labelled container at a time. Each has network none, no ports or binds,
bounded CPU/memory/pids and only tmpfs database storage. Explicit tmpfs covers
both official-image volume paths, avoiding untracked anonymous data volumes.
There are two fresh QA databases per engine, `perf` then `checks`, never a clone
or reuse of somebody else's database. Existing names are refused. The original
factory creates cluster-level test roles; absence is checked before each factory
run, their created OIDs are recorded, and only those exact roles are removed
after their QA database is dropped. This allows the unchanged factory to run
again without suppressing duplicate-role errors or touching pre-existing roles.

Native sessions start with 5-second statement and 1-second lock caps. Historical
bootstrap scripts retain their original local settings and guards. All measured
reads/plans explicitly use 5-second statements and 1-second locks; the
transport's 7.5-second host ceiling includes transfer. No changed planner switches
or extra attempts. Cleanup verifies
exact container ID/name/image/nonce/source labels and database OID/owner, closes
owned connections, drops only created QA databases, then removes only that
container. If a QA database drop cannot be confirmed, the independently verified
owned tmpfs container is still removed and that distinction is recorded. No
image pruning or daemon/context/service management. Failed or
unconfirmed cleanup can never pass. An interrupted create is recovered only by
the exact nonce-owned name and identity verification; uncertainty remains FAIL.

## Frozen qualification sequence

1. Verify packet hashes, exact clean source checkout, explicit engine/backend,
   Unix-socket connection, statement/lock caps and all original SQL guards.
2. Construct 45 sources, 143 live seeds plus 842 linked old completed rows,
   985 contexts and 4831 receipt entries. Preserve old/stale clocks, zero/null
   and opaque values, with a fixed 1800-byte wide field. Data is local synthetic
   data, not a recreation of unretained real fixture bodies. Record its hash
   before measurement and never tune it to obtain a result.
3. Run actual relational SQL boundary/multiplicity/NULL controls. Obtain one
   original and one candidate full source-body plan. Require the 985-fold
   original receipt rescan to reproduce, or stop NO_REPRO. Require candidate
   receipt visits bounded by twice receipts plus twice keys, over 10x less work,
   same 143 seeds/985 candidates/4831 receipts, and no extra temporary work.
4. Apply the exact guarded reader-only rewrite in that disposable QA database.
   Compare complete ordered original-reference and candidate text at the same
   statement, not just hashes or IDs. Run exactly A/B/B/A complete-response
   measurements (including native delivery and JSON parsing) with no warm-up
   or retry. Require >=20% median benefit independently on both engines, all
   responses complete and identical, and each below 5 seconds. This sequence has
   prior plan/functional buffer work and makes no cold-cache claim.
5. Check original/candidate permissions and guarded refusal/replay, deliberate
   ACL/attribute/helper drift, exact inverse and reapply. A fact written after
   forward must survive inverse; no data snapshot is restored.
6. In a second fresh QA database run the current complete near-selection
   regression function, unchanged. Only its one expected public reader-definition
   hash is overlaid, after independently asserting the exact two-fragment delta;
   no other contract/assertion is replaced. The original raw-reader oracle,
   statuses, aliases, moving clocks, nulls, malformed/failed states, permissions,
   direct writes and canonical publisher work controls remain. Also compare the
   private full indexed original, and actual 5001-row overflow, then inverse.

First failure, NO_REPRO, insufficient benefit, missing output or exhausted budget
stops subsequent work. No variants or duplicate experiments. This packet does
not replace the normal combined-tree native/compatibility gates, app preflight
with its unchanged 4000 ms headroom requirement, required CI, hosted/served
bytes/READY/alias checks, browsers, installed upgrade/offline, or device proof.
ROOT retains the only publication lane and decides subsequent allocation.

Preparation verification is limited to JavaScript syntax, six pure binder/plan
controls, six synthetic protocol/path controls, a Mac entry refusal, preservation
of the existing marker/error/command/query protocol, actual bounded owned Node
controller checks, pure push-context controls and retained-plan NO_REPRO controls.
The reviewed lifecycle changes are distinct from that preserved wire protocol.
These checks do not prove the Linux runner works. No native SQL, image
pull, container, managed
query, HTTP app/provider read, CI dispatch, source-tree edit or release occurred.

# Canonical public capsules v3 — 27 October 2026

Separate source/local unit over the sealed Rugby repair `f963c186` and producer
PR79 `7313177d`. ROOT explicitly allocated the new format after the retained850
rows measured2,399,979 bytes before envelope overhead. No current service read,
source update, database/native/browser work, CI dispatch or publication here.

## Explicit new budget, unchanged older formats

V1/v2 retain their2MiB **whole saved input** cap. V3 is a separate approved
contract: at most8 public capsules/pages, at most2MiB per capsule, and at most
4MiB aggregate **including its manifest**. The accepted manifest is at most
64KiB. There is no compression, truncation, fact pruning or implicit allowance
increase for the old formats, app startup, GLOBAL reader or HTTP transport.

The existing twelve-source selection,500 rows/page,8-page maximum,10-second
request deadline,2MiB streamed response bound and zero retries remain exact.
The same `sync-live-coverage.readRows` loop collects observations. One shared
`public-coverage-sequence` validator owns source/alias/sides/clock/order/hash/
terminal-page semantics for v2 and v3; v1 remains its existing constructed format.

## Saved set and canonical entrypoint

Capture-only form through the existing owner (implemented, no live invocation):

```
node scripts/update-cards.js --coverage-live --local-only --capture-live-coverage-capsules=/absolute/new-folder/public-coverage.json
```

One fixed `public-coverage.json` manifest binds ordered fixed-name parts
`public-coverage-page-000.json` through at most `...007.json`. Every descriptor
binds page/index, byte count, file hash, parsed rows/count/hash, logical request
and request hash, request/response timing, original sporting/planning-clock hash
and terminal short-page witness. File hashes bind literal saved UTF8 bytes;
row hashes describe parsed JSON. These are not literal HTTP wire hashes or
collector authentication. The original public schema remains closed: unknown
nested fields, contrary aliases/sides and unsupported structures refuse.

The manifest includes the explicitly new limits and expected reviewed SQL
metadata, never a fabricated transaction or capture-time definition query.
Original fixture/status/score/detail clocks and unknowns remain unchanged.
Service/test provenance stays explicit; `currentSourceAcceptance:false`,
`wholeSnapshotAcceptance:false` and `omissionsMayDelete:false` remain mandatory.

`--live-coverage-public=.../public-coverage.json` reads/validates the entire set
before the existing canonical sync can read or modify its sporting files. The
existing credential-free candidate capability loads the same executable
manifest, binds the manifest digest and retains all verified part bytes in
memory. Materialization copies that snapshot to its existing private runtime;
it never reopens caller parts after validation. No parallel reader, exporter,
private Follow control or staging/deployment path is introduced.

## Filesystem and failure boundary

Only canonical same-directory regular paths and exact assigned filenames are
accepted. Leaf symlinks/dangling links and parent path escapes refuse. Inputs
use NOFOLLOW descriptors, actual fstat size checks against descriptors **before
any part body read**, bounded reads, post-read and final fstat/namespace/parent
identity checks, and hashes. All descriptors close on failure. No missing,
extra, reordered or duplicate capsule/page is accepted.

All bytes are held as a validated private snapshot before source work. Changed
input after that boundary cannot change replay or packaged materialization.
This protects the specified local artifact boundary; it is not an OS sandbox
against a hostile privileged host. Existing process restrictions remain.

Output preflight rejects existing parts, manifests or dangling links before a
request. Its parent/namespace is pinned during collection and checked between
pages. Exclusive0600 files preserve last-good/other-owner files. The manifest
is written last, only after the complete public set validates. A write/readback
failure removes only files created by that operation and identified by inode;
foreign files are preserved. No partial set is accepted as source input.

Separate requests remain **non-atomic additive observations**. A short terminal
page proves traversal termination, not absence of changes between statements.
Hashes do not establish coherent whole-database completeness, authenticity,
private retirement or current freshness. Those remain ROOT's real-intake gates.

## Actual local proof and remaining closure

The initial owner test failed on the old2MiB page/envelope route. The new valid,
constructed rich850-row graph is greater than2MiB and less than4MiB, without
claiming it is real or current sporting data. It passes actual producer→saved
set→readRows/project/sync, unchanged reruns, source clocks and the canonical
capture/replay routes. A guarded actual CLI case rolls back on dependent
projection refusal; the real existing atomic owner also restores coverage,
generated candidate files and the runtime after forced validation failure.

Controls cover per-part and aggregate exact/+1 byte bounds, understated sizes
before body reads, privacy, aliases/sides/clocks, missing/mutated/reordered/
duplicate parts/pages, malformed JSON, extra files, links/parent escapes,
namespace and in-place TOCTOU, descriptor cleanup, output write failure, stale
observations, no extra page after refusal, immutable replay/materialization and
legacy v2 whole-cap refusal. The existing release validator chain includes v3.

An optional retained-file regression reads the original hash-bound historical
850-row response locally: its seven colliding Rugby identities still refuse,
with no output. The source-only Rugby parser repair does not reinterpret or
mutate that stored response. V3 size capacity never waives bad-side validation.

ROOT alone must qualify current definitions, actual public shapes, source
scope/aliases/collation, current bytes and freshness; allocate real capture/
intake; integrate generated outputs and pass normal release/public/hosted gates.
Full/unscoped quick private Follow/PDFKit/native/aggregate closure remains open.
Credentialed incremental/full refreshes and two natural scheduled successes
remain open; no manual/local run substitutes for them.


The initial understated-size control failed because declared sizes were checked
only after reading both bodies. Actual pinned fstat sizes now match descriptors
and the aggregate budget before any part data read; the control observes zero
part-body reads on refusal. A second red found loaded-capability manifest
mutation could reach materialization. That path now privately clones the set
and rechecks its original declared manifest bytes/hash, capture clock,
provenance and receipt binding before writing anything. It still never reopens
caller parts. These checks establish the saved artifact boundary, not source
authenticity or current sporting acceptance.

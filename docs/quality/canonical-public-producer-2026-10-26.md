# Canonical public observation producer — 26 October 2026

Source/local follow-up to frozen PR66 `2afd1baa0207c37ca19aaac306a67d9b1e2f24e8`,
stacked on PR65/63. ROOT/DEPLOY remains the sole integrator, publisher and shared
operation allocator. This module does not restore the full scheduled routine.

## Allocated contract and source evidence

ROOT allocated a real public producer beside the saved capture validator,
through the existing `sync-live-coverage.readRows` service boundary and
`update-cards.js` owner. A later explicit source allocation adds an opt-in
transport byte bound in the existing `supabase-server.js` client. No new
endpoint, reader owner, scheduler, credential, privilege or database schema.

ROOT's deployed metadata-only inspection recorded the existing stable,
security-invoker, service-only `nothingsports_read_current_fixtures(text[])`
definition MD5 `8f7e452c8a96f15ed11b50b4ea5cb751` and observation projector MD5
`44d1edfc00ada08fad8deb987472ad54`. Saved SQL/metadata are in
`/Users/jackhartican/Documents/AI/Codex/overnight-independent-delivery-20261026/deployed-functions/`.
They were read as source evidence; no function/data execution by this worker.
The producer records these as **expected reviewed definitions**, not definitions
queried at capture time. DEPLOY must qualify the actual definition at real intake.

The service reader joins source/current fixture JSON, split score JSON, stored
observation receipts and original first completion. Its JSON is open ended;
copying that whole privilege-bearing result without a closed field contract
was the missing boundary. Separate RPC pages are independent SQL statements.

## Implemented producer and field contract

The existing command owner has one strict capture-only form:

```
node scripts/update-cards.js --coverage-live --local-only --capture-live-coverage-public=/absolute/new-folder/public-coverage.json
```

This form is implemented, **not invoked against a real service in this slice**.
It rejects mixed/implicit modes and an existing/symlinked output path before
requesting anything. It calls `sync-live-coverage.capturePublic`, reusing the
real `readRows` pagination/source/overlap/terminal rules. It writes no sporting
or generated runtime file. Saving occurs only after the whole envelope passes,
with an exclusive0600 file; an existing saved input is never overwritten.
Request failures retain safe status/error classification without backend text.

The existing twelve-source selection, POST read body `{p_fixture_ids:null}`,
source/fixture order,500-row pages, maximum8pages,10-second page deadline and
zero retries stay exact. Producer request records exclude credentials/headers.
Each page records its actual requested/received times, exact logical request
and parsed-row hashes. Hashes cover `JSON.stringify(parsed JSON)`; neither
literal wire identity nor authenticity is asserted. A new2MiB saved envelope
uses schema `live-coverage-public-capture.v2`; the old constructed v1 remains.
The original2MiB allowance is not increased.

`public-coverage-schema.js` derives its closed shapes from the existing
`source-coverage`, `coverage-discovery`, `cricket-scorecard`, `cricket-current-results`,
`source-observation-identity`, pause and viewing records, plus the deployed
observation projector. It preserves supported original values, including:

- Raw/canonical/reviewed aliases and ordered known or explicitly unresolved
  participants; no new CA/ESPN durable mapping or name-based identity inference.
- Exact/date-only/TBC starts, published multi-day ends/windows, source status,
  Cricket phases/restart evidence and explicit unknowns.
- Original source/poll/fact/detail/pause/first-completion clocks and stale flags.
- Cricket innings, batting/bowling/fall-of-wickets/extras, source player order,
  declared/follow-on state, match day and supported chase details.
- World Rugby source time/status and scoped source query parameters; explicit
  public viewing provider/link/scope/review evidence and source consensus tags.

Unknown top-level **or nested** fields fail before public output, including
unqualified sporting structures. Nothing is silently stripped. It is a closed
versioned observation shape, not approval of arbitrary fixture JSON or every
possible future source field. Detailed semantic source/result/spoiler/release
checks remain mandatory downstream; capture itself never certifies a result.

V2 replays through the existing capture reader and `readRows/project/sync`.
The credential-free `coverage:shared` candidate accepts matching service/test
producer provenance, body hash and capture clock; NBL remains constructed-only,
full/unscoped quick stay refused, and all process/private/native/publication
fences remain. Handover distinguishes public/test observations from constructed
replay and retains `currentSourceAcceptance:false`. Saved files/provenance are
not signatures or publication permission.

## Transport bound and resource ownership

Only producer requests opt into `maxResponseBytes:2097152` on the existing
service client. Other callers omit the option and retain their original text/
JSON/error/timing/credential behavior. Invalid limits reject before any request.

The optional path requires an actual readable byte stream, counts delivered
bytes before accumulating/UTF8 decoding/JSON parsing, and cancels/releases on
refusal, read failure, caller abort or deadline. An identity content-length can
reject known oversize early; missing/dishonest headers never establish size.
Compressed content-length is not treated as decoded size. Missing streams fail
closed; no unbounded `text()` fallback. Late fetch bodies after cancellation
are cancelled too. The original whole request deadline covers EOF and parse;
HTTP error classification and isolated optional timing observers remain.

These are **fetch body bytes, potentially already decompressed**, not literal
wire bytes. Parsed/export envelope size is a separate2MiB bound; the original
page count/deadline and production performance policies are unchanged.

## Honest consistency and remaining operation

V2 explicitly says non-atomic, additive observations only, omissions are not
deletions, `wholeSnapshotAcceptance:false`, `omissionsMayDelete:false`.
Duplicates, observed order reversal/page overlap, wrong source/identity and
partial pages fail. A final short page proves traversal termination only:
unseen insertion/deletion between statements can still escape detection.
Neither page hashes nor expected SQL hashes create a coherent revision token.

This is sufficient only for the existing additive last-good observation owner,
which retains omitted records and refuses all-stale input. It does not grant
private protected-content retirement or whole-database completeness. If such
coherence becomes necessary, the smallest existing-owner unit must bind a
complete bounded export to a real snapshot/revision witness covering base,
split scores, receipt changes and row counts. No such SQL change is implemented
or assumed here; no parallel reader/export owner is proposed.

After source review/integration, DEPLOY must separately allocate one bounded
capture through the existing service path, qualify the actual public shapes,
source scope/aliases/collation and current clocks, then qualify the saved input
through the existing candidate/shared-data intake and current release gates.
Fixture replay uses an explicit capture clock; it never proves current freshness
or authorises promotion of an old response. Definition/provenance qualification
and source freshness require evidence outside the saved file's self-description.

Full/unscoped quick private Follow/PDFKit/native/aggregate closure, real shared
publication, credentialed incremental/full acceptance, hosted Cricket/WTA proof
and two natural scheduled successes remain separate and open. No workflow enable,
cron, manual refresh, provider research, service query, CI or deployment occurred.

## Local proof and release gate

The initial actual producer test failed because the producer owner was missing;
the initial transport test accepted an oversized stream and failed its required
rejection. A later real tuple-order test caught a source-prefix comparison bug;
this is now fixed by comparing source and fixture columns independently.

The scoped validator `validate-public-coverage-capture.js` now chains the actual
producer and byte-bound validators before its existing v1 boundary/CLI checks.
The existing normal `validate-update-cards.js` release gate invokes that chain;
no workflow/job/permission settings are changed.

Tests use four meaningful retained public rows with unchanged sporting clocks,
explicit test clocks and trapped requests. They cover actual producer→saved
file→real reader/project/sync, supported viewing, stale/uncertain/alias cases,
private/unknown nested fields, hash/provenance/time/duplicate/order/partial
refusals, no subsequent page after transport failure, unchanged reruns and
last-good retention. Actual guarded canonical CLI cases cover v2 unchanged
validation and complete rollback on dependent projection refusal. They are
source/local fixture proof, not current service or successful publication.

Transport tests use actual `Response`/`ReadableStream` objects: empty/one/multiple
chunks, exact/+1 size, UTF8 split chunks/BOM, missing/dishonest/compressed headers,
malformed/error JSON, missing stream, body failure, caller abort/deadline/late
fetch cleanup, timing observers, credentials and default no-option compatibility.
Explicit logs/hashes/counts belong in the dated source handback. Normal full
release, generated-output and live/native gates remain DEPLOY-owned.


A broader retained-only schema census then checked850 observations from the
same saved response:843 passed;7 were correctly refused for colliding opponent
IDs. Six men's World Rugby fixtures use `team:rugby:wr-0` for both NTH/STH
position labels; one women's fixture similarly uses `team:rugby:wr-0-women`
for both semifinal labels. These are unresolved source slots, not distinct
confirmed opponents. The producer does not silently drop them or weaken side
identity. This historical census is not proof of today's service contents.
If a future allocated intake still encounters this pattern, the next minimal
unit belongs to the existing World Rugby parser's `team.id=0`/unresolved-slot
representation, with unchanged fixture identity, raw labels and observation
clocks, or an explicitly allocated existing-owner per-card deferral contract.
That source repair is outside this producer/transport slice.

Independent Standards review caught a dangling-output-symlink preflight gap:
`existsSync` follows the link and could permit service reads before exclusive
save rejected it. The permanent trapped-request control first failed, then
passed after preflight switched to `lstatSync`, treating only ENOENT as absent.
The symlink itself remains untouched and no request is made.

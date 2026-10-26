# Accepted public-state reference packet — 27 October 2026

Separate source-only unit over frozen PR82/`6dce765a`. ROOT alone allocates the
actual existing-operator read. No capture, service/SQL/provider/native run,
source refresh, database writer, new RPC/schema, release or scheduler is added.
The Python program only receives stdin and saves an owned local artifact.

## Evidence and updated transport

ROOT's bounded read-only sizing measured 8,646 current and 8,646 score rows
across **40 fact-source IDs**, with **45 source metadata rows** and 44 receipt
keys. Allowlisted row JSON measured 30,493,797 bytes before this framing. That
suggests room under 40 MiB; the query must measure its actual representation.
Keep the 1,964,962-byte current row, including all 957 US Open children. Its size
and dates do not establish October GLOBAL admission or latency causality.

ROOT separately proved a synthetic 4,193,592-byte text/base64 transport through
the existing SQL connector, outer-envelope-only handling and a static stdin
receiver. Decoded bytes and DB MD5 matched; SHA256 readback preserved the large
integer, decimal scale, microsecond timestamp and Unicode. Base64 is transport
only. This supersedes the earlier proposed ban on base64 wrapping, not any
sporting value or raw artifact format. Whole 40 MiB tool delivery remains
unqualified. No large payload is embedded or evaluated as JavaScript/Python.

## One existing-operator query, separate actual allocation

`scripts/capture-public-state.sql` has one snapshot-bound SELECT inside READ
ONLY, five-second statement/one-second lock limits, UTC/ISO serialization and
ROLLBACK. All three table layers share that SELECT's MVCC snapshot. It reads
only existing current fixtures, compact scores and the source metadata/receipt
allowlist. It neither calls a publisher/provider nor copies proposed packets
back into storage. No account, intent, reminder, installation or profile table.

Before execution ROOT must bind the exact reviewed source and separately
accepted schema/definition metadata. Replace the **single**
`__CAPTURE_SOURCE_SHA__` marker with the frozen lowercase 40-hex source SHA;
validate that input and record the rendered SQL hash. Never interpolate data or
credentials. Record the operator window start and absolute epoch deadline
**before** the SQL request; the receiver must finish within that same 60 seconds.
There is no retry, alternate query or cap increase after refusal.

The query first counts all rows, then measures exact typed NDJSON UTF8 framing.
Bounds: 10,000 current, 10,000 scores, 128 metadata rows; 40 MiB decoded total
**including the manifest**, 64 KiB manifest, 4 MiB per complete row/part, at most
16 parts. In fixed kind/source/fixture order, put each whole row into the bin of
its cumulative starting byte divided by `(4 MiB - measured largest row)`. Starts
within one bin span less than that width; adding the last whole row stays within
4 MiB. A largest row equal to 4 MiB or a bin index beyond 15 safely refuses.
No sporting data
is returned when inventory, row, part or total bounds refuse. The bounded refusal
packet contains no values.

Before any real read, the saved sizing bounds plus this exact framing give
31,558,560 bytes and a maximum row of at most 1,965,057 bytes: width 2,229,247,
at most 15 bins, leaving 10,384,480 bytes before the 40 MiB total for a <=64 KiB
manifest. This is an arithmetic bound for the witnessed unchanged rows, not a
fresh snapshot or executed SQL result. The actual query remeasures everything.

Current rows retain source/fixture IDs, original ordered identity arrays, full
raw fixture, stored hash and updated time. Scores retain raw score, explicit
SQL-null flag, stored hash and original first completion. Current fixture and
identity-array SQL-null flags distinguish SQL NULL from JSON null/absence.
Metadata retains revision/check/due/failure count, receipt-key presence and the
raw `_fixtureObservations` value. Source JSON strings and numeric precision/scale
stay as PostgreSQL text bytes; timestamptz instants retain PostgreSQL precision,
not JavaScript milliseconds. No legacy duplicate source fixture array, lease
token, unrelated quota/media bookkeeping or raw error report is exported.

There is no universal source error column. The manifest requires
`reportErrorPresence: UNVERIFIED` and `readerContextAccepted: false`. Preserving
failure count and receipts does not manufacture an error-presence predicate.
This explicitly leaves full reader/health context and the release gate open.
The original REMINDER owner's source clarification confirms that a universal
error boolean is not required for this limited reference graph; its amended
contract is SHA256 `a7632ba03b84d6c517837f364a9bd4397dbb04399666016eb8a6872c783e1f1c`.

## Static data-only bridge and receiver

ROOT reuses its reviewed bridge: extract exactly the returned `capture_packet`
outer object, keeping `manifest_text` and base64 strings opaque. Send that
envelope as **stdin data** to this static file, with no payload embedded in code:

```
python3 scripts/receive-public-state.py --output /absolute/new-private-folder --source-sha <frozen-40hex> --deadline <original-window-epoch-deadline>
```

The receiver bounds stdin to 56 MiB, enforces the remaining absolute deadline,
validates the manifest/part list, decodes each at most 4 MiB part, compares its DB
MD5 and keeps the original UTF8 bytes. It verifies whole-row framing, complete
kind/source/compound identities, order, counts, receipt presence and the same
snapshot's globally ordered row-hash footer. Python Decimal is used solely for
inspecting raw numeric tokens; raw rows are never re-encoded or dates parsed.
Unexpected fields in the wrapper/column contract, known private keys,
duplicate keys/rows, truncation, missing parts or inconsistent hashes refuse.
The privacy guard is a known-key refusal, not independent certification that
every arbitrary string in current sporting tables is public.

Output uses an exclusive new canonical directory, mode 0700; fixed files are
exclusive, single-link regular files at 0600. Each part is reread for DB MD5 and
SHA256, and the entire saved set is rechecked before writing the manifest last.
Failures close descriptors, preserve the first refusal and remove only
inode-identified owned output; foreign files survive. If the OS cannot recover
an inode for cleanup, do not delete an unverified pathname. This is not an OS
sandbox against a privileged hostile host. No partial set is accepted.

Tool truncation or an undelivered whole envelope fails parsing/bounds/deadline;
it does not qualify a partial graph or trigger another query. MD5/SHA256 bind
bytes, not collector authenticity. ROOT retains the actual caller/definition,
transport result and accepted-state provenance receipt separately.

## Local proof and remaining actual acceptance

`python3 scripts/validate-public-state-receiver.py` exercises the actual static
CLI/stdin/filesystem with constructed text only: large numbers/decimal scale,
microseconds/Unicode, SQL versus JSON null, receipt absence versus explicit null,
exact/+1 4 MiB part and 64 KiB manifest, whole-manifest inclusion, count overflow
before decode, truncation, duplicate/order/private/scope/hash refusal, existing
output protection, deadline, write/read/close failures and owned cleanup.
Initial directory-stat failure reproduced a descriptor leak; cleanup-only inode
recovery, unconditional close and original-error preservation repair it.
Review also reproduced a deadline exception during final directory close and
an impossible absent-receipt/non-null-value combination, with hashes rebound.
Deadline exceptions now retain the same rollback/remaining-close path as IO
failures; missing keys require null extraction, while present explicit nulls
remain valid. Both controls failed before repair and pass after it.

No PostgreSQL/native execution or actual SELECT/framing result is proved by
these tests. Both source reviews and ROOT's separately allocated real query are
required; it may honestly time out, refuse a bucket, exceed framing limits or
fail whole-tool delivery. No generic full-capacity or healthy-service claim.
The result is only an exact public stored-fact/receipt reference graph. Actual
reminder saved-wanted membership stays private; physical/TOAST, full health,
HTTP latency, canonical full/quick, production and natural scheduled acceptance
remain separate. PR79/81/82 and their narrower projected caps stay unchanged.

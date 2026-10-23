# Global admission components — 24 October 2026 Sydney

Status: isolated implementation; no activation, production measurement or release.
DEPLOY alone owns qualification, integration, database activation and publication.

## Measured reason and scope

The closed clock-component trial retained SQL calendar admission, repeated
candidate/clock joins and patch inputs; its complete local gain was only 1.345%.
That trial remains closed. The matched-settings control preserves full original
bytes/consumer output, but a large managed/native execution difference remains;
it establishes neither an infrastructure cause nor an expected speedup.

This candidate instead reads the complete stored compact base/score/identity
inputs in one statement, with the existing context windows and source receipts.
It moves indexed-window validation, dynamic calendar admission and reconstruction
to the existing Node decoder. A single source-receipt CTE and single fact/score/
context join replace the repeated admitted-key joins. SQL still owns JSONB `?`
and `->>` conversions, raw timestamp strings, the existing distinct timestamp
parser, ordering/collation, statement clock and Sydney lower/upper date bounds.
These inputs include rows that will be excluded; there is no early 5001 limit.

No table, stored membership, generation cache, writer, owner hook, source request,
scheduler, retry, policy change or dependency is added. Prior cache, generated-
prefix, scalar, partition and clock-component candidates remain closed.

## Protocol and invariants

`x-ns-fixture-components: admission-v1` is fixed server code on the existing
service-only invoker view. The new envelope is `fixture-admission-components.v1`.
Unknown/malformed/absent headers and the older `clock-v1` header retain the exact
original fbc response expression. The original clock decoder remains compatible;
new code accepts legacy full responses, so app-first rollout and view-only undo
work without another request. Corrupt new envelopes fail through existing
last-good/stale handling; they do not trigger a retry.

All raw inputs, counts, identities, clock references and context transport fields
are validated before admission or reconstruction. A malformed/missing/versioned/
pending context follows the original raw fallback. Valid contexts preserve all
boolean/null/presence rules. SQL-provided fallback texts and nested calendar-edge
texts preserve array/scalar/object/numeric conversion semantics. Node neither
parses an observation timestamp nor recalculates a Sydney date/year boundary.

Admission preserves the original live exception, seven-day lookback, one-year
upper bound, raw YYYY-MM-DD pattern and inclusive lexical comparisons. SQL order
is retained. Only then are the first 5001 admitted rows selected; 5001 still means
incomplete/failure, never healthy truncation. Full fixture/alias membership,
original clocks/completion receipts, source health, Results/OFF/account choices
and scoped/reminder paths are unchanged. The source-health leg remains the
original separate bounded parallel read; this is not a new cross-leg snapshot.

Keep two resources, global six-second total (including bytes, JSON parse,
validation, reconstruction and hashing), interactive five seconds, strict
selected/reminder three seconds and dispatcher budgets unchanged. Only the
unselected global wire passes the trusted optional 64 MiB UTF-8 response limit.
The helper checks after `text()` and before JSON parse: this buffers the body,
and is not streaming admission or a hard peak-memory guarantee. Other callers'
undefined default retains their existing behavior.

## Checks, qualification and rollback

`validate-fixture-admission-components.js` runs on actual constructed PG17/18
engines using the existing disposable baseline. It compares the actual original
view expression with the new decoded result, legacy text equality, indexed/raw
fallbacks, source clocks, nonobject/SQL-null expressions, midnight/DST/leap bounds,
late valid rows and post-admission overflow, rights, guard refusals, committed
undo/reapply and unchanged facts/functions/permissions. It also covers UTF-8
limits, invalid limits, default/bad-JSON behavior, abort/error paths, two reads and
last-good failure. Existing clock-component and end-to-end budget checks remain.
The normal production workflow requires both new engine runs.

Next gate belongs to DEPLOY: use the existing captured complete workload and
root-controlled qualification tools, changing only this migration/header/decoder.
First require original full consumer values, ordered identities, aliases, clocks,
source hashes and revision to match, and measure actual raw bytes plus complete
consumer cost. Stop on any mismatch or >64 MiB. Only then allocate bounded
cold/warm full-frame control/candidate measurements including transfer/parse and
all consumer work; require >=20% net benefit and existing deadline headroom.
The larger raw response and parsing clocks for excluded rows may erase the
benefit; only the complete measurement can settle that. Constructed tests and
hot/local timings cannot substitute for fresh hosted gates.
No full-capture consumer replay or native/managed run is authorised here.

The forward migration requires exact original fbc, D7 projection, parser/projector
and private-view contracts. The inverse requires the exact candidate view and
restores original fbc only; mutable facts are never restored or redated. A failed
required check stops activation/release. DEPLOY subsequently runs the canonical
`node scripts/update-cards.js` release path and publishes/deploys the exact
accepted main snapshot. Browser/provider evidence remains separate from physical
closed-app phone proof.

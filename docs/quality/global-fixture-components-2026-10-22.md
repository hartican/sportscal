# Global fixture component compatibility — 22 October 2026

Source candidate only. No live SQL, main publication or deployment is claimed.
DEPLOY retains the sole activation/integration/publication lane.

The fixed server header `x-ns-fixture-components: clock-v1` selects
`fixture-clock-components.v1` on the existing service-only invoker view. The
legacy aggregate expression and all admission/candidate/clock CTEs are retained.
Only the final projection branches. Without the exact opt-in, the original full
`current-fixture-bundle.v1` envelope remains byte/value equivalent. No new table,
cache, writer, parser, permission, public request option or scheduler is added.

The existing global Node request supplies the header; near, participant, selected
and source-health calls do not. The transport helper already forwards headers,
so its authentication/credential code is unchanged. Both envelopes normalize to
the same existing snapshot validator and source/hash pipeline. Corrupt components
fail without retry; previous last-good facts retain their read time.

PostgREST documents transaction-local, lowercased JSON request headers and an
empty string after transaction end. The view handles absent/empty/malformed
settings safely as legacy, with no new helper or setting change.
[Official PostgREST 14 transaction settings](https://docs.postgrest.org/en/v14/references/transactions.html#request-headers-cookies-and-jwt-claims).

The decoder validates all map entries, rows and required map keys before any
merge. Explicit base/score SQL-NULL flags distinguish JSON null. SQL-NULL base
retains strict concat's null result; the existing global consumer then rejects
that invalid fixture just as it rejects the legacy row. Normal objects merge
once using safe own properties; arrays/scalars/null follow the original concat
branch. SQL-parsed timestamp strings and microseconds are never reinterpreted
through JavaScript Date. Object key order is not a canonical hash dependency:
`contentHash` sorts recursively, and nested field values are retained.

`validate-fixture-clock-components.js` is mandatory on PG17/18. It exercises
actual guarded SQL, legacy text equality/default and transaction reset, gated
transport, actual snapshot consumers, original observation/first-completion and
timezone strings, SQL-NULL/JSON-null/object/array/scalar/zero cases, special keys,
missing-map/corrupt inputs, all-before-any validation, last-good failure,
0/1/5000/5001 cases, service-only rights, unchanged functions and committed exact
undo/reapply. Existing historical fixture, profile, spoiler, deadline and budget
checks remain mandatory; this does not replace them.

Earlier sorted-decoder NO-GO remains historical. The later one-merge prototype
measured ~6.6ms standalone Node projection and ~10.2% complete local gain, below
the earlier 20% complete reference. Those numbers are not transferred to this
source candidate: explicit base SQL-NULL metadata is newly covered here. Its
SQL/Node/HTTP/cloud resource split and real complete headroom still need separate
owner qualification. No native/cloud, browser/installed/offline or phone acceptance
is supplied merely by local SQL tests. Cricket's shell/data/version bindings
remain untouched. Required failures continue to stop an affected release.

# Match Centre freshness receipts — source-only prerequisite

ROOT allocated this narrow implementation from exact7e6327e17defc4a2161f746d2f5814f2daf955b8/tree52f7d2e382373f9648931b00aeae430fc0309a9a.
Direct remote main verification matched; the unrelated malformed peach ref
prevented fetch. ROOT approved using the verified local object. No foreign ref
or unrelated checkout was repaired. Sync remains parked.

## Contract

Add response-level `scoreRead` and `freshnessReceipts` only. Existing fixtures,
events, model return values, Follow/Results choices, scores, original clocks,
selection, request IDs/caps/deadlines, scheduling and caches remain unchanged.
Do not nest diagnostics inside fixtures: an initial implementation made two
existing mounted-card lifecycle/fixture-JSON controls RED. Moving receipts to
the response level restored them without frontend or assertion changes.

`scoreRead` is a closed schema with outcome `not-needed`, `succeeded` or `failed`
and planned/attempted/completed/failed/pending/unattempted batch counts. Counts
record actual invocations and fulfilled/rejected promises. On first Promise.all
rejection, other requests can still be pending; the response snapshots those
counts, and later completions cannot rewrite its receipt. Synchronous rejection
also preserves unattempted batches. No request, retry, wait or cancellation is
added. A successful public HTTP response is not substituted for read success.

`freshnessReceipts` has one bounded entry per unique **returned fixture ID**.
No extra alias/catalogue identities or private data are exported. Each contains:

- schemaVersion, evaluatedAt, candidateCheckedAt, ageMs and budgetMs;
- actual candidate-decision flags: membershipDegraded, scoreReadFailed,
  missingCheckedAt, ageExpired, explicitStale, sourceMarkedStale,
  missingScoreObservation and retainedPrior;
- final decision `projected` or `retained-prior`, the actual retention reason
  (settled-prior/older-observation/interruption-score), returned checked/score/
  status clocks and returnedStale.

The candidate age and budget describe the evaluated projection, not a discarded
projection masquerading as a retained row's freshness. The final clocks and
retention reason explain the actual returned row. `model.observation` records
which existing branch it took, without changing the returned object. Compact
records its own existing stale flags rather than a second guessed predicate.
One captured clock governs that fixture's actual age/interval decision and its
receipt; no new source timestamp, grace period or stronger validity rule is
introduced. An invalid age remains null in the receipt; it does not change the
existing stale decision. Retained-prior decisions never become fresh from an
unrejected projection's clock.

## Operator evidence, without a gate waiver

The normal existing public verifier adds an onRead evidence hook before health/
identity assertions. Its CLI uses the existing release artifact directory to
save a whitelisted chosen/list/selected observation and both read receipts
before a later assertion can throw. Requests, target selection and all existing
assertions remain. Fixed Second Test evidence and aggregate console output stay
unchanged. Missing/invalid diagnostics are unknown in the evidence collector,
not read success. No credentials, account preferences, raw error, source blob,
raw response or general fixture-ID log is added.

This prepares decisive evidence only. The original AFLW freshness RED remains
held and its cause unknown. The frozen four-round acceptance script and old
reports are untouched. No expiry exception, new reliability acceptance, innings
repair, source cleanup, reader redesign or merge-policy change is included.

## Tests and cost

The existing required Match Centre validator now runs the new receipt suite,
without changing the262 workflow command occurrences. Actual-handler tests
compare complete original fixture/event bodies against7e, exercise exact
expiry/advancing time, source flags, missing clocks, zero scores, fast failure,
shared degradation, alias ordering and mixed-ID partial-batch rejection.
Existing retained-prior model branches are compared against their original
return values. Actual verifier failure tests prove chosen and selected evidence
is retained before the existing identity assertion throws. Unknown metadata is
not upgraded. The full old mounted-card lifecycle and privacy controls remain.

Controlled60-fixture before/after payload measurement is emitted by the suite;
it includes all new response bytes and gzip sizes. It is not a live compression
or network-latency claim. Static startup performance remains under its unchanged
budget. ROOT must qualify exact combined public payload/latency after integration.

No DB/config migration, source/provider/account call, scheduler, additional
RPC, main push, CI dispatch or deployment belongs to this source preparation.
ROOT owns standard PR integration, generated assembly through update-cards.js,
required combined/browser/installed/hosted gates and exact-main publication.
Rollback is reverting this source commit; no data restoration or SQL is needed.

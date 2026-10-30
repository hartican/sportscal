# Overflow-only per-request qualification — source only

ROOT run41037197903 remains FAIL. Both engines passed985-row exact plans,
complete ordered equality and ABBA, six negatives, inverse/fact preservation/
reapply, all111 current regression checks,20-row independent equality and five
receipt shapes. PG17 passed the old5001 comparison; PG18 timed out57014 there.
All36 owned children/four QA DBs/roles/two containers were cleaned. Old result
SHA25682ee886045aac2b01183efaeb2c759f5c8a2a9ad0f1809c9af825ca7424f300c is
preserved at native-qualification-ordered-wire/artifacts/result.json.

The failed statement builds original and candidate5001-row responses under one
shared5s timer. The context names the candidate at cancellation but gives no
individual complete-request timing. This does not establish which individual
call would pass or prove that aggregate budget was the cause. The old failure
and all partial proof stay visible; this is not a baseline exception.

## ROOT-approved isolated change

Only this overflow case changes. Its existing fixture preparation now begins one
REPEATABLE READ transaction, builds the same5001 new rows, drains the same
constraints, reasserts5s statements/1s locks, and switches to the existing
SELECT-only service role. It then performs exactly A/B/B/A as FOUR single-reader
SELECT statements, without a warm-up, variant or retry. All complete original
fields and the existing5001 sentinel remain. The same final rollback removes
the QA preparation; it is not committed or deployed.

Every leg returns the full text plus actual backend/snapshot/transactionID,
transaction timestamp, statement timestamp, isolation, role and cap metadata.
Require one row, correct bundle schema/scope,5001 rows and completefalse, full
ordered text equality against the first A, and whole response/parse/proof/hash
time <=5000ms for EACH request. Snapshot/transactionID/backend/transaction clock
must match all legs. Caps must still be5s/1s and role service_role. A timeout,
slow delivery, missing metadata, changed context or value difference stops the
case immediately and records partial phase/timing evidence. `er.overflow` is
written only after all four pass; failed attempts remain `overflowAttempt`.

REPEATABLE READ fixes visibility of concurrent committed changes and includes
this transaction's prepared writes. No DML occurs between the four SELECTs;
these already-guarded stable readers contain no writes or calls to writers.
[PostgreSQL isolation documentation](https://www.postgresql.org/docs/17/transaction-iso.html).
The transaction remains read-write because fixture preparation writes occur
inside it; this is explicitly recorded, not labelled READ ONLY.

`transaction_timestamp()` remains fixed but `statement_timestamp()` can differ.
The original readers still use their actual statement clock; no function,
admission clock or sporting observation is rewritten. The overflow fixtures are
live and the retained baseline clocks are far from admission boundaries; exact
full text equality remains mandatory if any time-sensitive value does change.
Actual statement clocks are retained for every successful leg.
[PostgreSQL clock documentation](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-CURRENT).

The985-row same-statement equality and ABBA speed gates are byte-identical.
No grants, ACL checks, SQL reader/migration, image, wire, lifecycle, app4s/5s/6s,
20% threshold or600s/60s budget changes. Future per-leg measurements can qualify
the per-request bound; they do not reconstruct the old unretained leg timings.

## Source controls and allocation boundary

Pure fake-result controls cover exact four single-reader requests, full5001
text/fields, differing actual statement clocks, fixed snapshot/transaction clock,
clock/ID/backend drift, field/row/completeness differences, cap/role mismatch,
host5001ms refusal, exact5000ms boundary, and immediate stop/partial evidence on
57014. They execute no SQL, process, Docker or CI. No native request ran here.

Keep SAME PR117/ref/workflow -3. The next independently fixed prior carrier is
1404cd81abcc86c430f81a1bbeebb2205edf75a0; ROOT binds a fresh nonce and immutable
packet/manifest/carrier only after review. No force/replay/rerun or worker push.
All previous packets/results and every native/managed/release gate remain.

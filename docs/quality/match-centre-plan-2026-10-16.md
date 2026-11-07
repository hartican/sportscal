# Match Centre loading investigation — 16 October 2026 Sydney

Status: both database trials rejected and restored exactly. Intermittent first-read latency remains unresolved. The completed World Cup result, accepted fact-date and lighter first-page app changes are separate; their normal release acceptance is recorded separately.

The normal release of `1f7413ce` deployed but failed its final public Match Centre check. The fixture-bundle read crossed its existing three-second deadline, leaving current membership explicitly degraded. A read-only recheck reproduced it. The earlier failed run is retained; no gate is waived.

## Scope and safeguards

Both trials retained the complete reviewed selection from `20261015120039_lookup_linked_match_context_by_key.sql`, stable/invoker service-only access, empty search path, signature/default, JSONB response, identity/linked context, ordering, unknown clocks, field precedence, source dates and 5,000/5,001 sentinel. Neither changed sporting/customer data or any other reader. Keep the real additive migration and exact rollback history; do not rewrite it as if the trials were never applied.

The first trial used a PL/pgSQL return-expression wrapper and function-local custom-plan setting. Its captured-world equivalence and public list/score check (eight fixtures) passed, but a full direct request timed out at 3,005 ms. Exact rollback restored MD5 `d98d88497311a8d06a31556004df30a2`.

The second trial executed a constant query with a bound parameter. It also passed complete captured-world/permission/rollback checks and a public nine-fixture list/score check. Its first full direct request timed out at 3,007 ms, and an actual service-role function EXPLAIN measured 3,360 ms. It was restored exactly too. A subsequent longer diagnostic returned the complete response in 970 ms (678 ms upstream); the 12-second diagnostic allowance is not a release gate or production deadline.

An anonymous-block comparison initially measured 3,181 ms for the original and 311 ms for the bound form, with identical complete 189-row output. Repeated and fresh-connection controls then showed that faster samples alone could not establish a reliable causal gain: the original also returned in 314–427 ms after other reads. A join-setting experiment similarly did not establish sufficient evidence and was never applied. Do not activate that prototype or claim either wrapper fixed production performance. PostgreSQL documents [plan caching](https://www.postgresql.org/docs/17/plpgsql-implementation.html#PLPGSQL-PLAN-CACHING) and [bound execution](https://www.postgresql.org/docs/17/plpgsql-statements.html#PLPGSQL-STATEMENTS-EXECUTING-DYN); actual response acceptance remains separate.

## Verification retained

- The captured public world contains 6,244 fixtures and 6,235 score rows. Empty-membership and 1,621-protected-identity requests agreed exactly before/after each trial over seven alternating repeats, including complete ordered payloads and original clocks. Local timings do not certify cloud performance.
- Anonymous/authenticated callers stayed denied; service access, stable/invoker, ACL and session settings stayed intact. Global, participant and complementary-part definitions were unchanged. Oversized inputs stayed incomplete. Exact guarded rollback restored complete metadata each time.
- Existing SQL/store/handler/integrity/observation regression gates remain mandatory, now including the final restored history, protected unusual identity strings and exact original body/hash. The original function's empty search path remains; no planner setting remains active.
- Current production app acceptance still requires the normal workflow, fresh public membership/score checks, exact READY/SHA/aliases/served files and hosted rendering. No synthetic warming traffic or retry loop is used to obtain a pass. A successful dated public check proves that observation, not reliable cold-query latency or physical iPhone speed.

The next performance investigation must reproduce and separate first-read/connection/plan effects at the actual call site before applying another database change. Do not broaden the reader or increase deadlines. The larger personal/history client remains off. No provider request, new table/index, scheduler, retry, customer write, reminder replay, subscription or regular owner task was added. External cash cost A$0; model/runner costs remain unpriced.

Evidence: `/Users/jackhartican/Documents/AI/Codex/rlwc-results-2026-10-16`, including failed requests, actual function costs, service logs, controls and rollback receipts. Physical iPhone behaviour remains unverified.

The completed app module passed normal run [38773769526](https://github.com/hartican/sportscal/actions/runs/38773769526), live as f2112076 / shell 548. Its fresh public gate returned one displayed fixture and its score read. Exact READY/alias/build-byte and both hosted browser checks pass separately. The active reader is still the restored original; intermittent first-read performance is not closed. The additional history Spec review cleared; its Standards review remained partial and is not counted as a complete approval.

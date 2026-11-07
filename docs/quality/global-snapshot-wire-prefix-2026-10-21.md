# Global snapshot: prepare immutable wire text with the canonical row

Status: source-qualified but operationally rejected after one guarded production application timed out. Transaction rollback verified; no prefix or view change remains. Not published or deployed. Root remains the sole database executor and publisher.

## Problem and limits of the diagnosis

App580/2a6b8c6b failed the required near snapshot gate in workflow39484813400. The subsequently applied D9 seed repair produced one healthy membership read and an actual selected fixture, then the fixed public sequence stopped on its third request: the athlete-labelled route still uses the global reader and failed before headers at3006ms/3000. No completed repeated-read round or retry is claimed.

Earlier wide-record work, generic-plan estimates and duplicate result spools were established and addressed. Historical gateway evidence confirms the current global view was used successfully at19:50:09UTC (1872ms gateway/1819ms upstream). The failed20:09 request lacks a completed gateway entry; absence does not establish that it never executed. The hosting trace and observability schema were unavailable. The precise remaining incident's CPU, queue or network cause is unresolved.

The current local mechanism is narrower: each global read still merges and converts the complete compact base back to JSON text. Preparing its immutable text with the existing canonical row removes part of that repeat work. It is a candidate work reduction, not a proved explanation of the entire intermittent timeout.

## Change

The guarded migration adds one stored generated text column, `global_fixture_object_prefix`, derived directly from the exact existing D7 compact-base expression. It contains the encoded base minus its final closing brace. It stores no membership, wall clock, live score, receipt or admission result. PostgreSQL maintains it atomically on the existing canonical insert/update path. No separate writer, invalidation, scheduler, endpoint, helper attribute or browser code is added.

For object bases and object/absent scores, the same computed invoker view appends the current score/clock/completion object's JSON text and returns JSON. Empty objects avoid a leading comma. Non-object inputs retain the original JSONB expression. Overlaid keys can occur twice internally: PostgreSQL JSON processing and trusted Node `JSON.parse` use the last value. The public API reserialises the decoded object, so this internal encoding is not a public duplicate-key contract. Selected readers remain untouched. All calendar selection, independent observation parsing, score precedence, explicit-null handling, ordering and5001 sentinel remain at read time and unchanged.

The generated expression cannot refer to another generated column. Any future change to the compact-base definition must update both expressions in a reviewed migration and retain their whole-value/canonical-write regression. [PostgreSQL17 generated columns](https://www.postgresql.org/docs/17/ddl-generated-columns.html), [JSON representation and duplicate keys](https://www.postgresql.org/docs/17/datatype-json.html).

## Evidence

- Actual migration and full reader/store/handler regression passed PostgreSQL17 and18, including exact SQL numeric equality, ordered whole-output equality, aliases, NULL/empty/0/1/5000/5001, original clocks, reschedules, actual canonical base/score updates, manual-stale-copy negative, guard/replay refusal and service-only rights.
- Additional tests cover24 whole-value comparisons and17 rejected malformed writes across26 distinct constructed input cases. Existing object constraints/context writers reject arrays/scalars before the reader; tests preserve those failures instead of disabling triggers. Initial edge harness errors and their corrected expectations remain in the evidence folder.
- The actual PostgreSQL17 framed test with5000 retained public catalogue inputs reduced shared data accesses111799→106103 and measured261.222→228.119ms. Restoring the actual previous view fails the work regression. The source is one constructed local source, not a production database capture. Timings are reported, not used as a noisy threshold or cloud-speed promise.
- The date-stable follow-up uses5000 retained public field shapes with explicitly synthetic current-calendar admission:156696→143359 accesses and496.309→389.885ms, with the same restored-old-view negative. This keeps the work gate from expiring as a sporting season ages; it does not certify current sporting facts or cloud speed.
- An earlier paired feasibility sample admitted1956 fixtures, measured171→139ms and43426→37741 accesses. Component assembly without stored text showed only3.8percent in the fuller public-data test and was rejected; its initially favourable simplified sample is not used as release evidence.
- One bounded live read-only preflight at23:01:40UTC confirmed PostgreSQL17.6,7492current rows,0pending index validations and D9/6e/fbc/D7 contracts. Database295292051bytes, current relation28803072bytes and conservative rewrite allowance386452627bytes, below450000000. The migration rechecks capacity, lock1s and statement3s; a failure must roll back without retry or budget increase.
- Fresh pre-application security advisors retained99 RLS/no-policy information findings, three anonymous-policy warnings (managed cron and deny-direct chat invitations), and the existing leaked-password protection warning. No grant, policy, credential or plan change is included. Private sports relations remain closed to browser roles.

Evidence folder: `/Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-repair-20261021`. Key files: `stored-wire-actual-migration-pg17.log`, `stored-wire-actual-migration-pg18.log`, `wire-prefix-constraint-edges-pg17.log`, `wire-prefix-constraint-edges-pg18.log`, `stored-prefix-preflight.json`, `stored-prefix-security-preflight.json`, `passive-incident-evidence.json`.

## Remaining gates

Independent source review, frozen scoped commit, one guarded application with exact post-contract verification, bounded repeated fresh public membership/real-selected/participant reads, and the full normal release remain required. Publish the exact main snapshot through the existing single publisher only after applicable gates. READY, an isolated success, local work reductions or old phone/saved-card evidence cannot override a failed gate. No unchanged retry, provider refresh, reminder replay, paid plan, timeout/memory change or weakened check is authorised by this candidate.

## One application failed and rolled back —23:35UTC

The exact independently source-reviewed3d16bbf6 migration16d89fac applied once through the existing owner and failed57014at its3sstatement limit. There was no retry or budget increase. A bounded23:36metadata read confirmed prefix absent, viewfbc, nearD9, row6e, compactD7 and0pending;7507current rows and296.5MB allocation reflect the later database state, not an assumed partial backfill or shrink. The failed migration/test implementation remains recoverable in the unpublished3d16bbf6 checkpoint branch; it is excluded from the active no-rewrite publication candidate. Local speed/semantic passes and source clearance did not establish operability.

A distinct expression-only feasibility test avoided all storage and rewrites, but was about22percent slower (paired ordinary163ms versusdynamic199ms) and was rejected without production calls. No new live qualification or release was attempted.

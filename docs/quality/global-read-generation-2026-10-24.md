# Whole global generation — shadow implementation, 24 October 2026 Sydney

Status: isolated, unactivated, default OFF. DEPLOY alone owns qualification,
integration, schema activation, configuration and exact-main publication.
PR34 admission transport failed its first measured pair (576→840ms) and remains
unadopted. Earlier per-fixture caches, generated-prefix and component trials stay
closed. This candidate stores ONE complete original fbc response, avoiding its
construction on a valid generation read, rather than per-row cache/witness joins.

## Minimal boundary and authority

The existing private invoker global view retains the exact original default/
legacy expression. Fixed service header `x-ns-fixture-generation: shadow-v1`
selects a guarded generation or exact original fallback within the same query.
`createSnapshotStore({generationShadowRead:true})` is a trusted server test option;
normal callers leave it false. No browser setting/header can enable it.

Only `GLOBAL_FIXTURE_GENERATION_SHADOW=true` enables ONE optional DB-side build
attempt inside the existing refreshDueSources owner AFTER both source workers
finish. Default is OFF; no flag/configuration was activated here. The hook uses
only remaining original45s runtime, requires6s remaining and caps its request at
the lesser of6s and actual remaining time. It reserves no source-worker budget,
adds no retry and does not build in the8s publish, dispatcher, UI read or daily
CLI-only path. Builder errors/late acknowledgements defer without changing
canonical publication success; a late acknowledgement cannot certify installation.

## Invalidation and exactness

A private per-source UUID incarnation/token and full transaction ID change once
per source/transaction through hooks on existing source/current/score/context/
pending transactions. A transaction-local memo skips repeated persistent writes.
Receipt-only changes count even when revision/contentHash do not. Lease claims
alone do not. Source deletion/recreation gets a new token, including same-TX
recreation. Build refuses a transaction that already changed source epochs.
No global hot-row epoch, sequence or construction lock serialises providers.

The exact original fbc view builds typed JSON and its complete ordered source/
token vector in ONE snapshot. Original observations, identities/order and5001
incomplete detection remain. Fresh SPI snapshot CAS checks before install and a
post-install check reject races/boundary crossings; every read independently
repeats the vector/day/policy/session/expiry/pending fence. An installed row can
be immediately invalidated; it never authorises stale facts. Current generation
only is examined; a previous slot cannot bypass a failed fence.

The effective caller is service_role with original BYPASSRLS. All functions are
SECURITY INVOKER. The policy fence covers original fbc/D7/parser definitions,
epoch/expiry hooks and enabled state, original input SELECT/schema/EXEC rights,
column ACLs, RLS flags/policies, effective role/membership attributes and SQL
TimeZone/DateStyle. A changed/revoked original input contract invalidates the model;
the original fallback retains its actual visibility/failure behavior.

valid_until is the earlier of next Sydney midnight and the exact original
parser's next within-day admissibility transition (valid future raw stamp minus
5minutes). PostgreSQL format/cast/microsecond semantics are retained. The stored reference_clock is the original builder statement_timestamp. Read
eligibility requires its own statement clock >=reference_clock, the same Sydney
day and statement clock <valid_until; wall time may additionally refuse expiry.
An older query or clock rollback cannot select a newer temporal interpretation.
No clock/date is added to sporting facts. Unknown/invalid clocks stay governed by the original parser. The original
parallel source-health resource and Node freshness/error/last-good controls stay.

Every installed payload and complete manifest have a whole-value SHA256 witness.
A transaction-local XID/generation-ID capability and model write/truncate guard
block accidental SQL edits outside the invoker builder. Opt-in reads rehash the
full payload and manifest, so payload corruption or old-payload relabelling is
not trusted solely because epoch/day fields match. Deliberately privileged admin
forgery of both capability and witness remains outside the accidental-edit
threat. The full read-time hash/copy and possible duplicate UPSERT trigger hashing
are real CPU work; qualify their total cost, never assume it is free.

## Budgets and proof limits

Two fixed generation slots each permit at most16MiB JSON payload (32MiB payload
logical total). Metadata/index/TOAST/dead tuple/WAL allocation is ADDITIONAL.
Two live rows do not bound physical storage or guarantee allocation shrinks.
Repeated replacement/autovacuum/headroom and WAL must qualify before adoption.
DEPLOY's separate read-only capacity preflight found291.284MiB in the existing
450MiB budget; this is coarse feasibility, not a growth or capacity-cause proof.

The existing owner can attempt work up to720times/day at its unchanged2-minute
cadence. Receipt-only polls may require full builds. For a small reader cohort,
total DB CPU/writes may be MORE than on-demand construction. Require build+read
CPU/write amplification/duty-cycle evidence against existing aggregate route
telemetry; add no demand tracker, source cadence, job or subscription.

Constructed PG17/18 tests compare hot/missing/dirty/expired/default JSON text,
clock precision and actual within-day transition, metadata/source changes,
reincarnation, same-TX refusal, post-CAS invalidation injection, permissions/RLS,
actual hot-plan skip and original-path negative, default-OFF/remaining-budget/
no-retry owner behavior, original canonical959-fixture write under8s and guarded
committed undo/reapply. The injected race is NOT real concurrent backend proof.
No captured full-consumer/native/managed/provider run is authorised here.

Next allocation belongs to DEPLOY: real captured facts at the SAME actual Sydney
day (no production clock overrides), original full control versus generation,
whole bytes/values/IDs/aliases/clocks/revision; realistic concurrent publications,
hot/dirty/cold/missing/expired complete latency,6s headroom,8s writes/1s locks,
remaining-owner fit, total duty-cycle CPU and physical growth. A hot pass cannot
override a failing fallback. Failed required gates stop adoption/release.

Rollback requires exact candidate view/helper preimages, restores original fbc
and removes ONLY new hooks/functions/private derived state. It does not restore
or redate canonical/customer data. Shared Follow/Results/account rules, source
permissions, existing schedules and physical-phone evidence remain unchanged.

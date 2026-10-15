# Match Centre parameter-aware lookup — 16 October 2026 Sydney

Status: local equivalence and rollback rehearsal passed; production application and complete release acceptance pending.

The normal release of `1f7413ce` deployed successfully but failed its final public Match Centre check. Current membership was degraded because the existing fixture-bundle request crossed its unchanged three-second deadline. A fresh read-only recheck reproduced it; the failed run remains evidence, not an accepted release.

## Narrow repair contract

Keep the complete reviewed SQL selection statement from `20261015120039_lookup_linked_match_context_by_key.sql` unchanged. Execute it through PL/pgSQL with function-local `plan_cache_mode=force_custom_plan`. Retain the existing function identity, argument/default, JSONB response, stable/invoker access, empty search path, service-only grants, selected/protected identities, ordering, unknown clocks, field precedence, source observations and 5,000/5,001 sentinel. No writer, data backfill, new table/index, timer, retry, scheduler, additional request, deadline extension, subscription or customer-state change. Leave all other readers, including the withheld larger personal/history transport, unchanged.

The live SQL function under the service role measured about 2.07 seconds. The same prepared statement measured 0.42 seconds with a parameter-aware plan and 2.50 seconds with a generic plan. The inline query measured 0.59 seconds and cannot establish actual RPC performance. These are separate observations, not a guarantee of cloud transport speed. The larger complementary-part reader has a different plan and retains its own setting; this is not a database-wide change.

PostgreSQL documents [parameter-aware and generic plans](https://www.postgresql.org/docs/17/runtime-config-query.html#GUC-PLAN-CACHE-MODE) and [PL/pgSQL plan caching](https://www.postgresql.org/docs/17/plpgsql-implementation.html#PLPGSQL-PLAN-CACHING). Supabase documents [invoker permissions and function security](https://supabase.com/docs/guides/database/functions). Keep the migration guarded against any definition other than reviewed MD5 `d98d88497311a8d06a31556004df30a2`; an unexpected deployment must fail before replacement. An exact guarded rollback is prepared outside the published source tree.

## Verification and acceptance

- The offline captured public world contains 6,244 fixture rows and 6,235 score rows. Empty-membership and 1,621-protected-identity requests returned exactly the same complete, ordered JSON before and after the wrapper; seven alternating repeat calls agree. Local timings are not cloud acceptance.
- Anonymous and authenticated callers remain denied. The service role works, the function remains stable/invoker, its ACL is unchanged and the session plan setting remains `auto`. Global, participant and complementary-part definitions are unchanged. Oversized input remains incomplete.
- Reapplying the guarded migration fails; exact rollback restores the original function and metadata, and the candidate reapplies successfully afterwards. The first local rollback rehearsal caught a missing statement separator in the disposable harness; the corrected full rehearsal passed. No production rollback or data change occurred during that rehearsal.
- The existing indexed Match Centre regression must run against the candidate, including linked context, canonical score overrides, pending-index fallback, deletions, unknown clocks and access denial. Existing profile/store/handler, integrity and observation checks remain required.
- Before acceptance, verify the actual production function, unchanged other readers and permissions, the complete HTTP response inside the existing deadline, and a fresh public Match Centre list plus its displayed-score lookup. Publish the scoped passing snapshot and require the normal release workflow, exact READY/SHA/alias/served-file proof and relevant hosted rendering. Keep the earlier failed release in the record. Roll back exactly if the candidate fails its production acceptance; do not increase deadlines or waive degraded membership.

Evidence: `/Users/jackhartican/Documents/AI/Codex/rlwc-results-2026-10-16`. New external cash cost A$0; no recurring owner task. Physical iPhone responsiveness remains separate from database and browser proof.

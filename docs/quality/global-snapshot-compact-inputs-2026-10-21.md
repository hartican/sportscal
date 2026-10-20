# Global fixture snapshot repair — 21 October 2026

## Required behaviour

Resolve the real bounded global snapshot failure without increasing its three-second deadline, returning stale membership as healthy, weakening release checks or changing sporting facts. Preserve selected/near/reminder readers, identities, source observation clocks, permissions, scope filters, ordering, exact numerics, NULL versus empty selection, and the complete/5001 overflow sentinel. One existing refresh/release owner remains; no new request, retry, scheduler or provider collection.

## Evidence and attribution

Production579 at6b42d58b was deployed but workflow39438756627 failed global freshness. Its retained read12fc2608-1836-4cfc-b963-94f4904b21bd timed out before fixture-bundle headers at14:34:19.916UTC, taking3004.8ms against3000ms. Parallel source health finished106.9ms; parsing/projection had not begun. SQL-family statistics show high execution variance and temporary work, but are not the failed invocation's plan or proof of a pool/network cause.

A bounded source-only review found that the global scalar materialises full fixture/score/receipt rows and repeatedly extracts the same source receipt map. The replacement selects the same ordered bounded keys first, extracts each involved source map once, then explicitly materialises the unchanged compact projection before ordered aggregation. It uses the original two text-key JSON operators, including malformed maps. Every non-scalar reader/helper and ACL remains unchanged.

An initial local variant deferred projection until after a wide external sort and was rejected:473ms median versus270ms, with56229 temporary blocks versus2276. An explicit projection fence removes that regression. Two alternating modelled PostgREST-frame pairs on4542 constructed rows/40sources at2184kB work_mem returned baseline255/258ms and replacement251/234ms, with578 temporary blocks versus2276. This is local mechanical evidence, not a cloud latency forecast. The production bottleneck is only confirmed to be the pre-header database read path; precise runtime attribution remains incomplete.

## Regression and release requirements

The actual existing reader regression now installs the guarded replacement before its whole-output PostgreSQL JSONB equality checks. Existing0/1/5000/5001, NULL/empty/missing/alias, date/status/score overrides, parent detail/rubbers, Unicode, exact large/decimal/zero/null numbers, original clocks and service-only denial checks remain. Added mutation guards reject altered scalar/wrapper/projector/time helper and unexpected grants; all other definitions/attributes/ACLs stay exact. Malformed receipt maps with a numeric-string fixture ID retain old semantics. An intentionally corrupted receipt must fail equivalence. No timing threshold is asserted from a noisy local benchmark.

Local full reader and scope regressions pass with outbound networking denied and credentials removed. Before production acceptance: independent Spec/Standards review; guarded migration; full normal exact-SHA workflow; READY/aliases/served hashes; honest global freshness and security headers; repeated fresh Match Centre, actual selected fixture and participant reads; hosted A-League12clubs/156fixtures and preserved World Cup evidence. No success retry can override a failed gate. Physical iPhone recovery, sporting freshness and all-sport MVP certification remain separate.

Local evidence: /Users/jackhartican/Documents/AI/Codex/nothingsport-snapshot-repair-20261021. State at preparation: production579 acceptance FAILED;580 local and unpublished. No production migration applied yet.

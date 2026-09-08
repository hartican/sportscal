# Discovery release — version 247

Scope: the user's approved Cricket/Rugby coverage, cross-sport athlete discovery and autonomous consensus ingestion request. Extends `0555a5a`; source and production evidence are separate below.

## Implemented and locally verified

- Cricket: 842 known fixtures across 68 competition/series identities. Every date from 1 September through 7 December 2026 was checked, including women's internationals and domestic cricket. Valid ESPN empty dates are distinct from failed reads. Bounded retries and partial-date health prevent misleading success reports.
- Rugby Union: 566 known fixtures across 25 competition identities, combining first-party World Rugby and Rugby Australia. All returned men's/women's XV pages and men's/women's sevens query pages were read. The sevens match API returned valid empty collections in this window; this is **not** a claim that no future sevens meetings exist or that unpublished draws are covered.
- Combined: 1,408 known fixtures, 433 team identities, 27 source partitions, no failed/partial partitions in the completed canonical refresh. Competition identities can overlap across providers; counts are not a claim of 93 distinct worldwide leagues. Follow admission remains independent of ratings, stakes and enrichment availability.
- The common live merge deduplicates exact two-sided fixtures across source IDs, retains the original action/reminder identity and preserves provider aliases through reschedules. Gender, senior/junior classification, competition name, scores and evidence survive Schedule transport.
- AI discovery uses the existing minute scheduler, with independently leased six-hour batches: eight tracked athletes or ten near-term marquee fixtures per batch. Progress is persisted; failures back off for six hours, without deleting accepted evidence. The pilot and registered users' followed canonical athletes share one registry (7,817 available identities). No per-user association is sent to the search provider. An anonymous/local-only follow cannot be discovered from another device until its state is synced.
- Athlete membership requires a registered full name, actual retrieved official URL, matching event/date in fetched official content and an explicit entry. Testing, ownership, speculation, homonyms and prior-year entries are rejected. New source-backed fixtures may be date-only. Explicit newer withdrawals remove the membership, not the fixture. Confirmed entries flow into Feed and live profile history across codes.
- Consensus uses six controlled labels and actual search-returned URLs. Narrative labels require independent publisher/origin groups; user-rating labels cannot come from AI. Enrichment cannot overwrite live scores/status. Accepted tags persist on failure; time-sensitive Record Chase tags expire.
- Official HTML/text/JSON entry documents are supported. Unsupported PDFs and inaccessible documents are reported and remain unverified; they are not silently accepted or treated as withdrawals. Commercial publisher RSS polling was not enabled without cleared usage rights. See the two source research reports for the source inventory and limitations.
- Public live responses contain one current copy per fixture rather than duplicated overlapping source partitions; historical source snapshots remain server-owned. “All Followed” uses published competition names instead of provider UUIDs.

## Verification

- 27 local contract suites passed, covering discovery, source parsers, Follow parity, source retention, live APIs/adapters, calendar, athlete profiles, NSC and startup budgets. Subsequent evidence/date and metadata-label regression checks passed.
- PostgreSQL/PGlite: service-only access, fenced leases, successful empty discovery, six-hour cadence, atomic evidence/progress publishing and stale-worker rejection passed.
- Browser: Feed/source refresh and the new cross-sport membership/tag/profile/withdrawal flow passed at 390 and 1280 px, with no uncaught errors or horizontal overflow. Calendar/results/ladder regressions passed at 390, 768 and 1280 px. Live-refresh reading-anchor shift: zero in the tested flow.
- Already-open installed-shell upgrade 246 → 247 passed: saved follows/preferences/drafts, optional-asset failure, required-asset failure and offline fallback. This is browser emulation, not physical iPhone or push-delivery proof.
- Five critical requests retained; critical gzip growth 1.24% against the established baseline (1.25% budget). Precache remains 2.99 MB (3 MB budget).

## Production database

Applied migration `20260908110529_discovery_source_health`. Verified forced RLS, no anonymous/authenticated table read access, no anonymous publish-RPC access, and service-role publish access. Existing scheduler job 10 remains active every minute; no second fixture cron was added.

Security advisors were unchanged before/after: 30 informational service-owned RLS/no-policy notices and five existing warnings (anonymous-session policies on Cron/user-owned tables and disabled leaked-password protection). No permissions were broadened. References: [anonymous-policy review](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Activation blocker — do not mark autonomous AI operational

The real Gateway probe returned HTTP 403 `customer_verification_required`, requiring a billing card. Production currently has no `OPENAI_API_KEY` or `AI_GATEWAY_API_KEY`. OIDC is used from the request-scoped production header, with environment OIDC for CLI/local execution. [Vercel OIDC reference](https://vercel.com/docs/oidc/reference).

The release contains the discovery jobs and explicit blocked health reporting, but **no new real athlete entry or AI consensus tag has been claimed**. The user must enable existing AI Gateway billing or securely configure an OpenAI key; no billing details, credit purchases or subscription changes were made. Once enabled, verify a real scheduled search and persisted accepted-or-empty result before claiming activation.

## GitHub and deployment

Initial release `a2a483dc2c83252d8fd1860742f865a2358093db` was pushed to GitHub main and deployed as `dpl_2azATxMmTJ6bvpHuCUKWut9Pwtx1`, READY with matching `releaseGitSha`. The public alias served byte-identical HTML, worker, identity/profile modules and version marker. Public fixtures returned 200, revision revalidation returned 304, and an unauthorised refresh returned 401.

The first scheduled production runs populated every Rugby query partition and most Cricket partitions. A few Cricket date requests were temporarily partial and retried; the released static library had already verified all 98 dates. A server-only follow-up therefore includes the verified library in every live response, even when the **first** server lookup is partial, and binds revision validators to both library and live source content. Its regression test passes. This does not mark an unavailable upstream date as freshly verified.

The real Gateway response encodes the billing restriction in `error.type`, not `error.code`; the follow-up recognises both. Production AI jobs remain blocked, not operational. Final follow-up commit/deployment identifiers are recorded in the Vercel release metadata and task handoff rather than inferred from this document's preparation time.

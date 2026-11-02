# Local NS dashboard collector — first implementation draft

This is Phase 2 slices 1–2: a bounded read-only GitHub collector, historical replay, explicit deliverable grouping and a release-evidence projection. It is a local command, with no web server, customer-app route or page-load work.

Phase contract: use existing GitHub authorisation; keep actual exports outside every Git checkout in an owner-only directory; test pagination/lifecycle/time boundaries, failure preservation and release separation. Stop at this draft review boundary. The hosted Overview, Engineering Detail, Jack-only identity binding, private hosted storage and access tests are deferred. No new credentials, scopes, packages, schema, permissions, costs or schedules are configured.

The definition contract remains [Phase 1 PR133](https://github.com/hartican/sportscal/pull/133), including [metric dictionary v1](https://github.com/hartican/sportscal/blob/859f37452623429340e678f5778e7c2318d1610d/docs/metrics/ns-dashboard-v1.md). This draft does not amend that PR or claim the entire Phase 2 is complete.

## Run

Use the existing Node installation and authenticated GitHub CLI. No install or login command is part of this workflow. The adapter's fixed GraphQL queries request PR metadata and only close/reopen/merge/draft/ready lifecycle events. They exclude comments, reviews, bodies, actor identity, chat and customer data. The source repository is fixed to hartican/sportscal. If authorised access fails, stop; do not create tokens or expand scopes.

Set an absolute private output directory outside all Git checkouts. Existing directories/files must already belong to the current OS user and deny group/other access (0700/0600). This local filesystem protection is **not** proof of Jack-only web authentication.

    NS_DASHBOARD_OUTPUT="/absolute/private/ns-dashboard"
    node scripts/ns-dashboard/cli.js collect --output "$NS_DASHBOARD_OUTPUT"
    node scripts/ns-dashboard/cli.js project --output "$NS_DASHBOARD_OUTPUT"

For noon historical comparisons, supply Sydney calendar dates explicitly:

    node scripts/ns-dashboard/cli.js project --output "$NS_DASHBOARD_OUTPUT" \
      --cutoffs 2026-10-26,2026-10-27,2026-10-28,2026-10-29,2026-10-30,2026-10-31,2026-11-01

These dates are an example of a historical interval, not a live queue baseline. No seed counts, application version or release blocker is hard-coded.

The first collection enumerates all PR pages, including older open PRs and drafts, with independent lifecycle pagination. Later collection uses UPDATED_AT descending with five minutes of overlap, preserves older PRs, and checks repository enumeration count. Initial limits: 300 requests / 300 seconds / 25 MB response bytes. Incremental: 25 requests / 60 seconds / 25 MB. Optional --max-requests, --max-ms and --max-bytes may only reduce the selected mode's limits; incremental overrides cannot use the larger initial ceilings. Each gh call is capped at 30 seconds and 5 MB within the remaining budget. Calls are serial, with no retries.

Source collection is not a point-in-time transaction. The export records a collection-start as-of cutoff and each PR's later observation time. Replay validates observed metadata against the complete returned lifecycle; inconsistent moving observations fail closed. A new PR created after the start is retained in source data but excluded from that cutoff's snapshot. Enumeration changes, contradictory events and repeated cursors stop the attempt; they do not reset counts.

A failed or partial capture is retained privately for diagnosis, while latest.json continues to reference the last complete valid export. refresh-status.json reports the error and last success. Immutable export files include source-page query/response hashes, cursors and occurrence/ingestion times. An incremental export points to its predecessor hash; retain that chain for provenance. No retention/deletion job is installed. All writes are atomic; the collector has an exclusive lock. After an interrupted process leaves a lock, verify that its recorded process has exited before manually removing it.

Replay an existing initial capture without new network calls, into an empty private output directory:

    node scripts/ns-dashboard/cli.js replay --input /absolute/private/export-HASH.json \
      --output /absolute/private/replay
    node scripts/ns-dashboard/cli.js project --output /absolute/private/replay

Offline replay checks query, variables and response hashes; it retains the capture's original observation time. It does not turn an old capture into fresh observation. Source capture completeness and the newly validated replay result remain distinct. An interrupted capture lacking pages cannot become a complete replay.
The CLI replay starts from an initial enumeration; incremental capture replay requires the previous validated export through the exported replayCapture function. It cannot silently treat one incremental page as a full history.

## Calculations and traceability

- Snapshots include events at the cutoff. Their flow reconciliation uses (first cutoff, last cutoff]. Complete seven/28-day Sydney windows use [start midnight, end midnight), with DST-derived UTC bounds. Seven daily observations span six intervals.
- Creation metadata supplies the initial open event. Draft-at-creation is inferred from the first complete draft transition (or current draft flag if no transition exists). Source event IDs deduplicate retries; conflicting identity or order is an error. The original provider timeline order resolves same-second transitions.
- GitHub may emit ClosedEvent at or just after MergedEvent. Once merged, the PR is terminal; that close receipt is retained but does not become an additional unmerged closure. Earlier unmerged close/reopen cycles remain in flow counts.
- Every snapshot lists contributing PR/source IDs; events and page hashes trace it to the private export. A failed enumeration cannot produce a measured zero. Source identity integrity is not a cryptographic attestation by GitHub.
- Queue grouping and production proof remain optional explicit owner inputs. Missing input is not measured, rather than inferred from titles, message silence, a current closed_at field or a green CI job.
- DORA metrics, incident rates, cost per outcome and delivered-outcome acceptance are **not calculated** by this first slice. Grouping two PRs into one deliverable does not certify delivery.
- This draft retains summaries and provenance; it does not scrape private session logs or issue new owner tests.

## Optional owner records

Use --records /absolute/private/owner-records.json when projecting. Keep that file owner-only and outside Git. Its top-level sections are queue and release. Do not paste transcripts, credentials or customer rows. Classification keys are explicit dashboard grouping keys from an existing owner record, not a competing queue. Priorities and accountable owners are read from that source.

queue requires source (a source URL or private receipt pointer), observedAt, complete and deliverables. Each deliverable has id, owner, stage, nextAction, prNumbers; optional type, priority, dependencies, stageEnteredAt, membershipComplete, candidate and proof. The projection preserves input priority/order. Stage age is computed only through the owner record's observation time and is null without an explicit transition. PR state is bounded by the collection cutoff. Coverage stays partial unless the source explicitly supplies a complete queue/membership.
deliverables must be an explicitly observed array and complete must be a boolean. A missing/null/malformed payload is rejected before writing a projection; it cannot become a complete zero count. An explicit empty array is a measured empty observation, with complete:false retaining partial coverage. An absent queue section remains not measured.

A PR cannot silently belong to two deliverables; duplicate membership, unknown PRs and unsupported fields are rejected. Candidate evidence compares exact sha, tree, dependencies, toolchain, scope, generatedAssets plus proof expiry. A branch-level pass never establishes combined-candidate validity.

release supports:

- alias: the specific production host being evaluated.
- merged: {sha, at, sourceUrl}; merge remains independent of deployment.
- deployments: [{id, sha, state, environment, alias, activatedAt, classification, rollbackOf, sourceUrl}]. id identifies the rollout activation/attempt, including a distinct rollback activation of a reused artifact. READY alone is insufficient: require explicit activation evidence for the relevant alias. Missing activation time remains unknown. SKIPPED is excluded from attempted deployments; data-only/unknown classifications do not become application frequency.
- verifications: [{id, deploymentId, sha, version, alias, verifiedAt, expiresAt, result, scope, sourceUrl}]. Only a passed, unexpired, alias/SHA-matched proof after the latest activation becomes verifiedLive. Its exact scope is retained; asset proof does not establish authenticated/device acceptance. Rollback requires proof of its new activation; an old proof of the reused artifact is insufficient.

Verification observations are deduplicated by identity and evaluated per exact scope. A later failed observation supersedes an earlier pass for that scope; expiry never revives an older pass. verificationScopes retains each scope's latest evidence, failed/stale/ambiguous states and source identities. An unrelated scope's failure preserves a distinct valid proof while the aggregate state becomes partial. Contradictory same-time pass/fail evidence is ambiguous and cannot supply a verified proof. Rollback/alias/SHA and future-time exclusions still apply.

No automatic Vercel polling or new deployment is performed. Missing SHA is null, never inferred from main. A stale proof remains stale. The local JSON projection has no release controls.

## Capacity and attribution source contract

Existing capacity receipts may be linked as reported evidence in the private handoff. Without the raw export, do not claim independent verification or recompute their conclusions.

Workflow created-to-start elapsed time is separate from runnable-job queue latency, dependency waiting, setup, test/runtime, serial critical path and explicit handoff intervals. Raw summed job-minutes are not billed minutes or money; parallel overlap is a capacity observation, not a speedup estimate. Artifact coverage must state its retained sample/window. Account plan, other repositories, cache exposure and paid allowances stay unknown until supported. This first adapter does not ingest CI, billing, model-token or laptop telemetry, and claims no efficiency improvement, upgrade need or savings.

## Verify and hand off

    node scripts/ns-dashboard/test.js
    git diff --check
    git diff --stat

The focused tests run serially in one Node process, using synthetic fixtures and temporary owner-only directories. They make no network calls or release-test invocations. Real source captures and owner inputs remain private; never commit them, upload them as public CI artifacts, or copy them into customer/static data directories.

Draft PR evidence should state the exact source commit, source permissions, Node version, test result, private receipt hashes, backfill interval and limitations. Route one consolidated handoff through nsCOORD/nsRELEASE. Keep NS Planning Tasks; nsPUBLISH remains the sole publisher. No merge/deploy command is part of this local slice.

Source API contracts were checked against [GitHub GraphQL pulls](https://docs.github.com/en/graphql/reference/pulls) and [pagination guidance](https://docs.github.com/en/graphql/guides/using-pagination-in-the-graphql-api). The adapter uses IssueOrder for repository.pullRequests, and independently follows nested timeline cursors.

# Local NS dashboard collector — first implementation draft

This is the local Phase 2 draft: a bounded read-only GitHub collector, historical replay, explicit deliverable grouping, release-evidence projection and four-page offline dashboard. It has no web server, customer-app route or page-load collection.

Phase contract: use existing GitHub authorisation; keep actual exports outside every Git checkout in an owner-only directory; test pagination/lifecycle/time boundaries, failure preservation and release separation. Stop at this draft review boundary. Hosted page access, Jack-only identity binding, private hosted storage and hosted access tests are deferred. No new credentials, scopes, packages, schema, permissions, costs or schedules are configured.

The definition contract remains [Phase 1 PR133](https://github.com/hartican/sportscal/pull/133), including [metric dictionary v1](https://github.com/hartican/sportscal/blob/859f37452623429340e678f5778e7c2318d1610d/docs/metrics/ns-dashboard-v1.md). This draft does not amend that PR or claim the entire Phase 2 is complete.

## Run

Use the existing Node installation and authenticated GitHub CLI. No install or login command is part of this workflow. The adapter's fixed GraphQL queries request PR metadata and only close/reopen/merge/draft/ready lifecycle events. They exclude comments, reviews, bodies, actor identity, chat and customer data. The source repository is fixed to hartican/sportscal. If authorised access fails, stop; do not create tokens or expand scopes.

Set an absolute private output directory outside all Git checkouts. Existing directories/files must already belong to the current OS user and deny group/other access (0700/0600). This local filesystem protection is **not** proof of Jack-only web authentication.

    NS_DASHBOARD_OUTPUT="/absolute/private/ns-dashboard"
    node scripts/ns-dashboard/cli.js collect --output "$NS_DASHBOARD_OUTPUT"
    node scripts/ns-dashboard/cli.js project --output "$NS_DASHBOARD_OUTPUT"
    node scripts/ns-dashboard/cli.js overview --output "$NS_DASHBOARD_OUTPUT" \
      --records /absolute/private/owner-records.json

The recommended export keeps the retained collector separate from the private page bundle:

    node scripts/ns-dashboard/cli.js dashboard --input "$NS_DASHBOARD_OUTPUT" \
      --output /absolute/private/founder-dashboard \
      --records /absolute/private/owner-records.json

Bookmark founder-dashboard/index.html. Overview, Delivery, Queue and Evidence are four real HTML files with normal navigation, browser back/forward and direct URLs. Overview answers four founder decisions; unmeasured engineering metrics, lineage, limits and the access proposal live in Evidence. A decision receipt supersedes an older observation with the same scoped ID; approved items are excluded from the pending list.

The dashboard command reuses the retained source without any network call or source write. It validates all inputs before publication, writes a complete immutable snapshot directory, then atomically replaces the stable index.html. Links stay inside one snapshot, including when a later update is published. Earlier snapshots are retained. There is one exclusive dashboard writer; interrupted locks require owner inspection before removal. The original overview command also writes the bundle and keeps overview.html as a compatibility entry, plus overview-projection.json; project/projection.json remains separate.

These are static exports. A page load or reload never collects data, changes its timestamp or detects a later error. Source/proof age and supplied refreshing/error states are calculated when generated. Collector failure retains the last good source; invalid projection input retains the previous page entry. The visible bar keeps the GitHub refresh time and owner-briefing observation time distinct, in Sydney time; Evidence retains UTC. A later briefing cannot freshen an older GitHub capture.

For Library delivery, provide the whole frozen four-page bundle as a private ZIP. Download and extract it before opening index.html. Relative links in the Library viewer have not been verified and are not promised. The stable local bookmark remains the owner-local entry above; an extracted ZIP is a dated copy, not an automatic update channel.

The self-contained pages use system fonts, inline CSS, native disclosures and relative file navigation. CSP denies scripts, network connections, images, frames and other external resources. All dynamic source text is escaped; raw captures are not embedded. Actual-data pages, screenshots, records and archives remain outside Git in private directories. Only code and synthetic fixtures belong in the public PR. Local ownership is not hosted authentication.

The recommended hosted follow-up uses the existing Vercel project and NS login, server checks for Jack's verified account ID plus admin role on every page/data response, and one dedicated private snapshot store on existing Supabase. Existing admin APIs accept bearer tokens; normal bookmarked HTML navigation needs a secure server session bridge. Deployment-URL Vercel protection excludes custom domains and does not establish Jack-only access. Begin with owner-requested bounded refreshes, last-good publication and explicit stale/error status; page loads do no collection. Storage/session configuration, account binding, credential source, service quotas and any reconciled future cadence need a separately approved hosted phase. This PR creates none of them and promises no free usage or hard spending cap.

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

Use --records /absolute/private/owner-records.json when projecting. Keep that file owner-only and outside Git. Its optional top-level sections are queue, release and briefing. Do not paste transcripts, credentials or customer rows. Classification keys are explicit dashboard grouping keys from an existing owner record, not a competing queue. Priorities and accountable owners are read from that source.

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

## Founder briefing contract

briefing requires source, observedAt, complete (boolean), published, work and decisions (explicit arrays). Its coverage and observation time remain separate from GitHub. This is a small owner summary from existing receipts, not a second release queue. Unknown fields, missing arrays, future observations, duplicate work/publication identities and ambiguous decisions fail closed.

- published: [{id, title, summary, deploymentId, verificationId}]. Each entry must bind to the projected production activation and its matching latest passed verification scope. A merge or green CI alone is rejected. Version, SHA, verification date, scope and source are derived from that proof. This is dated publication history, not certification of a delivered user outcome. Expired proof cannot support current-live status. Historical publication remains dated; this slice does not yet ingest a complete multi-release history.
- work: [{id, title, state, reason, owner, nextAction, prNumbers}]. state is waiting, blocked or in_progress. These source-owned summaries may cover PRs newer than the retained GitHub cutoff; no current PR state or stage age is inferred from them.
- decisions: [{id, title, action, status, observedAt, source}]. status is pending, approved, declined or resolved. Use a decision ID scoped to the exact candidate/action; retain history. The latest dated observation wins regardless of input order; conflicting equal-time observations reject. Approved, declined and resolved decisions remain in Queue/Evidence and are never rendered as requests for renewed approval.

There is no manual productivity score or unsupported comparison input. An improvement claim requires a future validated, comparable delivered-outcome series. Current PR activity stays separately labelled in Delivery.

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

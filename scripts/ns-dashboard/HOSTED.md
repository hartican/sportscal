# Hosted dashboard source candidate

This is the approved hosted implementation lane, stacked on the reviewed local dashboard at 155188c. It is not deployed or enabled. Existing localhost files/process/tabs are untouched. The sole publisher schedules integration after the existing urgent release; this branch does not publish itself.

## Destination and activation prerequisites

The only accepted runtime origin is https://www.nothingsport.app. Ten exact rewrites target two small functions in the same existing Node24 service: Overview at /admin/dashboard, Delivery/Queue/Evidence below that path, private view HTML at /api/admin/dashboard/view/{overview,delivery,queue,evidence}, data at /api/admin/dashboard, and the session bridge below /api/admin/dashboard/session. Deployment aliases and other hosts are denied rather than becoming alternate private entry points. There is no public operational HTML or JSON in the build.

Use the existing Vercel project prj_NAMl47QVLbPUfsMmap59JIpchOPD/team team_7deI3EHsjeMpMdPiaLSQZBwW and Supabase nothingSport-recovery mkghopnkhcxtmfrcjdbc. Existing Supabase URL/publishable/service credentials stay server-side; no value is copied or read during source qualification.

Default is disabled. Only after the two outstanding prerequisites and normal review may the publisher configure:

- NS_DASHBOARD_OWNER_SUBJECT: verified immutable intended NS subject; not a display name, email match or inferred lone admin. It remains server-only, outside source, artifacts and snapshot payloads.
- NS_DASHBOARD_READINESS_SHA256: hash of the owner-private identity/quota/access readiness receipt.
- NS_DASHBOARD_ENABLED=1: final access enablement, after schema/storage/denial verification.

Identity and quota prerequisites are evaluated from owner-private evidence. Never infer the intended subject from a lone admin, display name, email match or another provider's account, and do not enumerate unrelated accounts. A provider plan alone does not establish remaining resource/credit balances or general budget/pause/spend-cap controls. Unresolved prerequisites block bucket writes and access enablement. Approval for this implementation is already granted; no repeat generic permission request is needed. Additional cost/access outside that scope returns its concrete decision. Current account identities, plan/settings evidence and private correspondence remain outside this public source.

## Authorization and cookie bridge

Each private view/data/HEAD request checks the canonical host and server configuration, then the configured immutable subject. Rejection-only JWT parsing is never treated as signature validation. The caller's JWT goes to PostgREST, which must validate it, and ns_dashboard_authorize_session checks current auth.users admin status, confirmed email, ban/deletion/erasure state and the matching live auth.sessions row/not_after. No positive authentication or role result is cached. A removed role or revoked session therefore prevents storage reads even when a JWT still carries old claims.

Canonical documents are nonsensitive HTTP401 bootstraps, even with an owner cookie. They never return private HTML, a2xx or redirect to a private200. A separate entry function cannot read snapshots or be switched into the private function with a query. This is necessary because existing606/607 workers ignore no-store for successful navigations and write them under /index.html. Only /api/ is already network-only in those workers. The entry therefore fetches server-rendered private views through explicit /api/admin/dashboard/view/* endpoints. Those private responses use the same per-request immutable-owner/current-role/live-session gate and a fetch-only transport contract; ordinary document/frame navigations or missing transport headers are denied before reading. The custom header is not authentication or proof of worker state; server auth remains mandatory, and fixed function separation provides the old-worker guarantee.

The entry's explicit sign-in button uses the existing NOTHINGSPORTS_SERVER_SYNC client/NS login; no new account, password form, copied browser session or refresh-token store is added. A same-origin bearer exchange is verified through the same live gate before setting __Host-ns-dashboard with Secure, HttpOnly, Path=/, SameSite=Lax and Max-Age no longer than15minutes or JWT expiry. The nonsensitive entry uses a CSP script hash; private render responses themselves contain no scripts. Expiry returns to the entry's sign-in state. DELETE session clears only this cookie under same-origin protection; an unacknowledged close clears the private view but does not claim server logout succeeded.

Private DOM is removed on pagehide, visibility loss, offline and session-close/auth-storage changes. Response generations and aborts prevent late successes from remounting cleared data. Every private read requires the current NS bearer and a matching HttpOnly dashboard cookie. Cookie-only requests fail before authorization or storage. Foreground/history restoration reads the existing NS session storage afresh, re-exchanges the current bearer through the server gate, and checks token equality after each asynchronous boundary. Ambiguous or inaccessible NS storage fails closed. No NS storage is written by the dashboard. Account-change events clear private DOM. Foreground/history restoration reauthorizes through the private API; it never reuses saved private HTML. These lifecycle reads do no source collection or recurring polling. Browser bfcache/restore/first-paint behavior remains a native acceptance gate: headers alone are not a blanket bfcache guarantee, and pagehide is not reliable on every mobile termination path. Visibility/offline guards complement it, without claiming universal source-only proof.

All success/error/auth responses are no-store in browser and both CDN header namespaces, vary on cookie/Authorization, deny framing, use nosniff and do not emit raw errors, tokens, identity values or provider payloads. Current signed-in non-owner, anonymous, stale-role, revoked-session, alias, cache/error and direct-storage managed tests are release prerequisites, not established by synthetic source tests.

## Storage source template (not applied)

hosted-storage.sql is a reviewable SQL template, not an executed migration. The Supabase CLI is not installed here; no install or DDL was performed. At action time the existing publisher must inspect actual schema/bucket/policies, generate the tracked migration with the supported CLI, review it, and run the existing managed checks before activation.

The definer helper lives in a private schema with an invoker public wrapper, fixed search_path and narrow execution grants. It returns a boolean about the verified caller; it exposes no user/session rows. The expected owner is passed only from trusted server configuration. Calling the boolean RPC directly does not grant object access.

The dedicated ns-dashboard-private bucket is private, JSON-only and caps one object at256KiB. An explicit RESTRICTIVE policy excludes this bucket from all anon/authenticated direct object access, including existing broad permissive policies. The gated server alone reads it using the app's existing server credential. No public URL or signed download URL is issued. Other buckets' effective policies remain unchanged. Existing mismatched bucket configuration aborts for inspection.

Rollback first disables the dashboard flag/routes. Preserve the private bucket and its restrictive denial while inspecting retained data; do not remove protection or delete data as an automatic rollback. This slice grants no customer-data mutation or retention job.

## Snapshot data and manual refresh

prepare-hosted.js is offline-only:

    node scripts/ns-dashboard/prepare-hosted.js \
      --input /absolute/private/projection.json \
      --output /absolute/private/hosted-candidate

It writes an owner-private sanitized immutable snapshot and publication-candidate manifest, never uploads or advances latest.json. Only explicit release summaries, selected work/role owners/PR numbers, scoped decision history, source clocks/freshness, repository aggregate windows and sanitized receipt references are retained. Raw captures, conversations, customer rows, emails/subject UUIDs, tokens and absolute local/private paths cannot be passed through. Private source pointers become receipt hashes; only exact public repository source URLs are kept. The receiver rejects unknown/noncanonical fields and verifies the complete object hash/size. Missing reopen counts remain null, not zero. Publication/proof/decision semantics retain the local source guards.

Object protocol:

- snapshots/<64lowercaseSHA256>.json: ns-dashboard-hosted.v1, preparedAt, sanitized projection. At most current and previous, each <=256KiB. preparedAt is an offline preparation clock, never a success claim.
- latest.json (<=4KiB): {schemaVersion:"ns-dashboard-latest.v1",sha256,publishedAt,previous:{sha256,publishedAt}|null}. publishedAt is the actual accepted publication observation, later than preparation. Keep source cutoffs unchanged.
- refresh/status.json (<=8KiB): {schemaVersion:"ns-dashboard-refresh.v1",state:"idle"|"refreshing"|"error",attemptedAt,errorCode:null|bounded_code}. Failure never advances the pointer/last-success. Older status cannot supersede a later successful pointer.

nsDASHBOARD remains the one manual source/measurement owner. Actual private upload/pointer advancement uses the existing approved operator/publisher connection only after identity/quota/readiness and normal acceptance; no upload credential or new recurring job is introduced by this source slice. The offline candidate is not current or published merely because it exists. A future operator transport must inspect uncertain upload outcomes and verify the stored immutable bytes before advancing the pointer; it must preserve the previous pointer on failure. This branch intentionally supplies no credential-discovery or automatic upload fallback while those prerequisites are unresolved.

Page loads do zero collection and no billing/provider/CI/queue polling. They perform one auth RPC and up to three fixed-object reads; an explicit valid previous snapshot is the only additional fallback. Total maximum5requests/5seconds through complete bodies, no retries/redirects, with a10second Vercel function limit. Pointer4KiB/status8KiB/snapshot256KiB and at most two retained snapshots give524KiB logical payload, not a provider billing cap or claim of free usage. Status failures retain dated counts with an error; missing snapshots return503, never a manufactured zero. Staleness (>24hours) is recalculated at each page render. UI uses the same four-page renderer with canonical routes and no offline delivery claims.

## Evidence and remaining acceptance

Run serially on the pinned existing Node24 runtime, with no network or new worker:

    node --max-old-space-size=128 scripts/ns-dashboard/test-hosted.js
    node --max-old-space-size=128 scripts/ns-dashboard/test-worker.js
    node --max-old-space-size=128 scripts/ns-dashboard/test.js
    git diff --check

Synthetic tests exercise the actual handler/transport/parser/preparer with fixed fake identities and responses. They prove caller ordering, no unauthorized storage reads, cookie/CSRF/cache/header behavior, exact routes, schema/redaction/hash/deadline/last-good behavior and preparation permissions. A separate in-process VM harness runs retained actual606/607 worker source and current source with synthetic Cache/Fetch/DOM/handler doubles: unsafe old200/no-store shell overwrite is a positive counter-control, then safe first navigation/API views/logout/offline/public shell preservation, direct-navigation denial and private DOM lifetime/generation fencing are checked. SQL source controls are structural only: no native/managed SQL execution, RLS proof, real session, hosted browser, physical device or whole-phase acceptance is claimed. The prior local four-page review is not carried forward as hosted clearance.

Primary contracts checked: [Supabase sessions/session_id and post-logout validation](https://supabase.com/docs/guides/auth/sessions), [private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [PostgREST auth helpers/RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Quota/account prerequisite evidence remains owner-private outside Git and the payload.

## Worker compatibility and future rollout

The future worker adds only a network-only protected /admin/dashboard path guard, with no shell-cache read/write/fallback and no redirect following. Public shell/assets keep their ordinary behavior. This is defense in depth, not the first-navigation compatibility mechanism: old606/607 see only a non-2xx nonsensitive canonical response, keep /index.html unchanged, and use their existing API bypass for private bytes. If an old controller is offline before the bootstrap, it may return the existing public app shell; it cannot return a dashboard snapshot because no private response was cached. New controllers return a nonsensitive offline503 for protected entries instead of any fallback.

The source guard is isolated on the dashboard branch's606 base, without changing its epoch constants, app shell or activation protocol. It does NOT modify the ongoing607 candidate or reserve a version. Before integration, rebase onto the actual accepted live source, preserve intervening public app/runtime changes, and have RELEASE/PUBLISH assign a coherent forward app/shell/worker epoch with normal upgrade/cache gates. Do not deploy this stale-base worker or treat a new-worker-only pass as old-controller acceptance. No worker unregister, global caching disablement, cache purge or forced takeover is introduced.

The public entry adds one small function invocation per top-level navigation, with zero provider reads. The private view still has at most5backend calls/5seconds and no collection. The two functions are within the same approved existing service/project, not a new host/service/tier; actual resource/spend facts remain required before activation.

For exact old-worker source qualification set NS_DASHBOARD_LEGACY_WORKERS to a JSON list of retained source-file paths; tests report which workers ran. Default is a self-contained compatibility mutation of the current worker with only the new guard removed; it does not claim to run published606/607 source and needs no Git history/network. This is public source in private qualification files, not customer/operational snapshots. No browser, network, worker installation or production CacheStorage is touched by VM tests. Managed browser rollout must prove first navigation under actual old606/607 control, protected reads, NS sign-out/role removal, offline/back-forward/public shell, and unchanged public app upgrade behavior. Native tests remain unrun until the existing owner allocates them.

Primary lifecycle references: [Cache API behavior](https://developer.mozilla.org/en-US/docs/Web/API/Cache), [pagehide limits](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event), [Chrome bfcache and no-store](https://developer.chrome.com/docs/web-platform/bfcache-ccns). These explain why headers and one lifecycle event alone are insufficient; source simulations do not certify browser behavior.

## 4 November 2026: automatic refresh requirement

Jack requested finishing hosting and automatic updates while preserving priority for RLWC/Follow. Manual-only refresh is superseded as the product requirement. Activation remains unimplemented and disabled; this note is not a claim that a collector exists.

Use one scheduler owner on the existing services. Proposed cadence is 15 minutes (96 attempts/day, 2,880 per 30 days), plus an existing publisher completion hook after exact served-byte/alias/SHA acceptance. A PR merge, successful CI or READY deployment alone must not trigger a verified-release claim. Browser reload performs no collection. No ChatGPT reminder is a substitute for a server collector.

The queue adapter should use conditional public GitHub reads with bounded pagination, deadlines and body sizes; do not copy a laptop gh credential to a server. Current queue observations must remain distinct from the retained lifecycle ledger used for historical trends. Public PR metadata cannot establish owner next actions, private decisions or source acceptance. Those require a sanitized push from the existing owner workflow, with original observation clocks; until connected, retain their dated values and mark them stale.

The writer must acquire one expiring lease, validate/redact the complete projection with hosted-contract.js, upload the immutable hash-named snapshot, verify stored bytes, and atomically compare/advance latest.json against the prior generation. A partial source result, 429, deadline, schema error, uncertain write or lost lease preserves the last complete pointer and records a bounded error status. No raw capture, transcript, account row or credential belongs in a snapshot, public CI artifact or log. Source-specific checked/last-success clocks and publication time remain separate. Idempotent release notifications do not republish an unchanged generation.

Before wiring activation, resolve these exact missing facts through the existing owner: verified intended immutable Jack subject; actual remaining service usage/spend controls; existing machine scheduler authentication and publisher invocation path; supported durable lease/compare-and-swap primitive on the approved private store; machine-readable sanitized owner briefing input. The existing code has only an offline preparer and a reader, not a hosted collector/uploader/lease adapter. Service plan labels do not prove allowance or a hard spending cap. Do not configure a second scheduler or store an additional credential as an implicit workaround.

After these facts are supplied, implement adapters and failure/concurrency/source-clock controls, rebase onto the accepted live candidate without changing RLWC/Follow inputs, obtain the existing source and managed/native privacy gates, and hand the exact candidate to sole PUBLISH. Provision storage/access and activate the single schedule only with the verified readiness receipt. Keep the dashboard default-disabled until that point. Dashboard work uses no heavy local/CI lane while fixture/Follow work owns it.

## 5 November 2026: plain-language pages and refresh components

Jack directed that the hosted dashboard use the approved plain-language local version too. `user-view.js` carries its typography, navigation and user-oriented structure into dynamic hosted pages: Home, Changes, Being fixed and About this page. Owner-provided titles/reasons/next steps are displayed only as clear prose; notes containing engineering identifiers receive an honest request for a plain-language summary rather than being dumped into the page or silently paraphrased. Technical lineage remains in the gated data and owner records. No current operational facts are hardcoded into public source. The local preview is untouched.

The sign-in correction from142974 remains part of this successor. Its verified exchange adds one auth RPC before the private GET; the GET's five-call bound is unchanged. Across both requests there are at most six backend calls including fallback, under the shared five-second client abort. Browser page loads still do no source collection.

New components are source-only, not activated:

- `queue-source.js`: one conditional public GitHub request, at most100 open requests and512KiB body, five-second whole-operation deadline, no credential/redirect/retry. Additional pages, partial/malformed/duplicate rows or429 fail closed. One response is the observation boundary; a larger queue needs separately qualified collection. A304 preserves the original observation clock and advances only checkedAt. Raw provider titles/IDs/branch names are not retained in the summary.
- `refresh-input.js`: prepares the existing sanitized envelope with a plain-language current-queue observation. It retains old lifecycle cutoffs, publication checks, owner decisions and unknown measurements; it ages expired production proof rather than renewing it. This is preparation only, not publication.
- `snapshot-writer.js`: implements publication ordering against an explicitly supplied `ns-dashboard-fenced-publication.v1` adapter. It requires the expected source generation, a single-writer lease, immutable object upload, exact byte readback, then a lease-fenced revision-checked commit. Busy/conflicting/uncertain operations do not retry. An unchanged generation does not renew its publication time. The adapter must enforce its lease and comparison atomically and stamp the committed publication time; a fake adapter test does not establish a managed database transaction.

Still missing: production persistence/lease/CAS adapter, current-account readiness, usage/spend facts, scheduler authentication and invocation configuration, normalized verified-release completion ingress, and source/native/managed release acceptance. No refresh endpoint, credential, scheduled job, bucket write, migration, access enablement or deployment is introduced by these components. Their presence is not an automatic-update activation claim. One15-minute owner schedule plus the existing publisher's verified-release hook remains the target after those facts and gates are resolved. The schedule must not poll private transcripts or run collection from browser loads.

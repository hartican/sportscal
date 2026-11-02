# Hosted dashboard source candidate

This is the approved hosted implementation lane, stacked on the reviewed local dashboard at 155188c. It is not deployed or enabled. Existing localhost files/process/tabs are untouched. The sole publisher schedules integration after the existing urgent release; this branch does not publish itself.

## Destination and activation prerequisites

The only accepted runtime origin is https://www.nothingsport.app. Six exact rewrites target one Node24 function: Overview at /admin/dashboard, Delivery/Queue/Evidence below that path, data at /api/admin/dashboard, and the session bridge below /api/admin/dashboard/session. Deployment aliases and other hosts are denied rather than becoming alternate private entry points. There is no public operational HTML or JSON in the build.

Use the existing Vercel project prj_NAMl47QVLbPUfsMmap59JIpchOPD/team team_7deI3EHsjeMpMdPiaLSQZBwW and Supabase nothingSport-recovery mkghopnkhcxtmfrcjdbc. Existing Supabase URL/publishable/service credentials stay server-side; no value is copied or read during source qualification.

Default is disabled. Only after the two outstanding prerequisites and normal review may the publisher configure:

- NS_DASHBOARD_OWNER_SUBJECT: verified immutable intended NS subject; not a display name, email match or inferred lone admin. It remains server-only, outside source, artifacts and snapshot payloads.
- NS_DASHBOARD_READINESS_SHA256: hash of the owner-private identity/quota/access readiness receipt.
- NS_DASHBOARD_ENABLED=1: final access enablement, after schema/storage/denial verification.

Identity and quota prerequisites are evaluated from owner-private evidence. Never infer the intended subject from a lone admin, display name, email match or another provider's account, and do not enumerate unrelated accounts. A provider plan alone does not establish remaining resource/credit balances or general budget/pause/spend-cap controls. Unresolved prerequisites block bucket writes and access enablement. Approval for this implementation is already granted; no repeat generic permission request is needed. Additional cost/access outside that scope returns its concrete decision. Current account identities, plan/settings evidence and private correspondence remain outside this public source.

## Authorization and cookie bridge

Each document, data and HEAD request checks the canonical host and server configuration, then the configured immutable subject. Rejection-only JWT parsing is never treated as signature validation. The caller's JWT goes to PostgREST, which must validate it, and ns_dashboard_authorize_session checks current auth.users admin status, confirmed email, ban/deletion/erasure state and the matching live auth.sessions row/not_after. No positive authentication or role result is cached. A removed role or revoked session therefore prevents storage reads even when a JWT still carries old claims.

Anonymous document requests receive only a nonsensitive 401 sign-in bridge. Its explicit button uses the existing NOTHINGSPORTS_SERVER_SYNC client/NS login; no new account, password form, copied browser session or refresh-token store is added. A same-origin bearer exchange is verified through the same live gate before setting __Host-ns-dashboard with Secure, HttpOnly, Path=/, SameSite=Lax and Max-Age no longer than15minutes or JWT expiry. The bridge uses a CSP script hash. Subsequent read-only pages have no scripts. Expiry returns to the bridge; the dashboard does not create a background session-refresh/polling loop. DELETE session clears only this cookie under same-origin protection.

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
    node --max-old-space-size=128 scripts/ns-dashboard/test.js
    git diff --check

Synthetic tests exercise the actual handler/transport/parser/preparer with fixed fake identities and responses. They prove caller ordering, no unauthorized storage reads, cookie/CSRF/cache/header behavior, exact routes, schema/redaction/hash/deadline/last-good behavior and preparation permissions. SQL source controls are structural only: no native/managed SQL execution, RLS proof, real session, hosted browser, physical device or whole-phase acceptance is claimed. The prior local four-page review is not carried forward as hosted clearance.

Primary contracts checked: [Supabase sessions/session_id and post-logout validation](https://supabase.com/docs/guides/auth/sessions), [private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [PostgREST auth helpers/RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Quota/account prerequisite evidence remains owner-private outside Git and the payload.

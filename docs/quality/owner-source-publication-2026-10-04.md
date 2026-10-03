# Public fixture projection and owner source boundary — 4 October 2026

**Outcome:** stop bulk HTTP downloads of three generated owner/editorial source files on the new deployment, while retaining their server consumers and existing public fixture experience. Public fixture pages now use one existing API projection rather than downloading the complete candidate file first. Shell 414 replaces shell 413 and rejects those source paths online and offline.

This closes a verified site-publication gap. It does not establish that customer accounts, recipient addresses or private saved operator edits leaked. The repository is public and historical Git/deployment copies are not withdrawn. Existing deliberate public fixture copy remains public; this module does not change admission or the generated fallback policy.

## Evidence and architecture

A read-only unauthenticated production sample at **2026-10-03T19:25:36.743Z** returned HTTP 200 for all three files. The candidate artifact contained 85 draft candidates (695,341 body bytes); communications sources contained 733 events (1,791,457 bytes); editorial maintenance sources contained 1,361 events (6,166,088 bytes). The ordinary owner workspace returned 401 with private/no-store headers. Only aggregate counts, source keys, headers and hashes were retained in the audit receipt; no full response bodies or customer records were saved.

Previously: browser fixture page → complete candidate artifact → selected campaign → public participation API. Now: browser fixture page → public participation API → existing server source/campaign lookup → selected public fixture and aggregate. Protected owner reads, saved revisions/history and source generators retain their existing owners. No new endpoint, scheduler, database migration, provider, polling or purchase.

[Vercel routing documentation](https://vercel.com/docs/project-configuration/vercel-json) and [CDN ordering](https://vercel.com/docs/how-vercel-cdn-works) explain why a simple rewrite cannot safely hide an existing static file. Three temporary redirects run before filesystem serving and target a closed mode in the existing comms handler. It returns a minimal private/no-store 404 before authentication, file reads, database access or method/action dispatch. The files remain in the server deployment because existing functions need them. The service worker rejects those paths without network/cache fallback; normal activation discards prior shell caches.

The participation handler now resolves GET default/event selectors on the server, preserving the old source order, explicit campaign precedence, stored campaign lookup, cancellation and readiness checks. Stored time-TBC pages retain their disabled participation and no guest write. POST never acquires a default selector; existing same-origin, cookie deduplication, rating windows and rate limits remain. The existing public projection strips private rating metadata and does not include email/social drafts or history.

Editorial release recording uses the existing adjacent deployment inventory instead of reopening the raw public research file. It validates exact commit, Git blob, deployed JSON transform, length and hash, then binds the existing production proof to the freshly verified READY deployment. The served shell/cards and literal four-section publication checks still run before control-state updates. Older proofs without the corresponding inventory fail closed; no additional owner-maintained record is introduced.

## Verification and limits

| Check | Evidence | Limit |
|---|---|---|
| Source denial | Real comms handler rejects GET, HEAD, POST, PUT, DELETE and OPTIONS before any source read or network request | Local isolated requests; live routing proof is separate |
| Public API integration | Real handler covers default/event/campaign precedence, stored-only links, unavailable/unready/cancelled fixtures, TBC, POST without selection, guest deduplication, rating edits, invalid rating, origin and methods | In-memory service responses, no production guest/customer operation |
| Editorial release | Actual CLI checks correct inventory/target; wrong source hash and stale target reject before control writes; identity/compact transforms and duplicate/missing entries covered | Synthetic control plane/served data; no staged production copy changed |
| Normal local release | All 137 existing safety commands pass in 139,570 ms; exact runtime and shell cache checks pass | Local runtime; cloud release remains required |
| Public fixture browser | 24 cases: Chromium/WebKit, 320/1280px, default/event/campaign/query links, unavailable and TBC; join/rating controls, reduced motion and failed artwork | Synthetic API only; no actual guest action or physical-device proof |
| Owner browser | Four cases: both engines at mobile/desktop widths, sign-in gate and synthetic protected workspace, autosave/deep links/crop/reduced motion | No real account/session or live owner edit |
| Installed upgrade | Chromium and WebKit 413→414 pass preserved choices/draft, offline/resume, optional failure, required-failure retention and legacy source cache rejection | Exact production proof pending; emulator is not physical installed-phone proof |
| Preservation | All 569 protected data/feed/config/schema/runtime inputs retain their local bytes; source files retained server-side | Exact deployed inventory and served checks pending |

The initial denial-only gate run passed but did not establish the client dependency; it is retained as initial evidence rather than final integration proof. A first upgrade test incorrectly assumed the optional fixture page was already cached. Its failure is preserved; the rehearsal now loads the page through its actual cache-on-use path before testing the cached bytes. No installation dependency or budget was enlarged to make that assertion pass.

## Recommended action and value

| Action | Value and evidence | Effort/dependencies | Cash/owner burden | Acceptance and reason |
|---|---|---|---|---|
| Publish this coherent module through the existing production owner | Closes three verified bulk source downloads and removes one 695,341-byte uncompressed candidate response from ordinary default/event fixture navigation | Small cross-boundary repair; existing API, routing and source consumers; normal gates and both upgrade engines | A$0 new spending; no ongoing owner action or added scheduler | Exact main snapshot, normal cloud gates, READY/SHA/aliases, retained server files and live 404/public-rendering proof; act now after checks |
| Keep source generation, owner editing and public rendering separated in later features | Prevents an internal source dependency from becoming a browser/public contract; one existing validator and post-release check retain the guard | Use the current public projection and existing authenticated owner API; risk-proportionate integration checks | Replaces manual review with existing automated gates | No raw-source browser request, no private draft fields in the selected response, meaningful preservation tests; continuing default |
| Defer historical withdrawal or repository ownership changes | Public Git and older URLs mean this is not comprehensive secrecy; no customer leak demonstrated in this sample | Requires an explicit retention/product decision and separate evidence if future sensitive material is introduced | No decision or purchase now | Report the limit honestly; do not claim past copies removed or change repository visibility under this module |

The body-byte saving is a structural reduction, not measured transfer latency, token/cash or retention improvement. The deployment package does not shrink because server inputs remain necessary. Full sport certification stays **0/16 families and 0/3 Football pilots**, target at least 13/16. Football acceptance, independent recovery, AU playback/permissions, physical devices and real cohort repeat visits remain the single programme's open outcomes. Passwords/iCloud stays parked under the user's instruction to carry on. [Authoritative queue](../cto-delivery-plan.md).

**Release status:** implementation and local checks only at this checkpoint; both-engine upgrade completion, GitHub publication, normal cloud gates and exact live verification must be recorded separately before calling this shipped.

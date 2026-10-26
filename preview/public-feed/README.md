# Public Feed interactive TEST version

This is a full-scope interaction preview using the actual current shared fixture
renderer, public-comment tray, GIF picker and yearbook UI/export. It is not a
production release, test-runner upload or backend correctness claim.

The dedicated static artifact starts from current main source `a6ddd15c` plus the frozen
full Public Feed `2c7f7649`, with the real delivered All Sports adapter and reviewed
P1 account compatibility source `7221edbf`. Original PR38 and its evidence stay
frozen; preview work lives on `codex/public-feed-test-preview-20261026`.

## What Jack can try on iPhone Safari

Open DEPLOY's HTTPS deployment-specific share link in Safari. No NS login or
notification permission is needed. The link may expire; DEPLOY owns renewing its
deployment-specific access without changing project protection.

1. Choose a test account. Alice, Sam and Carol have 25 test NSC points. Bob starts
   at 24. Visitor can view fixture details but cannot open or leave comments.
2. In Fixtures, open public comments beneath a full card. Try text/emojis, a
   reply, up/down/change/remove votes, More/Less and the same scrolling card/tray.
3. GIF uses the actual picker and attribution with three bundled original sample
   animations. Search/paging/selection/posting are local demonstrations. No
   GIPHY request, key or analytics is sent. Test controls can give Bob 25 points.
4. Test controls can add comments as other test people. Try the three followed
   author trails, notification switches and Follow switches. Alerts are visible
   examples only; their fixture link opens the actual full-card destination.
   Another Safari tab on the same origin can use a different test account and
   create live local comments. Other devices/testers have separate copies.
5. Rate the completed test fixture 5/5. Day 7 keeps comments; day 8 can retire it.
   Try capture failure/retry, then Yearbook to inspect top-three text/emoji
   comments/replies, Results/privacy filtering, removal, review notes/order and
   local carousel download. GIF pixels are never archived. External sharing and
   all external/provider links are disabled.
6. Hide a profile or erase Bob's synthetic account to see visibility/erasure
   examples. These do not touch a real user. Reset all test data restores this
   browser's fixtures/comments/ratings/alerts/settings. Reload other open test
   tabs after a reset. Safari private browsing/storage restrictions may prevent
   persistence; the page reports storage failure instead of claiming a save.

## Isolation and honest limits

TEST MODE stays visible, including dialogs; every interactive fixture is marked
TEST. All accounts, fixture facts, scores, comments and alerts are synthetic.
Registered/owner/privacy/erasure/rate/media/parent/vote/cursor/run rules are
represented by a browser-local model using the real comment/archive policies.
This is not managed RLS, real Auth/HTTP/CAS, outbox delivery, concurrency,
multi-device synchronization, current sporting facts or production acceptance.
The separate tested SQL receipts and 60 pending production native cases retain
their own scope.

The preview-only transport intercepts API calls in the artifact. Unknown services
fail locally; it never forwards an API call, write, external fetch or analytics.
Images use local bytes. CSP restricts connects to the same isolated static origin,
blocks workers/forms/frames/objects, and headers prevent caching/indexing/framing.
The production update script, service-worker file and web manifest are absent.
No native permission is requested. No new function/API/backend is hosted.

Build output is an explicit tracked-public-static whitelist, with no API/server
runner, environment/auth/project files, secrets, customer records, SQL, backups,
source maps or filesystem-serving path. The real runtime is assembled from its
actual current modules with the original builder's helpers/options but empty
standings/pinned-editorial inputs in the preview only. Internal public team
catalogues/code remain; production fixtures and standings are not loaded.

## Reproduce and hand off

Use existing Node24.21/Terser and Playwright1.62.1; no install or service operation.

```sh
node scripts/validate-public-feed-preview-model.js
node scripts/build-public-feed-preview.js --out=/absolute/new/artifact-directory
node scripts/validate-public-feed-preview-artifact.js /absolute/new/artifact-directory
PLAYWRIGHT_MODULE=/existing/playwright node scripts/validate-public-feed-preview-browser.js /absolute/new/artifact-directory
```

Freeze source before native execution; the verifier refuses dirty artifacts.
It serves exactly the manifested static bytes with the artifact's actual CSP,
with no functional API/server/Playwright fulfillment. Chromium then WebKit390 run
serially once under ROOT's bounded allocation; failures/traces are retained and
any repeat requires an identified source correction. Normal/SQL/native production
gates are not dispatched. Artifact and proof belong in the personal Codex output
folder, not the repository.

DEPLOY alone inspects and publishes the immutable artifact through the existing
Vercel static PREVIEW route, on a dedicated HTTPS origin with deployment-specific
access. Never upload this checkout or assign a production alias. ROOT owns the
Build Output staging/project association/access/hosted readback. No purchase,
environment pull, credential grant, project-protection change or worker deployment.

Rollback: remove this separate preview deployment/access link. Original production
source, PR38, schema, jobs and user accounts remain unaffected.

# Bounded observations for the existing installed-app reload test

Required Linux WebKit run40240264797 failed at the original owned-origin
transport-failure reload with `WebKit encountered an internal error`. The saved
failure remains FAILED and its cause UNPROVEN. Accepted594 and its iPhone account
sync proof remain accepted history; this does not establish a production defect.
The one allocated actual594→595 macOS WebKit2336 local reproduction passed the
same original reload/version seam, then stopped before later offline tests.
That result does not replace complete Linux installed or physical-phone proof.

This source slice only adds bounded observations to the existing normal
`validate-installed-pwa-upgrade-browser.js`. There is no diagnostic workflow,
mode, flag, early return, skipped recovery, changed browser, product runtime,
network request, cache write, permission or dependency. Existing normal
browser.log artifacts retain the observations. DEPLOY alone integrates and runs
one reviewed changed-source normal Linux workflow. No worker-started CI,
unchanged retry, full-suite rerun or second Mac browser loop occurred here.

Immediately before the unchanged reload, the actual browser function reads the
document version, online flag, controller/registration lifecycle, presence of
the exact candidate shell cache and its cached index. It hashes complete cached
index bytes with SHA256 and compares both the parsed version and hash with the
actual candidate index bytes supplied by the existing local server. It creates
no missing cache and does not read preferences, headers, query values, fixture
IDs, account state or event payloads. The metadata contains only fixed fields,
digit-only public versions, source hashes, booleans and enumerated lifecycle
states. A missing/unreadable/over4MiB index is unavailable rather than evidence
of a valid cache. Observation collection stops waiting after1000ms; a failed or
expired observation stays unavailable and cannot replace the original reload.
This observation bound does not change any existing reload/test deadline.

The same page's main-document request, response, failure and commit events are
recorded only for the owned origin. URLs reduce to root/index/other-owned
classifications; query strings, paths/IDs, headers and raw error text never
appear. Request ordinals and observation order correlate those events with
owned-server socket cutoffs. Other resource cutoffs remain bounded counts so
they cannot flood document observations. At most16 events are retained;
dropped/unavailable and cutoff counters saturate at999. Engine-exposed
fromServiceWorker/status signals may be null. Missing signals do not prove
service-worker bypass, a cache miss or any cause.

The original reload is called once with its original `domcontentloaded` wait.
Its response or original thrown error is returned unchanged. Observation/log/
listener faults cannot suppress that error or create a retry. All subsequent
exact-version, offline data, account recovery, resume and network-isolation
checks remain on the normal path. The denyproxy, owned server cutoff itself,
existing timeouts, assertions and cleanup remain. Passing an observed run alone
is not a causal fix: gathering observations can affect timing, and the original
failure still needs an evidence-bound explanation.

`validate-installed-test-network.js` retains all117 pure controls and also runs
20 pure observation controls. The latter execute the actual browser snapshot
function in a VM with actual byte hashing, including wrong/missing/oversized
cache inputs, no missing-cache creation, field allowlisting, owned main-frame
filtering, redaction, event/counter bounds, absent engine APIs, capture timeout,
faulted logging/cleanup and exact original-error identity/one call. There is no
browser, DNS, provider, socket, database, main publication or deployment in these
controls. Local source checks are preparation, not installed release acceptance.

Desired next Linux distinction: whether an owned main navigation was requested
and committed/responded while the exact candidate index/controller were valid,
versus a missing/mismatched cache or lifecycle state. Treat unavailable engine
observations as unknown. Substantive app-cache findings return to the separate
All Sports owner through DEPLOY; this worker does not edit that owner's focused
test or take another runtime/cache repair lane.

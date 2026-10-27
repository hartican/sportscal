# Optional standings presentation uses the existing deferred owner

This implements the approved performance/Follow extraction within the current
main source. It changes loading placement, not product choices or sporting
facts. Keep the compressed startup cap and every release gate unchanged.

From base `a6ddd15caacdaf918e8108c3cfa0e54b98e22d90`, move seven standings-only
helpers and the renderer body to `assets/js/follow-presentation-ui.js`, which
already owns optional Follow presentation and is already precached. Every moved
helper AST, renderer parameter and renderer-body AST matches both current base
and the previously reviewed frozen PR41 source at35384b98. Do not import that
branch's grouped cards, gender/formats, coverage or preferences.

`renderStandingsContext` stays in the shell as the existing entry. Preserve its
inactive/Follow routing and container prologue, then use the existing deferred
Follow loader. Render only while the original tab and connected target remain
current. The existing loader verifies the new loaded renderer as well as its
previous two exports, so an old/incomplete module gives its existing error and
retry instead of repeatedly calling an absent body. No new loader owner,
request URL, scheduler, preference or error/retry protocol is introduced.

Keep the five shared table helpers in the shell: the cold major-event preview
calls them without loading Follow. Moving those helpers would require broader
caller changes, so they are deliberately excluded from this minimum extraction.
Existing pin ordering and explicit pin writes, Results OFF, table rendering,
canonical source loading, reveal and offline/cache owners remain unchanged.

Focused source regression executes the actual embedded caller, wrapper,
existing script-loader owner and moved renderer with disposable DOM/transport.
It covers cold inactive/Follow routes, coalescing, existing pin action, Results
OFF, transport and incomplete-module retry, and stale/disconnected targets.
Mechanical equivalence audit:
`node scripts/validate-standings-presentation-deferral.js --equivalence-base=a6ddd15caacdaf918e8108c3cfa0e54b98e22d90`.
The normal Follow collection-loading gate also requires the regression.

Actual critical bytes fall from431362 to428998 gzip (2364bytes saved), retaining
seven critical requests. Precache remains below the existing3MiB cap. The
canonical runtime builder and generated asset identity are checked separately;
DEPLOY owns final combined generation and cache/version changes. These local
measurements are not claims about a different combined release.

Native embedded/Follow/Sport Hub routes, stale module retry, installed upgrade
and offline cache behaviour still require DEPLOY's allocated combined tests.
No browser, native, account/service/provider/SQL/data/refresh or deployment
operation is authorised by this source-only record. Frozen PR41/353 and
checkbox PR74/757 remain separately preserved.

# All Sports View

Implementation of the 22 October interview contract, authorised on 24 October
through the existing DEPLOY allocation. DEPLOY owns final integration, cache
versions, publication and live acceptance. This source is not a deployment.

## Product contract

- A separate All Sports view inside Match Centre; Followed remains the default.
- Today runs from now to Sydney midnight. +24 and +48 are distinct cumulative
  rolling ranges, using elapsed hours across daylight-saving boundaries.
- All supported public schedule fixtures are independent of personal follows.
  Existing global coverage exclusions remain. Overview/ticket/unpublished
  records are not fixtures; canonical/source aliases render once.
- Source-confirmed unfinished contests remain once at the top of Today.
  Elapsed schedules cannot manufacture play, completion or a resumption.
- Existing minimised cards expand to the existing full card inside the grid.
  Local expansion must not change account choices, shared Feed expansion or
  engagement/seen counters. Explicit native actions retain their normal guards.
- Non-overlapping cards use full width. Connected playing-time overlaps use
  side-scrolling pages: two visible phone columns, three/four at wider existing
  breakpoints. Unknown finishes remain potentially overlapping until that date
  section ends; no duration or sporting clock is invented.
- A separate Time TBC section shows known-day fixtures without a confirmed
  start; partial-day range inclusion is qualified. Undated fixtures cannot be
  assigned to a bounded time range. Existing approximate wording stays honest.
- Date headings, accessible previous/next/page position, keyboard focus,
  inline collapse and range/scroll restoration remain available.

## Interfaces and data path

`GET /api/match-centre?view=all-sports&membership=everything&range=today|24|48`
returns `all-sports.v1`, window bounds, a revision, events, membership staleness
and cursor/limit/total/nextCursor. Limit stays at 60 maximum. Continuations carry
the returned `asOf` and `revision`; a changed inventory returns 409 rather than
silently skipping fixtures. The client loads every API page independently of
horizontal UI pagination and labels failed continuations incomplete.

The listing starts with the complete shared published schedule and overlays
`readLiveSnapshots({scope:'global'})`. This uses the existing global cache and
**six-second total** trusted policy, not the near-live projection. Failed or
stale global reads retain the published/last-good fixtures and explicitly say
current updates are unavailable. Static traversal is not proof of healthy
current membership or a loading repair. No listing-page compact-score read is
added. Visible scores use the existing selected path, at most 60 visible IDs
and three-second RPC batches, with existing source intervals and hidden stop.
No SQL, schema, provider, cron, notification or auth change is included.

The optional generated All Sports module loads only on entry, through the
existing deferred-script owner. The existing worker caches assets on use;
offline return after use can restore its last-good public data. First offline
use without the module offers Retry and Back. It does not claim uncached
fixture completeness. No initial request or mandatory precache asset is added.

The shared renderer opt-in is:

```js
buildEventCard(event, {
  mode: 'schedule',
  cardState: 'compact', // also selected/opened
  onCardStateChange(nextState) { /* the host owns state and focus */ }
});
```

Without the callback the renderer retains its existing behaviour. With it,
disclosure delegates, saved minimisation does not hide the chosen local state,
and merely mounting/expanding does not record a seen/open interaction.

## Verification and release

`validate-all-sports-view.js` joins the existing required Match Centre gate.
It covers Sydney/DST and exclusive bounds, public scope, ongoing/terminal
facts, date-only/estimated starts, alias bridges, known/unknown overlaps,
139-row complete pagination, revision changes, stale static fallback and
bounded selected reads. `validate-all-sports-view-browser.js` exercises actual
cards and handler replies in both engines, with all ranges and API/UI pages,
phone/wide geometry, expansion/privacy/account state, TBC and failures.

Preserve the seven-request/431441-gzip critical ceiling and 3 MiB installed
shell ceiling under the pinned Node runtime. Generated code must match source.
Final cache keys and required complete CI/installed/hosted/device checks remain
with DEPLOY. Reverting the source commit removes the optional view and adapter;
there is no database/config undo or customer-state migration.

# Cricket team and tour follows reach Feed

The reported v596 Home Screen journey follows India or the Black Caps from
Match Centre, or India tour of New Zealand from Events. Those choices must
include the relevant supported match without a separate Add to Feed. The
reported match is `fixture:cricket:espn:1539434`, published at 18:00 AEDT on
27 October 2026. No private account snapshot was inspected.

## Reproduction and cause

The source regression runs the actual `openFromFixture` → profile → directory
Follow control → writer, the Events edition toggle, the cold manifest/schedule
loader, and the client Feed selectors. Its retained public-source fixture input
comes from base `8849bd09`. Both team routes and the tour route failed before
the repair. Removing only the profile-written hidden Tests restriction, or
binding only the child to its published tour, separately restores admission.

A generic profile button inherited `directoryFilters(...).cricketFormat`, whose
default is Tests. It now uses the existing whole-team writer. Only the actual
format-filtered directory call site passes a captured format. A new whole-team
record omits `cricketFormats`; explicit arrays, order, empty values and Unfollow
remain distinct. Opening a profile, loading data or normalizing preferences
cannot broaden an existing record. A deliberate new Follow may replace it.

The Events control already saves the correct overview key. The Code producer
now binds existing `editionId` metadata through the overview's exact
`fixtureIds`, matching sport, competition and the published date window. It
preserves an existing edition, refuses ambiguous membership and leaves unknown
children unresolved. No competition/year/name inference admits another fixture.
The manifest lists that Cricket code's published edition IDs and exact child
membership context so a followed tour can load its schedule without creating a
sport follow. Unknown keys and excluded tours cannot request it. The same
indexed resolver binds older saved rows before a failed schedule read returns
its fallback. Without exact published membership, those rows stay unresolved.

The server catalogue and Feed normalizer use the same exact published membership
resolver. This retains the link for older persisted rows without `editionId`.
The shared identity owner indexes each loaded metadata array once and retains
only membership context, with no score, status or source-observation cache.
It retains the existing gender-aware Follow classifier locally; normalized
edition context survives the manifest even when an older raw key is Cricket.
Changing only gender cannot attach a match to the other gender's edition.
Existing exact child edition choices retain precedence over the linked parent.
Independent participant and event choices keep the existing 9 October contract:
an event exclusion does not remove an independently followed team's match.

## Durable choices and facts

This repair changes no preference schema, sync policy, API, database, scheduler,
provider or account data. It uses the established absent-format whole-team
representation and the unchanged v1 event-edition state map. Manual Add remains
the exact fixture's separate saved action. Existing visible Feed filtering still
honours dismissal/archive; retained API/history records are not mistaken for
visible Feed cards. Existing competition exclusions, coverage and gender gates,
source clocks, results and canonical IDs remain authoritative.

Pure old/new producer comparison on the retained source yielded 151 Cricket
fixtures and 38 editions. The only added row field was `editionId`; every prior
field, including IDs, participants, clocks, source checks and media, was equal.
No source observation or canonical output was refreshed by that comparison.

## Tests and remaining acceptance

`validate-follow-decisions.js` permanently includes
`validate-cricket-follow-admission.js`, so the existing required Follow gate
runs the new regression without a new workflow command or refresh path.
The regression covers both actual team routes, the actual Events control,
fresh manifest → schedule → visible Feed selection, client/server parity,
serialized local reload, explicit format/empty/Unfollow choices, captured
directory intent, event/participant precedence, competition and exact-child
exclusions, manual pin/dismissal preservation, foreign IDs/sport/gender/season,
unknown editions, missing/conflicting membership, older live/store rows and the
actual saved-cache/failed-read branch with and without published evidence.

The DOM, static-data transport and local save boundary are disposable doubles.
The actual server module uses the retained public overview input in an isolated
module instance. These are source proofs, not real storage ACK, hosted,
cross-device, installed-app or physical-phone proof. The existing SYNC
bookkeeping suite separately passed 106 compiled-helper/API and 26 collection
controls on the frozen writer snapshot; it does not resolve the separate phone
sync hold or certify the new UI on a device.

DEPLOY owns scoped derived generation through the existing canonical command,
combined runtime/cache versions and all ordinary release gates. The generated
Cricket Code/Schedule and shared manifest/overview/chat companions must be
coherent. Real browser, offline/upgrade, accepted-account reload and second
session checks remain release acceptance. No worker deployment is authorised.

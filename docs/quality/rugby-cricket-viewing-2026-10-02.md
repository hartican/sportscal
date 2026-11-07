# Australian Rugby/Cricket viewing — 2 October 2026

Release status: shipped and production-verified at `eef4ffcf3d10c7d53e855f52d6686af2a0a5813e`, shell 364. This bounded delivery advances the existing cross-sport programme. It does not certify a sport or add demand, competitions, subscriptions or source polling.

## Material user benefit

Rugby no longer promises Stan coverage for every competition. Reviewed fixtures show supported Australian options, with free Nine/9Now before Stan for the reviewed Wallabies home/Bledisloe fixtures. The three October South Africa–Australia Tests show Kayo and Foxtel. Unsupported coverage says “Australian viewing unconfirmed”. Provider buttons preserve Results privacy and distinguish checking replay availability from a verified replay. The incorrect October Margaret River Pro seed is now a completed April event, under its original activity identity.

## Evidence and implementation

The current [Rugby Australia guide](https://www.rugby.com.au/watch) supports Nine/9Now for Wallabies home matches and New Zealand opponents. Dated Stan competition pages support [Super Rugby AUS](https://www.stan.com.au/watch/sport/rugby/super-rugby-aus), [NPC](https://www.stan.com.au/watch/sport/rugby/npc), [FPC](https://www.stan.com.au/watch/sport/rugby/fpc), [PREM Rugby](https://www.stan.com.au/watch/sport/rugby/prem-rugby), [WXV](https://www.stan.com.au/watch/sport/rugby/wxv) and the [Bledisloe fixtures](https://www.stan.com.au/watch/sport/rugby/bledisloe-cup). These establish viewing availability within a reviewed September–October window, not every worldwide fixture or authenticated playback.

[Cricket Australia’s current Test series page](https://www.cricket.com.au/matches/series/CA:4568) identifies both broadcasters for all three Tests. [Foxtel’s current Cricket page](https://www.foxtel.com.au/watch/cricket.html) corroborates the October tour. The warmup, other tours, other formats, reserves and future seasons gain no inferred entitlement. CA4568 remains distinct from September ODI series CA4567 and the shared ESPN tour identifier.

The existing non-critical rights audit holds eight exact competition/fixture windows and actual observation dates. A small presentation helper applies that evidence after sporting reconciliation in generated schedules, publication and existing Feed/live APIs. Viewing richness cannot choose a different sporting record. Local Australian dates, including daylight saving, bound the review. An unchanged rebuild retains original viewing observation dates. One existing snapshot read per request and normal ETag behaviour survive; source ingestion, persistence and cadence stay unchanged. The canonical owner is `scripts/update-cards.js`; its scoped `--viewing-reconciliation` route reuses normal projection/publication checks. No alternative refresh owner exists.

All 694 Rugby and 130 Cricket fixture IDs, timings, results and original source observations survive across both generated schedules. Published Feed additionally propagates the already-reviewed Rugby participant IDs, aliases and host timing provenance. Unrelated current editorial stays intact. The final implementation preserves concurrent fantasy options, tennis defaults, rating artwork and owner content work from main.

## Competition-aware viewing matrix

Window: 25 September–31 October 2026. “Supported” means sourced Australian viewing metadata, not complete fixtures, correct timing, replay access or family certification. Existing duplicate representations count as records; they are not asserted to be unique matches.

| Rugby source group | Fixture records | Supported viewing | Unverified viewing |
|---|---:|---:|---:|
| Pro D2 2027 | 40 | 0 | 40 |
| Farah Palmer Cup 2026 | 10 | 10 | 0 |
| Bunnings Warehouse NPC 2026 | 20 | 20 | 0 |
| URC 2027 | 35 | 0 | 35 |
| English Premiership 2027 | 21 | 21 | 0 |
| English Championship 2027 | 35 | 0 | 35 |
| Heartland Championship 2026 | 12 | 0 | 12 |
| WXV 2026 | 3 | 3 | 0 |
| Rugby Europe Conference Men's  2027 | 13 | 0 | 13 |
| Top 14 2027 | 35 | 0 | 35 |
| WXV 2026 | 20 | 20 | 0 |
| Super Rugby AUS 2026 | 3 | 3 | 0 |
| Men's Internationals 2026 | 3 | 1 | 2 |
| Premiership Womens Rugby Cup 2026 | 14 | 0 | 14 |
| Women's Internationals 2026 | 2 | 0 | 2 |
| Bledisloe Cup | 2 | 2 | 0 |
| curated | 1 | 1 | 0 |
| Rugby Europe Trophy Women's 2027 | 1 | 0 | 1 |
| Rugby Europe Trophy Men's 2027 | 2 | 0 | 2 |

Total: 81/272 records have supported viewing; 191/272 remain unverified. Absence from Stan’s catalogue is not proof that no Australian broadcaster exists. Do not conceal these gaps in an aggregate quality score. All three existing October Test identities have supported viewing. Warmup viewing remains unverified.

## Working destinations and limits

Public Chromium checks load Stan’s two reviewed Australian destinations and Kayo’s schedule. Rugby Australia’s linked 9Now programme returned HTTP 404; the released metadata instead uses [Nine’s live-TV landing](https://www.9now.com.au/live), verified HTTP 200 and redirected to its Channel 9 live page. It is a broad live destination; regional channel selection remains with Nine. These are not fixture playback permalinks. Foxtel’s official Cricket page is source-verified, but local browser access failed with an HTTP/2 error and then timed out using HTTP/1.1. Keep that limitation explicit. No subscription, payment, login or playback was attempted.

Stan’s current listings and static FAQ headings disagree about some years; the actual 2026 listing supports this review. Its general and Super Rugby AUS pages also disagree about one kickoff, while published Bledisloe fixture times differ from its listing. No programme start, marketing page or conflicting broadcast clock changes fixture facts in this module. Host-fixture timing and the second Bledisloe duplicate remain separate Rugby acceptance work.

## Release prerequisite: incorrect surfing seed

The ordinary result gate found a manual-calendar Margaret River Pro card scheduled for 2 October. The [host authority’s event dates](https://www.amrshire.wa.gov.au/shire-and-council/news/what-locals-need-to-know-about-the-pro) and [Surfing WA’s completion report](https://surfingwa.com.au/george-pittar-and-lakey-peterson-win-2026-western-australia-margaret-river-pro/) establish the April window and confirmed winners. The exact existing card is corrected through reviewed result evidence; its activity ID, original import classification and calendar reference survive. A date-only event window avoids inventing an exact clock time. Ordinary retention removes it from the current paged Feed. No customer action, room, credit, reminder or stored account is deleted or replayed.

The validator now accepts an explicitly dated date-only window without a fabricated time. Exact/ordinary events and invalid/incomplete windows retain their time/date validation. Official corrections retain import provenance separately from the new source classification. A selected-result application preserves unrelated current sporting facts and editorial.

## Verification and retained failures

The canonical scoped route, exact identities/season/participant/format bounds, warmup exclusion, rights expiry, local midnight/daylight-saving bounds, unchanged evidence dates and source-to-projection/API checks pass. Chromium and WebKit each pass 128 final Feed/Schedule cases across four widths, including actual URLs, accessible provider names, Results privacy, degraded states and the ordinary Cricket Schedule route. Rebased 363→364 cached upgrades pass in both engines, including the new viewing rules, preserved preferences/drafts and offline restart.

An earlier WebKit upgrade exceeded the unchanged navigation limit; the diagnostic unchanged rerun and final rebased runs passed. The intermittent failure remains unresolved. A first local fantasy check lacked newly added Ajv dependencies after concurrent main work; the pinned dependencies were installed and the check passed. Initial broad evidence application would have changed unrelated editorial; that candidate was rejected in favour of selected application. The initial 9Now 404 and Foxtel transport failures remain saved, not counted as successes.

No physical iOS/Home Screen, signed-in Foxtel/Stan/Nine playback, production private-profile journey or comprehensive worldwide broadcast certification is established. Public landing pages and isolated browser journeys are the demonstrated scope.

## Value, cost and recommended next work

Value: remove misleading watch promises, expose verified free access and make three imminent Australian Tests actionable. Effort: a shared presentation seam plus bounded sport-specific evidence, with a necessary seeded-card correction. Dependencies: existing fixtures, official public evidence, current source/release owners. Added service cash cost: A$0. Recurring owner-time impact: no new routine or approval; future rights/coverage work belongs in the existing prioritised queue. Acceptance: precise supported windows, honest unknowns, original identity/activity/facts preserved, no source-observation churn, actual card URLs/privacy, normal release gates and production proof.

Next: complete the separate host-clock/duplicate Rugby gaps and retain them in the quality register; then assess motorsport/golf/sailing under the existing ordered programme. Provider playback/device and material commercial permission gates remain open. Full programme certification stays 0/3 Football pilots and 0/16 families; the target of at least 13/16 is not achieved by this viewing module.

## Evidence folder

`/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`: viewing inventory, rights quality matrix, original/final preservation comparison, canonical logs, local/rebased contract reports, both browser reports, cached-upgrade logs and public-destination probes. Verified production evidence is saved in `viewing-release-eef4ffc-20261002/`, `viewing-served-artifacts-20261002.json`, `viewing-final-cloud-20261002.json`, `viewing-live-api-20261002.json`, both `viewing-live-*-20261002.json` browser reports and `viewing-live-worker-20261002.json`.

## Production acceptance

Normal workflow [36982237964](https://github.com/hartican/sportscal/actions/runs/36982237964) passed without bypass in 202 seconds. Exact published/deployed snapshot `eef4ffcf3d10c7d53e855f52d6686af2a0a5813e`; READY `dpl_4tkuzAnyg41cczqVWXgMCfixQ26U`. Production target, all three aliases and eighteen package/served hashes agree at `2026-10-02T08:12:07.030Z`. The package’s normal five core checks and thirteen affected artefacts are verified separately from local implementation. Fresh anonymous live API verification passes four selected cases with `stale: false` at 08:13:04.380 UTC. Both live engines pass 128 actual-component/ordinary-route cases. A genuine fresh production worker executes the new rules and preserves current Rugby/Cricket destinations after an offline restart.

Startup remains eight critical requests, 429455 gzip bytes, 0.91% above the existing baseline and below its unchanged 1.25% cap. Sixteen initial affected contracts and thirteen rebased checks (after the documented dependency repair), meaningful selected-result/API contracts, both cached upgrades and the normal cloud release suite pass. Earlier failures and limits above remain part of the evidence. Current GitHub main is later allowed to contain documentation-only acceptance updates; those do not alter the proven app snapshot. Added service cost remains A$0; no recurring owner routine, source poll, scheduler, database change or reminder replay was added by this module.

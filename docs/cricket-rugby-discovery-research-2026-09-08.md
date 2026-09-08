# Cricket and Rugby discovery source verification — 8 September 2026

## Outcome and limits

Two practical broad sources were verified by real, read-only HTTP requests: **World Rugby's own match API** covers men's and women's international and domestic Rugby Union; **ESPN's Cricket daily scoreboard header** discovers international, domestic and franchise fixtures, including women's matches and the previously missing 6–7 September history. Both are public website backing APIs, not documented contractual feeds or coverage guarantees. Keep governing-source corrections and existing cards; an omitted or failed page must never delete a fixture.

This research changes no application code, provider data, database, refresh state or deployment. It follows the existing `source-coverage` parsers and `live-source-adapters` architecture. Representative exact response excerpts are available during this run in `/tmp/ns-discovery-research/espn-samples.json` and `/tmp/ns-discovery-research/world-rugby-samples.json`; these are research examples, not user fixture state.

## 1. World Rugby: recommended primary Rugby source

The public [World Rugby fixtures page](https://www.world.rugby/tournaments/fixtures-results) declares its production API host. Its [own calendar JavaScript](https://www.world.rugby/resources/tournaments/prod/tour_v0.10.2/scripts/bundle.min.js) constructs `/rugby/v3/match`, date filters, `states=U,UP,L,CC,C`, ascending sort and sport identifiers `mru`, `wru`, `mrs`, `wrs` (men/women XV/sevens respectively). No authentication or copied token is required for these requests.

Verified request:

```text
https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-09-01&endDate=2026-12-07&sport=mru&states=U,UP,L,CC,C&pageSize=100&sort=asc&page=0
```

Response is `{pageInfo:{page,numPages,pageSize,numEntries},content:[...]}`. Pagination is **zero-based**: all five men's pages were traversed, giving **464 records and 464 unique match IDs**. The same `sport=wru` query gave **99 records and 99 unique IDs** on one page. `pageSize=1000` is rejected with HTTP 400, so retain 100 and follow `numPages`; never silently treat the first page as the whole source. Sources: [men's first page](https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-09-01&endDate=2026-12-07&sport=mru&states=U,UP,L,CC,C&pageSize=100&sort=asc&page=0), [men's second page](https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-09-01&endDate=2026-12-07&sport=mru&states=U,UP,L,CC,C&pageSize=100&sort=asc&page=1), [women's page](https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-09-01&endDate=2026-12-07&sport=wru&states=U,UP,L,CC,C&pageSize=100&sort=asc).

Observed competition inventory in that date window (not a promise of all published world fixtures):

| Men's competition | Records | Women's competition | Records |
| --- | ---: | --- | ---: |
| Bunnings Warehouse NPC | 42 | Farah Palmer Cup | 24 |
| Pro D2 | 96 | WXV | 39 |
| Heartland Championship | 30 | Premiership Women's Rugby Cup | 20 |
| Top 14 | 78 | Premiership Women's Rugby | 12 |
| English Championship | 70 | Women's Internationals | 3 |
| URC | 48 | Women's Rugby's Greatest Rivalry | 1 |
| English Premiership | 30 | | |
| Premiership Rugby Cup | 8 | | |
| Nations Championship | 24 | | |
| World Rugby Nations Cup | 18 | | |
| Men's Internationals | 5 | | |
| Pacific Nations Cup | 4 | | |
| Americas Championship South America | 4 | | |
| Currie Cup | 3 | | |
| Rugby's Greatest Rivalry | 2 | | |
| Bledisloe Cup | 2 | | |

Each fixture has stable `matchId`/`matchAltId`, `events[].id` and `events[].label`, `competition`, `sport`, `time:{millis,gmtOffset,label}`, `teams[]`, `scores[]`, `status`, `venue` and optional `description`/`eventPhase`. **`time.millis` is already UTC epoch milliseconds**; do not apply `gmtOffset` to it again. For example Argentina–Australia `e019e2f7-b1ce-403e-82eb-70a02990dbb5` is `2026-09-05T21:00:00Z`, i.e. **07:00 Sydney on 6 September**, and is completed 28–28. `teams[].countryCode` is often null, including Australia: derive canonical national identity from verified team mappings, not venue country or missing-code guesses. Sport `WRU` disambiguates women's national sides whose names simply say “Japan” or “Fiji”. [Exact official Mendoza record/summary](https://api.wr-rims-prod.pulselive.com/rugby/v3/match/e019e2f7-b1ce-403e-82eb-70a02990dbb5/summary).

Treat time/date uncertainty conservatively: a timestamp alone does not prove the provider has confirmed the actual kick-off, particularly midnight placeholders; retain provenance and estimated/date-only precision where appropriate. Do not infer senior status for “XV”, A, youth or development teams merely because the competition is international. Completed `C` and upcoming `U` were observed; preserve unrecognised status values instead of discarding their fixtures.

### Sevens

Both match and event API queries with `sport=mrs` / `wrs` returned valid empty lists for 1 September–7 December. This is **not proof that no sevens events exist**. The official [SVNS fixture index](https://www.svns.com/en/fixtures-and-results/svns) already lists **Dubai 28–29 November 2026** and **Cape Town 5–6 December 2026**, but the inspected API had no individual published draws for them. Add/source event-level date-only cards when appropriate and keep match discovery active; do not fabricate opponents or kick-offs. The index is an additional discoverable coverage surface, not a replacement for the match API.

### Rugby athlete entry support

The verified [Mendoza `/summary`](https://api.wr-rims-prod.pulselive.com/rugby/v3/match/e019e2f7-b1ce-403e-82eb-70a02990dbb5/summary) returns `match`, `teams`, `officials`, `motm`, `mascots`. `teams[].teamList.list[]` contains `player.id`, `player.altId`, `player.name.display`, number and position. It can confirm a roster announcement/selection across XV and sevens once a published list exists; membership does not by itself prove minutes played. Use stable provider ID mappings, with separate cross-provider identity evidence; do not join athletes by surname alone. Poll only relevant near-term matches to bound requests.

## 2. ESPN Cricket: broad reputable backup and discovery

Verified daily discovery endpoint:

```text
https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20260906&limit=1000
```

Response is `sports[].leagues[].events[]`. Each league has ID/name and each event has ID, `date`, `endDate`, `timeValid`, `name`, `description`, `competitors[]`, `status`, `fullStatus`, `class`, source links and format. It is a real ESPN-produced public feed, not a governing body feed: label provenance accordingly. [6 September discovery](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20260906&limit=1000), [7 September discovery](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20260907&limit=1000).

Verified examples include:

- England Women–Ireland Women, ID `1496554`, **6 September 09:30Z**, women's ODI, completed; source class `internationalClassId=9`.
- Bangladesh Women–Sri Lanka Women, ID `1548900`, **6 September 14:30Z**, Women's Asia Cup, women's T20I class `internationalClassId=10`.
- East Zone–South Zone, ID `1546441`, **6 September 04:00Z**, Duleep Trophy final, multi-day first-class match continuing on 8 September.
- Cricket on 6 September also includes ECB Women's One-Day Cup, Women's CPL, men's CPL, European T20, Serbian/Czech women's internationals and associate men's fixtures. The 7 September response had seven events including Asia Cup, Sri Lankan domestic limited-over and continuing first-class matches.

Critical parser boundaries:

- `isNational=false` appears even for England Women, Ireland Women and women's associate national teams. Use `class.internationalClassId`, competition context and canonical country/team mappings; otherwise the Australians/international filters will incorrectly exclude women.
- Daily results include **ongoing multi-day matches whose start is earlier**. Deduplicate by event ID while preserving actual original start; do not create a duplicate fixture for each day's scan.
- `endDate` can be a coarse envelope, even two days beyond a single T20. Do not present it as an exact finish or keep a completed match falsely live. Retain format-specific duration estimates.
- Scores are strings such as `202/5 (65 ov)` or declarations. Preserve them as strings and use `fullStatus.summary`/`longSummary` as appropriate; avoid numeric coercion.
- Header `dates` accepts **one `YYYYMMDD`**, not a range: `20260905-20261207` returned 404. A month form produced an error. No pagination contract was exposed. Treat valid empty days differently from transport/schema failures.

Fourteen spaced daily probes, from 8 September through **7 December (+90 days)**, all returned HTTP 200 and 2–24 events. Future published data included Australia–South Africa, India–New Zealand, Sri Lanka–Pakistan, Bangladesh–South Africa, WBBL, Sheffield Shield, Plunket Shield, Ranji Trophy, Syed Mushtaq Ali Trophy, Australian domestic one-day and South African T20 competitions. These samples prove useful future population, not that a weekly-only scan is complete. [12 October](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20261012&limit=1000), [16 November](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20261116&limit=1000), [7 December](https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=20261207&limit=1000).

### Efficient series refresh after discovery

Per-series scoreboards work with **`dates=2026`**, not a range:

```text
https://site.api.espn.com/apis/site/v2/sports/cricket/21284/scoreboard?dates=2026&limit=1000
```

Verified: [WBBL `21284`](https://site.api.espn.com/apis/site/v2/sports/cricket/21284/scoreboard?dates=2026&limit=1000) returned **43 fixtures** through 5 December; [India–NZ `24469`](https://site.api.espn.com/apis/site/v2/sports/cricket/24469/scoreboard?dates=2026&limit=1000) returned **12**; [Duleep `8630`](https://site.api.espn.com/apis/site/v2/sports/cricket/8630/scoreboard?dates=2026&limit=1000) returned **5**; [Serbia women's `24741`](https://site.api.espn.com/apis/site/v2/sports/cricket/24741/scoreboard?dates=2026&limit=1000) returned **6**. Shape is the separate Site API `leagues[]`, `events[]`, `events[].competitions[]`, with class on each competition and `leagues[].calendar` published days. Normalize both formats explicitly.

The `/cricket/all/scoreboard` endpoint returned 404 for year, month and date-range forms. Core `/sports/cricket/leagues` returned an empty directory; guessed `icc`/`8` leagues returned 400. Header league `smartdates` is a small neighbouring-day list, **not** a complete series calendar. A complete rolling initial discovery still requires daily scans; then cache discovered series and refresh those efficiently. Re-scan future days regularly to discover new series and dates, not just known IDs.

### Cricket athlete entry support

Verified [England–Ireland match summary](https://site.web.api.espn.com/apis/site/v2/sports/cricket/23803/summary?contentorigin=espn&event=1496554) returned HTTP 200, with `rosters[].team`, `rosters[].roster[].athlete`, `starter`, captain and related article/news fields. Athlete IDs can support real match membership. Store starter/selected status separately from confirmed participation; keep personal identity, team ownership and generic series interest distinct. Do not treat editorial mention as a playing XI announcement without evidence.

## 3. ESPN Rugby backup

[All-Rugby scoreboard](https://site.api.espn.com/apis/site/v2/sports/rugby/all/scoreboard?dates=20260905-20261207&limit=1000) returned HTTP 200 with **280 fixtures** across nine competition IDs in the checked date window: European Champions/Challenge Cups, Premiership, Top 14, URC, URBA, Nations Championship, NPC and internationals. It includes standard `events[].competitions[].competitors[]`, team IDs/names/logos, status and scores. Results were grouped by competition, **not chronological**; explicitly sort UTC. A single-day query can include the next UTC date because of provider day boundaries.

The [core Rugby league directory](https://sports.core.api.espn.com/v2/sports/rugby/leagues?limit=1000) returned 25 links with standard page metadata. Dereference their exact URLs: the URL slug and returned canonical `id` differ (e.g. directory slug `17567` returns Nations Championship ID `24400`). It includes old/retired competitions; a listed league does not imply current coverage. The checked all-Rugby range did not supply the broad women's inventory found in World Rugby. Keep it a backup/coverage comparator, with explicit cross-provider aliasing and priority so a weaker timestamp cannot overwrite a known official correction.

## Implementation recommendations

1. Register all refresh work beneath `scripts/update-cards.js`; no alternative ladder/card maintenance path. Reuse pure adapters in live mode.
2. Use World Rugby men's and women's paginated sources plus ESPN Cricket daily discovery; retain existing CA and RA authority and fixture IDs via aliases. Separate source success, empty data and incomplete pagination.
3. A rolling Cricket discovery window of **−7 through +90 inclusive is 98 daily requests**. Initial canonical fetch can use concurrency two. Live requests should refresh the near window frequently while stable weekly future partitions are rotated on a slower schedule; bound each invocation and report remaining partitions. Do not fetch all 98 days each minute.
4. Track health per source/partition, fetched date range, expected/completed pages and last success. Any transport, parse, pagination or individual-record failure must retain the last good data; partial source coverage must remain visibly partial in diagnostics.
5. Verify the full pipeline: source event → canonical identity → Follow directory → team/athlete/Australian eligibility → card. Add women’s national identities and allow followed teams in non-marquee club/franchise matches; do not use national-team flags as nationality evidence for individual club players.
6. Keep duplicate detection gender/discipline aware. Exact provider IDs first; then independently verified aliases. Cross-provider semantic matching should require canonical opponents and a tight sensible time window, not competition title alone.
7. **Comprehensive means all successfully traversed configured coverage surfaces, not every match on earth.** Future schedules may be unpublished. Sevens draws, smaller domestic leagues and newly announced events need continuing source-inventory checks and date-only event fallbacks, not invented fixtures or suppressed cards.

## Follow-up audit: exact Rugby statuses, midnight timing and SVNS IDs

World Rugby's [public `pulse-lib.js`](https://www.world.rugby/resources/prod/v9.19.3/js/pulse-lib.js) explicitly defines `PULSE.CLIENT.RUGBY.MATCH_STATUS` as **upcoming `U`, postponed `UP`, live `L`, completed `C`, cancelled `CC`**. Its status renderer independently maps `UP` to the postponed translation and `CC` to cancelled. Do not interpret `UP` as an unconfirmed kick-off. Detailed live states include `L1`, `LHT`, `L2`, `LFT`, `L3`, `LB`, `L4`, `LXD`, `LK`, `LS`, `LD`, `LSD`, `L5`, `L6`; retain their original source value as well as the normalised status. The separate `event.eventStatus` can remain “Scheduled” even when its matches are completed, so it must not override match status.

No explicit kick-off-confirmed or time-TBC boolean was found in the inspected match payloads, calendar bundle or public Rugby match library. `time.label` is a date-only string for both ordinary confirmed-looking times and apparent placeholders. The verified women's feed contains these scheduled midnight examples:

- Australia–Scotland, `ebf5fd19-085a-4ea6-8495-50bfd6bb4005`, `time={millis:1791590400000,gmtOffset:0,label:"2026-10-10"}`.
- PWR Cup semi-finals, `5e33bff7-dfa6-400d-86d4-e4499d38bab0` and `54c14d7f-6da1-4838-903a-93ab2683c739`, midnight UTC on 31 October, with “Winner Pool A/B” and “Runner-up Pool A/B” participants.
- PWR Cup final, `7f476eef-2603-45eb-8790-3ff7ae310180`, midnight UTC on 7 November, “SF1” versus “SF2”.

These support conservative date-only treatment where a **midnight UTC + zero offset + missing/placeholder match details** pattern occurs. They do **not** prove every midnight is a placeholder: a real evening match in another time zone can begin at 00:00Z. Preserve the raw provider timestamp and source date; do not shift a confirmed non-zero-offset local-time match by a blanket midnight rule. A separate published kick-off source can upgrade precision. If the source gives no distinguishing evidence, label timing approximate rather than claim exactness or hide the card. [Source women's feed](https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=2026-09-01&endDate=2026-12-07&sport=wru&states=U,UP,L,CC,C&pageSize=100&sort=asc).

### SVNS event extraction: future headings, historical draw IDs

The [official SVNS series index](https://www.svns.com/en/fixtures-and-results/svns) has repeated `<section class="page-title ...">` records with `h1.page-title__heading`, `h2.page-title__subtitle` and its city-specific match link. These are straightforward machine-readable HTML records: Dubai has `28–29 NOVEMBER 2026`; Cape Town has `5–6 DECEMBER 2026`. There is no embedded future event JSON, explicit ISO date attribute or official tournament ID on that index. A guarded parser can extract city, date range and source URL without executing scripts. Use the heading's year, not a copyright year or the button text.

The buttons explicitly say “2025/26 Series Results”, and the linked draw pages still contain **historical** `data-tournament-ids`:

| Linked page | Men's ID | Women's ID | Dates proven by official schedule API |
| --- | --- | --- | --- |
| [Dubai matches](https://www.svns.com/en/fixtures-and-results/dubai/matches) | `11cc06dc-3ea9-4d90-b0ae-a399af78e4eb` | `acf5df55-1883-433c-b015-ebb2abf22606` | 29–30 November **2025** |
| [Cape Town matches](https://www.svns.com/en/fixtures-and-results/cape-town/matches) | `9e2d4625-9e44-470b-8b7a-232b800ae969` | `97aba84c-bb17-44f1-ac0f-085225f13d46` | 6–7 December **2025** |

All four `/rugby/v3/event/{id}/schedule` requests returned HTTP 200 with `{event,matches}`; the event labels call those tournaments “HSBC SVNS 2026” because of the **season**, while their `start.label`/`end.label` are calendar year 2025. [Dubai men's schedule](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/11cc06dc-3ea9-4d90-b0ae-a399af78e4eb/schedule), [Dubai women's](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/acf5df55-1883-433c-b015-ebb2abf22606/schedule), [Cape Town men's](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/9e2d4625-9e44-470b-8b7a-232b800ae969/schedule), [Cape Town women's](https://api.wr-rims-prod.pulselive.com/rugby/v3/event/97aba84c-bb17-44f1-ac0f-085225f13d46/schedule).

**Do not attach these historical official IDs or historical participants to the upcoming 2026 date-only cards.** Use an application-owned source/slug/calendar-date identity for a future meeting (and an explicit gender discriminator if separate men's/women's cards are introduced), with `timePrecision=date`, no fabricated individual opponents and no exact start. Prefer a combined meeting card if the future source does not separately publish gendered tournament records. Store the index URL/date excerpt as provenance. Once a real future official event appears, verify its actual dates and gender before aliasing it to the placeholder. An old linked results page cannot invalidate the newer dated meeting heading or repopulate this year's card with last year's draw.

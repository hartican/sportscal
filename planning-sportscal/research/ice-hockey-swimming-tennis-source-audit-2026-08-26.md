# Ice Hockey, Swimming and Tennis source audit

Date checked: 26 August 2026 (Australia/Sydney)
Scope: official/first-party sources only. This is an implementation audit, not a claim that every unpublished 2026–27 dataset or Australian right is already available.

## Decisions that should govern implementation

- Discover season and competition entity IDs from the official page/configuration on every canonical refresh. Persist the resolved IDs and source timestamps, but do not treat the opaque CHL entity IDs below as permanent constants.
- Preserve the last complete official snapshot when a feed is missing or malformed. Expose its `fetchedAt`, source and stale/unavailable state; do not fill gaps with historical athletes, previous-season rosters or inferred broadcasters.
- Scope viewing rights by `territory + competition + season`. The URL order is exact verified fixture permalink, then verified provider event/tournament page, then verified provider sport hub. If coverage itself is not verified, render **Viewing TBC** and link to the official competition match/event information.
- Use official source IDs as canonical IDs. Keep presentation identities, ranks and event results as independently refreshable records.

## Pre-implementation repository delta (resolved by this pass)

This was the baseline found before implementation: the Australian rights audit already established fixture-specific before competition-level resolution and honest `Viewing TBC`, but the viewing-rights JSON did not yet carry `linkScope`, `sourceUrl`, `verifiedAt` or `permalinkVerifiedAt`; US Open data still used generic sessions; and Swimming contained six Commonwealth-oriented athletes with null ranks. The implementation pass replaces those baselines while retaining this section as the audit trail.

## NHL, 2026–27

### Official catalogue and schedule evidence

The [official NHL teams directory](https://www.nhl.com/info/teams) is the catalogue authority. The NHL's [2026–27 schedule announcement](https://www.nhl.com/news/nhl-announces-2026-27-regular-season-schedule) states that all 32 clubs play 84 regular-season games, 42 home and 42 away, for 1,344 league games from 29 September 2026 to 10 April 2027.

| Purpose | Official endpoint | Important response fields and use |
|---|---|---|
| Team schedule | `GET https://api-web.nhle.com/v1/club-schedule-season/{TRI}/20262027` | `clubTimezone`, `clubUTCOffset`, `games[]`; each game has official `id`, `season`, `gameType`, `gameDate`, `startTimeUTC`, venue, state, `tvBroadcasts`, home/away IDs, abbreviations, names, `logo`, `darkLogo`, and `gameCenterLink`. |
| Available roster seasons | `GET https://api-web.nhle.com/v1/roster-season/{TRI}` | Resolve the newest season actually published for each club. |
| Season roster | `GET https://api-web.nhle.com/v1/roster/{TRI}/{seasonId}` | `forwards[]`, `defensemen[]`, `goalies[]`; player `id`, names, headshot, sweater number, position, shoots/catches, height/weight and birth country/date/place. |
| Dated standings | `GET https://api-web.nhle.com/v1/standings/{YYYY-MM-DD}` | `standingsDateTimeUtc`, `wildCardIndicator`, `standings[]`; `seasonId`, team IDs/names/abbreviations/logos, conference/division, games played, wins/losses/OT losses, points and goal totals. |
| Fixture information | `https://www.nhl.com{gameCenterLink}` | Official information fallback and stable deep link for the API game ID. |

A checked Boston schedule response contained 88 games: four preseason plus 84 regular-season games. The 84-game validator must therefore count only `gameType === 2`, not the raw array length. Validate the union of official team IDs/abbreviations is exactly 32, every regular-season game ID is unique, and each team has 84 regular-season appearances. Use the supplied official light/dark marks; a club must never fall back to a national flag.

As checked on 26 August, `roster-season/BOS` exposed seasons only through `20252026`; `roster/BOS/20262027` was not published. The loader must label the latest official roster by its real season and show 2026–27 roster data as unavailable until the season appears. It must not relabel 2025–26 players as a current 2026–27 roster. Similarly, a checked standings response for 16 April 2026 was a 32-team `20252026` table. Before a `seasonId: 20262027` table exists, the new season's standings state is `not_started`, not the previous table.

### Australian viewing

- The NHL's [Nine partnership announcement](https://www.nhl.com/news/nine-and-nhl-announce-partnership-to-televise-games-in-australia) verifies 21 Saturday-morning regular-season games on 9GO!/9Now for **2025–26 only**. It is not evidence for 2026–27.
- The NHL's [DAZN announcement](https://www.nhl.com/news/nhl-announces-streaming-deal-with-dazn) is global in tone, but the authoritative [DAZN NHL.TV availability page](https://www.dazn.com/en-GB/help/articles/29693674363549-nhltv-on-dazn) explicitly excludes Australia. Do not offer NHL.TV on DAZN in Australia.
- Foxtel's official [NHL/ESPN page](https://www.foxtel.com.au/watch/nhl.html) describes Australian NHL coverage, but its visible season material does not verify the 2026–27 package. It is insufficient for a season-current fixture mapping.

Therefore the initial 2026–27 Australian option is **Viewing TBC**, linked to that fixture's official NHL Gamecentre page. Promote a Nine, Foxtel/ESPN or other provider only after a current official provider/league schedule proves the specific season, and set an exact fixture URL only after that permalink has been opened successfully and verified.

## Champions Hockey League, 2026–27

### Season discovery, teams and format

The current [official CHL teams page](https://www.chl.hockey/en/teams) identifies the 2026/27 season. Its page configuration resolved sport entity `21ec9dad81abe2e0240460d0` and season entity `fc954f6d33272fdf4a8b95bb` when checked. Discover these from official page metadata on refresh because they are opaque publication IDs.

The official [CHL format](https://www.chl.hockey/en/about-us/chl-format) confirms 24 teams, six regular-season opponents per team, one overall 1–24 table, the top 16 advancing, two-game aggregate knockout ties through the semi-finals, and a one-game Final.

The checked official teams feed returned these 24 clubs: Adler Mannheim, Bordeaux Boxers, Bílí Tygři Liberec, Dynamo Pardubice, Eisbären Berlin, Fribourg-Gottéron, Frölunda Gothenburg, GKS Tychy, Genève-Servette, Graz99ers, HC Davos, HC Pilsen, HK Nitra, Herning Blue Fox, KAC Klagenfurt, KooKoo Kouvola, Kölner Haie, Red Bull Salzburg, Rögle Ängelholm, SaiPa Lappeenranta, Skellefteå AIK, Storhamar Hamar, Tappara Tampere and Växjö Lakers. The application must nevertheless load the feed rather than hard-code this count or list.

| Purpose | Official endpoint shape | Important response fields and use |
|---|---|---|
| Teams | `GET https://www.chl.hockey/api/s3?q=teams-{sportEntity}-{seasonEntity}.json` | `data[]`; stable `_entityId`, `externalId`, name/short name, `country`, and official team `link.url`. |
| Schedule/Gamecentre | `GET https://www.chl.hockey/api/s3?q=schedule-{sportEntity}-{seasonEntity}.json` | `data[]`; match `_entityId`, `externalId`, UTC `startDate`, `startDateNotConfirmed`, `status`, venue, stage/group/round, home/away entity IDs/names, results and official `link.url`. |
| Overall standings | `GET https://www.chl.hockey/api/s3/live?q=standings-groups-{sportEntity}-{seasonEntity}.json` | Stage/group plus `teams[]`; place, points, matches won/lost, goals and live fields. Preseason zero rows are valid `not-started` data. |
| Knockout structure | `GET https://www.chl.hockey/api/s3?q=standings-playoffs-{sportEntity}-{seasonEntity}.json` | Official bracket/series data when published. An empty preseason `data` array means not yet published, not an ingest failure. |
| Live overlay | `GET https://www.chl.hockey/api/s3/live?q=live-events.json` | Apply only as a keyed overlay to matching official match IDs. |
| Match information | `https://www.chl.hockey{match.link.url}` | Official Gamecentre fallback for viewing and unavailable player details. |

The checked schedule feed contained 84 published records at that instant; do not use 84 as a fixed season assertion because the official feed can include staged or placeholder knockout records as publication progresses. Validate the regular-season graph from the official format: 24 teams, six distinct opponents and six regular-season matches per club (72 unique fixtures league-wide), then validate later knockout records by official stage/round and match IDs.

One upstream quirk requires a defensive normaliser: checked future records could carry a `state.name` resembling full time and zero-valued result fields while their canonical `status` was not started. Status and time must come from `status`, `startDate` and `startDateNotConfirmed`; results are accepted only for an official completed status.

No stable season-roster feed was independently verified in this pass. The canonical loader should discover roster/player feed URLs from each official team page/Gamecentre configuration, record the team and season entity used, and expose `unavailable` when an official roster is absent. It must not scrape names from editorial copy or import an unverified third-party roster. This remains a release blocker for claiming complete CHL rosters.

### Australian viewing

The official [CHL where-to-watch table](https://www.chl.hockey/en/fans/where-to-watch) for 2026/27 maps “all other markets” to [IIHF.TV](https://iihf.tv/) for all CHL games. Australia is not separately listed and therefore currently falls into that official catch-all. The page warns that changes may occur, so reverify it during each canonical season refresh.

Use a verified IIHF.TV game permalink when one is exposed and opens for Australia; otherwise use a corresponding IIHF.TV competition/event page, then the IIHF.TV hub. If the stream is unavailable or geoblocked, switch to **Viewing TBC** and link the official CHL match page. The catch-all rights table alone does not prove that a guessed IIHF.TV path is a working fixture permalink.

## World Aquatics Swimming: exactly 60 current athletes

The official [World Aquatics swimming rankings](https://www.worldaquatics.com/swimming/rankings) supports gender, distance, stroke, pool length, time mode, country/continent and CSV/XLSX/PDF downloads. World Aquatics' [AQUA Points explanation](https://www.worldaquatics.com/swimming/points) defines the comparable performance points formula `P = 1000 × (B / T)^3`, separated by men/women and LCM/SCM and refreshed yearly. World Aquatics publishes event rankings, not a universal athlete leaderboard; the application must not display the derived directory order as an official overall world rank.

### Official API and export

JSON query shape:

```text
GET https://api.worldaquatics.com/fina/rankings/swimming
  ?countryId=
  &distance=50
  &endDate=
  &gender=M
  &pageSize=200
  &poolConfiguration=LCM
  &regionId=
  &startDate=
  &stroke=FREESTYLE
  &timesMode=BEST_TIMES
  &year=2026
```

The response includes `generatedOn`, `serialNumber`, `totalRowCount` and `swimmingWorldRankings[]`. Each row includes official `personId`, `disciplineId`, `disciplineGroupId`, `eventId`, event `rank`, `finaPoints`, time, result/meet IDs and dates, names, date/year of birth, participant country code/name/flag ID and meet metadata. A checked response echoed `query.gender` as null even though the requested discipline was men's 50m freestyle, so validate gender through the selected discipline and row data, not the echoed query alone.

The official audit export is the same query under:

```text
GET https://api.worldaquatics.com/fina/rankings/swimming/report/csv?...same filters...
```

PDF is available at `/report/pdf`. The CSV has rank, AQUA points, athlete, gender, birth date, event, team/country and meet fields, but not `personId`; therefore JSON is canonical for identity and deduplication, while the official export is an audit/recovery aid.

### Deterministic 30 women / 30 men selection

For each gender query 2026 LCM `BEST_TIMES` for the 14 Olympic individual pool events: freestyle 50/100/200/400/800/1500; backstroke 100/200; breaststroke 100/200; butterfly 100/200; individual medley 200/400. Exclude relays and non-Olympic stroke distances.

1. Fetch enough rows per event (200 is the initial ceiling; paginate if `totalRowCount` exceeds it).
2. Store every row as an event-rank record keyed by `personId + disciplineId`, preserving official rank, AQUA points, time, result/meet IDs and source timestamp.
3. Deduplicate athletes by official `personId`.
4. Within each gender order athletes by best AQUA points descending, then best official event rank ascending, then next-best AQUA points descending, then stable `personId`. Name the first value `bestAquaPoints` or `selectionScore`, never `worldRank`.
5. Select exactly the first 30 women and first 30 men. Keep their complete `eventRanks[]` separately so cards can state the genuine event-specific ranks.

Validation requires 60 unique official person IDs, exactly 30/30, at least one current event-rank row per athlete, no relay events, valid source year/pool/mode, and null rankings sorted last. If an official gender pool cannot produce 30 current athletes, publish an honest unavailable/stale state rather than filling it with historical names. Preserve the last-good 60-person snapshot with `generatedOn`, fetch time and query matrix.

## US Open 2026: official order of play, players and results

### Discoverable official feeds

The [official US Open schedule](https://www.usopen.org/en_US/scores/schedule/index.html) declares its REST base and loads `/en_US/json/gen/config_web.json`. The checked 2026 configuration provides these official templates:

| Purpose | Official path |
|---|---|
| Available schedule days | `/en_US/scores/feeds/2026/schedule/scheduleDays.json` |
| Day order of play | `/en_US/scores/feeds/2026/schedule/schedule<day>.json` |
| Official OOP PDF | `/en_US/scores/2026/schedule/pdf/schedulePDF<day>.pdf` |
| Completed-match days | `/en_US/scores/feeds/2026/completed_matches/eventDays.json` |
| Completed matches for day | `/en_US/scores/feeds/2026/completed_matches/days/day_<day>.json` |
| One completed match | `/en_US/scores/feeds/2026/completed_matches/matches/<matchId>.json` |
| Player directory | `/en_US/scores/feeds/2026/players/players.json` |
| Player detail | `/en_US/scores/feeds/2026/players/details/<id>.json` |
| Draw catalogue/detail | `/en_US/scores/feeds/2026/draws/draws.json`, then `/en_US/scores/feeds/2026/draws/<eventId>.json` |
| Match API | `https://www.usopen.org/api/tennis/matches/match/<matchId>` |
| Official US TV schedule | `/en_US/json/man/us_tv_schedule.json` |

`scheduleDays.json` supplies `lastUpdated` and day records with `tournDay`, epoch, `released`, `currentDay`, match/winner counts and `feedUrl`. Ingest only days with `released === true`; later days being null/unreleased is expected. Refresh frequently after official OOP release and key changes to official match IDs.

A day schedule supplies display date/release time and `courts[]`. Each court has ID/name, session, time, `startEpoch`, and `matches[]`. A match has official `match_id`, order, event name/code, court, round code/name, status/code, `notBefore`, comments, `team1[]`, `team2[]` and scores. Each side's record carries member A and optional member B: official player IDs, display/first/last names, nations, seed and winner flag. This directly supports singles and properly grouped doubles sides.

Completed-day records use the same official match ID but express `team1` and `team2` as objects rather than arrays, with A/B members, entry status, set totals, winner and scores. Normalise both shapes into:

```json
{
  "id": "fixture:tennis:us-open:2026:<eventCode>:<match_id>",
  "sourceMatchId": "<match_id>",
  "cardKind": "fixture",
  "court": "<courtName>",
  "round": { "code": "<roundCode>", "name": "<roundName>" },
  "sides": [
    { "players": [{ "id": "<official player id>", "name": "...", "seed": null, "rank": null, "nationality": "..." }] },
    { "players": [{ "id": "<official player id>", "name": "...", "seed": null, "rank": null, "nationality": "..." }] }
  ]
}
```

Enrich members from the official player feed, which supplies ID, names, country, gender, seed, image, birth date, singles/doubles ranks and entered events. If a schedule nation is null, use that official player row; if still absent, display an honest identity/player-details TBC state. Do not infer nationality. Use the official `match_id` for stable identity rather than participant names.

Use court/session `startEpoch` for the first scheduled match and an explicit `notBefore` value where supplied. A “followed by” order is not an exact start time and must not be presented as one. Accept scores/results only from a completed official status/feed. Refresh sparse legacy pins by the stable fixture ID; if the source match is no longer available, preserve the pin shell with player-details TBC rather than constructing malformed sides.

### Verified 2026 exhibition examples

The official schedule feed for 25 August included:

- exhibition singles match `53101`: Roger Federer (`atpf324`) v Andy Roddick (`atpr485`);
- exhibition doubles match `54101`: Federer and John McEnroe (`atpm047`) v Andre Agassi (`atpa092`) and Roddick;
- mixed doubles match `5104`: Serena Williams (`wta230234`) and Carlos Alcaraz (`atpa0e2`) defeated Erin Routliffe and Lloyd Glasspool 5–3, 4–1; their next match `5202` was also present with its completed result.

The official [Federer exhibition page](https://www.usopen.org/en_US/fan-week/roger-federer-an-icon-returns-to-new-york.html) identifies Federer, Roddick, Agassi and McEnroe and the Arthur Ashe programme. The official [Serena/Alcaraz result](https://www.usopen.org/amp/en_US/news/articles/2026-08-25/serena_williams_and_carlos_alcaraz_debut_fresh_looks_during_2026_us_open_mixed_doubles.html) corroborates the first result. Feed time remains canonical when editorial/event copy and broadcast start times differ; retain both sources and their verification times when diagnosing a discrepancy.

The default legends watchlist may make official concrete matches involving Federer, Serena Williams, Venus Williams, Rafael Nadal, Andy Murray, Ash Barty, Lleyton Hewitt, Agassi, Roddick and McEnroe Feed-eligible. It must match official player IDs where available and must not imply that all ten have a published 2026 match. It creates no reminder until the user explicitly taps **Remind me**.

### Australian viewing

The official [Stan Sport tennis page](https://www.stan.com.au/watch/sport/tennis) states that every match of all four Grand Slams, including the US Open, is available live and on demand in Australia. Nine's official [2026 programming announcement](https://www.nineforbrands.com.au/media-release/9network-in-2026/) corroborates the US Open across Nine/9Now/Stan and every Grand Slam match on Stan. It does not prove that every fixture has a free Nine/9Now stream.

For Australian US Open cards use a current verified Stan fixture permalink first; otherwise a Stan US Open/tournament page if exposed; otherwise the verified Stan tennis hub above. Add Nine/9Now only where its official schedule exposes that exact match/session or a verified tournament event page. The US Open's ESPN/Disney information is United States coverage and must not be imported into the Australian map.

## Shared viewing record and URL precedence

Each resolved option should retain enough provenance to be re-audited:

```json
{
  "territory": "AU",
  "competitionId": "...",
  "season": "2026-27",
  "providerId": "...",
  "mode": "live|replay",
  "linkScope": "fixture|event|sport",
  "url": "https://...",
  "sourceUrl": "https://official-rights-or-schedule-source/...",
  "verifiedAt": "2026-08-26T00:00:00Z",
  "permalinkVerifiedAt": null,
  "status": "verified|tbc"
}
```

Resolution order:

1. exact official provider fixture permalink, with non-null `permalinkVerifiedAt`;
2. corresponding verified provider event/tournament page;
3. verified provider sport hub;
4. when the coverage right itself is unverified, **Viewing TBC** linked to the official NHL Gamecentre, CHL match page or US Open match/schedule page.

A generic provider URL does not become `linkScope: fixture`. Native Universal Links/custom schemes may use the selected verified destination; the stored web fallback remains the same provenance-backed external URL.

## Release blockers and refresh checks

- NHL: assert 32 active clubs and 84 `gameType: 2` games per club; 2026–27 roster and standings remain unavailable until the official API publishes that season. Do not claim 2026–27 Australian provider coverage from a 2025–26 announcement.
- CHL: discover current entity IDs, validate the 24-team/six-opponent regular-season graph, and accept the official empty pre-playoff bracket. Complete official roster discovery is still required before a “complete rosters” release claim.
- Swimming: assert exactly 60 unique `personId` values, 30 women and 30 men, and retain official event ranks separately from the derived selection order.
- US Open: ingest released day feeds, preserve doubles as two grouped sides, reconcile completed results by official match ID, and ensure one pinned child yields exactly one normal `cardKind: fixture` snapshot.
- Rights: verify territory, competition and season; test selected URLs; record verification timestamps; revert to official information/TBC on expiry, redirect, geoblock or source disagreement.

All four pipelines should publish `sourceUrl`, source-generated time where available, local `fetchedAt`, loading/retry/unavailable state and a last-good snapshot. HTTP success alone is not completeness: apply the domain validators above before replacing a published snapshot.

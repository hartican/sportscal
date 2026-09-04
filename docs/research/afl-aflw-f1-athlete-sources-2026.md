# Official 2026 athlete, AFLW fixture and profile sources

Research snapshot: **5 September 2026, Australia/Sydney**. This note deliberately uses AFL, AFL club and Formula 1 first-party sources only. The JSON services described below are live first-party services used by the official sites, but they are not documented public developer APIs; treat their schemas and access arrangements as changeable.

## Recommended implementation contract

1. Treat `providerId` values (`CD_I…`, `CD_T…`, `CD_S…`, `CD_M…`) as AFL/AFLW source identities. Central integer IDs and club-site player-reference IDs are not interchangeable and demonstrably differ for some GWS players.
2. Add AFLW as a child code of AFL in the product taxonomy, but give it its own competition ID, season, teams, follows and feed eligibility. Do not merge AFL and AFLW squads or fixtures.
3. Build complete AFL and AFLW directories from the official squad service. Enrich each athlete from StatsPro for current guernsey number, official `photoURL`, bio fields and stats; cache a checked snapshot rather than making browser-time fan-out requests.
4. Use the final 2026 AFL Coaches Association leaderboard for the AFL men's curated top 10. Use AFL.com.au's expert-consensus preseason **The 25** top 10 for AFLW and label its edition. For F1 use the live official championship top 10 and retain `checkedAt`, because positions change after every Grand Prix.
5. Build AFLW Feed fixtures from all rounds returned by the official season object. The currently published regular season is 12 rounds/108 matches; finals have not yet been appended and must be ingested when the AFL publishes them.
6. For GWS AFLW editorial, join fixture data to the newest official match preview/report and current official statistics. Publish only attributable fixture-specific facts; if fewer than two suitable facts are available, fail closed rather than generating generic prose.
7. Remote first-party image availability is not a redistribution licence. Preserve provenance and a fallback avatar, and obtain rights approval before copying AFL Photos/F1 media assets into Sportscal-controlled storage.

## AFL and AFLW first-party data services

### Seasons, fixtures, results and ladders

The repository already uses the same official AFL JSON family for AFL. The 2026 identifiers verified in this research are:

| Code | Competition | Numeric season ID | Provider season ID | Official discovery source |
|---|---:|---:|---|---|
| AFL | 1 | 85 | `CD_S2026014` | [`/competitions/1/compseasons?pageSize=20`](https://aflapi.afl.com.au/afl/v2/competitions/1/compseasons?pageSize=20) |
| AFLW | 3 | 96 | `CD_S2026264` | [`/competitions/3/compseasons?pageSize=20`](https://aflapi.afl.com.au/afl/v2/competitions/3/compseasons?pageSize=20) |

Use discovery on every refresh rather than permanently hard-coding these numeric IDs:

- Season detail and round catalogue: [`/compseasons/96`](https://aflapi.afl.com.au/afl/v2/compseasons/96)
- Matches/results per round: [`/matches?compSeasonId=96&roundNumber=1&pageSize=50`](https://aflapi.afl.com.au/afl/v2/matches?compSeasonId=96&roundNumber=1&pageSize=50), repeated for every returned round
- Current AFLW ladder: [`/compseasons/96/ladders?roundNumber=4`](https://aflapi.afl.com.au/afl/v2/compseasons/96/ladders?roundNumber=4)
- Official fixture announcement and competition context: [Fixture confirmed for 2026 NAB AFLW season](https://www.afl.com.au/aflw/news/1523432/fixture-confirmed-for-2026-nab-aflw-season)

Observed response shapes:

```text
compseasons -> { meta, compSeasons:[{ id, providerId, name, currentRoundNumber, ... }] }
season       -> { id, providerId, name, rounds:[{ id, providerId, name, roundNumber, ... }], ... }
matches      -> { meta:{ pagination }, matches:[{
  id, providerId, compSeason, round,
  home:{ team, score? }, away:{ team, score? },
  venue, utcStartTime, status, metadata
}] }
ladder       -> { compSeason, round, lastUpdated, ladders:[{
  entries:[{ position, team, played, pointsFor, pointsAgainst,
             thisSeasonRecord, form, ... }], finalsCutOff
}] }
```

At the snapshot time season 96 exposed rounds 1–12 and 108 home-and-away matches. The ladder endpoint was requested with round 4 while round 4 was underway, but `lastUpdated` still reflected the latest completed ladder calculation. The UI should display an explicit “through completed games”/source timestamp derived from `lastUpdated`; it should not claim a ladder is final merely because `currentRoundNumber` has advanced.

### The 18 AFLW squads

The exact women's team IDs present in 2026 round-one match data are below. Indigenous Round display names are source-owned seasonal names, so identity must be keyed by team ID/provider ID rather than current display text.

| Team ID | Provider ID | 2026 source name |
|---:|---|---|
| 21 | `CD_T7887` | Brisbane Lions |
| 22 | `CD_T8096` | Carlton |
| 24 | `CD_T8097` | Collingwood |
| 118 | `CD_T9406` | Essendon |
| 36 | `CD_T8796` | Euro-Yroke (St Kilda) |
| 28 | `CD_T7889` | GWS GIANTS |
| 26 | `CD_T8467` | Geelong Cats |
| 33 | `CD_T8786` | Gold Coast SUNS |
| 119 | `CD_T9407` | Hawthorn |
| 19 | `CD_T8098` | Kuwarna (Adelaide) |
| 29 | `CD_T7386` | Narrm (Melbourne) |
| 30 | `CD_T8466` | North Melbourne |
| 34 | `CD_T8788` | Richmond |
| 121 | `CD_T9408` | Sydney Swans |
| 35 | `CD_T8787` | Waalitj Marawar (West Coast) |
| 25 | `CD_T7886` | Walyalup (Fremantle) |
| 32 | `CD_T7387` | Western Bulldogs |
| 120 | `CD_T9409` | Yartapuulti (Port Adelaide) |

For each ID, request the official squad endpoint, for example [GWS's 2026 AFLW squad](https://aflapi.afl.com.au/afl/v2/squads?teamId=28&compSeasonId=96&pageSize=1000):

```text
GET /afl/v2/squads?teamId={teamId}&compSeasonId=96&pageSize=1000
-> { squad:{ compSeason, team, players:[{
     player:{ id, providerId, firstName, surname, dateOfBirth,
              heightInCm, recruitedFrom, debutYear, ... },
     jumperNumber, position
   }] } }
```

This gives complete list membership and numbers, but the GWS case proves the squad feed can lag retirements. Reconcile the feed against official club list-change/retirement announcements and mark unresolved records for review; never render `jumperNumber: 0` as a real guernsey number.

### Official player portraits and statistics

The official AFL/AFLW player pages use `https://api.afl.com.au/statspro`. They first mint a short-lived anonymous media token:

```text
POST https://api.afl.com.au/cfs/afl/WMCTok
Content-Type: application/json
Origin/Referer: an official AFL page
body: {}
-> { disclaimer, token }
```

Pass that token as `x-media-mis-token`; do not commit, log or persist it. In testing, GET returned 405 and a bodyless POST returned 400. The response disclaimer expressly says the material is copyright-protected and prohibits unauthorised reproduction/distribution/use.

Verified StatsPro routes:

| Purpose | Official route | Useful response fields |
|---|---|---|
| Current profile, headshot, number and summary statistics | `/statspro/playerProfile/{playerProviderId}?competitionCode=CD_C264` for AFLW; `competitionCode=CD_C014` for AFL | `{ playerId, seasonId, playerDetails, seasonAverages, seasonTotals, careerAverages, careerTotals, team }`; `playerDetails` includes name, DOB/age, height, weight, `jumperNumber`, state, debut year, recruited from, position, `bio`, `photoURL` |
| Career by season | `/statspro/playerCareerSeasonStats/{playerProviderId}?competitionType=AFLW` or `AFL` | `{ playerId, careerTotals, yearlySeasonStats:[{ seasonId, year, seasonStats }] }` |
| Recent match form | `/statspro/playerSeasonRoundStats/{playerProviderId}?seasonId=CD_S2026264` | `{ playerId, seasonId, roundStats:[{ roundId, matchId, roundName, roundNumber, result, opponent, stats }] }` |
| Bulk season statistics | `/statspro/playersStats/seasons/{seasonProviderId}` | League player-stat rows; official page also sends optional `teamId`, `playerNameLike`, `playerPosition` and benchmark flags |
| Official leaders | `/statspro/leadingPlayerStats/season/{seasonProviderId}?limit={n}` | Ranked season stat leaders |
| Match/round leaders | `/statspro/leadingPlayerMatchTotals/round/{roundProviderId}` and `/statspro/leadingPlayerMatchTotals/season/{seasonProviderId}` | Leading match totals |

For example, the verified Alyce Parker profile returned a first-party `photoURL`, guernsey 3, season/career aggregates and player details. Its `bio` was `null`, which is why a rich biography cannot rely on that field alone. Use the official AFL profile route (`https://www.afl.com.au/aflw/players/{centralId}/{slug}`) and, where available, the official club's richer profile page as the biography source.

Suggested stored athlete shape:

```json
{
  "source": "afl-official",
  "competition": "AFLW",
  "playerProviderId": "CD_I1009799",
  "seasonProviderId": "CD_S2026264",
  "teamProviderId": "CD_T7889",
  "number": 3,
  "position": "MIDFIELDER",
  "portrait": { "url": "source photoURL", "sourceUrl": "official profile", "checkedAt": "..." },
  "profile": { "officialUrl": "...", "clubUrl": "...", "bioSummary": "attributed paraphrase" },
  "stats": { "seasonAverages": {}, "seasonTotals": {}, "careerTotals": {}, "recent": [] },
  "checkedAt": "..."
}
```

## Official top-10 selections

### AFL men: final 2026 coaches' leaderboard

This is the strongest deterministic official/curated list available: the 18 coaching panels vote after every home-and-away match. The [AFL's final 2026 AFLCA leaderboard](https://www.afl.com.au/news/1594994/record-breaker-collingwood-magpies-star-nick-daicos-caps-incredible-season-with-second-coaches-award/) records:

| Rank | Player | Club | Votes |
|---:|---|---|---:|
| 1 | Nick Daicos | Collingwood | 147 |
| 2 | Marcus Bontempelli | Western Bulldogs | 109 |
| 3 | Max Gawn | Melbourne | 99 |
| 4 | Will Ashcroft | Brisbane | 91 |
| 5 | Bailey Smith | Geelong | 85 |
| 6 | Isaac Heeney | Sydney | 84 |
| 7 | Patrick Cripps | Carlton | 81 |
| 8 | Jordan Dawson | Adelaide | 80 |
| 9 | Brodie Grundy | Sydney | 79 |
| 10 | Luke Jackson | Fremantle | 77 |

Store selection metadata such as `selectionMethod: aflca-final`, `season: 2026`, `sourceUrl` and the vote total. Resolve each player's `providerId` from the 2026 AFL squad feed, then use the AFL StatsPro variants above for number, portrait, bio fields, current/career stats and recent form.

### AFLW: AFL.com.au expert consensus, 2026 preseason edition

The [AFL's first 2026 AFLW edition of The 25](https://www.afl.com.au/news/1583246/the-25-the-aflws-best-players-ranked-ahead-of-the-2026-season) says multiple AFL.com.au experts selected players and the overall consensus formed the list. Its top 10, in descending order, is:

| Rank | Player |
|---:|---|
| 1 | Jasmine Garner |
| 2 | Kate Hore |
| 3 | Ash Riddell |
| 4 | Ella Roberts |
| 5 | Matilda Scholz |
| 6 | Monique Conti |
| 7 | Ebony Marinoff |
| 8 | Georgie Prespakis |
| 9 | Chloe Molloy |
| 10 | Tyla Hanks |

Label it `The 25 · 2026 preseason`, because the source says it is a rolling monthly list. Do not silently substitute an in-season ladder. For a separate live form panel, the official [round-three AFLW coaches-vote update](https://www.afl.com.au/aflw/news/1600028/coaches-votes-r3-gun-tiger-moves-one-vote-clear-five-perfect-10s) had Monique Conti 28, Ash Riddell 27, and Ally Morphett, Liv Purcell and Lucy Wales on 25; that was only a five-player snapshot and not a complete stable top 10.

## GWS GIANTS AFLW experiment

### Current 2026 list and biography/stat joins

The central squad payload and the [official GWS AFLW team page](https://www.gwsgiants.com.au/teams/aflw) still exposed 33 names at the time of research. Two are stale: Katherine Smith and Claire Ransom are confirmed retired in first-party club announcements ([Smith](https://www.gwsgiants.com.au/news/1951648/2026-grand-final-packages), [Ransom](https://www.gwsgiants.com.au/news/2008192/2026-grand-final-packages)); the club's [pre-season draft/list wrap](https://www.gwsgiants.com.au/news/2013869/aflw-pre-season-draft-wrap-up) describes their replacement context. The current experiment should therefore publish these 31 players, not 33. The [club's 2026 number announcement](https://www.gwsgiants.com.au/news/2038446/double-header-hub) is an additional number cross-check.

`CD_I…` is the durable join key for StatsPro. The club-reference integer below is the one required by the club biography URL and sometimes differs from the central API integer.

| # | Player | Provider ID | Official GWS biography |
|---:|---|---|---|
| 1 | Grace Martin | `CD_I1025924` | [profile](https://www.gwsgiants.com.au/players/aflw/13753/grace-martin) |
| 2 | Alicia Eva | `CD_I998029` | [profile](https://www.gwsgiants.com.au/players/aflw/1693/alicia-eva) |
| 3 | Alyce Parker | `CD_I1009799` | [profile](https://www.gwsgiants.com.au/players/aflw/2062/alyce-parker) |
| 4 | Kiera Yerbury | `CD_I1032569` | [profile](https://www.gwsgiants.com.au/players/aflw/13519/kiera-yerbury) |
| 5 | Jessica Doyle | `CD_I1022736` | [profile](https://www.gwsgiants.com.au/players/aflw/4310/jessica-doyle) |
| 6 | Rebecca Beeson | `CD_I1005453` | [profile](https://www.gwsgiants.com.au/players/aflw/1629/rebecca-beeson) |
| 7 | Zarlie Goldsworthy | `CD_I1022358` | [profile](https://www.gwsgiants.com.au/players/aflw/5862/zarlie-goldsworthy) |
| 8 | Eleanor Brown | `CD_I1009875` | [profile](https://www.gwsgiants.com.au/players/aflw/2024/eleanor-brown) |
| 9 | Sara Howley | `CD_I1023433` | [profile](https://www.gwsgiants.com.au/players/aflw/4671/sara-howley) |
| 10 | Taylah Levy | `CD_I1014628` | [profile](https://www.gwsgiants.com.au/players/aflw/11803/taylah-levy) |
| 11 | Caitlin Fletcher | `CD_I1036298` | [profile](https://www.gwsgiants.com.au/players/aflw/12279/caitlin-fletcher) |
| 12 | Isabel Huntington | `CD_I997725` | [profile](https://www.gwsgiants.com.au/players/aflw/1921/isabel-huntington) |
| 13 | Mikayla Pauga | `CD_I1021436` | [profile](https://www.gwsgiants.com.au/players/aflw/4231/mikayla-pauga) |
| 14 | Kaitlyn Srhoj | `CD_I1026320` | [profile](https://www.gwsgiants.com.au/players/aflw/12273/kaitlyn-srhoj) |
| 15 | Eilish O'Dowd | `CD_I1036083` | [profile](https://www.gwsgiants.com.au/players/aflw/12278/eilish-odowd) |
| 16 | Scarlett Johnson | `CD_I1032589` | [profile](https://www.gwsgiants.com.au/players/aflw/11274/scarlett-johnson) |
| 17 | Georgia Garnett | `CD_I1009822` | [profile](https://www.gwsgiants.com.au/players/aflw/2145/georgia-garnett) |
| 18 | Tarni Evans | `CD_I1017292` | [profile](https://www.gwsgiants.com.au/players/aflw/4040/tarni-evans) |
| 19 | Sophia Gaukrodger | `CD_I1032545` | [profile](https://www.gwsgiants.com.au/players/aflw/15399/sophia-gaukrodger) |
| 20 | Fleur Davies | `CD_I1024584` | [profile](https://www.gwsgiants.com.au/players/aflw/6158/fleur-davies) |
| 21 | Poppy Boltz | `CD_I1009962` | [profile](https://www.gwsgiants.com.au/players/aflw/11804/poppy-boltz) |
| 22 | Tilly Lucas-Rodd | `CD_I1007017` | [profile](https://www.gwsgiants.com.au/players/aflw/1420/tilly-lucas-rodd) |
| 23 | Madison Brazendale | `CD_I1021894` | [profile](https://www.gwsgiants.com.au/players/aflw/4191/madison-brazendale) |
| 25 | Cambridge McCormick | `CD_I1029617` | [profile](https://www.gwsgiants.com.au/players/aflw/8540/cambridge-mccormick) |
| 26 | Maisy Evans | `CD_I1048789` | [profile](https://www.gwsgiants.com.au/players/aflw/17551/maisy-evans) |
| 27 | Grace Kos | `CD_I1042797` | [profile](https://www.gwsgiants.com.au/players/aflw/15571/grace-kos) |
| 28 | Daisy Walker | `CD_I1015105` | [profile](https://www.gwsgiants.com.au/players/aflw/3609/daisy-walker) |
| 29 | Yasmeen Janschek | `CD_I1037629` | [profile](https://www.gwsgiants.com.au/players/aflw/13525/yasmeen-janschek) |
| 30 | Georgia Clark | `CD_I1021895` | [profile](https://www.gwsgiants.com.au/players/aflw/4134/georgia-clark) |
| 31 | Brodee Mowbray | `CD_I1022723` | [profile](https://www.gwsgiants.com.au/players/aflw/4264/brodee-mowbray) |
| 33 | Emily Pease | `CD_I1017286` | [profile](https://www.gwsgiants.com.au/players/aflw/4015/emily-pease) |

Each club page contains a server-rendered rich summary plus source attributes including the player provider ID and AFLW season ID. Fetch the biography at build/refresh time, store an attributed paraphrase and source URL, then join StatsPro profile, career-by-season and round-by-round data using the provider ID. Preserve nulls rather than inventing missing DOB, bio or stats. A newly drafted player may have a profile page before meaningful senior statistics exist.

### All GWS fixtures on/after 28 August 2026 Sydney time

The official fixture API currently publishes ten relevant home-and-away games. Times below are converted from `utcStartTime` into Australia/Sydney; keep UTC as the stored canonical time and render at the user/device timezone.

| Rd | Match/provider ID | Sydney date/time | Fixture and venue | Snapshot result/status |
|---:|---|---|---|---|
| 3 | 8900 / `CD_M20262640304` | Sun 30 Aug, 12:35 | GWS v Yartapuulti — Corroboree Group Oval Manuka | Yartapuulti 52–48 GWS, concluded |
| 4 | 8909 / `CD_M20262640404` | Sat 5 Sep, 18:35 | Brisbane v GWS — Brighton Homes Arena | Scheduled at research time |
| 5 | 8920 / `CD_M20262640507` | Sun 13 Sep, 14:35 | Sydney v GWS — Henson Park | Scheduled |
| 6 | 8929 / `CD_M20262640606` | Sun 20 Sep, 12:35 | GWS v Richmond — Corroboree Group Oval Manuka | Scheduled |
| 7 | 8941 / `CD_M20262640706` | Sun 27 Sep, 13:05 | Collingwood v GWS — Victoria Park | Scheduled |
| 8 | 8946 / `CD_M20262640803` | Sat 3 Oct, 13:05 | GWS v Essendon — Henson Park | Scheduled |
| 9 | 8954 / `CD_M20262640904` | Sat 10 Oct, 17:05 | Geelong v GWS — GMHBA Stadium | Scheduled |
| 10 | 8967 / `CD_M20262641007` | Sun 18 Oct, 14:35 | GWS v Hawthorn — Henson Park | Scheduled |
| 11 | 8975 / `CD_M20262641109` | Sun 25 Oct, 17:05 | Carlton v GWS — IKON Park | Scheduled |
| 12 | 8983 / `CD_M20262641206` | Sun 1 Nov, 12:35 | GWS v Gold Coast — Henson Park | Scheduled |

For context only, the two games before the requested cutoff were a 54–42 round-one win over West Coast and a 60–12 round-two loss to Melbourne/Narrm. Finals are not present in the official season payload yet; no “all fixtures” feature should fabricate a finals path. Refresh the season's round catalogue and matches after qualification and draw publication.

The official [GWS 2026 fixture overview](https://www.gwsgiants.com.au/news/2027671/a-giant-double-header-to-kick-start-to-aflw-in-2026) supplies durable fixture-specific angles for the future games: Poppy Boltz's first game against former club Brisbane (R4); Sydney Derby V after GWS's seven-point 2025 win (R5); the last Canberra game of 2026 (R6); a rematch with Collingwood after a narrow 2025 defeat (R7); GWS's first 2026 Henson Park home game (R8); two Pride Round games and Tilly Lucas-Rodd against former club Hawthorn (R9–10); the last away game (R11); and the home Expansion Cup against Gold Coast (R12).

For round three, use the [official GWS preview](https://www.gwsgiants.com.au/news/2113529/aflw-match-preview-round-3-v-yartapuulti) and the concluded API result. It records, among other attributable pre-match facts, GWS's sub-30 per cent inside-50 efficiency in round two, Matilda Scholz's early-season hit-out figures and Alyce Parker's leading clearance/contested-possession form. For round four, the [official GWS preview](https://www.gwsgiants.com.au/news/2119048/aflw-match-preview-round-4-v-brisbane-lions) records the four-point round-three loss after ten lead changes, Parker's first-three-round averages and Boltz's Brisbane premiership connection.

Editorial refresh rule:

```text
fixture API (identity, time, venue, score/status)
  + newest official GWS/AFL preview or report for that exact opponent/round
  + current official StatsPro form and official ladder context
  -> two or more attributable, non-duplicative facts -> fixture editorial
  -> otherwise no editorial block (never generic filler)
```

Search the [official GWS AFLW news index](https://www.gwsgiants.com.au/news/aflw-news) close to each match. Future previews do not yet exist and should not be pre-written as though current form or team selection were known.

## Formula 1

### Current grid, portraits, numbers and biographies

The [official 2026 drivers page](https://www.formula1.com/en/drivers) is the current-grid authority. Its server-rendered cards contain name, team, nationality, racing number and exact `media.formula1.com` portrait URLs for 22 current drivers. The [official number confirmation](https://www.formula1.com/en/latest/article/all-the-2026-f1-driver-numbers-confirmed-in-full.5rh7o9mPntG7NerzVk9onc.5rh7o9mPntG7NerzVk9onc) provides a convenient number cross-check.

| Team | Driver | No. | Nationality |
|---|---|---:|---|
| Alpine | Pierre Gasly | 10 | France |
| Alpine | Franco Colapinto | 43 | Argentina |
| Aston Martin | Fernando Alonso | 14 | Spain |
| Aston Martin | Lance Stroll | 18 | Canada |
| Audi | Gabriel Bortoleto | 5 | Brazil |
| Audi | Nico Hulkenberg | 27 | Germany |
| Cadillac | Sergio Perez | 11 | Mexico |
| Cadillac | Valtteri Bottas | 77 | Finland |
| Ferrari | Charles Leclerc | 16 | Monaco |
| Ferrari | Lewis Hamilton | 44 | Great Britain |
| Haas | Esteban Ocon | 31 | France |
| Haas | Oliver Bearman | 87 | Great Britain |
| McLaren | Lando Norris | 1 | Great Britain |
| McLaren | Oscar Piastri | 81 | Australia |
| Mercedes | Kimi Antonelli | 12 | Italy |
| Mercedes | George Russell | 63 | Great Britain |
| Racing Bulls | Liam Lawson | 30 | New Zealand |
| Racing Bulls | Arvid Lindblad | 41 | Great Britain |
| Red Bull Racing | Max Verstappen | 3 | Netherlands |
| Red Bull Racing | Isack Hadjar | 6 | France |
| Williams | Alexander Albon | 23 | Thailand |
| Williams | Carlos Sainz | 55 | Spain |

The number-one plate is the reigning champion's reserved option; the official article explains that permanent driver numbers otherwise run from 2 to 99. Do not infer future numbers from asset filenames.

Official driver detail pages (`https://www.formula1.com/en/drivers/{slug}`) provide the required in-depth record: current number/team/nationality; season position, points, starts, wins, podiums, poles, top-tens, fastest laps and DNFs; sprint statistics; career starts/points/best finish/podiums/best grid/poles/championships/DNFs; date/place of birth; long biography; season results; and official images. Examples: [Kimi Antonelli](https://www.formula1.com/en/drivers/kimi-antonelli) and [Oscar Piastri](https://www.formula1.com/en/drivers/oscar-piastri).

The HTML exposes a nominal `https://api.formula1.com/v1/editorial-driverlisting/listing` route, but an unauthenticated direct request returned 401 and the page's accessible configuration did not provide a supported key for it. It is therefore unsuitable as a production dependency. Parse and validate the server-rendered official pages during the controlled refresh, store a last-known-good snapshot, and alert on cardinality/schema drift.

Portrait URLs are first-party Cloudinary-style `media.formula1.com/image/upload/...` URLs, with fallback transforms embedded in the source. Store the exact URL supplied by the official page; do not construct it from team/name assumptions.

### Official live 2026 top 10

The [official 2026 Drivers' Standings](https://www.formula1.com/en/results/2026/drivers) showed this top 10 at the research timestamp:

| Rank | Driver | Team | Points |
|---:|---|---|---:|
| 1 | Kimi Antonelli | Mercedes | 242 |
| 2 | George Russell | Mercedes | 183 |
| 3 | Lewis Hamilton | Ferrari | 183 |
| 4 | Lando Norris | McLaren | 159 |
| 5 | Charles Leclerc | Ferrari | 155 |
| 6 | Max Verstappen | Red Bull Racing | 112 |
| 7 | Oscar Piastri | McLaren | 104 |
| 8 | Isack Hadjar | Red Bull Racing | 68 |
| 9 | Liam Lawson | Racing Bulls | 49 |
| 10 | Pierre Gasly | Alpine | 44 |

The standings page contains **23 season participants**, including Yuki Tsunoda, while the current drivers page contains **22 active-grid drivers** and excludes Tsunoda. These are different concepts: use the current-driver listing for Follow; use all season participants for results/standings history. The existing Sportscal 22-driver grid invariant remains correct only for the current roster.

## Failure handling, refresh and validation

| Risk | Required behaviour |
|---|---|
| Official JSON/HTML unavailable or rate-limited | Serve the timestamped last-known-good snapshot; never empty a directory because one refresh failed. Retry with bounded exponential backoff and retain source status. |
| AFL token mint fails or expires | Mint at refresh time only, never ship the token to stored data. Defer optional stats while retaining squad name/number/profile URL. |
| AFL provider schema changes | Validate required keys and cardinality before promotion; quarantine the new snapshot and alert rather than publishing partial data. |
| Squad feed lags transactions | Reconcile against official club list changes; retain an explicit active/inactive decision with provenance. The Smith/Ransom discrepancy is the regression fixture. |
| `jumperNumber` is 0/null | Display no number/“TBC”, not 0. Prefer a more recent official number announcement only when it unambiguously matches the player. |
| Portrait fails, returns fallback or changes | Use a local neutral athlete silhouette, preserve alt text, and avoid infinite retries. A successful HTTP response containing a generic source fallback is not proof of a valid portrait. |
| Indigenous/seasonal club names change | Key by provider ID and preserve aliases; do not create duplicate follows for Kuwarna/Adelaide, Narrm/Melbourne, etc. |
| Scheduled match changes | Canonicalise by match provider ID and UTC start, then refresh venue/time/status; do not key by rendered date/name. |
| Finals absent | Treat the source round catalogue as open-ended and ingest newly published rounds. Never infer finals participants or dates. |
| F1 page/card markup changes | Require exactly 22 current-grid records, unique numbers/names, valid team assignment and image URL; use last-good on failure. Keep season standings cardinality independent. |
| “Top 10” source moves | Persist source method, edition/date, ranks and checked timestamp. AFL 2026 is final; AFLW The 25 is an edition; F1 is a live snapshot. |

Refresh cadence suitable for this feature:

- AFL/AFLW squads and biographies: daily in season, plus after official signing/list-change news.
- Match times/status/results: at least daily when distant, then more frequently on match day using the existing canonical card refresh path.
- AFLW ladder and player form: after concluded matches; publish source `lastUpdated`.
- F1 grid and biographies: weekly and immediately after an official replacement announcement; standings after every race.
- Promote a generated snapshot only after completeness, identity, duplicate, image-shape and source-age validators pass.

## Copyright, image and provenance boundary

- AFL pages identify much imagery as **AFL Photos** or Getty Images, and the token response carries a copyright-use warning. The [AFL Terms of Use](https://www.afl.com.au/terms-of-use) apply. A public `photoURL` is evidence of an official portrait, not evidence that Sportscal may re-host it.
- Formula 1's first-party CDN is likewise not an open image library. Review the official [F1 guidelines](https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt) and [legal notices](https://www.formula1.com/en/information/legal-notices.7egvZU48hzrypubGBNcQKt) before redistribution or brand use.
- The lowest-risk technical approach is to retain the official remote URL with `sourceUrl`, `checkedAt`, attribution and an on-error neutral fallback, subject to legal approval and the source's hot-link policy. Do not proxy, transform, crop, remove watermarks or copy assets into persistent storage without confirmed rights.
- Biographies should be short original paraphrases with a prominent official-profile link, not copied article/profile prose. Store each factual claim's source URL and retrieval time so editorial can be corrected when list status or statistics change.

## Acceptance checks for the source layer

- AFLW: 18 unique provider team IDs; every published round requested; 108 current regular-season matches; every match has provider ID, two teams, UTC time, venue and status; ladder has 18 unique teams.
- AFL/AFLW athletes: no duplicate player provider IDs; all numbers are positive or null; all portrait URLs are HTTPS or null; top-ten IDs resolve to a current/career profile; every retained bio has a first-party source.
- GWS AFLW: 31 active players; Smith and Ransom excluded as retired; no displayed number 0; all 31 provider IDs resolve or are explicitly marked source-unavailable; all ten post-cutoff fixtures appear exactly once.
- GWS editorial: exact match/opponent/round join; two attributable facts minimum; completed fixtures use official score/report; scheduled fixtures never state projected form/team selections as fact.
- F1: 22 current-grid drivers and 11 two-driver teams; unique racing numbers; current grid excludes Tsunoda while season standings may retain him; live top 10 is timestamped and derived from the official standings table.

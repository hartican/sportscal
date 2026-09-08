# Source coverage research — 8 September 2026

Scope: read-only audit of Cricket/Rugby coverage around 6–8 September, and actual non-F1 participation for the fixed Antonelli/Russell/Hamilton/Piastri/Verstappen pilot. This report does not refresh or modify fixtures, deploy code, or claim worldwide coverage. Official pages and their public embedded data were checked on 8 September 2026. Sydney dates below are conversions from explicit UTC/source-zone timestamps, not copies of timezone-ambiguous web labels.

## Findings that change the implementation

1. There are both **eligibility gaps and source gaps**. Mendoza already exists with stable IDs and a completed result, but its `storyline.stakes` is 3; the existing sport-follow threshold excludes it. Cricket has no Schedule fixtures dated 1–10 September at all. A renderer fallback alone cannot restore fixtures never acquired.
2. Cricket Australia and Rugby Australia expose useful structured data in public HTML. Parse that data without executing website JavaScript. Retain previous source snapshots when a rolling page omits completed matches; absence from a current page is not a cancellation.
3. Antonelli and Verstappen have verified real GT participation. For Russell, Hamilton and Piastri, this bounded search did not establish a current non-F1 race entry. Do not manufacture an upcoming card from a test, an aspiration, team ownership, or an old race.

## Repository evidence

The following were inspected in this worktree; counts describe the pre-Phase-2 coverage snapshot, not a global schedule audit:

| Surface | Observed coverage | Consequence |
| --- | --- | --- |
| `data/code-inspector/cricket.json` | `coverageStatus: partial`, 16 fixtures, none dated 2026-09-01 through 2026-09-10 | Primarily selected Australian men's fixtures; not an international men/women fixture inventory. |
| `data/code-inspector/rugby-union.json` | `coverageStatus: partial`, 24 fixtures; only Mendoza in that date window | South Africa/New Zealand September Tests and women's fixtures are absent from this chunk. |
| `data/events.json` | Mendoza is present as `rugby-argentina-australia-mendoza-2026-09-06`, with `storyline.stakes: 3` | Keep this identity and repair eligibility; do not create a duplicate. |
| `scripts/refresh-results-2026-07-30.js` | Explicit Mendoza 28–28 official correction, checked 6 September | A hard-coded result correction is not a continuing live Rugby adapter. |
| `scripts/refresh-canonical-sports.js` | AFL/NRL source loader; not a general Cricket/Rugby loader | Add new source adapters through the canonical orchestrator. |
| `scripts/refresh-official-follow-fixtures.js` | NBA team schedules, Hockey Australia schedules/articles and Diamonds announcement | No Cricket/Rugby source-discovery loop in this adapter. |
| `data/follow-directory/cricket.v1.json` | Men's international-style IDs and BBL teams; no explicit women's team identities | Women's national teams need distinct identities, not reuse of men's IDs. |
| `data/follow-directory/rugby.v1.json` | Wallabies, Springboks, All Blacks and men's domestic teams; no Wallaroos/Black Ferns identities | Complete taxonomy → Follow → fixture membership → validation, not cards alone. |

The Rugby Union chunk also contains `rlwc-australia-new-zealand-2026` with `team:nrl:kangaroos` / `team:nrl:kiwis`; this is a separate taxonomy leak to test while repairing sport classification.

## Rugby: exact evidence and stable IDs

### Mendoza is a visibility failure, not missing source data

Keep `rugby-argentina-australia-mendoza-2026-09-06`, `team:rugby:argentina` and `team:rugby:wallabies`. Rugby Australia's current match centre identifies source fixture **949624**, a 28–28 result, at Estadio Malvinas Argentinas. Its public JSON-LD `startDate` and `__NEXT_DATA__` `dateTime` both give `2026-09-05T21:00:00+00:00`: **Sunday 6 September, 07:00 Sydney**. This agrees with the repository. The earlier season/June announcement carried a different kick-off; use the newer match-specific timestamp and retain provenance rather than overwriting it from an older article. [Rugby Australia match centre](https://www.rugby.com.au/match-centre/3/2026/949624), [earlier Wallabies announcement](https://wallabies.rugby/news/sydney-sellout-wallabies-to-kick-off-2026-with-sold-out-ireland-test-202668).

### Confirmed missing men's Test

South Africa v New Zealand, third Test, FNB Stadium: source fixture **949461**, `2026-09-05T15:10:00+00:00`, hence **Sunday 6 September, 01:10 Sydney**; completed **29–24**. Both UTC and result are in Rugby Australia's public HTML. NZ Rugby independently confirms the result. Preserve existing `team:rugby:springboks` and `team:rugby:all-blacks`; a proposed new fixture ID should derive from `949461`, unless an existing semantic match is discovered elsewhere. [Rugby Australia match centre](https://www.rugby.com.au/match-centre/3/2026/949461), [NZ Rugby match report](https://www.allblacks.com/news/all-blacks/match-report-all-blacks-v-south-africa-third-test-rugby-s-greatest-rivalry).

This is also a reminder-order regression sentinel: do not copy a generic 17:00 South African preview when the current official match timestamp is 17:10 SAST.

### Confirmed missing women's Test

Springbok Women v Black Ferns was scheduled at FNB Stadium on **5 September 2026, 13:30 SAST**: `2026-09-05T11:30:00Z`, **Saturday 5 September, 21:30 Sydney**. It belongs just before, not after, the men's Test in Sydney chronology. NZ Rugby's current homepage records the completed result **20–52**. Add distinct women's participant identities and explicit senior/international/gender metadata. Do not map these teams to the men's Springboks/All Blacks IDs. [NZ Rugby fixture announcement](https://www.allblacks.com/news/black-ferns/remaining-black-ferns-2026-fixtures-confirmed), [NZ Rugby current fixtures/results](https://www.allblacks.com/?url=https%3A%2F%2Fwww.allblacks.com%2Ffixtures%2Fall-blacks).

SA Rugby's schedule also confirms the fourth men's Test in Baltimore on **12 September local date**, and includes both men's and women's fixtures in the same tour. The broader schedule is useful discovery evidence, but exact kick-off and status should come from match-specific records. [SA Rugby tour announcement](https://saru-umbraco.azurewebsites.net/news-features/articles/2026/01/22/rugby-s-greatest-rivalry-heads-stateside/).

### Rugby adapter seam

Successfully fetched public HTML from both Rugby Australia match centres above (HTTP 200). Verified path:

```text
script#__NEXT_DATA__
  props.pageProps.matchData.getFixtureItem
    id, compId, compName, dateTime, season, status, isLive, isBye,
    round, roundType, roundLabel, venue,
    homeTeam.{teamId,name,score,crest}, awayTeam.{teamId,name,score,crest}
```

`status` was `Result`; `dateTime` included `+0000`. `team.id` can be fixture-specific (for example `949624-800`), so use `teamId` in the source-to-canonical team map. JSON-LD `SportsEvent` is a minimal fallback for title/date/teams/venue if richer optional fields change. The generic `/fixtures` page did not expose those same fixture records in the inspected initial payload: discovery pagination/competition queries need a separately validated adapter, not an assumed URL pattern. [Rugby Australia source payload](https://www.rugby.com.au/match-centre/3/2026/949624).

## Cricket: real coverage gap and an ingestible source

The official Cricket Australia series inventory includes England–Pakistan Tests (19 August–13 September), Women's Asia Cup (28 August–13 September), Namibia–South Africa ODIs from 9 September, and Australia's Zimbabwe ODIs from 15 September. Therefore an Australian men's-only snapshot cannot fulfil “Follow Cricket”. This does **not** prove an Australian men's international was scheduled on 6–7 September. [Cricket Australia series inventory](https://www.cricket.com.au/matches/series), [ICC Zimbabwe–Australia announcement](https://www.icc-cricket.com/news/zimbabwe-to-host-australia-for-odi-series-in-september).

### Verified source records

The Women's Asia Cup series is **CA:4710**. Its current embedded data provides these fixtures; all start at `14:30:00Z`, which is **00:30 Sydney on the following date**:

| Source fixture | Match | UTC date | Sydney date |
| --- | --- | --- | --- |
| CA:40954 | Bangladesh Women v UAE Women | 8 September | 9 September |
| CA:40956 | India Women v TBC, semi-final | 10 September | 11 September |
| CA:40958 | Sri Lanka Women v Pakistan Women, semi-final | 11 September | 12 September |
| CA:40960 | TBC v TBC, final | 13 September | 14 September |

The first three match-centre links were opened successfully. The final's identity/time is verified in the series payload, despite its standalone match-centre fetch failing. A TBC opponent must not suppress a real published fixture. [Series and embedded fixture data](https://www.cricket.com.au/matches/series/CA:4710/asia-cup-2026-women), [CA:40954](https://www.cricket.com.au/matches/CA:40954/bangladesh-women-united-arab-emirates-women-bangladesh-w-v-uae-w), [CA:40956](https://www.cricket.com.au/matches/CA:40956/india-women-tbc-semi-final), [CA:40958](https://www.cricket.com.au/matches/CA:40958/sri-lanka-women-pakistan-women-semi-final).

The rolling main matches page also exposed **CA:40955**, Namibia Men v South Africa Men, first ODI, `2026-09-09T07:30:00Z` (**17:30 Sydney**), and **CA:40957**, second ODI, `2026-09-11T07:30:00Z`. These are direct “senior internationals without Australia” regression cases. [Cricket Australia matches](https://www.cricket.com.au/matches/), [CA:40955 match centre](https://www.cricket.com.au/matches/CA:40955/namibia-men-south-africa-men-1st-odi).

An earlier cached rendering of the main page showed Pakistan Women v Hong Kong Women labelled 7 September, but it disappeared from the current rolling page during this audit. Its exact UTC start and source identity were **not** recovered here. Do not fabricate those fields or call the 6–7 September Cricket reconstruction complete from that label alone.

### Cricket adapter seam

Successfully fetched public series and main-page HTML (HTTP 200). Both contain:

```text
window.FIXTURES_DATA = JSON.parse('…escaped JSON array…')
```

Observed fields include `id`, `name`, `startDateTime`, `endDateTime`, `gameTypeId`, optional `gameType`, `isLive`, `isInProgress`, `isCompleted`, `numberOfDays`, `resultText`, `isWomensMatch`, `competition.{id,name}`, `venue.{id,name,location}`, `homeTeam.{id,name,shortName}`, `awayTeam.{id,name,shortName}`, `innings` and `channels`. Parse the string literal safely and then `JSON.parse`; never `eval` the page. The inspected women's fixture uses `gameTypeId: 38`, `isWomensMatch: true`, and no `gameType` label, so missing format text cannot block inclusion. [Public fixture payload](https://www.cricket.com.au/matches/CA:40954/bangladesh-women-united-arab-emirates-women-bangladesh-w-v-uae-w).

Observed CA team IDs: Bangladesh Women **73**, UAE Women **1198**, India Women **76**, Sri Lanka Women **77**, Pakistan Women **70**, TBC **12**. Treat 12 as an unresolved slot, not a globally followable real team. These provider IDs are not existing NS identities. [Official series data](https://www.cricket.com.au/matches/series/CA:4710/asia-cup-2026-women).

Recommendations: bootstrap from the series inventory plus rolling matches, ingest men and women, then validate completed-page/pagination retrieval separately. Retain omitted known matches and multi-day spans. Map men's existing canonical IDs (`team:cricket:australia`, `england`, `pakistan`, `south-africa`, etc.) deliberately; add distinct women's IDs. Keep domestic fixtures in the library for direct team/athlete follows, but classify sport-only discovery by competition/round rather than a numeric stakes value.

## Fixed cross-discipline F1 pilot

Stable IDs already exist in `data/follow-directory/f1.v1.json` and the matching `data/athlete-profiles/f1.v1.json` profiles:

| Athlete | Existing participant ID | Evidence-backed outcome |
| --- | --- | --- |
| Kimi Antonelli | `competitor:f1:kimi-antonelli` | Real Italian GT3 race history; no future non-F1 entry verified in this audit. |
| George Russell | `competitor:f1:george-russell` | No current real non-F1 race entry verified. Keep pilot membership, do not invent a card. |
| Lewis Hamilton | `competitor:f1:lewis-hamilton` | MotoGP machinery experience is a test/ride swap, not a MotoGP race entry. |
| Oscar Piastri | `competitor:f1:oscar-piastri` | No current real non-F1 race entry verified. McLaren's WEC project does not establish his participation. |
| Max Verstappen | `competitor:f1:max-verstappen` | Verified NLS/GT3 and Nürburgring 24-hour history. No post-8-September real-world entry verified here. |

### Antonelli: positive historical match

On **6 May 2023**, Antonelli won his Italian GT3 debut at Misano in an Antonelli Motorsport Mercedes-AMG GT3, with pole and fastest lap. ACI Sport's event page provides dated official race results for 6 and 7 May, with third place on the second day recorded in the organiser's weekend reporting. This belongs in profile/history or historical race records, not the current Feed. Importantly, “Antonelli Motorsport” alone is not enough: the organisation also races other drivers, and Marco Antonelli is a different person. [ACI Sport first-race report](https://www.acisport.it/it/CIGT/notizie/2023/117177/misano,-il-gt-2023-si-inaugura-con-le-vittorie-di-andrea-kimi-antonelli-(gt3)-e-gilles-stadsbader-(gt-cup)), [official Misano event/results](https://www.acisport.it/it/cigt/calendario-e-risultati/2023/7379/misano/elenco-iscritti-tabella-tempi-e-distanze-mappe-cartine-risultati-orari-chiusura-strade-percorso-programma-e-classifiche-ufficiali), [ACI Sport weekend report](https://www.acisport.it/it/ACI-SPORT/notizie/2023/117188/a-misano-il-secondo-aci-racing-weekend-si-chiude-nel-segno-dello-spettacolo).

### Verstappen: positive historical matches and forward scan boundary

- **27 September 2025, NLS9:** the championship's race-report index records Verstappen and Chris Lulham's victory. This is real GT3 participation, not just his team's entry. [NLS official race archive](https://www.nuerburgring-langstrecken-serie.de/language/en/category/races/page/2/).
- **21 March 2026, NLS2:** the driver's official site confirmed his personal Mercedes-AMG GT3 entry with Dani Juncadella and Jules Gounon. The source gives 12:00 Dutch time for the four-hour race. This audit does not use that preview as proof of its final classification. [Official NLS2 preview](https://news.verstappen.com/en/article/6109/).
- **19 April 2026, 24h Qualifiers race 2:** his official race report confirms actual participation with Lucas Auer and a P38 finish after repairs. These Qualifiers include actual four-hour races; do not misclassify the entire meeting as practice because its name contains “Qualifiers”. [Official race report](https://news.verstappen.com/en/article/6131/).
- **16–17 May 2026, Nürburgring 24 Hours:** start **16 May 15:00 CEST** (`13:00Z`, **23:00 Sydney**), car #3 Mercedes-AMG GT3, co-drivers Juncadella/Gounon/Auer. The subsequent official report documents Verstappen's Sunday driving stints and the car's technical retirement. [Official schedule/entry](https://news.verstappen.com/en/article/11215), [actual race report](https://news.verstappen.com/en/article/6161).

Nürburgring's official reporting confirms an upcoming **12–13 September 2026 NLS8/NLS9 double-header**, but the inspected material did **not** establish Verstappen's personal entry. Add the series/calendar to the library if desired; do not attach him to those fixtures merely because he drove previous rounds or owns a team. [Nürburgring official NLS reporting](https://nuerburgring.de/news/categories/nurburgring-langstrecken-serie?locale=en).

### Russell, Hamilton, Piastri: evidence boundaries

Russell's team biography documents karting and junior single-seaters. It says he was close to signing for BMW in DTM before joining Mercedes' junior programme; that is not evidence he raced DTM. Keep potential future entry discovery separate from this historical near-move. [Mercedes driver biography](https://www.mercedesamgf1.com/news/everything-you-need-to-know-about-george-russell).

MotoGP's official **11 December 2019** video documents Hamilton and Rossi's one-day machinery swap. It supports a profile item labelled test/experience, not an entry/result or upcoming MotoGP card. [MotoGP official ride-swap coverage](https://www.motogp.com/en/videos/2019/12/11/rossi-hamilton-titans-switch-seats/36821).

Piastri's official profile lists karting, British F4 and Formula Renault/F3/F2 milestones. McLaren's endurance page confirms the manufacturer's **2027 WEC Hypercar programme**, not a Piastri driver announcement. Neither is evidence of an upcoming Piastri endurance entry. [McLaren Piastri profile](https://www.mclaren.com/racing/team/oscar-piastri/), [McLaren endurance programme](https://www.mclaren.com/racing/endurance/).

“No entry verified” describes this bounded official-source search; it is not a claim that an athlete has never raced anything else.

## Implementation and acceptance recommendations

1. Register Cricket/Rugby/cross-code adapters under `scripts/update-cards.js`, keeping canonical refresh as the only entry point. Extract pure parsers so the lightweight live mode can share them without rebuilding editorial or deploying every minute.
2. Preserve original fixture IDs; attach provider source IDs as aliases. Merge partial/rolling pages non-destructively. Explicit cancellation/withdrawal/exclusion can update a known record; simple omission cannot delete it.
3. Use source UTC → Sydney conversion once. Regress Mendoza 07:00, Springboks–All Blacks 01:10 and CA:40954 00:30-next-day. Exact start, estimated start, date-only and unknown must remain distinct.
4. Add women’s identities and explicit senior/international metadata alongside source adapters. Test sport-only Cricket/Rugby includes verified senior internationals regardless of stakes, direct team/athlete includes their non-marquee fixtures, and Australians-only does not include these non-Australian fixtures unless another direct follow independently matches.
5. Model athlete-event membership with `participantId`, `competitionId`, `eventId`, `participationStatus` (provisional/confirmed/withdrawn/completed), evidence URL/date and optional team/car/discipline. Keep historical experience and test/ownership/interest in separate fields. This schema can extend to cricket squads and women's code-switching without equating an organisation to a person.
6. Acceptance must include source → canonical library → Follow directory/membership → server/client eligibility → rendered card, not just parser success. Source health should say partial until pagination/history, source inventory and representative men's/women's fixtures are verified.

Remaining evidence gaps: full 6–7 September Cricket history; complete senior international Rugby inventory; a verified future non-F1 entry for any fixed pilot athlete; automated official event entry-list discovery; and live score/status ingestion beyond the sampled public page payloads. None should be disguised as complete coverage by a permissive card fallback.

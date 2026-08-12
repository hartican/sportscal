# nothingSport Phase 2 tennis provider research

Research date: 13 August 2026
Scope: official/first-party ATP, WTA and competition sources only

## Recommendation

Do not build unattended ingestion against public ATP or WTA webpages, PDFs, or their undocumented internal requests. The information is publicly viewable, but the published terms do not grant the database-building use Phase 2 requires:

- [ATP Terms of Use](https://www.atptour.com/en/terms-and-conditions) limit site content to individual, non-commercial use and prohibit systematic retrieval of scores, statistics or rankings to create a database without ATP's prior express written permission. [ATP robots.txt](https://www.atptour.com/robots.txt) also disallows `*/ajax/*` and reserves several automated uses.
- [WTA Terms of Use](https://www.wtatennis.com/terms-and-conditions) prohibit automated access and automated or mass-manual harvesting unless WTA has given separate written permission. [WTA robots.txt](https://www.wtatennis.com/robots.txt) permits crawlers generally, but that does not override the terms.

The safest Phase 2 production route is therefore a licensed provider contract with equivalent ATP and WTA coverage. Keep every provider behind the same narrow adapters so the eligibility engine, catalogue and UI never depend on a vendor schema. Official public pages should remain manual QA/regression oracles, not production crawler inputs.

ATP and WTA identify different official commercial paths:

- ATP says Tennis Data Innovations (TDI), its joint venture with ATP Media, controls and commercialises ATP data. Its [Sportradar announcement](https://www.atptour.com/en/news/sportradar-atp-partnership-december-2023) says Sportradar received global data and media rights for all ATP Tour and ATP Challenger Tour events.
- WTA says [Stats Perform is its official data supplier](https://www.wtatennis.com/news/3812740/stats-perform-extends-exclusive-official-rights-partnership-with-the-wta), distributing official WTA feeds to authorised media, technology, broadcast and other customers through the end of the decade. WTA also has an authenticated [Data API developer portal](https://developers.wtatennis.com/), but its documentation and access conditions are not public.

No public, self-service ATP API was found in the official sources. The WTA developer portal's existence does not establish that access is available to nothingSport or that its licence permits this use. Those are procurement questions, not implementation assumptions.

## Official source assessment

| Need | ATP official source | WTA official source | Availability and cadence | Safe role now |
|---|---|---|---|---|
| Current singles rankings | [ATP singles rankings](https://www.atptour.com/en/rankings/singles/) | [WTA singles rankings](https://www.wtatennis.com/rankings/singles) and [full Numeric List PDF](https://wtafiles.wtatennis.com/pdf/rankings/Singles_Numeric.pdf) | ATP's [2026 Rulebook](https://www.atptour.com/-/media/files/rulebook/2026/2026-rulebook_25jan26.pdf) says rankings run approximately 45 times per year. The [2026 WTA Rulebook](https://photoresources.wtatennis.com/wta/document/2025/12/24/b300b2a4-8d71-4346-969f-1f6b9399661f/2026-WTA-Rulebook-12-22-2025-.pdf) says rankings are processed weekly, except during two-week tournaments. Official lists carry an effective date. | Manual validation and expected-output fixtures only, unless written permission covers ingestion. |
| Season tournament universe | [ATP tournament calendar](https://www.atptour.com/en/tournaments/) and [2026 calendar announcement](https://www.atptour.com/en/news/what-is-the-2026-atp-tour-calendar) | [WTA tournament calendar](https://www.wtatennis.com/TOURNAMENTS) and [calendar PDF](https://wtafiles.wtatennis.com/pdf/calendar/calendar.pdf) | Calendars expose dates, place, surface and tour level. The WTA PDF carries a `CALENDAR AS OF` date; neither tour promises a fixed public-page publication cadence. | Manual season-level reconciliation and marquee-coverage assertions. |
| Tournament identity and entries | ATP tournament pages, for example [Canada tournament 421](https://www.atptour.com/en/tournaments/canada/421/overview) | WTA tournament pages and player lists, for example [Toronto tournament 806](https://www.wtatennis.com/tournaments/806/toronto/2026) | Entry lists change until draws are published. WTA explicitly marks player lists as subject to change; tournament pages become richer near the event. | Regression oracle and exception diagnosis, not a guaranteed fixture feed. |
| Match schedule/order of play | ATP daily schedule pages, for example [Geneva 322](https://www.atptour.com/en/scores/current/geneva/322/daily-schedule?day=1) | WTA order-of-play pages under each tournament | Exact court times are late-binding. The [ATP Rulebook](https://www.atptour.com/-/media/files/rulebook/2026/2026-rulebook_14jan26.pdf) defines daily order of play and permits approved changes after release. | Compare a licensed feed near event time; never treat season dates as match start times. |
| Team competitions | [Davis Cup calendar](https://www.daviscup.com/en/calendar) | [Billie Jean King Cup format/calendar](https://www.billiejeankingcup.com/en/more/format) and [Finals schedule](https://www.billiejeankingcup.com/en/tickets) | The competition owners publish tie windows, then later venues, teams and exact sessions. | Separate official competition oracle; do not force these events through ATP/WTA tour assumptions. |

The public evidence is asymmetric: WTA publishes a comprehensive dated rankings PDF while ATP exposes rankings through its site UI; the sites also expose different calendar and player-list shapes. Scraping both independently would reproduce that asymmetry and would not satisfy the specification's equal first-class ATP/WTA treatment.

## Identifiers and Australian players

Official pages expose useful source aliases:

- ATP player URLs contain a short player code, for example `dh58` for [Alex de Minaur](https://www.atptour.com/en/players/alex-de%20mi%C3%B1aur/dh58/overview), and tournament URLs contain a numeric code such as `421` for Canada.
- WTA player URLs contain a numeric player ID, for example `330544` for [Maya Joint](https://www.wtatennis.com/players/330544/maya-joint/stats), and tournament URLs contain a numeric tournament ID plus season, such as `806` and `2026` for Toronto.

Treat these as namespaced source aliases (`atp:player:dh58`, `wta:player:330544`, etc.), not as canonical nothingSport IDs or documented API contracts. Slugs can vary, tournament names can be sponsored, venues alternate, and current public pages can contain inconsistent display fields. Canonical IDs should be generated and retained internally, with all source aliases stored separately for reconciliation.

`isAustralian` should derive from the player's current represented country code (`AUS`), never birthplace or a name list. The WTA profile for Maya Joint shows `AUS`, while the official [Tennis Australia player directory](https://www.tennis.com.au/fan-zone/australian-players) includes both men's and women's Australian representatives. Representation can also change: [Daria Kasatkina's WTA profile](https://www.wtatennis.com/players/322082/daria-kasatkina/) records her move to representing Australia.

To meet “all Australian players regardless of ranking”, a licensed full ranking/player feed must be filtered for `AUS`, not truncated to the Top 50. Tournament entries, wildcards, qualifiers and replacements must then be unioned in so an Australian without a current ranking is not missed. Store the represented-country value with its source snapshot date; do not infer or permanently cache it as biographical nationality.

## Safest adapter boundaries

The provider edge should return four factual snapshot types and nothing more:

```text
TennisRankingSnapshot
  provider, tour, effectiveDate, fetchedAt, sourceReference
  entries[]: sourcePlayerId, rank, points?, representedCountryCode

TennisPlayerSnapshot
  provider, tour, sourcePlayerId, displayName
  representedCountryCode, active?, sourceUpdatedAt?

TennisTournamentSnapshot
  provider, tour/owner, sourceTournamentId, season
  name, level, startDate, endDate, venue, surface, status

TennisMatchSnapshot
  provider, sourceMatchId, sourceTournamentId, season
  participants[], round, court?, scheduledTimeUtc?, timeStatus, status
```

Adapter rules:

1. Use opaque, provider-prefixed source IDs and maintain an explicit alias table to internal athlete, tournament and event IDs.
2. Preserve `effectiveDate`, `fetchedAt`, source reference and raw-source checksum on every snapshot. A weekly job should publish a new snapshot only when the provider's effective date advances; an empty or older response must not erase the last good universe.
3. Keep represented country, ranking and participation factual. Derive `isAustralian`, Top 50 inclusion, tournament eligibility and froth later in the deterministic rules layer.
4. Normalise ATP and WTA through the same contracts and parity checks. A refresh fails closed if either required tour is missing, stale beyond its documented cadence, truncated below the required range, or has an unexplained count collapse.
5. Separate tournament-level coverage from match scheduling. Marquee tournaments can enter the catalogue from their official date range; match cards require a draw/order-of-play source and must retain `timeStatus` when only “followed by” or “not before” is known.
6. Give Grand Slams, Davis Cup and Billie Jean King Cup explicit source-owner aliases. They must share the canonical output model without pretending their fixture authority is ATP or WTA.
7. Do not persist Australian local time from a provider. Store authoritative UTC when supplied and derive Sydney time at read time.

## Minimum provider acceptance gate

Before integrating any feed, obtain written confirmation of permitted storage, transformation, display, refresh rate, attribution and redistribution. A candidate must demonstrate:

- ATP and WTA singles rankings beyond Top 50, with effective dates, stable source player IDs and represented-country codes;
- full marquee tournament calendars for both tours, including levels, dates and stable tournament identities;
- entries/draws and scheduled matches with status changes, cancellations and time confidence;
- Grand Slam and team-competition coverage, or an explicit supported merge path to their owners;
- equivalent freshness and field completeness for ATP and WTA;
- a sandbox or recorded fixtures that can power deterministic tests without checking vendor secrets into the repository.

Provider credentials must remain server-side. Raw responses should be retained only as the licence permits, while sanitised fixtures should contain no credential, request header or undisclosed endpoint information.

## Phase 2 verification oracles

- **Toronto:** the [official 2026 WTA Toronto page](https://www.wtatennis.com/tournaments/806/toronto/2026) identifies tournament `806` as a WTA 1000 in Toronto with an active date range, draw sizes and represented countries. Use a recorded, licence-safe provider fixture with these facts for the automated regression test, and use the page only for manual reconciliation.
- **Parity:** assert required tournament-level coverage separately for ATP Masters 1000 and WTA 1000, and report catalogue counts by tour and level. Equality means equivalent rules and source quality, not identical raw event counts.
- **Australians:** include fixtures for an ATP/WTA Top 50 Australian and at least one `AUS` player outside the Top 50. The outside-Top-50 athlete must remain eligible even when no rank-based rule applies.
- **Freshness:** run rankings weekly, but compare provider effective dates rather than assuming every Monday produces a new list. Run tournament reconciliation weekly and refresh draws/order of play daily for the next seven days once licensed fixture data is available.

## Decision needed before live ingestion

Phase 2 can safely implement provider-neutral schemas, adapters, deterministic inclusion logic and recorded-fixture tests now. Live ingestion should wait for one of these documented authorities:

1. written ATP/TDI and WTA permission plus access to their respective official feeds; or
2. one licensed cross-tour provider whose contract explicitly covers the Phase 2 use and passes the parity gate above.

Until then, a committed manual seed fixture may prove the rules engine, but it must be labelled as a fixture and must not be presented as an automatically refreshed production athlete or tournament universe.

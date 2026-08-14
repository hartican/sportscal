# Cincinnati schedule and paid tennis source research

**Research date:** 14 August 2026
**Decision scope:** nothingSport joint-tournament beta and future source procurement
**Implementation status:** research only; no paid source is approved, purchased or integrated

## Recommendation

For the MVP, automate Cincinnati data only from links published by the tournament itself. Fetch the official Order of Play and Draws pages, extract their current official PDF links, then parse and validate those files. Use the tournament schedule page for session dates, rounds and advertised start times.

Do not add an automated ATP, WTA or undocumented Rain-data fallback. The ATP and WTA terms place material restrictions on systematic or automated retrieval, while the Rain feed is not a documented public contract. A parser failure should therefore use nothingSport's bounded stale-data and overview fallbacks rather than silently switching sources.

Among the paid candidates, Sportradar has the strongest publicly documented fit and the most useful evaluation trial. SportsDataIO may be viable but needs written confirmation of Cincinnati and court-order coverage. API-Tennis is the cheapest public trial path, but its documentation does not establish court or scheduled-play sequence. These are procurement findings only.

## Evidence labels

- **Verified** means the statement is supported directly by the linked provider or rights-holder page.
- **Unknown** means the public material reviewed does not establish the capability or commercial right.
- **Inference** means the conclusion is a product or engineering judgement drawn from verified facts. It is not a provider promise.

## Official Cincinnati MVP boundary

| Source | What the official page establishes | MVP use | Evidence status |
| --- | --- | --- | --- |
| [Tournament Schedule](https://cincinnatiopen.com/tournament/tournament-schedule/) | Session dates, rounds and advertised session start times. | Cross-check tournament window, round labels and session timing. | Verified |
| [Order of Play](https://cincinnatiopen.com/score-center/order-of-play/) | The page publishes changing links to official order-of-play PDFs. | Discover the current PDF from page markup, then parse courts, match order and published timing language. | Verified |
| [Draws](https://cincinnatiopen.com/score-center/draws/) | The page publishes ATP and WTA main-draw and qualifying-draw PDFs. | Discover the current draw PDFs and use them to validate player, tour and round context. | Verified |

The safe extraction sequence is:

1. Fetch only the three official Cincinnati pages above.
2. Extract only PDF links that those pages currently publish.
3. Reject unexpected hosts, file types, impossible dates, duplicate stable IDs and malformed schedule structures.
4. Keep schedule fields separate from optional result fields so results-hidden views cannot leak scores, winners or outcome-derived importance.
5. On a parse or validation failure, retain the last successful document for no more than 24 hours with a `Stale` label; after that, show the pinned tournament overview with schedule details unavailable.

**Inference:** Discovering each PDF through the official page is safer than hard-coding a current PDF URL because the published file link changes. It also keeps provenance explicit in each generated document.

**Known gap:** Cincinnati's live scores and results experience is JavaScript-driven and was not dependable as plain HTML in this review. The three approved source pages do not publicly guarantee a stable machine-readable results contract. Completed-result support must therefore remain optional and must never be reconstructed from undocumented endpoints.

**Explicit exclusion:** Do not call or reverse-engineer an undocumented Rain feed. It is not one of the approved source pages and has no public stability or reuse contract established by this research.

## ATP and WTA fallback rationale

The [ATP Terms and Conditions](https://www.atptour.com/en/terms-and-conditions) restrict systematic retrieval and reuse without permission. The [WTA Terms and Conditions](https://www.wtatennis.com/terms-and-conditions) likewise restrict automated harvesting or access without permission.

**Inference:** Even if ATP or WTA pages appear technically parseable, using them as an automatic fallback would create avoidable contractual and operational risk. No such fallback should be enabled unless nothingSport first receives suitable written permission or a licensed feed agreement. These terms links are evidence for the product boundary, not legal advice.

## Paid-source comparison

### At a glance

| Provider | Publicly documented tennis capability | Authentication | Public evaluation offer | Public production price | Cincinnati and court order | MVP assessment |
| --- | --- | --- | --- | --- | --- | --- |
| Sportradar | Daily and season schedules, draw updates, start times, venues, scores and results. | `x-api-key`. | 30-day real-data trial, 1,000 calls, 1 request/second; evaluation restrictions apply. | Quote only. | Cincinnati-specific availability should be confirmed; its schedule model is the strongest documented candidate, but exact court/play order still needs a sample response check. | **Inference:** best enterprise evaluation candidate. |
| SportsDataIO | Schedules by date and round, plus live and final results. | API key in header or query. | Trial is available, but public developer material says trial data is scrambled. | Quote only. | Public pages reviewed do not confirm Cincinnati coverage or exact court/play sequence. | **Inference:** potentially viable, but do not procure before a representative payload is supplied. |
| API-Tennis | Fixtures by date and tournament with time, round, status, scores and statistics. | `APIkey` query parameter. | 14-day trial. | Public monthly tiers of US$40, US$60, US$80 and US$120. | Documentation reviewed does not show court or scheduled-play sequence. Cincinnati coverage and redistribution rights are unconfirmed. | **Inference:** cheapest discovery trial, but not yet proven for the card's defining requirement. |

### Sportradar

The [Sportradar Tennis API overview](https://developer.sportradar.com/tennis/docs/tennis-ig-overview) and [schedule documentation](https://developer.sportradar.com/tennis/docs/tennis-ig-schedules) describe daily and season schedules, draw updates, planned start times, venue information, scores and results. Access uses an API key supplied through the `x-api-key` header.

Sportradar's [account documentation](https://developer.sportradar.com/getting-started/docs/your-account) advertises a 30-day real-data trial with 1,000 calls and a one-request-per-second limit. Its [developer terms](https://developer.sportradar.com/sportradar-updates/page/terms-and-conditions) constrain trial use to evaluation; production access is quote-based.

- **Verified:** It has the broadest public description of schedule, draw and result fields among the three candidates.
- **Unknown:** The reviewed public pages do not prove that the licensed package includes Cincinnati or that each payload provides the exact court and followed-by sequence needed by the card.
- **Inference:** It should be first in an enterprise proof-of-coverage exercise because the 30-day real-data trial can test real tournament behaviour rather than scrambled samples.

### SportsDataIO

The [SportsDataIO Tennis API](https://sportsdata.io/tennis-api) describes schedules by date and round alongside live and final results. The [developer portal](https://sportsdata.io/developers) documents API-key access and states that trial data is scrambled. Production pricing is not published and requires a quote. Use and redistribution remain subject to the [SportsDataIO Terms of Service](https://sportsdata.io/terms-of-service).

- **Verified:** Public documentation covers scheduled, live and final tennis data and supports key-based access.
- **Unknown:** Cincinnati inclusion, court assignment, match sequence, not-before/followed-by semantics, latency, historical corrections and client redistribution rights are not established by the reviewed public pages.
- **Inference:** Scrambled trial data is less suitable for validating real Cincinnati identity, ranking and order-of-play behaviour. Request an unscripted representative Cincinnati payload before commercial evaluation.

### API-Tennis

The [API-Tennis documentation](https://api-tennis.com/documentation) describes fixtures filtered by date and tournament, including time, round, status, scores and statistics. Authentication uses an `APIkey` query parameter. The [API-Tennis product page](https://api-tennis.com/) advertises a 14-day trial and public monthly tiers of US$40, US$60, US$80 and US$120. Rights and permitted reuse need to be checked against the [API-Tennis Terms of Use](https://api-tennis.com/terms-of-use).

- **Verified:** It is the only compared provider with public self-serve monthly prices in the reviewed material.
- **Unknown:** The documentation reviewed does not demonstrate court, within-court order, followed-by relationships, Cincinnati coverage, ranking completeness or rights to redistribute the data in nothingSport.
- **Inference:** It is a low-cost way to test basic tournament fixtures, but price alone does not resolve the joint-card requirement. It should not displace the official Cincinnati source path without a successful coverage proof and acceptable licence terms.

Public trial conditions and prices can change. Re-check the linked provider pages immediately before starting a trial or approving spend.

## Procurement questions

Ask every provider for written answers and a representative Cincinnati payload covering both tours:

1. Is the Cincinnati Open included for ATP qualifying, ATP main draw, WTA qualifying and WTA main draw?
2. Does each record include a stable provider match ID that survives postponement, court changes and schedule corrections?
3. Are court, sequence-on-court, session, exact time, not-before and followed-by semantics supplied as distinct fields?
4. How quickly are order-of-play publications and later corrections reflected?
5. Are ATP and WTA draws linked into one tournament identity, or must the client reconcile two competitions?
6. Are player rankings point-in-time and pre-match, and is ranking provenance exposed?
7. Can scores and outcome data be licensed separately from spoiler-safe schedule data?
8. What happens during a source outage: stale flags, correction markers, deleted records and replay facilities?
9. May nothingSport cache, transform, rank, display and redistribute the data in a public consumer product?
10. What attribution, logo, link-back, retention and deletion obligations apply?
11. What are the production rate limits, overage charges, uptime commitment, support response and termination/export terms?
12. Can evaluation data be retained in test fixtures after the trial ends, or must all samples be deleted?

Provider-specific follow-ups:

- **Sportradar:** request a Cincinnati schedule response that proves court and play-order semantics; confirm which Tennis API package and licence tier covers public display.
- **SportsDataIO:** request non-scrambled Cincinnati sample data before assessing identity matching or ranking quality.
- **API-Tennis:** request evidence of Cincinnati ATP/WTA coverage, court sequence fields and explicit public-display/redistribution rights.

## Decision record

- **Approved for MVP automation:** Cincinnati's official Tournament Schedule, Order of Play and Draws pages, including only the official PDFs discovered through them.
- **Not approved:** browser-time scraping, runtime proxying, undocumented Rain endpoints, automatic ATP/WTA page harvesting, or any paid-provider integration.
- **Future evaluation order:** Sportradar real-data trial first for enterprise-grade coverage; SportsDataIO only after a representative non-scrambled Cincinnati payload; API-Tennis as a lower-cost fixture experiment if its coverage and licence answers are satisfactory.
- **Release consequence:** Failure to obtain or parse optional tournament detail must not block the rest of the feed. Schema errors, duplicate IDs, impossible dates and spoiler leakage remain release blockers.

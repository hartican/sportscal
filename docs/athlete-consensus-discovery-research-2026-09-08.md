# Athlete participation and consensus discovery — 8 September 2026

Scope: read-only source audit for automatic cross-sport athlete discovery and event-specific consensus labels. Requests were made on 8 September 2026. HTTP success establishes technical accessibility, not a publication licence or complete coverage. No fixtures, user data, environment variables or scheduled jobs were changed by this audit.

## Recommended implementation boundary

Use two independent pipelines: discover and verify **athlete → actual fixture membership**, and discover and verify **reporting → existing fixture → allowed label**. Neither pipeline may remove a followed fixture because an enrichment source is unavailable. News search is candidate generation, not membership proof. An empty successful discovery response is distinct from a failed source.

The existing reusable AI seam is `scripts/refresh-f1-editorial.js`: server-side `POST https://api.openai.com/v1/responses`, `OPENAI_API_KEY`, an allowlisted `web_search` tool, strict JSON output, and a deterministic fallback. It is a script rather than a shared/server runtime gateway. Its `validEvidence()` checks only the claimed URL's domain; a new discovery service must additionally require URLs actually returned in the search response's evidence and match them to the specific claim. Do not accept model-authored citation strings merely because their host is allowlisted. This is a repository finding, not a claim that production credentials are configured.

`lib/athlete-participation.js` already supports stable athlete/event IDs, provisional/confirmed/completed/withdrawn membership and source dates. `config/fixture-identity.js` allows Rivalry, Derby, Round-Robin, Knockout, Final and Record Chase, with a 0.6 confidence floor; structural round labels already have a sourced deterministic route. Its cross-sport Schedule hydration is currently specifically triggered by `competitor:f1:*`. Automatic ingestion must also generalise the consumption path; new non-F1 athlete entries alone do not prove they can surface.

## Official NLS: practical automatic discovery now

The following official public endpoints returned HTTP 200 and parseable payloads in direct requests:

| Endpoint | Verified response | Practical role |
| --- | --- | --- |
| [English NLS RSS](https://www.nuerburgring-langstrecken-serie.de/language/en/feed/) | RSS XML, 10 items, approximately 130 KB | Bounded announcement discovery, not a complete entry inventory. |
| [NLS posts search](https://www.nuerburgring-langstrecken-serie.de/wp-json/wp/v2/posts?search=Verstappen&per_page=5&_fields=id,date,link,title,excerpt) | JSON with dated official reports, stable post IDs and canonical article links | Search the fixed pilot and later additional watched athletes. Read a selected official post's event-specific body when necessary. |
| [Recent Verstappen search](https://www.nuerburgring-langstrecken-serie.de/wp-json/wp/v2/posts?search=Verstappen&after=2026-08-01T00%3A00%3A00&per_page=10&_fields=id,date,link,title) | HTTP 200, `[]`, `X-WP-Total: 0` | Valid no-new-evidence case. It does not withdraw any old entry. |
| [NLS8 event-page JSON](https://www.nuerburgring-langstrecken-serie.de/wp-json/wp/v2/pages?slug=2026-65-adac-reinoldus-langstreckenrennen&_fields=id,date,modified,link,title,content) | Page ID 67571, updated 20 May 2026; event content and timetable | Stable page monitoring, official publication dates and entry-list link discovery. |
| [NLS8 public event page](https://www.nuerburgring-langstrecken-serie.de/language/de/2026-65-adac-reinoldus-langstreckenrennen/) | HTML, approximately 147 KB | Exact race day: 12 September 2026; race 12:00–16:00 German local time. |

The NLS8 page says its provisional entry list appears on the Wednesday before the race. There was no actual entry-list link in the inspected event content on Tuesday 8 September. Keep the fixture and a pending discovery state; do not infer Verstappen's entry or withdrawal. When the list is published, follow its actual official link. Do not manufacture a PDF path from a previous year's naming convention. Qualifying, grid walks and race start are separate timetable entries; only the race start should anchor the race card. The site also contains digital NLS and test-session navigation, so inspect the event body rather than matching the entire page.

### Real disambiguation failures to turn into regression tests

- [Searching George Russell](https://www.nuerburgring-langstrecken-serie.de/wp-json/wp/v2/posts?search=George%20Russell&per_page=5&_fields=id,date,link,title) returned six historic posts. [Post 36810](https://www.nuerburgring-langstrecken-serie.de/wp-json/wp/v2/posts/36810?_fields=id,date,link,title,content) contains a driver named Georges and the corner Karussell, but **no full George Russell name**. A search hit is demonstrably not an athlete match.
- Searching Kimi Antonelli and Oscar Piastri returned HTTP 200 with no posts. Lewis Hamilton search returned seven historic posts, requiring person and date disambiguation rather than acceptance as new entries. Antonelli Motorsport is a team name, not a sufficient match for Kimi Antonelli. The existing local pilot research documents this distinction.
- NLS search results include the same story in German and English. Deduplicate by source identity, event and underlying claim; translations are not independent corroboration.
- A current web search returned purported BBC pages on `bbclatestnews.pages.dev` and `bbc.com.im`. These must fail the publisher allowlist. The actual [BBC match-report URL](https://www.bbc.co.uk/sport/rugby-union/articles/c7830m55lklo) returned HTTP 200 when fetched directly. A familiar brand in a title or hostname is not publisher authentication.

### Driver-site health

The [Verstappen official homepage](https://news.verstappen.com/en/) remains discoverable through web search and advertises RSS. Direct Node HTTPS reads to the homepage and attempted RSS paths consistently failed with a socket error in this environment. No current RSS endpoint was established. Record that source as degraded; cached search content does not justify a fresh successful source check. The previous source-coverage report's dated official race announcements remain historical evidence, not new September entries.

No upcoming non-F1 entry for the fixed pilot was verified by this bounded audit. This is an observation about available evidence, not an assertion that none exists globally.

## Extensible athlete membership contract

The following are engineering recommendations, not claims that all destination adapters already exist:

1. Keep one person identity across codes, with canonical ID, full name, explicitly curated aliases, country and provider-person IDs. A provider code plus nationality/date of birth can resolve homonyms; a surname alone cannot. Store organisation IDs separately. Do not automatically add nicknames or test pseudonyms based on unrelated text.
2. Discover official entry lists, fixture lineups, squad announcements and athlete/team announcements. Resolve a candidate to an existing fixture by provider ID where possible; otherwise require destination competition, event date and named participants/event identity. A relative date must resolve against publication time and source timezone, never ingestion time.
3. Auto-accept one explicit official named entry with an unambiguous person/event match. Accept an official provisional list as provisional, not confirmed. A named team roster is not a named match lineup: keep squad selection separately until an explicit fixture entry establishes participation.
4. Separate `race`, `match`, `test`, `training`, `exhibition`, `ownership`, `interest`, `rumour` and `historical-experience`. Do not infer personal participation from team ownership, an equipment test, a simulation, a transfer, a manufacturer's programme or a desire to compete. A real race called Qualifiers must not be rejected merely because its name contains that word.
5. Newer explicit official withdrawal can exclude an athlete from that fixture; a rolling-page omission cannot. Reconcile conflicting claims by evidence timestamp and authority, retaining the evidence trail. Source failure cannot silently mutate membership.
6. Permit source-backed date-only fixtures when a time is unavailable. Keep the card in approximate chronology with timing precision intact. Do not invent a venue, opponent or start time to satisfy a schema.
7. Persist the discovery cursor, checked-at time, source content hash, evidence IDs, decisions and rejection reasons. Re-running the same source should create neither duplicate participants nor duplicate fixtures. Never expose raw news bodies or private user follows in public diagnostics.

For Cricket and women's Rugby/Football/League/AFL, use official lineups and distinct women's team IDs; a person can have several team affiliations without being entered for every team's next match. A new athlete destination must be available through taxonomy, Follow identity resolution, the fixture library and the Feed together.

For snowsports, the [official FIS calendar/results page](https://www.fis-ski.com/DB/general/calendar-results.html?sectorcode=AL&seasoncode=2027&categorycode=WC) returned HTTP 200 and approximately 450 KB of HTML for the 2027 Alpine World Cup query. That establishes a discovery surface only, not a verified general start-list adapter. FIS's [published Para data-exchange protocol](https://assets.fis-ski.com/f/252177/x/3296d7a391/xmldescription_para.pdf) distinguishes start-list order, athlete FIS code and discipline/result data. Preserve those distinctions when adding a tested adapter; a calendar listing or athlete's active status alone is not race entry evidence.

## Reporting feeds: reachable does not mean cleared for commercial ingestion

All feed counts below are direct, current HTTP 200 responses on the audit date. They are rolling feeds, not historical completeness guarantees. The implementation should retain **source URL, publisher identity, publication time and its own classification/evidence hash**, not republish feed article bodies or copy their prose onto cards.

| Publisher endpoint | Current response | Production decision |
| --- | --- | --- |
| [BBC Sport](https://feeds.bbci.co.uk/sport/rss.xml) | XML, 76 items | Website feed use is supported subject to terms and attribution; separately establish automated classification permission. |
| [BBC Cricket](https://feeds.bbci.co.uk/sport/cricket/rss.xml) | XML, 55 items | Useful targeted discovery inventory, including men and women. |
| [BBC Rugby Union](https://feeds.bbci.co.uk/sport/rugby-union/rss.xml) | XML, 52 items | Useful targeted discovery inventory, not League. |
| [Sky Sports news](https://www.skysports.com/rss/12040) | XML, 20 items | Technically available; commercial extraction permission not established here. |
| [Motorsport news](https://www.motorsport.com/rss/all/news/) | XML, 50 items | Official feed directory exists; commercial ingestion permission not established. |
| [The Race](https://www.the-race.com/rss/) | XML, 15 items | Do not enable direct commercial polling without permission. |
| [Guardian sport](https://www.theguardian.com/sport/rss) | Redirects to `/au/sport/rss`; XML, 31 items | Do not enable direct commercial polling without permission. |
| [Guardian Cricket](https://www.theguardian.com/sport/cricket/rss), [Rugby Union](https://www.theguardian.com/sport/rugby-union/rss) | XML, 20 items each | Same restriction; useful evidence of technical availability only. |
| [Formula 1 latest](https://www.formula1.com/en/latest/all.xml) | XML, 10 items | Official discovery source, not independent third-party consensus. |

Publisher constraints were checked rather than inferred from HTTP status:

- BBC permits website RSS with attribution, subject to terms. This does not itself establish commercial AI-classification rights. [BBC Sport RSS guidance](https://www.bbc.co.uk/sport/articles/cqllxj2n4kyo)
- Guardian RSS use is personal/non-commercial. [Feed guidance](https://www.theguardian.com/help/feeds) Current terms restrict commercial extraction and mining. [Guardian terms](https://www.theguardian.com/help/terms-of-service)
- The Race requires written permission for commercial content use. [The Race terms](https://www.the-race.com/terms-and-conditions/)
- Motorsport's terms reserve content for personal use unless the relevant owner consents. [Motorsport terms](https://www.motorsport.com/info/terms-of-use/)

Therefore keep directly fetched publisher feeds in a registry with `rightsStatus`, `enabled`, `publisherGroup`, source type and attribution rules. Do not silently enable a known non-commercial-only feed. A search-provider integration is a separate access route, not a blanket claim that publisher rights disappear. Use the existing authorised search integration for bounded evidence retrieval, without installing an article scraper; retain minimal factual classifications and citation metadata. A full licensed news inventory would require a separate authorised provider contract.

One explicit commercial integration seam is the [Sportradar Editorial News API](https://developer.sportradar.com/images-and-editorials/reference/editorial-news). It documents dated manifests, item IDs, origin credit/byline and update timestamps, including AP-origin items. No account, entitlement or API response was tested here. Do not provision or purchase it as an implicit implementation step, and do not treat copies of the same AP item as independent reporting.

## Autonomous consensus acceptance rules

These are proposed deterministic guardrails around AI matching:

- Process a bounded rolling set of actual library fixtures, prioritising near-term marquee fixtures without allowing tags to affect follow eligibility. No tag, no AI key, no match or a failed fetch must leave the fixture visible.
- Restrict output to the six existing 3PC labels. Boring, Mid, Interesting, Cooking and Epic remain **user-rating** outputs; a reporter's use of “epic” cannot manufacture a user tag.
- Accept structural Final/Knockout/Round-Robin labels from the official round field without waiting for two reporters. Label provenance must identify this as a schedule fact rather than claim third-party consensus.
- For narrative Rivalry/Derby/Record Chase, require two independent publisher/original-reporting groups supporting the same fixture-level label, or retain the candidate as unaccepted. Use at least 0.7 calibrated confidence; the current renderer's 0.6 floor is not a reason to accept weak retrievals.
- Require exact fixture IDs supplied by the application. Model output cannot create new fixture IDs, athlete identities, publishers or evidence URLs. Check both teams/players plus sport, competition, relevant date or explicitly matching round. Broad athlete news, unrelated rounds, last year's derby and a team named Derby County are negative cases.
- Strip tracking fragments/parameters, collapse canonical article aliases and language translations, and account for original wire credit. `bbc.com`/`bbc.co.uk` count as one publisher. A syndicated AP story remains one origin even across several hosts. The same source URL cannot corroborate itself twice.
- Store accepted evidence URLs, checked-at and publication dates, publisher group, tag version and a concise machine decision. Do not display confidence, retrieval notes or source-count clutter on fixture cards; retain it in diagnostics.
- Preserve last-good accepted labels during a transient outage. Expire unsupported time-sensitive Record Chase claims at event completion or their stated validity boundary. New contradictory evidence can retract a label without removing the underlying card.
- Use HTTPS host allowlists on initial and redirected URLs; prohibit credentials, private/local destinations and arbitrary model-provided fetch targets. Apply byte/time limits and never execute publisher HTML or instructions embedded in it.

An immediate source-matching fixture is South Africa–New Zealand's September Test series: [Sky's 29 August report](https://www.skysports.com/rugby-union/news/12321/13578684/south-africa-33-26-new-zealand-cheslin-kolbe-stars-with-the-boot-as-springboks-level-series-in-cape-town) identifies the next Johannesburg Test, and the [official third-Test match report on BBC](https://www.bbc.co.uk/sport/rugby-union/articles/c7830m55lklo) was directly accessible. Use the actual dated records and permitted evidence route; a generic series description must not migrate to unrelated Rugby fixtures. The organiser's “Greatest Rivalry” branding is official context, not two independent reporting sources.

## Scheduling and acceptance evidence

Recommended cadence: one bounded discovery batch every six hours, increasing official entry-list checks to hourly in the final week; publisher discovery no more often than a permitted feed requires. Keep this separate from minute-by-minute score refresh inside the same canonical orchestration. Reuse leases/backoff/last-good snapshots; conditional ETag/Last-Modified requests where providers support them. Use per-provider request and AI-call budgets, cancellation/time limits and structured partial-health results. A malformed article must not abort all fixtures or every other source.

Required proof before calling the work complete:

1. Fixture-preservation, date-only card and source-outage tests pass.
2. Positive confirmed/provisional entries survive source → membership → Follow → card; explicit withdrawals exclude only that person/fixture link.
3. George/Georges/Karussell, Antonelli Motorsport, Nicolas/Lewis Hamilton, simulation/testing, stale articles, broad squads and speculation produce no false membership.
4. Consensus tests reject invented URLs, lookalike BBC domains, same-wire duplicates, wrong rounds, misleading Derby names and user-rating labels.
5. A scheduled real source fetch and a persisted discovery/consensus result are verified independently of mocked tests. A successful empty result can prove the discovery loop runs, but cannot be reported as discovery of a new real athlete entry.
6. Production health distinguishes configured coverage, rights-disabled sources, parser failures and no-evidence candidates. This bounded source audit does not establish worldwide athlete or reporting completeness.

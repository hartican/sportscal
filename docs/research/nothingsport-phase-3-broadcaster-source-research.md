# nothingSport Phase 3 broadcaster-source research

Research date: 13 August 2026
Scope: official/first-party broadcaster, platform, competition-owner and regulator sources only

## Recommendation

Do not make Phase 3 depend on scraping undocumented broadcaster endpoints. All eight priority Australian services expose useful consumer schedule or discovery surfaces, but no documented public API or export licence suitable for nothingSport's unattended commercial catalogue-building use was found.

Build the production adapters behind a provider-neutral contract and support four explicit operating modes:

1. `licensed_api` — unattended only after a written feed/API agreement covers retrieval, storage, transformation, attribution and display.
2. `reviewed_export` — an operator-reviewed, dated and checksummed export of public schedule facts; suitable for the weekly report, never represented as live API data.
3. `manual_fixture` — a small committed fixture derived from a first-party announcement or guide, mainly for regression and high-value exceptions.
4. `unavailable` — no sufficiently authoritative or permitted source; the adapter emits no candidates and reports why.

The safe initial Phase 3 release is `reviewed_export`/`manual_fixture`, with adapters ready to switch to `licensed_api`. Public broadcaster pages should be discovery and QA oracles. Official competition feeds remain fixture truth: a broadcaster listing proves promotion or apparent availability, not that its title, participants or start time should overwrite the canonical event.

## Australian source assessment

| Canonical source | First-party discovery surfaces | What they establish | Safe role now | Suggested refresh |
|---|---|---|---|---|
| `kayo` | [Kayo Fixtures](https://kayosports.com.au/help/s/article/Fixtures-on-Kayo), [sports/live-and-upcoming page](https://kayosports.com.au/sports), [content and rights overview](https://kayosports.com.au/en-AU/help/articles/31174073747357-what-content-is-available-as-part-of-my-kayo-subscription), [Main Event help](https://kayosports.com.au/help/s/article/Pay-Per-View-via-Main-Event-on-Kayo) | Fixtures are organised by sport/series and date but require sign-in and intentionally cover only selected popular sports. Kayo also carries partner channels, including ESPN, and separates Full Access, free-to-watch content and Main Event PPV. | `reviewed_export`; `manual_fixture` for Main Event. No public API was found. Do not automate signed-in consumer access. | Weekly breadth scan; daily next-seven-day review; same-day PPV recheck. |
| `foxtel` | [Foxtel TV Guide](https://www.foxtel.com.au/tv-guide.html/channel/Fox-Sports/FSS), [Sport Pack](https://www.foxtel.com.au/channel-packs/sports.html/), [MAIN EVENT](https://www.foxtel.com.au/watch/main-event.html) | Channel/program schedule, season label and a rolling guide window; Sport Pack is subscription-included; MAIN EVENT is separately purchased PPV and publishes card/main-card detail. | `reviewed_export`; `manual_fixture` for MAIN EVENT. A licensed EPG feed would be the preferred `licensed_api`. | Weekly full guide; daily next seven days; PPV at 72h and event day. |
| `stan_sport` | [Stan Sport schedule](https://www.stan.com.au/watch/sport), sport/competition pages such as [WRC](https://www.stan.com.au/watch/sport/motorsport/wrc) and [Premier League](https://www.stan.com.au/watch/sport/football/premier-league), [Stan Sport inclusions](https://help.stan.com.au/hc/en-us/articles/360002394415-What-s-included-in-Stan-Sport), [Stan PPV](https://help.stan.com.au/hc/en-us/articles/4413561972111-What-is-Pay-Per-View) | The strongest public AU schedule surface: sport, competition, round, participants, venue, broadcast start and event start are often visible months ahead. Stan Sport is an add-on to a base Stan plan; Stan PPV is an additional purchase. | `reviewed_export`; `manual_fixture` for PPV until written automation permission/API access exists. | Weekly season reconciliation; daily next seven days; PPV at 72h and event day. |
| `espn_au` | [ESPN Watch schedule](https://www.espn.com.au/watch/calendario) plus first-party AU distribution notices, for example [World Baseball Classic](https://www.espn.com.au/espn/story/_/id/48038354/world-baseball-classic-explained-everything-need-know-wbc), [WNBL](https://www.espn.com.au/nbl/story/_/id/46126354/every-wnbl-game-2025-26-live-espn-disney%2B-landmark-new-deal) and [ONE Championship](https://www.espn.com.au/mma/story/_/id/48255152/how-watch-one-championship-australia-new-zealand-espn-disney%2B) | ESPN is a channel/content network distributed through multiple AU services. The generic Watch schedule can mix ESPN, ESPN2, ESPN+ and other feeds, so it does not by itself prove availability through any specific Australian service. First-party AU articles identify the actual distributor set. | `reviewed_export`, but require an AU distributor assertion or licensed channel guide before `publish`; otherwise `review`. | Weekly scan; daily next seven days; distribution/rights recheck on material changes. |
| `sbs` / `sbs_on_demand` | [SBS live and upcoming sport](https://www.sbs.com.au/sport/how-to-watch-sport-on-sbs), [SBS On Demand guide](https://www.sbs.com.au/whats-on/guide), [guide/time-zone help](https://help.sbs.com.au/hc/en-au/articles/360002023135-Information-on-Live-Streaming-SBS-and-the-SBS-On-Demand-Guide) | Exact events, stages, times and whether coverage is on SBS, SBS VICELAND and/or SBS On Demand. The guide is device-time-zone aware, while the live stream follows the NSW schedule; some broadcast programs cannot be streamed because digital rights differ. | `reviewed_export`; a written SBS schedule feed could become `licensed_api`. Keep broadcast and streaming options separate. | Weekly breadth scan; daily next seven days; recheck 24h before air. |
| `nine` / `9now` | [9Now Sport](https://www.9now.com.au/shows/sport), [9Now live-event help](https://help.9now.com.au/hc/en-au/articles/34867420225305-Playing-live-events), live channel pages and competition pages such as [NRL 2026](https://www.9now.com.au/nrl-premiership/season-2026) | The sport hub is primarily a programme/episode catalogue, not a reliable forward event feed. Live pages expose current/up-next information; event pages confirm that a competition exists on 9Now. 9Now is free with a Nine account. | `manual_fixture` or operator `reviewed_export`; use an authorised EPG/rights-holder feed for automation. | Weekly rights/catalogue scan; daily next-seven-day TV/event review; event-day confirmation. |
| `seven` / `7plus` | [7plus Sport Hub guidance](https://support.7plus.com.au/hc/en-au/articles/7942590419213-How-can-I-find-out-what-sport-is-available-on-7plus), [live-stream guidance](https://support.7plus.com.au/hc/en-au/articles/32057021110285-Where-do-I-find-live-streams), Seven/7plus online TV guide | The Sport Hub explicitly provides current channels and upcoming live events, while the TV guide covers Seven broadcast channels. A compact guide appears on live streams. Some sport is restricted by state/territory. | `manual_fixture`/operator `reviewed_export` only unless Seven licenses a feed. | Weekly hub scan; daily next seven days; region and event-day recheck. |
| `paramount_plus_au` | [AU Live Events hub](https://www.paramountplus.com/au/shows/live-events/) and first-party competition-owner confirmations, including [A-Leagues partnership](https://aleagues.com.au/news/apl-announces-new-partnership-with-paramount-anz/), [2026/27 A-League fixtures](https://aleagues.com.au/news/aleague-men-2026-2027-fixture-list-revealed-key-dates-fixture-information/) and [Football Australia rights](https://footballaustralia.com.au/news/football-australia-and-paramount-australia-agree-historic-multi-year-multi-platform-media?page=7) | The public AU hub has little usable forward metadata. Competition owners supply much stronger fixture and platform facts. Paramount+ is subscription-included content; Network 10/10 Streaming simulcasts must be separate free options where explicitly stated. | `manual_fixture` from the competition owner; `unavailable` for unattended platform scanning without a licensed feed. | Weekly competition-owner reconciliation; daily next-seven-day checks in active competitions. |

### Usage constraints

The absence of a robots.txt prohibition or the technical visibility of JSON is not permission to build a production database. The published terms make the cautious adapter roles above necessary:

- [Foxtel's website terms](https://www.foxtel.com.au/content/dam/foxtel/shared/pdf/terms-of-use-march-2025.pdf) restrict the site to personal use and prohibit using, copying, adapting, publishing, communicating or reproducing content without written permission. Its [robots.txt](https://www.foxtel.com.au/robots.txt) requests a five-second crawl delay but does not grant content rights.
- Kayo links to Hubbl-group website and streaming terms. The published [website terms](https://www.kayosports.com.au/en-AU/help/articles/33915197057181-website-terms-of-use) grant personal use and prohibit reproducing site content without prior permission; the Fixtures UI also requires a signed-in account. Treat written permission as required before automation.
- [Nine's terms](https://login.nine.com.au/terms) permit personal, non-commercial use and prohibit using its material to maintain another website/publication without prior written approval.
- [Seven's terms](https://support.7plus.com.au/hc/en-au/article_attachments/27273316114445) restrict use to personal, non-commercial viewing and expressly prohibit copying, publishing or distributing data/content, including media-monitoring or cached datasets, without permission.
- [SBS's terms](https://www.sbs.com.au/aboutus/terms-and-conditions/) allow retrieval for personal, non-commercial purposes and prohibit reproduction, distribution or commercial exploitation. [SBS robots.txt](https://www.sbs.com.au/robots.txt) also disallows several On Demand playback/playlist paths.
- [Paramount+ AU terms](https://legal.paramount.com/au/en/pplus/termsofuse) explicitly prohibit robots, scrapers, retrieval applications, data mining, database storage and commercial reuse; its [robots.txt](https://www.paramountplus.com/robots.txt) disallows feed and internal schedule paths.
- ESPN's public AU schedule has no documented ingestion licence. Its published [site terms](https://www.espn.com.au/sitetools/s/terms2.html) prohibit commercial exploitation and redistribution of copyrighted material. Do not rely on undocumented schedule requests.
- Stan publishes useful schedule pages but no public API documentation or reuse licence was found. Lack of a discoverable prohibition is not a grant; use operator review until Stan provides written permission or a licensed feed.
- [Freeview's terms](https://freeview.com.au/terms-of-use) prohibit using its guide content to provide a third-party service, even though the [ACMA EPG principles](https://www.acma.gov.au/electronic-program-guides) require free-to-air broadcasters to make basic EPG information available to the public. Public availability and reuse permission are distinct.

## Source identity and normalisation

Do not collapse channel owner, distributor and viewing service into one `source` string. One ESPN programme can be available through Foxtel, Kayo, Disney+ and Fetch; a Fox Sports programme can appear on both Foxtel and Kayo; a Seven event can be both broadcast and streamed. Model these separately:

```text
BroadcasterListing
  sourceId                 # kayo, foxtel, stan_sport, espn_au, sbs, 9now, 7plus, paramount_plus_au
  sourceListingId?         # opaque, source-prefixed; never treated as canonical event ID
  sourceUrl
  observedAt
  scheduleTimeText
  scheduleTimeZone
  programmeStartsAtUtc?
  eventStartsAtUtc?
  timeConfidence           # exact, approximate, date_only, unknown
  rawTitle
  rawSport?
  rawCompetition?
  rawParticipants[]
  roundOrSession?
  channelBrand?            # ESPN, ESPN2, Fox League, SBS VICELAND, 7mate, etc.
  serviceId                # the actual user-selectable viewing service
  territory                # AU, or AU state/region when restricted
  accessType               # free, included, ppv, unknown
  liveOrReplay             # live, delayed, replay, highlights, unknown
  sourceMode               # licensed_api, reviewed_export, manual_fixture
  snapshotId
```

Normalisation rules:

1. Preserve broadcaster wording and source aliases, then match to canonical sport, competition, participant and event IDs. Never generate identity from a sponsored title alone.
2. Treat `LIVE`, replay, mini, highlights, preview and studio programming as different listing kinds. Only a live/delayed event listing may create a coverage candidate by default.
3. Keep programme start separate from event start. Stan commonly exposes both a coverage time and `Kick off`/`Starts`; Foxtel and linear EPGs often expose only programme start.
4. Store source time text, source time-zone/region and the derived UTC value. SBS states that its guide follows device time while its stream follows the NSW schedule; never assume every AU page is Sydney-local.
5. Never merge Kayo and Foxtel merely because both carry Fox Sports, or merge ESPN with a distributor. Deduplicate the canonical event while retaining every distinct `BroadcastOption`.
6. Version options instead of replacing them in place. Rights, free simulcasts, regional availability and PPV cards can change close to air time.

## Australian availability semantics

Apply the specification's four values to the event-specific option, not to the brand generally:

| Value | AU meaning | Examples and cautions |
|---|---|---|
| `free` | Watchable without an event or recurring subscription charge, although account registration and advertising may be required. | SBS/SBS On Demand, 9Now, 7plus, explicitly free Network 10/10 Streaming simulcasts, and specifically labelled Kayo free-to-watch content. Do not infer every Kayo listing is free. |
| `included` | Included in the user's paid recurring plan with no additional event charge. | Kayo Full Access, Foxtel Sport Pack, Stan Sport add-on, Paramount+ subscription, or ESPN through a named subscribed distributor. A base Stan plan alone does not include Stan Sport. |
| `ppv` | A one-off event purchase is required in addition to or independently of a recurring plan. | Foxtel/Kayo MAIN EVENT and Stan PPV. For UFC/combat events, store prelims and main card separately because the Foxtel MAIN EVENT page says UFC PPV includes the main card only. |
| `unknown` | The listing establishes promotion/coverage but not the user's actual access path or charge. | Generic ESPN schedules without an AU distributor, ambiguous FAST-channel listings, and a rights announcement that does not say which matches are free. |

`free` does not mean unauthenticated; `included` does not mean available on every plan; and a broadcaster's existence in Australia does not prove a particular listing is available in every state or territory.

## Matching and confidence guidance

Broadcaster listings should contribute evidence, not fixture truth. Suggested evidence weights before deterministic caps:

- 0.45: same normalised competition/series and source-owned competition alias.
- 0.25: both canonical participant IDs match; 0.12 for one participant.
- 0.15: start times within 15 minutes; 0.08 within two hours when programme/event starts differ.
- 0.10: round/session/venue agrees.
- 0.05: title-token agreement after removing `Live`, year, channel, sponsored and replay markers.

Hard caps:

- maximum 0.49 if the listing is a replay, highlights or studio programme;
- maximum 0.69 when the source establishes only a date or generic tournament day;
- maximum 0.79 when AU service/distributor identity is unresolved;
- no automatic match if participants conflict, territory excludes AU, or source time is stale.

Recommended actions: `publish` only for an existing canonical event with confidence at least 0.92 and an unambiguous AU option; `review` for 0.65–0.919 or any potentially new event; `ignore` below 0.65. A broadcaster-only provisional event must never bypass the editorial queue.

## Refresh and failure policy

Use the spec cadence as two nested jobs:

1. **Weekly breadth scan:** inspect the full discoverable window, reconcile competition coverage, and emit new long-tail candidates, catalogue gaps and rights changes.
2. **Daily rolling refresh:** recheck every listing in the next seven days, plus any unresolved high-value candidate. PPV, regional/free simulcast and programme/event-time details get a final 24-hour/event-day check.

Each adapter records `observedAt`, window start/end, source URL, mode, checksum and item count. Fail closed when a source becomes empty, unauthorised, structurally unrecognisable, older than its allowed cadence, or collapses materially versus its last good snapshot. Retain the last good snapshot for comparison but mark its availability evidence stale; never erase canonical events because a broadcaster page temporarily disappears.

An international source may discover a sport or event, but it must not create an AU `BroadcastOption`. Only an AU rights-holder, AU platform, competition-owner AU rights statement or licensed territorial feed can do that.

## Optional international discovery sources

These adapters are lower priority and must be territory-scoped. Their job is to reveal seasonal or long-tail events for review; they do not prove Australian availability.

| Canonical source | Official surface and territory | Safe role now | Suggested cadence |
|---|---|---|---|
| `eurosport` | Eurosport's consumer schedule is now tied to Warner Bros. Discovery's country-specific streaming products. The UK [discovery+ notice](https://support.discoveryplus.com/GB/Answer/Detail/000004067) says TNT Sports moved to HBO Max in March 2026, illustrating that platform identity and entitlements change by country. | `manual_fixture` from territory-specific event/rights announcements; otherwise `unavailable`. Prefer a licensed WBD schedule feed. | Weekly; recheck platform identity each season. |
| `canal_plus_fr` | [CANAL+ upcoming sport](https://www.canalplus.com/sport/rendez-vous-sport), [sport hub](https://www.canalplus.com/sport/) and [TV programme](https://www.canalplus.com/live-tv/programme-tv/) expose events, competitions and a rolling French guide. The catalogue can include third-party channels such as beIN SPORTS and Eurosport, so `channelBrand` must remain separate from CANAL+ as distributor. | `reviewed_export`; `licensed_api` only by agreement. Territory `FR` (or the explicitly selected CANAL+ country), never generic international. | Weekly, with daily next-seven-day refresh if licensed. |
| `tnt_sports_uk` | [TNT Sports live/schedule](https://www.tntsports.co.uk/watch/football/live/), [sport index](https://www.tntsports.co.uk/watch/sports.shtml) and first-party event guides such as [Glasgow 2026](https://www.tntsports.co.uk/commonwealth-games/2026/how-to-watch-daily-schedule-tnt-sports-hbo-max-streaming-details-athletics-swimming-netball-gymnastics_sto23319279/story.shtml) establish UK promotion and distribution. Current first-party help says TNT Sports moved from discovery+ to HBO Max in 2026. | `manual_fixture`/`reviewed_export`; prefer a licensed WBD feed. Territory `GB` only. | Weekly; daily during a promoted multi-sport event. |
| `dazn` | DAZN exposes country-local consumer schedule surfaces, including an Australian locale, but its rights vary by account country. [DAZN's AU terms](https://www.dazn.com/en-AU/help/articles/16391473315101-terms-and-conditions-of-use-17-july-2026) expressly prohibit page scraping, robots, automatic acquisition/monitoring and commercial use. | `unavailable` for automated public-page ingestion; `manual_fixture` only, or `licensed_api` under a commercial agreement. | Weekly manual review; licensed feed daily next seven days. |
| `bein_sports_au` | The official [beIN SPORTS Australia TV Guide](https://www.beinsports.com/en-au/tv-guide) exposes a rolling channel schedule with live markers and sport filters. Unlike other international sources, this `en-au` surface may support an AU option, but programme start still needs canonical fixture reconciliation and access/distributor confirmation. | `reviewed_export`; a licensed beIN/EPG feed is preferred for automation. | Weekly, daily next seven days, event-day recheck. |

No documented public production API suitable for nothingSport was found for these five sources. `Eurosport`, `TNT Sports` and `CANAL+` are discovery evidence for their named territories only. Keep all source IDs territory-qualified so an identical brand in another market cannot silently become Australian coverage.

## Production gate

Before changing an adapter to `licensed_api`, obtain written confirmation of:

- permitted automated request rate and schedule window;
- storage duration for raw and normalised listings;
- permission to match, transform, display and retain historical rights changes;
- territory, channel, service, plan/free/PPV and regional fields;
- stable listing/channel identifiers, UTC or explicit time-zone data, late changes and cancellations;
- attribution/link-back requirements;
- sandbox or sanitised fixtures that can be committed without credentials or confidential endpoints.

Credentials, account cookies, DRM/player endpoints and subscriber-only responses must never enter the repository or client. The weekly coverage report should expose source mode and freshness so editorial review never mistakes a manual snapshot for a live feed.

## Implementation decision

Phase 3 can safely ship the candidate schema, provider-neutral adapters, reviewed fixture imports, deterministic matching, freshness gates and publish/review/ignore queue now. Start with Stan Sport, SBS, Foxtel MAIN EVENT and competition-owner Paramount+ confirmations because their public sources provide the clearest event-level facts; use Kayo, ESPN, 9Now and 7plus as corroborating or manually reviewed discovery until licensed feeds are available.

For durable unattended breadth, the smallest external handoff is a single procurement/integration issue covering licensed AU EPG/OTT schedule access. It should record source owners, allowed fields/use, credentials location outside Git, sample-fixture approval and the adapter acceptance test. Do not create separate scraping work for each consumer site.

## Paid and licensed source options

Public schedules are enough to prove the workflow but not enough for reliable unattended breadth. The commercial market splits into three materially different products: fixture truth, linear EPG, and streaming “where to watch”. A sports API does not automatically include Australian broadcast rights, and an EPG slot must not silently replace the canonical sporting start time.

### Best-fit shortlist

| Priority | Supplier | Verified fit | What it does not prove | Access and price |
|---:|---|---|---|---|
| 1 | [YuVu](https://yuvu.tv/syndication/) | Independently curated commercial Australian free-to-air EPG covering metro and regional markets. Its [FAQ](https://yuvu.tv/frequently-asked-questions/) says TV-guide applications are permitted, and its [integration page](https://yuvu.tv/integrations/) describes API access. | No Foxtel Pay TV; several datacast, religious and horse-racing channels are excluded. It does not provide canonical multi-sport fixture truth or full OTT availability. | Contact sales. A sample/test feed is available after approval; exact schema and commercial terms are supplied privately. |
| 2 | [Gracenote On API](https://documentation.gracenote.com/on-api/index.html) / Global Video Data | Strongest potential enterprise contract for channel lineups, linear schedules, sport-event identity and streaming/linear availability. On API advertises thousands of channels, 260+ streaming catalogues and live sports “Where to Watch” data; [sports airing endpoints](https://developer.sports.gracenote.com/io-docs) support lineup-scoped live events up to 14 days ahead. | Exact Kayo, Foxtel, Stan, ESPN, 9Now, 7plus and Paramount+ AU inventory is entitlement-specific and not publicly enumerated. General VOD availability cannot be assumed to cover sport. | Commercial tiers are contact-sales and entitlement controlled. A small public OnConnect plan exists for evaluation; subscription-only On Sports requires a representative. |
| 3 | [JustWatch Sports Widget](https://apis.justwatch.com/docs/sports_widget/) | Public documentation says the widget combines fixtures with event-level broadcast/streaming offers, highlights and replays, updated several times daily. The Partner API supports the `en_AU` locale. | Public documents do not enumerate Australian sport/competition coverage, and no raw event-level sports export/API is documented; the verified integration is a branded widget. | Partner agreement and token required; pricing and trial terms are not public. Country access is allowlisted and branding/link rules apply. |
| 4 | [Sportradar Media APIs](https://sportradar.com/media-tech/data-content/sports-data-api/?lang=en-us) | Broad fixture/competition truth: 80+ sports, 500+ leagues and 750,000+ annual events with JSON/XML feeds. AFL/AFLW entities and schedules are directly documented. A standard 30-day trial and sandbox are advertised. | Does not by itself establish Australian viewing service, access type or broadcast rights. Exact current NRL and long-tail coverage must be checked in the contracted coverage matrix. | Production is contact-sales; order-form scope controls display, redistribution, imagery and data rights. |
| 5 | [Stats Perform / Opta](https://www.statsperform.com/products/opta-data-feeds/) | Structured fixture and live data across 20+ sports and 3,900+ competitions. Stats Perform publicly identifies official-data relationships with NRL, Rugby Australia and A-Leagues. Delivery can be REST, WebSocket, push/pull or S3 in JSON/XML. | No verified all-sport AU “where to watch” feed and no AFL coverage confirmation was found in the reviewed first-party material. | Demo and production pricing require sales. Exact competition entitlements and public-display permissions are contractual. |

### Other vendors worth testing, not yet shortlisted

| Supplier | Verified possibility | Material uncertainty |
|---|---|---|
| [Simply.TV](https://www.simply.tv/products/video-metadata) | Linear EPG, event IDs, sports metadata, API/push delivery and streaming metadata from 250+ services across a claimed 100+ countries. A self-service trial provides a small live metadata sample. | The reviewed material does not name Australia or enumerate AU channels/services. Require a manifest before integration work. |
| [EPG Service](https://epgservice.tv/en/) | REST/OpenAPI JSON, XMLTV, webhooks and exports; free sandbox; 4,000 channels across 60 countries. Public pricing starts around US$300/month for operator EPG, US$200/month for digital guides, with sports metadata separately priced. | Australia is not publicly identified, so the prices are useful as a benchmark rather than proof of usable AU coverage. |
| [SportsDataIO Global Sports API](https://sportsdata.io/developers) | Consistently shaped schedules and scores across 100+ sports, suited to catalogue breadth. | Contact-sales commercial agreement, no self-serve trial and no broadcaster/availability layer. |
| [TiVo Metadata](https://business.tivo.com/products-solutions/metadata) | Linear, Live OTT and sports metadata via API/FTP with up to 14-day schedules and sample data. | Public product sheets focus on US broadcasters/services; no current Australian lineup inventory was verified. |
| [Red Bee Managed OTT](https://redbee.live/docs/Features/EPG/) | Ingests XMLTV, TV-Anytime or Red Bee JSON and can add a separately contracted Content Discovery service. | This is primarily a managed platform/integration route, not a verified source of Australian schedule data. |

Commercial rights-intelligence products such as GlobalData’s Media Revenues Database and Omdia’s Sports Rights Database can help analyse deals and expiry windows, but their public material does not establish event-level schedules suitable for cards. They belong in procurement/market intelligence, not the live adapter path.

### Recommended procurement test

Run one identical 30-day sample brief across YuVu, Gracenote and JustWatch, then trial Sportradar separately for canonical IDs and reschedules. Ask Stats Perform for a second fixture quote only where official AU competition provenance matters, initially NRL, Rugby Australia and A-Leagues.

The sample must cover AFL/AFLW, NRL/NRLW, cricket, rugby, A-Leagues, tennis, Formula 1 and at least five seasonal/long-tail sports, and name the inventory for ABC, SBS, Seven/7plus, Nine/9Now, Ten/Paramount+, Foxtel/Kayo, Stan Sport, Optus Sport, ESPN/Disney+, Prime Video, beIN and DAZN. Required fields are event ID, competition, participants, canonical and broadcast UTC times, confirmed/unconfirmed flag, live/replay/highlights, channel, service, territory, access type or entitlement, deep link, blackout/rights flags, updated time and provenance.

The commercial contract must explicitly permit public PWA display, caching, normalization, derived ID mappings, retained rights history, notifications, screenshots/social sharing and use across owned domains. It must say whether nothingSport may keep a normalized server-side cache/API or only render supplier-controlled responses. Compare supplier output against the same canonical fixture set; do not judge coverage from a sales demo alone.

### Recommended paid architecture

Use three replaceable contracts rather than looking for one magical feed:

1. **Fixture truth:** existing official competition feeds, Sportradar or Stats Perform.
2. **Australian linear availability:** YuVu first; Gracenote if pay-TV and broader lineups justify the enterprise contract.
3. **Streaming availability:** JustWatch’s sports product or a specifically demonstrated Gracenote On Sports entitlement.

The Phase 3 adapter contract already supports this split through separate `sourceId`, `serviceId`, `territory`, `sourceMode`, programme start and event start fields. Switching a source to `licensed_api` therefore changes provenance and freshness, not the candidate or editorial model.

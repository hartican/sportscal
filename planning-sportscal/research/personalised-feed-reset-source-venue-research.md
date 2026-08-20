# Personalised Feed Reset — source and venue research

**Research date:** 21 August 2026 (Australia/Sydney)
**Scope:** the 58 currently unaudited strings returned by `config/venue-registry.js` for `data/events.json`, plus publicly accessible Cincinnati Open detail sources beyond the three official pages already approved in the product specification.

## Recommended decisions

1. Do not turn every input string into a venue alias. Six are competition, route or place placeholders and three more are unsupported or contradicted event locations. Give route entities a separate `place`/`route` type; resolve placeholders from the event's authoritative fixture; quarantine contradicted records.
2. Keep three names separately: immutable canonical venue identity, user-facing common name, and time-bounded official/sponsor name. FIFA's tournament-only labels belong in aliases, not in `officialName`.
3. Context-resolve broad inputs such as `Cincinnati, USA`, `Honolulu, Hawaii`, `Fort William` and `Margaret River, Western Australia` to the event site. Never globally equate a city with one venue.
4. Cincinnati can be enriched without bypassing access controls from the tournament site, ATP, WTA, USTA, Tennis Abstract and mainstream reporting. Treat official tournament/ATP/WTA/USTA data as verified; label publisher reporting and analytical sites `Unverified source` in the MVP.
5. Before adding the 58 mappings, fix the existing `jubilee-stadium` registry entry: ENGIE Stadium (Sydney Showground) and Netstrata Jubilee Stadium (Kogarah) are different venues and must never share one canonical ID. [AFL venue evidence](https://www.afl.com.au/venues/8) and [Georges River venue evidence](https://www.georgesriver.nsw.gov.au/StGeorge/files/e8/e8f356ef-9fe7-42f4-b03e-9d017e57237b.pdf).

## Venue audit

### Disposition legend

- **Add** — safe canonical venue mapping.
- **Alias** — add to an existing/new canonical identity, not as a separate venue.
- **Resolve** — derive the venue from event context; never use the broad string as a global alias.
- **Place/route** — valid geography but not a venue; move to a typed route/place field.
- **Quarantine** — present event/location evidence is unsupported or contradicted; do not publish or normalise until corrected.

The recommended display name is deliberately colloquial only where authoritative or strongly established usage exists. Otherwise it repeats the stable venue name rather than inventing a nickname.

| Pending input | Canonical identity / suggested ID | Common display | Current official or sponsor name | Disposition and evidence |
|---|---|---|---|---|
| `2026 NBA Finals` | Per-game venue, not one identity | Per-game arena | 2026 series used Frost Bank Center and Madison Square Garden | **Resolve.** Competition placeholder; use home-team/game data. [NBA Finals](https://www.nba.com/playoffs/2026/nba-finals), [NBA game notes](https://pr.nba.com/2026-nba-finals-game-notes/) |
| `Adelaide Oval` | Adelaide Oval / `adelaide-oval` | Adelaide Oval | Adelaide Oval | **Add.** [AFL venue](https://www.afl.com.au/venues/31) |
| `Adelaide Oval, Adelaide` | Adelaide Oval / `adelaide-oval` | Adelaide Oval | Adelaide Oval | **Alias.** Same venue as above. [AFL venue](https://www.afl.com.au/venues/31) |
| `Albert Park Grand Prix Circuit, Melbourne` | Albert Park Circuit / `albert-park-circuit` | Albert Park | Albert Park Grand Prix Circuit | **Add.** [FIA 2026 event document](https://www.fia.com/system/files/decision-document/2026_australian_grand_prix_-_competition_visa.pdf) |
| `Atlanta Stadium` | Mercedes-Benz Stadium / `mercedes-benz-stadium` | Mercedes-Benz Stadium | Mercedes-Benz Stadium | **Alias.** FIFA tournament label only. [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums), [venue](https://www.mercedesbenzstadium.com/) |
| `Augusta National Golf Club` | Augusta National Golf Club / `augusta-national` | Augusta National | Augusta National Golf Club | **Add.** [Masters official site](https://www.masters.com/) |
| `BC Place Vancouver` | BC Place / `bc-place` | BC Place | BC Place | **Alias.** FIFA location suffix. [BC Place](https://www.bcplace.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Belfort` | Belfort stage finish / typed place ID | Belfort | Not applicable | **Place/route.** A Tour stage endpoint, not a venue alias. [Tour stage 13](https://www.letour.fr/en/heritage/stage-13) |
| `Boston Stadium` | Gillette Stadium / `gillette-stadium` | Gillette Stadium | Gillette Stadium | **Alias.** FIFA tournament label. [City of Boston confirmation](https://www.boston.gov/news/have-fifa-world-cuptm-event-plans-let-us-know), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Brisbane Stadium` | Lang Park / `lang-park` | Lang Park | Suncorp Stadium | **Alias** to the existing Lang Park identity; here the event is Australia v France rugby, not a generic city venue. [venue history](https://suncorpstadium.com.au/about/history-and-honours/history-wall) |
| `Chalon-sur-Saône` | Chalon-sur-Saône stage place / typed place ID | Chalon-sur-Saône | Not applicable | **Place/route.** Tour start/finish locality, not a stadium. [Tour route](https://www.letour.fr/en/route) |
| `Cincinnati, USA` | Lindner Family Tennis Center / `lindner-family-tennis-center` | Cincinnati Open | Lindner Family Tennis Center, Mason, Ohio | **Resolve.** City/brand input must be event-scoped, not a global city alias. [tournament FAQ](https://cincinnatiopen.com/visit/faqs/), [campus](https://cincinnatiopen.com/about/campus-transformation/) |
| `Circuit de la Sarthe, Le Mans` | Circuit des 24 Heures du Mans / `circuit-24-heures-du-mans` | Le Mans | Circuit des 24 Heures du Mans | **Alias.** “Circuit de la Sarthe” is common English usage. [official regulations](https://assets.lemans.org/explorer/pdf/courses/2026/24-heures-du-mans/regulations/2026-24-hours-of-le-mans-supplementary-regulations.pdf), [official access](https://www.24h-lemans.com/fr/info/acces-circuit) |
| `Dallas Stadium` | AT&T Stadium / `att-stadium` | AT&T Stadium | AT&T Stadium | **Alias.** FIFA tournament label. [Cowboys venue](https://www.dallascowboys.com/stadium/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Davos, Switzerland` | No supported venue | Davos | Not applicable | **Quarantine.** The seeded “Telemark World Cup Finals” date/location is not on the official 2025–26 calendar; the finals were at Les Contamines in March 2026. [FIS calendar](https://www.fis-ski.com/DB/telemark/calendar-results.html?categorycode=WC&seasoncode=2026&seasonmonth=X-2026&sectorcode=TM), [FIS finals report](https://www.fis-ski.com/telemark/news/2025-26/eriksen-michel-carliez-and-rostolan-crowned-as-crystal-globe-dreams-realised-in-les-contamines-finale) |
| `Estadio 23 de Agosto, San Salvador de Jujuy` | Estadio 23 de Agosto / `estadio-23-de-agosto` | 23 de Agosto | Estadio 23 de Agosto | **Add.** The nickname “La Tacita de Plata” is widely reported but not needed without a first-party source. [Copa Argentina venue](https://www.copaargentina.org/es/sedes/42_Estadio-23-de-Agosto.html), [club](https://www.gyejoficial.com.ar/) |
| `Estadio Malvinas Argentinas, Mendoza` | Estadio Malvinas Argentinas / `estadio-malvinas-argentinas` | Malvinas Argentinas | Estadio Malvinas Argentinas | **Add.** [Mendoza government](https://www.mendoza.gov.ar/prensa/el-malvinas-argentinas-cumple-36-anos/) |
| `Fort William` | Nevis Range downhill track, Aonach Mòr / `nevis-range-downhill` | Fort William | Nevis Range Mountain Experience | **Resolve.** Correct for the MTB event only; do not map all Fort William events globally. [UCI event book](https://ucimtbworldseries.com/content/22445/01HWYNKNCVC735V2PFGMTE2YH7.pdf), [Nevis Range](https://www.nevisrange.co.uk/event/ixs-european-cup-nevis-range/) |
| `Glen Willow Oval` | Glen Willow Regional Sports Stadium / `glen-willow-stadium` | Glen Willow | Club Mudgee Stadium | **Alias.** Naming sponsorship changed in April 2026. [Mid-Western Regional Council](https://www.midwestern.nsw.gov.au/Council/Media-and-news/Latest-news/Council-secures-naming-sponsor-for-stadium) |
| `Go Media Stadium` | Mt Smart Stadium / `mt-smart-stadium` | Mt Smart | Go Media Stadium Mt Smart | **Alias.** [Auckland Stadiums naming announcement](https://www.aucklandstadiums.co.nz/about-us/go-media-secures-mt-smart-stadium-naming-rights), [extension](https://www.aucklandstadiums.co.nz/news/go-media-extend-naming-rights-partnership-with-go-media-stadium) |
| `Goodwood Estate, UK` | Goodwood Estate hillclimb / `goodwood-estate` | Goodwood | Goodwood Estate | **Add.** Event site is the Goodwood House hillclimb, not Goodwood Motor Circuit. [Goodwood](https://www.goodwood.com/), [Festival of Speed access](https://www.goodwood.com/motorsport/festival-of-speed/getting-here/) |
| `Great Barrier Reef Arena, Mackay` | Ray Mitchell Oval at Harrup Park / `ray-mitchell-oval` | Harrup Park | Great Barrier Reef Arena | **Add.** Preserve precinct and field aliases. [venue](https://reefarena.com.au/), [community/history](https://reefarena.com.au/community/) |
| `Hanazono Rugby Stadium, Osaka` | Higashiosaka Hanazono Rugby Stadium / `hanazono-rugby-stadium` | Hanazono | Higashiosaka Hanazono Rugby Stadium | **Alias.** Use Higashiosaka rather than broad Osaka in the canonical address. [Higashiosaka city](https://www.city.higashiosaka.lg.jp/category/21-14-1-0-0-0-0-0-0-0.html), [J.League venue](https://www.jleague.jp/en/club/fosaka/) |
| `Honolulu, Hawaii` | Banzai Pipeline at ʻEhukai Beach Park / `banzai-pipeline` | Pipeline | ʻEhukai Beach Park, North Shore Oʻahu | **Resolve.** The “Pipe Masters” event site is not in Honolulu proper; keep Honolulu only as an input/provenance value. [Hawaiʻi tourism](https://www.gohawaii.jp/islands/oahu/things-to-do/beaches/ehukai-beach-park-banzai-pipeline) |
| `Houston Stadium` | NRG Stadium / `nrg-stadium` | NRG Stadium | NRG Stadium | **Alias.** FIFA tournament label. [venue](https://www.nrgpark.com/nrg-stadium/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Kansas City Stadium` | Arrowhead Stadium / `arrowhead-stadium` | Arrowhead | Arrowhead Stadium | **Alias.** FIFA label; the Chiefs restored the Arrowhead name for the 2026 season. [Chiefs announcement](https://www.chiefs.com/news/chiefs-and-g-e-h-a-announce-return-of-arrowhead-stadium-branding-beginning-with-2026-season), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Kvitfjell, Norway` | Olympiabakken at Kvitfjell / `kvitfjell-olympiabakken` | Kvitfjell | Olympiabakken | **Resolve.** Ski course/event site, not the municipality as a universal venue. [FIS homologation](https://www.fis-ski.com/DB/general/homologations.html?homologationcode=15104%2F11%2F23&homologationtype=DET&sectorcode=AL), [organiser](https://worldcupkvitfjell.no/en/opplev-world-cup-i-kvitfjell) |
| `Le Markstein` | Le Markstein Fellering stage finish / typed place ID | Le Markstein | Not applicable | **Place/route.** Tour summit/finish place, not a stadium. [Tour stage 14](https://www.letour.fr/en/stage-14) |
| `Levi's Stadium, Santa Clara` | Levi's Stadium / `levis-stadium` | Levi's Stadium | Levi's Stadium | **Add/Alias.** Same identity as FIFA’s `San Francisco Bay Area Stadium`. [venue](https://www.levisstadium.com/) |
| `Los Angeles Stadium` | SoFi Stadium / `sofi-stadium` | SoFi Stadium | SoFi Stadium | **Alias.** FIFA tournament label. [venue](https://www.sofistadium.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Margaret River, Western Australia` | Surfers Point / Main Break / `margaret-river-main-break` | Main Break | Surfers Point, Prevelly | **Resolve.** Event-specific primary site; The Box and Southsides can be alternate break IDs, not aliases for Main Break. [Margaret River Region](https://www.margaretriver.com/things-to-do/attractions/surfing/doing-the-margaret-river-pro/), [shire](https://www.amrshire.wa.gov.au/shire-and-council/news/what-locals-need-to-know-about-the-pro) |
| `Marrakech to Ouarzazate` | No valid 2026 Dakar route identity | — | — | **Quarantine.** Official Dakar 2026 ran a Yanbu-based Saudi Arabia route; the seeded Morocco Stage 11 conflicts with the organiser. [Dakar](https://www.dakar.com/en/) |
| `Marrara Cricket Ground, Darwin` | Marrara Cricket Ground / `marrara-cricket-ground` | Marrara | Marrara Stadium | **Alias.** Treat DXC Arena as a historical sponsor alias only unless a current agreement is sourced. [Cricket Australia venue](https://www.cricket.com.au/tickets/venues/marrara-stadium), [NT Government history](https://newsroom.nt.gov.au/mediaRelease/34310) |
| `McDonald Jones Stadium` | Newcastle International Sports Centre / `newcastle-stadium` | Newcastle Stadium | McDonald Jones Stadium | **Add.** Preserve Marathon Stadium and EnergyAustralia Stadium as historical aliases. [venue history](https://www.mcdonaldjonesstadium.com/stadium_history), [Venues NSW](https://www.venuesnsw.com/our-venues/mcdonald_jones_stadium) |
| `Mexico City Stadium` | Estadio Azteca / `estadio-azteca` | the Azteca | Estadio Banorte; FIFA tournament label Estadio Ciudad de México | **Alias.** Store the FIFA label as time-bounded. [Mexico City government](https://mexicocity.cdmx.gob.mx/venues/estadio-banorte/?lang=en), [current venue](https://www.estadiobanorte.com.mx/en), [Banorte announcement](https://www.banorte.com/GFB/Noticias-GFB/Mexico-tendra-uno-de-los-estadios-mas-modernos) |
| `Miami Stadium` | Hard Rock Stadium / `hard-rock-stadium` | Hard Rock Stadium | Hard Rock Stadium | **Alias.** FIFA tournament label. [venue](https://www.hardrockstadium.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Nairobi to Malindi` | No verified 2027 Safari route identity | — | — | **Quarantine.** It is a route, not a venue, and the official 2026 Safari was centred on Naivasha with no Nairobi start. Do not project an unsourced 2027 route. [WRC Safari](https://www.wrc.com/en/events/wrc-safari-rally-kenya-2026) |
| `Nazaré, Portugal` | Praia do Norte / `praia-do-norte` | Nazaré | Praia do Norte | **Resolve.** Big-wave event site; Nazaré remains the town alias/context. [municipality](https://www.cm-nazare.pt/visitar/praias-do-concelho), [Visit Portugal](https://www.visitportugal.com/en/content/praia-do-norte-nazare) |
| `New York New Jersey Stadium` | MetLife Stadium / `metlife-stadium` | MetLife Stadium | MetLife Stadium | **Alias.** FIFA tournament label. [venue](https://www.metlifestadium.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `North Sydney Oval` | North Sydney Oval / `north-sydney-oval` | North Sydney Oval / Bear Park | North Sydney Oval | **Add.** “Bear Park” is club usage; keep sport-context display optional. [North Sydney Council history](https://www.northsydney.nsw.gov.au/north-sydney-oval/history-upgrades-1), [North Sydney Bears](https://www.northsydneybears.com.au/the-club/) |
| `People First Stadium, Gold Coast` | Carrara Stadium / `carrara-stadium` | Carrara | People First Stadium | **Add.** Preserve Metricon Stadium and Heritage Bank Stadium as historical aliases. [venue FAQ](https://peoplefirststadium.com.au/plan-your-visit/frequently-asked-questions), [Suns media guide](https://resources.goldcoastfc.com.au/aflc-gcfc/document/2026/03/02/2bf3748f-20ad-48a7-805e-94e898fd381d/2026-AFL-Media-Guide.pdf) |
| `Philadelphia Stadium` | Lincoln Financial Field / `lincoln-financial-field` | the Linc | Lincoln Financial Field | **Alias.** FIFA tournament label. [venue](https://www.lincolnfinancialfield.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Principality Stadium, Cardiff` | Millennium Stadium / `millennium-stadium` | Millennium Stadium | Principality Stadium | **Add.** Keep the historical/common identity and current commercial name separately. [venue history](https://www.principalitystadium.wales/2019/06/26/20-years-of-economic-output-to-celebrate/) |
| `SEC Armadillo` | SEC Armadillo / `sec-armadillo` | the Armadillo | SEC Armadillo | **Add.** A distinct venue inside the SEC campus. [Glasgow 2026 SEC](https://www.glasgow2026.com/venues/sec) |
| `San Francisco Bay Area Stadium` | Levi's Stadium / `levis-stadium` | Levi's Stadium | Levi's Stadium | **Alias.** FIFA tournament label; merge with the `Levi's Stadium, Santa Clara` row. [venue](https://www.levisstadium.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Scotstoun Stadium` | Scotstoun Stadium / `scotstoun-stadium` | Scotstoun | EDF Scotstoun Stadium during Glasgow 2026 | **Add.** Treat sponsor naming as time-bounded. [Glasgow 2026](https://www.glasgow2026.com/venues/Scotstoun) |
| `Scottish Event Campus` | SEC campus / `sec-campus` | the SEC | Scottish Event Campus | **Resolve.** Parent campus, not a sports hall. Resolve event records to SEC Centre, SEC Armadillo or The Hydro. [SEC](https://www.sec.co.uk/), [Glasgow 2026 SEC](https://www.glasgow2026.com/venues/sec) |
| `Seattle Stadium` | Lumen Field / `lumen-field` | Lumen Field | Lumen Field | **Alias.** FIFA tournament label. [venue](https://www.lumenfield.com/), [FIFA address mapping](https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784010437021-2-What-are-the-official-addresses-stadium-capacities-and-maps-of-the-FIFA-World-Cup-2026-stadiums) |
| `Shahdag, Azerbaijan` | Shahdag FIS Stadium / `shahdag-fis-stadium` | Shahdag | Shahdag FIS Stadium | **Resolve, with event-date validation.** The site is real, but the 2026 World Cup was cancelled; verify the seeded future event separately. [venue](https://www.shahdag.az/en/shahdag-fis-stadium), [FIS cancellation](https://www.fis-ski.com/freestyle/news/moguls-aerials-2025-26/fis-moguls-world-cup-event-in-shahdag-azerbaijan-cancelled) |
| `Silverstone Circuit` | Silverstone Circuit / `silverstone-circuit` | Silverstone | Silverstone Circuit | **Add.** [Silverstone](https://www.silverstone.co.uk/), [British GP agreement](https://www.silverstone.co.uk/news/silverstone-confirmed-home-formula-1-british-grand-prix-until-2034) |
| `Sir Chris Hoy Velodrome` | Sir Chris Hoy Velodrome / `sir-chris-hoy-velodrome` | Chris Hoy Velodrome | Sir Chris Hoy Velodrome | **Add.** Distinct venue in the Glasgow International Arena complex. [Glasgow 2026](https://www.glasgow2026.com/venues/sir-chris-hoy-velodrome-and-arena) |
| `Sun Valley, Idaho` | Challenger course, Bald Mountain / `sun-valley-challenger` | Sun Valley / Challenger | Challenger course at Sun Valley Resort | **Resolve, with event-date validation.** Correct course identity; future competition date still needs first-party confirmation. [Sun Valley Resort](https://www.sunvalley.com/blog/news/svworldcup/) |
| `The Arena` | Glasgow International Arena / `glasgow-international-arena` | Glasgow International Arena | Glasgow International Arena; formerly Emirates Arena | **Resolve.** In this dataset it is the Glasgow 2026 gymnastics venue, not a reusable generic alias. [Glasgow 2026](https://www.glasgow2026.com/venues/sir-chris-hoy-velodrome-and-arena), [Glasgow Life naming update](https://www.glasgowlife.org.uk/about-us/colleague-information/colleague-updates/glasgow-2026-commonwealth-games-venues-update) |
| `The Hydro` | The Hydro / `the-hydro` | the Hydro | OVO Hydro; sponsor-free Glasgow 2026 label “The Hydro” | **Add.** Store OVO Hydro as the present commercial name and tournament label separately. [SEC](https://www.sec.co.uk/), [Glasgow 2026 SEC](https://www.glasgow2026.com/venues/sec) |
| `Tollcross International Swimming Centre` | Tollcross International Swimming Centre / `tollcross-swimming-centre` | Tollcross | Tollcross International Swimming Centre | **Add.** [Glasgow 2026 venue guide](https://www.glasgow2026.com/venues) |
| `Tour de France 2026` | No venue identity | — | — | **Resolve.** Competition placeholder; use that stage's start, finish and route entities. [official route](https://www.letour.fr/en/route) |
| `UTAS Stadium, Launceston` | York Park / `york-park` | York Park | UTAS Stadium | **Add.** [City of Launceston](https://www.launceston.tas.gov.au/News-Media/UTAS-Stadium-transfer-Frequently-Asked-Questions) |
| `WIN Stadium` | Wollongong Showground / `wollongong-showground` | WIN Stadium | WIN Stadium | **Add.** WIN is both established display and current sponsor name; avoid inventing another nickname. [Destination Wollongong](https://www.visitwollongong.com.au/operators/attraction/entertainment-venues/win-stadium/) |

### Audit totals

The 58 inputs result in:

- 40 safe **Add/Alias** records;
- 11 context-dependent **Resolve** records (including course, break and event-specific sites);
- 4 **Place/route or competition-placeholder** records that should not enter the venue registry (`Belfort`, `Chalon-sur-Saône`, `Le Markstein`, `Tour de France 2026`);
- 3 explicit **Quarantine** records (`Davos`, `Marrakech to Ouarzazate`, `Nairobi to Malindi`);

These total all 58 pending strings. They describe input dispositions, not the number of new canonical venue objects: several inputs intentionally collapse to one identity, including the two Adelaide Oval strings and the two Levi's Stadium/FIFA strings.

## Cincinnati Open public-source options

### Recommended hierarchy

1. Cincinnati Open's own Rain Digital JSON feeds for schedule, court order, live state and draws/results.
2. Cincinnati Open's WordPress API for official previews, recaps, interviews, video posts and other commentary.
3. WTA official tournament metadata and women's highlights; ATP official pages for human/browser corroboration.
4. ESPN's embedded scoreboard JSON as the best combined unverified fallback.
5. Tennis Abstract, Tennis.com, Tennis TV, other broadcasters and syndicated reporting only as labelled secondary enrichment.

Every field should retain `sourceUrl`, `sourceOwner`, `trustClass`, `retrievedAt` and `sourceRecordId`. A lower-trust source must not overwrite a conflicting official fixture, court, time or result.

### Source and access table

“Direct” below means a normal unauthenticated HTTP GET succeeded during this audit. It does not mean that republication rights were established.

| Source/page | Owner | Best use | Trust classification | Direct fetch without bypass | Parser seam and limitations |
|---|---|---|---|---|---|
| [Mixed ATP/WTA order of play](https://tennis-feeds.rain-digital.ca/get/cincinnati/oop-mixed), plus [ATP live](https://tennis-feeds.rain-digital.ca/get/atp/cincinnati/live), [WTA live](https://tennis-feeds.rain-digital.ca/get/wta/cincinnati/live), [ATP OOP](https://tennis-feeds.rain-digital.ca/get/atp/cincinnati/oop), [WTA OOP](https://tennis-feeds.rain-digital.ca/get/wta/cincinnati/oop), [ATP draws](https://tennis-feeds.rain-digital.ca/get/atp/cincinnati/draws), [WTA draws](https://tennis-feeds.rain-digital.ca/get/wta/cincinnati/draws) | Rain Digital, embedded and consumed by Cincinnati Open | Canonical daily court sequence, timing qualifier, match IDs, live/results and draws | **Verified, first-party-integrated** | **Yes: HTTP 200 JSON**, no login/cookie. The Cincinnati [Scores page](https://cincinnatiopen.com/score-center/scores/) declares `feed_ip = 'https://tennis-feeds.rain-digital.ca'` and `tournament = 'cincinnati'`. | Best automated seam. Current-edition endpoint may roll over rather than archive. Cache each successful retrieval with timestamp and source URL. |
| [Scores](https://cincinnatiopen.com/score-center/scores/), [Results](https://cincinnatiopen.com/score-center/results/), [Daily Draw Sheet](https://cincinnatiopen.com/tournament/daily-draw-sheet/), [Players](https://cincinnatiopen.com/tournament/players/) | Cincinnati Open | Official index, result PDFs, player/rank enrichment | **Verified, first party** | **Yes: HTTP 200 HTML**. | WordPress HTML. Scores points to the Rain feeds. Results exposes a `<score-results-day>` custom element whose `pdf` attribute is HTML-encoded JSON containing `file` and `button_text` for ATP/WTA singles, doubles and qualifying PDFs. Page JSON-LD is page metadata, not match data. |
| [WordPress posts API](https://cincinnatiopen.com/wp-json/wp/v2/posts?per_page=20&_fields=id,date,modified,link,slug,title,excerpt,content,categories), [categories API](https://cincinnatiopen.com/wp-json/wp/v2/categories?per_page=100&_fields=id,name,slug,count), [Recaps API](https://cincinnatiopen.com/wp-json/wp/v2/posts?categories=27&per_page=20&_fields=id,date,modified,link,slug,title,excerpt,content), [news index](https://cincinnatiopen.com/news/) | Cincinnati Open | Commentary, previews, interviews, recaps and video posts | **Verified, first party** | **Yes: HTTP 200 JSON/HTML**, no login. | Prefer REST fields `id`, `date`, `modified`, `link`, `slug`, `title`, `categories`. Current category IDs observed: Recap `27`, Preview `26`, Video `1`, Interviews `118`, General/news `28`; discover IDs from the categories endpoint rather than hard-coding names alone. HTML fallback uses `a.news__block.item` and `rel="next"`. |
| [Practice schedule](https://cincinnatiopen.com/score-center/practice-schedule/) and [Watch and Listen](https://cincinnatiopen.com/about/watch-and-listen/) | Cincinnati Open | Practice times/courts; broadcaster context | **Verified, first party** | **Yes: HTTP 200 HTML**. | Directly rendered text. Keep practice entries separate from competition fixtures. Broadcaster data is territorial and may change. |
| [WTA 2026 scores](https://www.wtatennis.com/tournaments/1017/cincinnati/2026/scores), [order of play](https://www.wtatennis.com/tournaments/1017/cincinnati/2026/order-of-play), [draws](https://www.wtatennis.com/tournaments/1017/cincinnati/2026/draws), [player list](https://www.wtatennis.com/tournaments/1017/cincinnati/2026/player-list) | WTA | Women's tournament identity, dates, field and corroboration | **Verified, first party** | **Yes: HTTP 200 HTML**. | Five JSON-LD blocks include `SportsOrganization` and `SportsEvent`: good for tournament `@id`, dates, location, category and field, not match scores. On 21 Aug the raw HTML contained both a `Loading Scores` placeholder and match cards; treat match HTML as opportunistic and Rain JSON as primary. Durable card markers include `/tournaments/cincinnati-open/scores/{matchId}` and `data-tournament-group-id="1017"`, `data-tournament-year="2026"`, `data-match-id`. |
| [WTA highlights](https://www.wtatennis.com/videos/highlights) | WTA | Women's match highlights and interviews | **Verified, first party** | **Yes: HTTP 200 HTML** for card metadata. Playback may be geo/consent dependent. | `li.content-listing-grid__item`; link `/videos/{numeric-id}/{slug}`; title in `a.content-listing-grid__url[title]`, category `.badge__label`, duration `.content-listing-grid__duration`, recency `.content-listing-grid__publishdate`. Do not download or rehost video. |
| [ATP results](https://www.atptour.com/en/scores/current/cincinnati/422/results), [daily schedule](https://www.atptour.com/en/scores/current/cincinnati/422/daily-schedule), [draws](https://www.atptour.com/en/scores/current/cincinnati/422/draws), [overview](https://www.atptour.com/en/tournaments/cincinnati/422/overview) | ATP | Men's official corroboration | **Verified, first party** | **Not dependable for automation:** ordinary unattended fetch returned HTTP 403 in this audit; the pages remained browser-accessible. | Use for browser/manual QA only unless access changes or permission/feed terms are obtained. Do not attempt to defeat the 403. Cincinnati's integrated JSON is the automated primary. |
| [ESPN men](https://www.espn.com/tennis/scoreboard/tournament/_/eventId/718-2026/competitionType/1) and [ESPN women](https://www.espn.com/tennis/scoreboard/tournament/_/eventId/718-2026/competitionType/2) | ESPN | Best ATP/WTA fallback for schedule, current status and result corroboration | **Unverified reporting/data fallback** | **Yes: HTTP 200 HTML**, no login. | Parse `window['__espnfitt__']` JSON; do not scrape CSS. Use `page.content.scoreboard`. The `?tour=atp` and `?tour=wta` date-query variants returned identical combined payloads, so use the `competitionType` route or `tournaments[].groupings[]`, not the ignored `tour` query. Bot/interstitial behaviour remains possible; retain stale cache. |
| [Tennis Abstract ATP Cincinnati](https://www.tennisabstract.com/current/2026ATPCincinnati.html) | Tennis Abstract / Jeff Sackmann | Analytical results/forecast cross-check | **Unverified analytical source** | **Yes: HTTP 200 HTML**. | Stable, compact tables, but not first party and ATP-only. Never override official facts. |
| [Tennis.com Cincinnati hub](https://www.tennis.com/tournaments/cincinnati-open) | Tennis.com | Combined editorial cards and recaps | **Unverified reporting** | **Yes: HTTP 200 HTML**. | Combined ATP/WTA content; observed round data lagged the official source. Commentary enrichment only. |
| [Tennis TV Cincinnati highlights](https://www.tennistv.com/videos/4559894/cincinnati-2026-friday-highlights) and [official Cincinnati YouTube channel](https://www.youtube.com/@CincyProTennis) | ATP Media / Cincinnati Open | Men's and tournament-owned highlights | **Verified/licensed media** | Page/card metadata is public; actual video may require subscription, region, consent or client rendering. | Store link, title, owner and duration only. Do not scrape, download or proxy the media asset. The WordPress Video category is a more predictable discovery index for Cincinnati-owned posts. |
| [LTA Cincinnati guide](https://www.lta.org.uk/news/2026/august/what-is-the-schedule-for-the-cincinnati-open-2026/) | Lawn Tennis Association | UK schedule/broadcast context | **Verified governing-body context** | **Yes: public HTML**. | Useful context, but Cincinnati/ATP/WTA wins event-fact conflicts. |
| AP results syndicated by publishers, e.g. [WTOP](https://wtop.com/sports/2026/08/western-southern-open-results-2/), plus [Sky Sports highlights](https://www.skysports.com/tennis/video/12611/13572692/martin-landaluce-vs-jack-draper-cincinnati-open-highlights) | AP / Sky Sports | Results corroboration and selected highlights/commentary | **Unverified reporting** | **Yes: public HTML** in tested examples. | Article URLs and old “Western & Southern Open” naming are unstable. Discovery fallback only; label `Unverified source`. |
| [Flashscore ATP Cincinnati](https://www.flashscore.com/tennis/atp-singles/cincinnati/) | Flashscore | Emergency fixture discovery | **Unverified vendor** | Some public HTML is visible, but anti-bot, ad and geolocation risk is material. | Lowest priority. Do not build release-critical automation around it. |

### Parser seams verified from raw HTML/JSON

#### Cincinnati Open index and result pages

The [Tournament index](https://cincinnatiopen.com/tournament/) returned HTTP 200 WordPress HTML. Its one JSON-LD graph contains `WebPage`, `ImageObject`, `BreadcrumbList`, `WebSite` and `Organization`, so it is useful for page identity but not fixtures. Stable content links include:

- `/tournament/tournament-schedule/`
- `/tournament/players/`
- `/tournament/daily-draw-sheet/`
- `/score-center/scores/`
- `/score-center/results/`
- `/score-center/practice-schedule/`

The Results page currently exposes its official PDFs in an encoded attribute rather than ordinary links:

```html
<score-results-day
  pretype="atp"
  detail="https://cincinnatiopen.com/match-detail/"
  pdf='[{"file":"https://cincinnatiopen.com/wp-content/uploads/2026/08/MDS-atp-0820-0030.pdf","button_text":"ATP Singles"}]'>
</score-results-day>
```

Parse the attribute as HTML entities and then JSON. Do not infer the current file name; discover it from the live page.

#### WTA index

The WTA score page's JSON-LD identifies the tournament but its `subEvent` block describes Singles/Doubles performers, not individual matches. When match HTML is present, prefer these structural keys over presentation text:

```html
<div data-widget="tournament-list/match-highlights"
     data-tournament-group-id="1017"
     data-tournament-year="2026"
     data-match-id="RS034"></div>
<a class="tennis-match__match-link"
   href="/tournaments/cincinnati-open/scores/RS034"
   title="Zarazua vs. Yuan | Qualifying Cincinnati Open 2026 | Match Center">
</a>
```

Use the path/data IDs as identity. The human title is display/fallback text, not a parser contract.

#### ESPN men and women

Both tournament scoreboards contain one large inline script assignment:

```js
window['__espnfitt__'] = {
  page: {
    content: {
      scoreboard: {
        tournaments: [{
          id: "718-2026",
          name: "Cincinnati Open",
          groupings: [{
            id: "1",
            name: "Men's Singles",
            competitionIds: ["181911", "181910"]
          }]
        }],
        competitions: {
          "181910": {
            id: "181910",
            date: "2026-08-21T00:30Z",
            status: {
              description: "Scheduled",
              detail: "Thu, August 20th at 8:30 PM EDT",
              state: "pre",
              completed: false
            },
            note: "Quarterfinal - P&G Stadium Court",
            competitors: [
              { id: "4010", uid: "s:850~l:851~a:4010", nm: "Thiago Agustin Tirante", ordr: 1 }
            ]
          }
        }
      }
    }
  }
};
```

The useful exact paths are:

- `page.content.scoreboard.tournaments[].{id,name,url,groupings}`
- `groupings[].{id,name,competitionIds}` for Men's/Women's Singles/Doubles
- `page.content.scoreboard.competitions[id].{id,date,status,note,competitors}`
- `competitors[].{id,uid,nm,rnk,ordr,link,wnr,lnescrs}` when the fields are present
- `lnescrs[].{v,p,w}` where `v` is the displayed set value, `p` is the set position and `w` marks a won set; `wnr: true` marks the winning competitor on a completed match

A compact completed-match sample confirms the result keys:

```json
{
  "id": "181877",
  "status": {"description":"Final","state":"post","completed":true},
  "competitors": [
    {"id":"10052","nm":"Arthur Fils","wnr":true,"lnescrs":[{"v":"6","p":1,"w":true},{"v":"6","p":2,"w":true}]},
    {"id":"2651","nm":"Alex de Minaur","lnescrs":[{"v":"3","p":1},{"v":"4","p":2}]}
  ]
}
```

#### Rain Digital JSON fixtures

These are trimmed records from the direct 21 August fetch. They preserve source field names while omitting unrelated fields.

`oop-mixed`:

```json
{
  "date": "2026-08-11",
  "seq": "1",
  "courts": [{
    "id": 1,
    "name": "P&G Stadium Court",
    "time": "06:10 PM",
    "matches": [{
      "id": "RS054",
      "status": "Completed",
      "type": "wta",
      "notBefore": {"time":"Starting at 6:10 PM","text":"Starting at","isoTime":"18:10-0400"},
      "team": [
        {"players":[{"id":"329199","first":"Oksana","last":"Selekhmeteva","country":"ESP"}],"seed":"12"},
        {"players":[{"id":"326379","first":"Elizabeth","last":"Mandlik","country":"USA"}],"seed":""}
      ],
      "detail": {
        "state": "F",
        "winner": "2",
        "s1A": "6", "s1B": "7",
        "s2A": "6", "s2B": "4",
        "s3A": "6", "s3B": "3",
        "startTime": "2026-08-11T18:04:42+00:00",
        "endTime": "2026-08-11T19:51:17-04:00"
      }
    }]
  }]
}
```

`live`:

```json
{
  "id": "MD010",
  "detail": {
    "state": "P",
    "rnd": "Round of 16",
    "rndShort": "R16",
    "nAF": "S.", "nAL": "Bolelli", "idA": "BA98",
    "nA2F": "A.", "nA2L": "Vavassori", "idA2": "VA08",
    "nBF": "A.", "nBL": "Pavlasek", "idB": "PG32",
    "nB2F": "P.", "nB2L": "Rikl", "idB2": "RH13",
    "ptA": "40", "ptB": "40",
    "s1A": "4", "s1B": "2",
    "serve": "0", "winner": "",
    "startTime": "2026-08-20T13:04:29-04:00",
    "endTime": ""
  },
  "timestamp": 1787246832
}
```

`draws`:

```json
{
  "code": "MS",
  "description": "Men's Singles",
  "rounds": [{
    "id": "R128",
    "matches": [{
      "id": "MS065",
      "drawInfo": {
        "result": "A",
        "players": {
          "A": [{"id":"N771","nF":"Cameron","nL":"Norrie","c":"GBR"}],
          "B": [{"id":"P0HW","nF":"Dino","nL":"Prizmic","c":"CRO"}]
        }
      },
      "detail": {
        "state": "F", "winner": 2,
        "s1A": "3", "s1B": "6",
        "s2A": "6", "s2B": "1",
        "s3A": "6", "s3B": "4"
      }
    }]
  }]
}
```

For a finished draw, use `drawInfo.result` (`A` or `B`) as the explicit winning side. The legacy `detail.winner` values observed in current samples map `2 → A` and `3 → B`; lock that mapping behind fixtures rather than treating the integer as self-documenting. Observed `detail.state` values include `P` (play/in progress) and `F` (finished); the mixed OOP also supplies a human `status`. Scores are `s1A/s1B` through `s5A/s5B`; in-game points are `ptA/ptB`.

## Data-shape recommendations

Use a registry record shaped roughly as follows; this is a data recommendation, not a runtime-code change:

```json
{
  "id": "venue:mt-smart-stadium",
  "canonicalName": "Mt Smart Stadium",
  "displayName": "Mt Smart",
  "officialNames": [
    {
      "name": "Go Media Stadium Mt Smart",
      "from": "2023-01-01",
      "to": null,
      "sourceUrl": "https://www.aucklandstadiums.co.nz/news/go-media-extend-naming-rights-partnership-with-go-media-stadium"
    }
  ],
  "aliases": ["Go Media Stadium"],
  "entityType": "venue",
  "parentVenueId": null,
  "lat": null,
  "lon": null,
  "auditedAt": "2026-08-21T00:00:00+10:00"
}
```

Additional rules:

- `entityType` should distinguish `venue`, `course`, `surf_break`, `campus`, `place`, `route` and `competition_placeholder`.
- An alias resolves only inside its stated context when it is a generic locality or tournament-only label.
- Conflicting verified facts block overwrite; unverified facts may add commentary but not fixture time, result or venue identity.
- Keep source URL, retrieval time and validity dates on names and aliases. Sponsor names are data with a lifespan, not canonical IDs.
- Add a regression test asserting that ENGIE Stadium and Netstrata Jubilee Stadium resolve to different IDs.

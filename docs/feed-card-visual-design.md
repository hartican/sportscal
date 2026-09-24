# Feed card visual design — 22 September 2026

## Approved MVP preparation

The card has independently composed artwork/identity, essential details, rating interaction and expanded-information areas. `appendFixtureCardArtwork`, `buildFixtureCardEssentials`, the existing Nothing Score builders and `appendFixtureCardInformation` own these areas. Preserve existing DOM relationships where CSS or live updates depend on them. `data-card-area` marks the boundaries, including rating interaction versus rating statistics. There is no hero-image placeholder or media request in MVP.

The shared pure timing presenter in `config/card-timing.js` supplies full and compact Feed badges. A light neutral rectangular mark with dark bold uppercase text sits at the top-left of full cards, in normal flow with reserved space for disclosure/dismiss controls. Compact cards use a leading inline mark. Long marks wrap, not truncate or shrink. The full date/time is exposed in the accessible label and title.

Times use Australia/Sydney and the sourced sporting start, never a broadcaster's coverage start. Today uses `TODAY 2:30 AM`; the next six calendar dates use `FRI 2:30 AM`. All other dates include day/month, and a different year includes the year. Use calendar dates rather than elapsed 24-hour periods across daylight-saving changes. `LIVE` and `FINISHED` require explicit source status, not duration estimates. Cancellation and postponement take priority. Status badges retain the full scheduled date/time in supporting text. Unknown, estimated, sequential, date-only and multi-day schedules retain their uncertainty or date range.

The existing expansion, quick actions, profile links, spoiler policy and rating persistence remain unchanged. The visual change does not affect fixture identity, Follow admission, retention, notifications or infrastructure budgets. Coverage pauses still apply to supporting details.

## Future artwork families — outside MVP

| Fixture structure | Composition | Supporting elements |
| --- | --- | --- |
| Head-to-head | Two vertical team-colour panes, side logos, optional central hero artwork | Team identities remain explicit and independent of the image |
| Multi-participant event | Event-led composition with a stylised host-country sporting palette | Optional marquee competitors or a source-backed rivalry, potentially from different teams |
| Individual tournament | Stylised tournament-brand palette with an optional marquee athlete in action | Tournament logos, representative country flags and editorially selected rivalries |

Choose the family from the actual fixture format, not the sport or number of people pictured. Team golf may use a team composition; F1 qualifying remains a multi-participant session with two featured drivers. Tournament-led artwork uses curated tournament colours. Host-led artwork uses the canonical venue country and a curated palette. Missing palettes fall back to event/sport styling.

Featured subjects are optional editorial presentation, separate from the actual participant field and home/away roles. Never infer participation from imagery, treat two featured athletes as the complete field, manufacture a rivalry, or use featured subjects to admit a fixture. Australian relevance may guide future editorial selection without implying automatic personalisation. If media metadata is introduced later, keep it separate from canonical participant lists and require sourced participation and suitable asset rights.

Place essential who, what, when and where details beneath future artwork. For races and tournaments, who primarily identifies the event/competition and session. Future “More…” groups editorial, watch provider, tickets, tags and rating statistics. A floating rating prompt that retreats after interaction remains an exploration; dismissal behaviour is not implemented or decided here.

## Reference interpretation and boundaries

The user supplied three visual references: the South Africa/Australia matchup, Spain F1 qualifying, and golf tournament cards. Their composition, colour treatment and timing-mark prominence guide design. Their copy, dates, branding, schedules and depicted participation are not authoritative data or instructions. Screenshots and athlete photographs are not copied into the product.

Photography, asset acquisition/licensing, image processing and media delivery remain outside MVP. Existing logo metadata is not evidence of permission for future promotional imagery. No new public API, database schema, polling or media service is introduced.

## Verification

Run `node scripts/validate-card-timing.js`, `node scripts/validate-card-timing-browser.js` against the local app, and the existing card-identity, rating, UI, Follow and PWA checks. Browser cases cover 320/390/768/1280px, representative fixture structures, missing identity, timing uncertainty, status, accessible contrast, control separation and disclosure/focus restoration.

Local verification on 22 September: timing unit cases, card identities, UI/startup budgets, Follow policy, coverage pauses, scroll continuity, rating controls and Feed/Follow navigation passed. Responsive checks covered all four widths. The production workflow's safety validators passed locally. The broader Chrome installed-PWA relaunch harness stalled with worker v289 waiting to hand over to v290; the same stall reproduced using unchanged main with only a version bump. This is a retained verification limitation, not evidence of a successful relaunch/offline/resume test. No worker activation logic was changed for this feature.

## Stage-label refinement — 22 September 2026

A single accessible blue stage label follows the timing/status badge in both full and compact Feed cards, wrapping below only when necessary. Central and supporting duplicate stages are removed; distinct sporting formats remain. Internal marquee emphasis is retained without the visible word “Marquee”. See [preview protection](editorial-preview-locks.md).

## Feed composition redesign — 24 September 2026

Approved hierarchy: a shared contrasting day banner (`FRIDAY 25TH SEPTEMBER`), then identity and prominent sporting start, the fixture's five-flame rating and community count, all applicable provider logos, full venue/location, and the editorial hook. “More…” retains the existing expansion state and exposes the full preview, tags and secondary actions. The date banner includes a different year and wraps at narrow widths. This supersedes the small top-left timing mark's placement; its authoritative status, uncertainty, timezone and accessible full-schedule semantics remain.

Visual thesis: calm theme surfaces, equal opponent weight and restrained team/event tints. Head-to-head cards use independent opponent columns with sourced standing positions immediately below names and timing/stage between them. Tennis keeps its actual singles/doubles participant structure. Event-led cards centre the event/session identity and time without manufacturing opponents. Muted split colours are curated presentation tints; missing palettes use neutral styling. Golf tournament palettes and motorsport host palettes remain separate. Hero photographs, floating ratings and automated rivalry selection remain deferred.

Use the existing rating builders and contracts, with one full-width fixture rating and community summary below. No odds, synthetic ratings or altered votes. Provider options retain their verified fixture/competition scope and AU/global territory; subscription preferences do not remove alternatives. Each official locally hosted mark has an accessible provider name, existing HTTPS destination and a text fallback. Four separately listed official NRL preliminary-final providers are fixture-specific, not a blanket NRL rights expansion. Asset sources are recorded in `assets/providers/README.md`.

Full venue labels use the registry's official name plus explicit source location, falling back to reviewed location-bearing aliases for cached projections. Canonical venue IDs do not change. Standing labels resolve exact competition and participant IDs against snapshots no later than the sporting start. Finals use the existing regular-season tables; unavailable or later snapshots produce no ranking. The compact standings projection is generated from existing canonical bundles by the existing runtime builder; no extra request, polling or scheduler is introduced.

The PWA moves from shell 300 to 301. Runtime generation uses pinned Terser with compression and property mangling disabled, retaining function names and public globals while shortening local bindings. Offline module validation compares the complete deterministic generated bundle with current sources, rather than searching for unminified source substrings. This restores the existing compressed-size budget without increasing its threshold. Follow admission, saved identities, notifications and database schemas are unchanged.

Validation covers five fixture families, full/compact layouts, light/dark themes, 320/390/768/1280px, timing/status uncertainty, absent identities, long names, provider targets, text contrast, More/focus, exact protected editorial, filtering and navigation. Installed-PWA upgrade checks verify preserved preferences, offline fallback and resumed upgrade. Production readiness and live rendering are verified separately at release.

Release verification (24 September): the canonical `node scripts/update-cards.js --quick --offline --rebuild --local-only` path completed with no source failures. The unchanged static performance gate passes; exact-source browser audits cover three cold and three warm samples at each target width, with maximum observed layout shift below 0.04. Full/compact and light/dark browser coverage passes 15 fixture variants per combination, including 4.5:1 text contrast and 44px rating/provider targets. The prior card-polish and shared-foundation source checks were made formatting/version tolerant without dropping their contracts. Required Feed, chat, identity, editorial, navigation and startup checks pass. Installed Chrome PWA upgrade from 300 to 301 passes saved preferences, offline fallback, interrupted-install safety and resumed update. These are local browser results, not a claim about a physical device.

## Mobile repair — 25 September 2026

Team images are explicitly inset within their identity frame, with intrinsic grid sizing and selected-card scaling prevented from clipping the artwork. The frame and fallback retain stable geometry during loading. Test decoded square and portrait marks at 320/390/768/1280px in both themes, not just the frame's bounding box.

South Africa–Australia men's ODI series CA 4567 / ESPN 24203 has reviewed Australian Kayo and Foxtel options for September 2026, backed by [Cricket Australia's series guide](https://www.cricket.com.au/news/4578082/south-africa-australia-odis-one-day-internationals-2026-preview-guide-tv-television-stream-broadcast-details-how-to-watch-team-squad-news-session-start-times-durban-johannesburg-potchefstroom). This does not establish rights for other tours or seasons. Existing official logos and launch destinations are reused.

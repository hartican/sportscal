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

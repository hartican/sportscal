# US Open 2026 Events source contract

Checked on 28 August 2026 against first-party US Open sources.

## Sources

- [Official schedule of play](https://www.usopen.org/en_US/scores/schedule/index.html)
- [Official schedule-day index](https://www.usopen.org/en_US/scores/feeds/2026/schedule/scheduleDays.json)
- [Official Fan Week Day 6 order of play](https://www.usopen.org/en_US/scores/feeds/2026/schedule/schedule6.json)

The official day index listed 23 released matches for Fan Week Day 6. It also listed the main-draw dates from 30 August through 13 September, but their order-of-play URLs, fixture counts and release state were still unpublished. The Events adapter must therefore publish the 23 detailed qualifying fixtures and retain the tournament-level main-draw dates without inventing pairings, courts or times.

## Card conventions

- Use the official full player names, joined as `Player v Player` or `Player / Player v Player / Player`.
- Keep the official event, round and court labels as structured card fields.
- Use the published court session start only for the first match. Later matches use `Follows` and do not receive an invented start time.
- Convert the official three-letter nation codes to the repository's two-letter local flag assets.
- Keep `competition:tennis:us-open:2026` on the parent so every materialised child inherits the existing US Open tournament mark.
- Use the official match ID in the stable child ID so repeated refreshes update rather than duplicate the same card.

## Refresh behaviour

`scripts/update-cards.js` runs `scripts/refresh-us-open-events.js` after canonical major-event reconciliation and immediately checks the generated output. The adapter fetches the currently released official competition day in parallel, writes a reviewed snapshot, and falls back to that snapshot if the US Open service is unavailable. It fails closed when a released player name, country flag, court, day or match ID cannot be resolved.

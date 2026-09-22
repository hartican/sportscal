# NRL preliminary-finals coverage repair — 22 September 2026

The regular-season Champion Data fixture ends at Round 27. The separate reviewed finals snapshot still held only week-one schedules, while the bracket-sync step looked only at the regular canonical source. Both preliminary-final slots therefore stayed as unresolved week-of-21-September placeholders rather than named, timed fixtures.

The official [NRL preliminary-final team lists](https://www.nrl.com/news/2026/09/22/nrl-team-lists-preliminary-finals/) confirm:

| Existing bracket slot | Match | Sydney time | Venue |
| --- | --- | --- | --- |
| preliminary-final-2 | Dolphins v Roosters | Friday 25 September, 7:50pm AEST | Suncorp Stadium, Brisbane |
| preliminary-final-1 | Panthers v Knights | Sunday 27 September, 4:00pm AEST | Accor Stadium, Sydney |

The slot numbering follows the existing QF/SF progression, not chronological ordering. Canonical aliases and published IDs are retained to preserve ratings, reminders and saved state. The application continues using its established venue display names, Lang Park and Stadium Australia.

The reviewed source now includes both games, and bracket sync consumes that source. Their independent previews use current official team lists and match reporting; prior unresolved-participant copy is replaced. Normal completion/results handling and spoiler controls remain independent of the schedule snapshot. Follow admission still requires an existing applicable competition or participant follow; no user follows or votes are changed.

Canonical regeneration uses `node scripts/update-cards.js` from the programme-projection stage through downstream feed and Schedule builders. The existing unchanged app-shell performance exception is the only skipped gate. The anonymous Follow snapshot is temporary and never committed.

`validate-nrl-preliminary-finals.js --published` checks exact teams, times, venues, stable aliases, one card per game and server Feed admission. It also fails if NRL week placeholders remain unresolved when their finals week arrives. `validate-nrl-preliminary-browser.js` checks visible followed Feed cards, current expanded previews and Schedule admission on mobile and desktop.

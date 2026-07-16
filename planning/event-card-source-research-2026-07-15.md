# Event Card Population — Source Research Status

Checked: 2026-07-15 (Australia/Sydney)

## Status

The existing bundled `data/events.json` labels its previous entries as seed/provisional data, so it was not used as a source. A verified replacement feed was published from `feeds/incoming/events.json` on 2026-07-15.

## Published result

35 future cards were published, all with an `expected` value of 5 or more and a Sydney-local start plus `startTimeUtc`:

| Family | Cards | Primary source used |
| --- | ---: | --- |
| Canberra Raiders home fixtures at GIO Stadium | 4 | [Official NRL 2026 draw](https://www.nrl.com/globalassets/nrl-draw-2026---final.pdf) |
| Melbourne/Canberra GWS, Collingwood and Western Bulldogs AFL fixtures with confirmed times | 6 | [Official AFL rounds 16–22 fixture](https://www.afl.com.au/news/1518682/2026-toyota-afl-premiership-season-rounds-16-22-confirmed) |
| Wallabies Tests | 11 | [Rugby Australia 2026 Test timings](https://www.rugby.com.au/news/golden-hour-family-friendly-kick-off-times-confirmed-for-wallabies-tests-2026419) and the [official Japan match centre](https://www.rugby.com.au/match-centre/3/2026/949621) |
| Australia home cricket fixtures with confirmed times | 11 | [Cricket Australia 2026–27 schedule](https://www.cricket.com.au/news/4425772/mark-your-calendar-2026-australia-cricket-schedule-fixtures-dates-tours-wtc-top-end-tests-south-africa-bangladesh-new-zealand-england-india-t20-world-cup) |
| Australia Rugby League World Cup pool matches | 3 | [Official NRL World Cup draw](https://www.nrl.com/draw/rugby-league-world-cup/2026/round-1/australia-v-new-zealand/) |

Sydney Swans do not have a Melbourne or Canberra fixture with an official exact start among the future confirmed AFL rounds. AFL rounds still shown as TBC are not represented until a start time is released.

## Melbourne Grand Prix 2027 tickets

The official Grand Prix ticket page presently states that 2027 grandstand tickets went on public sale at **12:00 pm AEST, Wednesday 10 September 2025**. It also states that the American Express Card Member pre-sale ran **12:00 pm AEST Wednesday 3 September to 12:00 pm AEST Friday 5 September 2025**, for new and existing Australian American Express Card Members. That pre-sale has elapsed. The official route to receive future ticket detail is the [Grand Prix register-interest page](https://www.grandprix.com.au/tickets/register-your-interest). The event's 2027 date and a fixed session start have not been confirmed on the official pages checked, so no Grand Prix event card was created.

Ticket source: [Official Australian Grand Prix Corporation grandstand tickets](https://www.grandprix.com.au/tickets/grandstand).

## Held for a later refresh

The following requested families were not published because an exact future start time, a confirmed participating Australian national side, or a future official event listing was unavailable. This is intentional: the feed does not invent times or broadcasters.

| Family | Reason held |
| --- | --- |
| ACT Brumbies at GIO Stadium | The published 2026 GIO Stadium home programme had already finished. |
| PGA Tour playoffs | Official tournament dates are published, but exact first-tee windows were not fixed. |
| Tennis slams | Tournament dates are available, but the relevant exact session start times/order of play are not yet set. |
| Giro d'Italia / La Vuelta | The Giro has finished; La Vuelta stage start times were not available as fixed Sydney-card times. |
| Bathurst 1000 | The 2026 event dates are published, but the race-day timetable/start remains to be released. |
| WSL semifinals/finals | The 2026 format does not publish fixed standalone finals cards. |
| Red Bull marquee events | No future Australian marquee/showcase event with a confirmed exact start and non-PPV broadcast was found. |
| SpaceX launches | No future official SpaceX webcast target with a fixed launch time was available at the check. |

Relevant primary references: [Brumbies 2026 draw](https://brumbies.rugby/news/2026-super-rugby-pacific-draw-unveiled-for-brumbies-2025827), [PGA Tour schedule](https://www.pgatour.com/schedule/2026), [Australian Open 2027 dates](https://ausopen.com/articles/news/australian-open-2027-dates-announced), [La Vuelta route](https://www.lavuelta.es/es/recorrido-general), [Supercars Bathurst schedule](https://www.supercars.com/events/2026-bathurst-1000/schedule), [Red Bull Australia events](https://www.redbull.com/au-en/events), and [SpaceX launches](https://www.spacex.com/launches/).

## Confirmed feed constraints (project source)

- Every populated event needs an exact `sourceName`, exact `sourceUrl`, and ISO `sourceCheckedAt`.
- Card `date` and `time` must be Australia/Sydney local time; include official `startTimeUtc` only where available.
- Exclude every event with `expected < 5`.
- Use sources in this order: official competition/governing body, official Australian broadcaster, reputable schedule page only to fill a gap.
- Do not invent a team, venue, broadcaster, or start time.

Source: [Event card population instructions](event-card-population-instructions.md).

## Candidate families to verify before import

| Family | Inclusion filter | Required primary source |
| --- | --- | --- |
| NRL | Every Canberra Raiders home fixture at GIO Stadium; other club league only quarter-finals onward | NRL official draw/fixture page |
| Rugby Union | ACT Brumbies fixtures at GIO Stadium; other club rugby only quarter-finals onward; every Wallabies Test | Super Rugby Pacific / Rugby Australia official fixtures |
| Cricket | Every Australia national-team fixture | Cricket Australia official fixtures |
| Tennis | Australian Open, Roland-Garros, Wimbledon and US Open (priority QF onward plus finals) | Tournament official schedule/order of play |
| Cycling | Giro d'Italia and La Vuelta a España, with priority stages | Giro / La Vuelta official stage schedule |
| Motorsport | Bathurst 1000 | Supercars official event schedule |
| Surfing | WSL Championship Tour semifinals and finals only | World Surf League official event schedule/results |
| Red Bull | Marquee/showcase events only, never PPV | Red Bull official event page, then broadcaster schedule |
| SpaceX | Televised launches only | SpaceX official launch information, then Australian broadcaster listing |

## Handoff

The next refresh should re-check each held family and the remaining AFL TBC rounds. Import only event pages that provide the exact time, source URL and broadcaster evidence required by the feed contract.

# Result refresh — 30 July 2026

## Scope

- Reviewed every card whose expected finish had passed by `2026-07-30T01:11:08+10:00`.
- Added results and provenance to 37 overdue cards.
- Published 276 canonical events as `nothingsport-results-2026-07-30-v1`.
- Preserved spoiler-safe default copy and exposed scores only through result-aware fields.

## Sources

The refresh uses official competition or governing-body sources for every newly completed card:

- AFL match centres: [8201](https://www.afl.com.au/afl/matches/8201), [8203](https://www.afl.com.au/afl/matches/8203), [8204](https://www.afl.com.au/afl/matches/8204), [8205](https://www.afl.com.au/afl/matches/8205), [8206](https://www.afl.com.au/afl/matches/8206), [8207](https://www.afl.com.au/afl/matches/8207), [8208](https://www.afl.com.au/afl/matches/8208), [8210](https://www.afl.com.au/afl/matches/8210).
- NRL Round 21: [Knights v Roosters](https://www.nrl.com/draw/nrl-premiership/2026/round-21/knights-v-roosters/), [Rabbitohs v Storm](https://www.nrl.com/draw/nrl-premiership/2026/round-21/rabbitohs-v-storm/), [Saturday report](https://www.nrl.com/news/2026/07/25/super-saturday-raiders-v-wests-tigers-bulldogs-v-warriors-cowboys-v-broncos/), [Sunday report](https://www.nrl.com/news/2026/07/26/sunday-footy-dragons-v-titans-sea-eagles-v-sharks/).
- Tour de France: [Stage 16](https://www.letour.fr/en/news/2026/king-evenepoel-conquers-lake-geneva-on-belgium-day/1350635?stage=16&stageType=stage), [Stage 17](https://www.letour.fr/en/news/2026/philipsen-finds-more-than-redemption-in-voiron/1351787), [Stage 18](https://www.letour.fr/en/news/2026/stage-18/carapaz-takes-his-attacking-crown-in-orcieres-merlette/1353035), [Stage 19](https://www.letour.fr/en/stage-19), [Stage 20](https://www.letour.fr/en/stage-20), [Stage 21 and final classification](https://www.letour.fr/en/rankings/stage-21).
- Formula 1: [Hungarian qualifying](https://www.formula1.com/en/latest/article/norris-snatches-pole-position-from-hamilton-in-gripping-hungarian-gp-qualifying.6FcjwTeRfUdjidtY0vkKZN), [Hungarian race](https://www.formula1.com/en/racing/2026/hungary), [Australian Grand Prix tickets](https://www.grandprix.com.au/tickets).
- Glasgow 2026: [3x3 opening session](https://www.glasgow2026.com/news/4546385/australia-set-the-pace-in-basketball-3x3-while-england-start-strong-in-wheelchair-competition), [Para Powerlifting](https://www.glasgow2026.com/news/4546365/records-tumble-as-nigeria-confirm-para-powerlifting-dominance), [men's gymnastics team](https://www.glasgow2026.com/news/4546398/canada-maintain-focus-to-win-men-s-team-gold), [women's gymnastics team](https://www.glasgow2026.com/news/4546743/golden-joy-for-godwin-and-australia-in-artistic-gymnastics), [opening swimming finals](https://www.glasgow2026.com/news/4546397/forrester-doubles-up-for-australia-as-chad-le-clos-hits-new-heights), [Australia v England netball](https://www.glasgow2026.com/news/4547088/one-of-the-biggest-rivalries-in-the-sport-resumed-on-day-three-as-australia-took-on-england-in-the-netball-competition), [opening weightlifting finals](https://www.glasgow2026.com/news/4547112/returning-champions-show-class-as-weightlifting-begins), [men's gymnastics all-around](https://www.glasgow2026.com/news/4546981/ward-thrills-glasgow-crowd-to-win-artistic-gymnastics-gold), [women's gymnastics all-around](https://www.glasgow2026.com/news/4547123/canada-s-black-uses-her-experience-to-regain-women-s-all-around-title), [apparatus finals day 1](https://www.glasgow2026.com/news/4547672/three-golds-three-silvers-on-a-day-to-remember-for-canada-s-artistic-gymnasts), [apparatus finals day 2](https://www.glasgow2026.com/news/4548789/dolci-s-sweet-six-helps-canada-top-artistic-gymnastics-medal-table).
- Other governing bodies: [World Athletics 100m finals report](https://worldathletics.org/news/report/commonwealth-games-glasgow-eseme-rogers-katzberg), [World Netball results](https://netball.sport/events-and-results/commonwealth-games/).

## Lifecycle result

At the review timestamp, the canonical 7/14-day rules classify the 276 events as:

- 182 active
- 16 archived
- 78 expired

Unsaved cards remain active for seven days after the event end, move to archive from day 7 through day 14, and expire after day 14. Saved cards remain retained. The feed does not hard-code archive flags because these states are derived from the event end time at render time.

## Verification

- Feed schema: passed.
- Result completeness: 128 due cards checked, zero missing; 117 official-source and 11 pre-existing media-consensus results.
- Storyline spoiler QA: 147 major cards checked; zero issues.
- Card lifecycle tests: passed.
- Full card-update pipeline: passed.

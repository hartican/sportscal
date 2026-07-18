# High-stakes preview source audit — 18 July 2026

Checked at 20:22 AEST on 18 July 2026. This note uses official competition or governing-body sources only. It is an editorial research input, not a feed update.

## Scope and finding

The current feed contains 53 upcoming cards with `storyline.stakes >= 4`. The issue is wider than the three cards called out in review. Repeated high-stakes copy currently includes:

- 10 Formula 1 race cards with the identical hook, “A championship race with points, strategy, and Australian interest in play.”
- seven Tour de France cards with the identical hook, “A Tour stage worth tracking for its terrain, breakaway chances, and general-classification impact.”
- four Test-cricket cards with the identical hook.
- three NRL finals cards with the identical hook.
- two Formula 1 qualifying cards and two Alpine skiing cards with identical sport-level hooks.

The local evidence is in [`data/events.json`](../data/events.json). Identical wording is a useful audit signal, but proximity matters: cards in the active editorial window should be rewritten now from current official reporting; later cards should be marked as awaiting a fresh preview rather than filled early with speculative detail.

## Priority 0 — named cards

### France v England — World Cup bronze final, 19 July AEST

This is not simply a consolation fixture. France and England enter after semifinal defeats, with both trying to finish on the podium. Kylian Mbappé has eight tournament goals and a last chance to press Lionel Messi in the Golden Boot race; Harry Kane and Jude Bellingham have six each. England are also trying to win a World Cup bronze match for the first time after losses in 1990 and 2018. [FIFA match preview, 16 July](https://www.fifa.com/en/articles/france-v-england-live-stream-team-news-tickets-and-more)

Thomas Tuchel explicitly challenged England to turn the pain of the Argentina semifinal defeat into a winning response, which gives the card a current emotional frame rather than a generic podium description. [FIFA England press conference, 17 July](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/john-stones-thomas-tuchel-france-england-press-conference)

Suggested journalistic direction:

- **Hook:** Redemption has a Golden Boot edge: Mbappé chases Messi while England try to turn semifinal pain into a podium finish.
- **Synopsis:** France and England arrive bruised but with something tangible left to win. Mbappé starts on eight tournament goals, while Kane and Bellingham sit on six; England are also chasing their first bronze-medal win after defeats in 1990 and 2018.

### Spain v Argentina — World Cup final, 20 July AEST

The official tournament numbers give this final a clean central tension: Argentina have scored the most goals at the tournament and Spain have conceded the fewest. [FIFA tournament statistics, 16 July](https://www.fifa.com/en/news/articles/tournament-stats-how-spain-argentina-perform)

Spain reached their first World Cup final since winning in 2010, remained unbeaten through the semifinal, and had conceded only one goal on the way to the decider. [FIFA Spain road to the final, 14 July](https://www.fifa.com/es/tournaments/mens/worldcup/canadamexicousa2026/articles/el-camino-de-espana-hacia-la-final-de-la-copa-mundial)

Messi enters with eight goals, leading the Golden Boot race and now holding the World Cup's all-time scoring record. FIFA's official tactical preview frames the match around Spain's collective control against Argentina's reliance on Messi's attacking and creative influence. [FIFA key duels, 17 July](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/duels-messi-laporte-rodri-fernandez-yamal-tagliafico) [FIFA power rankings, 17 July](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/power-rankings-spain-argentina-final)

Argentina can become the first nation since Brazil in 1962 to retain the World Cup; Spain are chasing a second star. [FIFA potential-finals analysis, 12 July](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/four-potential-finals-argentina-spain-england-france)

Suggested journalistic direction:

- **Hook:** The tournament's best attack meets its best defence, with Messi chasing history and Spain one win from a second star.
- **Synopsis:** Holders Argentina have scored more than anyone; unbeaten Spain have conceded only once. Messi leads the Golden Boot race on eight, but Spain's collective control presents the sharpest test yet of Argentina's bid to become the first repeat champions since 1962.

### R10 Belgian Grand Prix race

Kimi Antonelli's championship lead has shrunk from 66 points three races ago to 25 over George Russell. He has also suffered reliability problems in two of the previous three races. [Formula 1 race-week storylines, 13 July](https://www.formula1.com/en/latest/article/its-race-week-5-storylines-were-excited-about-ahead-of-the-2026-belgian-grand-prix.7MROwv6FGgwOA193ps2sRq.7MROwv6FGgwOA193ps2sRq)

Friday sharpened that story: Antonelli led FP2 from Lando Norris and Max Verstappen. Oscar Piastri was sixth after losing early running to a hydraulic leak. [Formula 1 FP2 report, 17 July](https://www.formula1.com/en/latest/article/fp2-antonelli-fastest-from-norris-and-verstappen-ahead-of-belgian-grand-prix.1dMk9a7WgNgOXPPOnAy9NW.1dMk9a7WgNgOXPPOnAy9NW)

Norris carries a 10-place grid penalty for exceeding the permitted allocation of power-electronics units. Piastri's crew repaired the hydraulic issue in time for him to complete FP2. [Formula 1 Friday team report, 17 July](https://www.formula1.com/en/latest/article/what-the-teams-said-friday-in-belgium-2026.MRyGOUCXkm6zQru7JvoUG)

Qualifying had not yet occurred at the audit timestamp. Its result must replace the Friday frame before the race card is considered fully current. The official event page still showed no session result at the time checked. [Formula 1 Belgian Grand Prix event page](https://www.formula1.com/en/racing/2026/belgium)

Suggested pre-qualifying direction:

- **Hook:** Antonelli's shrinking title lead meets Spa: quickest on Friday, with Norris fast but carrying a 10-place grid penalty.
- **Synopsis:** Antonelli leads Russell by only 25 points after two reliability-hit races in three, but set Friday's benchmark. Norris was second yet faces a 10-place drop, while Piastri recovered from a hydraulic leak to finish sixth. Qualifying now decides the real shape of Sunday's race.

Schedule QA: Formula 1 lists the race at 15:00 local time on Sunday 19 July. That converts to 23:00 AEST, while the local card currently says 00:00 on 20 July. The implementation pass should verify and correct this one-hour difference. [Formula 1 watch guide, 13 July](https://www.formula1.com/en/latest/article/what-time-is-the-formula-1-2026-belgian-grand-prix-and-how-can-i-watch-it.2tkW6m4Z9v4nsrUhAwcwWj.2tkW6m4Z9v4nsrUhAwcwWj)

## Priority 1 — other active high-stakes cards affected

### Collingwood v Carlton — 18 July

The current card contains only rivalry, venue and broadcast detail. Official team news supplies a real match frame: Isaac Quaynor returns for Collingwood, but Lachie Schultz and Jeremy Howe are out; Carlton named George Hewett despite a back issue and made three changes. [AFL team news, 16 July](https://www.afl.com.au/news/1561526/teams-three-changes-each-for-carlton-blues-and-collingwood-magpies-key-adelaide-crow-taylor-walker-out-blow-for-melbourne/amp)

The official match preview highlights Josh Daicos after his 33-disposal performance in Collingwood's narrow win over North Melbourne, while Will Hayward's move to a wing has helped revive his Carlton season. [AFL match preview](https://www.afl.com.au/afl/matches/8199)

Suggested direction:

- **Hook:** Quaynor returns, but the Pies lose Schultz and Howe as Carlton bring Hayward's wing revival into the rivalry.
- **Synopsis:** Collingwood arrive off a tense four-point escape, with Josh Daicos central to the finish. Quaynor is back, but Schultz and Howe are missing; Carlton counter with Hayward in better touch and Hewett named despite a back issue.

### Tour de France stages 14–21

Every current high-stakes Tour preview uses the same terrain template even though the official route notes supply distinct sporting stories:

- **Stage 14, Mulhouse to Le Markstein:** 155.3 km with 3,800 m of climbing; the 11.2 km Haag ascent averages 7.3% and finishes only six kilometres from Le Markstein. [Official stage page](https://www.letour.fr/en/stage-14) [Official route commentary](https://www.letour.fr/en/news/2026/stage-14/mulhouse-le-markstein-1/1332949)
- **Stage 15, Champagnole to Plateau de Solaison:** the organiser expects the stage to expose the definitive list of yellow-jersey contenders. The Col de la Croisette averages 11.2% for 4.7 km before an 11.3 km final climb at about 9.1%. [Official route commentary](https://www.letour.fr/en/news/2026/stage-15/champagnole-plateau-de-solaison-1/1332950) [Official stage page](https://www.letour.fr/en/stage-15)
- **Stage 16 individual time trial:** a 26.1 km course split roughly into uphill, downhill and flat thirds gives riders who lost time over the weekend an immediate chance to recover it. [Official route commentary](https://www.letour.fr/en/news/2026/stage-16/evian-les-bains-thonon-les-bains-c-l-m-individuel-1/1332951) [Official stage page](https://www.letour.fr/en/stage-16)
- **Stage 18, Voiron to Orcières-Merlette:** the final podium may still be unsettled, while strong climbers no longer in overall contention have a clear stage-win target on the summit finish. [Official route commentary](https://www.letour.fr/en/news/2026/stage-18/voiron-orcieres-merlette-1/1332954)
- **Stage 19, Gap to Alpe d'Huez:** the first of two Alpe d'Huez finishes is a short, aggressive route ending with the famous 21 hairpins; the organiser expects the deck to be reshuffled across the two days. [Official route commentary](https://www.letour.fr/en/news/2026/stage-19/gap-alpe-dhuez-1/1332955)
- **Stage 20, Le Bourg d'Oisans to Alpe d'Huez:** the penultimate day is the race's biggest mountain stage, with about 5,450 m of vertical gain and the Croix de Fer, Télégraphe, Galibier and Sarenne before Alpe d'Huez. [Official route commentary](https://www.letour.fr/en/news/2026/stage-20/le-bourg-doisans-alpe-dhuez/1332956) [Official stage page](https://www.letour.fr/en/etape-20)
- **Stage 21, Thoiry to Paris:** this is no longer a purely ceremonial sprint card. Three crossings of the Butte Montmartre create a Classics-style finish, though the Champs-Élysées finish still leaves the strongest sprinters a chance. [Official route commentary](https://www.letour.fr/en/news/2026/stage-21/thoiry-paris-champs-elysees-1/1332958) [Official stage page](https://www.letour.fr/en/etape-21)

For stages 14 and 15, the preview should combine the route-specific hook above with the latest official general classification immediately before publication. For later stages, route-specific copy can be drafted now, but named-rider context should be refreshed after the preceding stage rather than guessed.

## Editorial gate recommended for the update pipeline

A high-stakes upcoming card should fail editorial QA when any of the following is true:

1. Its hook or synopsis is identical to another event in the same sport.
2. The copy could be reused unchanged for a different fixture, race or stage.
3. It contains only event type, venue, broadcaster, start time or generic tactical nouns such as “points”, “strategy”, “terrain”, “pressure” or “general-classification impact”.
4. It lacks at least two source-backed event-specific details from these categories: latest form/result, tournament or championship stakes, team selection/injury, confirmed matchup, course/session result, or a named competitor storyline.
5. A prerequisite event has finished but the copy still says the matchup or bracket is protected. This currently affects the World Cup bronze match and final: FIFA has already confirmed France–England and Spain–Argentina in its official previews.
6. A session-dependent race preview has not been refreshed after qualifying or grid penalties became official.

Future events that are too distant for reliable team or form context should not be padded with generic prose. They should carry a machine-readable `needsPreviewRefresh` state and enter the research-and-rewrite queue inside the project's chosen editorial window.

## Primary-source set

- FIFA tournament reporting and match previews: [FIFA World Cup 2026](https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026)
- Formula 1 event, standings and official weekend reports: [Belgian Grand Prix](https://www.formula1.com/en/racing/2026/belgium), [2026 driver standings](https://www.formula1.com/en/results/2026/drivers)
- AFL fixture, team news and match preview: [AFL Round 19 match centre](https://www.afl.com.au/afl/matches/8199)
- Tour de France route pages and organiser commentary: [Tour de France 2026](https://www.letour.fr/en/)

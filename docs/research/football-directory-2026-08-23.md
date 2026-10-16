# Football directory and fixture evidence

Checked: 2026-08-23

## Primary sources

- Premier League clubs and official schedule refresh: https://www.premierleague.com/en/clubs and https://www.premierleague.com/en/matches/premier-league/2026-27
- Bundesliga clubs: https://www.bundesliga.com/en/bundesliga/clubs
- La Liga clubs: https://www.laliga.com/en-GB/laliga-easports/clubs
- Serie A clubs: https://www.legaseriea.it/en/team
- Ligue 1 clubs: https://ligue1.com/fr/articles/l1_article_5293-les-dates-de-reprise-des-clubs-de-l1-2627
- A-League Men 2026/27 fixture announcement: https://aleagues.com.au/news/aleague-men-2026-2027-fixture-list-revealed-key-dates-fixture-information/
- Lucas Herrington: https://socceroos.com.au/player/lucas-herrington
- football-data.org coverage and competition API: https://www.football-data.org/coverage and https://docs.football-data.org/general/v4/competition.html

## Repository snapshots

The repository-owned bootstrap uses ESPN's public football endpoints to reconcile the current club lists, priority-player rosters, high-resolution crests, and complete 2026/27 fixture counts against the official league sources above. These bootstrap records are labelled `reputable`, not first-party. Herrington's Australian birthplace and emerging designation use his official Socceroos profile.

European schedule replacement requires `FOOTBALL_DATA_API_TOKEN`; the refresh stops before writing when the credential is absent. The Premier League retains its existing first-party refresh. A-League fixture evidence remains the official A-Leagues announcement. Run:

```sh
node scripts/refresh-football-directory.js --refresh-fixtures
```

Never commit or log the token. Candidate data must pass the directory and fixture validators before release.

## A-League Men restoration — 16 October 2026

A-League Men is an active sixth Football league, using `competition:a-leagues` and `a-league-men`. Its official 2026/27 schedule currently publishes 12 clubs, 156 regular-season fixtures and 28 matchweeks, with 26 games per club. The official site uses this public, season-bound source:

https://match.api.aleagues.football/middleware/v2/fixturesAndResultsV2?competitionId=xwnjb1az11zffwty3m6vn8y6&tournamentId=1ztoqmkrzy1d4ejf5jokthiqc&includeTicketAndStreamInfo=true

Fixture facts, matchweeks, venues and match-specific TV flags come from A-Leagues. ESPN supplies club artwork and compatible historic fixture IDs during first ingestion. Retained official match IDs preserve identity on reschedules. The official source wins when kickoff times differ. Existing Football fixtures, rosters and explicit choices are retained. No A-League player rosters are added.

Every match has Paramount+ competition-carriage evidence from the official season announcement. Official per-match Network 10 flags produce a labelled television-guide link; they do not establish a streaming or replay permalink. The opener’s official listing distinguishes primary Channel 10 in eastern states from 10 Drama in Perth.

`node scripts/update-cards.js --a-league --local-only -p` performs the bounded source refresh, Football projections and checks. Both the full canonical pipeline and its existing incremental owner refresh this same source; no new scheduler is installed. Source failures or incomplete schedules retain the last valid snapshot and report the deferral. Unchanged schedules do not rewrite observations or cause a content release.

Regression: `scripts/validate-a-league-schedule.js` and `scripts/validate-a-league-browser.js`. Physical-device playback and reminders require separate evidence.

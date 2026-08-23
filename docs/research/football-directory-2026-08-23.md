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

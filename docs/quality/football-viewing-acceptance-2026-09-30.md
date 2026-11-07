# Football viewing acceptance — 30 September 2026

## Verified

Read-only review of Stan's expanded public schedules checked 82 unique forthcoming matches: EPL Matchweek 6 (10 matches, 10–13 October Sydney), Champions League Matchdays 2–3 (36 matches, 14–15 and 21–22 October), and Europa League Matchdays 2–3 (36 matches, 16 and 23 October). All listed participant pairings and kickoff dates/times reconcile with NS. Explicit club-name aliases and per-fixture comparisons are retained in `football-viewing-review-2026-09-30.json` in the delivery folder. This is a sampled forthcoming window, not season-wide fixture-specific verification.

Sources: [Stan EPL](https://www.stan.com.au/watch/sport/football/premier-league), [Stan Champions League](https://www.stan.com.au/watch/sport/football/uefa-champions-league), [Stan Europa League](https://www.stan.com.au/watch/sport/football/uefa-europa-league). These pages opened in the desktop browser although the web research fetcher could not retrieve them. The next EPL round and both displayed European matchdays were reviewed directly. Only necessary factual listing notes are retained; no unattended consumer-page scraper, scheduled source integration, credentials or player/DRM URLs were added.

Programme start and sporting kickoff were distinguished. Midnight kickoffs belong to the following Sydney date. Duplicate broadcast feeds and studio/multi-match shows were excluded from match counts. Existing canonical fixtures remain authoritative; no kickoff was changed from a programme-start listing.

## Destination and replay limits

All three public competition destinations loaded and described the relevant competition. Their fixture-list actions direct a non-subscriber to signup. This proves public availability listings and useful competition destinations, not authenticated playback, a direct fixture permalink or a particular full-match replay. Public highlights/mini-matches and broad replay marketing do not establish full-match replay availability. No login, subscription purchase or playback verification was performed. Existing “Check replay availability” wording and generic competition destinations remain appropriate.

## Regression and production evidence

Expanded `validate-football-viewing.js` checks all 668 EPL/UCL/Europa fixtures across both published Football projections for the correct Australian Stan destination, subscription classification, and no unsupported replay/permalink guarantee. It is already part of the production gate. Expanded `validate-football-schedule-browser.js` checks the completed-card destination and cautious replay label for all three competitions in both Feed and Schedule. The live browser run passed alongside its existing Results privacy, four-width layout and preference-preservation checks. Network API calls in that browser test were intentionally stubbed as unavailable; this proves the published static/offline rendering path, not authenticated backend behavior or physical-device playback.

Production remains verified release `47410f5f1ffd81fc7375b38f451ccd791b0dc887`; no app/data correction was needed. Only evidence and regression coverage changed, so no standalone deployment is warranted. Test changes will apply to the next normal release.

## Decision

Business value: strengthens fixture-specific Australian viewing evidence and prevents European cards regressing to the wrong provider or unsupported replay claims. Additional cash and recurring request cost: zero. Owner time: no new routine task. Acceptance: 82 unique pairings with correct event dates/times; 668 fixture destination contracts per projection; six completed-card surface/competition cases passing live. Confidence is high for these listed matches and rendered fallback links; playback remains unverified. Later schedules require fresh evidence, rather than treating this dated check as permanent truth.

Keep broader fixture-specific/replay acceptance, physical-device proof, operational recovery and commercial source permission open. This does not certify any pilot competition or carried sport family.

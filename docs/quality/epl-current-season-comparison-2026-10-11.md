# Premier League season and current-score comparison — 11 October 2026

The published EPL season agrees with the league's separate Fantasy publication on all **380 participant pairs, rounds and stated kickoffs**, including Sydney date/time and provisional-clock flags. Its **50 retained completed scorelines** also agree. A normal public app read then agrees on six newer reported scorelines: **five primary-source completed matches and one playing 0–0 match**. No sporting facts or application code need changing from this comparison.

This is a separate publication under the **same league ownership**, not an independent organiser or commercial permission. It strengthens dated accuracy evidence without completing EPL or Football certification. Actual non-playing states, authenticated playback, physical-phone use, unattended publication and commercial-use clearance remain open. Counts remain 0/3 Football pilots and 0/17 carried families approved, targeting at least 14/17 families.

## What was compared

Two established official resources were read once, serially, with 15-second deadlines, a 4 MB response cap and no automatic retries: [Fantasy fixtures](https://fantasy.premierleague.com/api/fixtures/) and [the club/season register](https://fantasy.premierleague.com/api/bootstrap-static/). Both complete responses are retained privately with timestamps and hashes. The comparison and additional public app read finished within the recorded ten-minute source timebox.

The club register's explicit `pulse_id` values bind uniquely to the twenty existing canonical clubs. Full season structure is 380 unique directed pairings, 38 rounds of ten matches and 38 matches per club. Fixture `pulse_id` values are zero, so they are **not** used as identities. Each unique ordered club pair resolves an existing NS fixture within the validated season; no fuzzy names, source ordering, new club map or new fixture ID is introduced. “Man Utd” and “Nott'm Forest” are differing source labels on the exact existing club identities, not new directory aliases.

| Check | Compared | Differences |
| --- | ---: | ---: |
| Participant identities in 380 ordered pairs | 760 fields | 0 |
| Round, UTC kickoff and calculated Sydney date/time | 1,520 fields | 0 |
| Both scores in 50 explicitly finished retained matches | 100 fields | 0 |
| Declared provisional-clock flags | 380 | 0 |
| Newer reported scores through the ordinary public app read | 6 scorelines | 0 |

The source distinguishes **50 `finished` records**, **five `finished_provisional` but not `finished` records**, one started/non-final record and 324 unstarted records. The provisional five cannot be promoted to final status from this Fantasy response, and elapsed minutes do not establish a playing phase. The normal app already carries explicit primary completion for those five; their score values agree with the separate publication. Its playing 0–0 value also agrees, without independently certifying its phase, live clock or interruption behaviour.

The selected read requested the six existing canonical identities. The endpoint correctly returns its source IDs with their preserved `canonicalEventId`. The first private observer incorrectly expected the two strings to be identical; correcting it to the existing canonical field required no second request or product identity change. This is an observer correction, not a fixture-routing failure.

## Table interpretation

The [preceding official table observation](football-table-disclosure-2026-10-11.md) at **2026-10-10T16:17:44.470470Z** covers 55 matches. Calculating club totals from only the fifty Fantasy `finished` records disagrees with 52 of its basic numeric values; this reflects the different source-finalisation coverage. Including the five **explicitly labelled provisional** scorelines as a separate audit calculation reconciles all **160/160** basic table values. The provisional calculation is never written as an accepted final, table, rank or qualification.

The app's published table checked at **12:27:21.572Z** still covers fifty matches. Its next daily checkpoint remains needed. Neither this source audit nor the clearer [published-table wording and warnings](football-table-disclosure-2026-10-11.md) refreshes rankings, renews their dates or proves that the daily publisher has recovered.

## Daily publisher: corrected timing and remaining proof

Current local and GitHub-main configuration schedules the existing canonical owner at **03:00 Australia/Sydney**. The 11 October slot converts to **2026-10-10T16:00:00Z**, not an assumed next 20:30 UTC slot. The workflow is active, the repository is public/non-archived and its default branch is main. At the recorded check after that slot, no newer run was listed; the latest observed scheduled run remains failed **37987512827**, created 9 October at 20:30:58 UTC. A previous observed dispatch time is not a future schedule guarantee.

GitHub documents that scheduled dispatches can be delayed or dropped, particularly at the start of an hour. That is a possible explanation, **not a verified cause here**. An active workflow does not prove dispatch, a successful source check does not prove publication, and a queued job cannot be assumed without a live run handle. [Official scheduling documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Keep the existing owner and schedule unchanged while observing its next actual run. Do not create another updater, force a source refresh, replay the old failed run or claim ordinary-run proof from a manual code release. A later bounded diagnosis may justify moving the same once-daily schedule away from the hour boundary; there is no change or new owner task in this pass.

## Value, acceptance and limits

**Business value:** confidence that people can plan around the existing season and that the newest reported scores are consistent, without adding a paid provider. The newly clarified finalisation difference prevents treating provisional publication as a confirmed result. **Effort:** two bounded source reads, one six-ID public app read and exact existing identity comparisons. **Dependencies:** existing sources, stable canonical identities and the retained primary table observation. **New cash/owner routine:** A$0 and none; existing assistant/hosting cost remains unpriced. **Acceptance:** complete season and unique identity checks, no compared fact disagreement, honest source-status qualification, preserved source clocks and no application writes. **Why act:** this closes the dated full-season comparison gap and identifies the remaining publication proof precisely. **Why defer broader claims:** rights, devices, playback and real non-playing/recovery behaviour cannot be supplied by a matching dataset.

Confidence is high in the captured comparisons and active workflow metadata. Schedule failure cause, future source accuracy, table rank adjudications, independent ownership, physical-phone behaviour, actual viewing/replay entitlement, commercial clearance and repeat use remain unverified. No retention, performance, storage or token/cash saving is measured.

Evidence under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/epl-season-check-20261011`: private source packets and hashes, `comparison.json`, `latest-score-comparison.json`, `daily-publication-check.json`, `verification-summary.json` and the bounded brief/scripts. Application files and all original source observation dates remain unchanged. This report adds no provider integration, scheduler, database change, deployment, account write, reminder replay, purchase or outreach.

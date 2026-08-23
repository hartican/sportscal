# nothingSport weekly coverage discovery

Reference date: 2026-08-23

Compared 6 live/delayed listings with 687 canonical events. Found 2 catalogue gaps, 0 ambiguous listings, 4 possible AU availability changes and 5 high-priority recommendations.

## Australian source health

| Source | Status | Mode and freshness |
|---|---|---|
| Kayo Sports | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| Foxtel | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| Stan Sport | loaded | reviewed_export; 6 listings; 0d old |
| ESPN Australia | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| SBS | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| 9Now | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| Seven / 7plus | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |
| Paramount+ Australia | no_approved_input | No licensed API, reviewed export or manual fixture is present; the adapter emitted no candidates. |

Missing inputs are explicit. They do not erase canonical events or silently imply that a broadcaster has no coverage.

## Editorial queue

| Date | Candidate | Match | Confidence | Priority | Suggested action | AU option | Blockers |
|---|---|---|---:|---|---|---|---|
| 2026-08-23 | Brighton & Hove Albion v Aston Villa | matched → epl-2026-27-128929 | 0.90 | high | review | Stan Sport (included) | confidence_below_publish_threshold |
| 2026-08-23 | Manchester City v Bournemouth | matched → epl-2026-27-128930 | 0.90 | high | review | Stan Sport (included) | confidence_below_publish_threshold |
| 2026-08-24 | Newcastle United v Liverpool | matched → epl-2026-27-128931 | 0.90 | high | review | Stan Sport (included) | confidence_below_publish_threshold |
| 2026-08-25 | Fulham v Chelsea | matched → epl-2026-27-128932 | 0.90 | high | review | Stan Sport (included) | confidence_below_publish_threshold |
| 2026-08-26 | US Open | new | 0.00 | normal | review | Stan Sport (included) | competition_needs_review, new_catalogue_identity |
| 2026-08-28 | UCI Mountain Bike World Championship | new | 0.00 | high | review | Stan Sport (included) | competition_needs_review, new_catalogue_identity |

## Decision boundary

A broadcaster listing is evidence, not fixture truth. New and ambiguous events remain in review. Publication is permitted only for an existing canonical identity at confidence 0.92 or higher with an unambiguous Australian option and no blockers. Use `node scripts/review-coverage-candidates.js --list` to inspect the queue; the queue never mutates the event feed directly, and only its approved artifact enters the canonical update path.

## Licensed-source path

The report generator accepts `licensed_api` snapshots using the same provider-neutral contract. These are the verified commercial possibilities; pricing is marked contact-sales unless a supplier publishes it.

| Supplier | Possible role | AU evidence | Evaluation | Recommendation |
|---|---|---|---|---|
| [YuVu](https://yuvu.tv/syndication/) | Australian linear EPG | verified fta | sample or test feed | shortlist first |
| [Gracenote On API](https://documentation.gracenote.com/on-api/index.html) | Enterprise linear and streaming availability plus sports identity | verified platform capability inventory requires quote | small public plan then sales sample | shortlist enterprise |
| [JustWatch Sports Widget](https://apis.justwatch.com/docs/sports_widget/) | Event-level streaming and broadcast offers | au locale verified competition inventory unverified | partner discussion | shortlist streaming |
| [Sportradar Media APIs](https://sportradar.com/media-tech/data-content/sports-data-api/?lang=en-us) | Canonical multi-sport fixtures, IDs and reschedules | afl verified other competitions contract specific | 30 day trial | shortlist fixture truth |
| [Stats Perform / Opta](https://www.statsperform.com/products/opta-data-feeds/) | Official competition fixture and live data | nrl rugby a leagues verified | sales demo | quote for official au competitions |
| [Simply.TV](https://www.simply.tv/products/video-metadata) | Linear EPG, streaming metadata and sports identity | unverified | small self service trial | request inventory before integration |
| [EPG Service](https://epgservice.tv/en/) | EPG and sports metadata benchmark | unverified | free sandbox and seven day pilot | benchmark only until au inventory proven |
| [SportsDataIO Global Sports API](https://sportsdata.io/developers) | Broad schedules and scores across long-tail sports | fixture only | no self service trial | compare fixture breadth only |

The smallest serious procurement test is YuVu for Australian free-to-air EPG, Gracenote and JustWatch for event-level availability, and Sportradar for fixture identity. Stats Perform is a targeted second quote for NRL, Rugby Australia and A-Leagues. Require an actual 30-day AU inventory/sample before committing; a vendor's global coverage claim is not proof that Kayo, Foxtel, Stan, 9Now, 7plus or Paramount+ are included.

Full capabilities, caveats, source links and contract questions are recorded in `docs/research/nothingsport-phase-3-broadcaster-source-research.md`.

# NRL Directory Sources

Checked: 2026-08-23 (AEST)

The NRL directory is a source-backed priority-player shortlist for following, not a weekly team list or a claim to publish every contracted player.

- [NRL clubs](https://www.nrl.com/clubs/) establishes the 17 active club identities and crest provenance.
- [NRL player directory](https://www.nrl.com/players/?competition=111) establishes the Telstra Premiership player surface.
- [2026 NRL signings tracker](https://www.nrl.com/news/2026/01/01/2026-nrl-signings-tracker-the-latest-from-all-17-clubs/) cross-checks club rosters.
- Each published player records a direct first-party NRL profile URL. Profiles publish a primary position and free-text birthplace, but do not provide a documented stable player ID or structured nationality field.

Sportscal keeps its existing `team:nrl:*` fixture and identity IDs. Player IDs are independent `competitor:nrl:*` records so future transfers only update `currentTeamId`. The public NRL directory has undocumented browser team filters; the refresh path intentionally does not depend on them as an API contract.

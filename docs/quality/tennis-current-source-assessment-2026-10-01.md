# Current Tennis source assessment — 1 October 2026

Recommendation: establish a reusable tournament-published draw/order-of-play input before claiming current tour match coverage. Keep the working team-tie adapters. Do not expand the calendar or introduce a paid source to hide the existing singles gap.

## Verified repository and source evidence

The current catalogue contains China Open (WTA), Japan Open (ATP) and Shanghai Masters (ATP) in the active/seven-day horizon. The existing hydration inventory finds zero published child fixtures and no supported fixture adapter for each. Their stable parent overviews are therefore calendar coverage, not working draws, individual-match times or confirmed results. Following a player cannot discover their participation from a calendar entry alone.

The [Japan Open organiser](https://www.japanopentennis.com/atp/en/) currently publishes a [28 September singles draw article](https://www.japanopentennis.com/atp/en/news-and-media/news/2026928-singles-main-draw-released/). It names several first-round pairings and qualifying slots. Its [Tournament Schedule](https://www.japanopentennis.com/atp/en/about/tournament-schedule/) still says the schedule is being prepared. That combination supports limited reviewed draw facts, not a complete draw, per-match date/time or current results. The full organiser window includes qualifying; it does not by itself contradict the catalogue's later main-draw start.

China Open's [official English home page](https://www.chinaopen.com/en/) publishes current news and links a schedule page. The linked schedule returned no readable content through the text browser. This does not establish that no schedule exists; inspect the actual rendered page/public linked document before selecting an adapter. Shanghai's tournament-published draw/order-of-play contract was not inspected in this bounded pass.

No new source ingestion, player entry, match, result, Follow choice or date was published from this assessment. Search snippets, calendar entries and a few named pairs are not completeness evidence.

## Next implementation brief

Begin with one active tournament's complete, organiser-published draw plus its current order of play. Discover documents through the actual publisher page; do not guess endpoints or use an undocumented ATP/WTA feed. Reuse the existing Cincinnati document-validation seam where its assumptions fit, with a separately explicit publisher/edition/host contract. The earlier [Cincinnati source decision](../research/nothingsport-cincinnati-and-paid-tennis-sources.md) restricts automated ATP/WTA fallbacks; it is not blanket permission for another tournament.

Acceptance: exact edition/draw/round, stable match and participant IDs, unresolved qualifying slots retained without invented players, explicit not-before/followed-by timing, tournament-local and Sydney dates, sourced results/withdrawals and last-good failure behaviour. Add those facts through the canonical refresh owner; no second scheduler, account scanning, AI-generated facts or automatic follows. Browser acceptance must demonstrate actual followed-player and confirmed-final admission, exclusions, women’s categories, Results privacy and return navigation.

Effort: one bounded source/document assessment, then approximately 1–3 focused engineering days for the first usable adapter if complete documents are available. Reuse for a second tournament only after equivalent evidence. Cash: A$0 additional services. Owner time: routine engineering decisions remain autonomous; escalate only a genuine rights/spending or coverage trade-off. Stop short of match-coverage certification where the source cannot supply complete, fresh evidence; retain the existing reported gap.

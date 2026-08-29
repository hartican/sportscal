# Editorial depth, timing signals and audience memory

Status: authoritative implementation plan

## Product intent

Nothing Sport is not only a fixture index. Its editorial value is the ability to explain why an event matters now and remember the larger story around a team, athlete, rivalry, season or tournament.

Editorial effort is steered by canonical Stakes and influenced by Nothingscore. Nothingscore may change research priority, refresh urgency and the prominence of clearly labelled Sentiment. It never rewrites sourced facts or changes canonical Stakes.

## Presentation contract

- L0 reveals `Why it matters` only from a validated `editorialNarrative` projection. Schedule, format, venue and broadcaster filler are never relabelled as editorial.
- L1 and L2 carry the developed narrative. The latest qualifying aggregate audience memory appears separately as `Sentiment` at L1 and L2 only.
- Source facts, citations and uncertainty notes stay in the editorial audit trail and the About disclosure, not on cards.
- User-facing Nothingscore language maps stored `heat` to `Anticipation`; `nothingscore.v1` and the stored phase remain unchanged.
- `Contributors` replaces `Pilot contributors`; other accurate closed-pilot access copy remains.
- A shared timing resolver supplies only Starts Soon (yellow, final 60 minutes), Live Now (soft red pulse and dot) and Just Finished (green, three hours). Cancelled, postponed, date-only and time-TBC records receive no timing state.
- Timing state sits beside the start-time rail under matchup names. Colour is never the only signal, and reduced motion keeps a static red live state.

## Editorial quality contract

- Recalculate a Sydney-time queue on every refresh for stakes 2+ from seven days before through 30 days after now.
- Cover every surfaced stakes-5 Feed and Major Events card regardless of that horizon.
- Stakes 2: at least one fact, one source and one substantive dimension.
- Stakes 3: at least two facts, one source and one substantive dimension.
- Stakes 4: at least three facts, two sources and two substantive dimensions.
- Stakes 5: at least four facts, three sources and three substantive dimensions.
- Every projection includes path, form, matchup, history or consequence. Format, schedule, venue and broadcaster facts cannot qualify alone.
- Official sources come first. Independent summaries and citations are retained; source prose is not.
- Temporary source failure preserves the last valid projection. A new required card without substantive verified fallback blocks release.
- Completed retained cards carry separate spoiler-safe and result-aware variants. L0 stays spoiler-safe unless results are enabled.
- Unsupported catalogue records are corrected or retired rather than padded with generic sport context.

## Sentiment contract

- The canonical updater takes a server-side aggregate Nothingscore snapshot before queue composition. It uses existing Supabase tables and service boundaries and adds no table, public endpoint, view or startup request.
- Supported Anticipation of 4+/5 accelerates research. Active Pulse schedules urgent post-event work.
- Impact needs at least three unique contributors before it can become persistent Sentiment.
- Persist only source event, explicit thread and subject links, Impact score, unique-contributor count, leading tags, capture time and expiry. Never persist identities, profiles, personas, weights or raw ratings.
- Publish the latest qualifying memory on its source projection and the next projection with an explicit shared thread. Never infer links from names.
- Carry one memory only. It expires when the linked next event finishes or after 90 days, whichever comes first.

## Canonical pipeline

1. Refresh fixtures and canonical data.
2. Snapshot aggregate Nothingscore signals.
3. Build the rolling research queue and enforce complete coverage.
4. Update persistent facts, threads and Sentiment memory.
5. Apply v2 event projections while accepting existing v1 projections during migration.
6. Publish once.
7. Validate editorial, privacy, schema, spoiler and feed contracts.
8. Build derived pages, audits and inspectors.

## Release gate

- Unit timing boundaries, reduced motion and no generic timing badges.
- Desktop and 390px Feed and Events visual QA with timing placement and no overflow.
- No user-facing `Heat` or `Pilot contributors`; internal `heat` remains.
- 100% rolling stakes-2+ coverage and 100% surfaced stakes-5 Feed/Major Events coverage.
- Structural-only hooks rejected; retained completed hooks verified in both spoiler modes.
- Sentiment privacy, three-contributor threshold, explicit carry and expiry verified.
- Missing-Supabase and missing-source preservation verified.
- Canonical local refresh passes before the scoped exact SHA is pushed and deployed to Vercel production.

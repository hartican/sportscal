# Lite weekend editorial

The 10 October 2026 standing authority covers inventory, sourced editorial application, scoped main push and exact-SHA deployment without a new approval checkpoint. Complete independent valid cards even if one card fails; retain explicit deferrals for that card and its direct dependants. Shared safety, private-control and release gates still apply. Respect explicit user interruptions, but do not ask for routine approval at the next scheduled wake. See [standing execution authority](adaptive-editorial.md).

Run Fridays at 09:00 Australia/Sydney. Weekend includes every Friday, Saturday,
Sunday and Monday fixture in Sydney calendar dates; only existing 4/5 or 5/5
stakes cards qualify. Do not load account preferences or run canonical ingestion.

Use a clean current origin/main worktree. Inventory with:
`node scripts/update-cards.js --weekend-editorial --list`

Research only listed cards with current official/trusted sources and write original,
spoiler-safe hooks and synopses. Save `data/editorial-weekend-YYYY-MM-DD.json` using
the initial 2026-09-18 file as the schema. Account for every selected ID with an entry or deferral;
provide fresh researchedAt, at least three sources and four supported facts per
entry, and the exact Friday-Monday weekend range. Then run:
`node scripts/update-cards.js --weekend-editorial --research data/editorial-weekend-YYYY-MM-DD.json`

Keep fixture facts, scores, Follow rules and unrelated cards unchanged. The mode
rebuilds affected published projections and runs feed/spoiler gates. If unchanged,
make no commit or deployment. Otherwise commit only this run's research/editorial
outputs, publish through the normal GitHub main process and run the established
release wrapper from the resulting clean origin/main snapshot. Never bypass release
gates. Report actual publication/deployment evidence and failures separately.

Failure learned on 18 September: raw ISO timestamps contain uppercase T/Z and
punctuation and are invalid feed-version slugs. Generate numeric timestamp suffixes,
assert the slug before writing, and do not let matching prose skip recovery when
the previous run left an invalid feed version.

Owner-approved active fixture locks in `config/editorial-locks.js` are excluded from weekend rewrites. They remain protected through live play and postponement; confirmed completion returns them to normal result-aware review. See [preview protection](editorial-preview-locks.md).

## Independent-card progress - 2 October 2026

The 6 October Owner authorisation also covers automatic required-display-copy repairs through the existing adaptive inventory, including newly merged fixtures outside the normal rating selection. Run that inventory before release and again after main integration, coordinate research with weekend cards, and follow `docs/update-sportscal-cards.md` for bounded recovery. No repeat approval is needed for source-backed missing-copy repair or known mechanical integration/build recovery. All holds, kickoff boundaries and shared release gates remain mandatory.

Never let an isolated card failure stop independent valid cards. Put unresolved
cards in the research JSON's `deferred` array with `id`, `reason`, `sources`
(evidence URLs), and `nextAction`. Optional entry `dependsOn` IDs explicitly
identify cards whose research is directly dependent on another selected card.
Missing, duplicated, stale or malformed card research is automatically deferred;
dependency deferrals propagate only along those declared links. Preserve deferred
cards unchanged. The script saves accepted IDs and actionable deferrals in
`data/editorial-weekend-report-YYYY-MM-DD.json`; retain that report for future fixes.
An unlisted failure must never disappear silently from the run summary.

Publish the independently valid subset even when other cards fail. A shared
knowledge-integrity, feed/spoiler, build or release-gate failure still stops the
affected publication; do not bypass or weaken those checks. Report updated and
deferred counts separately. An unchanged valid subset needs no data deployment;
new actionable deferrals still need reporting. No private preferences, new scheduler
or canonical ingestion is involved.

## Adaptive extension - 2 October 2026
The existing task now wakes daily at 09:00 Sydney. Fridays retain the existing 4/5 Friday-Monday path; adaptive real-user 5/5 maintenance covers every day in the next 14 days. Follow [adaptive editorial](adaptive-editorial.md) for eligibility, five/two/one-day cadence, full four-section copy, private owner edits/holds, kickoff cutoff and exact-SHA release recording. The approved men's NRL Grand Final is excluded from both editorial paths.

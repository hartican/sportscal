# Lite weekend editorial

Run Fridays at 09:00 Australia/Sydney. Weekend includes every Friday, Saturday,
Sunday and Monday fixture in Sydney calendar dates; only existing 4/5 or 5/5
stakes cards qualify. Do not load account preferences or run canonical ingestion.

Use a clean current origin/main worktree. Inventory with:
`node scripts/update-cards.js --weekend-editorial --list`

Research only listed cards with current official/trusted sources and write original,
spoiler-safe hooks and synopses. Save `data/editorial-weekend-YYYY-MM-DD.json` using
the initial 2026-09-18 file as the schema. Cover every selected ID exactly once;
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

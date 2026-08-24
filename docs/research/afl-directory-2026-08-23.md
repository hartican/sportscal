# AFL Directory Sources

Checked: 2026-08-23 (AEST)

The AFL directory is a source-backed current full squad list for following. The canonical refresh resolves the current AFL competition season, then publishes every player returned for all 18 clubs.

- [AFL teams](https://www.afl.com.au/teams) establishes the 18 current club identities.
- [Official AFL teams API](https://aflapi.afl.com.au/afl/v2/teams?pageSize=1000) and [competition season API](https://aflapi.afl.com.au/afl/v2/competitions/1/compseasons?pageSize=20) provide the refresh inputs.
- The official squad endpoint, `https://aflapi.afl.com.au/afl/v2/squads?teamId={teamId}&compSeasonId={compSeasonId}&pageSize=1000`, provides stable numeric player IDs and current roster fields.
- Published priority players link directly to their first-party AFL profile pages. Team identity remains Sportscal's existing `team:afl:*` fixture ID and crest handling.

The roster source provides jumper number, date of birth, height, draft/debut and recruitment fields. It does not reliably provide birthplace, country, salary or contract data, so those filters are intentionally not displayed for AFL.

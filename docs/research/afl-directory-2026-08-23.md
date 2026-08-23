# AFL Directory Sources

Checked: 2026-08-23 (AEST)

The AFL directory is a source-backed priority-player shortlist for following, not a weekly team list or a complete contracted squad.

- [AFL teams](https://www.afl.com.au/teams) establishes the 18 current club identities.
- [Official AFL teams API](https://aflapi.afl.com.au/afl/v2/teams?pageSize=1000) and [competition season API](https://aflapi.afl.com.au/afl/v2/competitions/1/compseasons?pageSize=20) provide the refresh inputs.
- The official squad endpoint, `https://aflapi.afl.com.au/afl/v2/squads?teamId={teamId}&compSeasonId={compSeasonId}&pageSize=1000`, provides stable numeric player IDs and current roster fields.
- Published priority players link directly to their first-party AFL profile pages. Team identity remains Sportscal's existing `team:afl:*` fixture ID and crest handling.

The roster source provides jumper number, date of birth, height, draft/debut and recruitment fields. It does not reliably provide birthplace, country, salary or contract data, so those filters are intentionally not displayed for AFL.

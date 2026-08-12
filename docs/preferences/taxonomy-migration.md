# Preference taxonomy migration

The hierarchy rollout preserves existing nothingsport profiles. It does not reset or reinterpret a user's choices.

## Translation contract

- `selectedSelectorEntityIds` remains the compatibility source for the current settings UI.
- `followedSports` remains the compatibility source for calendar and existing feed clients.
- `taxonomySelection` records the exact canonical hierarchy node represented by every effective selector choice.
- Preference-graph domain and competition rows retain their current IDs and also store `taxonomyNodeId` or `taxonomyCompetitionId`.
- Commonwealth Games discipline-only choices map to the Commonwealth Games event series with a durable discipline qualifier, so Athletics does not become all Games coverage.
- Unknown selector IDs are ignored by the current UI migration and never guessed into a broader canonical sport.

The translation is deterministic and idempotent. Reapplying it to an unchanged local or synced profile does not alter the user's effective event set.

## Compatibility examples

| Saved choice | Canonical target | Preserved meaning |
|---|---|---|
| `sport:nrl` | `sport:rugby-league` | Rugby league cards already carried by the NRL selector, including representative cards |
| `sport:f1` | `competition:formula-one` | Formula 1 only, not every motorsport competition |
| `special:wimbledon` | `event-series:wimbledon` | Wimbledon only, not all professional tennis |
| `special:le-mans-24-hours` | `event-series:le-mans-24-hours` | The named race rather than all motorsport |
| `cwg:athletics` | `event-series:commonwealth-games` + `commonwealth_discipline=athletics` | Athletics cards only |

## Rollback and recovery

The compatibility IDs are deliberately retained. An older shell can continue to read them if the new taxonomy layer is rolled back. Cross-device reconciliation continues to use `user-state-patch.v1`; the translation is nested inside the existing `preferences` root and therefore does not change patch or ownership semantics.

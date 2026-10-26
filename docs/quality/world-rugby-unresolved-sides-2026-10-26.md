# World Rugby unresolved sides — 26 October 2026

Separate source/local unit over frozen producer PR79/head7313177d. No source
capture, refresh, generated sporting files, customer migration or publication.
ROOT remains the sole integrator/publisher; source fixtures here are tests.

## Actual seam and red

The existing owner is `coverage-discovery.parseWorldRugby`, followed by
`fixture-identity.normalizeCore`, the existing `mergeOverlays` continuity owner
and public coverage capture. The old parser tests `!team.id`: numeric0 is unknown,
but string`"0"` is truthy and becomes the same `team:rugby:wr-0` for both sides.
The retained seven-row error pattern is six NTH/STH position pairs and one
women's semifinal pair; neither is two confirmed clubs.

The initial actual-parser test failed with two identical wr-0 participant IDs.
Test inputs are reconstructed raw-shaped records from already saved public
observations, explicitly labelled as such, not original raw/provider/current
captures. Original fixture IDs, labels, source time fields and source check
clocks are retained in those fixtures.

## Narrow repair

Only explicit provider0 stops becoming a real participant. Existing recognised
TBC/winner/loser unknowns retain the existing behavior. Keep the fixture, raw
slot labels and known participants using existing `participantSlots`; no guessed
opponent or replacement team ID. Preserve the original fixture display labels,
source/time/status/score facts, reviewed aliases and action identity.

The existing normalizer uses empty-string unknown slot IDs after null/absence.
The public slot schema admits that existing marker in **slots only**; real
participant IDs remain nonempty/distinct and ordered side guards remain strict.
No global alias mapping, new model or private action migration is added.

Continuity had a second red: its name-only resolved fallback restored old wr-0
participants. It now recognises only this provider0 sentinel/source evidence as
unresolved. Explicit unknown slots clear only the corresponding old sentinel
side fields, including fields omitted by JSON, before additive merge can revive
them. Independently known real sides keep their existing retention protection.
No clocks, scores or source records are rewritten by this source change.

Unknown-side scored observations retain their supplied numbers but the existing
public boundary refuses them before output; it does not invent team associations
or results. Last-good local input remains unchanged. A scheduled unknown fixture
is represented honestly; this does not certify all sporting completeness.

## Proof and limits

Permanent tests call the actual parser→normalizer→continuity merge→producer/
saved capture path. They cover all seven reconstructed examples, old sentinel
transition through JSON, stable fixture/action IDs and observation clocks,
numeric0, a single confirmed side, real nonzero clubs, reviewed aliases,
known-side retention, duplicate nonzero refusal, scored unknown refusal and
last-good retention. The existing discovery validator includes this regression.
Affected source/public capture/continuity regressions remain required.

The old saved850-row response is **not repaired or promoted**. Its original
ambiguous rows must still refuse; its2,399,979-byte total remains over the legacy
2MiB envelope cap. Actual current stored/provider state is unknown. ROOT must
separately allocate any real source update/current intake and generated/release
proof. The separately approved v3 lossless multi-capsule unit is subsequent,
not included here. No provider, service, SQL, native, CI, main, deploy or schedule
operation occurs in this unit.


Independent review found a mixed-case gap: a retained real side plus provider0
lost the real side when a later source supplied two unknown slots. A second
actual JSON/continuity/public-producer regression failed for both orientations.
Recovery now keeps each independently known real counterpart and its supplied
planning slot, retracting only the opposite sentinel. Participant arrays, side
fields and slots remain consistent; raw planning labels and all clocks stay
unchanged. This does not clear or migrate any real action identity.

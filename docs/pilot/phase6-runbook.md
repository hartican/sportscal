# nothingSports fourteen-day trust pilot

## Scope

This pilot tests the core sports-decision loop only. NRL and AFL are the complete-coverage sports. Public rooms, private chat, invitations, moderation and social telemetry remain out of scope until the decision gate clears.

The pilot clock begins with the first signed-in, acknowledged `opportunity_exposed` event after the Phase 6 release. Fourteen full elapsed days are required; code completion is not a substitute for live participant evidence.

## Entry gate

Before admitting pilot users:

1. Apply `supabase/nothingsports-product-events.sql` as a Supabase administrator if it has not already been applied.
2. Run `supabase/verify-product-events.sql` with two Auth users and confirm that owner inserts work, forged ownership fails, and authenticated users cannot select, update or delete product events.
3. Run `node scripts/verify-pilot-readiness.js` immediately after the canonical refresh. It must report:
   - 100% renderable current/next-round AFL and NRL fixtures;
   - confirmed participants, times and live watch destinations;
   - canonical and published snapshots no more than fifteen hours old;
   - zero supported results overdue by more than six hours.
4. Run the complete nothingSports validator suite.
5. Confirm the production alias serves the same shell version and canonical data as the released commit.

The normal app remains usable without measurement. A participant must be signed in and explicitly acknowledge the fixed-choice disclosure before any product event is queued.

## Refresh operation

The existing `Nothingsport update-cards refresh` automation runs the canonical update-and-release wrapper at 9am, midday and 11pm Sydney time. This exceeds the twice-daily minimum during active AFL and NRL rounds, with the late run placed after typical night match windows. Run the same wrapper after an unusual major match window when results land between those checks.

`node scripts/update-cards.js` remains the only cards, fixtures, standings and results refresh path. Every default run now includes the pilot-readiness gate before release; `--local-only` runs the same refresh and checks without committing, pushing or deploying.

If any upstream refresh, readiness check, push, deployment or live-browser check fails, report that exact stage and do not claim a release.

## Participant pulse and cohorts

Once per Sydney week, the signed-in pilot asks five fixed choices and stores no free text:

- usual behaviour: curator, hybrid or completist;
- external cross-check frequency;
- missed-fixture count;
- feed density;
- confidence that every NRL/AFL fixture is available.

The readout uses the participant’s latest declared cohort and reports overall, curator, hybrid, completist and unclassified rows. Older pulse events without the two Phase 6 fields remain valid and appear as unclassified rather than being discarded.

## Daily operator check

After the first scheduled refresh and after the last major match window:

1. Confirm the refresh completed through live-browser proof.
2. Run `node scripts/verify-pilot-readiness.js` if the scheduled transcript did not contain a passing readiness report.
3. Confirm zero overdue results.
4. Check that no product-event API or RLS errors were reported.
5. Record any failed upstream source or delayed result as an operational incident; do not edit participant telemetry.

## Fourteen-day readout

At fourteen full elapsed days:

1. Run `supabase/nothingsports-pilot-readout.sql` as a Supabase administrator.
2. Export the result rows as JSON without sharing participant identifiers.
3. Save the export outside the repository or in a temporary directory.
4. Run `node scripts/verify-pilot-readiness.js --json` and retain the output.
5. Run `node scripts/evaluate-pilot-readout.js <readout.json> --readiness=<readiness.json>`.
6. Review the overall row and each curator, hybrid and completist row before accepting the recommendation.

The readout covers:

- Trusted Sports Decision Rate;
- full-fixture adoption;
- external cross-checking;
- missed-fixture reports;
- feed density and meaningful actions per exposure;
- Tune and rating prompt burden;
- spectacle-rating completion;
- qualitative fixture-coverage confidence.

## Decision gate

The versioned rules live in `config/pilot-readout.js` so the decision is repeatable and reviewable.

- Invest in coverage and freshness if current/next-round completeness or overdue-result gates fail, repeated cross-checking is above 20%, missed-fixture reports are above 10%, or positive fixture confidence is below 70%.
- Invest in personalisation if coverage is trusted but TSDR is below 60%, meaningful actions per exposure are below 15%, fewer than 60% describe density as about right, or prompt dismissals exceed 50%.
- Consider `Watching Now` only when fourteen days, minimum participation, coverage trust and every core-loop threshold have cleared.

The evaluator stays in `collecting` until it has fourteen full days, five exposed pilot users and weekly pulses from at least three users. It never recommends social from incomplete evidence.

# nothingSports ongoing measurement and operational readiness

## Scope

This process measures the core sports-decision loop on demand. NRL and AFL are the complete-coverage sports. It has no fixed-duration trial, elapsed-day completion rule, or automatic social-investment recommendation.

Signed-in measurement participation starts automatically and is disclosed in Settings. A user can opt out at any time; signed-out and opted-out use remains fully functional and sends nothing.

## Release readiness

Before each release:

1. Run `node scripts/update-cards.js --local-only` through the single canonical refresh path.
2. Run `node scripts/verify-pilot-readiness.js` and require 100% renderable current/next-round AFL and NRL fixtures, fresh canonical and published snapshots, and zero overdue supported results.
3. Run the complete nothingSports validator suite.
4. Confirm the production alias serves the intended shell and product-events contract before claiming production proof.

## Measurement report

Run `supabase/nothingsports-pilot-readout.sql` as a Supabase administrator whenever a product decision needs current evidence. Export the rows as JSON outside the repository, then run `node scripts/evaluate-pilot-readout.js <readout.json> --readiness=<readiness.json>`.

The report keeps weekly TSDR, full-fixture adoption, external cross-checking, missed-fixture reports, feed density, trust confidence, prompt burden, spectacle-rating completion, and curator/hybrid/completist segmentation. Pulse responses are grouped by explicit `surveyVersion`.

Sample size is descriptive only. It does not block MVP completion. The report does not automatically recommend social or any other investment.

`watch_decision` remains in `product-events.v1` for a future genuine Watch or Remind action. Passive card opens and swipes must not emit it; fixture checks are the currently implemented TSDR action.

## Operations

The existing canonical update process should run at least twice daily during active AFL and NRL rounds and after major match windows. `node scripts/update-cards.js` remains the only cards, fixtures, standings and results refresh path.

If a refresh, readiness check, push, deployment or live-browser check fails, report that exact boundary and do not claim a release.

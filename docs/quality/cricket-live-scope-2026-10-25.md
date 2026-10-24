# Current Cricket source scope — 25 October 2026

Source candidate from `b1495bbc1b84d14f9414e591cfe41ef62fef4503`.
This is not provider, shared-data, deployment or scheduler acceptance.
ROOT/DEPLOY alone allocates manual execution and publishes through issue #28.
All background automations remain paused.

The existing canonical entrypoint accepts one additional exact scope:

```
node scripts/update-cards.js -p --live --live-source=cricket-ca-current --local-only
```

It selects exactly the existing `cricket-ca-current` adapter from `liveSources()`
and passes it to the unchanged `refreshDueSources` coordinator, store, leases,
parsers and deadlines. No collector, protected endpoint, tennis scope, default
source collection or release workflow is changed. Unsupported, missing,
duplicate and mixed scopes reject before diagnostics or source work. Only
`-p` and `--local-only` may accompany a scoped live command. Local-only prevents
release; it **does not** prevent shared-data writes.

## Existing request and write budgets

These are source-inspected bounds, not measured live timings or new allowances.

- One current-page GET, then one completed-results GET normally. Catchup can
  read up to six completed-result pages when pending recent fixtures and the
  existing six-hour catchup rule require them. At most two due scorecard GETs
  follow. Total upper bound: nine provider attempts, with no retry loop in this
  adapter. All requests use existing Cricket Australia endpoints.
- Current/results requests share the coordinator's abort signal. Their
  standalone 12-second fallback applies only without that supplied signal.
  Details additionally have four-second timeouts. The existing per-source
  timer is at most 25 seconds, clamped to remaining time in the existing
  45-second scheduling budget. No source budget is reserved or extended.
- Ordinary successful application database calls are one due-list read,
  one claim and one publication. A failed claimed observation records one
  existing failure/backoff; publication failure can therefore use four calls.
  Existing three-second due-list and default eight-second claim/publication/
  failure request bounds remain. These calls are outside the source-fetch
  timer; the 45-second scheduling deadline is not a hard 45-second whole-process
  maximum.
- If existing `MATCH_CENTRE_SCORE_WRITES=true` and milestone mode is already
  `shadow` or `live`, the unchanged coordinator may also observe up to two
  freshly detailed matches when more than 6.5 seconds remain. That path uses
  at most two existing three-second RPCs (observation read and conditional
  observation/moment commit). It does not dispatch notifications. ROOT must
  include these conditional writes in any allocation; this candidate neither
  enables nor disables flags. No account-read or notification-dispatch path
  is introduced by this scoped CLI.
- Compact mode uses the existing compact-score publication RPC; otherwise the
  existing full-source/report publication is used. Neither mode is changed.
  Due/lease refusal is a truthful skip, not ingestion success. There is no
  force-due change or second dispatch after failure.

## Observation and fact clocks

`currentCricket` stamps actually returned and parsed provider rows with its
invocation observation time. This is a source observation receipt, not the
match's finish or result-publication time. Omitted retained records do not
receive that receipt. Failed requests do not become successful observations.

The existing hash ignores observation/check-only fields, including nested
`checkedAt`. A genuinely re-observed unchanged primary fixture therefore keeps
the same fact hash. Existing SQL owns unchanged-source receipt updates and
preserves fixture revisions/bytes when that hash is unchanged. Compact SQL
keeps unchanged score/status fact dates and separate observation receipts;
terminal-state and conflicting/equal-clock guards remain unchanged. No SQL is
modified by this candidate.

Consequently, even a successful unchanged poll may leave the stored primary
`sourceCheckedAt` old. The publication projection's 36-hour/+5-minute gate is
unchanged. This command is **not guaranteed** to clear that gate: its actual
post-run rows must be assessed honestly. Do not copy collection `checked_at`
onto old fixtures, replay frozen evidence with new dates, or relax the gate.

## Deterministic evidence and review boundary

`validate-cricket-live-scope.js` launches the actual CLI, coordinator, current
Cricket adapter, parsers and snapshot store. Only provider/database boundaries
and the observation clock are constructed. The coordinator's input is recorded
while its real implementation still executes. Native HTTP and subprocess work
are refused. Inputs are independently constructed completed and omitted
fixtures, not newly fetched sporting evidence.

The original command rejected the new scope (red). The new route is checked
for successful single-source publication, unchanged fact hash, omitted old
clocks, provider HTTP/timeout, invalid/conflicting results, publication refusal,
database outage, lease refusal, not-due skips, unchanged tennis/default routes
and invalid scopes rejecting before diagnostics. A malformed bare
`--live-source` case reproduced unintended default dispatch before the guard
was extended. Both green paths use the same unchanged coordinator.

The regression joins existing `validate-update-cards.js`; no extra scheduler
or production command is added. Both review axes and affected regressions must
pass before the draft PR is handed over Ready. ROOT retains live execution,
SQL, main integration, release and hosted acceptance. Rollback is the source-only
revert of this PR; no migration/config/data inverse is required because this
candidate performs no live operation.

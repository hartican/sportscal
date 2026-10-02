# Soccer Feed fantasy deadlines

Approved implementation, 2 October 2026. Optional fixture enrichment only; it cannot admit cards, change follows or reveal results.

## User behaviour

Settings → Fantasy deadlines → Show fantasy deadlines on soccer cards defaults OFF. Every competition defaults to None. Changes save immediately locally and use the existing queued account sync. Selecting Fantasy Premier League explicitly selects FPL Classic; there is no fallback to other games.

Valid cards show `FPL deadline · 2d 4h 18m` below the scheduled fixture text and before watch information. Missing, conflicting, stale, withdrawn, expired or unsupported deadlines render no line or reserved space. Cancelled, abandoned and unresolved postponed fixtures also suppress. Per-player/fixture-only locks are unsupported; an initial cutoff with between-day changes is distinguishable in the contract but no such adapter ships.

A single shared timeout updates mounted cards, deduplicating round presentation. It pauses away from Feed or while hidden. UTC subtraction drives the countdown; accessible absolute times use the current local timezone. Days mean 24 hours. Countdown text is not an aria-live region.

The main shell carries only preference normalisation. `scripts/build-fantasy-ui.js` builds the cached optional Settings asset from the full fantasy model and `config/fantasy-deadline-ui.js`; its existing Appearance, Subscriptions, Location and About renderers retain their previous behaviour. This avoids exceeding the unchanged startup budget.

## FPL mapping and sources

`lib/fantasy/providers/fpl.js` reads the official public bootstrap and fixture responses. `fixtures[].event` references `events[].id`; `events[].deadline_time` is authoritative. Nothing Sport matchweek labels and kickoff offsets are never deadline sources.

The 2026/27 crosswalk in `data/canonical/fantasy-provider-crosswalks.v1.json` explicitly maps all 20 source team IDs. A first mapping requires unique competition/season, ordered teams and exact kickoff. Existing provider-fixture IDs survive in persisted enrichment, including withdrawal records. Provider/null round assignments, source schedule divergence and ambiguous candidates suppress display until reverified. A local read-only audit matched all 380 published EPL fixtures on 2 October 2026; this is mapping evidence, not production ingestion evidence.

## Access gate and kill switch

Production FPL ingestion is disabled unless BOTH server environment values are exactly `true`:

- `FANTASY_FPL_ACCESS_APPROVED`: set only after confirming access/redistribution permission applicable to Nothing Sport.
- `FANTASY_FPL_ENABLED`: operational enable/disable switch after the access gate.

The public endpoint is accessible, but access is not a licence. The Premier League terms at https://www.premierleague.com/en/terms-and-conditions restrict redistribution without prior written approval. No applicable approval was established during implementation. Do not enable ingestion merely because source tests pass.

When disabled, public live responses remove fantasy enrichment and report an unavailable source to opted-in clients, including clients holding a previous validator. Existing clients learn server disablement on their next live response; offline cached evidence remains subject to its short freshness limit.

## Refresh, persistence and failure

No new tables, migrations or scheduler. The existing protected fixture-refresh scheduler owns `live-fantasy-fpl`. Source intervals are 30 minutes ordinarily and two minutes within six hours of a future cutoff. Validity is at most 60 minutes ordinarily and ten minutes within six hours. Client updates perform no provider requests.

Existing leased fixture-source/current JSON persistence stores overlays and mapping pins. Successful source-check metadata travels separately; conditional validators include that metadata for opted-in requests. A failed source check never extends freshness. Explicit tombstones remove mappings because ordinary source omissions retain history. Fantasy-only overlays cannot construct a new fixture or overwrite score, status, time or participants.

No static fantasy snapshot is generated, so there is no alternate canonical refresh entrypoint or historical backfill. An eventual canonical snapshot must be integrated through `scripts/update-cards.js` and retain its actual verification timestamp.

## Verification

- `node scripts/validate-fantasy-deadlines.js`
- `node scripts/validate-fantasy-deadline-api.js`
- `node scripts/build-fantasy-ui.js --check`
- `node scripts/validate-fantasy-deadlines-browser.js` (set `PLAYWRIGHT_MODULE` when using a bundled runtime)

The source/API validators are part of the production workflow. Use recorded source data for deterministic tests; source audits are separately read-only. Existing compact Feed, cross-device, live fixture, database, backend-efficiency, startup-size, shell-cache and installed-PWA checks remain required. Browser simulations do not establish iOS Home Screen behaviour.

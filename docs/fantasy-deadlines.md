# Soccer Feed fantasy deadlines

Approved implementation and evaluation rollout, 2 October 2026. Optional fixture enrichment only; it cannot admit cards, change follows or reveal results.

## User behaviour

This supersedes the original OFF/default-None policy. Existing saved profiles without `rolloutVersion: 2` receive ON and FPL Classic once, including saved OFF/None. This is an operator-selected rollout default, not recorded user consent. Later Settings and onboarding choices survive reloads, cloud hydration and replayed automatic defaults. Other competitions remain unselected. Local persistence and queued account sync carry the additive marker; there is no bulk database backfill.

New profiles start OFF/None with `choiceSource: pending-onboarding`. The existing startup screen has an unchecked “Show FPL deadline countdowns on Premier League cards” checkbox. Save & start records the checked or unchecked onboarding choice; abandoned drafts have no effect. Reset defaults start OFF/None with the new marker. Restoring a marked backup preserves its choices.

Settings → Fantasy deadlines continues to save changes immediately. Automatic defaults cannot overwrite a recorded choice, and older clients cannot erase the rollout marker. Selecting None or OFF after rollout stays respected. The feature does not change fixture admission or notification consent.

Valid cards show `FPL deadline · 2d 4h 18m` below the scheduled fixture text and before watch information. Missing, conflicting, stale, withdrawn, expired or unsupported deadlines render no line or reserved space. Cancelled, abandoned and unresolved postponed fixtures also suppress. Per-player/fixture-only locks are unsupported; an initial cutoff with between-day changes is distinguishable in the contract but no such adapter ships.

A single shared timeout updates mounted cards, deduplicating round presentation. It pauses away from Feed or while hidden. UTC subtraction drives the countdown; accessible absolute times use the current local timezone. Days mean 24 hours. Countdown text is not an aria-live region.

The main shell carries only preference normalisation. `scripts/build-fantasy-ui.js` builds the cached optional Settings asset from the full fantasy model and `config/fantasy-deadline-ui.js`; its existing Appearance, Subscriptions, Location, startup onboarding and About renderers retain their previous behaviour. This avoids exceeding the unchanged startup budget.

## FPL mapping and sources

`lib/fantasy/providers/fpl.js` reads the official public bootstrap and fixture responses. `fixtures[].event` references `events[].id`; `events[].deadline_time` is authoritative. Nothing Sport matchweek labels and kickoff offsets are never deadline sources.

The 2026/27 crosswalk in `data/canonical/fantasy-provider-crosswalks.v1.json` explicitly maps all 20 source team IDs. A first mapping requires unique competition/season, ordered teams and exact kickoff. Existing provider-fixture IDs survive in persisted enrichment, including withdrawal records. Provider/null round assignments, source schedule divergence and ambiguous candidates suppress display until reverified. A local read-only audit matched all 380 published EPL fixtures on 2 October 2026; this is mapping evidence, not production ingestion evidence.

## Evaluation access and kill switch

The user authorised ongoing public evaluation on 2 October 2026. Server-only `FANTASY_FPL_ENABLED=true` is required together with either `FANTASY_FPL_EVALUATION_ENABLED=true` or `FANTASY_FPL_ACCESS_APPROVED=true`. Evaluation never sets or implies access approval. Operational disablement removes fantasy enrichment and reports `accessStatus: disabled`; other states are `evaluation` and `approved`. This metadata participates in the opt-in conditional validator.

Settings beneath FPL and About show at least 12px fine print: “Evaluation feature. FPL data licence pending negotiation; commercial use subject to licence clearance. Nothing Sport is not affiliated with or endorsed by the Premier League.” No extra licensing row appears on Feed cards. Confirmed approved access can suppress the evaluation note.

Public endpoint access is not a licence. The Premier League terms at https://www.premierleague.com/en/terms-and-conditions restrict redistribution beyond commercial use. No provider approval has been established. The evaluation flag records the owner's decision to evaluate, not a non-commercial permission exemption or negotiated licence. Commercial release remains a separate clearance decision.

Evaluation has no automatic expiry. `FANTASY_FPL_ENABLED=false` remains the master kill switch; redeploy the changed server environment through the exact-SHA release workflow. Existing clients learn disablement on their next response; offline evidence remains subject to the short freshness limit.

## Refresh, persistence and failure

No new tables, migrations or scheduler. The existing protected fixture-refresh scheduler owns `live-fantasy-fpl`. Source intervals are 30 minutes ordinarily and two minutes within six hours of a future cutoff. Validity is at most 60 minutes ordinarily and ten minutes within six hours. Client updates perform no provider requests.

Existing leased fixture-source/current JSON persistence stores overlays and mapping pins. Successful source-check metadata travels separately; conditional validators include that metadata for opted-in requests. A failed source check never extends freshness. Explicit tombstones remove mappings because ordinary source omissions retain history. Fantasy-only overlays cannot construct a new fixture or overwrite score, status, time or participants.

No static fantasy snapshot is generated, so there is no alternate canonical refresh entrypoint or historical backfill. An eventual canonical snapshot must be integrated through `scripts/update-cards.js` and retain its actual verification timestamp.

## Verification

- `node scripts/validate-fantasy-deadlines.js`
- `node scripts/validate-fantasy-deadline-api.js`
- `node scripts/validate-fantasy-rollout.js`
- `node scripts/build-fantasy-ui.js --check`
- `node scripts/validate-fantasy-deadlines-browser.js` (set `PLAYWRIGHT_MODULE` when using a bundled runtime)

The source/API validators are part of the production workflow. Use recorded source data for deterministic tests; source audits are separately read-only. Existing compact Feed, cross-device, live fixture, database, backend-efficiency, startup-size, shell-cache and installed-PWA checks remain required. Browser simulations do not establish iOS Home Screen behaviour.

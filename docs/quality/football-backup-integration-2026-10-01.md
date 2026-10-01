# Delayed Football backup integration — 1 October 2026

The free football-data.org backup is implemented for existing EPL 2026/27 and UCL league-phase fixtures, through the sole canonical refresh owner. Current primaries remain authoritative. During an outage, a complete reviewed backup can add an explicit FINISHED result to an exactly matched existing fixture; it cannot change kickoffs, existing finals, identities, rankings or Australian viewing. Production publication/deployment verification is pending in this checkpoint.

## Evidence and business effect

- Trial `8503f9a`: 524 fixtures, 68 completed scores and eight basic statistical fields across 56 table rows agreed in two short observations on 1 October. These are dated agreement checks, not proof of independence, live scores, uptime or complete competition quality.
- Authenticated integration observation at 08:37–08:38 UTC: 380 EPL / 144 UCL fixtures and 50 / 18 completed scores again agreed; 20 / 36 table rows parsed. Four bounded requests; no live data or production mutation.
- Canonical European refresh at 10:01 UTC succeeds through `scripts/update-cards.js`; actual UCL primary succeeds and the clean exception report records **zero backup-provider requests**. Validator simulations are isolated from credentials, real data/overlays and source-health artifacts.
- Twenty trial/integration tests pass, including actual EPL persistence and UCL/Europa partial recovery, zero goals, conflicts, missing credentials, quota/deadline failures, staleness, repeated unchanged facts and primary recovery. Backup facts remain separate from the ODbL dataset and original primary observation times remain intact.
- Mounted Feed/Schedule and source attribution pass at 320/390/768/1280 widths; Results privacy is retained. Chromium and WebKit 343→344 upgrade/offline/preferences/resumed-upgrade rehearsals pass. Physical installed-device evidence remains open.
- Normal release checks pass; the unchanged eight-request startup budget is met without a bypass. Initial performance failures were resolved by deferred rendering. An outdated browser assertion selected the entire date/time badge; it now asserts its actual status child. A rehearsal also found simulated validation observations contaminating the real health report; isolated outputs/credentials and a repeated real run close that defect.

## Architecture and operation

Primary adapters → retained competition facts → invocation-scoped delayed backup on failure → separate canonical result overlay → ordinary Feed/Schedule/Calendar projections → attributed, spoiler-aware cards.

At most four fixed-origin requests per canonical invocation, sequential starts ≥6.5 seconds apart, 15-second deadlines, response-size limits, redirect rejection and no automatic retry. Successful unchanged corroboration updates only the exception report. Backup finals use their actual provider update/check times. Tables remain primary/derived primary facts and display a stale note while a backup final is ahead of their coverage. A valid primary final clears its backup overlay; unknown primary states cannot erase a retained final.

The encrypted `FOOTBALL_DATA_API_TOKEN` is supplied only to the existing canonical Actions refresh environment, never a browser or Vercel function. Health exceptions and actual request counts join the existing bounded weekly readout. Missing credentials or unresolved conflicts retain last-good data and remain visible. No scheduler, database schema, live polling, paid service, invitation or reminder replay is added.

## Cost, limits and acceptance

Incremental API package cost: €0/A$0 on the dated free tier. Healthy primaries require zero backup requests. Free scores/schedules are delayed; ten calls/minute are advertised. Provider terms require visible attribution, disallow credential publication, do not warrant accuracy/availability and leave image permissions separate. Existing primary-source commercial permission is not cleared by adding this backup.

Owner burden: no new routine decisions, dashboard or tracker. Review genuine exceptions in the existing readout. Benefit: confirmed results can continue reaching existing followed fixtures during a primary outage, with stable saved actions and honest provenance. No better accuracy or speed is claimed while the providers agree.

Limits: EPL whole season and UCL league phase only; no Europa backup, A-League, knockout expansion, new imagery, ranking/qualification inference or subscriptions. No live production outage is forced. All 16 carried families and all three Football pilots remain uncertified against the full checklist; cohort launch still needs the remaining rights, operational and physical-device gates.

Evidence folder: `/Users/jackhartican/Documents/AI/Codex/nothingsport-football-backup-integration-2026-10-01`.
Official references: https://www.football-data.org/pricing ; https://www.football-data.org/client/register .

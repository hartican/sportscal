# NFL table recovery and bounded source acceptance — 4 October 2026

Status: published and production-verified at b06a3423 / shell 429. This closes a concrete table loss, not full American Football or Ice Hockey certification. Six-gate certification remains 0/16 carried families and 0/3 Football pilots; target at least 13/16.

## User outcome and architecture

The existing NFL standings importer looked under child division tables; the current ESPN resource actually has two conference-level tables with sixteen clubs each. The shared full and quick owners now use one strict parser for the complete 2026 regular-season response. AFC and NFC render separately with source-supplied conference seeds, played/win/loss/tie records, win percentage, points for/against and point differential. No global rank or final playoff qualification is inferred. Mobile tables retain readable text and horizontal scrolling, scoped column/row headers and keyboard-focusable regions. Results OFF withholds the table; the established local reveal remains authoritative.

The canonical `update-cards.js --quick --source=nfl-standings --local-only -p` route performs the initial recovery. Ordinary quick refresh adds one request to an endpoint already used by the full owner, with the existing fifteen-second deadline and no retry; full refresh retains its one existing twenty-second request. No new provider, scheduler, browser request per user, credential, database migration, purchase or owner checklist. This is an explicit additional daily source request, not a claimed zero-request change. Generic quick failures enter the existing exception report; optional full failures retain last-good standings with a warning.

Complete known-team, season, regular-season, conference, statistic and seed validation precedes persistence. Partial/malformed responses and HTTP failures retain the exact existing table and date. Unchanged checks write no new table facts or aggregate directory clock; current check receipts stay in the existing refresh report. A valid correction receives its own actual observation. Fixture records, identity/action keys, scheduling, participant roles, existing results, personal follows/exclusions and reminder OFF choices keep their ownership.

NFL profile tables also retain conference-specific Seed/W-L-T/PCT context; their local reveal keeps global Results OFF.

The shared known-fixture patch function was moved without semantic changes into a small module reused by F1 and quick owners. F1 no longer imports the full quick orchestration module. This follows the previous deployment-inventory finding; immutable release inputs will establish which traced files disappear. No cold-start improvement is claimed without measurement.

## Evidence and limitations

| Evidence | Result | Scope |
|---|---|---|
| Existing ESPN year scoreboard, HTTP 200 at 10:29:50.300 UTC | 320 retained records, 4,480 compared identity/name/UTC/venue/status/round/participant-role/score facts agree | Calendar-year resource includes prior-season finals and 241 current regular-season fixtures; later January 2027 window is absent |
| Existing ESPN standings, HTTP 200 at 10:29:49.683 UTC | 32 clubs, two separately sourced conference seed scopes | Source publisher agreement; commercial reuse permission remains unverified |
| Actual scoped owner at 10:41:35.300 UTC | 32 rows persisted; 49 completed 2026 regular-season games reconcile on 192 club totals | Independent calculation against a separate resource from the same publisher, not independent publisher truth |
| Genuine unchanged owner at 10:48:52.890 UTC | Zero changes; table date remains 10:41:35.300 UTC | No source clock renewal by rerun |
| NHL official Carolina season response at 10:29:49.894 UTC | 88 retained records agree on 528 status/UTC/participant-role/score facts | One club's season, not full NHL or CHL; no ice-hockey source facts changed |
| Both ESPN table destinations | HTTP 200, preserved destination, 2026 mentioned | HTTP reachability only; tool-rendered page access failed and full page/table content was not independently accepted |
| Regression | Actual full and quick ingestion/persistence; nineteen invalid controls, zero values, failed/partial last-good retention, rerun and later correction | Synthetic failures supplement the reduced captured actual response |

All 320 canonical NFL fixtures and all 321 Code records (including the retained parent) remain exact. All other sporting files except the NFL projection/manifest remain exact. NFL's previously hardcoded Complete label now correctly says Partial. This does not remove a carried family or improve the certification denominator. The original directory collection date remains 2026-10-04T05:50:28Z; only table facts gain their own actual check date.

Saved source bodies, hashes, red reproduction, owner logs, reconciliation, browser and release evidence: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/nfl-nhl-current-window-20261004/`.

## Acceptance and next work

Normal release gates, Chromium/WebKit source/render/privacy checks, real 428→429 cached-shell rehearsals, scoped GitHub main publication, exact-SHA READY/project/alias/metadata/served-byte proof and hosted rendering pass. Browser automation is not physical phone, account, reminder/push or playback proof.

Business value: users can understand current club records instead of an empty table, and can distinguish current seed positions from qualification. Effort: one bounded engineering module, actual runtime saved in gate evidence; A$0 subscription cost, one existing-source request per ordinary quick run, no extra owner decisions. Why act: a complete valid table was demonstrably discarded. Accept when the 32 source rows render correctly under both conference headings with privacy, dated provenance and normal live proof. Wider fixture completeness, Australian viewing, participant/player context, rights and ordinary unattended operation remain separate gates.

Next: continue the weakest carried windows and remaining Football acceptance. NFL's later January coverage and individual fixture observation dates remain explicit gaps; NHL/CHL wider source and viewing/result completeness are still partial/unverified. Do not repeat accepted table or blocked source checks without drift or a new evidence path. Passwords/iCloud stays parked.

## Verified production delivery

App `b06a34238eb2f77c49ae2b651e2c0819a5a58caa`, shell **429**, is published on GitHub main and live through [normal release 37197282648](https://github.com/hartican/sportscal/actions/runs/37197282648). Independently verified READY deployment `dpl_DLTfoeDMJ7exMMaYBmFTCaYu6tMd`, correct project `prj_NAMl47QVLbPUfsMmap59JIpchOPD`, exact releaseGitSha, all three production aliases, fifteen affected/retained served hashes and **48 local / 48 hosted browser cases** agree. Both genuine 428→429 Chromium/WebKit rehearsals retain the new table, Results privacy, source dates, existing follows/exclusions/Remind OFF, update and offline behavior. This is browser evidence; real phone, account, playback and push remain unverified.

All 145 normal safety commands pass locally and in the successful cloud workflow, including existing protected read-only publication and erasure-preflight inputs. The first attempt stopped at the compressed-startup budget (1.26% versus the unchanged 1.25% limit). Moving the sport-specific note into existing manifest data and table styling into its optional module brings final growth to **1.24%**, with **8→8 critical requests**. The failed attempt is retained; no gate is waived and no page-speed improvement is inferred.

Immutable inventory changes from **1,444 to 1,431 inputs**: ten changed, fourteen removed and **1,421 exactly unchanged**. All fourteen specifically identified CLI/refresh-owner dependency inputs are removed by the shared-patch extraction; one pure helper replaces the coupling. Repository owners are retained. No function cold-start measurement is available.

Regression additionally rejects older/equal-clock conflicting table observations. The nineteen parser controls, two stale/conflict controls, real quick persistence, full-builder handoff, source failure, valid later correction and unchanged owner rerun pass. Hosted rendering checks include two engines/four widths/real themes, the 32-row main table and profile-local reveal with global Results still OFF. Both provided season-specific source destinations return HTTP 200; destination contents/playback are not certified.

No new subscription, API credential, scheduler, database change, reminder replay, customer operation or owner decision. Ordinary future canonical success and all six-gate/cross-sport/commercial/cohort acceptance remain separate.

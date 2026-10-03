# Football profile source context — 4 October 2026

**Outcome:** preserve the source limitations already attached to Football results and tables when a user opens a fixture's team profile. A profile must not make a delayed recovery or an older table look like confirmed current primary data.

## Verified gap and repair

The actual profile renderer omitted `stale`/`staleNote`, while the existing Schedule renderer displayed them. It also displayed fixture results and community-derived standings without the shared result/data attribution used on cards. A controlled existing EPL fixture and table reproduced the omitted stale warning before the repair. This is an actual renderer defect reproduced with controlled outage metadata; no current production backup incident or inaccurate live table is asserted.

Profiles now retain the table warning after the same local Results reveal, including a flagged non-first row and the existing default warning. Fixture results and standings use the existing shared attribution helper. Primary OpenLigaDB data keeps its separate ODbL and dataset links; delayed backup attribution applies to the recovered result, not to a primary table. Primary EPL results do not acquire backup provenance. The shared fallback now retains the delayed-result explanation and attribution even when its optional detailed module fails. The supplied provider update/check dates stay unchanged.

Before: canonical source metadata → Schedule warning / card attribution → profile drops the caveats. After: the same metadata → Schedule, card and profile → shared source attribution and table warning, under existing Results controls. No new API, data model, provider call, refresh owner, migration, scheduler or user event. The optional profile remains cached after first use; shell 416 and the profile's exact new URL replace old cached bytes. The 65-module generated runtime stays byte-identical.

The official [registration terms, section 7](https://www.football-data.org/client/register) still specify the visible attribution text on this read. The [free plan](https://www.football-data.org/pricing) still lists delayed scores/schedules and ten calls per minute. This repair changes neither the four-request invocation budget nor source permission, domain/alias, retention, artwork or commercial acceptance. No upgrade or purchase.

## Verification and limits

| Evidence | Result and scope |
|---|---|
| Baseline reproduction | Real profile renderer omits the existing stale table cue with controlled backup metadata; failed receipt retained |
| Focused source-to-profile browsers | 28 cases pass: Chromium/WebKit, 320/1280px, primary EPL/UCL, delayed EPL/UCL, explicit/default stale warnings, zero-goal result, empty table, failed optional helper, Results privacy, focus and existing table reuse |
| Existing backup release gate | All 14 tests pass, including actual public fallback execution with failed optional detail and three primary-provenance variants; no provider requests |
| Existing complete Football journeys | 24 published-document journeys pass in Chromium/WebKit: actual Feed/Schedule cards, profile navigation, row values, focus/scroll/filter return and cold/in-flight source retry; all 16 progressive-content scenarios pass |
| Release and cached upgrades | All 137 normal local contracts pass in 143,052 ms; both 415→416 upgrade engines pass profile/standings cache, preferences, offline/resume and required-failure preservation. Cloud release, exact GitHub/READY/project/alias/served proof and hosted rendering are pending |

The initial focused harness omitted the document's UTF-8 declaration, so its middle-dot heading was misdecoded and a later selector failed. That harness failure is retained separately; the fixture document now declares the same encoding as the actual app. No product workaround or weaker assertion was used.

Focused browser sources are controlled copies of current published documents. They do not prove a real outage, new provider accuracy, successful authenticated playback, guest/customer operation, full screen-reader use or a physical installed phone. Results-off remains authoritative; local reveals change no global setting or follow choice. All 600 protected sporting/configuration/schema/runtime inputs keep their exact bytes; only the profile presentation module is excluded from that comparison. All existing identities, sporting facts, original clocks, tables, activity and ordinary source budgets remain exact. All six pilot gates and the wider programme remain open; certification is still **0/3 Football pilots and 0/16 families**, target at least 13/16.

## Recommended course

| Action | Business value/evidence | Effort and dependencies | Cash and owner time | Acceptance and decision |
|---|---|---|---|---|
| Release this scoped source-to-profile repair | Prevents a profile from suggesting more current or authoritative data than its card/Schedule; closes reproduced metadata loss and missing source credit | Estimated under one focused engineering day; existing metadata, helper, optional-module cache and release owner; measured checks recorded below | A$0 new spending, no added owner decision or routine | Same rows/facts/observations and Results/focus/navigation; visible delayed attribution despite helper failure; normal gates, exact release and hosted evidence. Release only after passing |
| Continue remaining Football acceptance | Presentation consistency is useful but does not clear sporting inputs, live-status semantics, playback, commercial permission or independent recovery | Existing six-gate competition/window contract and consolidated owner/device session | No provider expansion, subscription or repeated owner tracker | Keep explicit gaps; ingest only published facts and obtain independent evidence before certification |

Evidence lives in `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`, prefix `profile-source-context-20261004` or `profile-source-context-*20261004`. The [single delivery queue](../cto-delivery-plan.md) remains authoritative. Transfer/retention/token/cash savings are not measured by this presentation repair.

**Release status: local scope, complete navigation and both cached upgrades pass; exact production proof pending.** No sport certification or whole-programme completion is claimed.

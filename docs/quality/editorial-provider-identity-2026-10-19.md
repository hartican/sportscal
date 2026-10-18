# Editorial provider identity repair — 19 October 2026

## Problem and verified cause

Scheduled canonical run39154135849 failed on main4cb47982148793a01da7d23f2d6dbf5d6ee6bf93. Its saved artifact12146825694 and logs identify validate-editorial-sport-depth → validate-postseason-editorial → validate-editorial-narratives:149. The original complete local postseason rehearsal reproduced the exact missing target `football-premier-league-2026-27-401879264` with external networking denied.

The match is present in both incoming and published data as `epl-2026-27-128980` / `event:premier-league:128980`. The published copy also retains the secondary provider aliases; the incoming copy does not. The actual rehearsal applies fixture research and collects both copies' target aliases. The editorial lookup previously did not apply the existing reviewed provider identity map, so the strict two-copy gate mistook that alias difference for a missing fixture.

## Scoped correction

The existing editorial target-ID owner now uses `lib/epl-provider-identities.withAliases` for lookup only. Its complete reviewed380-fixture/20-club registry already binds these primary and secondary IDs. Existing competition, season, sport, directed participants and ambiguity guards remain authoritative. The source record is never rewritten. Existing explicit-ID precedence remains stronger than a derived alias.

The incoming/published membership, projection-quality and spoiler checks remain unchanged. No sporting fact, article, source timestamp, activity ID, source file, source request, service, scheduler or customer write is removed or re-dated. A focused regression joins the existing editorial gate once; there is no new refresh owner.

## Verification and limits

Pinned Node24.21 with external networking denied: the original postseason rehearsal fails before the fix; the minimised actual-ID lookup fails in under a second; both now pass. Guards cover wrong competition/season/sport/sides, unknown or conflicting IDs, input immutability and explicit-ID collisions. Existing projection-identity, editorial-publication and EPL provider-identity checks pass. The first broader pass reached the unchanged shell check but lacked Terser; the final rehearsal passed with an existing installed runtime. Failed attempts are retained; nothing was installed.

Evidence is under `/Users/jackhartican/Documents/AI/Codex/nothingsport-release-resume-20261019/canonical-failure`. The five other source warnings from the scheduled run remain recorded: unreviewed MLB DR state, disappeared CHL fixture, future NHL observation, WRC timeout and unavailable Stan metadata. They are not repaired or suppressed by this change. No new sporting/provider or database check, manual canonical refresh, publication or deployment was performed for this local repair. A later genuine canonical run and normal production release remain separate acceptance requirements.

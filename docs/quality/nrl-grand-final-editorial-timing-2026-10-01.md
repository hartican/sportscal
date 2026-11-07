# Grand Final editorial and retained kickoff repair — 1 October 2026

The expanded Roosters–Knights card opens with Newcastle's wooden-spoon-to-premiership opportunity, separates sourced recent performance into Form, preserves the existing schedule/viewing/venue paragraph as Match context, and closes with the Sandon Smith–Daly Cherry-Evans rivalry and Nawaqanitawase's return to rugby union. These optional editorial fields require supporting fact dimensions in the editorial knowledge contract. Preview sections disappear after confirmed completion.

Official NRL reports support the preliminary-final results (Roosters 36–20 Dolphins; Knights 22–14 Panthers), individual contributions and closing narrative. Sources are retained in `data/editorial-fixture-research.v1.json`. Accor Stadium and the NRL Grand Final team lists confirm 7:30 pm Sydney on 4 October: `2026-10-04T08:30:00.000Z`, after daylight saving starts. This is the sporting start, distinct from the entertainment programme.

The reported TIME TBC was reproduced through the shared fixture overlay merge: a retained date-only record supplied optional uncertainty flags missing from the new confirmed observation. A new exact, confirmed start now clears those inherited flags. Explicitly uncertain new observations retain TIME TBC. Canonical identities and saved-action aliases remain intact.

Regression checks assert the centred clock itself, rather than accepting a time somewhere in the editorial. They also assert opening and closing narrative, sporting-only Form, verbatim retained context, completed-card lifecycle, Feed/Schedule behaviour, NRLW artwork and viewing separation, four widths and both themes in Chromium and WebKit.

The canonical `node scripts/update-cards.js` scoped/resume path regenerated projections and passed its applicable gates. Its Stan discovery freshness gate required a manually reviewed public schedule snapshot dated 1 October; this is discovery evidence, not a replacement sporting-time authority or new ingestion scheduler. Generated changes also retain existing canonical aliases and normalise existing result/editorial projections. No account migration or scheduler change was made.

Release 339→340 browser upgrade rehearsals passed in Google Chrome, bundled Chromium and WebKit, preserving preferences and offline behaviour and rejecting a required-asset failure. One initial Chromium rehearsal timed out with a waiting worker; its unchanged repeat and the other browsers passed. Worker activation code was not changed. Physical installed-PWA behaviour is unverified; browser rehearsals are not device evidence. No historical waiver is used as a passing result.

Production SHA, deployment, public-artifact and rendered evidence are recorded separately under `/Users/jackhartican/Documents/AI/Codex/nrl-card-repair-2026-10-01`.

## Live API follow-up — 1 October 2026

The user subsequently reproduced TIME TBC on production with the new NRL editorial visible. The public `/api/fixtures?ids=evt_84` response supplied the correct UTC start, `timePrecision: exact`, `scheduleStatus: confirmed`, and both TBC flags false, alongside inherited `dateOnly: true` and `schedulePrecision: date-only`. Replaying that actual observation through the existing normaliser and the mounted-card live refresh reproduced TIME TBC. The prior browser test deliberately failed every API request, so it did not exercise this real source path.

The shared normaliser now reconciles that contradictory timing group when the sporting start is valid, exact and confirmed and both uncertainty flags are explicitly false. It clears legacy date-only metadata. Explicit TBC flags, date-only precision, provisional schedules and missing starts remain conservative. This applies to server responses, persisted observations and hydrated client caches without a database mutation. The API representation validator is versioned so an unchanged source snapshot cannot keep an old response behind a 304.

`validate-nrl-live-clock-browser.js` calls the actual mounted-card refresh and checks the badge after the live observation, not just a directly built static card. It failed against release 340 using the real production API. The candidate passes the replay in Chromium and WebKit. `validate-live-fixture-api.js` covers coherent response timing, preservation of source status/scores and revalidation of an old cached response. `validate-nrl-grand-final.js` covers the precise reported contradiction and conservative uncertainty cases.

Only the canonical `update-cards.js --follow-ui --local-only` path rebuilds the bundle and retained-source projections. Ordinary fixture metadata remains unchanged. No new polling, refresh ownership or source fetch is introduced. NRLW editorial was explicitly excluded by the user and remains unchanged. Production follow-up evidence is stored under `/Users/jackhartican/Documents/AI/Codex/nrl-live-clock-repair-2026-10-01`; physical installed-device behaviour remains unverified.

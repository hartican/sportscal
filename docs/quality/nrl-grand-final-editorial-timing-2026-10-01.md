# Grand Final editorial and retained kickoff repair — 1 October 2026

The expanded Roosters–Knights card opens with Newcastle's wooden-spoon-to-premiership opportunity, separates sourced recent performance into Form, preserves the existing schedule/viewing/venue paragraph as Match context, and closes with the Sandon Smith–Daly Cherry-Evans rivalry and Nawaqanitawase's return to rugby union. These optional editorial fields require supporting fact dimensions in the editorial knowledge contract. Preview sections disappear after confirmed completion.

Official NRL reports support the preliminary-final results (Roosters 36–20 Dolphins; Knights 22–14 Panthers), individual contributions and closing narrative. Sources are retained in `data/editorial-fixture-research.v1.json`. Accor Stadium and the NRL Grand Final team lists confirm 7:30 pm Sydney on 4 October: `2026-10-04T08:30:00.000Z`, after daylight saving starts. This is the sporting start, distinct from the entertainment programme.

The reported TIME TBC was reproduced through the shared fixture overlay merge: a retained date-only record supplied optional uncertainty flags missing from the new confirmed observation. A new exact, confirmed start now clears those inherited flags. Explicitly uncertain new observations retain TIME TBC. Canonical identities and saved-action aliases remain intact.

Regression checks assert the centred clock itself, rather than accepting a time somewhere in the editorial. They also assert opening and closing narrative, sporting-only Form, verbatim retained context, completed-card lifecycle, Feed/Schedule behaviour, NRLW artwork and viewing separation, four widths and both themes in Chromium and WebKit.

The canonical `node scripts/update-cards.js` scoped/resume path regenerated projections and passed its applicable gates. Its Stan discovery freshness gate required a manually reviewed public schedule snapshot dated 1 October; this is discovery evidence, not a replacement sporting-time authority or new ingestion scheduler. Generated changes also retain existing canonical aliases and normalise existing result/editorial projections. No account migration or scheduler change was made.

Release 339→340 browser upgrade rehearsals passed in Google Chrome, bundled Chromium and WebKit, preserving preferences and offline behaviour and rejecting a required-asset failure. One initial Chromium rehearsal timed out with a waiting worker; its unchanged repeat and the other browsers passed. Worker activation code was not changed. Physical installed-PWA behaviour is unverified; browser rehearsals are not device evidence. No historical waiver is used as a passing result.

Production SHA, deployment, public-artifact and rendered evidence are recorded separately under `/Users/jackhartican/Documents/AI/Codex/nrl-card-repair-2026-10-01`.

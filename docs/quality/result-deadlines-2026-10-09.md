# Correct result deadlines — 9 October 2026

The release check used a fixed Sydney UTC offset and could delay noticing a missing result by one hour during daylight saving. The actual Illawarra–Tasmania card reproduced this: its source start is 08:30 UTC and existing three-hour result window ends at 11:30 UTC, but the old check still reported zero due matches at 11:31. The correction uses source UTC first and Sydney’s actual daylight-saving rules for older local clocks.

Local implementation and verification are complete; GitHub publication and production proof are pending at this commit. The current site remains the previously verified ca2b9bae/shell470 until the next scoped release is independently verified. This document does not claim deployment ahead of its evidence.

## What changes and why

The existing check now catches missing results at the intended time, so a good-looking release cannot hide that gap for an extra hour. It does not infer a final score, completion or live play from a clock. Explicit source ends remain authoritative. Five-day Tests, ordinary durations, Feed exclusions, tournament overviews, ticket watches and result/provenance requirements remain. Invalid or ambiguous local clocks cannot establish unique deadlines. The same check remains in full canonical and normal production gates.

The stronger check caught Chicago White Sox–Cleveland still marked upcoming after its six-hour window. One request through the existing scoped MLB owner validated its explicit final and ordered **5–9** score. Both incoming and published records now contain that final. Eight other future postseason records update only from the same validated source response; unchanged finals keep their original source/result dates. Thirty-six MLB cards are reprojected, mostly neutral wording changes. No fixture is added and all 1,755 incoming and 1,756 published IDs survive; all non-MLB records are byte-identical. Unsupported future participants remain gaps, not invented games. Australian viewing remains unconfirmed for this source.

## Source exception and limits

The official FIA Sardegna check still times out at its existing fifteen-second deadline. The NRL Grand Final check validates its unchanged result. Both known-final attempts preserve all original result and Feed files exactly. The first local attempt omitted the diagnostic output variables, so a second invocation captured the actual failed-source reason. Each invocation makes two sequential bounded requests and no internal retry; total known-final calls are four. No additional source calls or retry policy are hidden by the report. The later scoped MLB refresh makes one official request.

Keep the last verified rally result, original date and visible source warning. Do not increase its timeout, add a provider or claim unattended recovery from this manual check. The next ordinary automatic update remains pending, as do the historical NHL source cause, full Football live/non-playing evidence, actual phone use, playback, independent recovery and material commercial permissions. Passwords/iCloud remains parked.

## Verification

- Existing timing regression goes red on the actual NBL clock before the fix and passes after it. Added cases cover UTC precedence, missing local fields, winter/summer, both DST transitions, final-day boundaries, explicit ends and malformed local clocks. All existing Test, exclusion, overview, ticket and provenance controls pass.
- Original captured NBL CLI input now fails with the correct missing-result deadline instead of falsely passing. This is an intentional rejection of a frozen upcoming card after its window, not a sporting-data update.
- Both complete current Feed inputs pass the corrected result check after the genuine MLB refresh. Existing MLB parser, paired/zero scores, conditional clocks, identity, failure and unchanged-final checks pass through the canonical route.
- Calendar and generated-shell checks pass. No cached shell, worker, HTML, runtime or browser module changes. No new API, database write, scheduler, polling, retry, credential, source adapter, subscription or owner routine.
- Ninety-six local actual mounted final/privacy cases pass in Chromium/WebKit, 320/390/1280 widths, both themes, Feed/Schedule, Results OFF/ON, per-event reveal and strict mode. APIs and workers are isolated; these are not physical-phone or ordinary-navigation proof. The first observer checked before the deferred score component had loaded and assumed a dashed score in Feed; that failure is retained. Final checks preload the actual component and assert the actual paired-team display.

## Recommendation

Advance the clock correction now: actual source time proves a gap that can hide missing results. Effort is one small release-check change, extending the existing regression and using the existing canonical MLB owner. Dependencies are current source evidence, stable identities and all normal release gates. Added cash commitment and standing owner tasks are zero; existing assistant/hosting costs remain unpriced. Acceptance requires the genuine clock repro, preserved policy/data, correct completed-result privacy, normal cloud checks and exact published snapshot/READY/alias/served/live proof. Defer any architecture rewrite or new source service; the current evidence supports this focused repair.

Full all-gate acceptance remains **0/16 families and 0/3 Football pilots**, targeting **at least 13/16 families**. Those counts do not mean the delivered accuracy improvements lack value. Continue the existing Football and carried-sport programme, rather than substituting this one clock check for complete certification or repeat-use evidence.

Evidence folder: `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/wrc-current-exception-20261009`. It retains the original reproduction, initial diagnostic omission, FIA exception and exact retention proof, current primary MLB persistence, both prior failures, final targeted checks and browser records.

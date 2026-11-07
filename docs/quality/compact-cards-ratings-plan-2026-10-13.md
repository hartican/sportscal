# Compact cards, Cricket summaries and ratings recovery

Jack approved this implementation on 13 October 2026 Sydney after the grill-me interview in **Fix tennis and cricket cards**.

## Approved behaviour

- Normal/expanded cards retain natural height. Cricket no longer forces compact state. Contained team frames match NRL/AFL/Football: 96px, or 80px below 360px; flags remain small.
- Cricket's native score-summary button has no underline, matches venue-label typography and retains accessible scorecard expansion. Use canonical participant labels, current published innings and match position. Remove repeated known gender/status wording conservatively, preserving source numbers, observations and unknown prose.
- Minimise all match and event/tournament overview cards in Feed, Events and Schedule to one fixed 56px line. Show 20px marks, approved short names, competition/format, sourced day/round and 24-hour time/status. Truncate names; omit format before progress when space is limited. Full dates/context remain accessible. Mount no scores, editorial, ratings, provider, venue or action bar; explicit calendar-selection mode retains its selection control.
- Row taps return to the normal selected card; score/More opens details. Dedicated overview row taps close prior Matches/Fixtures detail. Preserve saved card preferences and other draw selections. Match Centre keeps its scoreboard layout.
- Keep NB/APPROX. qualifiers, explicit Live/finished/pause/unknown states and expired-restart warnings. Never infer Test days, tournament totals, sporting clocks or completion.
- Failed ratings summary reads retry after successive waits of 30/60/120 seconds, then stop. Keep one centred manual Retry ratings button that immediately starts a fresh cycle. One shared timer/queue uses existing fifty-ID batching, in-flight coalescing and account-generation fences. Pause hidden/offline and suppress removed/minimised cards. Preserve last-good votes/totals; failure cannot establish zero ratings.

## Implementation and compatibility

The shared timing model owns row clocks/status. Ordinary, major, dedicated tennis and Events overview renderers use the same native row. Recovery is in the existing bundled NSC state module; write-store methods remain unchanged. Pure renderer/read functions use the synchronous app-shell bundle, preserving eight critical requests and the unchanged compressed/installed-shell limits. Version every changed cached asset for candidate 523 from live 522.

Preserve Feed admission/retention, canonical/alias identities, Results OFF, saved actions, edition follows and reminders. No endpoint, database migration, provider request, source scheduler or write retry. This explicitly authorises bounded foreground ratings-summary read recovery only.

## Verification and delivery

Test actual normal/minimised/expanded and dedicated renderers, source-safe score labels/current innings, typography, visible mark dimensions, long labels, combined tours, unknown/qualified/pause clocks, source refresh, cold deferred score loading, logo delay/failure and keyboard/focus. Exercise retry delays/exhaustion/manual races, retained values, foreground recovery, route removal and account changes.

Verify Chromium and WebKit at 320/390/1280px in both themes, all existing timing/identity/tennis/performance gates and both installed-update rehearsals. Retain failures and corrected receipts under `/Users/jackhartican/Documents/AI/Codex/compact-cards-ratings-2026-10-13`.

Implement from current main in an isolated worktree. **Audit Sportscal architecture** owns serialised publication/deployment; coordinate **Improve Match Centre reliability**. Publish one validated snapshot to GitHub main and Vercel production. Report exact-SHA READY deployment, hosted rendering and physical-iPhone evidence separately.

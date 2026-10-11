# Venue names and court context — 11 October 2026

The venue check now examines every tournament using a venue label. Previously, a reviewed first use could hide an unresolved later use: “Court 7” in New York concealed a separate Shanghai court. The repair keeps these identities separate, reviews supported new names and leaves uncertain courts pending.

## What people get

Cards can use clearer, checked grounds and ballpark names. Identically named courts at different tournaments have distinct identities. Original court labels remain visible where confirmation is missing. No match time, result, participant, source observation or saved choice was changed by this module.

## Reviewed evidence

This is a bounded identity review, not verification that every fixture was assigned to the right court. Nine baseball labels and nine tennis labels are now supported; city labels resolve to grounds only for the exact reviewed 2026 tournament. The registry adds thirteen grounds and scopes court identities to their tournament.

| Scope | Official evidence and conclusion |
| --- | --- |
| Nine ballparks | [MLB ballpark guide](https://www.mlb.com/fans/ballpark-guides/mlb): American Family Field, Daikin Park, Petco Park, Progressive Field, Rate Field, Tropicana Field, Truist Park, Dodger Stadium, Yankee Stadium. [Dodgers guide](https://www.mlb.com/dodgers/ballpark/information/guide) supports the current UNIQLO name; the familiar display name remains Dodger Stadium. Individual [Brewers](https://www.mlb.com/brewers/ballpark), [Astros](https://www.mlb.com/astros/ballpark) and [White Sox](https://www.mlb.com/whitesox/ballpark/information) pages provide additional checks. One subsequent guide request timed out; the earlier successful dated observation remains evidence. |
| Beijing | [WTA 2026 tournament](https://www.wtatennis.com/tournaments/1020/beijing/2026), [current official order of play](https://wtafiles.wtatennis.com/pdf/draws/2026/1020/OP.pdf), and dated tournament reports for [Brad Drewett](https://www.chinaopen.com/en/contents/353/676.html) and [Lotus](https://www.chinaopen.com/en/contents/353/694.html) support the grounds and three named courts. |
| Tokyo | [Official fact sheet](https://www.japanopentennis.com/atp/en/about/tournament-fact-sheet/) and [2026 order of play](https://www.protennislive.com/posting/2026/329/op.pdf) support Ariake grounds and Colosseum. Historical evidence for the sponsored show court is insufficient for current approval. |
| Shanghai | [Official tournament FAQ](https://en.rolexshanghaimasters.com/en/faqs) and [current 2026 order of play](https://www.protennislive.com/posting/2026/5014/op.pdf) support Qizhong grounds, Stadium Court, Grandstand 2, Show Court 3 and Court 4. Court 7 remains pending. |
| Wuhan | [Official WTA tournament](https://www.wtatennis.com/tournaments/WUHAN-open) supports Optics Valley grounds. A city label cannot establish an individual court. |

Eight court labels retain explicit current-tournament uncertainty: Court 1, Court 2, Court 3, Court 4, Court 5, Court 7, HSBC Moon and Kinoshita Group Show Court. Shanghai Court 4 is reviewed; Beijing Court 4 is pending. Missing, conflicting, wrong-year or wrong-sport tournament context and invented courts still fail the check. A familiar label alone does not receive an exemption.

The current feed has 367 distinct venue inputs: 301 identity-reviewed and 66 pending, across 398 qualified contexts. Pending includes previously recorded places, routes and placeholders; it does not mean 66 broken fixtures. All prior 150 registry entries, existing context aliases and review dispositions retain their exact public Node records.

## Checks and cost

- Red checks reproduced both the newly unclassified names and the first-use masking bug. Stricter review uncovered the previously hidden Shanghai Court 7. Focused negative controls prevent broad name-based waivers.
- `node scripts/update-cards.js -p --venue-review --local-only` passes all six steps through the canonical refresh owner. Mixed routes reject before any diagnostic write or child command. No provider calls, parallel refresh job, database migration or customer writes are added.
- The registry stores repeated defaults compactly and exposes only its existing resolver contract to the browser; the full inventory and audit remain available to Node checks. After merging the published scorecard work, the combined build first exceeded the frozen loading budget. Removing unused browser exports and one unused field restored the original gate without changing its limit.
- Final critical assets: eight requests, 430,918 compressed bytes against the fixed 425,600-byte baseline and 1.25% limit. This first snapshot had only two bytes of headroom. The subsequently combined shell 488 uses 430,881 bytes, leaving 39 bytes; later shell changes must earn space or justify a separately reviewed performance decision. No loading speed is inferred from size alone.
- Source/incoming feeds, Follow fixtures and sporting metadata remain byte-identical to published base `31e4a1336b1a39ee31b24e872762bbb54d28d6e8`. Original IDs, scores, clocks and source dates remain intact.
- Shell 487 passes normal cache checks and Chromium/WebKit upgrade rehearsals from published shell 486, including preferences, Remind OFF, offline data, optional-file failure and preservation of the last good shell when a required file fails. These are browser rehearsals, not physical iPhone evidence.

Six local Chromium/WebKit screen cases at 320, 390 and 1280 pixels pass, covering 42 actual fixture checks. Expanded cards show the supported venue display or official name, preserve source dates and saved choices, and avoid horizontal overflow. Two initial browser assertions incorrectly required the short name where the expanded card uses its official name; saved output established the cause and the assertion now accepts either supported name. Six hosted Chromium/WebKit cases also pass at the same widths, with 42 actual fixture checks and unchanged source dates and choices. The combined cached shell 487→488 rehearsals preserve preferences, Remind OFF and offline behaviour in both engines. Detailed logs, source receipt, exact persistence comparison, screen evidence and release proof are saved under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27/venue-context-review-20261011`.

## Programme and next action

The earlier sampled checks advance from 91/92 to 92/92 assessed as passing through bounded rechecks. This is not a new complete batch or a successful full-owner refresh. Football remains first; 0/17 carried families and 0/3 Football pilots are fully approved, targeting at least 14/17 families. Full-owner recovery, later ordinary overnight publication, current viewing/rights, real-phone use and repeat-use evidence remain separate.

The scoped repair is published and verified live. Run the existing full sports update next and verify its exact release. Business value: clearer locations and a stronger update check with fewer repeated investigations. Effort: this focused module plus one full-owner run; no reliable end-to-end completion estimate yet. Dependencies: normal release and current source gates. Added cash commitment: A$0; existing hosting and assistant usage remain unpriced. Owner time: no decision or routine added. Acceptance: separate court identities, honest pending labels, unchanged protected facts, passing budget/cache checks and exact live release proof. Defer broader court certification until current official evidence supports it; do not spend time inventing certainty.

## Exact release and recurring read failure

The first venue snapshot `15c1c05da5e1c71fbb514fec4b924ff9709bf8f2` passed the safety checks and reached READY in run 38097840601, then failed the required public Match Centre check because membership was a saved fallback. That terminal failure remains saved; it is not counted as a successful release. A separate read at 2026-10-11T00:25:38Z returned healthy membership with nine fixtures in 2,977 ms. The one-minute Supabase log sample recorded successful source-health and score reads but did not expose the failed bundle's cause; the three Postgres entries had normal SQL-state codes, and the scoped Vercel application-log search found no matching entries. These limits do not establish a cold-start, database or network diagnosis. Deadlines and release assertions remain unchanged; no request retry or scheduler was added.

The preserving combined snapshot `7a36a50f8fea33f0a09070b60a4c1468f5bf0326` passed normal serialized production run 38098265766, attempt 1, including fresh public Match Centre proof. Vercel `dpl_8Ps34QNgJVotzEk1ukfEjLi1taJB` is READY; all three aliases, shell 488, release metadata and 48 served paths match the sealed snapshot. Local and hosted venue screens pass six width/engine cases each. Its underlying tracked sports data and feeds are byte-identical to published base `31e4a1336b1a39ee31b24e872762bbb54d28d6e8`; the venue resolver, checks and canonical owner are unchanged from the reviewed venue module. The companion scorecard/tennis-link work has its own [source and verification record](full-scorecards-and-tournament-cards-2026-10-11.md).

The intermittent shared-read failure remains an open operational finding, with two dated occurrences. A passing subsequent release does not resolve its cause. Add safe failure diagnosis if it recurs; retain honest degraded states and the current fail-closed release proof. Full-owner recovery and later ordinary scheduled proof remain outstanding.

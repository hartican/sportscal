# Recognised teams and consistent Follow defaults — 12 October 2026

Implemented, published to GitHub main and deployed to Vercel production. Hosted acceptance passed.

Source commit: `033e44e78507298b1febb63bafa8f45e4e1ab93c` on parent `ed1536be1bd58658e5fcb6478085df222f9cd5cf`; shell 512. The managed implementation checkout is clean.

## Behaviour

- The shared unresolved-team check removes four AFL and eighteen AFLW bracket slots from public directories, and twenty-five identities from global search. It also protects retained directory rendering and old search decoding.
- Teams & Players is the combined section label for every sport. Teams appears first and opens on explicit section/Follow/Sports entry and sport/gender selection.
- With no recognised teams in the full sport/gender directory, individual competitors open and Teams remains visible, greyed out and disabled. Cricket retains its team-only view; individual labels remain sport-specific.
- Player List filters apply in the individual view and survive switching back. Search/List filters cannot disable a populated Teams tab. Redraw/follow changes retain the view. Profile Back restores Players, filters and focus through the existing return state.
- Raw fixture bracket labels, IDs, sporting choices, exclusions and notification choices remain intact. No API, data schema, backend, scheduler or source-adapter change.

## Local evidence

`local-acceptance.json` binds all twenty changed files to SHA-256 hashes and records:

- Fifteen static checks passed, including directory, policy, current Follow redraw, startup recovery, cache, generated runtime and frozen performance contracts.
- Original twenty-four Chromium/WebKit presentation cases passed, including native touch, delayed/unavailable reads and cold redraw recovery.
- Two new actual browser journeys passed with prior published AFLW/search payloads: real teams remain, placeholders cannot be followed, defaults/disabled Teams work, player Lists/All players work, row follows persist and profile Back restores focus.
- Normal 511-to-512 installed-browser upgrade and offline rehearsals passed in Chromium and WebKit. Both include the new Teams defaults and disabled-Team cases online and offline.
- Eight critical requests, 430,818 compressed critical bytes (1.23% growth within the unchanged 1.25% limit), 141 required cache assets/2.99 MiB, unchanged generated runtime of 65 modules/554,928 bytes.

The canonical `node scripts/update-cards.js --follow-ui --local-only` rebuild succeeded using the shared dependency runtime. Its unrelated regenerated freshness clocks and elapsed NBL projections were restored to keep this change scoped. The size overrun found during validation was resolved by removing the unused Follow screen handler and unused toggle read; the budget was preserved.

An initial search assertion expected zero fuzzy matches. Actual tolerant search legitimately matched other athletes; the final assertion checks that unresolved team identities never appear. The final acceptance results above follow that correction.

## Release review correction

The independent release review found raw canonical-name and placeholder flags were lost during directory normalization. The real normalizer now checks the resolved team type and raw evidence before projection; rejected records cannot enter builder collections. A real normalizer/collection red/green regression covers canonicalName TBD, explicit placeholder flags, metadata flags, legitimate named/numbered/zero-player teams and individual competitors. The corrected canonical rebuild and seven relevant static checks passed. Directory/search and application bytes are unchanged from the preceding browser-validated snapshot; exact source hashes were refreshed. The earlier unpublished pin was superseded.

## Production and hosted evidence

The exact source commit passed workflow [38193853642](https://github.com/hartican/sportscal/actions/runs/38193853642), attempt 1; successful job 114632156057 completed at 2026-10-12T02:06:03Z. Vercel deployment `dpl_5FqiEPcf64WMBVh19nTpM8WVyW1U` is READY at `sportscal-7mw37gtex-harticans-projects.vercel.app`. All three production aliases are bound to that deployment. The release owner verified 23 exact served Git/inventory files and seven packaged server dependencies. The third alias is protected; its alias binding is distinct from public rendering proof.

The prepared hosted probe passed all four Chromium/WebKit journeys: two with real anonymous API responses, two with controlled API failures. It verified the four changed UI/helper/worker JavaScript files against accepted source hashes, twenty recognised AFLW teams, absent bracket slots in search, Teams-first navigation, disabled Teams for Golf, remembered Lists, All players, row following and profile Back/focus. No page errors or attempted account writes occurred. Hosted rendering evidence is for https://nothingsport.vercel.app.

Receipts: `release-512/production-proof.json`, `hosted-verification.json`, `local-acceptance.json` and `final-status.json`.

## Limits

Installed-browser rehearsals and hosted checks are distinct from physical iPhone/Home Screen proof. No physical device or authenticated account was tested. Live sporting coverage is outside this directory/navigation change. The pre-existing extra startup-browser suite's stopped held-request precondition is documented in the prior release audit and its unexecuted cases are not claimed here.

## Business value and next work

People start with recognised teams and have fewer decisions when finding matches. Unknown bracket positions stay in fixtures without appearing as real teams to follow. The same shared rule protects the next update and retained discovery data. The existing saved sporting choices and original source dates remain intact.

| Action | Value and evidence | Effort, dependencies, cash and owner time | Acceptance and reason |
| --- | --- | --- | --- |
| Keep the delivered discovery improvement | Predictable navigation and trustworthy identities; all published directories, old payloads, source generation, browser/cache and exact live checks pass | Small shared filter/default change using current owners; A$0 new service commitment, existing assistant/runner/hosting costs unpriced; no new owner choice or routine | Named/numbered/national/zero-player teams survive; placeholders stay out; Players, Lists, Back and saved choices work. Act on the approved cross-sport improvement |
| Retain current Football screen evidence | Actual teams, all three tables, spoiler confirmation and Schedule work on this live version | Four genuine anonymous journeys at 320/390 across both browsers; current published facts reused, no provider refresh or new app patch | All 668 pilot fixtures and 92 table rows agree with published data; 59 EPL finals match its table totals. This is internal agreement, not a new independent organiser comparison |
| Target remaining Football and Rugby polish | Clear competition/round choices and discoverable Rugby appointments reduce confusion | Bounded native reproduction; existing source/decision records. Estimate a demonstrated repair, preserve budgets; no new provider, purchase or owner task | Prove the actual gap before changing it; keep unknown teams, times, viewing and outcomes honest |
| Close external launch proof separately | Physical use, permission and return visits decide launch readiness | Prepared device/cohort brief, existing unanswered owner questions and same quiet observer | Actual dated evidence, no duplicate question/monitor or manual rescue. Full approval stays 0/18 and 0/3 Football pilots, target 15/18 |

The existing observer is bound once to the actual successful job completion, 12 October at 02:06:03 UTC. Its target, recurrence and quiet notifications are preserved. It waits for the earliest genuine scheduled parent and automatic publication/release; this manual app release is separate evidence. No normal overnight result is claimed yet.

The original212candidate was never published. Independent Standards and Spec re-review cleared corrected033e after the actual normalizer regression. Its application/generated bytes match the earlier accepted 26 browser and two complete installed-update rehearsals. The normal release reran the required contracts and strict healthy public match-list check. All 23 served files are verified on the primary public alias; all three alias bindings are verified, with the protected third alias distinct from rendering proof.

Four additional genuine Football journeys pass on live 512. Results stay hidden until the approved confirmation, then tables restore. Previous observer failures used obsolete classes or omitted that confirmation; those failures remain recorded and no application fault was claimed from them in the final evidence. All 95 retained pilot finals, 668 fixture objects and 92 table rows retain their published facts and dates. This pass changes no provider observation or source mapping.

Physical iPhone, authenticated account, actual playback, source/asset rights, independent recovery and genuine repeat use remain separate. The wider CTO/MVP goal remains active. Confidence is high in scoped delivery and the tested behaviour; earlier header/database latency and old navigation/update timeouts remain unattributed.

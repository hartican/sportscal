# Two Football badge sources — bounded repair

**13 October 2026 · prepared locally; not published or deployed**

This project record is published for review. The code changes remain local and await the combined release.

The live version has badge assignments for all 84 pilot clubs. A controlled check of 45 published fixtures through its actual shared card constructor loads 82 distinct club badges. Celje and Sabah fall back to named letter icons because both configured image URLs return HTTP 404 HTML. The narrowed two-fixture command reproduces that failure with a non-zero exit. The other source-host groups and card frames work.

Replace only those two image references. Celje uses the file page's supplied 250-pixel thumbnail, instead of its 3,750-pixel original. Sabah uses the Azerbaijani club's own match badge. Both replacements load on the hosted origin in Chromium and WebKit and have light/dark preview evidence. The [Celje file page](https://commons.wikimedia.org/wiki/File:NK_Celje_logo.png) records an uploader CC0 dedication; this is separate from club-mark permission. The [Sabah club source](https://sabahfc.az/) establishes the Azerbaijani identity, rather than the Malaysian club or unrelated uses of the name. Full commercial permission stays open.

## Acceptance and scope

- Keep all sporting facts, fixture IDs, ordered participants, primary observation dates, results, standings, user choices, reminders and activity unchanged.
- Keep the existing provider crest observations dated 9 October. Store the later image review separately; it cannot renew sporting or team observations.
- Use exact carried participant IDs for the two reviewed marks. Add no title aliases, teams, competitions or following rules; an unknown/different Sabah or Celje must not inherit the artwork by name.
- Make the existing canonical Code projection prefer the reviewed references over retained old image fields. The ordinary OpenLigaDB owner uses the same reviewed source provenance when publishing later. Add no provider read, scheduler, polling, retry, credential, migration or owner routine.
- Rebuild retained projections through `node scripts/update-cards.js --code-projections --codes=football,champions-league -p`. Verify all Code/Schedule IDs and every non-artwork fixture field, and preserve provider dates. Do not force a source refresh.
- Verify both actual card constructors with the earlier published fixtures: the revised image loads, becomes visible and leaves no letter fallback. Keep the failed live observation, intermediate observer errors and passing local evidence separately.
- Assemble with the approved card module before publication. Regenerate its runtime, retain startup/cache limits, run the affected gates and installed update checks, then publish and deploy one exact passing snapshot. Hosted proof remains required.

## Current evidence and value

Local identity/provenance and original OpenLigaDB continuity checks pass. Both native browser engines load the two corrected badges through the actual Feed and Schedule constructors using the earlier published input, with no fallback or page error. All 690 Football and 156 Champions League fixtures in each Code/Schedule projection retain their IDs and every non-artwork field. No directory or alias expansion is made. The corrected startup check on the version-521 base passes at eight critical requests and 1.07%; the combined module must pass its own unchanged budget.

Independent Spec review found that an exact-ID artwork table alone did not fence the existing title fallback when a global participant context included the reviewed club. A populated-context regression reproduces the reviewed Celje identity attaching to both fixture sides when only the second side carries its ID. The correction requires a reviewed ID to appear in the fixture's IDs/slots and on the matching side before selecting its mark. Different-ID and title-only cases also pass; other clubs' existing fallback policy is unchanged. Red and green receipts are retained. Final Spec and Standards reviews report zero remaining actionable findings; these are static reviews. Combined release and hosted proof remain pending.

Business value: removes two visible polish failures and adds a guard against assigning the Azerbaijani badge to another club with the same name. Effort: small source and projection repair; final combined release remains pending. Dependencies: existing identities, reviewed metadata, canonical projection owner and card release gates. New cash: A$0 committed; existing assistant/runner cost remains unpriced. Owner impact: no new choice, account or routine. Acceptance: exact source correction, unchanged sporting/account behaviour, passing combined snapshot and dated live rendering. Act now because real missing files reproduce the problem; defer commercial clearance and whole-sport approval until their separate evidence exists.

Receipts: `/Users/jackhartican/Documents/AI/Codex/football-artwork-current-2026-10-13`. Read `diagnosis.json`, `reproduced-two-badges-red.log`, `retained-facts-comparison.json`, local browser receipts and source-preview receipts before repeating checks. This is controlled desktop browser evidence, not physical-phone or whole-sport certification. Full programme counts remain 0/3 Football pilots and 0/18 carried families.

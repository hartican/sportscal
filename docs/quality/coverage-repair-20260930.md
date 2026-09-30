# Coverage repair evidence — 30 September 2026

Implementation is a locally validated release candidate. No production release evidence is claimed here.

- Brumbies–Reds: Rugby Australia matchday schedule, 27 September, 14:35 AEST. https://www.rugby.com.au/news/watch-live-act-brumbies-queensland-reds-super-rugby-aus-video-live-stream-scores-2026927
- Force–Waratahs: Rugby Australia 27 September report confirms the 3 October final. Existing World Rugby fixture is retained, 16:30 Sydney. https://www.rugby.com.au/news/force-waratahs-rat-park-superrugby-aus-report-2026927
- CSA Invitation XI: CA40593 and ESPN1525658 share sides and start; CA identifies NWC Oval and 3–4 October two-day warm-up. Keep ESPN ID (existing saved activity), alias CA ID. South Africa Tests remain distinct. https://www.cricket.com.au/matches/series
- Bledisloe: official All Blacks and Eden Park identify one senior match, 10 October Eden Park 19:10 Auckland / 17:10 Sydney (06:10 UTC). Both existing IDs have saved activity. No private chat rooms exist for this pair at preflight; privacy boundaries must never be merged. https://edenpark.co.nz/events/all-blacks-v-australia-saturday-10-october-2026/ ; https://www.allblacks.com/team/all-blacks/bledisloe-cup
- Compliance Solutions Championship: Korn Ferry Tour H2026166, 1–4 October, Patriot Golf Club, Owasso. https://pgatourmedia.pgatourhq.com/tours/2026/kornferrytour/compliancesolutionschampionship
- Bank of Utah Championship: PGA Tour R2026554 already in the official source calendar, 1–4 October Black Desert Resort.
- BMW Australian PGA: 26–29 November, The Lakes Golf Club, Sydney. https://golf.com.au/pga-tour-schedule
- Dovizioso: Yamaha test/advisor agreement, published 19 June 2025. Profile only; no race-entry implication. https://www.motogp.com/en/news/2025/06/19/dovizioso-and-yamaha-pen-three-year-test-rider-and-advisory-role-deal/752259
- Singapore: official F1 Sprint announcement, 16 September 2025, identifies its first Sprint weekend on 9–11 October 2026. https://www.formula1.com/en/latest/article/formula-1-and-fia-announce-2026-sprint-calendar.3PyLPAazrBNe8kQIS3wOfY

Source-confirmed facts override approximate supplied times. Identity aliases require durable-data reconciliation before release; local display consolidation alone does not establish saved-action preservation.

## Candidate validation and release status

The canonical validator inventory passed 159/159 commands. Coverage and Match Centre refresh acceptance passed in Chromium/WebKit, with mobile/desktop and light/dark coverage. PWA upgrade simulations passed shell 236 to 339, offline fallback and preference preservation; they do not establish physical installed-PWA acceptance.

The migration passed two runs inside a rolled-back transaction, including SQL/client boundary parity, account convergence, earned-credit/history/chat preservation and prediction lead preservation. Production still has the original records; the migration has not been applied.

Physical installed-PWA acceptance remains an explicit release gate. Main publication, phase releases, production migration, READY deployment, alias/SHA and live rendering proof are pending. No historical waiver applies. The local request register remains Pending ranking.

## Release approval — 1 October 2026

The owner reviewed the candidate and instructed “Look good. Deploy it” after the outstanding physical installed-PWA gate was reported. Proceed with this approved candidate; physical-device acceptance remains unverified. Record migration inventories and exact production SHA/READY/alias/render evidence in the release report.

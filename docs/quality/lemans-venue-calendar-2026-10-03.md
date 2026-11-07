# Le Mans venue and published programme acceptance — 3 October 2026

Scope is the 24 Hours of Le Mans only. No other WEC race, support race, new results provider or live ingestion is added. The canonical refresh owner is `scripts/update-cards.js`; its scoped `--lemans-venues -p` path publishes the reviewed local source export and derived projections. Invalid/missing source exports leave the last verified canonical file untouched.

## Official programme and clocks

[FIA WEC 2026](https://www.fiawec.com/en/race/24-hours-of-le-mans-2026) and [2027](https://www.fiawec.com/en/race/24-hours-of-le-mans-2027) each publish twelve sessions. Separate Start and Finish identities yield thirteen Schedule records per edition and eight sporting Feed cards. Four practice sessions and warm-up per edition remain Schedule only, including when pinned. Same-day unconfirmed sessions retain source order without acquiring a sorting clock.

The visible 2027 timetable leaves eleven clocks TBC. Its structured-data noon placeholders do not establish starts. The confirmed race starts are 16:00 CEST on 13 June 2026 and 12 June 2027: 00:00 Sydney on the following day. Finish is an explicitly labelled approximation from that start plus 24 hours, not an independently confirmed finish clock. The 2026 ICS incorrectly labels local times UTC; the explicit +02:00 webpage clocks, concordant with the visible programme, take precedence.

Existing `evt_79` and `evt_80` remain the public/action identities. The canonical session aliases resolve to those IDs. Results, source/observation timestamps, editorial, participants and published 24-hour duration remain intact. Only reviewed timing, aliases and venue metadata are overlaid. Twenty-four new records fill the two editions' published programmes. All 1,409 unrelated prior fixtures are byte-equivalent as objects.

## Consent and presentation

The existing independent Le Mans Major Events choice admits qualifying, Hyperpole and the race milestones. Broad Motorsport and discovery do not grant consent. Exclusions remain authoritative, and a never-selected choice stays off. All new entries/results/viewing remain unconfirmed. The edition has one Events overview without rating controls; its Open schedule action routes to Le Mans rather than the parent Motorsport schedule.

The native white SVG follows only the [official FIA WEC circuit centreline](https://www.fiawec.com/uploads/2024-tracks-rvb-lemans-b-976827-697a1dbfdd5da760499701.png). Full Circuit de la Sarthe: 13.626 km, 38 turns, with Mulsanne chicanes. MotoGP's Bugatti configuration cannot resolve this artwork. Exterior and enclosed spaces are transparent; the coloured band and legend are removed. Existing complete ACO mark and Apache-licensed Sporticon helmet are retained. Individual authors, sources, rights, modifications and hashes are in `assets/identities/lemans/asset-manifest.json`; credits appear in footer and About.

F1 country palettes and 220px expanded/130px compact artwork geometry remain. Artwork and optional projections use the existing cache-on-use path; no optional asset is added to the shell precache. Shell 397 incorporates the concurrent source-reviewed UCL repair from current main.

## Retained WRC withdrawal

[FIA's 17 September revision](https://api.fia.com/news/fia-and-wrc-promoter-confirm-final-round-2026-fia-world-rally-championship) withdraws the WRC element of Saudi Arabia while retaining the separate MERC event. The already verified canonical cancellation now reaches the retained published fixture. Its ID and saved references remain; no MERC fixture is substituted and no complete unpublished 2027 WRC calendar is claimed.

## Verification

`validate-lemans-calendar.js --published` covers session separation, visible TBC precedence, offset conversion, labelled estimates, source correction with stable identity, failed-source preservation, duplicate prevention, aliases, explicit Follow/exclusions with client/server parity, verified configuration and native paths. `validate-lemans-venue-browser.js` passed 1,664 card cases across Chromium/WebKit, four widths (320/390/768/1280), both themes, expanded/compact states and Feed/detail. It also verifies Events routing, no parent ratings, fallback, full Schedule, Follow branding and footer/About credits.

Normal identity, Follow, coverage, viewing, canonical-owner, runtime, performance, shell and cache contracts pass. Both installed-browser upgrade rehearsals use the independently verified production shell 396 (`f165006c620c06a58db36f607d7cb911dee44081`) as baseline; offline checks include the Sarthe SVG, complete programme, original Finish alias, consent and unconfirmed clocks. Browser rehearsals do not constitute physical iOS Home Screen acceptance.

Local acceptance alone is not a production claim. Exact GitHub/main SHA, Vercel READY state, alias assignment, public asset bytes and public browser results are recorded separately in the saved release review after deployment.

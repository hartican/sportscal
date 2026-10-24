# Grouped sports cards and Follow cleanup

Authoritative implementation contract: the user-approved plan in this chat, 24 October 2026 Sydney. This record condenses that plan without changing scope.

- Isolated branch `codex/multisession-sports-follow-20261024` from current main. One tested draft PR and DEPLOY handover; stop at Ready. No main publication, production deployment, production data/account operation or independent scheduler.
- F1, MotoGP, Supercars and selected golf tournaments share a stable parent event identity, canonical child sessions and one appearance per active Sydney day. Feed and Follow/Schedule group; Match Centre, All Sports and calendar UIDs remain flat. Sort by that day's earliest start even after it passes. Entirely TBC days sort after timed fixtures.
- Every day's session times are clearly separated. Expand the full event; exact child deep links, results, ratings, discussion, highlights and saved actions remain separate. Practice is present but unrated in UI and API.
- Reminder presets require explicit activation. Initial choices are races/sprints and golf's final round. Individual choices and global OFF win. Keep fifteen-minute leads and existing dispatcher/inventory limits; reconcile presets in a seven-day horizon. No TBC reminder delivery or cancelled-session delivery.
- Golf priority: Masters, PGA Championship, U.S. Open, The Open, The Players, Australian Open and Australian PGA in the existing twelve-month horizon. First official tee time per round, broadcast clocks labelled separately. Broad Golf admits majors only; other three require explicit selection. Source and edition-bound course artwork for majors only; logo/glyph fallback and named gaps are accepted.
- Supercars: official next three months, including active meetings, practice/qualifying/races; unpublished times remain TBC. One reminder on 24 November 2026 at 9am Sydney asks the user to request twelve-month coverage; it grants no implementation authority.
- Rugby: Champions Cup, Top 14, PREM Rugby, URC, Currie Cup Premier and NPC fixtures/logos/clubs. No SA Cup. Preserve current senior internationals including women, Australian domestic and Super Rugby. New competitions start unfollowed.
- Cricket: current twelve men's nations, six Australian states (Shield/One Day Cup), BBL and Australia Women's senior internationals. Preserve necessary counterpart identities without admitting unrelated women's competitions.
- Retire other Rugby/Cricket from active ingestion, search, Follow and future Feed, including previously followed coverage. Retain history, aliases and saved choices recoverably; no account purge.
- Adaptive seven-plus-More shortcuts remain. Sports are the parent palette, with consistent labels/icons independent of gender; competitions are children. Sport then gender then competition/participants. Remember gender per sport, initially All supported/Open. Browse cannot follow or inherit other genders/siblings. No default trophies.
- Use only the canonical update-cards entrypoint, with scoped local builds. Preserve request-register history/counts/ranking and update Follow decisions with regression tests.
- Validate grouping/pagination/date/DST/rescheduling/TBC/deep links, child identity/state and phase isolation; reminder overrides/OFF/cancellation/dedupe/budgets; coverage membership/retirement/assets/admission; Chromium/WebKit 320/390/768/1280 in both themes; relevant Follow, notification, startup and generated checks. Final-head Standards and Spec reviews are required.
- DEPLOY owns combined generated versions, release qualification and deployment. Flag SYNC, LOADING, PUBFEED and ALLSPORTS seams. Handover includes exact base/head, draft PR, tests/screenshots, gaps, migrations, rollback and separate hosted/device gates.

Visual thesis: retain Nothing Sport's restrained fixture card, circuit/course artwork and colour language; a readable timetable is the main content.
Content order: event identity and venue, today's timed rows, full-event disclosure, reminder preferences, selected session details.
Interactions: native disclosures and existing session controls, with reduced-motion-compatible behaviour; no decorative animation.

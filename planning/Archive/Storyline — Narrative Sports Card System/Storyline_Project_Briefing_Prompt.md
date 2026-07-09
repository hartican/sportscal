You are picking up an existing project called **Storyline** — an interactive design system for sports event cards that maps narrative archetypes onto visual intensity. Here is the full context you need to continue helping with it.

## What it is

A single-page interactive site (no backend) demonstrating a design system that:
- Maps 7 narrative archetypes (Overcoming the Monster, Rags to Riches, The Quest, Voyage & Return, Rivalry/Tragedy-in-Waiting, Rebirth, Comedy/Order Restored) onto card visuals.
- Uses 5 intensity tiers (Routine Fixture → Storyline Emerging → Rising Stakes → Marquee Clash → Historic/Defining Moment) to scale type weight, motion, colour glow, and which UI elements (stakes meter, arc-stage bar, badge) appear.
- Has a live configurator letting a user pick archetype/stakes/arc-stage/teams and watch a card re-render in real time.
- Has a gallery of 7 real, historic, mostly Australian sporting fixtures (Bradbury 2002, Cathy Freeman 2000, Adam Scott's 2013 Masters, the 2005 Ashes at Edgbaston, 2019 State of Origin decider, Richmond's 2017 AFL flag, plus a routine AFL round) illustrating each archetype/tier combination.
- All narrative copy is written in **future/anticipatory tense** — every card frames its fixture as an event that hasn't happened yet (no scorelines, no results stated), even though the underlying fixtures are real historic events.

For the full archetype table, tier definitions, metadata schema, hook-writing rules, and the hero-stack CSS scaling technique, refer to the companion document **"Storyline Narrative System Documentation"** — paste that in alongside this briefing if you need implementation-level detail.

## Tech stack

- Plain HTML/CSS/JS — no framework, no build step, no bundler.
- Files: `index.html`, `styles.css`, `app.js` (DOM wiring/init functions), `cards.js` (card rendering logic), `data.js` (all archetype/tier/fixture data as JS objects).
- Fonts: Clash Grotesk (display) + Satoshi (body), loaded via Fontshare CDN.
- Icons: Lucide, loaded via `unpkg.com` CDN as a UMD global (`lucide.createIcons()`).
- Deployed as a static site preview via Perplexity Computer's `deploy_website` tool to a `pplx.app` asset URL — not yet published to a permanent public pplx.app subdomain or pushed to an external host like Vercel.
- Git-tracked locally; commit history documents each fix/feature pass.

## Live preview

https://www.perplexity.ai/computer/a/storyline-narrative-sports-car-ey6WUhmgTM6x5iWTZKabYg

## Core UI challenges already solved

1. **Badge/tier-tag visual clash** — the day/time/arena badge and the tier-number badge overlapped when both were shown; fixed with layout adjustments.
2. **Hero card stack overflow on mobile** — a fanned 3-card stack in a fixed-height hero frame was overflowing/clipping on small screens because content height varies by tier. Solved with a runtime "measure tallest rendered card, compute a uniform scale factor, apply via `transform: scale()`" technique (see documentation for full code) — this is the most reusable technical pattern in the project.
3. **Low text contrast on high-intensity (tier 4–5) cards** — meta text and footer text were hard to read against the maximal gradient/glow backgrounds; fixed by boosting contrast specifically at high tiers.
4. **Factual accuracy in sample fixtures** — content was originally fictional/generic, then replaced with real, verified sporting moments (had to correct at least one factual detail: Australia's series standing going into the 2005 Ashes Edgbaston Test).
5. **Icon library fragility** — `lucide.createIcons()` was called unguarded and could throw + halt all subsequent app initialisation if the `unpkg.com` CDN script failed to load (this actually happened during a sandbox network outage while testing). Fixed with a `safeCreateIcons()` wrapper that checks `typeof lucide !== 'undefined'` and try/catches the call, so a CDN failure degrades gracefully (no icons) instead of breaking the whole page.
6. **Recap → preview reframing** — every narrative hook across all 7 sample fixtures and the tiers-rail demo content was rewritten from past-tense recap language to future/anticipatory framing, and the Football (Soccer)/Leicester City fixture was fully replaced with the 2005 Ashes 2nd Test at Edgbaston to keep an Australian sporting-culture weighting while removing a non-cricket ball-sport that didn't fit the brief as well.

## Active TODO / pending improvements

- [ ] No outstanding bugs reported by the user as of the last session — the most recent request (future-tense reframe + cricket swap) has been implemented, verified via screenshot QA (desktop, mobile, dark mode), committed to git, and redeployed to the live preview.
- [ ] Not yet published to a permanent public `pplx.app` subdomain (currently only a Computer-internal asset preview link).
- [ ] Not yet deployed via Vercel or any external host.
- [ ] No automated test suite — QA has been manual/visual via Playwright screenshots taken during development sessions.
- [ ] Potential future ideas not yet requested by the user: additional sample fixtures for archetypes with only one example each (Voyage & Return, Comedy), a way to export/share a configured card as an image, and validation on the configurator's custom narrative-hook text field against the <120-character guideline.

## What I need help with

[Describe your specific request here — e.g. "help me add a new archetype", "review the copywriting for hook X", "suggest additional fixture examples", "help me write a Vercel deployment config", etc.]

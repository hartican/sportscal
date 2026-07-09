Because Plan Mode is still active, I can’t create the file yet. Here is the full handoff content I have for onboarding Codex into Sportscal.

```md
# Sportscal Codex Onboarding Handoff

## Project Identity

Project: SportsCal / Sportscal  
Repo path: `/Users/jackhartican/Documents/AI/Perplexity/Sportscal`  
Git remote: `https://github.com/hartican/sportscal.git`  
Branch observed: `main`  
Deployment target: Existing Vercel project linked through `.vercel/project.json`

SportsCal is a spoiler-free sports calendar and watch-planning app for Sydney/Australia-time users. It is intended for easy sharing with friends, without paid backend services, native apps, user accounts, or cross-device sync for now.

The product should feel like a premium scheduling and viewing planner, not a live-score app.

## Current Repo State

The app is currently centred on `index.html`, originally a single-file static HTML/CSS/JS app.

Known current files/state observed:
- `index.html`: primary app.
- `sports_calendar.html`: deleted in working tree.
- `vercel.json`: untracked; redirects `/sports_calendar.html` to `/`.
- `404.html`: untracked; fallback/moved-page page.
- `planning/pipeline.md`: untracked planning file.
- `planning/sportscal_storyline_handoff_context.md`: Storyline context handoff.
- `AGENTS.md`: untracked project instructions.
- `.DS_Store`: untracked; should not be committed.

Observed Git status:
- `D sports_calendar.html`
- `?? .DS_Store`
- `?? 404.html`
- `?? AGENTS.md`
- `?? planning/`
- `?? vercel.json`

Repo hygiene recommendation:
- Commit app source, `vercel.json`, `404.html`, `AGENTS.md`, `planning/pipeline.md`, and `planning/sportscal_storyline_handoff_context.md`.
- Ignore `.DS_Store`.
- Ignore planning zip archives.
- Do not commit large zip files.

## Product Direction

Build SportsCal as:
- static
- mobile-first
- spoiler-free
- local-device persistent
- shareable by URL
- installable as a PWA
- free to host
- useful for a small group of friends

Avoid for now:
- paid backend
- native app
- accounts/login
- cross-device sync
- Supabase/Firebase/database
- React/Vite unless later scale demands it
- live scores/results/winner fields

The user selected these implementation defaults:
1. Static modular app, split into small JS/CSS/data files, no React/build dependency.
2. Versioned `localStorage` wrapper with quota-safe writes.
3. Commit to `main`, push to GitHub origin, rely on existing Vercel deployment.

## Existing App Behaviour

Current app already has:
- dark visual style
- sticky header
- tabs: Calendar and Must Watch
- sport filter pills
- list view
- month view
- event cards
- expected spectacle rating
- actual spectacle rating via star clicks
- localStorage ratings under `jacksSportsCalendar_actualRatings_v1`
- ICS calendar export
- live/upcoming/past badge logic
- static `EVENTS` dataset

Current event dataset includes sports such as:
- Tennis / Wimbledon
- Rugby / Wallabies
- Football / FIFA World Cup
- F1
- Tour de France
- Masters Golf
- NBA Finals
- Super Bowl
- Le Mans
- NRL
- Cricket
- Ski / Alpine / Freestyle-style events

Known current weaknesses:
- all app logic/data/styles are in one HTML file
- duplicate file existed as `sports_calendar.html`
- no app manifest
- no service worker
- no offline shell
- no mobile install flow
- no structured data libraries
- no onboarding
- no preference state except ratings
- no broadcaster-aware filtering
- no tests or validation script
- timezone handling is inconsistent: app says AEST, export uses `Australia/Sydney` concepts

## Target Architecture

Use static modular vanilla files.

Recommended structure:
- `index.html`
- `src/styles.css`
- `src/data/events.js`
- `src/data/sports.js`
- `src/data/broadcasters.js`
- `src/data/storyline.js`
- `src/state/storage.js`
- `src/state/preferences.js`
- `src/filters/applyFilters.js`
- `src/ui/onboarding.js`
- `src/ui/calendar.js`
- `src/ui/cards.js`
- `src/ui/storylineCards.js`
- `src/ui/settings.js`
- `src/export/ics.js`
- `manifest.webmanifest`
- `service-worker.js`
- icons under a small public/assets path

No bundler required. Use native ES modules.

## Persistence Plan

Use versioned localStorage keys:
- `sportscal:v1:preferences`
- `sportscal:v1:ratings`

Migrate old ratings once from:
- `jacksSportsCalendar_actualRatings_v1`

Do not delete the old key during migration.

Persist:
- onboarding complete
- followed sports
- available broadcasters
- sport-specific filters
- actual spectacle ratings

Do not persist:
- full event dataset
- large athlete databases
- images
- downloaded fixture archives

Storage wrapper requirements:
- `try/catch` around reads/writes
- default values when unavailable
- quota failure handling
- schema version support
- reset preferences action
- export preferences action
- import preferences action

## Onboarding Flow

First run should show onboarding before the main calendar.

Steps:
1. Pick favourite sports.
2. Pick available broadcasters.
3. Configure optional sport-specific filters.
4. Enter main calendar.

Settings should reopen the same flow later.

Sports picker should include supported sport cards:
- Tennis
- Rugby
- Football / Soccer World Cup
- F1
- Le Tour de France
- Masters Golf
- Cricket
- NBA Finals
- Super Bowl
- Le Mans
- Rugby League
- Alpine Skiing
- Freestyle Skiing

Also include disabled cards labelled “Coming Soon...” for future sports.

Broadcaster picker should include:
- Kayo Sports
- Stan Sport
- SBS On Demand
- Nine / 9Now
- Foxtel
- ABC
- 7plus
- 10

Future/international providers may be modelled but should not drive inclusion until real event mappings exist:
- Sky Sports
- Canal+
- Eurosport
- VPN / international access

Important: only map events to providers already evidenced in current data.

## Data Model Plan

Keep current event records working, but enrich them.

Add config libraries:
- `SPORTS_LIBRARY`
- `BROADCASTER_LIBRARY`
- `FILTER_SCHEMAS`
- `ATHLETE_LIBRARY`
- `STORYLINE_ARCHETYPES`
- `STORYLINE_INTENSITY_TIERS`

Each event should move toward:
- `sportId`
- `broadcasterIds`
- `expectedSpectacle`
- `gender`
- `eventType`
- `round`
- `athletes`
- `teams`
- `nationalities`
- `specialTags`
- optional `storyline`

Preserve legacy fields during transition:
- `sport`
- `key`
- `name`
- `date`
- `time`
- `broadcaster`
- `expected`
- `venue`
- `liveWindow`
- `id`

## Filtering Rules

Visibility order:
1. followed sports
2. selected broadcasters
3. sport-specific filters
4. current tab/view
5. must-watch/storyline derivation

Rules:
- If a sport is not followed, hide its events.
- If none of an event’s broadcasters match selected broadcasters, hide it.
- If sport-specific filters are active, only apply filters where metadata exists.
- Missing deep metadata must not silently hide everything.
- Empty states should explain why no events are visible and offer “Edit preferences”.

## Sport-Specific Filters

Tennis is the first full implementation:
- Men / Women / Both
- Singles / Doubles / Both
- athlete names
- nationality
- knockout round
- wheelchair/special category

Search appears automatically when a subcategory has 50+ entries.

Other sports get scaffold schemas only:
- Football: team/nationality, knockout round
- Rugby: team/nationality
- F1: driver, constructor, session type
- Cycling: rider, team, stage type
- Skiing: athlete, discipline, men/women
- Cricket: team, format, men/women where relevant

## Must-Watch Logic

Keep spoiler-free.

Pre-event:
- Must-watch if expected spectacle `>= 8`.

Post-event replay promotion:
- actual spectacle `> 8`, or
- actual spectacle at least `expected + 2`.

UI copy should use:
- “Expected spectacle: 8/10”
- “Actual spectacle: 9/10”
- “Promoted to must-watch replay”

Avoid:
- scores
- winners
- losers
- “upset”
- “result”
- outcome-based language unless explicitly spoiler-gated

## Storyline Narrative Card System

Use:
`/Users/jackhartican/Documents/AI/Perplexity/Sportscal/planning/sportscal_storyline_handoff_context.md`

Storyline should be integrated as a narrative enrichment layer, not a replacement UI.

SportsCal remains:
- calendar
- planner
- preference/filter system
- broadcaster-aware watch guide

Storyline provides:
- narrative significance
- spoiler-safe preview hooks
- visual hierarchy
- “why this matters”
- marquee card rendering for high-value events

Storyline defines seven archetypes:
- Overcoming the Monster
- Rags to Riches
- The Quest
- Voyage & Return
- Rivalry / Tragedy-in-Waiting
- Rebirth
- Comedy / Order Restored

Internally model them as:
- `monster`
- `ragsToRiches`
- `quest`
- `voyageReturn`
- `rivalry`
- `rebirth`
- `comedy`

Storyline defines five intensity tiers:
1. routine fixture
2. notable fixture
3. meaningful event
4. major storyline
5. historic / defining moment

Core Storyline fields:
- `archetype`
- `arcStage`
- `stakes`
- `characterArchetypes`
- `narrativeHook`
- `intensity`
- `intensitySource`
- `lastReviewedAt`

Recommended nested event shape:
```js
storyline: {
  archetype: 'rivalry',
  arcStage: 'climax',
  stakes: 'high',
  characterArchetypes: ['rival', 'veteran'],
  narrativeHook: 'A rivalry chapter with finals-level stakes.',
  intensity: 4,
  intensitySource: 'manual',
  lastReviewedAt: '2026-07-08'
}
```

Initial Storyline scope:
- tennis late rounds/finals
- NBA Finals
- major cricket Tests
- Masters final rounds
- Wallabies Tests
- NRL finals
- Le Mans
- Super Bowl

Do not narrativise every event at first.

First visible Storyline surface:
- “Top Storylines This Week” inside the Must Watch experience.

Card modes:
- compact
- standard
- marquee

Use plain public labels:
- “Rivalry”
- “Record Chase”
- “Must Watch”
- “Defining Moment”
- “Finals Stakes”

Keep richer taxonomy internal.

Storyline risks:
- over-tagging
- over-designing routine fixtures
- confusing editorial narrative with factual data
- making the calendar less scannable
- introducing accidental spoilers

Design rule:
Routine events and defining moments must not visually compete.

## PWA Plan

Add:
- `manifest.webmanifest`
- app icons, at least 192 and 512 sizes
- theme colour
- mobile metadata
- service worker
- offline shell
- app update prompt if useful

Cache:
- HTML
- CSS
- JS modules
- icons
- small static data files

Do not aggressively cache:
- large future datasets
- media
- generated exports

The app should work after first load without network.

## Timezone Direction

Product should be Sydney/Australia-time-first.

Current issue:
- UI says AEST.
- Sydney uses AEST/AEDT.
- ICS code mixes fixed UTC+10 assumptions with `Australia/Sydney`.

Recommendation:
- Use “Sydney time” in user-facing copy where possible.
- Store or derive event datetimes consistently.
- ICS export should use `TZID=Australia/Sydney` consistently.
- Avoid pretending Sydney is fixed AEST year-round.

## Deployment Plan

Use existing Vercel project.

Steps for implementation session:
1. Make app changes.
2. Run validation/manual checks.
3. Selectively stage app files.
4. Commit to `main`.
5. Push to `origin`.
6. Let Vercel Git integration deploy production.
7. Confirm production URL loads.
8. Confirm `/sports_calendar.html` redirects.
9. Confirm service worker does not serve stale broken assets.

Do not create a new Vercel project.

## Verification Checklist

Static:
- JS modules parse.
- Event IDs are unique.
- Sport IDs are valid.
- Broadcaster IDs are valid.
- Storyline archetypes/intensity values are valid.
- Storage fallback works.
- Old ratings migration works.

Browser:
- first-run onboarding appears
- settings reopens onboarding
- sport selection changes visible events
- broadcaster selection changes visible events
- tennis filters work
- ratings persist after refresh
- Must Watch remains spoiler-free
- Top Storylines remains spoiler-free
- narrative cards render enriched and unenriched events
- ICS export still downloads
- offline reload works after first visit

Mobile:
- test around 390px width
- no horizontal scroll
- no clipped controls
- touch targets usable
- onboarding usable
- cards readable
- month grid usable enough
- narrative rail does not overflow

Deployment:
- GitHub push succeeds
- Vercel deployment completes
- production page loads
- redirect works
- PWA metadata present

## Important Constraints

Do not:
- implement paid services
- add native app work
- add login/accounts
- add score/result fields
- introduce spoilers
- overbuild with framework tooling
- commit `.DS_Store`
- commit large zip archives
- overwrite unrelated user changes

Do:
- respect existing uncommitted changes
- work with `index.html` as canonical
- preserve current event-card experience where practical
- prioritise architecture, persistence, onboarding, filtering, and PWA reliability
- integrate Storyline carefully and selectively
```
# nothingSport phased implementation spec

## Purpose

This document defines a phased implementation plan for nothingSport / SportsCal so Codex can build the system incrementally. The target product direction is a spoiler-safe sports planner and event tracker with broadcaster-aware viewing, must-watch logic, and narrative preview cards layered on top of a canonical event model.[cite:1]

The main shift in this spec is from a narrowly curated event calendar to a broad, broadcaster-shaped event universe: ingest widely, normalize into a canonical catalogue, and then selectively rank events into the user-facing feed.[cite:1] This protects the product promise of “only what matters” while avoiding holes such as the current Toronto WTA 1000 omission.[cite:40][cite:41][cite:46]

## Product principles

- Separate **truth** from **interpretation**. The canonical event layer owns factual data such as sport, competition, participants, venue, start time, round, and broadcasters.[cite:1]
- Keep narrative and ranking as an optional enrichment layer via nested storyline metadata rather than mutating base event truth.[cite:1]
- Ingest broadly, display selectively. The full catalogue may be exhaustive; the feed should not feel exhaustive.[cite:1]
- Maintain spoiler safety. Pre-event copy, stakes, and recommendation logic must remain separate from post-event results.[cite:1]
- Use broadcaster data as a coverage-discovery layer, not the sole source of fixture truth.[cite:3]
- Respect explicit user intent above recommendation novelty; deliberate unfollows and repeated dislikes must suppress discovery cards.

### MVP source-acquisition policy

- For the personal-use MVP, automated collection may scrape publicly accessible internet pages even when the publisher has not explicitly granted automation permission.
- Do not bypass authentication, paywalls, CAPTCHAs or other technical access controls.
- First-party and explicitly permitted sources are treated as verified. Other automatically collected reporting is admissible as unverified input and must be visibly labelled `Unverified source` wherever it reaches the product.
- Unverified claims must not overwrite conflicting verified fixture, timing or result facts.
- Before the product becomes commercial, review this acquisition policy and procure paid feeds where appropriate. Paid feeds are a future monetisation dependency, not an MVP blocker.

## Scope changes to implement

### 1. Tennis coverage becomes broader and more reliable

Tennis should be a top-level sport with ATP and WTA treated as equal first-class tours. Coverage should not be limited to Slams; active ATP Masters 1000 and WTA 1000 events must be eligible by default, which would have caught Toronto.[cite:40][cite:41][cite:46]

Coverage should include:

- All ATP Top 50 singles athletes.
- All WTA Top 50 singles athletes.
- All Australian players regardless of ranking.
- Grand Slams, ATP Masters 1000, WTA 1000, ATP/WTA 500, ATP/WTA Finals, Davis Cup, Billie Jean King Cup.
- Optional long-tail expansion at higher froth settings, including selected 250s, Challengers, and emerging-player cards.

### 2. Taxonomy becomes hierarchical instead of flat

The filter system should move from mixed categories and one-off event names to a sport hierarchy of **sport → discipline → competition/tour → event series / event**. One-off events like Goodwood Festival of Speed should be modelled as events or event-series objects inside Motorsport rather than as root-level categories.

### 3. Coverage discovery becomes broadcaster-led

A weekly scan should detect what is actually on across major rights holders and sports broadcasters, then compare it against the canonical catalogue and produce a report of candidate events to add or review. Broadcaster data helps shape the breadth of the catalogue, especially in long-tail sports and seasonal windows.[cite:3]

### 4. Discovery becomes intentional, not random

The recommendation engine should occasionally surface unfollowed sports or competitions, but only under controlled conditions: similar-user affinity, narrative similarity, universal stakes, or strong Australian relevance. Explicit unfollows or strong negative behaviour must suppress these cards.

## Target architecture

Use three layers:

1. **Canonical event layer** for hard facts.[cite:1]
2. **Availability layer** for AU watchability, services, and cost model.[cite:3]
3. **Storyline / ranking layer** for stakes, arc stage, intensity, discovery logic, and feed ranking.[cite:1]

### Canonical event model

```ts
type Sport =
  | 'tennis'
  | 'football'
  | 'rugby_league'
  | 'rugby_union'
  | 'cricket'
  | 'motorsport'
  | 'combat_sports'
  | 'cycling'
  | 'winter_sports'
  | 'golf'
  | 'horse_racing'
  | 'basketball'
  | 'american_football'
  | 'multi_sport';

type EventState = 'scheduled' | 'live' | 'postponed' | 'cancelled' | 'finished';

type BroadcastType = 'free' | 'included' | 'ppv' | 'radio' | 'highlights';

interface Participant {
  id: string;
  name: string;
  shortName?: string;
  type: 'team' | 'athlete' | 'driver' | 'fighter' | 'pair';
  countryCode?: string;
  role?: string;
}

interface Venue {
  name: string;
  city?: string;
  state?: string;
  countryCode: string;
  tz: string;
}

interface BroadcastOption {
  platform: string;
  type: BroadcastType;
  channel?: string;
  region: 'AU';
  deeplink?: string;
  notes?: string;
  confidence?: number;
}

interface AuViewingMeta {
  startTimeAest: string;
  friendlyWindow: 'breakfast' | 'daytime' | 'primetime' | 'late_night' | 'overnight';
  isFreeToWatchAu: boolean;
  isIncludedWithSubscriptionAu: boolean;
  isPpvAu: boolean;
  primaryPlatformAu?: string;
  platformsAu: string[];
}

interface CanonicalSportEvent {
  id: string;
  sourceIds?: Record<string, string>;
  sport: Sport;
  disciplineId: string;
  competitionId: string;
  eventSeriesId?: string;
  title: string;
  subtitle?: string;
  season?: string;
  round?: string;
  stage?: string;
  participants: Participant[];
  startTimeUtc: string;
  endTimeUtc?: string;
  venue?: Venue;
  status: EventState;
  countryFocus?: 'AU' | 'INTL';
  australianInterestScore?: number;
  broadcasts: BroadcastOption[];
  auViewing?: AuViewingMeta;
  tags?: string[];
  updatedAt: string;
}
```

### Storyline / ranking layer

```ts
interface EventStoryline {
  stakes?: 'low' | 'medium' | 'high' | 'critical';
  arcStage?: 'inciting' | 'rising' | 'climax' | 'resolution';
  intensity?: 1 | 2 | 3 | 4 | 5;
  archetype?: 'rivalry' | 'quest' | 'record_chase' | 'title_decider' | 'derby';
  narrativeHook?: string;
  intensitySource?: 'computed' | 'manual';
  lastReviewedAt?: string;
}

interface RecommendationSignals {
  explicitFollowScore: number;
  athleteAffinityScore: number;
  similarUserAffinityScore: number;
  narrativeAffinityScore: number;
  stakesScore: number;
  australiaRelevanceScore: number;
  availabilityScore: number;
  timeFitScore: number;
  noveltyScore: number;
  negativePreferencePenalty: number;
  explicitUnfollowPenalty: number;
}
```

## Taxonomy design

Implement taxonomy as a dedicated graph/table instead of encoding hierarchy in labels.

```ts
interface TaxonomyNode {
  id: string;
  label: string;
  level: 'sport' | 'discipline' | 'competition' | 'event_series';
  parentId?: string;
  aliases?: string[];
  active?: boolean;
}
```

### Initial hierarchy

| Sport | Discipline | Competition / tour examples |
|---|---|---|
| Tennis | Professional tennis | ATP Tour, WTA Tour, Grand Slams, Davis Cup, Billie Jean King Cup |
| Football | International, club football | FIFA, AFC, A-Leagues, Premier League, UEFA |
| Rugby league | Domestic, representative, international | NRL, NRLW, State of Origin, RLWC |
| Rugby union | Test, club, sevens | Wallabies, Rugby Championship, Bledisloe, Super Rugby, Six Nations |
| Cricket | Men’s, women’s, format-based | Tests, ODIs, T20Is, BBL, WBBL, IPL |
| Motorsport | Open wheel, motorcycle, touring, endurance, culture | F1, MotoGP, Supercars, WEC, NASCAR, Goodwood |
| Combat sports | Boxing, MMA, kickboxing, grappling | UFC, PFL, ONE, boxing promotions, Eternal MMA |
| Cycling | Road, track, MTB, BMX | WorldTour, Grand Tours, Monuments |
| Winter sports | Alpine, freestyle, Nordic, ice | FIS Alpine, FIS Freestyle, Biathlon |
| Golf | Men’s, women’s, team | PGA Tour, LPGA, DP World Tour, majors |
| Horse racing | Thoroughbred, harness | Spring Carnival, Everest, Melbourne Cup Carnival |
| Multi-sport | Games | Olympics, Paralympics, Commonwealth Games |

### Taxonomy rules

- Goodwood is not a sport or top-level category.
- A brand, venue, or festival should be represented as `event_series` or as a specific event.
- Competition labels should remain reusable across seasons.
- UI filters should primarily expose sport, discipline, and competition; event-series can appear as chips or metadata.

## Tennis implementation spec

### Athlete universe

Maintain a weekly-refreshed tennis athlete table using ranking/tour data providers that expose current ATP and WTA rankings, players, tournaments and fixtures.[cite:37][cite:42][cite:43]

```ts
type TennisTour = 'ATP' | 'WTA';
type TennisLevel =
  | 'grand_slam'
  | 'atp_masters_1000'
  | 'wta_1000'
  | 'atp_500'
  | 'wta_500'
  | 'atp_250'
  | 'wta_250'
  | 'team_competition'
  | 'challenger';

interface TennisAthleteProfile {
  athleteId: string;
  tour: TennisTour;
  rankingSingles?: number;
  rankingDoubles?: number;
  rankingSnapshotDate: string;
  nationalityCode: string;
  isAustralian: boolean;
  active: boolean;
}
```

### Inclusion rules

A tennis event should enter the catalogue if any of the following are true:

- Tournament is a Grand Slam.
- Tournament is ATP Masters 1000 or WTA 1000.
- Tournament is ATP/WTA Finals.
- Match features an ATP Top 50 athlete.
- Match features a WTA Top 50 athlete.
- Match features an Australian athlete.
- Match is manually promoted/editorially featured.
- Match is surfaced by broadcaster scan and meets a minimum confidence threshold.

### Froth behaviour

Froth controls breadth, not whether women’s tennis or non-Slam tennis exists.

| Froth level | Tennis display behaviour |
|---|---|
| Low | Followed players, Australians, Slams, Finals, and late rounds of Masters/WTA 1000s |
| Balanced | All above, plus Top 50 players at Masters/WTA 1000s and major ATP/WTA 500 finals |
| High | Full ATP/WTA 1000 coverage, notable early rounds, selected ATP/WTA 500 and 250 cards |
| Maximum | Broad tour discovery, Challenger finals, selected doubles and emerging-player storylines |

### Toronto acceptance test

The National Bank Open in Toronto should be present whenever it is active because it is a WTA 1000 with published schedule and tournament pages.[cite:40][cite:41][cite:46]

Acceptance test:

- If current date falls within tournament date range for Toronto or Montreal, at least one active card appears under Tennis for users who follow Tennis.
- At balanced froth or higher, the event should appear even if the user does not follow specific players.
- If the user follows WTA or Tennis, the event should rank above most long-tail tennis cards.

## Broadcast discovery system

### Broadcaster scan goals

The broadcaster scan should answer: “what is actually watchable or promoted this week?” and feed that into coverage expansion.

Priority broadcaster/source groups:

- AU rights holders: Kayo, Foxtel, Stan Sport, ESPN AU, SBS, 9Now, Seven/7plus, Paramount+.
- International discovery sources: Eurosport, Canal+, TNT, DAZN, beIN.
- Official competitions for fixture truth: ATP, WTA, NRL, AFL, F1, UFC, FIS, etc.

### Weekly scan job

Run a weekly scan with a daily refresh for the next seven days.

```txt
1. Fetch schedules / guide pages / APIs from selected broadcasters and official competitions.
2. Parse candidate events and normalize names, times, competitions and participants.
3. Match candidates to canonical events.
4. Create provisional events if there is no canonical match.
5. Enrich with AU availability, service type and confidence.
6. Produce a review report for ambiguous or high-value additions.
7. Publish approved additions into the canonical catalogue.
```

The scan may include automated adapters for public pages without explicit automation permission under the MVP source-acquisition policy above. Such adapters must preserve source provenance and classify their output as unverified unless the source is first-party or explicitly permitted.

### Coverage candidate model

```ts
interface CoverageCandidate {
  id: string;
  source: string;
  eventTitle: string;
  sport: string;
  competition?: string;
  startsAt: string;
  broadcastsAu: BroadcastOption[];
  matchConfidence: number;
  catalogueStatus: 'matched' | 'new' | 'ambiguous';
  coverageReason:
    | 'existing_followed_sport'
    | 'major_event'
    | 'australian_participant'
    | 'top_50_tennis'
    | 'broadcaster_featured'
    | 'community_signal';
  suggestedAction: 'publish' | 'review' | 'ignore';
}
```

### Output report requirements

Generate a weekly machine-readable plus human-readable report containing:

- newly detected events;
- missing catalogue gaps;
- ambiguous matches;
- rights/availability changes;
- high-priority recommendations to add.

This report should become the ops/editorial review surface before any fully automated expansion.

## Feed and filter redesign

### Separate navigation from feed controls

Navigation should reflect taxonomy. Feed controls should reflect user intent and watchability.

#### Navigation

- Sports
- Disciplines
- Competitions / tours
- Followed athletes / teams / fighters / drivers

#### Feed controls

- Froth: Low / Balanced / High / Maximum
- Scope: Following / For You / Explore
- Availability: Any / Free / Included / PPV
- Timing: Live now / Tonight / This week / Overnight acceptable
- Stakes: Everything / Important / Must watch
- Spoilers: Strict / Standard / Results visible
- Services owned: Kayo / Stan Sport / Foxtel / SBS On Demand / 9Now / 7plus / ESPN / etc.

### Availability semantics

Every event in AU should be mapped to one of:

- `free`
- `included`
- `ppv`
- `unknown`

For combat sports and premium events, distinguish undercards/prelims from main card PPV when applicable.

## Recommendation and serendipity spec

The recommendation layer should blend:

1. Explicit follows.
2. Adjacent relevance.
3. Controlled discovery.

### Discovery triggers

Allow unfollowed sports or competitions to surface only when at least one of these is strongly true:

- Similar users also engage with it.
- Narrative structure matches what the user responds to.
- Stakes are universally high.
- Australian relevance is strong.
- The event is low-friction to watch (free or included, friendly time).

### Hard suppression rules

```ts
function isDiscoveryEligible(user: UserPreferences, event: CanonicalSportEvent) {
  if (user.unfollowedSportIds.includes(event.sport)) return false;
  if (user.unfollowedCompetitionIds.includes(event.competitionId)) return false;
  if (user.blockedParticipantIds.some(id => event.participants.some(p => p.id === id))) return false;
  if ((user.dislikeRateByCompetitionId[event.competitionId] ?? 0) >= 0.65) return false;
  if (user.hidePpv && event.auViewing?.isPpvAu) return false;
  return true;
}
```

### Feed mix targets

| Feed mode | Followed / direct interest | Relevant adjacent | Serendipity |
|---|---:|---:|---:|
| Low froth | 90% | 10% | 0% |
| Balanced | 75% | 20% | 5% |
| High | 60% | 30% | 10% |
| Maximum | 45% | 35% | 20% |

### Presentation rules

- Discovery cards must never outrank a followed event of similar stakes.
- Discovery cards should be lightly labelled, e.g. “Worth a look” or “Because you watch title deciders”.
- Discovery cards should be rare at first impression depth: max one in first 10 cards.
- Repeated negative behaviour should progressively reduce discovery from the same competition or discipline.

## Data pipeline and storage

Use a staged ingestion model:

1. `raw_events`
2. `staged_events`
3. `canonical_events`
4. `event_broadcasts`
5. `event_storylines`
6. `event_source_links`
7. `coverage_candidates`

### Ingestion stages

```txt
raw source capture
→ source adapter mapping
→ canonical normalization
→ dedupe and merge
→ AU availability enrichment
→ storyline/ranking enrichment
→ feed ranking / delivery
```

### Hygiene rules

- Use UTC as canonical source time; derive AEST/AEDT at read time.
- Do not overwrite pre-event card fields with post-event results.
- Normalize broadcaster names to a controlled vocabulary.
- Use stable participant IDs so aliases do not fork the same entity.
- Version availability because rights can change close to event day.[cite:3]
- Preserve source provenance and trust class through every merge; an unverified claim cannot replace a conflicting verified fixture, timing or result fact.
- Public-web scraping in the personal-use MVP must not bypass authentication, paywalls, CAPTCHAs or other technical access controls.

## Phased plan

## Phase 1 — taxonomy and schema foundation

### Goal

Clean up the data model so categories, competitions, and events are structured correctly before expanding coverage.

### Tasks

- Create taxonomy tables / objects for sport, discipline, competition and event_series.
- Migrate existing flat categories into hierarchy.
- Reclassify one-off categories such as Goodwood into Motorsport children.
- Add canonical event model with `disciplineId`, `competitionId`, `eventSeriesId`, `broadcasts`, and `auViewing`.
- Add `storyline` as a nested optional enrichment object rather than flattening narrative fields.[cite:1]

### Deliverables

- Migration script for taxonomy.
- New canonical event schema.
- Backfill plan for existing events.
- Admin/debug view for taxonomy inspection.

### Acceptance criteria

- No one-off festival or venue remains as a root category.
- Existing event cards still render via compatibility mapping.
- Event rows can be grouped by sport and subcategory cleanly.

## Phase 2 — tennis universe and coverage guarantee

### Goal

Make Tennis complete enough that current ATP/WTA marquee activity cannot go missing.

### Tasks

- Add ATP and WTA athlete ingestion.
- Refresh ATP/WTA rankings weekly from a ranking-capable provider.[cite:37][cite:42][cite:43]
- Build tournament-level rules for Slams, ATP Masters 1000, WTA 1000, ATP/WTA Finals, Davis Cup, Billie Jean King Cup.
- Add tennis froth logic and ranking rules.
- Add Toronto regression test.

### Deliverables

- `tennis_athletes` table.
- `tennis_tournaments` normalization logic.
- Tennis inclusion rules engine.
- Feed ranking tests for low / balanced / high / maximum froth.

### Acceptance criteria

- Toronto-style WTA 1000 events appear automatically when active.[cite:40][cite:41][cite:46]
- Tennis users see ATP and WTA represented equally in the catalogue.
- Australian tennis players are included even if ranked outside top 50.

## Phase 3 — broadcaster-led coverage discovery

### Goal

Expand the catalogue reliably using what broadcasters are actually showing, especially for long-tail and seasonal discovery.

### Tasks

- Build weekly scan jobs for AU rights holders.
- Add optional international discovery source adapters.
- Implement coverage candidate matching.
- Generate weekly coverage reports.
- Create review tooling for “publish / review / ignore”.

### Deliverables

- Source adapters for Kayo, Foxtel, Stan Sport, ESPN AU, SBS, 9Now, Seven/7plus, Paramount+.
- Coverage candidate table and report generator.
- Match-confidence scoring.
- Editorial review queue.

### Acceptance criteria

- New long-tail events can enter the review queue without manual taxonomy edits.
- The weekly report identifies gaps between catalogue and broadcaster schedules.
- AU availability is attached to candidate events in a normalized way.

## Phase 4 — feed controls and discovery logic

### Goal

Replace blunt filtering with clean feed controls and controlled serendipity.

### Tasks

- Build separate navigation and feed-control systems.
- Add froth, scope, availability, timing and stakes controls.
- Implement discovery eligibility and suppression rules.
- Add recommendation signal capture for swipes, saves, reminders, opens and watch completions.
- Introduce discovery card labelling and caps.

### Deliverables

- New filter UI model.
- Recommendation scoring service.
- Negative-behaviour suppression logic.
- Discovery impression caps and experimentation flags.

### Acceptance criteria

- Explicit unfollows fully suppress discovery from that sport/competition.
- Repeated dislikes meaningfully reduce resurfacing from the same subcategory.
- Discovery cards remain present but rare at balanced froth.

## Phase 5 — storyline enrichment and premium ranking

### Goal

Use the broader catalogue to power high-quality must-watch surfacing without flooding the feed.[cite:1]

### Tasks

- Compute stakes, arc stage and intensity using rule-based logic.[cite:1]
- Add manual editorial override for flagship events.[cite:1]
- Build “Must Watch” and “Top Storylines This Week” rails as separate surfaces.[cite:1]
- Ensure routine fixtures do not visually compete with defining events.[cite:1]

### Deliverables

- Storyline rules engine.
- Narrative preview copy generator with spoiler-safe constraints.
- Tiered card rendering support.
- High-value modules for weekly digest and marquee rail.

### Acceptance criteria

- High-stakes events rank above routine fixtures without requiring explicit follows.
- Routine catalogue breadth does not create visual clutter.
- Narrative hooks remain anticipatory and spoiler-safe.[cite:1]

## Phase 6 — measurement and tuning

### Goal

Tune breadth vs precision using observed behaviour, not instinct.

### Metrics

- Missing marquee event rate.
- Coverage candidate publish rate.
- Discovery card open/save/watch rate.
- Hide/unfollow/left-swipe rate by sport and competition.
- Feed satisfaction proxy: saves + reminders + watch-through.
- Cold-start diversity rate.

### Tasks

- Instrument every feed action.
- Add dashboards for discovery success vs annoyance.
- Tune froth defaults and discovery caps.
- Tune coverage confidence thresholds.

### Acceptance criteria

- Missing marquee event rate trends down materially after broadcaster scan launch.
- Discovery engagement is positive without increasing negative feedback disproportionately.
- Balanced froth feels broader than today without becoming noisy.

## Engineering notes

- Prefer deterministic rules before AI-heavy recommendation generation, consistent with the project’s staged architecture direction.[cite:1]
- Keep source lineage for every event so debugging missing or duplicated coverage is straightforward.
- Build strong regression tests for seasonal edge cases, rights changes, and category migration.
- Start with a human-reviewed coverage queue before enabling fully automatic long-tail publication.

## Immediate implementation checklist

1. Create taxonomy tables and migration plan.
2. Add canonical event schema fields for hierarchy and AU viewing.
3. Ingest ATP/WTA top 50 athlete universe and Australians.
4. Implement tournament-level tennis eligibility rules.
5. Add Toronto regression test.
6. Build broadcaster scan adapters for AU services.
7. Create weekly coverage candidate report.
8. Redesign filters into navigation + feed controls.
9. Add discovery eligibility hard-block rules.
10. Launch with low-to-balanced discovery rates, then tune.

## Definition of done

The system is considered to have reached the intended state when it can:

- hold a broad, broadcaster-informed event catalogue;
- guarantee baseline tennis completeness across ATP and WTA marquee activity;
- organize sports via a clean hierarchy instead of flat labels;
- expose a filter model that matches user intent instead of internal taxonomy leaks;
- support rare, smart serendipity without violating explicit user preferences;
- and still deliver a spoiler-safe, high-signal feed that feels curated rather than exhaustive.[cite:1]

# Storyline Narrative System Documentation

Version 1.0 — technical reference for the Storyline narrative sports card design system.

---

## 1. Purpose

Storyline is an interactive design system that maps sports narrative archetypes onto a set of card templates for previewing upcoming sports fixtures. Every card reads structured metadata — narrative archetype, stakes, arc stage, character roles — and computes how much visual and typographic weight the fixture deserves *before* a fan taps to watch. All cards are framed as **pre-event previews** (anticipatory tense: "chasing", "about to be decided", "with the series on the line") rather than post-event recaps.

---

## 2. The 7 Narrative Archetypes

Each archetype carries an accent colour pair, an icon, a motif family, and a short description of the story shape it signals. The `ARCHETYPE_ORDER` array fixes their canonical display order.

| # | ID | Label | Short | Accent | Accent (dim) | Icon | Motif | Character Roles |
|---|----|----|----|----|----|----|----|----|
| 1 | `monster` | Overcoming the Monster | Monster | `#e8a33d` | `#8a662a` | `shield-alert` | jagged | underdog, giant |
| 2 | `ragsToRiches` | Rags to Riches | Rise | `#d19900` | `#7a5a10` | `trending-up` | rising | rookie, underdog |
| 3 | `quest` | The Quest | Quest | `#3d7de8` | `#25406e` | `map` | path | chosen-one, veteran |
| 4 | `voyageReturn` | Voyage & Return | Return | `#3dc9b0` | `#1f6e5f` | `rotate-ccw` | circular | fallen-hero, veteran |
| 5 | `rivalry` | Rivalry / Tragedy-in-Waiting | Rivalry | `#e0393f` | `#7a1f22` | `swords` | crossed | rival, veteran |
| 6 | `rebirth` | Rebirth | Rebirth | `#e86a2d` | `#7a3814` | `flame` | ember | fallen-hero, mentor |
| 7 | `comedy` | Comedy (Order Restored) | Routine | `#8a8a86` | `#4a4a47` | `calendar-check` | flat | peer |

### Archetype definitions and visual signals

**1. Overcoming the Monster (`monster`)**
An underdog stands against a feared, dominant force. David-vs-Goliath tension — the story asks whether the giant can be felled.
Visual signals: gold vs. slate contrast, jagged edge motif, size-disparity framing (small crest vs. oversized crest).

**2. Rags to Riches (`ragsToRiches`)**
A humble origin arcs toward glory. A promoted club, an academy graduate, a club rebuilt from the bottom — climbing in real time.
Visual signals: gradient rising bottom-to-light-gold, ascending chevrons, upward motion cues.

**3. The Quest (`quest`)**
One leg of a longer journey — a title race, promotion push, or record chase. This game matters because of what it moves the team toward.
Visual signals: deep blue, journey/waypoint marker, progress-arc motif tied to the season-long arc.

**4. Voyage & Return (`voyageReturn`)**
A team or player comes back changed — from injury, exile, relegation, or retirement reversal. The story is whether they still belong at the top.
Visual signals: teal-to-white return arc, circular/orbit motion, "welcome back" framing.

**5. Rivalry / Tragedy-in-Waiting (`rivalry`)**
A historic grudge match where something is lost no matter the outcome — a derby, an elimination, a fixture with real animosity.
Visual signals: deep crimson, crossed-blades icon, jagged centre divider splitting the two crest colours.

**6. Rebirth (`rebirth`)**
A fallen team, player, or coach seeks to reverse a downward spiral — redemption is the plot, not just the result.
Visual signals: ember orange rising out of dark charcoal, spark/phoenix motif, low-to-high glow gradient.

**7. Comedy — Order Restored (`comedy`)**
A business-as-usual league fixture. Low narrative tension — the "plot" is simply the table holding its shape.
Visual signals: neutral graphite, no accent glow, calendar-check glyph, flat static composition.

### Character role vocabulary (`CHARACTER_ROLES`)

Independent of archetype, each fixture can tag which human/team roles are in play:

| Role ID | Label | Icon |
|---|---|---|
| `underdog` | Underdog | `shield` |
| `giant` | The Giant | `castle` |
| `chosenOne` | The Chosen One | `star` |
| `mentor` | The Mentor | `compass` |
| `rival` | The Rival | `swords` |
| `veteran` | The Veteran | `medal` |
| `rookie` | The Rookie | `sprout` |
| `fallenHero` | The Fallen Hero | `arrow-down-up` |

---

## 3. The 5 Intensity Tiers — Definitions and Visual Grammar

Intensity tiers control how much typographic weight, motion, and chrome a card is allowed to spend. The core design law: **a routine Tuesday fixture and a cup final must never compete visually — restraint and spectacle are both honest signals.**

| Tier | Name | Tagline | Type weight | Letter spacing | Stakes meter | Arc stage | Badge | Glow intensity |
|---|---|---|---|---|---|---|---|---|
| 1 | Routine Fixture | Order is stable. Nothing to signal. | 400 | 0em | Hidden | Hidden | Hidden | 0 |
| 2 | Storyline Emerging | A thread is forming, worth a second look. | 500 | -0.005em | Visible | Hidden | Visible | 0.12 |
| 3 | Rising Stakes | Positions are genuinely on the line. | 600 | -0.01em | Visible | Visible | Visible | 0.28 |
| 4 | Marquee Clash | The kind of game people rearrange plans for. | 700 | -0.015em | Visible | Visible | Visible | 0.5 |
| 5 | Historic / Defining Moment | The story the sport will remember. | 800 | -0.02em | Visible | Visible | Visible | 0.85 |

### Tier 1 — Routine Fixture
A midweek league game between mid-table sides with no shared history. The card stays quiet on purpose — visual noise here would be false advertising.
Motion: none — static composition, hover-only micro-feedback.

### Tier 2 — Storyline Emerging
A player chasing a scoring record, a quiet win streak, a first start for a returning name. One accent stripe and a single narrative badge signal there is more here than the fixture list shows.
Motion: subtle — accent stripe animates in on load, gentle hover lift.

### Tier 3 — Rising Stakes
A top-four six-pointer, a cup quarter-final, a form team meeting a struggling rival. Diagonal energy lines and a visible stakes meter tell fans this result will move the story forward.
Motion: moderate — diagonal sweep on load, animated stakes meter fill, archetype icon pulses once.

### Tier 4 — Marquee Clash
A title decider, a promotion/relegation six-pointer, a genuine derby. Full-bleed dual-crest colour fields, a pulsing live-stakes meter, and an arc-stage progress bar make the story unmissable before kickoff.
Motion: elevated — ambient glow pulse (loop), animated arc-stage progress, crest colour field breathes gently.

### Tier 5 — Historic / Defining Moment
A cup final, a career-defining rematch, the actual monster clash. Maximal treatment — animated gradient storm, oversized archetype iconography, urgent countdown pulse, and the full narrative hook spelled out in headline type.
Motion: maximal — looping gradient storm, countdown urgency pulse, cinematic vignette, headline narrative hook.

### Intensity computation

`intensity` (1–5) is stored per fixture and selects which template renders. It can be:
- Computed from `stakes` + `arcStage` + `archetype` (e.g. `critical` stakes + `climax` arc stage typically resolves to tier 5), or
- Set manually by an editor to override the computed value — the schema always allows a manual override field.

---

## 4. Full Metadata Schema Specification

Every fixture object implements this schema:

| Field | Type | Required | Purpose |
|---|---|---|---|
| `eventId` | string | Yes | Unique identifier for the fixture, used for state and analytics. |
| `sport` / `competition` | string | Yes | Context for iconography and league-specific colour rules. |
| `teams[].role` | enum: `protagonist` \| `antagonist` \| `peer` | Yes | Determines which side gets underdog framing, giant framing, or neutral treatment. |
| `archetype` | enum (7 values, see §2) | Yes | Selects the accent hue, icon, and motif family applied across every visual layer. |
| `arcStage` | enum: `inciting` \| `rising` \| `climax` \| `resolution` | Yes | Positions the fixture within its season-long or career-long story; drives the progress indicator. |
| `stakes` | enum: `low` \| `medium` \| `high` \| `critical` | Yes | Fills the stakes meter and contributes to the computed intensity tier. |
| `characterArchetypes[]` | array of role enums (see §2) | No | Labels the human roles in play (underdog, giant, veteran, rookie...) shown as small role chips. |
| `narrativeHook` | string, <120 chars | Yes | One human sentence framing the story — becomes headline copy at tier 4–5. Must be written in **future/anticipatory tense** — the event has not happened yet. |
| `intensity` | integer 1–5 | Yes | Selects which of the 5 card templates renders; can be computed from stakes + arcStage + archetype or set manually by an editor. |
| `kickoff` / `venue` / `broadcast` | datetime / string / string | Yes | Standard logistical fields, always present regardless of narrative tier. |

### Sample fixture object (as implemented in `data.js`)

```js
{
  eventId: 'evt-05',
  sport: 'Cricket',
  competition: 'The Ashes, 2nd Test',
  kickoff: 'Thu 4 Aug 2005, 11:00am',
  venue: 'Edgbaston, Birmingham',
  broadcast: 'Nine Network',
  teamA: { name: 'Australia', color: '#f2c14e' },
  teamB: { name: 'England', color: '#1f3a7a' },
  archetype: 'monster',
  arcStage: 'climax',
  stakes: 'critical',
  intensity: 5,
  characterArchetypes: ['underdog', 'giant'],
  narrativeHook: 'The reigning world No.1s and holders of the urn for 16 years, Australia arrive at Edgbaston 1-0 up in the series — but England sense an opening no side has found in a generation.',
}
```

Note: `teamA`/`teamB` are the concrete implementation of the abstract `teams[].role` schema field — each carries a `name` and a brand `color` used for the crest chip and gradient fields.

---

## 5. Design Philosophy Behind the Narrative Hooks

1. **Pre-event framing, always.** Every `narrativeHook` is written as if the event is still ahead — "about to be decided", "chasing", "with a green jacket on the line" — never as a recap of a result. This is a hard content rule: results, scorelines, and outcomes are never stated in hook copy, even for fixtures where the real-world result is a famous fact. The tension comes from what's at stake going in, not what happened.
2. **One human sentence, not a stat line.** The hook is deliberately conversational — it should read like something a knowledgeable friend would say to get you to tune in, not a database description. Kept under ~120 characters so it survives the tier-5 headline treatment without wrapping awkwardly.
3. **Stakes stated as context, not hype.** Numbers (series score, years since a drought, rounds remaining) are used to *justify* the stakes rather than editorialise them. "Chasing their first flag in 37 years" carries more weight than an adjective like "massive".
4. **Real, verifiable moments.** Sample fixtures are drawn from genuine, famous sporting events (Bradbury 2002, Cathy Freeman 2000, Adam Scott's 2013 Masters, the 2005 Ashes at Edgbaston, 2019 State of Origin decider, Richmond's 2017 flag) rather than invented scenarios — this keeps the design system's stakes-signalling honest and checkable, and avoids the flattening effect of generic placeholder sport content.
5. **Restraint is a signal too.** Tier 1 and 2 hooks are intentionally flat and undramatic ("a routine round, nothing more") — the absence of narrative weight is itself information the visual system is built to convey accurately. A system that hypes every fixture equally trains fans to ignore it.
6. **Archetype and intensity are independent axes.** The same two teams (e.g. Sydney Roosters vs South Sydney Rabbitohs) can appear at any of the five intensity tiers depending on where the match sits in the season, holding the `rivalry` archetype constant — this demonstrates that "who" and "how much" are separate narrative dimensions.

---

## 6. CSS Scaling Logic — Hero Card Stack

The homepage hero displays a fanned stack of three cards (tiers 1, 3, and 5) inside a fixed-height frame. Because card content length varies enormously between tiers (tier 1 has no headline hook at all; tier 5 has a full paragraph-length hook in large type), the stack cannot use a fixed CSS scale — it must **measure actual rendered content and compute a scale factor at runtime.**

### Structure

```html
<div class="hero-visual">          <!-- fixed-height frame -->
  <div id="heroCardStack" class="hero-card-stack">
    <!-- 3 absolutely positioned, fanned card clones -->
  </div>
</div>
```

### Frame CSS (fixed heights, responsive)

```css
.hero-visual {
  position: relative;
  height: 480px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.hero-card-stack {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 200ms var(--ease-out);
}

@media (max-width: 980px) {
  .hero { grid-template-columns: 1fr; }
  .hero-visual { height: 340px; order: -1; margin-bottom: var(--space-8); }
}
@media (max-width: 640px) {
  .hero-visual { height: 300px; margin-bottom: var(--space-10); }
}
```

### Card fan-out (per-card inline transform, generated in JS)

Each of the 3 stacked cards gets an absolute position with a horizontal/vertical offset and rotation, generated proportionally to its index in the stack:

```js
const tiersToShow = [1, 3, 5];
const isSmall = window.innerWidth < 640;
const dx = isSmall ? 14 : 26;   // horizontal fan offset per card
const dy = isSmall ? 12 : 22;   // vertical fan offset per card
const maxW = isSmall ? '260px' : '340px';

mount.innerHTML = tiersToShow.map((t, i) => `
  <div class="hero-stack-card" style="
    position:absolute; inset:0; margin:auto; width:88%; max-width:${maxW};
    transform: translate(${i * dx - dx}px, ${i * dy}px) rotate(${(i - 1) * 3}deg);
    z-index:${i}; transition: transform 400ms var(--ease-out);
  ">${renderCard(demoFixture, t)}</div>
`).join('');
```

This produces a symmetric fan: the middle card (i=1) sits centred and unrotated, the first card is offset left and rotated -3°, the third is offset right and rotated +3°. Z-index climbs with `i` so later cards visually sit on top.

### Runtime scale-to-fit (the core technique)

After the cards are painted, a `requestAnimationFrame` callback measures the **tallest and widest rendered card** (`scrollHeight`/`scrollWidth`) against the frame's actual box size, then applies a single uniform `scale()` transform to the whole stack container so it never overflows the frame — regardless of how long that tier's narrative hook text turns out to be:

```js
function fitHeroStack(mount, frame) {
  requestAnimationFrame(() => {
    const frameH = frame.clientHeight;
    const frameW = frame.clientWidth;
    let maxH = 0, maxW = 0;
    mount.querySelectorAll('.hero-stack-card').forEach(card => {
      const h = card.scrollHeight;
      const w = card.scrollWidth;
      if (h > maxH) maxH = h;
      if (w > maxW) maxW = w;
    });
    if (!maxH || !frameH) return;
    const padding = 0.86; // leave breathing room inside the frame
    const scale = Math.min(
      (frameH / maxH) * padding,
      (frameW / maxW) * padding,
      1                      // never scale UP past 100%
    );
    mount.style.transform = `scale(${scale})`;
    mount.style.transformOrigin = 'center center';
  });
}
```

Key properties of this approach:
- **Content-aware, not viewport-only.** Scaling responds to the actual DOM height of the tallest card (which varies with hook text length, stakes meter visibility, etc.), not just breakpoint width — this is what prevents mobile hero overlap when a tier-5 card's headline hook wraps to more lines than expected.
- **`Math.min(..., 1)` caps scale-up.** The stack never grows larger than its natural size, only shrinks to fit — avoids blurry upscaling.
- **0.86 padding constant** intentionally reserves ~14% breathing room inside the frame so the fanned cards' rotated corners don't clip the frame edge.
- **Re-run on resize.** The same function is called from the window `resize` handler (debounced) so the fit recalculates on viewport changes, not just on initial load.
- **`requestAnimationFrame` wrapper** ensures the measurement happens after the browser has laid out the freshly-injected HTML — measuring synchronously on `innerHTML` assignment would read stale (zero) dimensions.

---

## 7. Metadata-to-Visual Rendering Pipeline (Summary)

For any fixture object, the render pipeline is:

1. Look up `archetype` → resolve accent colour, icon, motif class.
2. Look up `intensity` (1–5) → resolve type weight, letter spacing, motion level, and which optional elements (stakes meter, arc-stage progress bar, badge) are shown.
3. Render team crest chips using `teamA.color` / `teamB.color` as background fields (full-bleed dual-crest gradient at tier 4–5, subtle chip only at tier 1–2).
4. If `intensity >= 4`, render `narrativeHook` as large headline type; below that, show it as smaller body copy or omit at tier 1.
5. If `showsStakesMeter`, render a 4- or 5-segment meter filled according to `stakes` level.
6. If `showsArcStage`, render the arc-stage progress indicator positioned at `arcStage`.
7. Apply `glowIntensity` as an ambient box-shadow/gradient opacity value scaled 0–1.

This is implemented across `cards.js` (the `renderCard(fixture, tierOverride)` function) and `data.js` (the metadata tables above).

# Match Card Research — Raiders v Rabbitohs and Wallabies v Italy

Checked: 2026-07-18 (Australia/Sydney)

## Scope and source policy

This note verifies the two match-specific facts required by `codex-spec-export.md`. Primary competition/team sources are used for the fixture and selection facts. The Raiders result and recap tone are corroborated by ABC Sport, an independent reputable outlet. The relevant completed fixture is **Round 20 at GIO Stadium on 18 July**, not the separate Round 6 match in Perth.

## Canberra Raiders v South Sydney Rabbitohs — completed

- **Competition/date/venue:** NRL Telstra Premiership, Round 20; Saturday 18 July 2026 at GIO Stadium, Canberra.
- **Status:** completed.
- **Consensus winner:** Canberra Raiders.
- **Score corroboration:** 34–24. This is safe to retain in result-only metadata, but the card brief specifically prefers consensus winner/recap language over dependence on one exact score source.

### Evidence

- The [official NRL Round 20 match centre](https://www.nrl.com/draw/nrl-premiership/2026/round-20/raiders-v-rabbitohs/) lists the completed fixture, its match recap and highlights.
- The independent [ABC Sport score centre](https://www.abc.net.au/news/sport/score-centre/nrl/2026-07-18/raiders-rabbitohs/231200828) records Raiders 34, Rabbitohs 24.
- ABC Sport’s [live recap](https://www.abc.net.au/news/2026-07-18/nrl-live-blog-raiders-rabbitohs-warriors-dragons-bulldogs-tigers/106928426) says Canberra held on under late Rabbitohs pressure, won a third straight game, and kept its season alive. It also reports a suspected Achilles injury to Hudson Young.

### Recommended card framing

Use this as a **result-aware consensus recap**, not a score-centre transcription:

- **Spoilers off hook:** `A fast start, a late Souths surge and a desperate final stand in Canberra.`
- **Spoilers off synopsis:** `The contest swung sharply after half-time before a tense late finish at GIO Stadium. Canberra’s season-defining urgency was tested to the last set.`
- **Spoilers on hook:** `Canberra held off Souths 34–24 to make it three wins in a row.`
- **Spoilers on synopsis:** `The Raiders built the platform early, absorbed a second-half Rabbitohs surge and closed out a valuable home win. The result kept their late finals push alive, though Hudson Young left injured.`

This supports `status: completed`, `consensusResult.winner: "Canberra Raiders"`, and `storyline.arcStage: "recap"`. The spoiler-off wording intentionally contains no winner, score, margin, or explicit result.

## Wallabies v Italy — upcoming preview

- **Competition/date/venue:** Nations Championship, Round 3; Saturday 18 July 2026, 6:00 pm AWST / **8:00 pm AEST**, HBF Park, Perth.
- **Status at research check:** upcoming.
- **Do not use:** score, result, post-match tense, or recap copy.

### Evidence

- Rugby Australia’s [official team announcement](https://wallabies.rugby/news/wallabies-team-confirmed-to-play-italy-in-perth-2026716) confirms the time, venue and three changes to the starting XV: Perth-born Carlo Tizzano starts at openside, Brandon Paenga-Amosa starts at hooker, and Harry Potter replaces the unavailable Dylan Pietsch. It identifies the match as the final Wallabies Test for coaches Joe Schmidt and Laurie Fisher.
- Rugby Australia’s [squad update](https://wallabies.rugby/news/trio-added-to-wallabies-squad-for-italy-test-as-donaldson-looks-to-prove-fitness-2026712) establishes the selection pressure: Harry McLaughlin-Phillips, Isaac Henry and Joe Brial were added as cover after injuries, while Italy also travelled with injury/selection disruption.
- The [Italian Rugby Federation preview](https://www.federugby.it/nations-championship-la-presentazione-di-australia-italia/) independently frames the match as important for both sides after two losses. It notes a relatively stable Wallabies core under Harry Wilson despite the three changes, and describes Perth as the chance to break through after narrow/second-half setbacks.

### Recommended card framing

- **Hook:** `A reset opportunity in Perth, with pressure and transition hanging over the Wallabies.`
- **Synopsis:** `Carlo Tizzano starts in his hometown as Australia reshapes its XV after two losses. With Joe Schmidt’s final Test in charge and an injury-hit Italy arriving, the Wallabies need their accuracy to hold for 80 minutes.`

This supports `status: upcoming`, preview-only copy in both spoiler states, and a conservative high-intensity/expected-spectacle treatment. It deliberately avoids any outcome language.

## Editorial caution

The brief’s reference to conflicting scores should not be applied to a different Raiders–Rabbitohs meeting. The official NRL Round 20 page and ABC’s contemporaneous result identify the just-completed Canberra fixture as the 34–24 result above. If the implementation uses only a consensus-result object, `winner: Canberra Raiders` plus the result-aware copy is the robust minimum.

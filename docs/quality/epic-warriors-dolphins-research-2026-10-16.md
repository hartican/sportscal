# Warriors v Dolphins: postmatch research packet

Status: READY FOR PARENT REVIEW. Research only; not applied or published.

Research date: 16 October 2026, Australia/Sydney.

Fixture: `major-match:nrl-finals-2026:qualifying-final-2`, 12 September 2026.

## Exact-result gate

CONFIRMED: **Warriors 16-26 Dolphins**, completed. The opening match summary and full-time entry in the [official NRL postmatch report/live blog](https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/) confirm the supplied result. The [official postmatch coach report](https://www.nrl.com/news/2026/09/12/woolf-hails-dolphins-bravery-to-secure-prelim-final-berth/) independently states the same score.

Parent-supplied result signature, retained without reinterpretation:

`["completed","Dolphins defeated Warriors 26-16.","Warriors 16-26 Dolphins",null,16,26]`

The opaque event ID is preserved exactly; no inference is made from its qualifying-final numbering.

## Sources and attribution

- S1: [NRL official postmatch summary and live blog, 12 September](https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/). Only the Warriors-Dolphins material is used. Supports the change in field position, scoring developments and immediate finals consequences.
- S2: [NRL official postmatch Woolf and Katoa report, 12 September](https://www.nrl.com/news/2026/09/12/woolf-hails-dolphins-bravery-to-secure-prelim-final-berth/). Supports attributed explanations of defensive resistance and maintaining playing discipline amid stoppages.
- S3: [Warriors official match centre](https://www.warriors.kiwi/draw/nrl-premiership/2026/finals-week-1-warriors-v-dolphins/). Search-exposed match-centre content supplies the score, scoring breakdown and half-time score; direct text extraction exposes only the page shell. These facts are also consistent with S1. This is not a claim of video review.
- S4: [Warriors official fixture announcement, 6 September](https://www.warriors.kiwi/news/2026/09/06/dolphins-confirmed-as-week-one-finals-opponents/). Used only for established pre-match context: ladder positions, debut finals campaign and the two regular-season meetings. It is not treated as postmatch evidence.

The JSON contains the body once, in the three requested fields. `whatHappened` draws on S3, with the lead progression corroborated by S1. The first two paragraphs of `decisiveDevelopments` draw on S1; its final paragraph paraphrases attributed comments in S2. The first paragraph of `whyItMatters` draws on S4; its final paragraph uses S1 for the immediate consequences and offers an explicitly editorial interpretation of the supported match pattern.

Evidence limits: scoring-minute labels differ between S1 and S3, so the packet uses sequence and score states, not exact minutes. No later finals results, speculative injuries or disciplinary outcomes are imported. This is newly written retrospective analysis, not a reconstruction of historical original copy. Tactical interpretation is based on the cited reporting, not an asserted independent film study. No direct quotations are used in the body.

## Extractable editorial packet

```json
{
  "eventId": "major-match:nrl-finals-2026:qualifying-final-2",
  "hook": "An eight-point Warriors lead unravelled as Isaiya Katoa changed the territory and the Dolphins' runners turned a qualifying final into a 26-16 comeback win.",
  "whatHappened": "The Dolphins beat the Warriors 26-16 at Go Media Stadium in Auckland, overcoming a 12-8 half-time deficit and an eight-point second-half gap. Their four tries to one explain how a match long controlled on the scoreboard by the home side ultimately changed hands.\n\nTaine Tuaupiki supplied every Warriors point: a try, its conversion and five penalty goals. His accuracy kept turning infringements into scoreboard pressure, but the hosts did not add another try. For the Dolphins, Selwyn Cobbo, Herbie Farnworth, Hamiso Tabuai-Fidow and Jack Bostock crossed, with Jamayne Isaako converting all four and adding a penalty goal.\n\nThat contrast gave the comeback its shape: the Warriors kept collecting twos, while the Dolphins eventually found the converted tries needed to overturn the advantage.",
  "decisiveDevelopments": "The tactical change came through Katoa's long kicking. NRL's report identifies his ability to turn the Warriors forwards around as the shift that opened the contest for Farnworth and Tabuai-Fidow. Territory, rather than another exchange of penalties, began driving the match.\n\nFarnworth recovered a disrupted left-side movement and cut back infield to bring the Dolphins within two points. Tabuai-Fidow then broke from a kick return and exchanged passes with Farnworth for the lead. The combination mattered: the initial break became a scoring movement because the two runners stayed connected.\n\nWoolf's postmatch explanation emphasised defending the line until his side could use the ball. Katoa described keeping the group focused on playing rather than the confrontations. Those accounts give substance to the recovery: the Dolphins needed both resistance while under pressure and enough control to exploit the opportunities that followed.",
  "whyItMatters": "This was second against third, not an outsider ambushing a runaway favourite. The clubs had split their regular-season meetings, both decided by two points. The Dolphins were playing their first finals series in their fourth season; the Warriors had reached the playoffs for the third time in four years under Andrew Webster.\n\nVictory secured the Dolphins a preliminary-final berth; defeat sent the Warriors into a semi-final against Newcastle. The significance lies in the route to that outcome: Katoa's territorial adjustment and the backs' execution overturned a lead built largely through penalty goals, rather than simply matching the Warriors' scoring method."
  ,"sourceUrls": [
    "https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/",
    "https://www.nrl.com/news/2026/09/12/woolf-hails-dolphins-bravery-to-secure-prelim-final-berth/",
    "https://www.warriors.kiwi/draw/nrl-premiership/2026/finals-week-1-warriors-v-dolphins/",
    "https://www.warriors.kiwi/news/2026/09/06/dolphins-confirmed-as-week-one-finals-opponents/"
  ],
  "facts": [
    {
      "text": "Dolphins defeated Warriors 26-16 in the qualifying final on 12 September 2026.",
      "sourceUrl": "https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/"
    },
    {
      "text": "Warriors led 12-8 at half-time and 16-8 in the second half.",
      "sourceUrl": "https://www.warriors.kiwi/draw/nrl-premiership/2026/finals-week-1-warriors-v-dolphins/"
    },
    {
      "text": "Tuaupiki scored the Warriors' sole try, one conversion and five penalty goals.",
      "sourceUrl": "https://www.warriors.kiwi/draw/nrl-premiership/2026/finals-week-1-warriors-v-dolphins/"
    },
    {
      "text": "Cobbo, Farnworth, Tabuai-Fidow and Bostock scored the Dolphins' four tries; Isaako converted all four and kicked a penalty goal.",
      "sourceUrl": "https://www.warriors.kiwi/draw/nrl-premiership/2026/finals-week-1-warriors-v-dolphins/"
    },
    {
      "text": "NRL's report credits Katoa's long kicking with changing the contest; Farnworth's try preceded Tabuai-Fidow's lead-taking kick-return combination with him.",
      "sourceUrl": "https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/"
    },
    {
      "text": "Woolf credited his side's line defence; Katoa said his message during confrontations was to remain calm and resume playing.",
      "sourceUrl": "https://www.nrl.com/news/2026/09/12/woolf-hails-dolphins-bravery-to-secure-prelim-final-berth/"
    },
    {
      "text": "Warriors finished second and Dolphins third; their two regular-season meetings were split, each by two points.",
      "sourceUrl": "https://www.warriors.kiwi/news/2026/09/06/dolphins-confirmed-as-week-one-finals-opponents/"
    },
    {
      "text": "This was the Dolphins' first finals campaign in their fourth season, and the Warriors' third in four years under Webster.",
      "sourceUrl": "https://www.warriors.kiwi/news/2026/09/06/dolphins-confirmed-as-week-one-finals-opponents/"
    },
    {
      "text": "The result advanced Dolphins to a preliminary final and sent Warriors to a semi-final against Newcastle.",
      "sourceUrl": "https://www.nrl.com/news/2026/09/12/finals-fever-warriors-v-dolphins-sharks-v-cowboys/"
    }
  ],
  "researchedAt": "2026-10-16T09:20:42+11:00"
}
```

Parent handoff: bind the packet to the supplied exact result signature before application. Existing preview packets remain frozen. No source-code, SQL, Git, test, deployment or preference changes were made.

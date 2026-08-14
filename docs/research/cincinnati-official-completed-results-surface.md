# Cincinnati official completed-result surface

**Research date:** 14 August 2026
**Scope:** Only Cincinnati Open's official Tournament Schedule, Order of Play and Draws pages, plus PDFs linked directly from those pages. No ATP, WTA, Rain, paid-provider, search-snippet or undocumented-endpoint evidence was used.

## Conclusion

The official [Order of Play](https://cincinnatiopen.com/score-center/order-of-play/) page currently exposes a machine-parseable completed-match result surface **after its JavaScript has rendered**. It is the strongest approved result surface found because each completed match has an explicit completion state, an official match ID, player rows, set scores, a winner marker and match duration.

This is not a documented or stable data-feed contract. A plain HTTP fetch of the same page contains the `<score-oop>` component, changing PDF links and player metadata, but not the rendered match record or its `COMPLETED` state. Automation would therefore need an explicitly approved JavaScript-rendering step and strict validation. It must not discover or call the page's undocumented backing endpoints.

The negative finding requested by this audit does **not** apply at the rendered-page level: an approved official page does expose parseable completed results. It **does** apply to the current static/PDF-only importer boundary: no reviewed schedule or PDF source provides the same unambiguous per-match `COMPLETED` contract.

## Evidence

| Approved source | Current evidence | Result-surface assessment |
| --- | --- | --- |
| [Tournament Schedule](https://cincinnatiopen.com/tournament/tournament-schedule/) | Publishes 2026 session dates, advertised starts and rounds. | No player-level results. |
| [Order of Play](https://cincinnatiopen.com/score-center/order-of-play/) | In the rendered Day 3 view, match `MS082` is marked `COMPLETED`; Martin Landaluce is marked winner over Jack Draper, 6-3 7-5, in 1:56. The record is `<div class="Match" id="MS082" data-id="MS082">`; explicit fields include `.Match__head__state`, `.Match__line--winner`, player-name elements and set-score elements. | Yes, after JavaScript rendering. This is the only reviewed surface with an explicit per-match completion state. |
| [Order of Play PDF labelled August 14](https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-Aug-13-524p.pdf) | A prospective court/order sheet released on 13 August, with players, courts and followed-by/not-before ordering. | Schedule only; not a completed-result source. |
| [Draws](https://cincinnatiopen.com/score-center/draws/) | Its rendered ATP singles draw has match container `MS065`, winner class `.Match__line--winner`, player names and set scores for Cameron Norrie over Dino Prizmic, 3-6 6-1 6-4. The page does not show an explicit completed label on that draw record. | Parseable corroboration, but unsafe as the sole completion signal because completion must be inferred. |
| [ATP Singles draw PDF](https://cincinnatiopen.com/wp-content/uploads/2026/08/MDS-ATP-Aug-13-530pm.pdf) and [WTA Singles draw PDF](https://cincinnatiopen.com/wp-content/uploads/2026/08/MDS-WTA-Aug-13-5pm.pdf) | Official bracket PDFs contain populated score/advancement information as play progresses. | Useful corroboration; dense bracket layout and advancement do not provide the Order of Play page's explicit per-match completed state. |

The current official pages also linked these relevant documents during the review:

- Order of Play: [August 13](https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-08-12-9PM.pdf), [August 12](https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-Aug-12-526pm.pdf), and [August 11](https://cincinnatiopen.com/wp-content/uploads/2026/08/OP-Aug-12-uploaded-Aug-11-6pm.pdf).
- Draws: [ATP Qualifying](https://cincinnatiopen.com/wp-content/uploads/2026/08/QSATP-Aug-11-611p.pdf.pdf) and [WTA Qualifying](https://cincinnatiopen.com/wp-content/uploads/2026/08/QS-WTA-Aug-13-530pm.pdf). The ATP and WTA doubles documents were not relevant to the completed singles-match question.

## Safe product state

If JavaScript rendering is not approved, fails, or produces a record that does not validate, omit that match from `resultsByMatchId` and show the spoiler-safe schedule with the result unavailable. Do not emit a partial result object, infer completion from draw advancement, infer a winner from non-empty score cells, or fall back to an undocumented endpoint.

A result should be admitted only when the official Order of Play page supplies all of the following together: an exact `COMPLETED` state, a unique official match ID, two competitors that map uniquely to the scheduled match, exactly one winner marker, and a structurally valid score. Any mismatch should fail closed to the unavailable state for that match without blocking the wider feed.

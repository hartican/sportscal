# UEFA coefficient feasibility — 4 October 2026

**Result:** the historical table is technically readable, but it is not an approved free production data source. Leave coefficient ingestion parked and final unresolved ties Pending. This review advances the evidence and source-use boundary; it does not certify either Football pilot.

The existing 72-club OpenLigaDB snapshot was reviewed at main `0cdcd9d5a547e4bb1570e21a0c96595aa61b9614`. One bounded official-source investigation began at 2026-10-03T19:02:56.564Z and ended before 19:13:20Z, within the 15-minute cap. No source refresh, persistent provider dataset, application change, database write, purchase, new scheduler or outreach was made. The prior [3 October assessment](uefa-final-input-source-assessment-2026-10-03.md) remains dated history.

## Observed evidence

| Boundary | Result | Confidence and limit |
|---|---|---|
| Historical selection | Official club and association pages selected 2025/26, with 2021/22–2025/26 columns and displayed update 04/07/2026 00:22 | Verified UI; update time zone unknown. It is the fixed reference period, not the rolling 2026/27 table |
| Displayed coverage | The full-ranking control and normal scrolling exposed 250 consecutive club rows and all 55 association rows | Verified displayed range; absence from those 250 does not imply no UEFA record or a zero coefficient |
| Local roster comparison | 66/72 unique name-and-country candidates; six clubs were not observed in the displayed club table | Candidate aliases reviewed explicitly, without fuzzy joins or rank-based identity. Complete authoritative 72-club mapping remains unverified |
| Missing candidates | N.E.C., Sunderland, AFC Bournemouth, Como, OFI Crete and Torreense | Do not fill values from a guessed association, presumed participation history or another club |
| Association minimum | All 66 displayed NA values equal 20% of the corresponding historical association total, truncated to thousandths | Verified arithmetic across 25 countries; NA's explicit field definition was not obtained. This supports an interpretation, not a provider schema contract |
| Club arithmetic | All 66 displayed coefficients equal the greater of the five-season sum and that minimum when displayed dashes contribute no season points | Conditional numerical agreement; dash semantics remain an assumption. Exact integer thousandths used, no floating-point rounding |
| Floor-dependent clubs | TSG Hoffenheim, Lillestrøm, Viking, Celta Vigo, Crystal Palace and Lens require the association minimum in this arithmetic check | A club-season sum alone would understate these six displayed values |
| Stable identifiers | 24 candidates had rendered UEFA badge URLs containing numeric identifiers; 42 did not in the captured state | Asset IDs are identity candidates, not a validated club identifier contract; no badge assets were imported |
| Remaining ranking inputs | Whole-club disciplinary totals, six missing values, complete stable identities and official final tie reconciliation remain open | No fresh disciplinary source was probed, no missing total became zero, and no qualification was inferred |

The reference period and max-of-sum/minimum rule are confirmed in [UEFA Annex D.2](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/D.2-Reference-periods-for-rankings-Online?contentId=VAG91Yk8b_GKQP7xOpGXIA) and [D.4](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/D.4-Club-coefficient-calculation-Online?contentId=FOOh6RppCk4IepHgN3eyHw). [D.7](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/D.7-Calculation-principles-Online) specifies thousandths without rounding up. [Historical club table](https://www.uefa.com/nationalassociations/uefarankings/club/?year=2026), [historical association table](https://www.uefa.com/nationalassociations/uefarankings/country/?year=2026).

## Material source-use limit

UEFA’s published clauses 6.2–6.3 limit content to private non-commercial viewing and prohibit systematic collection and automated scraping. Public access does not approve NS ingestion or redistribution. This is a product prerequisite, not a legal opinion. Use a separately permitted source or obtain authorisation before an import. No numeric dataset or logos were saved/published. [UEFA terms](https://www.uefa.com/termsconditions/).

## Recommended course

| Action | Business value and evidence | Effort and dependency | Cash and owner burden | Acceptance and reason |
|---|---|---|---|---|
| Park the website-derived import | Avoid building a technically incomplete, commercially unsupported source path; 66 candidates and six missing records are now known | Investigation complete; resume only with a permitted fixed-season source covering all 72 clubs | A$0 new spend; no purchase, contact or owner decision now | Source permission, explicit identities/field semantics, all 72 values and correction provenance must pass before integration |
| Preserve honest final ranking states | Missing disciplinary and coefficient inputs cannot yield an authoritative final order | Retain existing canonical owner and continuity rules; final official positions are an external dependency | No new scheduler or recurring task | Final unresolved ties remain Pending; no fabricated zero, alphabetical fallback or qualification |
| Advance independent refresh reliability | A fresh scheduled run stopped before publication at a stale country-flag assertion; this can be repaired without the blocked source | Small QA repair against the actual deferred Follow module, then normal release checks | Existing stack; owner intervention avoided | Retain original failure and meaningful checks; distinguish a passing repair from a later successful unattended refresh |

Certification remains **0/16 sport families and 0/3 Football pilots**, against the at-least-13/16 quality destination. Recovery, physical-device acceptance, source permissions, Australian playback and real cohort repeat-use evidence remain separate. This does not authorise worldwide expansion, a subscription or a replacement scraper.

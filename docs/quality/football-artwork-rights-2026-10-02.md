# Football artwork and commercial-use boundary — 2 October 2026

Recommendation: resolve the existing data/branding permission scope before expanding crest collection or launching sponsorship. Retain honest named-participant monograms for unsupported artwork. Once a usable permission route is established, complete the 39 missing club identities in one bounded Football polish module; do not create an owner-maintained badge tracker or claim that data attribution licenses logos.

## Verified current inventory

The read-only `scripts/audit-football-assets.js` uses the actual matchup resolver, current directory/identity registry and all 668 declared pilot fixtures. It checks those identities against the parallel Follow/Schedule projection, captures local file hashes, and records alternatives/provenance without fetching images or changing runtime data. It excludes 22 other Football records instead of counting them as pilot coverage. Runtime snapshot is 12501f4/shell 352, with exact current runtime bytes already verified live; documentation HEAD is separate.

| Competition | Fixtures | Clubs | Resolved crests | No resolved crest |
|---|---:|---:|---:|---:|
| EPL 2026/27 | 380 | 20 | 20 | 0 |
| Champions League league phase | 144 | 36 | 21 | 15 |
| Europa League league phase | 144 | 36 | 12 | 24 |
| Deduplicated pilot clubs | 668 | 84 | 45 | 39 |

Eight clubs occur in both EPL and European scope; competition counts are not additive unique-club counts. Twenty crests resolve to bundled Premier League SVGs with source URLs; 25 resolve to ESPN CDN references. All 45 carry the registry's `official-reference` label. That describes intended editorial identification/provenance, not verified commercial permission. The 39 missing crests include Celtic, Porto, Feyenoord, Benfica, Galatasaray, PSV and Lech Poznań. Exact identities and their competition membership are in the generated JSON; no new coverage or demand is inferred from this list.

The current renderer already creates named monogram fallbacks and retains participant IDs/profile controls. Missing artwork is a visible presentation gap, not a missing fixture or permission to invent a badge. This inventory confirms static resolver inputs; it does not independently prove every remote image loads, every authenticated path uses identical records, or that monograms meet the NRL/AFL polish target. Existing mobile journeys remain separate evidence.

## Competition marks and licence evidence

The EPL competition image points to a Wikimedia-hosted SVG. Its own file-information page identifies non-free copyrighted-logo use with a Wikipedia/US rationale. It is not an open commercial licence for NS's Australian product. This is a verified file-page description, not a legal determination about every possible identification use. [Exact file information](https://en.wikipedia.org/wiki/File:Premier_League_Logo.svg).

Current Premier League terms reserve supplier/club/logo rights and require owner permission; the existing EPL/API enquiry is not a blanket club-mark licence. Current UEFA terms also identify competition marks as protected and do not grant a general licence. The UCL registry uses an official UEFA logo URL. Each remains a separate unresolved branded-asset scope. [Premier League terms](https://www.premierleague.com/en/terms-and-conditions), [UEFA terms](https://www.uefa.com/termsconditions/).

Europa's event mark resolves to the generic Football glyph rather than a UEFA competition logo. The bundled Sporticon Apache 2.0 notice and upstream licence are present. This library evidence concerns the glyph; it does not clear any club crest or protected competition mark. [Upstream licence](https://github.com/ookamiinc/sporticon/blob/master/LICENSE), local `assets/licenses/SPORTICON-APACHE-2.0.txt`.

The 25 ESPN crest references have no NS-specific licence evidence in the inspected registry/directory. A direct ESPN terms-page read was unavailable; generic Disney US terms do not establish the exact Australian CDN/application scope, so that applicability remains unverified. No image download, replacement, new provider API use, contact, purchase or claim of legal clearance was performed. OpenLigaDB ODbL facts and free football-data.org permission enquiries remain separate from artwork.

## One recommended next step

Add these exact asset groups to the existing permission dossier, asking the existing EPL contact to identify the appropriate rights route rather than assuming it can sublicense every club or ESPN-hosted image. Keep the enquiries unsent until the pending messaging authorisation/reply email arrives. Do not start 84 independent owner decisions or add a paid logo service. If usable crest permission is unavailable, prepare one consistent original-monogram treatment for owner review before commercial launch; that is a product trade-off, not an automatic removal of current imagery. The sporting data/endpoint permissions still need their own evidence.

Business value: identifies the actual European polish gap and prevents a fixture-data permission being mistaken for whole-product clearance. Engineering effort: inventory completed; approximately 0.5–1 focused day for a consistent fallback treatment after its presentation decision, or 1–2 days for a licensed asset completion module once approved inputs exist. These are estimates, not measured delivery promises. Cash A$0 now; no spending approved. Owner impact: one existing consolidated rights review plus a material fallback decision only if necessary. Dependencies: scoped licence evidence, existing identities/renderer and unchanged release gates. Acceptance: all 84 club identities remain exact; every displayed crest has applicable recorded permission or an approved original fallback, with readable two-theme/mobile cards and no invented provenance. Until then, operations/rights and full presentation gates remain open; 0/3 pilots and 0/16 families certified.

Evidence: `football-assets-audit-20261002.json` in the existing delivery folder. The reusable command takes an explicit output path, reads local files only, and adds no scheduler, recurring owner chore or production deployment.

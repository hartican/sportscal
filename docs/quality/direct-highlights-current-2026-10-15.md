# Direct highlights shortcut — delivery record

## What changes for you

Recent finished matches already in your Feed keep a single **Watch highlights** action. If a checked match video is available, it opens that video. Otherwise, the action opens the first video returned by YouTube’s search service, with the note **Top YouTube result; match not verified**. There is no extra chooser or subscription.

## Current status

**Live and verified for this scoped delivery — 15 October 2026 Sydney.** App ce99221790e7e71b4cb9cbe0cec40346bcd2ada1, version 540, normal release 38608418831, READY dpl_Cgs3FDkCBfF4U9ni5V8ZTmGqmLLu. The canonical address and served files match the published app. Actual first-result and cached redirects pass. A search with no result correctly shows unavailable; broader sport and phone acceptance remain open.

## Evidence already completed

- Independent source reviews found no confirmed blocking issue in their stated scope.
- All 15,237 captured published records keep exactly the same server search text (765 non-empty searches). A separate source-owner check agreed on 3,690 current normalized fixture/time comparisons.
- The app keeps eight critical loading requests and stays within its unchanged 1.25% compressed-size allowance.
- Full highlights tests include the real isolated database migration, competing quota requests, older refresh versions, missing keys, failures, cache reuse, direct redirects and protected access. API, existing card presentation, cache and startup checks passed.
- Browser checks passed 30 cases across Chromium/WebKit, three widths, both themes, Feed/Events, repeated opening, hidden results and failed logos. Six natural followed-Feed checks each tested 115 recent match links. Local browser APIs were deliberately unavailable; these are not hosted redirect or phone proof.
- All three new server helpers are traced into the existing `/api/fixtures` owner (`api/feed.js`).

## Limits and safeguards

An unverified result may be the wrong video. The ranking is YouTube’s API relevance order, not a promise to reproduce personalised website results. The shared free allowance is at most 90 searches and 500 ordinary calls per Pacific day; scheduled discovery may use at most 50 searches. Fresh selections are reused for 24 hours. Valid retained selections can last 30 days, including when a new lookup has no key or remaining allowance. Provider failures can show a short unavailable message.

Only private quota and video-selection metadata may be written. Match facts, saved choices, existing refresh ownership and alert settings stay protected. No provider playback, signed-in customer journey or physical iPhone proof is claimed. The slow full background-data read and whole-sport quality gates remain separate work.

## Final release checks

The normal release passed all 212 ordered safety commands, both existing live-read preflights and 78 account guards. Both 539-to-540 installed/offline rehearsals passed; the first Chromium attempt stalled, and one unchanged retry passed. No gate was weakened. Live private-table/function permissions passed and the existing refresh function body is preserved exactly. Security review added no warning or error.

Four natural live Feed samples checked [17, 17, 17, 17] links in Chromium/WebKit at 390/1280 pixels: 68 visible checks from 115 eligible links, not exhaustive hosted certification. These browser samples ran on app `4f5e9de5`; all 35 checked served assets are identical in final app `ce992217`. Only private server diagnostics/key trimming and a deterministic test clock changed. Both prior installed/offline rehearsals exercise the same client bytes.

Two actual final-app requests for fixture:tennis:espn:atp:184939 opened the same selected video, and the private saved selection/date/hash plus unchanged deliberate-search usage prove reuse. The final-app Rune search returned no result; a private fixed-category diagnostic confirms that YouTube responded, so this is an unavailable result rather than demonstrated key failure. Two earlier 503 responses remain unclassified. Key trimming is defensive hardening, not the proven cause or cure. The WTA check also passes a real direct redirect for an already verified video. That fixture had gained a verified link during inspection; its initial checker type assertion failed, so the checker was corrected to recognise both legitimate response types and that failure is retained in the evidence record. Initial long-scroll browser attempts also failed when cards changed or detached; the final sample scope is disclosed.

The first diagnostic release `6aecafd9` was held before deployment because a captured test aged with the real clock. The final test freezes only the captured rehearsal, restores the clock even on failure, and independently proves the production six-hour stale guard still rejects an old receipt. Both independent reviews found no confirmed blocking issue. No release gate or production freshness guard was weakened.

Disposable guest follows were unchanged; no signed-in customer write, fixture injection, API mock, forced refresh, reminder send or playback test occurred. The 35 served files and 21 server-file inventory records match the exact final app.

The next data-speed task is now based on a read-only measurement: selecting the original 1,853 match rows took 4.147 seconds before projection/response work; a separately instrumented plan took 6.615 seconds, with millions of relationship comparisons. These are changing measurements, not output-equivalence or app-speed certification. No reader/writer/schema change was applied. See the adjacent `participant-reader-recovery-20261014` evidence folder.

Cash cost: A$0 added. Owner routine: none added. Whole-sport, physical-phone, broadcaster playback and slow background-reader acceptance remain open.

Evidence folder: /Users/jackhartican/Documents/AI/Codex/direct-feed-highlights-20261015

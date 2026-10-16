# Exact playable AUS–NZ highlights

The user followed up “resolve the playable link” after the quota-reuse repair shipped but its one actual Australia–New Zealand lookup still returned503. This request is for the exact2026 men's World Cup opener's highlights.

## Primary evidence

- Official match identity/result source: `https://www.nrl.com/draw/rugby-league-world-cup/2026/round-1/australia-v-new-zealand/`. Existing fixture/date/teams/competition/round and sporting facts remain unchanged.
- Official publisher destination: `https://www.rlwc2026.com/videos/australia-v-new-zealand---round-1-2026`.
- The official homepage's embedded initialVideos record identifies this same URL and title, CMS key157d27b667f24b899aeb475f0c00a0b8, flexId82824954, topic`/topics/match-highlights/`, source publication`2026-10-15T23:03:49.043Z` and the exact pairing/round/year.
- The detail page embeds public English-audio HLS metadata. Text-only master/one variant returned200,50segments, endlist and measured296.44seconds (4:56). No media files were downloaded or copied into the app.
- Native Codex browser playback passed the publisher's pre-roll and showed actual footage at13.627seconds of296.44, paused=false/readyState4/no media error. A later saved sample reached17.916seconds; that sample was paused/buffering, so do not mislabel it as uninterrupted playback. The page was left paused for the owner. This establishes browser start/advancing footage, not physical iPhone acceptance, all-territory availability or commercial reuse permission.
- A similarly named NRL search result1446346 was the2022 women's final and was rejected. No YouTube Data API search, resolver retry, quota reset or guard relaxation was used to find this clip.

Evidence: `/Users/jackhartican/Documents/AI/Codex/aus-nz-playable-link-20261016`, including public HTML captures, text-playlist runtime receipt and native screenshot/sample.

## Scoped behaviour and acceptance

Add one immutable reviewed destination in the existing shared highlights contract. Require the exact canonical fixture, competition, fixture day, numeric round, both participant IDs, completed/recent state, supported season/draw and a source publication after any known start. Require real non-future publication no more than seven elapsed days old, non-future verified receipt, English shortform and an HTTPS official-publisher video page. Current card click handling already re-evaluates this contract; source expiry cannot renew a sporting clock or stored receipt.

This card opens that exact official page directly, labelled RLWC2026 + Watch highlights, with no YouTube logo or misleading search claim. It makes zero app resolver/provider requests. Generic YouTube actions and the existing server highlights route remain unchanged. Other fixtures cannot borrow the receipt. No new player, raw-CDN user link, source adapter, scheduler, database write, API key, personal-state change, score/venue/clock edit or extra client request.

`validate-reviewed-publisher-highlights.js` first went red on the actual card's YouTube API destination; it now covers exact URL/label, context/unsafe evidence/expiry fences, normal generic fallback, immutable facts and Node/browser parity. It joins the canonical highlights gate. Native Feed/Events rendering, compressed bytes, installed/offline upgrade and normal exact-SHA release remain the publisher's gates. Source-only packet; Root owns generated runtime, shell553 after its reserved552 result/writing release, main and production. The playable external clip and the corrected production card are separate acceptance facts.

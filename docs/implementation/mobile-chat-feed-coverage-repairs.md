# Mobile chat, Feed and sports coverage repairs

## Summary

Deliver in three phases: chat reliability first, mobile presentation second, editorial and coverage third. Preserve existing Follow eligibility, spoiler controls, scoring rules and backend budgets.

Use an isolated worktree to protect unrelated local changes. Record coverage requests in the authoritative local register as **Pending ranking** when implementation starts; nothing has been changed during planning.

## 1. Make chat reliable and stable

- Scope every room load, poll, history request and message action to its originating room and navigation generation. Ignore stale responses after switching or closing rooms. Investigate server filtering alongside the identified client race.
- Reset room-specific messages, cursors, reactions and receipts on switching. Keep drafts, replies and pending uploads attached to their original room; prevent delayed sends from targeting another group.
- Make room Back/close return to the main chat board. Closing the board returns to the previous app screen.
- Enforce square, non-shrinking avatars with proportional image cropping and initials fallback.
- Lock horizontal page panning. Keep the header and composer stable within the visible viewport, including keyboard and safe-area changes.
- Preserve message nodes and reading position during polling, image loading and older-history insertion. Auto-scroll only when already following the latest messages.
- Replace inline Reply, emoji and Delete buttons with an accessible per-message overflow menu. Keep existing reaction counts visible and existing deletion permissions unchanged.
- Preserve the approved polling intervals and pause polling when closed or hidden.

## 2. Repair mobile presentation

- Anchor **Jump to Now** to the viewport’s bottom-right safe area, above persistent navigation. Remove conflicting positioning or ancestor effects that make it drift during scrolling.
- Collapse WRC followed drivers into one compact row with previous/next pagination and a page indicator. Keep every driver accessible without expanding card height; add the correct WRC logo.
- Give marquee fixtures a consistent accent, clear event-stage label and stronger heading hierarchy. Apply this to the Fremantle–Brisbane Grand Final; retain chronological ordering and use text as well as colour.
- Replace the leaderboard’s wide mobile table with compact rows: rank, avatar/name, points and secondary statistics. Remove white blocks, contain long handles, and retain Follow and See / copy follows actions. Preserve all statistics through expandable detail and retain the wider desktop layout.

## 3. Repair editorial and expand coverage

- Resolve each reported fixture against canonical identity and current source facts before editing:
  - Wallabies–Springboks, reported as 27 September: source-backed preview.
  - Zimbabwe–Australia: explicit winner and winning margin when spoilers are enabled.
  - Knights–Warriors and GWS–Richmond AFLW: result-based recaps once completion is confirmed.
- Prioritise editorial for any real five-star signal: personal, published editorial or crowd rating. Distinguish preview from post-match work; priority must not alter Feed admission.
- Invalidate stale previews when fixture status or results change. Check collapsed and expanded copy together, removing repeated headlines, sentences and repeated substantive information.
- Populate the full published PGA Tour schedule, including all four majors, with sourced results when available. Integrate ingestion into `node scripts/update-cards.js`; add no separate refresh scheduler.
- Organise tennis Schedule by tournament and edition, with rounds inside each tournament. Open around live/upcoming fixtures and the latest completed matches; keep older editions deliberately accessible.
- Replace the fixed tennis Major Events shortlist with catalogue-backed compact rows. Show all four Grand Slams in their own category.
- Include ATP Masters 1000, WTA 1000, tour finals, Davis Cup, Billie Jean King Cup and United Cup. Prioritise ongoing events and the next three calendar months; show later published editions separately.
- Preserve event-family follows and exclusions. Tournament follows must not silently admit tennis matches without the existing participant eligibility.

## Validation and release

- Add deterministic delayed-response tests for switching A→B→A, closing during polling, history loading, sending, reacting and deleting. Verify no cross-room content or actions.
- Test 320, 390, 768 and 1280px layouts, light/dark themes, long names, portrait/landscape avatars, keyboard transitions and slow media loading.
- Verify stable scroll position, no horizontal page overflow, reachable controls and a fixed Jump to Now position.
- Check the named editorial cases, spoiler protection, collapsed/expanded duplication, golf schedule completeness and tennis category/date ordering.
- Run applicable chat, leaderboard, Follow, editorial, backend-efficiency and canonical-refresh gates.
- Publish validated phases to GitHub main and deploy the exact published snapshot. Report GitHub SHA, Vercel READY, matching `releaseGitSha`, alias and live browser checks separately. Report installed-iPhone verification separately from browser simulation.

## Defaults

No scoring redesign, new paid services or changes to user consent. Preserve fixture IDs and saved user state. Dates and results remain source-backed; unpublished details stay explicitly unavailable.

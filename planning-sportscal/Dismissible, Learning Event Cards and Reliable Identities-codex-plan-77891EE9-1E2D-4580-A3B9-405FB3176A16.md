# Dismissible, Learning Event Cards and Reliable Identities

## Summary

- Apply the same interaction language to the main Feed and Events: left swipe or thumbs-down dismisses the exact card; right swipe or thumbs-up retains it and records positive feedback.
- Dismissals persist across reloads and signed-in devices. The same canonical event edition disappears across Feed and Events, while future editions and merely related events remain eligible.
- The screenshot is chronologically correct by full date—Wednesday 26 August at 10:00 am precedes Thursday 27 August at 9:00 am—but the orphaned “Today” divider is misleading. Replace it with unambiguous today/tomorrow treatment.
- Replace placeholders for every resolved tournament or team with a real identity mark. Only genuinely unresolved bracket positions may retain seed/TBC treatment.

## Implementation Changes

- Extend `eventUserState` with `dismissed`, `dismissedAt`, and dismissal source. Keep dismissal separate from automatic/completed-card archiving and key it to the canonical event or major-event edition.
- Turn the existing Feed feedback controls into real actions: negative feedback animates the card away and filters it immediately; positive feedback leaves it visible. Add identical controls and swipe handling to Events cards, with keyboard and reduced-motion support.
- Show an actionable Undo toast after dismissal. Immediate Undo restores the prior visibility and learning snapshot; Settings gains a dedicated Hidden events list for later restoration. Later restoration makes the card eligible again but retains the historical taste signal.
- Wire feedback into the existing preference learning graph. One dislike gives related sport/team/competition suggestions only a small bounded score penalty and never changes explicit follows, pinned fixtures, or canonical chronological ordering. Repeated related dislikes may progressively demote optional suggestions; likes provide the inverse lift. No single interaction can ban a sport, competition, team, or future event family.
- Preserve chronological ordering by complete Sydney date-time. When no upcoming cards remain today, render “Nothing else today”; mark the following date heading “Tomorrow” when applicable. Never place an unexplained “Today” divider directly above tomorrow’s cards.
- Propagate canonical `competitionId`, `brandId`, participant IDs, and parent tournament identity through refreshed finals, tournaments, derived markers, and ordinary Feed fixtures.
- Expand the identity registry so active tournaments and finals resolve to official first-party marks where practical, otherwise a vetted local/open-use editorial tournament mark. Bundle active identity assets locally where permitted to avoid transient external-image placeholders.
- Resolve known teams from canonical IDs first and aliases second. Both known sides must render their logos; dependency labels such as “Winner of PF1” remain honest seed/TBC slots until the source resolves them.
- Keep the interface restrained: existing card chrome, clear thumb affordances, a short directional removal motion, and no gesture interception when starting on links, buttons, schedules, or horizontally scrollable draws.

## Interface and Compatibility

- Upgrade the preference/feedback migration without losing existing likes, dislikes, archive records, or synced profile state.
- Extend the user-state schema and server sanitisation/merge path for dismissal metadata and active feedback references.
- Preserve existing archive, save, reminder, follow, spoiler, and “Add to Feed” behaviour. Dismissing a parent event does not dismiss its individual fixtures, and dismissing one fixture does not hide the parent tournament.

## Test Plan

- Validate left-swipe/thumbs-down removal, right-swipe/thumbs-up retention, Undo, reload persistence, cross-device sync, Hidden-list restoration, keyboard controls, reduced motion, and gesture cancellation on interactive descendants.
- Confirm a single dislike leaves related suggestions eligible with only a small score reduction; repeated dislikes demote optional suggestions gradually; explicit follows and pinned fixtures remain visible.
- Test the screenshot scenario using the Sydney clock: Wednesday 10:00 am past, no remaining Wednesday cards, Thursday 9:00 am upcoming. Assert ascending timestamps, “Nothing else today”, and a “Tomorrow” date label.
- Validate every active Feed and Events tournament has a non-placeholder tournament mark and every resolved team matchup has two logos. Permit placeholders only for explicitly unresolved bracket participants.
- Run the canonical `node scripts/update-cards.js --local-only` pipeline, identity and preference validators, then browser-QA Feed and Events at 390, 768, 1440, and 1728 widths in light and dark themes, checking swipe behaviour, overflow, broken images, logo containment, scroll stability, and console errors.

## Assumptions

- Dismissal applies to the exact event edition only.
- Left means dismiss/less like; right means like/more like.
- The main Feed means its normal chronological list, including major-event markers; archived recovery cards and specialist horizontal rails are not swipe-dismissable.
- This plan covers implementation and validation. GitHub publication and Vercel production deployment follow the repository’s exact-SHA release process when execution is authorised.

# Keep the selected sport Follow checkbox available

User report: on the live Follow tab, following/unfollowing a sport is difficult
because the checkbox appears sporadically. The repair must keep the existing
control discoverable through menu opening, closing, scroll collapse and Follow
redraws, without changing what is followed.

The actual render block plus navigation owner reproduced the symptom against
main `a6ddd15caacdaf918e8108c3cfa0e54b98e22d90`. DEPLOY reports live shell595 at
`6f83a6cbc7070eb33ec4faed17ae50a56643f114`; those two Follow source files are
byte-identical. This binds the source diagnosis to that reported release, but
is not an independent hosted/installed-phone observation.

The narrow repair marks the existing sport label, then moves that same node
outside the collapsible controls. Its checked value, native input, accessible
label and existing save handler remain. If that handler refuses the change,
the displayed checkbox returns to the saved value; account/save guards are
unchanged. Other competition/filter controls stay where
they were. No new preferences, consent, defaults, account data, source/fixture
facts, API, schema, scheduler, cache/version or runtime dependency is added.

The source regression uses the actual render block and mount owner with sixteen
sport/checked-state/accepted-or-refused scenarios, checks visible states and exact callback scope,
and confirms browsing does not change supplied choices. It exercises the actual sport writer against a controlled persistence boundary.
It does not claim browser geometry or real persistence/API delivery. A separate focused native
matrix must exercise actual app startup, late directories, rerender, menu
collapse, real control taps and unchanged negative choices at the final head.

Full PR41 remains frozen at `35384b98339b1fbfa129d8177d4817266bc04622`, with its
original45-suite/40-browser proof preserved. Its broader source, generated
assets and typed preference compatibility are separate DEPLOY/SYNC work; this
hotfix neither replaces that scope nor assumes it already repaired the live UI.

DEPLOY is the sole publisher and allocates heavy/browser operations. Local
proof, hosted release acceptance and physical iPhone acceptance remain separate.

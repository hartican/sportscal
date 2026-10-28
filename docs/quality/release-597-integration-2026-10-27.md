# Release 597 integration — preparing, not published

Base and deployed shell: 8849bd09bd8c875a917a9c0852792a1f6bc71d41 / 596. Actual iPhone sync acceptance failed before any save. Preserve that evidence; source and hosted checks do not establish physical resolution.

Integrates frozen source PR90 (Cricket generic/team/tour admission) and PR91 (the reproduced Events-view sync hold and conservative newer-choice protection). Shared generated runtime and cache references are assembled once by DEPLOY. No schema/config migration, account recovery, provider refresh, scheduler restart or new service.

Cricket projections were rebuilt through the existing canonical scoped offline route. All 151 fixture records retain IDs, facts and per-fixture source times; 144 gain exact edition IDs. The aggregate existing freshAt marker follows unchanged feed-meta.publishedAt, not this build or a new source observation.

The regenerated candidate initially measured 3,147,142 bytes against the unchanged 3,145,728-byte installed-shell cap. Compact serialization of the already-installed Follow directory manifest removes 2,684 formatting bytes. Parsed JSON, array ordering, source dates and every fact are identical. The existing producer uses the same compact output so later refreshes retain this saving. No asset or feature is removed. HTML, CSS and executable source were not minified or reformatted to make space.

Version/cache URLs for app shell, Account and changed Follow UI are coherently 597. All other lazy versions remain unchanged. Generated Account and shell runtime must pass exact source equality, normal gates, installed/browser checks and production acceptance before any new iPhone test.

Rollback reverts this complete source/generated/cache module through DEPLOY; retain pending receipts and choices. Do not reset, restore, sign out, reinstall or clear customer storage.

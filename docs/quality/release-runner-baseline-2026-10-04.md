# Release runner baseline — 4 October 2026

Recommendation: keep the passing Ubuntu 24.04 OS family explicit for the existing production and deployment-cleanup jobs. Preserve the canonical macOS/PDFKit route. This reduces an avoidable release-compatibility variable during the MVP programme without adding an owner routine, vendor or scheduler.

## Verified evidence and scope

Main `e9c309d2` used `ubuntu-latest` for production and deployment cleanup. The preceding successful app workflow 37132199301 actually ran Ubuntu 24.04.5 / image `ubuntu-24.04` / image version `20260927.320.1`; the setup log is retained. [GitHub's official migration announcement](https://github.com/actions/runner-images/issues/14748), checked 4 October Sydney, plans to move the floating label to Ubuntu 26.04 between 19 October and 19 November 2026 and identifies possible software/library/compiler differences. [Supported runner documentation](https://docs.github.com/en/actions/reference/runners/github-hosted-runners) lists the explicit Ubuntu 24.04 label. This is a future compatibility risk; the old job is passing, not broken.

Two `runs-on` scalar replacements select `ubuntu-24.04`. Everything else in both workflows remains byte-identical. The canonical `macos-15` route stays unchanged because ATP ranking extraction requires PDFKit. Node 24, actions, concurrency, secrets, permissions, schedules, cleanup candidates/retention and normal gates stay unchanged. No cleanup or canonical refresh is forced and no parallel workflow is added.

The label pins an OS family, not an image digest. GitHub's weekly image/security updates, action major tags, Node minor versions, global CLI dependency resolution and platform build implementation can still change. Do not claim bit-for-bit reproducibility, zero risk or measured savings. Node-20 action-runtime migration notices remain separate; this change does not upgrade the artifact action.

## Recommended operating practice

| Recommendation | Business value and evidence | Effort/dependency | Cash and owner impact | Acceptance and limit |
|---|---|---|---|---|
| Keep verified OS family explicit | Avoid an unplanned major Linux change during the 90-day programme; real passing image and current official migration evidence | Two existing workflow labels; same hosted runner class and Node/tool installation | A$0 new purchases, no owner decision or recurring task; existing CI/model cash unmeasured | Actual normal cloud run on Ubuntu 24.04, all existing gates and exact published release proof |
| Retain canonical macOS boundary | Keep official ATP/PDFKit extraction supported; existing owner validator explicitly requires macOS 15 | No canonical workflow edit or extra source call | No second scheduler, dataset, subscription or provider load | Existing owner gate and unchanged canonical workflow; a new ordinary source run remains separate evidence |
| Review future upgrades as existing exceptions | OS-family selection allows supported security/image patches and makes major changes deliberate | Normal release checks and dated compatibility evidence before a major switch | Same brief weekly review, no new tracker/meeting or promise of token savings | Failure stops release; avoid cleanup/customer operations merely to verify infrastructure |

Verification uses exact source comparison and existing affected validators, not a new test that repeats the implementation. Local `require.resolve('yaml')` found no YAML package; no dependency was added. The two fixed supported scalar edits are verified directly, and the real cloud runner is the acceptance evidence. Local, main and app deployment states are recorded separately under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`, prefix `runner-baseline-20261004`.

Local deployment-decision and canonical-owner validators pass. All 1,373 tracked app/server/data/provider/configuration/schema/Supabase SQL/shell/deployment files match the preceding main byte for byte. The full unchanged application suite is not rerun locally; the existing mandatory cloud suite remains required. Production proof and actual new job image are recorded after that workflow succeeds, not inferred from this source comparison. Cleanup is not dispatched to test its label.

The wider CTO programme remains open: Football quality, rights/playback, real repeat-use evidence, physical device and independent recovery are not addressed by this workflow change. Certification stays 0/16 families and 0/3 Football pilots, target at least 13/16. No app/fact/profile/Follow/cache change or commercial launch is implied.

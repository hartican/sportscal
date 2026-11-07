# Overnight beta candidate — 7 November 2026

This record supersedes the release-blocked status in the earlier native Chat
continuation report. Work continues on `overnight/nothing-sport`; production
acceptance is determined by the serialized release workflow for the final SHA.

## Functionality

- Integrated accepted main `e339ecb6` and retained its canonical sporting data.
  The inherited local changes remain backed up in the ignored task directory.
- Preserved full-screen Chat, a separate message scroller and anchored composer,
  multiline Return, explicit Send and modifier+Return.
- Fixed the integrated header controller removing the Feed spacer on scroll.
  Feed now retains a stable header and document position.
- Capture Chat's opening focus and scroll before background inertness clears
  focus. Closing the existing room/inbox navigation restores both.
- Isolate the Feed timeline controls, navigation and skip link behind Chat.
- Integrated the native helper in the canonical generated runtime, with an atomic
  shell/cache version of **611**. The production workflow remains byte-identical
  to accepted main; the canonical update chain retains the native-shell check.

## Automated evidence before publication

- Generated-runtime build, shell/cache consistency and native-shell checks pass.
- Native Chat browser checks pass in Chromium and WebKit at 390×844, 430×932,
  768×1024 and 1280×900. They exercise scroll/focus restoration, isolated controls,
  multiline input, repeated simulated keyboard geometry, reader scroll-back and
  delayed successful/failed sends.
- Chat presentation passes at 320, 390, 768 and 1280 pixels.
- Installed-app upgrades from production **610** to candidate **611** pass in
  both engines: preferences, optional/core asset failures, offline restart and
  resumed upgrade. Requests stay inside disposable loopback fixtures.
- All 256 ordinary production safety commands were attempted locally with the
  workflow's Node 24 major. After repairs, **252 pass**. Four checks refuse the
  repository-local temporary directory because their private evidence must be
  outside every Git checkout: `validate-update-cards`,
  `validate-editorial-run-readout`, `validate-editorial-control-snapshot` and
  `validate-pilot-readout-sql`. These protections remain unchanged. The normal
  cloud release must run all four, plus its SQL batches and live-read gates,
  before deployment.
- The immutable deployment package passes its dependency/catalogue checks and
  real offline public-fixture route. It contains 1,957 files and 8,022 catalogue
  events. Its size warning remains visible; it is not represented as a failure.

## Validator repairs

Existing tests now reflect the approved sports/teams guest flow, confirmed-email
participation, exact pre-ACK receipt retention and device-local views through R2.
Historical guest transcripts remain covered without allowing new unconfirmed
guest messages. Account hydration and deliberate handoff tests retain distinct
fixtures. Disposable Git controls cannot accidentally discover the parent repo.
Editorial workflow tests use the existing guarded normalizer for the two
permanently registered selection suites; no workflow gate is removed.

The unchanged 3 MiB precache limit now measures the actual service-worker install
requests instead of the optional artwork inventory. The actual install is
2,538,229 bytes (2.42 MiB); the complete inventory is 3,218,946 bytes. Optional
artwork already caches on use. This changes the measurement, not worker behavior,
the threshold or the required assets. Compressed startup size reports the notice
required by the existing November buffer policy.

## Evidence limits

Desktop WebKit and simulated viewport geometry do not establish physical iPhone
Safari or Home Screen behavior. Physical keyboard dismissal, Safari toolbar
changes, dictation/emoji, 200% text and live GIF/message sending remain untested.
No real chat message, rating, notification or customer-state mutation was used
for these checks. The final publisher must separately verify READY, the exact
GitHub SHA, production aliases and served release bytes.

Local raw logs, initial-change backups and result ledgers are kept under
`tmp/overnight-beta-20261107/` and are excluded from publication.

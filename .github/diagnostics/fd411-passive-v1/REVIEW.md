Prepared and INERT. No target application, browser, native test, CI, dependency
install, source edit or push was executed by the worker. Node checks were
syntax-only. Python performed construction, static parsing and inverse checks.
No execution allocation exists.

This is derived from the exact failed FD harness,122602 bytes/SHA256
`f89dee0c3df764307c82354ea209edf891041aa7946a659a7207db123fecbb61`, candidate
`fd411c9313ec1e8c08392ac429086abcd809fa20`, tree
`3723b0cc3ce121d3b757326cfebe5b577adb9858`. It retains the complete harness.
The only two insertions are:

1. `insert-recorder.js.txt` after the existing `qaSignInTrace=[]` in its existing
   page.evaluate, original line555. It is gated by the existing original-manifest
   flag. It leaves the original trace and render wrapper untouched, installs
   passive listeners/one targeted MutationObserver and stores bounded geometry
   in memory. It contains no await, app mutation or input action.
2. `insert-failure-capture.js.txt` after the original initial-sign-in failure log,
   before its original throw, original line602. It reads that recorder, saves JSON
   and a viewport PNG under a single total5s observation deadline, then reaches
   the unchanged throw. Geometry and screenshot failures are explicit. A pending
   read after deadline is handled by Promise.race; original finally closes its
   page/context. No capture failure handles or changes the sign-in failure.

`logging-only.patch` is reviewable. `static-inverse-proof.json` records that
removing exactly those insertions recovers every original byte. All original
native click,15s wait, input fills, startup/manifest barrier, held-response
interruption, network route guard, assertions and finally remain. The recorder
uses a64-entry last-records ring and8-entry error-stage list, with explicit
dropped counters. A separately reserved failure snapshot cannot be evicted by
earlier layout events. It records capture/bubble defaultPrevented flags, real
coordinates/targets, independent WeakMap node identities, rect/hit stacks,
focus/modal scroll/viewport, root scroll padding/Follow scope, helper readiness,
and help/detail text lengths. No raw text, class strings, entered values,
password lengths, account IDs, credentials, payloads or tokens enter the added
recorder. The viewport PNG is only of the existing disposable local test. The
original test's existing logs remain unchanged.

Instrumentation can perturb timing, especially synchronous layout reads. The
last-records ring and final snapshot are evidence, not a causal verdict. A pass
must be NO REPRO/INCOMPLETE and cannot qualify a fix or waive the retained RED.
Missing screenshot/geometry, dropped records, captured faults, timeout, forced
cleanup or source mismatch must remain visible. There is no guessed app repair.
Ranked predictions remain in the parent folder's first-return.md.

ROOT execution boundary:

- Supported Linux/Node24.21.0/Playwright1.64.1/WebKit only,390×844 with hasTouch,
  as already specified by the immutable harness. Mac/local1.62.1 is rejected.
- No new workflow, job, publisher, permission, scheduler or native stage is
  created. ROOT decides how to carry these logging-only files through its
  existing PR99 CI owner. This packet is not permission to dispatch or push.
- ROOT reviews the actual carriage diff, runtime hashes and source bindings,
  then supplies a fresh matching allocation outside the packet. The example is
  NOT_ALLOCATED, has missing runtime/head/expiry fields and cannot run. This
  worker did not exercise the operator or its allocation gates.
- `run-inert.py --allocation /absolute/ROOT-allocation.json --run` proposes one
  child,90s cap/120s whole, no retry, atomic single-use output directory. It
  preserves the existing same-origin route guard and disposable transport in
  the unchanged harness, sets only the original case flags and logging output,
  and never loads a real/customer account or asks for a phone action.
- The allocation pins the exact CI delivery HEAD and permitted carriage files.
  Relative to FD, only the packet itself and the existing installed workflow
  file may differ, each with a reviewed hash. The actual original recovery
  harness must still be byte-identical to FD. All application/data files remain
  FD. A carriage change is not approved by merely listing it: ROOT reviews it.
- The launcher preserves the original module filename/root and relative module
  paths. No module injection or process argv change alters the scenario.
- `owned-cleanup.py` contains exact members/cleanup function bodies from the
  already reviewed helper with parent SHA256
  `ab42e8ee56ec7ef64a4500d59e0db7e9d3c2ea69caa1fd357ed26c40cc2cf310`.
  It runs no test on import. Only the new child process group can be signalled;
  the final12s are reserved for readback/report. Runtime/platform portability is
  not asserted from source checks and remains part of ROOT operator review.
- Original nonzero status is retained. Exit0 is explicitly reported
  NO_REPRO_INCOMPLETE_NOT_ACCEPTANCE. Original15s RED with capture is retained
  without automatically declaring the cause. Other failures stay incomplete.

Return allocation, complete raw log, JSON/PNG, supervisor/runtime pins and file
hashes to ROOT and source owner. Keep original40946445092 RED, normal46 account
passes, original4ec Players occlusion and historical e30 hidden Tennis distinct.
No retry, timeout increase, force click, synthetic submit, visibility workaround,
barrier change, gate waiver, API/DB/customer/provider/source-refresh/scheduler,
production or physical-device operation is included.

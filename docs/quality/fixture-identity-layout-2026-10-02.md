# Fixture identity layout repair — 2 October 2026

Business outcome: clubs with unavailable artwork remain readable and equally prominent in compact Feed cards, while narrow-screen Schedule cards keep both identities inside the card. This improves the existing Football experience without collecting badges, replacing existing branding or expanding coverage. The shared component is also checked against actual NRL/AFL fixtures; neither reference sport is assumed fully certified.

## Reproduced defects and repair

| Defect | Before | Repair and acceptance |
|---|---|---|
| Compact Feed fallback | Published Crystal Palace–Lech Poznań rendered a 48px crest beside a 22px initials circle; initials were about 8px | Both identities use a 48px frame; missing/failed artwork keeps readable 16px initials, original participant names and profile controls |
| Narrow Schedule identity | At 320px, AEK's circle extended beyond the card edge despite no page-level overflow. A width-only probe still failed AZ Alkmaar because the timing column consumed 204px of a 267px row | Bound all three grid tracks and their contents, allow timing to wrap, and keep the fallback round. Actual missing/failed artwork and NRL/AFL controls must fit inside the card |
| Offline stylesheet version | The existing gate checked scripts but could miss a changed stylesheet query absent from the install manifest | Extend that same gate to the four critical stylesheets. A deliberate v353 page/old-worker mismatch fails, then the consistent shell passes |

The corrected `scripts/validate-fixture-identity-browser.js` exercises real rendered builders and retained published fixture inputs. Ninety-six cases pass in each of Chromium and WebKit: compact Feed/opened Schedule × four widths (320/390/768/1280) × day/night × Football/NRL/AFL × published/deliberately unavailable artwork. Both named profile controls survive. The first WebKit attempt inspected `complete` before the image's error handler settled; that failed observation is retained. The final harness waits for positive natural dimensions or removal by the real error handler. No assertion was waived.

Earlier full-library injection/scroll probes interfered with lazy rendering and were not valid product reproductions. A CSS-injection probe is explicitly labelled candidate evidence, not a production acceptance result. The two minimized regressions above fail before their respective repairs. Broad current-crest/missing-crest evidence and physical-device acceptance remain separate.

## Release safeguards and boundaries

Candidate shell 353 forwards the exact CSS query in HTML and worker together. Chromium and WebKit open-page 352→353 rehearsals pass preferences, explicit follows, unsent draft preservation, optional failure, required failure retention, offline restart/resume and exact cached standings/profile code. The critical request count remains eight and compressed growth is 1.20%, below the unchanged 1.25% cap. Runtime build, presentation, generated-version and worker fallback checks pass. This is browser simulation, not an installed iPhone result.

No fixture, result, table, timestamp, editorial, participant identity, profile implementation, provider, refresh, scheduler, credential, account activity, push or permission change is included. All 668 pilot fixture identities and the retained 45 crest resolutions/39 missing-crests scope remain unchanged. Commercial artwork/source rights remain open. Certification remains 0/3 Football pilots and 0/16 carried families.

Cash cost A$0; no recurring owner task or new decision is added. Effort was one bounded layout module with existing release machinery; no claim is made for attributable total tokens or owner time saved. Dependencies: existing identities, component builders and release gates. Act now because these were reproducible presentation defects; defer new crest collection until applicable permission/input exists. Full NRL/AFL-equivalent polish is a larger acceptance boundary.

The first cloud dispatch used an incorrectly transcribed SHA and was rejected by the mainline gate ([36941715470](https://github.com/hartican/sportscal/actions/runs/36941715470)); no deployment ran. The correct published d0eb800 dispatch then stopped at the unchanged private-chat gate ([36941798852](https://github.com/hartican/sportscal/actions/runs/36941798852)); no deployment ran. This reproduced locally: the test selected the manual WSL seed from Feed with a five-hour window, while the API's canonical chat registry enforced three hours. At 23:40 UTC it was eligible only under the raw Feed window. The positive test now selects an actual canonical upcoming fixture with one hour of clock headroom. Controlled mismatched/near-cutoff selection cases and the full signed-in/guest/limits/privacy/closure suite pass. No chat policy, API or source data is relaxed or changed. The distinct Feed/chat window provenance is recorded for later source-quality review; choosing a different test input does not certify that sporting fixture.

Local acceptance and production verification are complete within the scope below. Full sport, device, independent recovery and commercial rights acceptance remain open.

Evidence is retained under `/Users/jackhartican/Documents/AI/Codex/nothingsport-first-delivery-2026-09-27`: compact/schedule before logs, cache mismatch log, both final fixture-identity reports, screenshots and both upgrade logs. Failed diagnostics are not counted as passes.

## Production acceptance

Published/deployed `a40388fa4d691e273dea74e20a4c8e7c7cc2eab3`, shell 353: [normal cloud run 36942202562](https://github.com/hartican/sportscal/actions/runs/36942202562) passes all required gates in 183 seconds. READY `dpl_BcruRd7K1iFT71PPVvBsszdahdFL`; production target and three aliases agree. Fourteen immutable-package/served hashes, including the changed CSS, match at 2026-10-01T23:45:58.277Z. All original pilot core data and runtime/profile bytes are unchanged from the previous deployed module.

Live Chromium executes the actual production builders with APIs unavailable, worker blocked and external imagery aborted: 39 missing-club identities × compact/full Feed/full Schedule × 320/390 × day/night = 468 participant-surface observations. Every target monogram remains visible, fits the card, retains both named profile controls, and uses the repaired compact frame/round Schedule shape. This counts participant observations, not 468 distinct fixtures or all 668 fixture journeys. Screenshots are controlled fallback evidence; they do not prove every remote crest loads or ratings/chat works.

A separate fresh anonymous production session enables the real worker: shell/worker 353, exact v353 stylesheet cache bytes, exact packed standings, no page overflow at 320/390 and offline restart pass at 2026-10-01T23:47:01.914Z. It is not authenticated or physical-phone proof. The existing reference fixture tests cover normal/failed crest loading in both engines. No live reminder, account activity, source refresh or permission outreach is performed.

The first two failed cloud attempts remain explicit failure evidence. The canonical positive chat fixture test was repaired and the unchanged API/policies passed the normal cloud gate. This repair does not settle the manual WSL source/Feed/chat live-window discrepancy, which remains in the existing sport-quality review scope.

Recommended next step: retain the fixed three-competition scope, collect the next ordinary repaired-refresh evidence when it occurs, and finish the existing consolidated rights and physical-device/independent-recovery gates. Keep extra crest collection, new competitions and revenue launch deferred until their acceptance inputs exist.

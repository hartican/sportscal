# Startup size advisory buffer

Owner decision, 2 November 2026: valid static compressed-size growth above
the existing 1.25% reference buffer produces a visible NOTICE, not a halt.
Approval: Sentinel_8032b3273f788191adeaa82c90a09c3f /
Sentinel_dd18922936108191a0ef119e46337c1b.

- Historical baseline remains 426,115 gzip bytes at
  e70de9a53543b0894ceaf6dbdff60569d47a9c87.
- The 1.25% advisory buffer remains 431,441 bytes.
- The reviewed 607 payload is 431,735 bytes: +5,620 versus baseline and
  +294 above the buffer. Report those values as a NOTICE.
- This policy requires no further per-version small-size exception.
- Missing, malformed, corrupt or wrongly bound measurements remain failures.
  Current Git identity, shell version, exact path/hash manifest, totals and
  Node/zlib measurement binding must agree.
- Critical request bounds and every other performance, runtime, functional,
  security, integrity, installed-upgrade and release assertion remain hard.
- Keep the 606 exception, its refusal tests and prior RED evidence as history.
  It is not the active ordinary size decision.

The performance validator prints the notice and retains its remaining checks.
A successful size notice alone is not a successful release.

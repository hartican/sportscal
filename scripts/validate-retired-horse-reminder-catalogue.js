#!/usr/bin/env node
"use strict";

// Acceptance only. Existing reminder/source owners retain catalogue changes.
const assert = require("node:assert/strict");
const fixtures = require("../lib/reminder-fixtures");
const captured = require("./fixtures/retired-horse-publisher-input.v1.json");
const now = new Date("2026-11-07T12:00:00.000Z");
const clone = value => structuredClone(value);
const ordinary = [
  { id: "control:f1", key: "f1", name: "Motor race control", sourceEventIds: ["control:f1:provider"] },
  { id: "control:motogp", key: "motogp", name: "Motorcycle control" },
  { id: "control:gymnastics", key: "gymnastics", name: "Pommel horse control" },
].map(f => ({ ...f, status: "upcoming", scheduleStatus: "confirmed", timePrecision: "exact",
  startTimeUtc: "2026-11-07T13:00:00.000Z", sourceUrl: "https://example.test/withdrawal-control",
  sourceCheckedAt: "2026-11-07T11:00:00.000Z", editorialNarrative: { hook: "Retain ordinary context" } }));

async function validate({ controlsOnly = false } = {}) {
  const cases = [];
  let requestAttempts = 0;
  const request = async () => { requestAttempts++; throw Error("Unexpected reminder transport"); };
  async function check(name, run, acceptance = false) {
    if (controlsOnly && acceptance) return;
    const observed = {};
    try { await run(observed); cases.push({ name, acceptance, status: "PASS", ...observed }); }
    catch (error) { cases.push({ name, acceptance, status: "FAIL", ...observed, message: error.message.split("\n")[0] }); }
  }
  const baseline = await fixtures.catalogue({ rows: clone(ordinary), snapshots: [], request, now });
  await check("ordinary motorsport and pommel horse remain resolvable", () => {
    assert.equal(baseline.fixtures.length, ordinary.length);
    for (const event of ordinary) assert.equal(baseline.resolve(event.id).name, event.name);
    assert.strictEqual(baseline.resolve("control:f1:provider"), baseline.resolve("control:f1"));
    assert.equal(baseline.resolve("unrelated"), null);
  });
  await check("ordinary snapshot correction uses the actual overlay without renewing older facts", async () => {
    const snapshots = [{ source_id: "withdrawal-control", checked_at: "2026-11-07T11:30:00.000Z",
      fixtures: [{ ...ordinary[0], startTimeUtc: "2026-11-07T14:00:00.000Z" }] }];
    const before = JSON.stringify({ ordinary, snapshots });
    const result = await fixtures.catalogue({ rows: ordinary, snapshots, request, now });
    assert.equal(result.resolve("control:f1").startTimeUtc, "2026-11-07T14:00:00.000Z");
    assert.equal(result.resolve("control:f1").sourceCheckedAt, snapshots[0].checked_at);
    assert.equal(JSON.stringify({ ordinary, snapshots }), before);
  });
  await check("failed ordinary snapshot preserves display facts and holds timing", async () => {
    const snapshots = [{ source_id: "withdrawal-control", failure_count: 1, last_error: "synthetic failure",
      checked_at: "2026-11-07T11:30:00.000Z", fixtures: [clone(ordinary[0])] }];
    const result = await fixtures.catalogue({ rows: clone(ordinary), snapshots, request, now });
    assert.equal(result.resolve("control:f1").timingVerified, false);
    assert.equal(result.resolve("control:f1").name, ordinary[0].name);
    assert.equal(result.resolve("control:f1").manualEstimateHeld, true);
  });

  async function excluded(name, rows, snapshots = []) {
    await check(name, async observed => {
      const input = { rows: [...clone(ordinary), ...clone(rows)], snapshots: clone(snapshots) };
      const before = JSON.stringify(input);
      const result = await fixtures.catalogue({ ...input, request, now });
      const ordinaryIds = new Set(ordinary.map(f => f.id));
      observed.unexpectedFixtureIds = result.fixtures.filter(f => !ordinaryIds.has(f.id)).map(f => f.id);
      assert.equal(JSON.stringify(input), before, "Retained raw/snapshot history changed");
      assert.deepEqual(result.fixtures.filter(f => ordinaryIds.has(f.id)), baseline.fixtures,
        "Complete ordinary catalogue output changed");
      assert.deepEqual(observed.unexpectedFixtureIds, [], "Withdrawn fixtures reached reminder catalogue");
      for (const f of rows) for (const id of [f.id, f.canonicalEventId, ...(f.sourceEventIds || [])].filter(Boolean)) {
        assert.equal(result.resolve(id), null, "Withdrawn saved/provider alias remains resolvable: " + id);
      }
    }, true);
  }
  await excluded("captured public Cup fixture cannot be resolved for reminders", [captured.withdrawn]);
  await excluded("typed ordinary horse event is excluded without a Cup-specific name", [
    { ...ordinary[0], id: "withdrawn:horse", sourceEventIds: ["withdrawn:provider"], key: "horse-racing", name: "Retained meeting" },
  ]);
  for (const id of ["event:horse-racing:melbourne-cup:2026", "event-horse-racing-melbourne-cup-2026"]) {
    await excluded("saved Cup namespace is excluded without sport metadata: " + id, [{ id, name: "Opaque retained record" }]);
  }
  const graph = [
    { id: "withdrawn:seed", key: "horse-racing", sourceEventIds: ["withdrawn:provider"] },
    { id: "withdrawn:alias", canonicalEventId: "withdrawn:provider" },
    { id: "withdrawn:child", parentId: "withdrawn:alias" },
  ];
  for (const reverse of [false, true]) {
    await excluded("withdrawn aliases and descendants are excluded in " + (reverse ? "reverse" : "source") + " order",
      reverse ? [...graph].reverse() : graph);
  }
  await excluded("stale shared overlay cannot reintroduce withdrawn horse coverage", [captured.withdrawn], [
    { source_id: "withdrawal-overlay", checked_at: "2026-11-06T11:00:00.000Z", failure_count: 1,
      fixtures: [{ ...clone(captured.withdrawn), status: "upcoming", startTimeUtc: "2026-11-07T13:00:00.000Z" }] },
  ]);
  await excluded("compact-shaped overlay retains withdrawal identity after raw metadata is absent", [
    { id: "withdrawn:compact", name: "Opaque retained record" },
  ], [{ source_id: "withdrawal-overlay", checked_at: "2026-11-07T11:30:00.000Z",
    fixtures: [{ id: "withdrawn:compact", key: "horse-racing", status: "upcoming", startTimeUtc: "2026-11-07T13:00:00.000Z" }] }]);
  await check("supplied snapshots perform zero transport operations", () => assert.equal(requestAttempts, 0));
  const report = { schemaVersion: "retired-horse-reminder-catalogue-acceptance.v1", controlsOnly,
    status: cases.some(c => c.status === "FAIL") ? "FAIL" : "PASS", requestAttempts, cases,
    limits: "Pure real-module acceptance with synthetic snapshots. No database, customer, dispatch, source repair, current-provider, public or device acceptance." };
  console.log("REMINDER_CATALOGUE_WITHDRAWAL_ACCEPTANCE " + JSON.stringify(report));
  return report;
}
module.exports = { validate };
if (require.main === module) validate({ controlsOnly: process.argv.includes("--controls-only") })
  .then(report => { process.exitCode = report.status === "PASS" ? 0 : 1; })
  .catch(error => { console.error(error); process.exitCode = 1; });

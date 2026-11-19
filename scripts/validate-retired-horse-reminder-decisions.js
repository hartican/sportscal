#!/usr/bin/env node
"use strict";

// Pure acceptance only: never call choose, reconcile, send or a database RPC.
const assert = require("node:assert/strict");
const fixtures = require("../lib/reminder-fixtures");
const automatic = require("../lib/automatic-reminders");
const schedules = require("../lib/reminder-schedules");
const captured = require("./fixtures/retired-horse-publisher-input.v1.json");
const now = new Date("2026-11-07T12:00:00.000Z");
const clone = value => structuredClone(value);
const future = { status: "upcoming", scheduleStatus: "confirmed", timePrecision: "exact",
  startTimeUtc: "2026-11-07T13:00:00.000Z", sourceUrl: "https://example.test/withdrawal-control",
  sourceCheckedAt: "2026-11-07T11:00:00.000Z" };
const ordinary = [
  { ...future, id: "control:f1", key: "f1", name: "Motor race control", sourceEventIds: ["control:f1:provider"] },
  { ...future, id: "control:motogp", key: "motogp", name: "Motorcycle control" },
  { ...future, id: "control:gymnastics", key: "gymnastics", name: "Pommel horse control" },
];
const account = () => ({ preferences: { version: 24, followFirst: { notifications: { autoRemindersEnabled: false } } },
  actions: Object.fromEntries(ordinary.map(f => [f.id, { reminderChoice: "on", saved: true }])), intents: [] });
const reminder = event => ({ id: "synthetic-reminder:" + event.id, event_id: event.id, delivery_mode: "match-15",
  reminder_origin: "manual", starts_at: "2026-11-07T13:00:00.000Z", updated_at: "2026-11-07T11:00:00.000Z" });

function validate({ controlsOnly = false } = {}) {
  const cases = [];
  function check(name, run, acceptance = false) {
    if (controlsOnly && acceptance) return;
    const observed = {};
    try { run(observed); cases.push({ name, acceptance, status: "PASS", ...observed }); }
    catch (error) { cases.push({ name, acceptance, status: "FAIL", ...observed, message: error.message.split("\n")[0] }); }
  }
  const baseline = automatic.decisions(account(), fixtures.index(clone(ordinary)), now);
  check("ordinary explicit reminders retain their exact future starts", () => {
    assert.equal(baseline.length, ordinary.length);
    for (const packet of baseline) {
      assert.equal(packet.enabled, true);
      assert.equal(packet.choice, "on");
      assert.equal(packet.starts_at, future.startTimeUtc);
    }
  });
  check("ordinary provider-alias choices and explicit OFF remain effective", () => {
    const selected = account();
    delete selected.actions[ordinary[0].id];
    selected.actions["control:f1:provider"] = { reminderChoice: "on" };
    selected.actions[ordinary[1].id].reminderChoice = "off";
    const result = automatic.decisions(selected, fixtures.index(clone(ordinary)), now);
    assert.equal(result.find(p => p.fixture_id === ordinary[0].id).enabled, true);
    assert.equal(result.find(p => p.fixture_id === ordinary[1].id).enabled, false);
  });
  check("ordinary schedule safety keeps terminal, passed and unknown fixtures held", () => {
    const input = reminder(ordinary[0]);
    assert.equal(schedules.decision(input, ordinary[0], now).state, "ready");
    assert.equal(schedules.decision(input, null, now).state, "unavailable");
    for (const status of ["completed", "live", "cancelled", "withdrawn", "postponed", "suspended", "abandoned"]) {
      assert.equal(schedules.decision(input, { ...ordinary[0], status }, now).state, "inactive");
    }
    assert.equal(schedules.decision(input, { ...ordinary[0], startTimeUtc: "2026-11-07T11:00:00.000Z" }, now).state, "passed");
    assert.equal(schedules.decision(input, { ...ordinary[0], timePrecision: "unconfirmed" }, now).state, "unconfirmed");
    assert.throws(() => schedules.decision({ ...input, delivery_mode: "unreviewed" }, ordinary[0], now), /Unreviewed/);
  });
  check("ordinary synthetic choices and published fixtures stay byte-identical", () => {
    const selected = account(), rows = clone(ordinary), scheduled = reminder(rows[0]);
    const before = JSON.stringify({ selected, rows, scheduled });
    automatic.decisions(selected, fixtures.index(rows), now);
    schedules.decision(scheduled, rows[0], now);
    assert.equal(JSON.stringify({ selected, rows, scheduled }), before);
  });
  check("existing 100-fixture intent bound is unchanged", () => {
    const selected = account();
    selected.intents = Array.from({ length: 101 }, (_, i) => ({ fixtureId: "ordinary:missing:" + i, choice: "automatic", enabled: true }));
    assert.throws(() => automatic.decisions(selected, fixtures.index([]), now), /100-fixture budget/);
  });

  function noSendableIntent(name, retired, configure) {
    check(name, observed => {
      const rows = [...clone(ordinary), ...clone(retired)], selected = account();
      configure(selected);
      const before = JSON.stringify({ rows, selected });
      const result = automatic.decisions(selected, fixtures.index(rows), now);
      const ordinaryIds = new Set(ordinary.map(f => f.id));
      observed.withdrawnPackets = result.filter(p => !ordinaryIds.has(p.fixture_id));
      assert.equal(JSON.stringify({ rows, selected }), before, "Historical choices or fixture bytes changed");
      assert.deepEqual(result.filter(p => ordinaryIds.has(p.fixture_id)), baseline, "Complete ordinary reminder decisions changed");
      // Disabled tombstones may reconcile old queues; no retired packet may
      // enable a choice or supply a start that can produce a new notification.
      assert(observed.withdrawnPackets.every(p => p.enabled === false && p.starts_at === null),
        "Withdrawn saved choice reached an enabled or scheduled reminder packet");
    }, true);
  }
  const typed = { ...future, id: "withdrawn:horse", key: "horse-racing", name: "Retained meeting",
    sourceEventIds: ["withdrawn:provider"] };
  noSendableIntent("manual saved horse choice cannot become sendable", [typed], selected => {
    selected.actions[typed.id] = { reminderChoice: "on", saved: true };
  });
  noSendableIntent("legacy requested reminder cannot reintroduce retired coverage", [typed], selected => {
    selected.actions[typed.id] = { reminderRequested: true, archived: true };
  });
  noSendableIntent("saved provider alias cannot reintroduce retired coverage", [typed], selected => {
    selected.intents.push({ fixtureId: "withdrawn:provider", choice: "on", enabled: true });
  });
  noSendableIntent("stored automatic horse intent cannot acquire a new start", [typed], selected => {
    selected.intents.push({ fixtureId: typed.id, choice: "automatic", enabled: true });
  });
  noSendableIntent("captured Cup choice with a synthetic future overlay stays inert", [
    { ...clone(captured.withdrawn), ...future },
  ], selected => { selected.actions[captured.withdrawn.id] = { reminderChoice: "on" }; });
  noSendableIntent("saved absent Cup ID cannot produce an enabled fallback", [], selected => {
    selected.intents.push({ fixtureId: "event-horse-racing-melbourne-cup-2026", choice: "automatic", enabled: true });
    selected.actions["event-horse-racing-melbourne-cup-2026"] = { reminderChoice: "on" };
  });

  for (const [name, event] of [
    ["typed horse fixture", typed],
    ["opaque Cup ID", { ...future, id: "event-horse-racing-melbourne-cup-2026" }],
    ["withdrawn parent namespace", { ...future, id: "withdrawn:child", parentId: "overview:horse-racing:absent:2026" }],
  ]) {
    check("existing queued " + name + " cannot become ready", observed => {
      const input = reminder(event), before = JSON.stringify({ input, event });
      const output = schedules.decision(input, event, now);
      observed.schedule = output;
      assert.equal(JSON.stringify({ input, event }), before);
      assert.notEqual(output.state, "ready", "Withdrawn fixture was approved for notification delivery");
      assert.equal(output.new_start, null, "Withdrawn fixture received a new scheduled start");
    }, true);
  }
  const report = { schemaVersion: "retired-horse-reminder-decision-acceptance.v1", controlsOnly,
    status: cases.some(c => c.status === "FAIL") ? "FAIL" : "PASS", cases,
    limits: "Pure actual intent/schedule functions and synthetic account choices. No RPC, customer data, send, scheduler, source fix, hosted or phone acceptance." };
  console.log("REMINDER_DECISION_WITHDRAWAL_ACCEPTANCE " + JSON.stringify(report));
  return report;
}
module.exports = { validate };
if (require.main === module) process.exitCode = validate({ controlsOnly: process.argv.includes("--controls-only") }).status === "PASS" ? 0 : 1;

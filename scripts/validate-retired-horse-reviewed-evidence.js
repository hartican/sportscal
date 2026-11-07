#!/usr/bin/env node
"use strict";

// Test-only handoff for the existing UPDATE/SCORES writer owners. The normal
// command remains RED until their actual admission boundary is repaired.
const assert = require("node:assert/strict");
const { isDeepStrictEqual } = require("node:util");
const { applyFixtureAndResultEvidence } = require("./apply-current-card-evidence");
const captured = require("./fixtures/retired-horse-publisher-input.v1.json");
const checkedAt = "2026-11-06T01:00:00.000Z";
const clone = value => structuredClone(value);
const evidence = (fixtureOverrides = [], resultOverrides = []) => ({ checkedAt, fixtureOverrides, resultOverrides });
// Marker values below are explicitly synthetic; they are never source facts.
const fixtureOverride = event => ({ id: event.id, key: event.key, name: event.name,
  sourceUrl: "https://example.test/withdrawal-fixture", sourceCheckedAt: checkedAt,
  venue: "SYNTHETIC_WITHDRAWAL_TEST_VENUE" });
const resultOverride = event => ({ id: event.id, status: "completed", score: "WITHDRAWAL_TEST_RESULT",
  outcomeText: "Synthetic withdrawal test outcome", recapText: "Synthetic withdrawal test recap",
  sourceUrl: "https://example.test/withdrawal-result", sourceCheckedAt: checkedAt });

function validate({ controlsOnly = false } = {}) {
  const cases = [];
  function check(name, run, { acceptance = false } = {}) {
    if (controlsOnly && acceptance) return;
    const observed = {};
    try { run(observed); cases.push({ name, status: "PASS", acceptance, ...observed }); }
    catch (error) { cases.push({ name, status: "FAIL", acceptance, ...observed, message: error.message.split("\n")[0] }); }
  }
  const ordinary = [
    { id: "control:f1", key: "f1", name: "F1 test", status: "scheduled", sourceCheckedAt: "2026-11-01T00:00:00Z" },
    { id: "control:motogp", key: "motogp", name: "Motorcycle test", status: "scheduled" },
    { id: "control:gymnastics", key: "gymnastics", name: "Pommel horse test", status: "scheduled" },
  ];
  const ordinaryEvidence = evidence(ordinary.map(fixtureOverride), ordinary.map(resultOverride));
  const ordinaryOutput = applyFixtureAndResultEvidence(clone(ordinary), clone(ordinaryEvidence));
  check("ordinary fixture/result passes apply genuine sporting work without changing IDs", () => {
    assert.deepEqual(ordinaryOutput.map(event => event.id), ordinary.map(event => event.id));
    for (const event of ordinaryOutput) {
      assert.equal(event.status, "completed");
      assert.equal(event.score, "WITHDRAWAL_TEST_RESULT");
      assert.equal(event.sourceCheckedAt, checkedAt);
    }
    assert(!isDeepStrictEqual(ordinaryOutput, ordinary));
  });
  check("ordinary fixture upsert remains available", () => {
    const added = { id: "control:new", key: "motogp", name: "New motorcycle test", sourceCheckedAt: checkedAt };
    const output = applyFixtureAndResultEvidence([], evidence([added]), { upsert: true });
    assert.equal(output.length, 1); assert.equal(output[0].id, added.id);
    assert.equal(output[0].status, "scheduled");
  });
  check("empty evidence preserves the complete ordinary scheduled input", () => {
    assert.deepEqual(applyFixtureAndResultEvidence(clone(ordinary), evidence()), ordinary);
  });
  check("reviewed evidence and retained fixture inputs remain immutable", () => {
    const input = clone(ordinary), saved = clone(ordinaryEvidence), before = JSON.stringify({ input, saved });
    applyFixtureAndResultEvidence(input, saved);
    assert.equal(JSON.stringify({ input, saved }), before);
  });

  function remainsInert(name, retired, extra, options = {}) {
    check(name, observed => {
      const input = [...clone(ordinary), ...clone(retired)];
      const saved = evidence([...clone(ordinaryEvidence.fixtureOverrides), ...clone(extra.fixtureOverrides)],
        [...clone(ordinaryEvidence.resultOverrides), ...clone(extra.resultOverrides)]);
      const before = JSON.stringify({ input, saved });
      const output = applyFixtureAndResultEvidence(input, saved, options);
      observed.changedWithdrawnIds = retired.filter((event, index) => !isDeepStrictEqual(event, output[ordinary.length + index])).map(event => event.id);
      observed.appendedIds = output.slice(input.length).map(event => event.id);
      assert.equal(JSON.stringify({ input, saved }), before, "Source fixture/evidence history was mutated");
      assert.deepEqual(output.slice(0, ordinary.length), ordinaryOutput, "Complete ordinary fixture/result output differs");
      let prior = -1;
      for (const event of output.slice(ordinary.length)) {
        const index = retired.findIndex(record => record.id === event.id);
        assert(index > prior && isDeepStrictEqual(event, retired[index]), "Withdrawn evidence appended or enriched retired fixture history");
        prior = index;
      }
    }, { acceptance: true });
  }
  const horse = clone(captured.withdrawn);
  remainsInert("captured stale Cup evidence cannot upsert a missing withdrawn fixture", [], evidence([horse]), { upsert: true });
  remainsInert("existing captured horse history remains inert under reviewed result replay", [horse], evidence([], [resultOverride(horse)]));
  for (const reverse of [false, true]) {
    const typed = { id: "withdrawn:seed", key: "horse-racing", sourceEventIds: ["withdrawn:provider"] };
    const retired = [typed, { id: "withdrawn:alias", canonicalEventId: typed.id }, { id: "withdrawn:child", tournamentId: "withdrawn:alias" }];
    remainsInert("retained graph rejects fixture/result enrichment in " + (reverse ? "reverse" : "source") + " order",
      reverse ? [...retired].reverse() : retired, evidence(retired.map(fixtureOverride), retired.map(resultOverride)));
  }
  const opaque = { id: "withdrawn:opaque", status: "scheduled" };
  remainsInert("typed fixture evidence cannot reactivate an opaque retained fixture", [opaque], evidence([{ ...fixtureOverride(opaque), key: "horse-racing" }]));
  remainsInert("typed result evidence cannot reactivate an opaque retained fixture", [opaque], evidence([], [{ ...resultOverride(opaque), key: "horse-racing" }]));
  const leaf = { id: "withdrawn:leaf", parentId: "overview:horse-racing:absent:2026" };
  remainsInert("missing withdrawn parent namespace keeps reviewed child history inert", [leaf], evidence([], [resultOverride(leaf)]));

  const report = { schemaVersion: "retired-horse-reviewed-evidence-acceptance.v1", controlsOnly,
    status: cases.some(test => test.status === "FAIL") ? "FAIL" : "PASS", cases,
    limits: "Pure offline acceptance. Synthetic values are test inputs only; current writer source is unchanged. No provider facts, integration, full refresh or release proof." };
  console.log("REVIEWED_EVIDENCE_WITHDRAWAL_ACCEPTANCE " + JSON.stringify(report));
  return report;
}

module.exports = { validate };
if (require.main === module) process.exitCode = validate({ controlsOnly: process.argv.includes("--controls-only") }).status === "PASS" ? 0 : 1;

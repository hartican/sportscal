#!/usr/bin/env node
"use strict";

// Acceptance only: UPDATE/SCORES retain the actual result writer. A withdrawal
// failure must remain a failure until that owner supplies the source repair.
const assert = require("node:assert/strict");
const { isDeepStrictEqual } = require("node:util");
const { applyOfficialResults } = require("./sync-official-card-results");
const captured = require("./fixtures/retired-horse-publisher-input.v1.json");

const checkedAt = "2026-11-06T01:00:00.000Z";
const clone = value => structuredClone(value);
// These are deliberately synthetic test results, never sporting evidence.
const resultFor = event => ({
  id: event.id, status: "completed", score: "WITHDRAWAL_TEST_RESULT",
  outcomeText: "Synthetic withdrawal test outcome", recapText: "Synthetic withdrawal test recap",
  sourceUrl: "https://example.test/withdrawal-result", sourceCheckedAt: checkedAt,
});
const snapshot = results => ({ checkedAt, feedVersion: "withdrawal-test-only", results });

function validate({ controlsOnly = false } = {}) {
  const cases = [];
  function check(name, run, { acceptance = false } = {}) {
    if (controlsOnly && acceptance) return;
    const observed = {};
    try { run(observed); cases.push({ name, status: "PASS", acceptance, ...observed }); }
    catch (error) { cases.push({ name, status: "FAIL", acceptance, ...observed, message: error.message.split("\n")[0] }); }
  }
  const ordinary = [
    { ...clone(captured.ordinary), id: "control:f1", eventId: "control:f1", canonicalEventId: "control:f1", sourceEventIds: [] },
    { id: "control:motogp", key: "motogp", name: "Motorcycle test", status: "scheduled", sourceCheckedAt: "2026-11-01T00:00:00Z" },
    { id: "control:gymnastics", key: "gymnastics", name: "Pommel horse test", status: "scheduled" },
  ];
  const ordinaryResults = ordinary.map(resultFor);
  const ordinaryOutput = applyOfficialResults(clone(ordinary), snapshot(ordinaryResults));
  check("ordinary motorsport and gymnastics still perform genuine result work", () => {
    assert.equal(ordinaryOutput.count, ordinary.length);
    for (const event of ordinaryOutput.events) {
      assert.equal(event.status, "completed");
      assert.equal(event.score, "WITHDRAWAL_TEST_RESULT");
      assert.equal(event.sourceCheckedAt, checkedAt);
      assert(event.storyline.hookSpoilerOff);
    }
    assert(!isDeepStrictEqual(ordinaryOutput.events, ordinary));
  });
  check("empty result input preserves fixture references and all fields", () => {
    const input = clone(ordinary), actual = applyOfficialResults(input, snapshot([]));
    assert.equal(actual.count, 0);
    input.forEach((event, index) => assert.strictEqual(actual.events[index], event));
    assert.deepEqual(actual.events, ordinary);
  });
  check("result matching still uses identity rather than equal fixture names", () => {
    const input = [{ id: "unrelated", name: ordinary[0].name, status: "scheduled" }];
    assert.deepEqual(applyOfficialResults(input, snapshot(ordinaryResults)), { events: input, count: 0 });
  });
  check("both input documents and all retained result observations stay immutable", () => {
    const input = clone(ordinary), saved = snapshot(clone(ordinaryResults));
    const before = JSON.stringify({ input, saved });
    applyOfficialResults(input, saved);
    assert.equal(JSON.stringify({ input, saved }), before);
  });

  function remainsInert(name, retired, results) {
    check(name, observed => {
      const input = [...clone(ordinary), ...clone(retired)], saved = snapshot([...clone(ordinaryResults), ...clone(results)]);
      const before = JSON.stringify({ input, saved });
      const output = applyOfficialResults(input, saved);
      observed.changedWithdrawnIds = retired.filter((event, index) => !isDeepStrictEqual(event, output.events[ordinary.length + index])).map(event => event.id);
      observed.reportedUpdateCount = output.count;
      observed.ordinaryUpdateCount = ordinaryOutput.count;
      assert.equal(JSON.stringify({ input, saved }), before, "Source fixture/result history was mutated");
      assert.deepEqual(output.events.slice(0, ordinary.length), ordinaryOutput.events, "Complete ordinary result output differs");
      // Source admission may omit retired records or carry them unchanged until
      // final publication strips them. Neither path may enrich retained history.
      let prior = -1;
      for (const event of output.events.slice(ordinary.length)) {
        const index = retired.findIndex(record => record.id === event.id);
        assert(index > prior && isDeepStrictEqual(event, retired[index]), "Withdrawn fixture history was enriched with result/copy/clock changes");
        prior = index;
      }
    }, { acceptance: true });
  }
  const savedHorse = clone(captured.withdrawn);
  remainsInert("captured retired Cup fixture remains inert on a matching synthetic result", [savedHorse], [resultFor(savedHorse)]);
  for (const reverse of [false, true]) {
    const typed = { id: "withdrawn:seed", key: "horse-racing", sourceEventIds: ["withdrawn:provider"], parentEventId: "control:parent" };
    const retired = [typed, { id: "withdrawn:alias", canonicalEventId: typed.id }, { id: "withdrawn:child", parentId: "withdrawn:alias" }];
    remainsInert("retained aliases and descendants stay inert in " + (reverse ? "reverse" : "source") + " order",
      reverse ? [...retired].reverse() : retired, retired.map(resultFor));
  }
  const opaque = { id: "withdrawn:opaque", name: "Retained opaque fixture", status: "scheduled" };
  remainsInert("typed result evidence cannot reactivate an otherwise opaque retained fixture", [opaque], [{ ...resultFor(opaque), key: "horse-racing" }]);
  const provider = { id: "withdrawn:provider", status: "scheduled" };
  remainsInert("retired seed in the result snapshot identifies its untyped provider alias", [provider], [
    { id: "withdrawn:seed", key: "horse-racing", sourceEventIds: [provider.id] }, resultFor(provider),
  ]);
  remainsInert("missing retired parent namespace keeps a flat retained child inert",
    [{ id: "withdrawn:orphan", parentEventId: "overview:horse-racing:absent:2026" }], [resultFor({ id: "withdrawn:orphan" })]);

  const report = { schemaVersion: "retired-horse-official-result-acceptance.v1", controlsOnly,
    status: cases.some(test => test.status === "FAIL") ? "FAIL" : "PASS", cases,
    limits: "Pure offline acceptance. Synthetic result values are test inputs only; no source fix, current-provider validation, full refresh, integration or release proof." };
  console.log("OFFICIAL_RESULT_WITHDRAWAL_ACCEPTANCE " + JSON.stringify(report));
  return report;
}

module.exports = { validate };
if (require.main === module) process.exitCode = validate({ controlsOnly: process.argv.includes("--controls-only") }).status === "PASS" ? 0 : 1;

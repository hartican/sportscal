#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const optimistic = require("../config/optimistic-mutation");

function deferred(){
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function run(){
  const delayed = deferred();
  const delayedState = { value:"before", stage:"idle" };
  const delayedRun = optimistic.run({
    capture:() => ({ ...delayedState }),
    apply:() => { delayedState.value = "after"; delayedState.stage = "saving"; },
    request:() => delayed.promise,
    commit:result => { delayedState.stage = result.stage; },
    rollback:prior => Object.assign(delayedState, prior),
  });
  assert.deepEqual(delayedState, { value:"after", stage:"saving" }, "delayed requests must paint the requested state immediately");
  delayed.resolve({ stage:"saved" });
  assert.equal((await delayedRun).ok, true);
  assert.deepEqual(delayedState, { value:"after", stage:"saved" });

  for (const error of [
    Object.assign(new Error("server rejected"), { status:500, code:"server_error" }),
    Object.assign(new Error("timed out"), { name:"AbortError" }),
  ]){
    const state = { selected:false, tags:["draft"], stage:"idle" };
    const outcome = await optimistic.run({
      capture:() => structuredClone(state),
      apply:() => { state.selected = true; state.tags.push("optimistic"); state.stage = "saving"; },
      request:async () => { throw error; },
      rollback:prior => Object.assign(state, prior),
    });
    assert.equal(outcome.ok, false);
    assert.deepEqual(state, { selected:false, tags:["draft"], stage:"idle" }, "server errors and timeouts must restore the exact prior draft");
  }

  const reconciledState = { enabled:false, stage:"idle" };
  let rollbackCalled = false;
  const reconciled = await optimistic.run({
    capture:() => ({ ...reconciledState }),
    apply:() => { reconciledState.enabled = true; reconciledState.stage = "saving"; },
    request:async () => { throw Object.assign(new Error("Load failed"), { code:"network_error" }); },
    reconcile:async () => ({ confirmed:true, result:{ enabled:true } }),
    commit:result => { reconciledState.enabled = result.enabled; reconciledState.stage = "saved"; },
    rollback:() => { rollbackCalled = true; },
  });
  assert.equal(reconciled.ok, true, "a confirmed lost response must reconcile as success");
  assert.equal(reconciled.reconciled, true);
  assert.equal(rollbackCalled, false);
  assert.deepEqual(reconciledState, { enabled:true, stage:"saved" });

  const unresolvedState = { count:2 };
  const unresolved = await optimistic.run({
    capture:() => ({ ...unresolvedState }),
    apply:() => { unresolvedState.count = 3; },
    request:async () => { throw new TypeError("Failed to fetch"); },
    reconcile:async () => ({ confirmed:false }),
    rollback:prior => Object.assign(unresolvedState, prior),
  });
  assert.equal(unresolved.ok, false);
  assert.deepEqual(unresolvedState, { count:2 }, "an unconfirmed lost response must roll back exactly and remain retryable");

  console.log("Optimistic action validation passed: immediate paint, delayed confirmation, server error, timeout, lost-response reconciliation and exact rollback.");
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});

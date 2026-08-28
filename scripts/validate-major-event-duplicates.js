#!/usr/bin/env node

"use strict";

const assert = require("node:assert/strict");
const catalogue = require("../data/major-events.v1.json");
const { fixtureIdentityKey } = require("./lib/major-event-fixture-identity.js");

let fixtureCount = 0;
for (const event of catalogue.events || []){
  const fixtureByIdentity = new Map();
  for (const fixture of event.subEvents || []){
    const identity = fixtureIdentityKey(fixture);
    if (!identity) continue;
    fixtureCount += 1;
    const previous = fixtureByIdentity.get(identity);
    assert.equal(
      previous,
      undefined,
      `${event.id} contains duplicate fixtures ${previous} and ${fixture.id}`
    );
    fixtureByIdentity.set(identity, fixture.id);
  }
}

console.log(`Major-event duplicate audit passed: ${fixtureCount} identifiable fixtures are unique.`);

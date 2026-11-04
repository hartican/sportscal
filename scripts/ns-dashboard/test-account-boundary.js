"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const { harness, token, OTHER } = require('./hosted-test-fixture');
test('valid old owner cookie alone cannot authorize a remount after NS logout', async () => {
  const h = harness();
  const res = await h.run('overview', { headers: { authorization: '' } });
  assert.equal(res.statusCode, 401);
  assert.equal(h.calls.length, 0);
});
test('current other NS bearer cannot use the still-valid owner cookie', async () => {
  const h = harness();
  const res = await h.run('overview', { headers: { authorization: 'Bearer ' + token({ sub: OTHER }) } });
  assert.equal(res.statusCode, 401);
  assert.equal(h.calls.length, 0);
});

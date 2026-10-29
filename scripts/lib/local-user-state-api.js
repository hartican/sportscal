'use strict';
// Execute the real API handler and normalizers; replace only auth/database I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const store = require('../../lib/supabase-server');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

module.exports = function localUserStateApi(owner) {
  let row = null, race = null;
  const calls = [];
  const metrics={stateLoads:0,recoveryRpcs:0,rowWrites:0};
  const writeTime = () => new Date(Math.max(Date.now(), Date.parse(row?.updated_at || '') + 1 || 0));
  const dependencies = { ...store,
    authenticatedUser: async () => ({ id: owner, email: 'disposable@example.invalid' }),
    loadUserState: async id => { assert.equal(id, owner); metrics.stateLoads++; return clone(row); },
    supabaseServiceRequest: async url => {
      assert.equal(url, '/rest/v1/rpc/nothingsports_active_preference_reset'); metrics.recoveryRpcs++; return [];
    },
    supabaseRequest: async (url, options) => {
      assert(url.startsWith('/rest/v1/' + store.USER_STATE_TABLE));
      if (race) { const change = race; race = null; change(); }
      if (options.method === 'PATCH') {
        assert(url.includes('user_id=eq.' + owner));
        const timestamp = new URL(url, 'http://local.test').searchParams.get('updated_at');
        if (timestamp !== 'eq.' + row?.updated_at) return [];
      } else { assert.equal(options.method, 'POST'); if (row) return []; }
      metrics.rowWrites++; row = clone(options.body); return [clone(row)];
    },
  };
  const file = path.resolve(__dirname, '../../api/user-state.js');
  const localRequire = createRequire(file), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, Buffer, Date, URL, console,
    require: name => name === '../lib/supabase-server' ? dependencies : localRequire(name) }, { filename: file });
  return {
    seed(state) { row = store.normalizeUserState(state, owner, writeTime()); },
    state() { return clone(store.userStateFromRow(row)); },
    mutate(change) { const state = store.userStateFromRow(row); change(state); row = store.normalizeUserState(state, owner, writeTime()); },
    raceOnce(change) { race = change; },
    calls,
    metrics,
    async handle(request) {
      const result = { status: 200, body: null }, headers = {};
      await module.exports(request, { setHeader(name, value) { headers[name] = value; }, status(status) { result.status = status; return this; }, json(body) { result.body = clone(body); } });
      calls.push({ method: request.method, status: result.status, code: result.body?.code,
        patchBaseUpdatedAt: request.body?.patch?.baseUpdatedAt,
        changedPaths: request.body?.patch?.changes?.map(change => change.path.join('.')),
        responseUpdatedAt: result.body?.state?.updated_at });
      return result;
    },
  };
};

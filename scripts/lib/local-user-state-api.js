'use strict';
// Execute the real API handler and normalizers; replace only auth/database I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const store = require('../../lib/supabase-server');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

module.exports = function localUserStateApi(owner, { traceRequests = false } = {}) {
  let row = null, race = null;
  const calls = [];
  const metrics={stateLoads:0,recoveryRpcs:0,rowWrites:0};
  const requestContext=new AsyncLocalStorage(),traceEvents=[];
  let requestSequence=0,eventSequence=0,traceBytes=0,traceDropped=0,tracePhase='setup';
  const traceStarted=Date.now();
  function safeRequest(url,method){
    const parsed=new URL(url||'/api/user-state','http://fixture.local');
    const mode=parsed.search==='?recovery-snapshot=v1'?'snapshot-v1':parsed.search?'other-query':'normal';
    return {url:parsed.pathname+(mode==='snapshot-v1'?'?recovery-snapshot=v1':parsed.search?'?<redacted-other-query>':''),method,mode};
  }
  function emit(type,fields={},context=requestContext.getStore()){
    if(!traceRequests)return;
    const event={sequence:++eventSequence,atMs:Date.now()-traceStarted,type,phase:tracePhase,
      ...(context?{requestId:context.id,requestPhase:context.phase,...context.request}:{}),...fields};
    const size=Buffer.byteLength(JSON.stringify(event),'utf8');
    if(traceEvents.length>=128||traceBytes+size>122880){traceDropped=Math.min(1000000,traceDropped+1);return;}
    traceEvents.push(event);traceBytes+=size;
  }
  const trace={
    phase(label){tracePhase=label;emit('phase',{},null);},
    mark(label,fields){tracePhase=label;emit('phase',fields,null);},
    browser(fields){emit('browser-initiator',fields,null);},
    snapshot(){return {format:'user-state-request-attribution.v1',complete:traceDropped===0,overflow:traceDropped>0,dropped:traceDropped,
      limits:{events:128,eventBytes:122880,packetBytes:131072},events:traceEvents.slice(),eventBytes:traceBytes};},
  };

  const writeTime = () => new Date(Math.max(Date.now(), Date.parse(row?.updated_at || '') + 1 || 0));
  const dependencies = { ...store,
    authenticatedUser: async () => ({ id: owner, email: 'disposable@example.invalid' }),
    loadUserState: async id => { emit('load-start',{subjectMatchesOwner:id===owner});assert.equal(id, owner); metrics.stateLoads++;const value=clone(row);emit('load-end',{found:Boolean(value)});return value; },
    supabaseServiceRequest: async url => {
      emit('rpc-start',{rpc:'active-preference-reset'});assert.equal(url, '/rest/v1/rpc/nothingsports_active_preference_reset'); metrics.recoveryRpcs++;emit('rpc-end',{rpc:'active-preference-reset'});return [];
    },
    supabaseRequest: async (url, options) => {
      emit('write-start',{storageMethod:options.method});assert(url.startsWith('/rest/v1/' + store.USER_STATE_TABLE));
      if (race) { const change = race; race = null; change(); }
      if (options.method === 'PATCH') {
        assert(url.includes('user_id=eq.' + owner));
        const timestamp = new URL(url, 'http://local.test').searchParams.get('updated_at');
        if (timestamp !== 'eq.' + row?.updated_at){emit('write-end',{outcome:'cas-miss'});return [];}
      } else { assert.equal(options.method, 'POST');if (row){emit('write-end',{outcome:'insert-conflict'});return [];} }
      metrics.rowWrites++; row = clone(options.body);emit('write-end',{outcome:'written'});return [clone(row)];
    },
  };
  const file = path.resolve(__dirname, '../../api/user-state.js');
  const localRequire = createRequire(file), module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports, Buffer, Date, URL, console,
    require: name => name === '../lib/supabase-server' ? dependencies : localRequire(name) }, { filename: file });
  async function execute(request){
    emit('request-start');
    try{
      const result = { status: 200, body: null }, headers = {};
      await module.exports(request, { setHeader(name, value) { headers[name] = value; }, status(status) { result.status = status; return this; }, json(body) { result.body = clone(body); } });
      calls.push({ method: request.method, status: result.status, code: result.body?.code,
        patchBaseUpdatedAt: request.body?.patch?.baseUpdatedAt,
        changedPaths: request.body?.patch?.changes?.map(change => change.path.join('.')),
        responseUpdatedAt: result.body?.state?.updated_at });
      emit('request-result',{status:result.status,callIndex:calls.length-1});return result;
    }catch(error){emit('request-error',{errorCode:typeof error?.code==='string'&&/^[a-z0-9_]{1,64}$/.test(error.code)?error.code:'other'});throw error;}
    finally{emit('request-end');}
  }
  return {
    seed(state) { row = store.normalizeUserState(state, owner, writeTime()); },
    state() { return clone(store.userStateFromRow(row)); },
    mutate(change) { const state = store.userStateFromRow(row); change(state); row = store.normalizeUserState(state, owner, writeTime()); },
    raceOnce(change) { race = change; },
    calls,
    metrics,
    trace,
    handle(request){
      if(!traceRequests)return execute(request);
      const context={id:'request-'+(++requestSequence),phase:tracePhase,request:safeRequest(request.url,request.method)};
      return requestContext.run(context,()=>execute(request));
    },
  };
};

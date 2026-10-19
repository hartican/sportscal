'use strict';
const assert=require('node:assert/strict');
const {createMatchCentreHandler}=require('../lib/match-centre-handler');
const capture=require('./fixtures/cricket-score-address-20261020.json');
const identity=require('../config/fixture-identity');
const response=()=>({setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
async function run(){
 const before=JSON.stringify(capture),official=capture.rows.find(r=>r.source_id==='cricket-ca-current').fixture;
 for(const requested of [[capture.canonicalId],['evt_88'],[capture.providerId],[capture.canonicalId,capture.providerId]]){
  const calls=[];let snapshots=0;
  const handler=createMatchCentreHandler({enabled:()=>true,clock:()=>Date.parse(capture.clock),published:()=>[capture.published],snapshotRead:async()=>{snapshots++;throw Error('Selected scores must not load a global snapshot');},request:async(path,options)=>{
   calls.push({path,ids:options.body.p_fixture_ids,timeoutMs:options.timeoutMs});
   // Exercise the actual observed identity-key filter rather than return an
   // unconditionally successful official row regardless of requested IDs.
   return capture.rows.filter(row=>row.identity_keys.some(id=>options.body.p_fixture_ids.includes(id))).map(({fixture,checked_at})=>({fixture,checked_at}));
  }});
  const res=response();await handler({url:'/api/match-centre?ids='+encodeURIComponent(requested.join(',')),method:'GET'},res);
  assert.equal(res.code,200);assert.equal(res.body.fixtures.length,1);
  const fixture=res.body.fixtures[0];assert.equal(fixture.status,'stumps');assert.equal(fixture.score.innings[0].runs,97,'The ordinary canonical lookup retrieves the separately keyed official score');assert.equal(fixture.score.innings[0].wickets,5);assert.equal(fixture.score.innings[0].overs,'43.0');
  assert.equal(fixture.score.innings[0].participantId,'team:cricket:south-africa');
  assert.equal(fixture.id,requested.length===1&&requested[0]===capture.providerId?capture.providerId:capture.canonicalId,'Existing canonical and direct-provider response identities remain unchanged');
  assert.equal(fixture.scoreCheckedAt,official.scoreCheckedAt);assert.equal(fixture.statusCheckedAt,official.statusCheckedAt);assert.equal(fixture.statusFactObservedAt,official.statusFactObservedAt);assert.equal(fixture.stale,false);
  assert.equal(calls.length,1,'The same compact RPC owns this lookup, with no additional request');assert.equal(calls[0].timeoutMs,3000);assert(calls[0].ids.includes(capture.providerId));assert.equal(snapshots,0);
 }
 for(const id of ['fixture:cricket:CA:39990','fixture:cricket:unknown','constructor','toString','__proto__']){
  let ids;const handler=createMatchCentreHandler({enabled:()=>true,published:()=>[capture.published],request:async(_path,options)=>{ids=options.body.p_fixture_ids;return [];}});const res=response();await handler({url:'/api/match-centre?ids='+id},res);assert.deepEqual(ids,[id],'Other Tests and unknown requests are not widened');assert.deepEqual(res.body.fixtures,[]);
 }
 assert.equal(identity.canonicalFixtureId(capture.providerId),capture.providerId,'A sporting score address is not a private contribution identity cutover');
 assert.equal(identity.canonicalFixtureId(capture.canonicalId),capture.canonicalId);assert(!identity.fixtureAliases(capture.canonicalId).includes(capture.providerId),'Global action/chat/rating aliases are unchanged');
 const nsc=require('../lib/nothingscore-server');assert.equal(nsc.canonicalEventId(capture.providerId),capture.providerId);assert.equal(nsc.canonicalEventId(capture.canonicalId),capture.canonicalId);
 assert.equal(JSON.stringify(capture),before,'Lookup and projection preserve captured sporting facts and clocks');
 console.log('Second Test score address: canonical/legacy/direct/paired reads, actual stored-key filtering, unchanged clocks/private IDs, one bounded RPC and no global snapshot passed.');
}
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports=run;

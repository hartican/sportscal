#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {discover}=require('../lib/autonomous-discovery');
const {discoveryJobs}=require('../lib/discovery-sources');
const {overlaySnapshots}=require('../lib/live-fixtures');
const fixture={id:'fixture:test:final',name:'Test Final',key:'football',date:'2026-09-15'};
async function main(){
 let calls=0;
 const fetchImpl=async()=>{calls++;throw new Error('Unexpected network call');};
 assert.deepEqual(discoveryJobs({environment:{OPENAI_API_KEY:'test-only'},fetchImpl}),[]);
 assert.deepEqual(discoveryJobs({environment:{DISCOVERY_CONSENSUS_ENABLED:'true'}}).map(job=>job.id),['discovery-ai-consensus']);
 await assert.rejects(discover({mode:'athletes',fetchImpl}),error=>error.code==='discovery_mode_removed');
 await assert.rejects(discover({mode:'consensus',fixtures:[fixture],environment:{OPENAI_API_KEY:'test-only'},fetchImpl}),error=>error.code==='consensus_disabled');
 const environment={DISCOVERY_CONSENSUS_ENABLED:'true',OPENAI_API_KEY:'test-only'};
 const empty=await discover({mode:'consensus',fixtures:[],environment,fetchImpl});
 assert.equal(empty.coverage.searchedFixtures,0);assert.equal(calls,0);
 const responseFetch=async(input,options)=>{
  calls++;
  const body=JSON.parse(options.body);
  assert.equal(body.store,false);assert(body.max_tool_calls<=4);
  assert(!('participations' in body.text.format.schema.properties));
  assert(!('athletes' in JSON.parse(body.input)));
  return {ok:true,json:async()=>({status:'completed',output:[{type:'web_search_call',action:{sources:[]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({consensus:[]})}]}]})};
 };
 const previous=[{id:fixture.id,enrichmentOnly:true,consensusTags:[{label:'Final',checkedAt:'2026-09-14'}]}];
 const result=await discover({mode:'consensus',fixtures:[fixture],previous,environment,fetchImpl:responseFetch});
 assert.equal(calls,1);assert.equal(result[0].consensusTags[0].label,'Final');assert.equal(result.coverage.status,'checked');
 await assert.rejects(discover({mode:'consensus',fixtures:[fixture],environment,fetchImpl:async()=>({ok:false,status:403,json:async()=>({error:{type:'customer_verification_required'}})})}),error=>error.code==='ai_billing_required');
 const retained=overlaySnapshots([fixture],[{source_id:'discovery-ai-athletes',fixtures:[{...fixture,name:'Obsolete athlete discovery'}]}]);
 assert.equal(retained[0].name,fixture.name);
 console.log('Optional consensus: no default calls, removed athlete mode, bounded opt-in search, retained tags and retired snapshots passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

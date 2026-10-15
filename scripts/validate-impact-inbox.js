'use strict';
const assert=require('node:assert/strict'),serverPath=require.resolve('../lib/supabase-server'),server=require(serverPath),impactPath=require.resolve('../lib/impact-feedback'),impact=require(impactPath);
const fixture=require('../data/follow-schedule/tennis.json').fixtures.find(e=>e.id.endsWith('184950')),user={id:'11111111-1111-4111-8111-111111111111'};
let calls=[],state={userId:user.id,preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'follow'}]}},actions:{},updatedAt:new Date().toISOString()};
require.cache[serverPath].exports={...server,authenticatedUser:async token=>{if(!token)throw new server.SupabaseRequestError('Sign in',{status:401});return user;},supabaseServiceRequest:async(path,options)=>{calls.push({path,options});return {account:state,items:[{id:'request',kind:'impact_request',eventId:fixture.id,phase:'impact',detail:fixture.name}]};}};
require.cache[impactPath].exports={...impact,loadFixtures:async ids=>{assert.deepEqual(ids,[fixture.id]);return [fixture];}};
delete require.cache[require.resolve('../lib/inbox-api')];const handler=require('../lib/inbox-api');
async function run(url='/api/inbox?impact=1',token='token'){
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(payload){this.payload=payload;return this;}};await handler({method:'GET',url,headers:{authorization:token?'Bearer '+token:''}},res);return res;
}
(async()=>{
 assert.equal((await run('/api/inbox?impact=1','')).code,401);for(const tail of ['impact=2','impact=1&digestDay=2026-99-99','impact=1&eventId=bad%20id'])assert.equal((await run('/api/inbox?'+tail)).code,400);
 const result=await run('/api/inbox?impact=1&digestDay=2026-10-16&target_user=attacker');assert.equal(result.code,200);assert.equal(result.headers['Cache-Control'],'private, no-store');assert.equal(result.payload.items.length,1);assert.equal(calls.at(-1).options.body.target_user,user.id);assert.equal(calls.at(-1).options.body.target_day,'2026-10-16');assert(!JSON.stringify(result.payload).includes(user.id),'Private account snapshot never reaches the browser response');
 state={...state,actions:{[fixture.id]:{dismissed:true,canonicalEventId:fixture.id}}};assert.equal((await run()).payload.items.length,0,'On-demand opening rechecks current dismissal without waiting for a dispatcher tick');
 state={...state,actions:{},preferences:{version:27,preferenceGraph:{entityFollows:[{participantId:fixture.participantIds[0],followLevel:'unfollow'}]}}};assert.equal((await run()).payload.items.length,0,'On-demand opening rechecks current Feed follows');
 assert(calls.every(c=>c.options.method==='POST'&&c.path.endsWith('nothingsports_impact_page')),'Opening is read-only through the private service RPC, without reconciliation or customer writes');
 console.log('Impact inbox: registered ownership, malformed input, digest binding, private DTO, current Feed/dismissal and no writes passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{require.cache[serverPath].exports=server;require.cache[impactPath].exports=impact;});

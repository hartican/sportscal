'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
async function validatePublicFixtureReads(){
  const server=require('../../lib/supabase-server'),modulePath=require.resolve('../../api/participation');
  const original={request:server.supabaseServiceRequest,read:fs.readFileSync,module:require.cache[modulePath],secret:process.env.PARTICIPATION_SECRET};
  const sourcePath=path.resolve(__dirname,'../../data/marquee-candidates.v1.json');
  const seed=JSON.parse(original.read(sourcePath,'utf8')).candidates.find(c=>c.readyForExport&&c.participation.enabled);
  const now=Date.now(),make=(id,enabled=true)=>{
    const c=structuredClone(seed);c.eventId=id;c.campaignId='campaign-'+id;c.readyForExport=true;
    c.timing.startTimeUtc=new Date(now-3600000).toISOString();c.timing.endTimeUtc=new Date(now+3600000).toISOString();
    c.participation.enabled=enabled;c.participation.ratingWindow={opensAt:new Date(now-60000).toISOString(),closesAt:new Date(now+86400000).toISOString()};
    c.drafts.email.subject='PRIVATE-EMAIL-DRAFT';c.drafts.instagram.caption='PRIVATE-SOCIAL-DRAFT';c.material.rating={editorialValue:5,privateHeat:'PRIVATE-HEAT'};
    return c;
  };
  const expired=make('expired'),disabled=make('time-tbc',false),first=make('first'),second=make('second'),unready=make('unready'),cancelled=make('cancelled');
  expired.timing.endTimeUtc=new Date(now-1000).toISOString();disabled.timing.startTimeUtc=null;disabled.timing.endTimeUtc=null;unready.readyForExport=false;
  const source={candidates:[expired,disabled,first,second,unready,cancelled]},records=new Map(),calls=[];
  const stored=new Map([[disabled.campaignId,{candidate:disabled,state:'draft'}],[cancelled.campaignId,{candidate:cancelled,state:'cancelled'}]]);
  const capture=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=JSON.parse(JSON.stringify(b));return this;}});
  const headers={host:'nothingsport.vercel.app','x-forwarded-proto':'https',origin:'https://nothingsport.vercel.app'};
  try{
    fs.readFileSync=function(file,...args){return path.resolve(String(file))===sourcePath?JSON.stringify(source):original.read.call(this,file,...args);};
    server.supabaseServiceRequest=async(url,options={})=>{
      calls.push({url,method:options.method||'GET',body:options.body});const u=new URL(url,'https://isolated.invalid');
      if(u.pathname==='/rest/v1/nothingsports_marquee_campaigns'){
        const id=u.searchParams.get('campaign_id')?.slice(3);
        if(u.searchParams.get('select')==='candidate,state')return stored.has(id)?[stored.get(id)]:[];
        return [{live_published_snapshot:{presentation:{title:'Published presentation',animationPreset:'subtle'}},live_published_revision:7,live_published_at:new Date(now-10000).toISOString()}];
      }
      if(u.pathname==='/rest/v1/nothingsports_fixture_devices')return [];
      if(u.pathname==='/rest/v1/rpc/nothingsports_marquee_take_rate_limit')return true;
      assert.equal(u.pathname,'/rest/v1/nothingsports_fixture_participation','No unexpected service path');
      if(options.method==='POST'){records.set(options.body.event_id+'|'+options.body.device_hash,options.body);return [];}
      return [...records.values()].filter(r=>'eq.'+r.event_id===u.searchParams.get('event_id')&&(!u.searchParams.has('device_hash')||'eq.'+r.device_hash===u.searchParams.get('device_hash')));
    };
    process.env.PARTICIPATION_SECRET='test-only-'.repeat(8);
    delete require.cache[modulePath];const handler=require(modulePath);
    const request=async(query={},method='GET',body={},extra={})=>{const response=capture();await handler({method,query,body,url:'/api/participation',headers:{...headers,...extra}},response);return response;};
    for(const [query,eventId] of [[{},first.eventId],[{eventId:second.eventId},second.eventId],[{campaign:second.campaignId,eventId:first.eventId},second.eventId]]){
      const response=await request(query);assert.equal(response.statusCode,200);assert.equal(response.body.fixture.eventId,eventId);
      assert.equal(response.body.fixture.presentation.publishedRevision,7);assert.equal(response.headers['Cache-Control'],'private, no-store, max-age=0');
      assert.doesNotMatch(JSON.stringify(response.body),/PRIVATE-EMAIL-DRAFT|PRIVATE-SOCIAL-DRAFT|PRIVATE-HEAT|device_hash|draft_copy/);
      assert(!Object.hasOwn(response.body.fixture,'drafts'));assert(!Object.hasOwn(response.body.fixture.material,'rating'));
    }
    const direct=make('stored-only');stored.set(direct.campaignId,{candidate:direct,state:'draft'});
    assert.equal((await request({campaign:direct.campaignId})).body.fixture.eventId,direct.eventId,'Existing campaign links must not require a catalogue entry');
    for(const query of [{eventId:'missing'},{eventId:unready.eventId},{eventId:cancelled.eventId}]){
      calls.length=0;const response=await request(query);assert.equal(response.statusCode,404);assert.equal(response.body.code,'fixture_not_participating');assert(!calls.some(c=>c.method==='POST'),'Rejected reads cannot create a guest or participation');
    }
    calls.length=0;const tbc=await request({eventId:disabled.eventId});assert.equal(tbc.statusCode,200);assert.equal(tbc.body.fixture.participationEnabled,false);assert.equal(tbc.body.fixture.startTimeUtc,null);assert(!calls.some(c=>c.method==='POST'));
    assert.equal((await request({},'POST',{campaignId:disabled.campaignId,action:'join'})).body.code,'fixture_time_unconfirmed');
    assert.equal((await request({},'POST',{action:'join'})).statusCode,404,'POST must never acquire default fixture selection');
    const noAvailable={candidates:[expired,disabled]};assert.throws(()=>handler._test.campaignForPublicRead('',now,noAvailable),e=>e.code==='fixture_not_participating');
    const initial=await request({campaign:first.campaignId}),cookie=initial.headers['Set-Cookie'].split(';')[0];
    const write=body=>request({},'POST',{campaignId:first.campaignId,eventId:first.eventId,...body},{cookie});
    const joined=await write({action:'join'}),joinedAgain=await write({action:'join'});
    assert.equal(joined.statusCode,200);assert.equal(joinedAgain.body.aggregate.joinedCount,1);assert.equal(records.size,1,'Existing guest identity deduplicates repeated joins');
    const rated=await write({action:'rate',rating:5});assert.equal(rated.statusCode,200);assert.equal(rated.body.aggregate.currentDevice.rating,5);assert.equal(rated.body.aggregate.ratingCount,1);
    const revised=await write({action:'rate',rating:3});assert.equal(revised.body.aggregate.averageRating,3);assert.equal(records.size,1);
    assert.equal((await write({action:'rate',rating:0})).body.code,'invalid_rating');
    const rejected=await request({},'POST',{campaignId:first.campaignId,action:'join'},{cookie,origin:'https://other.invalid'});assert.equal(rejected.statusCode,403);
    assert.equal((await request({},'DELETE')).statusCode,405);
  }finally{
    server.supabaseServiceRequest=original.request;fs.readFileSync=original.read;delete require.cache[modulePath];require.cache[modulePath]=original.module;
    if(original.secret===undefined)delete process.env.PARTICIPATION_SECRET;else process.env.PARTICIPATION_SECRET=original.secret;
  }
}
module.exports={validatePublicFixtureReads};

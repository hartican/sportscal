'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const contract=require('../config/fixture-highlights'),media=require('../lib/fixture-highlights');
const captured=require('./fixtures/shanghai-highlights-184950.json');
const fixture={...captured,status:'completed'},channel=media.channels[0],day=86400000;
delete fixture.highlights;
const now=new Date('2026-10-13T15:00:00Z');
const video={videoId:'RPmOiRHHgX8',channelId:channel.id,title:'Alex de Minaur vs Karen Khachanov Highlights | Shanghai 2026 Round 4',publishedAt:'2026-10-13T07:16:25Z'};
async function main(){
  let outage=false,listing=true,requests=0;
  const fetchImpl=async url=>{
    requests++;
    if(outage)return new Response('',{status:503});
    if(url.includes('/feeds/')){
      const c=media.channels.find(c=>url.includes(c.id));
      const entry=listing&&c.id===channel.id?'<entry><yt:videoId>'+video.videoId+'</yt:videoId><yt:channelId>'+channel.id+'</yt:channelId><title>'+video.title+'</title><link rel="alternate" href="https://www.youtube.com/watch?v='+video.videoId+'"/><published>'+video.publishedAt+'</published></entry>':'';
      return new Response('<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><author><uri>https://www.youtube.com/channel/'+c.id+'</uri></author>'+entry+'</feed>');
    }
    if(url.includes('/oembed'))return new Response(JSON.stringify({type:'video',author_name:channel.label,author_url:'https://www.youtube.com/@'+channel.handle,title:video.title}));
    throw Error('Unexpected lifecycle request');
  };
  const first=await media.refresh({events:[fixture],now,fetchImpl});
  const record=first[0].highlights,expiry=new Date(Date.parse(video.publishedAt)+7*day+1),transportTime=new Date(+now+3*day);
  assert(contract.valid(record,new Date(+expiry-1)));
  assert(!contract.valid(record,expiry),'the seven-day upload boundary expires even freshly checked availability and metadata');
  assert(!contract.valid({...record,checkedAt:expiry.toISOString()},expiry),'availability-only rechecks cannot renew stale publication metadata');
  assert(!contract.valid({...record,checkedAt:new Date(+now+day).toISOString()},now),'future receipts are rejected');
  outage=true;
  const within=await media.refresh({events:[],archiveFixtures:[fixture],previous:first,coverage:first.coverage,now:new Date(+now+6*day),fetchImpl});
  assert.deepEqual(within[0].highlights,record,'last-good survives an outage only within its original bound');
  const expired=await media.refresh({events:[],previous:first,coverage:{...first.coverage,checkedAt:expiry.toISOString()},now:expiry,fetchImpl});
  assert.equal(expired[0].highlights,null,'inactive retained matches receive an explicit withdrawal');
  assert.deepEqual(expired.coverage._highlightVideos,[],'a failure/coverage timestamp cannot renew candidate metadata');
  outage=false;
  const renewed=await media.refresh({events:[],archiveFixtures:[fixture],previous:first,coverage:first.coverage,now:new Date(+now+2*day),fetchImpl});
  assert.equal(renewed[0].highlights.verifiedAt,record.verifiedAt,'first provenance survives a real unchanged recheck');
  assert.equal(renewed[0].highlights.checkedAt,new Date(+now+2*day).toISOString());
  assert.equal(renewed[0].highlights.sourceCheckedAt,new Date(+now+2*day).toISOString());
  assert.equal(require('../lib/live-fixtures').contentHash(first),require('../lib/live-fixtures').contentHash(renewed),'volatile renewals do not change fixture revisions');
  assert.equal(require('../config/feed-refresh-lifecycle').presentationFingerprint({events:first}),require('../config/feed-refresh-lifecycle').presentationFingerprint({events:renewed}),'renewal preserves card presentation and state');
  const noCheck=await media.refresh({events:[],archiveFixtures:[fixture],previous:renewed,coverage:renewed.coverage,now:new Date(+now+2*day+1800000),fetchImpl});
  assert.deepEqual(noCheck[0].highlights,renewed[0].highlights,'a due source pass alone does not renew verification');
  const classic={...fixture,date:'2026-09-01',startTimeUtc:null,actualStartTimeUtc:null};
  video.publishedAt='2026-09-02T07:16:25Z';
  assert.equal((await media.refresh({events:[],archiveFixtures:[classic],now,fetchImpl})).length,0,'recent checks cannot revive an old classic upload');
  video.publishedAt='2026-10-13T07:16:25Z';
  const historical=await media.refresh({events:[],archiveFixtures:[classic],now,fetchImpl});
  assert(contract.valid(historical[0].highlights,now),'an old fixture can use a genuinely recent highlight upload');
  listing=false;
  const partial=await media.refresh({events:[],archiveFixtures:[classic],previous:historical,coverage:historical.coverage,now:new Date(+now+2*day),fetchImpl});
  assert.equal(partial[0].highlights.checkedAt,new Date(+now+2*day).toISOString());
  assert.equal(partial[0].highlights.sourceCheckedAt,now.toISOString(),'oEmbed alone cannot refresh publication/description metadata');
  assert(!contract.valid(partial[0].highlights,expiry));
  const cleaned=media.applyCached([{...fixture,highlights:record}],first,expiry)[0];
  assert.equal(cleaned.highlights,null);
  assert.deepEqual({...cleaned,highlights:undefined},{...fixture,highlights:undefined},'sporting clocks, participants and results are untouched');
  const negative={videoId:video.videoId,channelId:channel.id,title:'stale metadata',publishedAt:video.publishedAt,metadataCheckedAt:'2026-09-01T00:00:00Z',unavailability:'api-restricted',availabilityCheckedAt:now.toISOString()};
  assert.deepEqual(media.pruneVideos([negative],{},[],now),[{videoId:video.videoId,unavailability:'api-restricted',availabilityCheckedAt:now.toISOString()}],'a recent restriction retains no expired title or publication metadata');
  assert.deepEqual(media.pruneVideos([negative],{},[],new Date(+now+30*day)),[],'negative availability also expires at thirty days');
  // Model the actual SQL contract: an unchanged fact hash keeps the original
  // fixture row while the owner persists its newer private provider receipts.
  let report=first.coverage,dbFailure=false,reads=0;
  const live=require('../lib/live-fixtures');
  const store=live.createSnapshotStore({request:async url=>{
    reads++;
    if(dbFailure){const error=Error('Controlled read failure');error.status=503;throw error;}
    if(url.endsWith('/nothingsports_read_fixture_source_health'))return [{source_id:media.SOURCE_ID,revision:7,discovery_report:report}];
    if(url.endsWith('/nothingsports_read_current_fixtures'))return [{source_id:media.SOURCE_ID,fixture:first[0]}];
    throw Error('Unexpected persistence replay request');
  }});
  const initialSnapshot=await live.readLiveSnapshots({store,ids:[fixture.canonicalEventId],now:+now,maxAgeMs:0});
  report=renewed.coverage;
  const renewedSnapshot=await live.readLiveSnapshots({store,ids:[fixture.canonicalEventId],now:+transportTime,maxAgeMs:0});
  const transported=renewedSnapshot.sources[0].fixtures[0];
  assert.equal(transported.highlights.checkedAt,renewed[0].highlights.checkedAt,'unchanged stored rows receive their actual persisted renewal receipt');
  assert.equal(transported.highlights.verifiedAt,record.verifiedAt);
  assert(contract.valid(transported.highlights,transportTime));
  assert.equal(renewedSnapshot.sources[0].revision,7,'the stored sporting revision is unchanged');
  assert.notEqual(renewedSnapshot.revision,initialSnapshot.revision,'the transport validator delivers renewed receipts to cached clients');
  assert.equal(reads,4,'each read uses only the existing health and selected-fixture reads');
  assert(!Object.keys(renewedSnapshot.sources[0].discovery_report).some(key=>key.startsWith('_highlight')),'private matching metadata never enters transport');
  assert.equal(media.renewRecords(first,{checkedAt:expiry.toISOString()},expiry)[0].highlights,null,'an overall health timestamp cannot renew an unchanged row');
  const badMetadata={...renewed.coverage,_highlightVideos:renewed.coverage._highlightVideos.map(v=>({...v,title:'An unrelated video'}))};
  assert.equal(media.renewRecords(first,badMetadata,expiry)[0].highlights,null,'mismatched metadata cannot lend its receipts to another record');
  dbFailure=true;
  const warn=console.warn;console.warn=()=>{};
  let stale;
  try{stale=await live.readLiveSnapshots({store,ids:[fixture.canonicalEventId],now:+expiry+2*day,maxAgeMs:0});}finally{console.warn=warn;}
  assert(stale.stale);assert.equal(stale.sources[0].fixtures[0].highlights,null,'a failed database read cannot keep expired metadata in a stale transport cache');
  assert.notEqual(stale.revision,renewedSnapshot.revision);
  const beforeRequests=requests,originalCwd=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'highlights-cache-'));
  try{
    const document={...require('../data/events.json'),events:[{...fixture,highlights:record}]};
    for(const file of ['data/events.json','feeds/incoming/events.json']){fs.mkdirSync(path.join(temp,path.dirname(file)),{recursive:true});fs.writeFileSync(path.join(temp,file),JSON.stringify(document));}
    fs.mkdirSync(path.join(temp,'data/canonical'),{recursive:true});fs.writeFileSync(path.join(temp,'data/canonical/fixture-highlights.v1.json'),JSON.stringify({events:first}));
    fs.writeFileSync(path.join(temp,'data/feed-meta.json'),JSON.stringify(require('../data/feed-meta.json')));
    process.chdir(temp);
    await require(path.join(originalCwd,'scripts/refresh-fixture-highlights')).refresh({offline:true,now:expiry});
    assert.equal(JSON.parse(fs.readFileSync('data/canonical/fixture-highlights.v1.json')).events[0].highlights,null);
    assert.equal(JSON.parse(fs.readFileSync('data/events.json')).events[0].highlights,null);
    assert.equal(requests,beforeRequests,'offline expiry makes no provider request');
  }finally{process.chdir(originalCwd);fs.rmSync(temp,{recursive:true,force:true});}
  console.log('Highlights cache: upload expiry, bounded outages, real renewal, unchanged-row persistence/transport, stable sporting revisions, old classics, partial checks and offline purge passed.');
}
module.exports={main};
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});

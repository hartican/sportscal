'use strict';
// Offline regression: card destination, query context and real route failures.
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const contract=require('../config/fixture-highlights');
const {createLiveFixtureHandler}=require('../lib/live-fixture-handler');
const {createTopResultResolver}=require('./highlight-resolver-test');
const now=new Date('2026-11-01T01:00:00Z');
const cricket={id:'fixture:cricket:espn:1525661',canonicalEventId:'fixture:cricket:espn:1525661',key:'cricket',codeId:'sport:cricket',name:'South Africa v Australia',competitionName:'South Africa v Australia Tests',roundLabel:'3rd Test',format:'Test',status:'completed',date:'2026-10-27',endDate:'2026-10-31',numberOfDays:5,matchDay:5,matchDaySourceUrl:'https://www.espncricinfo.com/series/test/match',highlights:null};
const direct={schemaVersion:contract.SCHEMA_VERSION,provider:'youtube',videoId:'SAFEVIDEO01',url:'https://www.youtube.com/watch?v=SAFEVIDEO01',channelId:'UCaaaaaaaaaaaaaaaaaaaaaa',availability:'public',regionStatus:'allowed',standalone:true,publishedAt:'2026-10-31T19:00:00Z',verifiedAt:now.toISOString()};
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(body){this.body=body;},end(body){this.body=body;}});
async function route(event,resolveHighlights,id=event.id){
  const res=response();
  const handler=createLiveFixtureHandler({publishedFixtures:()=>[event],read:async()=>({sources:[],revision:'controlled',stale:false}),clock:()=>now,environment:{},resolveHighlights:async(...args)=>{res.fixture=args[0];return resolveHighlights(...args);}});
  await handler({method:'GET',headers:{},url:'/api/fixtures?mode=highlight&ids='+encodeURIComponent(id)},res);return res;
}
function assertSearch(res,event=cricket){
  event=res.fixture||event;
  assert.equal(res.code,302);assert.equal(res.headers.Location,contract.searchResultsUrl(event,now));assert.equal(res.headers['X-Highlights-Selection'],'youtube-search');assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(res.body,undefined,'no error page or private diagnostic');
}
async function main(){
  const original=JSON.stringify(cricket);
  const action=contract.viewing(cricket,now);
  assert.equal(new URL(action.webUrl,'https://nothingsport.test').hostname,'www.youtube.com','a missing video must open YouTube results directly, without a verification route');
  assert.equal(action.highlightsLabel,'Search YouTube');
  const url=new URL(action.webUrl);
  assert.equal(url.pathname,'/results');
  const query=url.searchParams.get('search_query');
  for(const part of ['South Africa','Australia','3rd Test','Day 5','31 October 2026','highlights'])assert(query.includes(part),part+' missing from '+query);
  const providerQuery=contract.searchQuery(cricket,now);
  assert(providerQuery.includes('Day 5'));assert(providerQuery.includes('2026-10-31'));
  const day3={...cricket,matchDay:3};assert(new URL(contract.searchResultsUrl(day3,now)).searchParams.get('search_query').includes('Day 3 29 October 2026'));
  for(const patch of [{matchDay:null},{matchDay:0},{matchDay:6},{matchDaySourceUrl:null}])assert(!new URL(contract.searchResultsUrl({...cricket,...patch},now)).searchParams.get('search_query').includes('Day '),'unknown/unqualified days cannot be invented');
  // The browser executes the real UMD module without require or a provider.
  const browser={URLSearchParams,console};vm.createContext(browser);
  for(const file of ['epic-classics','fixture-highlights'])vm.runInContext(fs.readFileSync(require.resolve('../config/'+file),'utf8'),browser);
  assert.equal(browser.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS.viewing(cricket,+now).webUrl,action.webUrl);
  const fixtures=[
    {...cricket,key:'f1',codeId:'sport:f1',name:'Mexico City GP',competitionName:'Formula 1 2026',stage:'Race',matchDay:null},
    {...cricket,key:'football',codeId:'sport:football',name:'Brighton & Hove Albion v Paris Saint-Germain',competitionName:'UEFA Champions League'},
    {...cricket,key:'tennis-women',codeId:'sport:tennis',name:'Women’s final',eventType:'womens-singles',tournamentName:'WTA Finals',participants:[{name:'Iga Świątek'},{name:'Coco Gauff'}]},
    {...cricket,key:'rugby',codeId:'sport:rugby',name:'New Zealand v Australia',competitionName:'Bledisloe Cup'}
  ];
  for(const event of fixtures){
    event.date=event.endDate;
    const fallback=contract.viewing(event,now);assert.equal(fallback.highlightsLabel,'Search YouTube');const u=new URL(fallback.webUrl);assert.equal(u.origin,'https://www.youtube.com');assert.equal(u.pathname,'/results');assert.equal([...u.searchParams].length,1);assert(u.searchParams.get('search_query').includes('highlights'));assert(u.searchParams.get('search_query').includes('31 October 2026'));assert.equal(browser.NOTHINGSPORTS_FIXTURE_HIGHLIGHTS.viewing(event,+now).webUrl,fallback.webUrl);
  }
  const encoded={...cricket,name:'A&B / São Paulo #1? v O’Connor + 50% <team>',competitionName:'Cup & mode=evil',roundLabel:'Final'};
  const encodedUrl=new URL(contract.searchResultsUrl(encoded,now));assert.equal([...encodedUrl.searchParams].length,1);assert.equal(encodedUrl.hash,'');assert(encodedUrl.searchParams.get('search_query').includes(encoded.name));assert(encodedUrl.href.includes('%26'));assert(encodedUrl.href.includes('%25'));
  // Absent/withdrawn/expired source records need only the local formatter.
  for(const highlights of [undefined,null,{...direct,regionStatus:'blocked'},{...direct,publishedAt:'2020-01-01T00:00:00Z'}])assert.equal(contract.viewing({...cricket,highlights},now).webUrl,action.webUrl);
  const f1={...fixtures[0],highlights:direct};assert.match(contract.viewing(f1,now).webUrl,/^\/api\/fixtures\?mode=highlight&ids=/);assert.equal(contract.viewing(f1,now).highlightsLabel,'Watch highlights');
  const success=await route(f1,async()=>({url:direct.url,selection:'verified-match'}));assert.equal(success.headers.Location,direct.url);assert.equal(success.headers['X-Highlights-Selection'],'verified-match');
  for(const outcome of ['missing_key','quota_denied','no_results','provider_http','cache_failure']){
    let providerCalls=0;
    const resolver=createTopResultResolver({environment:outcome==='missing_key'?{}:{YOUTUBE_DATA_API_KEY:'controlled-test-key'},diagnose:()=>{},discoverOfficial:async()=>[],request:async(_path,options={})=>{if(outcome==='cache_failure')throw Error('private diagnostic');return options.method==='POST'?{granted:outcome!=='quota_denied'}:[];},fetchImpl:async()=>{providerCalls++;return new Response(outcome==='provider_http'?'private diagnostic':'{"items":[]}',{status:outcome==='provider_http'?503:200});}});
    assertSearch(await route(cricket,(...args)=>resolver.resolve(...args)));
    assert.equal(providerCalls,['no_results','provider_http'].includes(outcome)?1:0,outcome+' request bound');
  }
  for(const target of [null,{url:'javascript:alert(1)'},{url:'https://www.youtube.com.evil/watch?v=SAFEVIDEO01'},{url:'https://www.youtube.com/watch?v=SAFEVIDEO01&next=evil'}])assertSearch(await route(cricket,async()=>target));
  // Historical direct contexts have no query to distinguish days: the cache
  // fence itself must prevent Day 4's saved selection being reused for Day 5.
  const historical={...cricket,date:'2026-09-01',endDate:'2026-09-05',matchDay:4,highlights:direct};
  assert.equal(contract.searchQuery(historical,now),null);
  let savedPath;const resolver=createTopResultResolver({environment:{},diagnose:()=>{},request:async path=>{savedPath ||= path;return path===savedPath?[{video_id:direct.videoId,selected_at:now.toISOString(),published_at:direct.publishedAt,duration_seconds:300}]:[];},fetchImpl:()=>assert.fail('cache day fence is offline')});
  assert.equal((await resolver.resolve(historical,now)).url,direct.url);
  await assert.rejects(resolver.resolve({...historical,matchDay:5},now));
  await assert.rejects(resolver.resolve({...historical,matchDay:null},now));
  assert.equal((await resolver.resolve(historical,now)).url,direct.url,'the original matching day remains reusable');
  for(const status of ['live','stumps','upcoming','cancelled']){assert.equal(contract.viewing({...cricket,status},now),null);const res=await route({...cricket,status},()=>assert.fail('non-completed fixture cannot start discovery'));assert.equal(res.code,404);assert(!res.headers.Location);}
  const unknown=await route(cricket,()=>assert.fail('unknown ID cannot start discovery'),'fixture:unknown');assert.equal(unknown.code,404);assert(!unknown.headers.Location);
  assert.equal(contract.viewing({...cricket,id:'https://evil.test',canonicalEventId:null},now),null);
  assert.equal(JSON.stringify(cricket),original,'search links cannot change sporting facts or day receipts');
  console.log('Highlights search fallback: reported Test Day 5/date, browser/server parity, cross-sport/Unicode URLs, direct F1 success, absent/withdrawn/expired video, real no-key/quota/empty/error paths, unsafe-target rejection and day cache fencing passed; zero live provider/service calls.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main,cricket,now,direct};

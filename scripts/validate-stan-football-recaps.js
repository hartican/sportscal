#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const selection=require('../lib/stan-football-recaps');
const catalogue=require('../data/coverage/stan-football-programmes.v1.json');
async function main(){
const sourceFixture=require('../data/follow-fixtures.v1.json').events.find(e=>e.id==='fixture:football:openligadb:uefa-champions-league:87418');
assert(sourceFixture,'retained canonical fixture exists');
const actual=catalogue.programmes.filter(p=>p.programId==='8097690');assert.equal(actual.length,2,'both reviewed variants retained without inventing different programme ids');
const now=Math.max(...actual.map(p=>Date.parse(p.observedAt)))+1000;
const originalStatus=sourceFixture.status;
const fixture={...structuredClone(sourceFixture),status:'completed'}; // Controlled lifecycle input; source facts remain unchanged.
const pick=selection.select(fixture,catalogue,now);assert.equal(pick.programId,'8097690');assert.equal(pick.kind,'rapid_recap');assert.equal(pick.programUrl,'https://play.stan.com.au/programs/8097690/play');assert.equal(pick.variantSpecific,false);assert.equal(pick.requiresVariantSelection,true);assert.equal(pick.durationSeconds,325);
assert.equal(selection.select({...fixture,status:'upcoming'},catalogue,now),null);
assert.equal(selection.select({...fixture,season:'2025/26'},catalogue,now),null,'wrong edition');
assert.equal(selection.select({...fixture,roundNumber:3},catalogue,now),null,'repeated opponents different matchday');
assert.equal(selection.select({...fixture,date:'2026-10-16'},catalogue,now),null,'different supplied match date');
assert.equal(selection.select({...fixture,startTimeUtc:new Date(now+10000).toISOString()},catalogue,now),null,'future kickoff');
assert.equal(selection.select({...fixture,competitionId:'competition:premier-league'},catalogue,now),null,'different competition');
assert.equal(selection.select({...fixture,participants:[...fixture.participants].reverse().map((p,i)=>({...p,role:i?'away':'home'}))},catalogue,now),null,'home/away reversed');
assert.equal(selection.select({...fixture,participants:[fixture.participants[0],{name:'Liverpool',role:'away'}]},catalogue,now),null,'wrong opponent');
assert.equal(selection.select(fixture,catalogue,now+selection.MAX_AGE_MS),null,'stale source observation');
assert.equal(selection.select(fixture,catalogue,Math.min(...actual.map(p=>Date.parse(p.observedAt)))-1000),null,'future source observation');
assert.equal(selection.select(fixture,{...catalogue,programmes:actual.filter(p=>p.kind==='highlights')},now).kind,'highlights','highlights fallback');
assert.equal(selection.parseTitle('Manchester City v Paris Saint-Germain - UEFA Champions League Matchday 2 2026/2027').roundNumber,2);
assert.equal(selection.parseTitle('Manchester City v Paris Saint-Germain - UEFA Champions League 2026/2028'),null);
assert.equal(selection.kindForHeading('Replays & Extras'),null);assert.equal(selection.kindForHeading('Mini Matches'),null);
const feed={sourceUrl:'https://www.stan.com.au/watch/sport/football/uefa-champions-league',feedUrl:'https://www.stan.com.au/watch/sport/feed/1397.json',heading:'UEFA Champions League Rapid Recaps',observedAt:new Date(now-1000).toISOString(),entries:[{guid:'8097690',type:'program',isSportBundle:true,title:actual[0].title,shortform:'recap',sourceDateText:'15 Oct • League Phase',durationText:'05:25'}]};
assert.equal(selection.normalizeCatalogue([feed]).programmes.length,1);
for(const changed of [{sourceUrl:'https://evil.invalid/watch/sport/football/uefa-champions-league'},{feedUrl:'https://evil.invalid/1397.json'},{heading:'Full Replays'},{feedUrl:'https://www.stan.com.au/watch/sport/feed/1284.json'},{entries:[{...feed.entries[0],shortform:'mini'}]},{entries:[{...feed.entries[0],durationText:'180:00'}]},{entries:[{...feed.entries[0],guid:'../../bad'}]}])assert.equal(selection.normalizeCatalogue([{...feed,...changed}]).programmes.length,0);
assert.equal(sourceFixture.status,originalStatus,'controlled test did not change canonical fixture');
console.log('Stan reviewed football programme parser, exact identity, variant honesty, lifecycle and negative checks passed.');

  const tooOld=now+8*86400000;assert.equal(selection.select(fixture,{...catalogue,programmes:actual.map(p=>({...p,observedAt:new Date(tooOld).toISOString()}))},tooOld),null,'new observation cannot renew an expired source display date');
  assert.equal(selection.select(fixture,catalogue,new Date(now)).programId,'8097690','Date injection supported');
  assert.equal(selection.parseTitle('Portland Thorns v Gotham FC - NWSL 2026').season,'2026','source supplied single-year season');
  const page='https://www.stan.com.au/watch/sport/football/uefa-champions-league';
  const rapid='https://www.stan.com.au/watch/sport/feed/1397.json',high='https://www.stan.com.au/watch/sport/feed/1396.json';
  const advertisement=(id,kind)=>'<div data-feed-load-url="/watch/sport/feed/'+id+'.json"><h2>UEFA Champions League '+kind+'</h2></div>';
  const imageParams=new URLSearchParams({desc:'15 Oct • League Phase',duration:'05:25',shortform:'recap'}).toString();
  const image='https://streamcoimg-a.akamaihd.net/tile/header.'+Buffer.from(JSON.stringify({Params:imageParams})).toString('base64url')+'.signature';
  const raw={guid:'8097690',title:actual[0].title,type:'program',isSportBundle:true,imageURL:image};
  const rawHigh={...raw,imageURL:'https://streamcoimg-a.akamaihd.net/tile/header.'+Buffer.from(JSON.stringify({Params:new URLSearchParams({desc:'15 Oct • League Phase',duration:'09:27',shortform:'highlights'}).toString()})).toString('base64url')+'.signature'};
  const previous={schemaVersion:selection.SCHEMA_VERSION,programmes:structuredClone(actual)};
  const refreshedAt=now+10000;let active=0,maxActive=0,calls=[];
  const fetchImpl=async(url,options)=>{calls.push(url);assert(options.signal,'every metadata request has abort signal');assert.equal(options.redirect,'error');assert(/^https:\/\/www\.stan\.com\.au\/watch\/sport\/(?:football\/[^/]+|feed\/\d+\.json)$/.test(url),'only reviewed public metadata');active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,1));active--;if(url===page)return new Response(advertisement(1397,'Rapid Recaps')+advertisement(1396,'Highlights'));if(url===rapid)return new Response(JSON.stringify({entries:[raw]}));if(url===high)return new Response(JSON.stringify({entries:[rawHigh]}));return new Response('<html></html>');};
  const refreshed=await selection.refreshCatalogue({previousCatalogue:previous,fetchImpl,now:new Date(refreshedAt),events:[fixture]});
  assert.equal(refreshed.failed,false);assert.equal(refreshed.catalogue.programmes.length,2);assert(refreshed.changed);assert(maxActive<=3);assert(calls.length<=20);assert(refreshed.catalogue.programmes.every(p=>p.observedAt===new Date(refreshedAt).toISOString()));assert(refreshed.catalogue.programmes.every(p=>p.variantSpecific===false));
  const partial=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,events:[fixture],fetchImpl:async(url,options)=>{if(url===rapid)throw Error('source unavailable');return fetchImpl(url,options);}});
  assert(partial.failed);assert.equal(partial.catalogue.programmes.find(p=>p.kind==='rapid_recap').observedAt,actual.find(p=>p.kind==='rapid_recap').observedAt,'source failure never renews old observation');assert.equal(partial.catalogue.programmes.find(p=>p.kind==='highlights').observedAt,new Date(refreshedAt).toISOString());
  const withdrawn=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,events:[fixture],fetchImpl:async()=>new Response('<html></html>')});assert.equal(withdrawn.catalogue.programmes.length,0,'feed no longer advertised withdraws old selection');
  const failure=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,fetchImpl:async()=>{throw Error('offline')}});assert(failure.failed);assert.equal(failure.changed,false,'complete failure without expiry does not rewrite reviewed catalogue');assert(failure.catalogue.programmes.every(p=>actual.some(a=>a.programId===p.programId&&a.kind===p.kind&&a.observedAt===p.observedAt)));
  const expired=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt+selection.MAX_AGE_MS,fetchImpl:async()=>{throw Error('offline')}});assert.equal(expired.catalogue.programmes.length,0,'expired observations fail closed');
  const oversized=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,events:[fixture],fetchImpl:async(url,options)=>url===rapid?new Response(' '.repeat(selection.REFRESH_LIMITS.maxBytes+1)):fetchImpl(url,options)});assert(oversized.failed);assert.equal(oversized.catalogue.programmes.find(p=>p.kind==='rapid_recap').observedAt,actual.find(p=>p.kind==='rapid_recap').observedAt,'oversized metadata retains old timestamp');
  const began=performance.now();let hangingCalls=0;const timed=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,deadlineMs:15,fetchImpl:()=>{hangingCalls++;return new Promise(()=>{});}});assert(timed.failed);assert(performance.now()-began<1000,'overall deadline bounds even uncooperative fetch');assert(hangingCalls<=3);
  const wrongEdition={...raw,title:raw.title.replace('2026/2027','2025/2026')};const staleEdition=await selection.refreshCatalogue({previousCatalogue:previous,now:refreshedAt,events:[fixture],fetchImpl:async(url,options)=>url===rapid?new Response(JSON.stringify({entries:[wrongEdition]})):fetchImpl(url,options)});assert.equal(staleEdition.catalogue.programmes.filter(p=>p.kind==='rapid_recap').length,0,'old edition cannot be renewed by current observation');
  assert.equal(selection.REFRESH_LIMITS.deadlineMs,20000);assert.equal(selection.REFRESH_LIMITS.requestMs,3000);assert.equal(selection.REFRESH_LIMITS.maxEntries,100);assert.equal(selection.REFRESH_LIMITS.maxProgrammes,512);

  const eventSource=require('../data/events.json'),eventRows=Array.isArray(eventSource)?eventSource:eventSource.events;
  const liverpool=eventRows.find(e=>e.id==='epl-2026-27-128980'),hull=eventRows.find(e=>e.id==='epl-2026-27-128978');assert(liverpool&&hull,'actual saved Feed football fixture identities retained');
  const lp=selection.select(liverpool,catalogue,now),hp=selection.select(hull,catalogue,now);assert.equal(lp.programId,'8423935');assert.equal(hp.programId,'8424086');for(const p of [lp,hp]){assert.equal(p.kind,'programme');assert.equal(p.durationSeconds,null,'programme fallback makes no shortform duration claim');assert.equal(p.variantSpecific,false);}
  assert.equal(selection.select({...hull,startTimeUtc:'2026-10-10T13:00:00.000Z'},catalogue,now),null,'date tolerance is not arbitrary adjacent day');
  assert.equal(selection.select({...hull,roundNumber:7},catalogue,now),null,'programme fallback exact matchweek');
  assert.equal(selection.select({...liverpool,season:'2025/26'},catalogue,now),null,'programme fallback exact edition');
  const ranked=selection.candidatesFor(liverpool,{...catalogue,programmes:[lp,{...lp,kind:'highlights'},{...lp,kind:'rapid_recap'}]},now);assert.deepEqual(ranked.map(p=>p.kind),['rapid_recap','highlights','programme']);
  const boundary=Date.parse('2026-10-19T01:00:00Z');assert.equal(selection.select(hull,catalogue,boundary).programId,'8424086','Feed day7inclusive retains exact priorUTCdate match');
  const boundaryRefresh=await selection.refreshCatalogue({previousCatalogue:{schemaVersion:selection.SCHEMA_VERSION,programmes:[hp]},now:boundary,events:[hull],fetchImpl:async()=>{throw Error('offline')}});assert.equal(boundaryRefresh.catalogue.programmes[0].programId,'8424086','refresh retains exact kickoff UTCdate under Feed boundary');
  const eplFeed={sourceUrl:'https://www.stan.com.au/watch/sport/football/premier-league',feedUrl:'https://www.stan.com.au/watch/sport/feed/3578.json',heading:'Premier League Replays & Extras',observedAt:new Date(now).toISOString(),entries:[{guid:'8424086',type:'program',isSportBundle:true,title:hp.title,sourceDateText:'11 Oct • Premier League',durationText:'180:00'}]};const programme=selection.normalizeCatalogue([eplFeed]).programmes[0];assert.equal(programme.kind,'programme');assert.equal(programme.durationSeconds,null,'programme container never represented as a validated short clip');
  assert.equal(selection.normalizeCatalogue([{...eplFeed,entries:[{...eplFeed.entries[0],shortform:'mini'}]}]).programmes.length,0,'mini is not a reviewed programme fallback');
  console.log('Stan exact Liverpool/Manchester City and Hull/Everton programme fallback, variant ordering, UTC/Sydney date and unchanged Feed boundary checks passed.');
  console.log('Stan bounded public-metadata refresh, advertisement, partial-failure timestamp, recency/edition, concurrency, size and deadline checks passed.');
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={main};

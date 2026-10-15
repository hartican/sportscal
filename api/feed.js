"use strict";
const crypto = require('node:crypto');
const {performance}=require('node:perf_hooks');
const {FeedResponseCache}=require('../lib/feed-response-cache');
let dependencies,liveHandler;
function feedDependencies(){
  if(dependencies)return dependencies;
  const eventFeed=require('../data/events.json');
  const sportContext=require('../config/sport-context');
  const canonicalSportContext=sportContext.mergeCanonicalBundles(
    require("../data/canonical/afl-nrl-2026.json"),require("../data/canonical/f1-context-2026.json"),
    require("../data/canonical/wrc-context-2026.json"),require("../data/canonical/tennis-context-2026.json"),
    require("../data/canonical/cycling-context-2026.json"),require("../data/canonical/nba-context-2026.json"),require("../data/canonical/cwg-context-2026.json")
  );
  const contextualEvents=sportContext.applyContextToEvents(require('../lib/calendar-catalogue').catalogue(),canonicalSportContext);
  dependencies={...require('../lib/server-feed-pipeline'),...require('../lib/follow-fixture-resolver'),...require('../lib/live-fixtures'),eventFeed,canonicalSportContext,contextualEvents};
  return dependencies;
}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('base64url');}
function selectedFixtureEvents(userState){
  const actions=userState?.event_user_state||userState?.eventUserState||{};
  return Object.values(actions).filter(a=>a?.addedToFixtures&&a?.addedFixture?.eventId).map(a=>a.addedFixture);
}
function expiry(events,now,pipeline){
  let deadline=now.getTime()+30000;
  const nextDay=new Date(`${pipeline.sydneyDateKey(now)}T12:00:00Z`);nextDay.setUTCDate(nextDay.getUTCDate()+1);
  const midnight=pipeline.sydneyLocalDateToUtc(nextDay.toISOString().slice(0,10),'00:00');
  if(midnight)deadline=Math.min(deadline,+midnight);
  const lifecycle=require('../config/card-lifecycle');
  for(const event of events){
    for(const value of [event.startTimeUtc,event.endTimeUtc,pipeline.eventEnd(event),lifecycle.archivesAtForEvent(event),lifecycle.expiresAtForEvent(event)]){
      const time=+new Date(value||'');
      if(time>+now)deadline=Math.min(deadline,time);
      if(time===+now)deadline=Math.min(deadline,time+1);
    }
  }
  return deadline;
}
function createFeedHandler({load=feedDependencies,authenticate=()=>require('../lib/supabase-server'),clock=()=>new Date(),cache=new FeedResponseCache(),scopeCache=new FeedResponseCache({maxEntries:100,maxBytes:1024*1024}),live=()=>liveHandler||(liveHandler=require('../lib/live-fixture-handler').createLiveFixtureHandler())}={}){
  return async function feedHandler(request,response){
    const route=new URL(request.url||'/api/feed','https://nothingsport.local');
    if(route.searchParams.get('route')==='match-centre'||request.query?.route==='match-centre')return require('../lib/match-centre-handler').createMatchCentreHandler()(request,response);
    if(['/api/fixtures','/api/fixture-refresh'].includes(route.pathname)||['fixtures','fixture-refresh'].includes(route.searchParams.get('route')||request.query?.route))return live()(request,response);
    response.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
    response.setHeader('Pragma','no-cache');response.setHeader('Vary','Authorization');
    const matchCentreOnly=route.searchParams.get('scope')==='match-centre';
    const athletesOnly=route.searchParams.get('scope')==='athletes';
    const participantId=athletesOnly?route.searchParams.get('participantId'):null;
    if(participantId&&!/^(?:athlete|competitor|player|team):[-a-z0-9_:]{1,180}$/i.test(participantId))return response.status(400).json({error:'Invalid participant'});
    const publicMatch=(matchCentreOnly||athletesOnly)&&request.method==='POST';
    if((request.method||'GET')!=='GET'&&!publicMatch){response.setHeader('Allow','GET');return response.status(405).json({error:'The personalised feed supports GET requests only.',code:'method_not_allowed'});}
    const began=performance.now(),timings=[];
    const mark=(name,ms)=>timings.push(`${name};dur=${ms.toFixed(2)}`);
    const send=(entry,status)=>{
      mark('total',performance.now()-began);response.setHeader('Server-Timing',timings.join(', '));const etag=entry.etag;response.setHeader("ETag", etag);
      if(status===304)return response.status(304).end();
      response.status(200);response.setHeader('Content-Type','application/json; charset=utf-8');
      if(typeof response.send==='function')return response.send(entry.body);
      return response.json(JSON.parse(entry.body));
    };
    let d,authDependencies;
    try{
      if(publicMatch&&Buffer.byteLength(JSON.stringify(request.body||{}))>131072)return response.status(413).json({error:'Preferences too large'});
      // Validate identity and account state before initializing the shared catalogue.
      let t=performance.now();authDependencies=publicMatch?null:authenticate();
      const accessToken=publicMatch?null:authDependencies.bearerToken(request);
      const user=publicMatch?{id:'public-match-centre'}:await authDependencies.authenticatedUser(accessToken);mark('auth',performance.now()-t);
      t=performance.now();const loadedUserState=publicMatch?{preferences:request.body?.preferences||{},event_user_state:request.body?.eventUserState||{}}:await authDependencies.loadUserState(user.id, accessToken);mark('state',performance.now()-t);
      if(!loadedUserState)throw new authDependencies.SupabaseRequestError('Your synced profile must be saved before the feed can rebuild.',{status:409,payload:{code:'user_state_missing'}});
      t=performance.now();d=load();mark('init',performance.now()-t);
      const userState=d.normalizeUserFollowState(loadedUserState);
      if(!userState)throw new authDependencies.SupabaseRequestError('Your synced profile must be saved before the feed can rebuild.',{status:409,payload:{code:'user_state_missing'}});
      const bounded=(value,fallback,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(1,Math.floor(Number(value)))):fallback;
      const limit=request.url?bounded(route.searchParams.get('limit')||20,20,50):d.eventFeed.events.length;
      const rawCursor=Number(route.searchParams.get('cursor'));
      const cursor=Number.isFinite(rawCursor)?Math.max(0,Math.floor(rawCursor)):0;
      // Followed needs the same bounded current-window bundle as Everything.
      // The full-season read can time out and lose live-only observations.
      // Preserve published/saved member aliases so source reschedules still
      // reconcile them, and finish local selection before the remote deadline.
      const matchModel=matchCentreOnly?require('../config/match-centre'):null;
      const preserveIds=matchCentreOnly?[...d.contextualEvents,...selectedFixtureEvents(userState)]
        .filter(e=>matchModel.eligible(e,+clock()))
        .flatMap(e=>[matchModel.id(e),e.id,e.eventId,...(e.sourceEventIds||[]),...(e.fixtureIdAliases||[])]).filter(Boolean):[];
      // Resolve the complete requested calendar before selecting its source
      // families. Other Feed callers retain the existing global read.
      let resolved,profileScope;
      if(athletesOnly){
        const scopeKey=digest({userId:user.id,userState,participantId,sourceVersion:d.eventFeed.version,sourcePublishedAt:d.eventFeed.publishedAt,followFixtureVersion:d.FOLLOW_FIXTURE_VERSION});
        const savedScope=scopeCache.get(scopeKey);
        if(savedScope)profileScope=JSON.parse(savedScope.body);
        else{
          t=performance.now();resolved=d.resolveUserFollowFixtures({events:[...d.contextualEvents,...selectedFixtureEvents(userState)],userState,participantId,copyEvents:false});mark('resolve',performance.now()-t);
          profileScope=require('../lib/profile-fixture-requirements').requirements({userState,participantId,events:resolved.events,participants:[...d.canonicalSportContext.participants,...resolved.participants]});
          // Published requirements stay fixed within this immutable build. Do
          // not repeat calendar construction before a warm response-cache hit.
          scopeCache.set(scopeKey,{body:JSON.stringify(profileScope),etag:'',expiresAt:Infinity});
        }
      }
      t=performance.now();const snapshot=await d.readLiveSnapshots(matchCentreOnly?{scope:'match-centre',preserveIds}:profileScope||undefined).catch(()=>null);mark('live',performance.now()-t);
      const now=clock();
      const {SERVER_FEED_BUILD_VERSION,SERVER_FEED_SCHEMA_VERSION,eventFeed}=d;
      const key=digest({matchCentreOnly,athletesOnly,participantId,userId:user.id,userState,cursor,limit,fixtureRevision:snapshot?.revision||null,fixtureStale:snapshot?.stale||!snapshot,sourceVersion:d.eventFeed.version,sourcePublishedAt: eventFeed.publishedAt,followFixtureVersion:d.FOLLOW_FIXTURE_VERSION,buildVersion: SERVER_FEED_BUILD_VERSION,schemaVersion:SERVER_FEED_SCHEMA_VERSION,deployment:process.env.VERCEL_DEPLOYMENT_ID||process.env.VERCEL_GIT_COMMIT_SHA||'local',cacheVersion:'hobby-feed.v2'});
      const hit=cache.get(key,+now);
      if(hit){response.setHeader('X-Feed-Cache','HIT');return send(hit,request.headers?.['if-none-match']===hit.etag?304:200);}
      if(!resolved){t=performance.now();resolved=d.resolveUserFollowFixtures({events:[...d.contextualEvents,...selectedFixtureEvents(userState)],userState,participantId:athletesOnly?participantId:null,copyEvents:false});mark('resolve',performance.now()-t);}
      const participants=new Map(d.canonicalSportContext.participants.map(p=>[p.id,p]));
      resolved.participants.forEach(p=>participants.set(p.id,{...participants.get(p.id),...p}));
      const events=d.overlaySnapshots(resolved.events,snapshot?.sources,{now,stale:!snapshot||snapshot.stale===true}).map(require('../lib/reviewed-au-viewing').reviewedAuViewing);
      const feed=d.buildServerFeed({matchCentreOnly,athletesOnly,participantId,events,userId:user.id,userState,participants:[...participants.values()],sourceVersion:snapshot?`${d.eventFeed.version}:${snapshot.revision}`:d.eventFeed.version,sourcePublishedAt:d.eventFeed.publishedAt,cursor,limit,now,onTiming:mark,copyEvents:false});
      if(matchCentreOnly)feed.membershipStale=!snapshot||snapshot.stale===true;
      feed.fixtureSnapshotStale=!snapshot||snapshot.stale===true;
      if(athletesOnly&&cursor===0)feed.athletes=require('../lib/athletes').projection({participants:[...participants.values()],preferences:userState.preferences,events});
      t=performance.now();const body=JSON.stringify(feed);mark('serialize',performance.now()-t);
      const entry={body,etag:`"${digest([key,feed.generatedAt]).slice(0,24)}"`,expiresAt:expiry(events,now,d)};
      cache.set(key,entry);response.setHeader('X-Feed-Cache','MISS');
      if(process.env.VERCEL)console.log(JSON.stringify({event:'feed_timing',phases:timings,cards:feed.events.length,bytes:Buffer.byteLength(body)}));
      return send(entry,200);
    }catch(error){
      const outgoing=(authDependencies||require('../lib/supabase-server')).publicError(error);
      response.status(outgoing.status).json(outgoing.body);
    }
  };
}
module.exports=createFeedHandler();
module.exports.createFeedHandler=createFeedHandler;
module.exports.expiry=expiry;

// Isolated, nonce-protected transport proof; never merge this diagnostic block.
{
const originalFeed=module.exports;
const fs=require('node:fs'),crypto=require('node:crypto');
const transportProbe=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 const nonce=String(req.headers.authorization||'').replace(/^Bearer /,'');
 if(req.method!=='POST'||crypto.createHash('sha256').update(nonce).digest('hex')!=='db54347c14515ee73cc69428b9d8047114c7efc6aeb72500420ffb7ad57ee6d9'){res.statusCode=404;return res.end();}
 const output='/tmp/fixture-transport-proof.json';
 try{const proof=await require('../lib/fixture-transport-preflight').run({scope:require('../lib/fixture-transport-public-scope.json'),output});res.statusCode=200;res.end(JSON.stringify(proof));}
 catch(_){res.statusCode=503;res.end(fs.existsSync(output)?fs.readFileSync(output):JSON.stringify({passed:false,diagnosticOnly:true}));}
};
module.exports=async(req,res)=>{
 if(new URL(req.url,'https://preflight.invalid').searchParams.get('transportProbe')==='1')return transportProbe(req,res);
 return originalFeed(req,res);
};
module.exports.createFeedHandler=originalFeed.createFeedHandler;
}

"use strict";
const crypto=require("node:crypto");
const {readLiveSnapshots,refreshDueSources,overlaySnapshots,contentHash}=require("./live-fixtures");
const identity=require('../config/fixture-identity');
function authorized(request,environment){
  const expected=environment.FIXTURE_REFRESH_SECRET;
  const actual=String(request.headers?.authorization||"").replace(/^Bearer\s+/i,"");
  return typeof expected==="string"&&expected.length>=32&&crypto.timingSafeEqual(crypto.createHash("sha256").update(expected).digest(),crypto.createHash("sha256").update(actual).digest());
}
function createLiveFixtureHandler({read=readLiveSnapshots,refresh=refreshDueSources,sources,publishedFixtures=()=>require('../data/follow-sources/coverage.v1.json').events,environment=process.env}={}){
  const library=publishedFixtures(),libraryRevision=contentHash(library);
  return async function handler(request,response){
    response.setHeader("Cache-Control","no-store");
    const url=new URL(request.url||"/api/fixtures","https://nothingsport.local");
    const refreshRoute=url.pathname==="/api/fixture-refresh"||url.searchParams.get("route")==="fixture-refresh"||request.query?.route==="fixture-refresh";
    if(refreshRoute){
      if(request.method!=="POST"){response.setHeader("Allow","POST");response.status(405).json({error:"POST required"});return;}
      if(!authorized(request,environment)){response.status(401).json({error:"Unauthorised"});return;}
      try{
        // Production OIDC is request-scoped, not a long-lived environment key.
        const sourceList=sources?sources(request):require('./live-source-adapters').liveSources(globalThis.fetch,{environment:{...environment,VERCEL_OIDC_TOKEN:request.headers?.['x-vercel-oidc-token']||environment.VERCEL_OIDC_TOKEN}});
        const result=await refresh({sources:sourceList});response.status(result.failed.length?207:200).json(result);
      }
      catch(error){response.status(503).json({error:"Fixture refresh unavailable; last good fixtures retained"});}return;
    }
    if((request.method||"GET")!=="GET"){response.setHeader("Allow","GET");response.status(405).json({error:"GET required"});return;}
    try{
      const requestedIds=url.searchParams.has('ids')?url.searchParams.get('ids').split(',').filter(Boolean):null;
      if(requestedIds && (requestedIds.length>60 || requestedIds.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))){response.status(400).json({error:'Invalid fixture selection'});return;}
      const scope=requestedIds?[...new Set(requestedIds)].sort().join(','):'';
      const snapshot=await read(),revision=crypto.createHash('sha256').update(`${snapshot.revision}:${libraryRevision}:${scope}`).digest('hex'),athlete=url.searchParams.get('athlete'),etag=`"fixtures:${revision}${athlete?':'+crypto.createHash('sha256').update(athlete).digest('hex').slice(0,12):''}"`;
      response.setHeader("ETag",etag);
      if(!snapshot.stale&&(request.headers?.["if-none-match"]===etag||url.searchParams.get("revision")===revision)){response.status(304).end();return;}
      const merged=overlaySnapshots([],[{source_id:'published-coverage',fixtures:library},...snapshot.sources]);
      if(athlete){
        if(!/^[a-z0-9:_-]{1,200}$/i.test(athlete)){response.status(400).json({error:'Invalid athlete identity'});return;}
        response.status(200).json({schemaVersion:'athlete-participation-live.v1',revision,stale:snapshot.stale,history:require('./athlete-participation').participationHistory(merged,athlete)});return;
      }
      // Publish one current copy per fixture, not every overlapping discovery
      // partition. Season history remains in the service-owned source store.
      const selected=requestedIds && new Set(requestedIds);
      const fixtures=merged.filter(event=>identity.retainedInActiveTimeline(event) && (!selected || [event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].some(id=>selected.has(id))));
      response.status(200).json({schemaVersion:"live-fixtures.v1",revision,stale:snapshot.stale,sources:[{source_id:'current-fixtures',revision,fixtures},...snapshot.sources.map(({fixtures,...source})=>({...source,fixtures:[]}))]});
    }catch(error){response.status(503).json({error:"Live fixtures unavailable; keep the published schedule"});}
  };
}
module.exports={createLiveFixtureHandler,authorized};

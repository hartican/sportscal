'use strict';
const crypto=require('node:crypto'),contract=require('../config/fixture-highlights');
const {supabaseServiceRequest}=require('./supabase-server'),{createLookupState}=require('./highlight-lookup-state');
const selection=require('./highlight-selection'),{providerQuery}=require('./highlight-provider-query');
const TABLE='nothingsports_youtube_selections',MAX_BODY=256*1024,SELECTION_CACHE_MS=3600000;
const failure=(code,status=null)=>Object.assign(Error('highlights_unavailable'),{code,status});
const logDiagnostic=entry=>console.warn('Highlights lookup failed',JSON.stringify(entry));
const videoUrl=id=>/^[\w-]{11}$/.test(id||'')?'https://www.youtube.com/watch?v='+id:null;
const cachedVideoUrl=(row,now)=>row&&contract.fresh(row.selected_at,now)&&contract.recentUpload(row.published_at,now)&&selection.suitableDuration(row.duration_seconds)?videoUrl(row.video_id):null;
async function resultBodyText(response){
  if(!response.ok)throw failure('provider_http',response.status);
  if(!response.body?.getReader){const body=await response.text();if(Buffer.byteLength(body)>MAX_BODY)throw Error('youtube_unavailable');return body;}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BODY)throw Error('youtube_unavailable');parts.push(Buffer.from(part.value));}return Buffer.concat(parts).toString('utf8');}finally{await reader.cancel().catch(()=>{});}
}
async function resultBody(response){return JSON.parse(await resultBodyText(response));}
function createTopResultResolver({request=supabaseServiceRequest,fetchImpl=globalThis.fetch,environment=process.env,diagnose=logDiagnostic,discoverOfficial=selection.officialCandidates,discoverUploads=require('./highlight-official-uploads').officialUploads,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
  const apiKey=typeof environment.YOUTUBE_DATA_API_KEY==='string'?environment.YOUTUBE_DATA_API_KEY.trim():'';
  const inFlight=new Map();
  const lookups=createLookupState({request,environment});
  async function resolve(event,now=new Date(),{deadline=Date.now()+20000}={}){
    const query=contract.searchQuery(event,now),known=contract.valid(event.highlights,now)?event.highlights.videoId:null,id=event.canonicalEventId||event.eventId||event.id;
    if(!query&&!known||query?.length>1500||!/^[-a-z0-9_:]{1,200}$/i.test(id||''))throw Error('highlights_unavailable');
    const context=[event.date,event.endDate,event.eventType,event.matchType,event.roundLabel||event.round,event.stage,event.tournamentId,event.actualStartTimeUtc||event.startTimeUtc,event.codeId,event.key,event.competitionId,event.season,event.seasonLabel,event.gender,(event.participants||[]).map(p=>[p.id,p.displayName||p.name||p.label])];
    const digest=crypto.createHash('sha256').update(selection.POLICY+'\n'+(query||'direct:'+known)+'\n'+JSON.stringify(context)).digest('hex'),key=id+'/'+digest;
    if(inFlight.has(key))return inFlight.get(key);
    if(inFlight.size>=64)throw Error('highlights_unavailable');
    let stage='cache-read',safeRetained=null,owner=null,owned=false,invalidVideoId=null;
    const work=(async()=>{
      const timeout=()=>{const remaining=deadline-Date.now();if(remaining<250)throw Error('highlights_unavailable');return Math.min(3000,remaining);};
      const fixturePath='/rest/v1/'+TABLE+'?fixture_id=eq.'+encodeURIComponent(id),cachePath=fixturePath+'&query_hash=eq.'+digest;
      const receiptFilters='&selected_at=gte.'+encodeURIComponent(new Date(+now-contract.MAX_CACHE_AGE_MS).toISOString())+'&published_at=gte.'+encodeURIComponent(new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString());
      const readPath=cachePath+receiptFilters+'&select=video_id,selected_at,published_at,duration_seconds&limit=1';
      let cached=await request(readPath,{environment,timeoutMs:timeout()});
      const cachedUrl=cachedVideoUrl(cached?.[0],now);
      let retained=cachedUrl?{url:cachedUrl,selection:'youtube-top-result',cached:true}:null;
      safeRetained=retained;
      if(retained&&+now-Date.parse(cached[0].selected_at)<SELECTION_CACHE_MS)return retained;
      if(!apiKey){if(retained)return retained;throw failure('missing_key');}
      stage='lookup-claim';owner=lookups.owner(id,digest);
      let claim=await owner.claim(timeout());
      const refreshShared=async()=>{
        cached=await request(readPath,{environment,timeoutMs:timeout()});
        const url=cachedVideoUrl(cached?.[0],now);
        retained=safeRetained=url?{url,selection:'youtube-top-result',cached:true}:null;
        return retained&&+now-Date.parse(cached[0].selected_at)<SELECTION_CACHE_MS;
      };
      for(const wait of [100,400,1200,2400]){
        if(claim?.state!=='busy'||deadline-Date.now()<wait+3000)break;
        await pause(wait);
        if(await refreshShared())return retained;
        claim=await owner.claim(timeout());
      }
      if(claim?.state!=='claimed'){if(retained){await refreshShared();if(retained)return retained;}throw failure(claim?.state==='cooldown'?'lookup_cooldown':'lookup_busy');}
      owned=true;
      const save=async chosen=>{
        const selected=chosen.item.id,url=videoUrl(selected);
        if(deadline-Date.now()>=250){const saved=await owner.finish('selected',{fixture_id:id,query_hash:digest,video_id:selected,selected_at:now.toISOString(),published_at:chosen.item.snippet.publishedAt,duration_seconds:chosen.seconds},null,timeout()).catch(()=>null);if(saved?.applied)owned=false;}
        return {url,selection:'youtube-top-result',cached:false};
      };
      const checkedIds=new Set(),byId=new Map();
      const check=async candidates=>{
        const missing=candidates.filter(id=>!checkedIds.has(id));
        if(missing.length){
        stage='metadata-reservation';
        const ordinary=await owner.reserve('ordinary',timeout());
        if(!ordinary?.granted)throw failure('quota_denied');
        const params=new URLSearchParams({part:'snippet,status,contentDetails',id:missing.join(','),key:apiKey,fields:'items(id,snippet(channelId,title,description,publishedAt,defaultAudioLanguage,defaultLanguage,liveBroadcastContent),status(privacyStatus,uploadStatus),contentDetails(duration,regionRestriction,contentRating))'});
        stage='metadata-request';
        const remaining=deadline-Date.now();if(remaining<=0)throw Error('highlights_unavailable');
        const metadata=await fetchImpl('https://www.googleapis.com/youtube/v3/videos?'+params,{signal:AbortSignal.timeout(Math.min(12000,remaining)),headers:{Accept:'application/json'}});
        stage='metadata-response';
        const details=await resultBody(metadata);
        for(const item of details.items||[])if(missing.includes(item.id))byId.set(item.id,item);
        missing.forEach(id=>checkedIds.add(id));
        }
        const retainedId=cached?.[0]?.video_id;
        if(retained&&checkedIds.has(retainedId)&&!selection.select(byId.has(retainedId)?[byId.get(retainedId)]:[],event,now)){
          // A successful current check outweighs last-good fallback. Bind the
          // withdrawal to this video so a concurrently saved replacement stays.
          retained=safeRetained=null;
          invalidVideoId=retainedId;
          if(deadline-Date.now()>=250)await owner.withdraw(retainedId,timeout());
        }
        return selection.select(candidates.flatMap(id=>byId.has(id)?[byId.get(id)]:[]),event,now);
      };
      // Channel feeds expose new official uploads without waiting for the
      // search index. A bounded metadata batch checks their actual duration,
      // upload time, language and availability before any redirect.
      stage='official-uploads';
      // A changed context/policy may strand a valid selection under its old
      // hash. One same-fixture row is only a metadata candidate, never fallback
      // authority. Parallel lookup shares the existing feed/deadline window.
      const [official,priorRows]=await Promise.all([
        query?discoverOfficial(event,now,{fetchImpl,signal:AbortSignal.timeout(Math.min(3000,Math.max(1,deadline-Date.now())))}):[],
        query&&!retained&&event.highlights!==null?Promise.resolve().then(()=>request(fixturePath+'&query_hash=neq.'+digest+receiptFilters+'&select=fixture_id,query_hash,video_id,selected_at,published_at,duration_seconds&order=selected_at.desc&limit=1',{environment,timeoutMs:timeout()})).catch(()=>[]):[]
      ]);
      const prior=priorRows?.[0],priorId=prior?.fixture_id===id&&/^[a-f0-9]{64}$/.test(prior.query_hash||'')&&prior.query_hash!==digest&&cachedVideoUrl(prior,now)?prior.video_id:null;
      const retainedId=retained?cached?.[0]?.video_id:null;
      const ids=[...new Set([...(known?[known]:[]),...official.map(v=>v.videoId),...(priorId?[priorId]:[]),...(retainedId?[retainedId]:[])])];
      if(ids.length){const chosen=await check(ids);if(chosen&&(chosen.score<2||!query||chosen.item.id===priorId||chosen.item.id===retainedId))return save(chosen);}
      // Historical direct records can be checked, but cannot create a new
      // general search outside the existing recent-Feed admission boundary.
      if(!query)throw failure('invalid_result');
      stage='official-playlists';
      const uploads=await discoverUploads(event,now,{fetchImpl,apiKey,deadline,readBody:resultBody,reserve:bucket=>owner.reserve(bucket,timeout())});
      const uploadIds=[...new Set(uploads.map(v=>v.videoId))].filter(id=>!ids.includes(id));
      if(uploadIds.length){const chosen=await check(uploadIds);if(chosen&&chosen.score<2)return save(chosen);}
      stage='quota-reservation';
      const reservation=await owner.reserve('search',timeout());
      if(!reservation?.granted){if(retained)return retained;throw failure('quota_denied');}
      // The reservation is durable before dispatch. Errors and aborted calls
      // remain counted; selected uploads are not certified match highlights.
      const params=new URLSearchParams({part:'snippet',type:'video',order:'relevance',maxResults:'25',regionCode:'AU',relevanceLanguage:'en',publishedAfter:new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString(),publishedBefore:now.toISOString(),safeSearch:'moderate',q:providerQuery(event,query),key:apiKey,fields:'items(id/videoId,snippet/publishedAt)'});
      const remaining=deadline-Date.now();if(remaining<=0)throw Error('highlights_unavailable');
      const signal=AbortSignal.timeout(Math.min(12000,remaining));
      stage='provider-request';
      const response=await fetchImpl('https://www.googleapis.com/youtube/v3/search?'+params,{signal,headers:{Accept:'application/json'}});
      stage='provider-response';
      const data=await resultBody(response);
      const candidates=[...new Set((data.items||[]).slice(0,25).filter(item=>videoUrl(item.id?.videoId)&&contract.recentUpload(item.snippet?.publishedAt,now)).map(item=>item.id.videoId))];
      if(!candidates.length)throw failure(data.items?.length?'invalid_result':'no_results');
      const chosen=await check(candidates);
      if(!chosen)throw failure('invalid_result');
      return save(chosen);
    })();
    inFlight.set(key,work);
    try{return await work;}catch(error){
      if(owned&&deadline-Date.now()>=250){const outcome=['no_results','invalid_result','provider_http','quota_denied'].includes(error.code)?error.code:['AbortError','TimeoutError'].includes(error.name)?'deadline':'lookup_failed';await owner.finish(outcome,null,invalidVideoId,Math.min(3000,deadline-Date.now())).catch(()=>{});owned=false;}
      // Fixed categories only: never log a fixture, query, URL, key or payload.
      try{diagnose({stage,code:['missing_key','quota_denied','provider_http','invalid_result','no_results','lookup_busy','lookup_cooldown'].includes(error.code)?error.code:['AbortError','TimeoutError'].includes(error.name)?'deadline':'lookup_failed',providerStatus:error.code==='provider_http'&&Number.isInteger(error.status)?error.status:null});}catch{}
      if(safeRetained)return safeRetained;
      throw error;
    }finally{if(owned&&deadline-Date.now()>=250)await owner.finish('lookup_failed',null,invalidVideoId,Math.min(3000,deadline-Date.now())).catch(()=>{});if(inFlight.get(key)===work)inFlight.delete(key);}
  }
  return {resolve};
}
function unavailable(response,status=503,{fixtureId,reason}={}){
  response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  const pending=reason==='fixture-update',known=/^[-a-z0-9_:]{1,200}$/i.test(fixtureId||'');
  const heading=pending?'Waiting for a fixture update':'Highlights unavailable right now';
  const detail=pending?'Nothing Sport has not received confirmed completion for this fixture. Highlights cannot be checked yet.':'Nothing Sport could not find or check suitable recent highlights for this fixture. Please try again later.';
  const back=known?'/?event='+encodeURIComponent(fixtureId):'/';
  response.status(status).end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+heading+'</title><style>body{font:18px system-ui;max-width:32rem;margin:15vh auto;padding:24px}a{display:inline-block;padding:16px 0}</style><h1>'+heading+'</h1><p>'+detail+'</p><a href="'+back+'">'+(known?'Back to fixture':'Back to Nothing Sport')+'</a></html>');
}
module.exports={TABLE,MAX_BODY,SELECTION_CACHE_MS,videoUrl,resultBody,createTopResultResolver,unavailable};

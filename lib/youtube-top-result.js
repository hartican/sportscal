'use strict';
const crypto=require('node:crypto'),contract=require('../config/fixture-highlights');
const {supabaseServiceRequest}=require('./supabase-server'),{reserveApiQuota}=require('./youtube-api-budget');
const selection=require('./highlight-selection');
const TABLE='nothingsports_youtube_selections',MAX_BODY=256*1024,SELECTION_CACHE_MS=3600000;
const failure=(code,status=null)=>Object.assign(Error('highlights_unavailable'),{code,status});
const logDiagnostic=entry=>console.warn('Highlights lookup failed',JSON.stringify(entry));
const videoUrl=id=>/^[\w-]{11}$/.test(id||'')?'https://www.youtube.com/watch?v='+id:null;
async function resultBodyText(response){
  if(!response.ok)throw failure('provider_http',response.status);
  if(!response.body?.getReader){const body=await response.text();if(Buffer.byteLength(body)>MAX_BODY)throw Error('youtube_unavailable');return body;}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BODY)throw Error('youtube_unavailable');parts.push(Buffer.from(part.value));}return Buffer.concat(parts).toString('utf8');}finally{await reader.cancel().catch(()=>{});}
}
async function resultBody(response){return JSON.parse(await resultBodyText(response));}
function createTopResultResolver({request=supabaseServiceRequest,fetchImpl=globalThis.fetch,environment=process.env,diagnose=logDiagnostic,discoverOfficial=selection.officialCandidates}={}){
  const apiKey=typeof environment.YOUTUBE_DATA_API_KEY==='string'?environment.YOUTUBE_DATA_API_KEY.trim():'';
  const inFlight=new Map();
  async function resolve(event,now=new Date(),{deadline=Date.now()+20000}={}){
    const query=contract.searchQuery(event,now),id=event.canonicalEventId||event.eventId||event.id;
    if(!query||query.length>1500||!/^[-a-z0-9_:]{1,200}$/i.test(id||''))throw Error('highlights_unavailable');
    const context=[event.date,event.eventType,event.matchType,event.roundLabel||event.round,event.stage,event.tournamentId,event.actualStartTimeUtc||event.startTimeUtc];
    const digest=crypto.createHash('sha256').update(selection.POLICY+'\n'+query+'\n'+JSON.stringify(context)).digest('hex'),key=id+'/'+digest;
    if(inFlight.has(key))return inFlight.get(key);
    if(inFlight.size>=64)throw Error('highlights_unavailable');
    let stage='cache-read',safeRetained=null;
    const work=(async()=>{
      const timeout=()=>{const remaining=deadline-Date.now();if(remaining<250)throw Error('highlights_unavailable');return Math.min(3000,remaining);};
      const readPath='/rest/v1/'+TABLE+'?fixture_id=eq.'+encodeURIComponent(id)+'&query_hash=eq.'+digest+'&selected_at=gte.'+encodeURIComponent(new Date(+now-contract.MAX_CACHE_AGE_MS).toISOString())+'&published_at=gte.'+encodeURIComponent(new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString())+'&select=video_id,selected_at,published_at,duration_seconds&limit=1';
      const cached=await request(readPath,{environment,timeoutMs:timeout()});
      const retained=cached?.[0]&&contract.fresh(cached[0].selected_at,now)&&contract.recentUpload(cached[0].published_at,now)&&selection.suitableDuration(cached[0].duration_seconds)&&videoUrl(cached[0].video_id)?{url:videoUrl(cached[0].video_id),selection:'youtube-top-result',cached:true}:null;
      safeRetained=retained;
      if(retained&&+now-Date.parse(cached[0].selected_at)<SELECTION_CACHE_MS)return retained;
      if(!apiKey){if(retained)return retained;throw failure('missing_key');}
      const save=async chosen=>{
        const selected=chosen.item.id,url=videoUrl(selected);
        if(deadline-Date.now()>=250)await request('/rest/v1/'+TABLE,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{fixture_id:id,query_hash:digest,video_id:selected,selected_at:now.toISOString(),published_at:chosen.item.snippet.publishedAt,duration_seconds:chosen.seconds},environment,timeoutMs:timeout()}).catch(()=>{});
        return {url,selection:'youtube-top-result',cached:false};
      };
      const check=async candidates=>{
        stage='metadata-reservation';
        const ordinary=await reserveApiQuota('ordinary',{request,environment,timeoutMs:timeout()});
        if(!ordinary?.granted)throw failure('quota_denied');
        const params=new URLSearchParams({part:'snippet,status,contentDetails',id:candidates.join(','),key:apiKey,fields:'items(id,snippet(channelId,title,description,publishedAt,defaultAudioLanguage,defaultLanguage,liveBroadcastContent),status(privacyStatus,uploadStatus),contentDetails(duration,regionRestriction,contentRating))'});
        stage='metadata-request';
        const remaining=deadline-Date.now();if(remaining<=0)throw Error('highlights_unavailable');
        const metadata=await fetchImpl('https://www.googleapis.com/youtube/v3/videos?'+params,{signal:AbortSignal.timeout(Math.min(12000,remaining)),headers:{Accept:'application/json'}});
        stage='metadata-response';
        const details=await resultBody(metadata),byId=new Map((details.items||[]).filter(item=>candidates.includes(item.id)).map(item=>[item.id,item]));
        return selection.select(candidates.flatMap(id=>byId.has(id)?[byId.get(id)]:[]),event,now);
      };
      // Channel feeds expose new official uploads without waiting for the
      // search index. A bounded metadata batch checks their actual duration,
      // upload time, language and availability before any redirect.
      stage='official-uploads';
      const official=await discoverOfficial(event,now,{fetchImpl,signal:AbortSignal.timeout(Math.min(3000,Math.max(1,deadline-Date.now())))});
      if(official.length){const chosen=await check([...new Set(official.map(v=>v.videoId))]);if(chosen&&chosen.score<2)return save(chosen);}
      stage='quota-reservation';
      const reservation=await reserveApiQuota('search',{request,environment,timeoutMs:timeout()});
      if(!reservation?.granted){if(retained)return retained;throw failure('quota_denied');}
      // The reservation is durable before dispatch. Errors and aborted calls
      // remain counted; selected uploads are not certified match highlights.
      const params=new URLSearchParams({part:'snippet',type:'video',order:'relevance',maxResults:'25',regionCode:'AU',relevanceLanguage:'en',publishedAfter:new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString(),publishedBefore:now.toISOString(),safeSearch:'moderate',q:query,key:apiKey,fields:'items(id/videoId,snippet/publishedAt)'});
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
      // Fixed categories only: never log a fixture, query, URL, key or payload.
      try{diagnose({stage,code:['missing_key','quota_denied','provider_http','invalid_result','no_results'].includes(error.code)?error.code:['AbortError','TimeoutError'].includes(error.name)?'deadline':'lookup_failed',providerStatus:error.code==='provider_http'&&Number.isInteger(error.status)?error.status:null});}catch{}
      if(safeRetained)return safeRetained;
      throw error;
    }finally{if(inFlight.get(key)===work)inFlight.delete(key);}
  }
  return {resolve};
}
function unavailable(response,status=503){
  response.setHeader('Cache-Control','no-store');response.setHeader('Content-Type','text/html; charset=utf-8');
  response.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  response.status(status).end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Highlights unavailable</title><style>body{font:18px system-ui;max-width:32rem;margin:15vh auto;padding:24px}a{display:inline-block;padding:16px 0}</style><h1>Highlights unavailable right now</h1><p>Try again later.</p><a href="/">Back to Nothing Sport</a></html>');
}
module.exports={TABLE,MAX_BODY,SELECTION_CACHE_MS,videoUrl,resultBody,createTopResultResolver,unavailable};

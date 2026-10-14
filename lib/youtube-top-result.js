'use strict';
const crypto=require('node:crypto'),contract=require('../config/fixture-highlights');
const {supabaseServiceRequest}=require('./supabase-server'),{reserveApiQuota}=require('./youtube-api-budget');
const TABLE='nothingsports_youtube_selections',MAX_BODY=32768,SELECTION_CACHE_MS=24*3600000;
const failure=(code,status=null)=>Object.assign(Error('highlights_unavailable'),{code,status});
const logDiagnostic=entry=>console.warn('Highlights lookup failed',JSON.stringify(entry));
const videoUrl=id=>/^[\w-]{11}$/.test(id||'')?'https://www.youtube.com/watch?v='+id:null;
async function resultBody(response){
  if(!response.ok)throw failure('provider_http',response.status);
  if(!response.body?.getReader){const body=await response.text();if(Buffer.byteLength(body)>MAX_BODY)throw Error('youtube_unavailable');return JSON.parse(body);}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BODY)throw Error('youtube_unavailable');parts.push(Buffer.from(part.value));}return JSON.parse(Buffer.concat(parts).toString('utf8'));}finally{await reader.cancel().catch(()=>{});}
}
function createTopResultResolver({request=supabaseServiceRequest,fetchImpl=globalThis.fetch,environment=process.env,diagnose=logDiagnostic}={}){
  const apiKey=typeof environment.YOUTUBE_DATA_API_KEY==='string'?environment.YOUTUBE_DATA_API_KEY.trim():'';
  const inFlight=new Map();
  async function resolve(event,now=new Date(),{deadline=Date.now()+20000}={}){
    const query=contract.searchQuery(event,now),id=event.canonicalEventId||event.eventId||event.id;
    if(!query||query.length>1500||!/^[-a-z0-9_:]{1,200}$/i.test(id||''))throw Error('highlights_unavailable');
    const digest=crypto.createHash('sha256').update(query).digest('hex'),key=id+'/'+digest;
    if(inFlight.has(key))return inFlight.get(key);
    if(inFlight.size>=64)throw Error('highlights_unavailable');
    let stage='cache-read';
    const work=(async()=>{
      const timeout=()=>{const remaining=deadline-Date.now();if(remaining<250)throw Error('highlights_unavailable');return Math.min(3000,remaining);};
      const readPath='/rest/v1/'+TABLE+'?fixture_id=eq.'+encodeURIComponent(id)+'&query_hash=eq.'+digest+'&selected_at=gte.'+encodeURIComponent(new Date(+now-contract.MAX_CACHE_AGE_MS).toISOString())+'&select=video_id,selected_at&limit=1';
      const cached=await request(readPath,{environment,timeoutMs:timeout()});
      const retained=cached?.[0]&&contract.fresh(cached[0].selected_at,now)&&videoUrl(cached[0].video_id)?{url:videoUrl(cached[0].video_id),selection:'youtube-top-result',cached:true}:null;
      if(retained&&+now-Date.parse(cached[0].selected_at)<SELECTION_CACHE_MS)return retained;
      if(!apiKey){if(retained)return retained;throw failure('missing_key');}
      stage='quota-reservation';
      const reservation=await reserveApiQuota('search',{request,environment,timeoutMs:timeout()});
      if(!reservation?.granted){if(retained)return retained;throw failure('quota_denied');}
      // The reservation is durable before dispatch. Errors and aborted calls
      // remain counted; selected uploads are not certified match highlights.
      const params=new URLSearchParams({part:'snippet',type:'video',order:'relevance',maxResults:'1',regionCode:'AU',safeSearch:'moderate',q:query,key:apiKey});
      const remaining=deadline-Date.now();if(remaining<=0)throw Error('highlights_unavailable');
      const signal=AbortSignal.timeout(Math.min(12000,remaining));
      stage='provider-request';
      const response=await fetchImpl('https://www.googleapis.com/youtube/v3/search?'+params,{signal,headers:{Accept:'application/json'}});
      stage='provider-response';
      const data=await resultBody(response);
      const selected=data.items?.[0]?.id?.videoId,url=videoUrl(selected);
      if(!url)throw failure(data.items?.length?'invalid_result':'no_results');
      if(deadline-Date.now()>=250)await request('/rest/v1/'+TABLE,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:{fixture_id:id,query_hash:digest,video_id:selected,selected_at:now.toISOString()},environment,timeoutMs:timeout()}).catch(()=>{});
      return {url,selection:'youtube-top-result',cached:false};
    })();
    inFlight.set(key,work);
    try{return await work;}catch(error){
      // Fixed categories only: never log a fixture, query, URL, key or payload.
      try{diagnose({stage,code:['missing_key','quota_denied','provider_http','invalid_result','no_results'].includes(error.code)?error.code:['AbortError','TimeoutError'].includes(error.name)?'deadline':'lookup_failed',providerStatus:error.code==='provider_http'&&Number.isInteger(error.status)?error.status:null});}catch{}
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

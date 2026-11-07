'use strict';
const registry=require('./highlight-channels'),selection=require('./highlight-selection');
async function officialUploads(event,now,{fetchImpl,apiKey,reserve,readBody,deadline}){
  const results=await Promise.allSettled(registry.channelsFor(event).slice(0,4).map(async channel=>{
    const grant=await reserve('ordinary');if(!grant?.granted)throw Object.assign(Error('highlights_unavailable'),{code:'quota_denied'});
    const remaining=deadline-Date.now();if(remaining<250)throw Error('highlights_unavailable');
    const params=new URLSearchParams({part:'snippet,contentDetails',playlistId:'UU'+channel.id.slice(2),maxResults:'50',key:apiKey,fields:'items(snippet(channelId,title,description,publishedAt,resourceId/videoId),contentDetails(videoId,videoPublishedAt))'});
    const data=await readBody(await fetchImpl('https://www.googleapis.com/youtube/v3/playlistItems?'+params,{signal:AbortSignal.timeout(Math.min(3000,remaining)),headers:{Accept:'application/json'}}));
    return (data.items||[]).slice(0,50).map(item=>({videoId:item.contentDetails?.videoId||item.snippet?.resourceId?.videoId,channelId:item.snippet?.channelId,title:item.snippet?.title,description:item.snippet?.description,publishedAt:item.contentDetails?.videoPublishedAt||item.snippet?.publishedAt})).filter(video=>video.channelId===channel.id&&/^[\w-]{11}$/.test(video.videoId||'')&&selection.score(video,event,now)<2);
  }));
  const denied=results.find(r=>r.status==='rejected'&&r.reason?.code==='quota_denied');if(denied)throw denied.reason;
  return results.flatMap(r=>r.status==='fulfilled'?r.value:[]).sort((a,b)=>selection.score(a,event,now)-selection.score(b,event,now)).slice(0,24);
}
module.exports={officialUploads};

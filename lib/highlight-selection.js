'use strict';
const contract=require('../config/fixture-highlights'),tennis=require('./fixture-highlights');
const context=require('./highlight-context'),registry=require('./highlight-channels');
const POLICY='all-sport-recent-highlights.v2',MAX_DURATION_SECONDS=20*60;
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const highlightTitle=value=>/\b(highlights?|recap|best (?:\w+ )?moments|top \d{1,2} (?:\w+ ){0,2}moments|race in \d+ (?:minutes|mins))\b/.test(normal(value))&&!/\b(full (?:match|race|event|coverage|replay)|live (?:stream|coverage)|livestream|watch live|podcast|interview|press conference|gameplay|simulation|simulated|efootball|pes|ea ?fc\s*\d*|ea sports fc|fifa ?2\d|nba ?2k\d*|football manager)\b/.test(normal(value));
function durationSeconds(value){const m=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):NaN;}
function suitableDuration(seconds){return Number.isFinite(seconds)&&seconds>0&&seconds<=MAX_DURATION_SECONDS;}
function english(snippet){const language=snippet?.defaultAudioLanguage||snippet?.defaultLanguage;return !language||/^en(?:-|$)/i.test(language);}
function contextMatches(video,event,now){
  if(!contract.recentUpload(video.publishedAt,now)||!highlightTitle(video.title))return false;
  const title=normal(video.title);
  const day=require('../config/epic-classics').finalDay({...event,status:'completed'},new Date(now));
  const year=String(event.date||event.startTimeUtc||day||'').slice(0,4),years=title.match(/\b20\d\d\b/g)||[],allowedYears=new Set([year]);
  const seasonContext=[event.competitionId,event.season,event.seasonLabel,event.tournamentId].join(' ').replace(/[–—]/g,'-'),videoTitle=String(video.title||'').replace(/[–—]/g,'-'),knownSeasons=new Set();
  for(const match of seasonContext.matchAll(/\b(20\d{2})[-/](20\d{2}|\d{2})\b/g)){
    const end=match[2].length===2?'20'+match[2]:match[2];
    if(+end===+match[1]+1)knownSeasons.add(match[1]+'/'+end);
    if((match[1]===year||end===year)&&new RegExp('\\b'+match[1]+'[-/](?:'+end+'|'+end.slice(2)+')\\b').test(videoTitle)){allowedYears.add(match[1]);allowedYears.add(end);}
  }
  for(const match of videoTitle.matchAll(/\b(20\d{2}|\d{2})[-/](20\d{2}|\d{2})\b/g)){
    const start=match[1].length===2?'20'+match[1]:match[1],end=match[2].length===2?'20'+match[2]:match[2];
    // Short consecutive years above12 cannot be a month/day date. Compare
    // them with the sourced season rather than treating25/26 as undated.
    if(+end===+start+1&&(match[1].length===4||+match[1]>12)&&knownSeasons.size&&!knownSeasons.has(start+'/'+end))return false;
  }
  if(years.some(value=>!allowedYears.has(value)))return false;
  const start=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');
  if(Number.isFinite(start)&&Date.parse(video.publishedAt)<start)return false;
  if(contract.tennisEligible(event)){
    return tennis.suitable(video,event,now,{allowUnreviewedPublisher:true});
  }
  return context.matches(event,video);
}
function score(video,event,now){
  if(!contextMatches(video,event,now))return Infinity;
  if(contract.tennisEligible(event)&&tennis.suitable(video,event,now))return tennis.compilation(video)?1:0;
  if(registry.channelsFor(event).some(channel=>channel.id===video.channelId))return context.isReel(video.title)?1:0;
  return 2;
}
function select(items,event,now){
  return items.map((item,index)=>({item,index,video:{videoId:item.id,channelId:item.snippet?.channelId,title:item.snippet?.title,description:item.snippet?.description,publishedAt:item.snippet?.publishedAt,url:'https://www.youtube.com/watch?v='+item.id},seconds:durationSeconds(item.contentDetails?.duration)}))
    .filter(row=>/^[\w-]{11}$/.test(row.item.id||'')&&tennis.availableInAu(row.item)&&!['live','upcoming'].includes(row.item.snippet?.liveBroadcastContent)&&english(row.item.snippet)&&suitableDuration(row.seconds))
    .map(row=>({...row,score:score(row.video,event,now)})).filter(row=>Number.isFinite(row.score)).sort((a,b)=>a.score-b.score||a.index-b.index)[0]||null;
}
async function officialCandidates(event,now,{fetchImpl,signal}){
  const channels=registry.channelsFor(event);
  const found=await Promise.allSettled(channels.map(async channel=>{
    const body=await tennis.read('https://www.youtube.com/feeds/videos.xml?channel_id='+channel.id,fetchImpl,signal);
    return tennis.parseFeed(body,channel,now).filter(v=>score(v,event,now)<2);
  }));
  return found.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>score(a,event,now)-score(b,event,now)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,24);
}
module.exports={POLICY,MAX_DURATION_SECONDS,highlightTitle,durationSeconds,suitableDuration,english,contextMatches,score,select,officialCandidates};

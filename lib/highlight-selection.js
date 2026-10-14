'use strict';
const contract=require('../config/fixture-highlights'),tennis=require('./fixture-highlights');
const POLICY='recent-english-highlights.v1',MAX_DURATION_SECONDS=20*60;
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const highlightTitle=value=>/\b(highlights?|recap|best (?:\w+ )?moments|race in \d+ (?:minutes|mins))\b/.test(normal(value))&&!/\b(full (?:match|race|event|coverage|replay)|live (?:stream|coverage)|livestream|watch live|podcast|interview|press conference)\b/.test(normal(value));
function durationSeconds(value){const m=String(value||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):NaN;}
function suitableDuration(seconds){return Number.isFinite(seconds)&&seconds>=60&&seconds<=MAX_DURATION_SECONDS;}
function english(snippet){const language=snippet?.defaultAudioLanguage||snippet?.defaultLanguage;return !language||/^en(?:-|$)/i.test(language);}
function contextMatches(video,event,now){
  if(!contract.recentUpload(video.publishedAt,now)||!highlightTitle(video.title))return false;
  const title=normal(video.title),all=title+' '+normal(video.description);
  const day=require('../config/epic-classics').finalDay({...event,status:'completed'},new Date(now));
  const year=String(event.date||event.startTimeUtc||day||'').slice(0,4),years=title.match(/\b20\d\d\b/g)||[];
  if(years.some(value=>value!==year))return false;
  const start=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');
  if(Number.isFinite(start)&&Date.parse(video.publishedAt)<start)return false;
  if(contract.tennisEligible(event)){
    return tennis.suitable(video,event,now,{allowUnreviewedPublisher:true});
  }
  if((event.key||event.sportKey)==='motogp'){
    if(!/\bmotogp\b/.test(title))return false;
    const fixture=normal(event.name+' '+event.tournamentName),stage=normal(event.stage||event.roundLabel);
    if(/\b(?:indonesia|indonesian|mandalika)\b/.test(fixture)&&!/\b(?:indonesia|indonesian|mandalika)\b/.test(title))return false;
    const supplied=title.match(/\b(sprint|qualifying|practice|warm up)\b/)?.[1];
    if(supplied&&!stage.includes(supplied)||/sprint|qualifying|practice|warm up/.test(stage)&&!title.includes(stage.split(' ')[0]))return false;
  }
  const ignore=new Set(['the','and','vs','v','of','at','in','grand','prix','gp','race','round','match','sport','sports','highlights','motogp','formula','f1','league','championship','championships','cup','world','tour','open','football','basketball','cricket','rugby','2026']);
  const sides=(event.participants||[]).map(p=>normal(p.displayName||p.name||p.label)).filter(Boolean);
  if(sides.length===2&&!sides.every(name=>name.split(' ').some(term=>term.length>2&&!ignore.has(term)&&all.includes(term))))return false;
  const terms=[...new Set(normal(event.name+' '+(event.competitionName||event.tournamentName||'')).split(' ').filter(term=>term.length>2&&!ignore.has(term)&&!/^\d+$/.test(term)))];
  return terms.some(term=>all.includes(term)||term==='indonesia'&&/\bindonesian\b/.test(all));
}
function score(video,event,now){
  if(!contextMatches(video,event,now))return Infinity;
  if(contract.tennisEligible(event)&&tennis.suitable(video,event,now))return tennis.compilation(video)?1:0;
  if((event.key||event.sportKey)==='motogp'&&video.channelId==='UC8pYaQzbBBXg9GIOHRvTmDQ')return 0;
  return 2;
}
function select(items,event,now){
  return items.map((item,index)=>({item,index,video:{videoId:item.id,channelId:item.snippet?.channelId,title:item.snippet?.title,description:item.snippet?.description,publishedAt:item.snippet?.publishedAt,url:'https://www.youtube.com/watch?v='+item.id},seconds:durationSeconds(item.contentDetails?.duration)}))
    .filter(row=>/^[\w-]{11}$/.test(row.item.id||'')&&tennis.availableInAu(row.item)&&row.item.snippet?.liveBroadcastContent!=='live'&&english(row.item.snippet)&&suitableDuration(row.seconds))
    .map(row=>({...row,score:score(row.video,event,now)})).filter(row=>Number.isFinite(row.score)).sort((a,b)=>a.score-b.score||a.index-b.index)[0]||null;
}
async function officialCandidates(event,now,{fetchImpl,signal}){
  const channels=contract.tennisEligible(event)?tennis.channels.filter(c=>!(c.tour==='ATP'&&tennis.draw(event).startsWith('womens')||c.tour==='WTA'&&tennis.draw(event).startsWith('mens'))&&(!c.tournamentPattern||new RegExp(c.tournamentPattern,'i').test(tennis.tournament(event)))):(event.key||event.sportKey)==='motogp'?[{id:'UC8pYaQzbBBXg9GIOHRvTmDQ',handle:'motogp',label:'MotoGP'}]:[];
  const found=await Promise.allSettled(channels.map(async channel=>{
    const body=await tennis.read('https://www.youtube.com/feeds/videos.xml?channel_id='+channel.id,fetchImpl,signal);
    return tennis.parseFeed(body,channel,now).filter(v=>score(v,event,now)<2);
  }));
  return found.flatMap(result=>result.status==='fulfilled'?result.value:[]).sort((a,b)=>score(a,event,now)-score(b,event,now)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,24);
}
module.exports={POLICY,MAX_DURATION_SECONDS,highlightTitle,durationSeconds,suitableDuration,english,contextMatches,score,select,officialCandidates};

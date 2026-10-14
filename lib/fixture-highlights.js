'use strict';
const contract=require('../config/fixture-highlights');
const channels=require('../config/highlight-channels.json').channels;
const SOURCE_ID='discovery-tennis-highlights',INTERVAL_MS=30*60000;
const MAX_VIDEOS=256,MAX_BODY=256*1024;
const {API_LIMITS}=require('./youtube-api-budget'),SEARCH_RETRY_MS=6*3600000;
const quotaDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'});
function reserveQuota(coverage,now,bucket){
  const day=quotaDay.format(new Date(now)),prior=coverage._highlightQuota;
  if(prior&&(!/^\d{4}-\d{2}-\d{2}$/.test(prior.day||'')||!Number.isFinite(Date.parse(prior.day+'T12:00:00Z'))||new Date(prior.day+'T12:00:00Z').toISOString().slice(0,10)!==prior.day||prior.day>day||Object.keys(API_LIMITS).some(key=>!Number.isInteger(prior[key])||prior[key]<0||prior[key]>API_LIMITS[key])))return false;
  const quota=coverage._highlightQuota=prior?.day===day?prior:{day,search:0,ordinary:0};
  const used=quota[bucket];
  if(!Object.hasOwn(API_LIMITS,bucket)||used>=API_LIMITS[bucket])return false;
  // Reserve before issuing the request. Failed/aborted provider calls count too;
  // the existing source failure report persists this same private object.
  quota[bucket]++;return true;
}
function rankPriority(event,rankings=require('../data/canonical/tennis-catalogue-2026.json').athletes){
  const model=require('../config/athletes'),field=draw(event).includes('doubles')?'rankingDoubles':'rankingSingles';
  const index=new Map(rankings.filter(p=>p.rankingSourceTrust==='verified').map(p=>[model.identity(p.athleteId||p.id),p[field]]));
  const ranks=model.participantIds(event).map(id=>index.get(model.identity(id))).filter(rank=>Number.isInteger(rank)&&rank>0).sort((a,b)=>a-b);
  return [ranks[0]||Infinity,ranks[1]||Infinity];
}
function prioritise(events,now,rankings){
  const ranks=new Map(events.map(e=>[e,rankPriority(e,rankings)]));
  return [...events].sort((a,b)=>Number(contract.recent(b,now))-Number(contract.recent(a,now))||ranks.get(a)[0]-ranks.get(b)[0]||ranks.get(a)[1]-ranks.get(b)[1]||String(b.date||'').localeCompare(String(a.date||''))||String(a.id||a.eventId||'').localeCompare(String(b.id||b.eventId||'')));
}
const text=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const ids=event=>[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].filter(Boolean);
function expireRecords(records,now=new Date()){return records.map(record=>record.highlights&&!contract.valid(record.highlights,now)?{...record,highlights:null}:record);}
// Unchanged fact hashes deliberately leave stored rows alone. Reuse only the
// matching successful provider receipts already saved by that same owner.
function renewRecords(records,coverage={},now=new Date()){
  coverage ||= {};
  const videos=new Map(pruneVideos(coverage._highlightVideos||[],coverage._highlightChecks||{},records,now).map(v=>[v.videoId,v]));
  return expireRecords(records.map(record=>{
    const h=record.highlights,v=h&&videos.get(h.videoId);
    if(!h||!v)return record;
    if(v.unavailability)return {...record,highlights:null};
    const checkedAt=coverage._highlightChecks?.[h.videoId];
    if(!contract.fresh(checkedAt,now)||!contract.fresh(v.metadataCheckedAt,now)||v.channelId!==h.channelId||v.url!==h.url||v.publishedAt!==h.publishedAt||v.title!==h.matchTitle)return record;
    return {...record,highlights:{...h,checkedAt,sourceCheckedAt:v.metadataCheckedAt}};
  }),now);
}
function pruneVideos(videos,checks,records,now){
  const proof=new Map(records.filter(r=>r.highlights).map(r=>[r.highlights.videoId,r.highlights]));
  return videos.flatMap(v=>{
    const availabilityCheckedAt=v.availabilityCheckedAt||checks[v.videoId];
    const negative=v.unavailability&&contract.fresh(availabilityCheckedAt,now);
    if(!contract.recentUpload(v.publishedAt,now))return negative?[{videoId:v.videoId,unavailability:v.unavailability,availabilityCheckedAt}]:[];
    if(!contract.fresh(v.metadataCheckedAt||proof.get(v.videoId)?.sourceCheckedAt||proof.get(v.videoId)?.verifiedAt||v.publishedAt,now))return negative?[{videoId:v.videoId,unavailability:v.unavailability,availabilityCheckedAt}]:[];
    if(!v.unavailability||negative)return [v];
    const {unavailability,availabilityCheckedAt:unused,...metadata}=v;return [metadata];
  });
}
function channelAccepts(channel,event){const type=draw(event);return !(channel.tour==='ATP'&&type.startsWith('womens')||channel.tour==='WTA'&&type.startsWith('mens')||channel.tournamentPattern&&!new RegExp(channel.tournamentPattern,'i').test(tournament(event)));}
function decode(value){return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_m,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):Number(e.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[e.toLowerCase()];});}
function parseFeed(xml,channel,now=new Date()){
  const tag=(entry,name)=>decode(entry.match(new RegExp('<'+name+'>([\\s\\S]*?)</'+name+'>'))?.[1]||'');
  if(typeof xml!=='string'||Buffer.byteLength(xml)>MAX_BODY||/<!DOCTYPE|<!ENTITY/i.test(xml)||!xml.includes('<feed ')||tag(xml.split('<entry>')[0],'uri')!=='https://www.youtube.com/channel/'+channel.id)throw Error('Invalid official channel feed');
  const entries=[...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];if(entries.length>50)throw Error('Channel feed budget exceeded');
  return entries.map(([,entry])=>{const videoId=tag(entry,'yt:videoId'),channelId=tag(entry,'yt:channelId'),title=tag(entry,'title'),publishedAt=tag(entry,'published'),url=decode(entry.match(/<link\s+rel="alternate"\s+href="([^"]+)"/)?.[1]||'');
    if(!/^[\w-]{11}$/.test(videoId)||channelId!==channel.id||!Number.isFinite(Date.parse(publishedAt))||Date.parse(publishedAt)>+now+300000)return null;
    return {videoId,channelId,title:title.slice(0,500),description:tag(entry,'media:description').slice(0,1500),publishedAt,url,short:url.includes('/shorts/'),origin:'channel-feed'};
  }).filter(Boolean);
}
function draw(event){const f=text([event.eventType,event.matchType,event.tennisDrawType,event.gender,event.eventCode,event.drawType,event.stage,event.key,event.tour,event.tennisProviderTour].join(' ')),doubles=/double|\b(?:md|wd|xd)\b/.test(f);return /mixed|\bxd\b/.test(f)?'mixed-doubles':/women|female|\b(?:ws|wd|wta)\b/.test(f)?(doubles?'womens-doubles':'womens-singles'):doubles?'mens-doubles':'mens-singles';}
function names(event){return contract.playerNames(event).map(text);}
function tournament(event){return text(event.tournamentId||event.identityRef||event.tournamentName||event.eventName||event.competitionName||'').replace(/^(?:tournament |event )?tennis (?:atp |wta )?/,'').replace(/^event /,'').replace(/\b20\d\d\b/g,'').replace(/\b(atp|wta|masters|tour|grand slam|1000|500|250)\b/g,'').replace(/\s+/g,' ').trim();}
function compilation(video){return /\b(day \d+|roundup|round up|and more|all matches|compilation)\b/.test(text(video.title));}
function suitable(video,event,now=Date.now(),{allowUnreviewedPublisher=false}={}){
  if(!contract.tennisEligible(event)||video.short||video.unavailability||!/^https:\/\/www.youtube.com\/watch\?v=[\w-]{11}$/.test(video.url||''))return false;
  const channel=channels.find(c=>c.id===video.channelId);if(!channel&&!allowUnreviewedPublisher)return false;
  const title=text(video.title),description=text(video.description),all=title+' '+description;
  if(!/\bhighlights\b/.test(title)||/\b(shorts|interview|practice|training|press conference|full match|full coverage|live stream|best points|hot shot|match point)\b/.test(title)||!contract.recentUpload(video.publishedAt,now))return false;
  const qualifying=event.isQualifying===true||event.qualifying===true||/\b(?:qualifying|qualification)\b/.test(text([event.eventType,event.matchType,event.stage,event.drawType,event.roundLabel,event.round].join(' ')));
  if(qualifying!==/\b(?:qualifying|qualification)\b/.test(all))return false;
  const type=draw(event);if(!type.includes('doubles')&&/\b(doubles|mixed)\b/.test(title)||!type.startsWith('mixed')&&/\bmixed doubles\b/.test(title))return false;
  if(channel?.tour==='ATP'&&type.startsWith('womens')||channel?.tour==='WTA'&&type.startsWith('mens'))return false;
  if(type.includes('doubles')&&!/\bdoubles\b/.test(all)||type.startsWith('mixed')&&!/\bmixed\b/.test(all))return false;
  const year=String(event.tournamentId||'').match(/(?:^|[:-])(20\d\d)(?:$|[:-])/)?.[1]||String(event.date||event.startTimeUtc||'').slice(0,4),place=tournament(event);
  if(!/^20\d\d$/.test(year)||!title.includes(year)||!place||!title.includes(place))return false;
  const publication=Date.parse(video.publishedAt),start=Date.parse(event.actualStartTimeUtc||(/^(exact|not-before)$/.test(event.timePrecision||'')?event.startTimeUtc:'')||'');
  if(!Number.isFinite(publication)||Number.isFinite(start)&&publication<start)return false;
  const publicationDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(publication));
  if(event.date&&publicationDay<event.date)return false;
  if(channel?.tournamentPattern&&!new RegExp(channel.tournamentPattern,'i').test(place))return false;
  const players=names(event);if(players.length!==(type.includes('doubles')?4:2))return false;
  // Require full sourced names or a unique multi-token surname within this exact draw.
  const surnames=players.map(name=>name.split(' ').slice(1).join(' '));
  // Day reels may name covered players in the publisher description/chapter
  // list. Edition/place must still appear in the title; both players must be
  // explicitly identified rather than assuming every match that day is covered.
  const matchText=compilation(video)?all:title;
  if(!players.every((name,i)=>(' '+matchText+' ').includes(' '+name+' ')||surnames[i]&&surnames.filter(s=>s===surnames[i]).length===1&&(' '+matchText+' ').includes(' '+surnames[i]+' ')))return false;
  // A supplied conflicting round rejects a rematch even if participants agree.
  const r=title.match(/\b(round of (?:16|32|64|128)|last 16|r(?:128|64|32|16|[1-7])|quarter ?finals?|semi ?finals?|qf|sf|final|round [1-7])\b/)?.[1];
  const expected=text(event.roundLabel||event.round||event.stage);
  const roundKey=value=>{
    const size=value.match(/round of (\d+)|\br(16|32|64|128)\b/)?.slice(1).find(Boolean);
    if(size)return 'r'+size;
    if(/last 16/.test(value))return 'r16';if(/quarter|\bqf\b/.test(value))return 'r8';if(/semi|\bsf\b/.test(value))return 'r4';if(/\bfinal\b/.test(value))return 'r2';
    const number=value.match(/\b(?:round |r)([1-7])\b/)?.[1],total=event.tournamentRoundTotal||event.totalRounds;
    return number?(Number.isInteger(total)&&total>=+number?'r'+2**(total-Number(number)+1):'round '+number):value;
  };
  const supplied=roundKey(r||''),known=roundKey(expected);
  // Ordinal rounds without a sourced draw total cannot be converted to draw
  // size. Reject known conflicts, without guessing that every Round 4 is R16.
  if(r&&supplied!==known&&!(/^round /.test(supplied)!==/^round /.test(known)&&/^r\d+$/.test(/^round /.test(supplied)?known:supplied)))return false;
  return true;
}
async function read(url,fetchImpl,signal,{json=false}={}){
  const response=await fetchImpl(url,{signal,headers:{Accept:json?'application/json':'application/atom+xml'}});
  if(!response.ok){const error=Error('Official highlights source unavailable');error.status=response.status;throw error;}
  let body;
  if(response.body?.getReader){const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>MAX_BODY)throw Error('Highlights response budget exceeded');chunks.push(Buffer.from(part.value));}body=Buffer.concat(chunks).toString('utf8');}finally{await reader.cancel().catch(()=>{});}}
  else{body=await response.text();if(Buffer.byteLength(body)>MAX_BODY)throw Error('Highlights response budget exceeded');}
  return json?JSON.parse(body):body;
}
async function oembed(video,{fetchImpl,signal}){
  const data=await read('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(video.url),fetchImpl,signal,{json:true});
  const channel=channels.find(c=>c.id===video.channelId);if(!channel||data.type!=='video'||text(data.author_name)!==text(channel.label)||String(data.author_url||'').toLowerCase()!=='https://www.youtube.com/@'+channel.handle.toLowerCase())throw Error('Unverified highlights publisher');
  return {...video,title:data.title};
}
function apiVideo(item){return {videoId:item.id,channelId:item.snippet?.channelId,title:item.snippet?.title||'',description:item.snippet?.description||'',publishedAt:item.snippet?.publishedAt,url:'https://www.youtube.com/watch?v='+item.id,origin:'youtube-api',api:item};}
function availableInAu(item){const r=item.contentDetails?.regionRestriction;return item.status?.privacyStatus==='public'&&item.status?.uploadStatus==='processed'&&item.snippet?.liveBroadcastContent!=='upcoming'&&!(r?.blocked||[]).includes('AU')&&(!Array.isArray(r?.allowed)||r.allowed.includes('AU'))&&!item.contentDetails?.contentRating?.ytRating;}
function tennisScope(events,now=new Date()){
  const registry=require('../config/sport-domain-registry'),model=require('../config/athletes');
  const knownSportKeys=Object.keys(registry.byKey).sort(),sportKeys=knownSportKeys.filter(key=>registry.byKey[key].domainId==='sport:tennis');
  const tennis=events.filter(event=>sportKeys.includes(event.key||event.sportKey));
  const unique=values=>[...new Set(values.filter(value=>typeof value==='string'&&/^[-a-z0-9_:]{1,200}$/i.test(value)))].sort();
  const recent=tennis.filter(event=>Date.parse(event.date+'T23:59:59Z')>=+now-8*86400000);
  // Roster identities supplement whole-family selection; they never truncate
  // Tennis source groups or remove the RPC's unknown-row/alias preservation.
  const allParticipants=unique(tennis.flatMap(model.participantIds)),participantIds=unique(recent.flatMap(model.participantIds));
  const preserveIds=unique(tennis.flatMap(event=>[...ids(event),...(event.fixtureIdAliases||[])]));
  if(preserveIds.length>5000)throw Error('Tennis media identity scope exceeded');
  if(!allParticipants.length)return null;
  return {scope:'participants',sportKeys,knownSportKeys,participantIds:(participantIds.length?participantIds:allParticipants).slice(0,1000),preserveIds};
}
async function refresh({events,previous=[],coverage={},now=new Date(),fetchImpl=globalThis.fetch,signal,apiKey='',archiveFixtures=[],searchBudget=2,rankings,quotaReserve}={}){
  const candidates=[...events.filter(e=>contract.recent(e,now)),...archiveFixtures].filter(contract.tennisEligible);
  const unique=new Map();for(const event of candidates){const key=ids(event).map(id=>id.toLowerCase().replace(/[^a-z0-9]/g,'')).sort()[0];if(!unique.has(key))unique.set(key,event);}
  const wanted=prioritise([...unique.values()],now,rankings),priorById=new Map(previous.flatMap(e=>ids(e).map(id=>[id,e]))),failed=[],pool=new Map(pruneVideos(coverage._highlightVideos||[],coverage._highlightChecks||{},previous,now).map(v=>[v.videoId,v]));
  let quotaLimited=false;
  const apiRead=async(path,bucket='ordinary',onDispatch)=>{
    signal?.throwIfAborted();
    const priorQuota=coverage._highlightQuota&&{...coverage._highlightQuota};
    if(!reserveQuota(coverage,now,bucket)){quotaLimited=true;const error=Error('Highlights quota reserved for next day');error.code='quota_limit';throw error;}
    if(quotaReserve){
      // The durable database reservation is authoritative. A denied call must
      // not increment its legacy diagnostic copy or consume the tap allowance.
      if(priorQuota)coverage._highlightQuota=priorQuota;else delete coverage._highlightQuota;
      const reservation=await quotaReserve(bucket);if(!reservation?.granted){quotaLimited=true;const error=Error('Highlights quota reserved for next day');error.code='quota_limit';throw error;}coverage._highlightQuota=reservation.quota;
    }
    signal?.throwIfAborted();
    onDispatch?.();
    return read('https://www.googleapis.com/youtube/v3/'+path+'&key='+encodeURIComponent(apiKey),fetchImpl,signal,{json:true});
  };
  const lastChecks={...(coverage._highlightChecks||{})};
  const priorFor=event=>{const record=ids(event).map(id=>priorById.get(id)).find(Boolean);return record&&Object.hasOwn(record,'highlights')?record.highlights:event.highlights;};
  for(let i=0;i<channels.length;i+=2)await Promise.all(channels.slice(i,i+2).map(async channel=>{if(!wanted.some(e=>channelAccepts(channel,e)))return;
    try{for(const video of parseFeed(await read('https://www.youtube.com/feeds/videos.xml?channel_id='+channel.id,fetchImpl,signal),channel,now))pool.set(video.videoId,{...pool.get(video.videoId),...video,metadataCheckedAt:now.toISOString()});}
    catch{failed.push(channel.id);if(apiKey)try{const d=await apiRead('playlistItems?part=snippet&maxResults=50&playlistId=UU'+channel.id.slice(2));for(const p of d.items||[]){const video=apiVideo({id:p.snippet?.resourceId?.videoId,snippet:{...p.snippet,publishedAt:p.snippet?.videoPublishedAt||p.snippet?.publishedAt}});if(video.channelId===channel.id)pool.set(video.videoId,{...video,metadataCheckedAt:now.toISOString()});}}catch{}}
  }));
  // The API is optional. Bound historical searches to two calls per due pass
  // Persist a PT-day cap below Google's allowance, including failed calls.
  // Cooldowns let lower ranks progress after the higher-ranked pairs are tried.
  const backfill=coverage._highlightBackfill||{},tasks=[],attempts=Object.fromEntries(Object.entries(backfill.attempts||{}).filter(([,stamp])=>contract.fresh(stamp,now)));
  coverage._highlightBackfill={...backfill,attempts};
  if(apiKey)for(const event of wanted)if(names(event).length&&tournament(event)&&![...pool.values()].some(v=>suitable(v,event,now)&&!compilation(v)))for(const channel of channels){const type=draw(event);if(channel.tour==='ATP'&&type.startsWith('womens')||channel.tour==='WTA'&&type.startsWith('mens')||channel.tournamentPattern&&!new RegExp(channel.tournamentPattern,'i').test(tournament(event)))continue;tasks.push({event,channel});}
  const dueTasks=tasks.filter(({event,channel})=>+now-Date.parse(attempts[(event.canonicalEventId||event.id)+'/'+channel.id]||'1970-01-01')>=SEARCH_RETRY_MS);
  let cursor=Number(backfill.cursor)||0;
  for(const {event,channel} of dueTasks.slice(0,Math.min(2,Math.max(0,searchBudget)))){
    try{const q=names(event).join(' ')+' '+tournament(event)+' '+String(event.date||'').slice(0,4)+' highlights';const response=apiRead('search?part=snippet&type=video&maxResults=5&publishedAfter='+encodeURIComponent(new Date(+now-contract.MAX_UPLOAD_AGE_MS).toISOString())+'&publishedBefore='+encodeURIComponent(now.toISOString())+'&relevanceLanguage=en&channelId='+channel.id+'&q='+encodeURIComponent(q),'search',()=>{attempts[(event.canonicalEventId||event.id)+'/'+channel.id]=now.toISOString();coverage._highlightBackfill.cursor=++cursor;});
      const d=await response;for(const item of d.items||[]){const video=apiVideo({id:item.id?.videoId,snippet:item.snippet});if(video.channelId===channel.id&&!pool.has(video.videoId))pool.set(video.videoId,{...video,metadataCheckedAt:now.toISOString()});}
    }catch(error){if(error.code!=='quota_limit')failed.push('api-backfill');}
  }
  const verified=new Map(),unavailable=new Set();
  const needed=new Map();
  for(const event of wanted){
    const prior=priorFor(event);
    if(prior&&contract.recentUpload(prior.publishedAt,now)&&/^[\w-]{11}$/.test(prior.videoId||'')&&channels.some(c=>c.id===prior.channelId)){
      const video=pool.get(prior.videoId)||{videoId:prior.videoId,channelId:prior.channelId,url:prior.url,publishedAt:prior.publishedAt,title:prior.matchTitle||'',origin:'retained',metadataCheckedAt:prior.sourceCheckedAt||prior.verifiedAt};
      pool.set(prior.videoId,video);
      const age=+now-Date.parse(lastChecks[prior.videoId]||prior.checkedAt||prior.verifiedAt);
      if(contract.valid(prior,now)&&suitable(video,event,now)&&!video.unavailability&&(!apiKey||prior.verificationMethod==='youtube-api-and-oembed')&&age<86400000)verified.set(prior.videoId,prior);
      else if(!video.unavailability||age>=86400000&&(video.unavailability!=='api-restricted'||apiKey))needed.set(prior.videoId,video);
    }
    for(const v of pool.values())if(suitable({...v,unavailability:null},event,now)&&!verified.has(v.videoId)&&(!v.unavailability||+now-Date.parse(lastChecks[v.videoId]||'1970-01-01')>=86400000&&(v.unavailability!=='api-restricted'||apiKey)))needed.set(v.videoId,v);
  }
  const checkBatch=[...needed.values()].slice(0,24);
  if(apiKey&&checkBatch.length){const list=checkBatch;for(let i=0;i<list.length;i+=50)try{const page=list.slice(i,i+50);const d=await apiRead('videos?part=snippet,status,contentDetails&id='+page.map(v=>v.videoId).join(','));const found=new Map((d.items||[]).map(v=>[v.id,v]));for(const video of page){const item=found.get(video.videoId);if(!item||!availableInAu(item)||!require('./highlight-selection').english(item.snippet)){unavailable.add(video.videoId);lastChecks[video.videoId]=now.toISOString();pool.set(video.videoId,{...video,unavailability:'api-restricted',availabilityCheckedAt:now.toISOString()});continue;}pool.set(video.videoId,{...video,...apiVideo(item),unavailability:null,metadataCheckedAt:now.toISOString(),availabilityCheckedAt:now.toISOString()});}}catch{failed.push('api-verification');}}
  const checks=checkBatch.filter(v=>!verified.has(v.videoId)&&!unavailable.has(v.videoId));
  for(let i=0;i<checks.length;i+=2)await Promise.all(checks.slice(i,i+2).map(async video=>{try{const candidate={...(pool.get(video.videoId)||video),unavailability:null};
    if(candidate.api){const match=String(candidate.api.contentDetails?.duration||'').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/),duration=match?Number(match[1]||0)*3600+Number(match[2]||0)*60+Number(match[3]||0):0;if(duration<=0||duration>1200){unavailable.add(candidate.videoId);lastChecks[candidate.videoId]=now.toISOString();pool.set(candidate.videoId,{...candidate,unavailability:'api-restricted',availabilityCheckedAt:now.toISOString()});return;}}
    const v=await oembed(candidate,{fetchImpl,signal});const matching=wanted.filter(e=>suitable(v,e,now));if(!matching.length||!compilation(v)&&matching.length!==1){unavailable.add(v.videoId);return;}pool.set(v.videoId,v);lastChecks[v.videoId]=now.toISOString();const record={schemaVersion:contract.SCHEMA_VERSION,provider:'youtube',videoId:v.videoId,url:v.url,channelId:v.channelId,publishedAt:v.publishedAt,verifiedAt:now.toISOString(),checkedAt:now.toISOString(),sourceCheckedAt:v.metadataCheckedAt||now.toISOString(),availability:'public',regionStatus:v.api?'allowed':'unknown',standalone:!compilation(v),...(compilation(v)?{videoScope:'tournament-day'}:{}),matchTitle:v.title,verificationMethod:v.api?'youtube-api-and-oembed':'official-channel-feed-and-oembed'};if(contract.valid(record,now))verified.set(v.videoId,record);}catch(error){if([400,401,404,410].includes(error.status)){unavailable.add(video.videoId);lastChecks[video.videoId]=now.toISOString();pool.set(video.videoId,{...video,unavailability:'oembed-missing',availabilityCheckedAt:now.toISOString()});}else failed.push(video.videoId);}}));
  const output=[];
  for(const event of wanted){const prior=priorFor(event);const found=[...pool.values()].filter(v=>suitable(v,event,now)&&verified.has(v.videoId)&&!unavailable.has(v.videoId)).sort((a,b)=>Number(compilation(a))-Number(compilation(b))||Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
    let highlights=!(prior?.standalone===false&&found.some(v=>!compilation(v)))&&contract.valid(prior,now)&&pool.has(prior.videoId)&&suitable(pool.get(prior.videoId),event,now)&&!pool.get(prior.videoId)?.unavailability&&!unavailable.has(prior.videoId)?(verified.get(prior.videoId)||prior):found[0]?verified.get(found[0].videoId):null;
    if(!highlights&&!prior)continue;
    // Checking a stable link updates source health only, never fixture history.
    if(highlights&&prior&&highlights.videoId===prior.videoId&&highlights.channelId===prior.channelId)highlights={...highlights,verifiedAt:prior.verifiedAt};
    output.push({id:event.canonicalEventId||event.eventId||event.id,sourceEventIds:ids(event),date:event.date,enrichmentOnly:true,highlightsOnly:true,highlights});
  }
  for(const prior of previous)if(prior.highlights&&!contract.valid(prior.highlights,now)&&!output.some(record=>ids(record).some(id=>ids(prior).includes(id))))output.push({...prior,highlights:null});
  const retainedVideos=pruneVideos([...pool.values()],lastChecks,output,now).filter(v=>Number.isFinite(Date.parse(v.publishedAt))||v.unavailability).sort((a,b)=>Date.parse(b.publishedAt||b.availabilityCheckedAt)-Date.parse(a.publishedAt||a.availabilityCheckedAt)).slice(0,MAX_VIDEOS).map(({api,...v})=>v);
  output.coverage={schemaVersion:'highlights-coverage.v1',status:failed.length?'partial':'verified',mode:apiKey?'public-feeds-with-api-fallback':'public-feeds',checkedAt:now.toISOString(),eligible:wanted.length,linked:output.filter(e=>e.highlights).length,pending:wanted.length-output.filter(e=>e.highlights).length,quotaLimited,apiBudget:{...API_LIMITS},failures:[...new Set(failed)].map(()=>({code:'highlights_source_unavailable'})),_highlightVideos:retainedVideos,_highlightChecks:Object.fromEntries(retainedVideos.filter(v=>lastChecks[v.videoId]).map(v=>[v.videoId,lastChecks[v.videoId]])),_highlightBackfill:{...coverage._highlightBackfill,cursor},...(coverage._highlightQuota?{_highlightQuota:coverage._highlightQuota}:{})};
  return output;
}
function source({fetchImpl=globalThis.fetch,published=[],environment=process.env,loadCurrent=args=>require('./live-fixtures').readLiveSnapshots(args),loadArchives=args=>require('./highlight-archives').candidates(args),quotaReserve=require('./youtube-api-budget').reserveApiQuota}={}){
  return {id:SOURCE_ID,allowEmpty:true,minimumIntervalMs:INTERVAL_MS,refreshInterval:()=>INTERVAL_MS,retryMs:INTERVAL_MS,timeoutMs:20000,fetch:async({now,previous,signal,privateCoverage,sourceToken})=>{
    const archives=await loadArchives({after:privateCoverage?._highlightBackfill?.archiveCursor||'',signal});
    const scope=tennisScope([...published,...(Array.isArray(archives)?archives:archives.fixtures||[])],now);
    let snapshot={sources:[]},inputState='current',inputFailure=null,inputStatus=null;
    try{if(scope)snapshot=await loadCurrent(scope);if(snapshot.stale){inputState='published-fallback';({code:inputFailure,status:inputStatus}=snapshot.readFailure?require('./live-fixtures').snapshotReadFailure(snapshot.readFailure):{code:'current_input_stale',status:null});}}
    catch(error){signal?.throwIfAborted();inputState='published-fallback';({code:inputFailure,status:inputStatus}=require('./live-fixtures').snapshotReadFailure(error));}
    const events=require('../config/fixture-identity').mergeOverlays(published,(snapshot.sources||[]).flatMap(s=>s.fixtures||[]));
    const output=await refresh({events,previous,coverage:privateCoverage||{},now,fetchImpl,signal,apiKey:String(environment.YOUTUBE_DATA_API_KEY||'').trim(),archiveFixtures:Array.isArray(archives)?archives:archives.fixtures,quotaReserve:quotaReserve?bucket=>sourceToken?quotaReserve(bucket,{environment,sourceToken}):{granted:false}:null});
    output.coverage.inputState=inputState;
    if(inputFailure){output.coverage.status='partial';output.coverage.inputFailure={code:inputFailure,status:inputStatus};output.coverage.failures.push({code:inputFailure});}
    output.coverage._highlightBackfill.archiveCursor=archives.nextCursor||'';output.coverage.archiveState=archives.state||'available';
    if(!Array.isArray(archives)&&archives.fixtures?.length){const saved=await require('./highlight-archives').publish(output,archives.fixtures,{signal});if(saved.failed)output.coverage.failures.push({code:'archive_highlights_unavailable'});}
    return output;
  }};
}
function applyCached(events,records=require('../data/canonical/fixture-highlights.v1.json').events,now=new Date()){
  const index=new Map(expireRecords(records,now).filter(e=>e.highlightsOnly&&(e.highlights===null||contract.valid(e.highlights,now))).flatMap(e=>ids(e).map(id=>[id,e.highlights])));
  return events.map(event=>{const alias=ids(event).find(id=>index.has(id));return alias?{...event,highlights:index.get(alias)}:event.highlights&&!contract.valid(event.highlights,now)?{...event,highlights:null}:event;});
}
module.exports={SOURCE_ID,INTERVAL_MS,API_LIMITS,reserveQuota,rankPriority,prioritise,channels,parseFeed,suitable,compilation,draw,names,tournament,read,oembed,availableInAu,tennisScope,refresh,source,applyCached,expireRecords,pruneVideos,renewRecords};

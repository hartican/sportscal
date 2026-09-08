'use strict';
const identity=require('../config/fixture-identity');
const NATIONAL_NAMES={england:'GB',scotland:'GB',wales:'GB','west-indies':null,uae:'AE',usa:'US','hong-kong':'HK'};
const regionNames=new Intl.DisplayNames(['en'],{type:'region'});
function slug(value){return String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');}
for(let first=65;first<=90;first++)for(let second=65;second<=90;second++){
 const code=String.fromCharCode(first,second),name=regionNames.of(code);if(name!==code)NATIONAL_NAMES[slug(name)]=code;
}
Object.assign(NATIONAL_NAMES,{'united-states-of-america':'US','united-arab-emirates':'AE','south-korea':'KR'});
function cricketParticipant(value,{women=false,international=false}={}){
 const name=value?.displayName||value?.name||'TBC';if(!value?.id||/^(?:TBC|TBD|To Be Confirmed)$/i.test(name))return null;
 const countryName=slug(name.replace(/\s+(?:Men|Women|Women'?s|Men'?s)$/i,''));
 const national=international||Object.hasOwn(NATIONAL_NAMES,countryName);
 return {id:`team:cricket:${national?countryName:`espn-${value.id}`}${women&&!countryName.endsWith('-women')?'-women':''}`,
  name,displayName:name,aliases:[value.abbreviation].filter(Boolean),sourceIds:{espn:String(value.id)},
  countryCode:NATIONAL_NAMES[countryName]||NATIONAL_NAMES[slug(value.location)]||null,
  teamKind:national?'national':'club',genderCategory:women?'female':'male',role:value.homeAway};
}
function statusFor(state,detail=''){
 if(/cancel/i.test(detail))return 'cancelled';if(/abandon|no result/i.test(detail))return 'abandoned';if(/postpon/i.test(detail))return 'postponed';
 return ({pre:'scheduled',in:'live',post:'completed'})[state]||'scheduled';
}
function parseCricketScoreboard(payload,{sourceUrl='https://www.espncricinfo.com/live-cricket-score',checkedAt=new Date().toISOString()}={}){
 const sport=payload?.sports?.find(item=>item.slug==='cricket'||item.name==='Cricket'||String(item.id)==='200');
 if(!sport||sport.leagues!=null&&!Array.isArray(sport.leagues))throw new Error('Cricket scoreboard unavailable');
 const events=[];
 for(const league of sport.leagues||[])for(const game of Array.isArray(league.events)?league.events:[]){
  if(!game?.id)continue;
  try{
   const women=/women/i.test([game.name,league.name,game.class?.generalClassCard].join(' '));
   const international=Number(game.class?.internationalClassId)>0;
   const participants=(game.competitors||[]).map(value=>cricketParticipant(value,{women,international})).filter(Boolean);
   const isInternational=international||participants.length===2&&participants.every(team=>team.teamKind==='national');
   const id=`fixture:cricket:espn:${game.id}`,exact=game.timeValid!==false&&Number.isFinite(Date.parse(game.date));
   const status=statusFor(game.status,[game.fullStatus?.type?.description,game.fullStatus?.summary].join(' '));
   const format=game.eventType||game.class?.eventType||null;
   const roundLabel=String(game.description||'').split(',')[0]||null;
   const event=identity.normalizeCore({id,eventId:id,canonicalEventId:id,key:'cricket',sport:'Cricket',sportDomainId:'sport:cricket',
    name:game.name||participants.map(team=>team.name).join(' v ')||league.name,competitionId:`competition:cricket:espn:${league.id}`,competitionName:league.name,
    competitionScope:isInternational?'international':'domestic',isInternational,isSenior:!/(?:under.?\d+|\bu\d{2}\b|youth|academy)/i.test([game.name,league.name].join(' ')),gender:women?'women':'men',
    startTimeUtc:exact?game.date:null,date:exact?undefined:String(game.date||'').slice(0,10),dateOnly:!exact,timePrecision:exact?'exact':'date-only',
    status,format,roundLabel,venue:game.location||null,participants,participantIds:participants.map(team=>team.id),participantCountryCodes:participants.map(team=>team.countryCode).filter(Boolean),
    homeParticipantId:participants.find(team=>team.role==='home')?.id,awayParticipantId:participants.find(team=>team.role==='away')?.id,
    scoreDisplay:['live','completed','abandoned'].includes(status)?game.fullStatus?.summary||game.competitors?.map(team=>team.score).filter(Boolean).join(' — ')||null:null,
    sourceFixtureId:String(game.id),sourceName:'ESPNcricinfo',sourceType:'trusted-reporting',sourceUrl:game.link||sourceUrl,sourceCheckedAt:checkedAt,
    timingProvenance:{kind:'published-schedule',sourceUrl:game.link||sourceUrl,checkedAt},discoverySourceId:'cricket-espn',
   });
   // The header's endDate is a search envelope, not the match's end time.
   const days=/test|first.class/i.test(format||game.class?.generalClassCard||'')?(/test/i.test(game.class?.generalClassCard||'')?5:4):1;
   event.numberOfDays=days;
   if(event.date)event.endDate=new Date(Date.parse(event.date)+Math.max(0,days-1)*86400000).toISOString().slice(0,10);
   events.push(event);
  }catch(_error){/* An optional malformed record cannot erase other fixtures. */}
 }
 return [...new Map(events.map(event=>[event.id,event])).values()].sort((a,b)=>(a.startTimeUtc||a.date||'9999').localeCompare(b.startTimeUtc||b.date||'9999'));
}
function parseWorldRugby(payload,{sourceUrl='https://www.world.rugby/fixtures',checkedAt=new Date().toISOString()}={}){
 if(!Array.isArray(payload?.content))throw new Error('World Rugby match collection unavailable');
 const events=[];
 for(const game of payload.content){
  if(!game?.matchId)continue;
  try{
   const women=String(game.sport).toLowerCase().startsWith('w'),sevens=String(game.sport).toLowerCase().endsWith('rs');
   const competition=game.events?.[0]||{},competitionName=game.competition||competition.label||'Rugby';
   const participants=(Array.isArray(game.teams)?game.teams:[]).flatMap((team,index)=>{
    if(!team?.id||/^(?:TBC|TBD|Winner|Loser)/i.test(team.name||''))return [];
    const countryKey=slug(team.name),national=Object.hasOwn(NATIONAL_NAMES,countryKey);
    const legacy=!women&&!sevens?({'south-africa':'springboks','new-zealand':'all-blacks',australia:'wallabies'})[countryKey]:null;
    const key=legacy||countryKey;
    return [{id:`team:rugby:${national?key:`wr-${team.id}`}${women?'-women':''}${sevens?'-sevens':''}`,name:`${team.name}${women&&!/women/i.test(team.name)?' Women':''}`,displayName:team.name,
     sourceIds:{worldRugby:String(team.id)},countryCode:NATIONAL_NAMES[countryKey]||null,teamKind:national?'national':'club',genderCategory:women?'female':'male',role:index===0?'home':'away'}];
   });
   const international=participants.length===2&&participants.every(team=>team.teamKind==='national')||/internationals|world cup|nations|bledisloe|WXV|greatest rivalry/i.test(competitionName);
   const isSenior=!/(?:under.?\d+|\bu\d{2}\b|youth|academy|emerging)/i.test([competitionName,...(game.teams||[]).map(team=>team.name)].join(' '))&&!(game.teams||[]).some(team=>/\bXV$|\bA$/.test(team.name||''));
   const status=/^L(?:1|HT|2|FT|3|B|4|XD|K|S|D|SD|5|6)?$/.test(game.status)?'live':({U:'scheduled',UP:'postponed',CC:'cancelled',C:'completed'})[game.status]||'scheduled';
   const instant=Number(game.time?.millis),exact=game.time?.millis!=null&&Number.isFinite(instant)&&(instant%86400000!==0||Number(game.time?.gmtOffset)!==0&&game.time?.gmtOffset!=null);
   // Midnight provider values with only a date label are uncertain, not an
   // invented precise start; keep the published date and the card itself.
   const id=`fixture:rugby:wr:${game.matchId}`;
   events.push(identity.normalizeCore({id,eventId:id,canonicalEventId:id,key:'rugby',sport:'Rugby Union',sportDomainId:'sport:rugby-union',
    name:participants.length===2?participants.map(team=>team.name).join(' v '):(game.teams||[]).map(team=>team?.name||'TBC').join(' v ')||competitionName,
    competitionId:`competition:rugby:wr:${competition.id||slug(competitionName)}`,competitionName,competitionScope:international?'international':'domestic',isInternational:international,isSenior,gender:women?'women':'men',discipline:sevens?'rugby-sevens':'rugby-union',
    startTimeUtc:exact?new Date(instant).toISOString():null,date:exact?undefined:game.time?.label,timePrecision:exact?'exact':'date-only',dateOnly:!exact,
    status,sourceStatus:game.status,sourceTime:game.time,roundLabel:game.eventPhase||game.description||null,venue:[game.venue?.name,game.venue?.city].filter(Boolean).join(', '),
    participants,participantIds:participants.map(team=>team.id),participantCountryCodes:participants.map(team=>team.countryCode).filter(Boolean),homeParticipantId:participants.find(team=>team.role==='home')?.id,awayParticipantId:participants.find(team=>team.role==='away')?.id,
    ...(['live','completed'].includes(status)&&game.scores?.every(score=>score!==null&&Number.isFinite(Number(score)))?{homeScore:Number(game.scores[0]),awayScore:Number(game.scores[1]),scoreDisplay:game.scores.join('–')} :{}),
    sourceFixtureId:game.matchId,sourceName:'World Rugby',sourceType:'official',sourceUrl,sourceCheckedAt:checkedAt,timingProvenance:{kind:'official',sourceUrl,checkedAt},discoverySourceId:`rugby-wr-${String(game.sport).toLowerCase()}`,
   }));
  }catch(_error){/* Preserve other published fixtures. */}
 }
 return events.sort((a,b)=>(a.startTimeUtc||a.date||'9999').localeCompare(b.startTimeUtc||b.date||'9999'));
}
const dayAt=(now,offset)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+offset)).toISOString().slice(0,10);
async function getJson(fetchImpl,url,signal){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const timeout=AbortSignal.timeout(10000);
   signal?.throwIfAborted();
   const response=await fetchImpl(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout});
   if(!response.ok)throw new Error('Source unavailable');return await response.json();
  }catch(error){if(attempt||signal?.aborted)throw error;}
 }
}
function discoverySources(fetchImpl=globalThis.fetch){
 const sources=[];
 const cricketGroups=[{id:'near',offsets:[-1,0,1],minimumIntervalMs:60000},{id:'history',offsets:[-7,-6,-5,-4,-3,-2],minimumIntervalMs:21600000}];
 for(let start=2;start<=90;start+=7)cricketGroups.push({id:`future-${Math.floor((start-2)/7)}`,offsets:Array.from({length:Math.min(7,91-start)},(_,index)=>start+index),minimumIntervalMs:21600000});
 for(const group of cricketGroups)sources.push({id:`discovery-cricket-${group.id}`,offsets:group.offsets,minimumIntervalMs:group.minimumIntervalMs,allowEmpty:true,fetch:async({now,signal})=>{
  const events=[],report={provider:'ESPNcricinfo',from:dayAt(now,Math.min(...group.offsets)),to:dayAt(now,Math.max(...group.offsets)),requestedDays:group.offsets.length,daysRead:0,failures:[]};
  // A successful empty day is different from an unavailable day. Two reads at
  // a time bound load; all 98 dates are visited, not just currently known series.
  for(let index=0;index<group.offsets.length;index+=2)await Promise.all(group.offsets.slice(index,index+2).map(async offset=>{
   const day=dayAt(now,offset),url=`https://site.api.espn.com/apis/personalized/v2/scoreboard/header?sport=cricket&dates=${day.replace(/-/g,'')}&limit=1000`;
   try{signal?.throwIfAborted();events.push(...parseCricketScoreboard(await getJson(fetchImpl,url,signal),{sourceUrl:url,checkedAt:now.toISOString()}));report.daysRead++;}
   catch(_error){report.failures.push({day,code:'unavailable'});}
  }));
  if(!report.daysRead)throw new Error('Cricket date discovery unavailable');
  const result=[...new Map(events.map(event=>[event.id,event])).values()];result.coverage=report;return result;
 }});
 for(const sport of ['mru','wru','mrs','wrs'])for(const near of [true,false])sources.push({id:`discovery-rugby-${sport}${near?'-near':''}`,minimumIntervalMs:near?60000:21600000,allowEmpty:true,fetch:async({now,signal})=>{
  const from=dayAt(now,near?-1:-7),to=dayAt(now,near?1:90),events=[],report={provider:'World Rugby',sport,from,to,pagesRead:0,expectedPages:null,expectedEntries:null,failures:[]};
  let pages=1;
  for(let page=0;page<pages;page++){
   const url=`https://api.wr-rims-prod.pulselive.com/rugby/v3/match?startDate=${from}&endDate=${to}&sport=${sport}&states=U,UP,L,CC,C&pageSize=100&sort=asc&page=${page}`;
   try{
    signal?.throwIfAborted();const document=await getJson(fetchImpl,url,signal);
    if(!document.pageInfo||!Number.isInteger(document.pageInfo.numPages)||document.pageInfo.numPages>40)throw new Error('Invalid pagination');
    pages=Math.max(1,document.pageInfo.numPages);report.expectedPages=pages;report.expectedEntries=document.pageInfo.numEntries;
    events.push(...parseWorldRugby(document,{sourceUrl:url,checkedAt:now.toISOString()}));report.pagesRead++;
   }catch(_error){report.failures.push({page,code:'unavailable'});if(page===0)throw new Error('World Rugby discovery unavailable');}
  }
  const result=[...new Map(events.map(event=>[event.id,event])).values()];
  if(!report.failures.length&&Number.isInteger(report.expectedEntries)&&result.length<report.expectedEntries)report.failures.push({code:'incomplete_collection'});
  result.coverage=report;return result;
 }});
 return sources;
}
module.exports={parseCricketScoreboard,parseWorldRugby,cricketParticipant,slug,statusFor,discoverySources};

'use strict';
const slug=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const countries={AUS:'AU',USA:'US',CAN:'CA',NZL:'NZ',JPN:'JP',KOR:'KR',CHN:'CN',TPE:'TW',THA:'TH',ENG:'GB',SCO:'GB',WAL:'GB',NIR:'GB',IRL:'IE',RSA:'ZA',SWE:'SE',NOR:'NO',DEN:'DK',FRA:'FR',ESP:'ES',GER:'DE',MEX:'MX',PHI:'PH',IND:'IN',BEL:'BE',COL:'CO',ARG:'AR',MAS:'MY',INA:'ID',ISL:'IS',FIN:'FI',SUI:'CH',AUT:'AT'};
function participant(p,{gender='male',country,sourceUrl,checkedAt}={}){
 const name=(p.displayName||p.name||[p.firstName,p.lastName].filter(Boolean).join(' ')).replace(/\s*\(a\)$/i,''),id='competitor:golf:'+slug(name);
 const known=require('../data/follow-directory/golf.v1.json').records.find(r=>r.id===id);
 const code=country||p.countryFlag||p.countryCode||p.countryAbbr||p.country?.label||known?.countryCode;
 return {id,displayName:name,sourceParticipantId:String(p.playerId||p.id||''),countryCode:countries[code]||(code?.length===2?code:null),genderCategory:gender,entryStatus:/withdraw|\bwd\b/i.test(p.status||'')?'withdrawn':/missed.cut|\bcut\b/i.test(p.status||'')?'eliminated':'confirmed',sourceUrl,sourceCheckedAt:checkedAt};
}
function rscObjects(html){const objects=[];const walk=v=>{if(!v||typeof v!=='object')return;if(!Array.isArray(v))objects.push(v);Object.values(v).forEach(walk);};for(const m of String(html).matchAll(/self\.__next_f\.push\((\[.*?\])\)<\/script>/g))try{const text=JSON.parse(m[1])[1];if(typeof text==='string')for(const line of text.split('\n'))try{walk(JSON.parse(line.slice(line.indexOf(':')+1)));}catch{}}catch{}return objects;}
const zones={'Central Standard Time':'America/Chicago','Eastern Standard Time':'America/New_York','Pacific Standard Time':'America/Los_Angeles','Mountain Standard Time':'America/Denver','Hawaiian Standard Time':'Pacific/Honolulu','Korea Standard Time':'Asia/Seoul','Tokyo Standard Time':'Asia/Tokyo','China Standard Time':'Asia/Shanghai','Singapore Standard Time':'Asia/Singapore','GMT Standard Time':'Europe/London','W. Europe Standard Time':'Europe/Berlin'};
function localInstant(date,time,zone){const m=String(time).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);if(!m||!zone)return null;const hour=Number(m[1])%12+(/pm/i.test(m[3])?12:0),target=Date.parse(`${date.slice(0,10)}T${String(hour).padStart(2,'0')}:${m[2]}:00Z`);let guess=target;for(let i=0;i<3;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(guess).map(p=>[p.type,p.value]));const shown=Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);guess+=target-shown;}return new Date(guess).toISOString();}
function parseLpga(html,{sourceUrl,checkedAt=new Date().toISOString(),entriesHtml=''}={}){
 const objects=rscObjects(html),t=objects.find(o=>o.tournamentId&&o.startDate&&o.timeZone),draw=objects.find(o=>Array.isArray(o.pairings)&&o.currentRound);
 if(!t)throw Error('LPGA tournament identity unavailable');
 const id=`fixture:golf:lpga:${t.tournamentId}`,round=draw?.rounds?.find(r=>r.roundNum===draw.currentRound),entries=new Map(),appearances=[];
 if(round?.date&&(round.date.slice(0,10)<t.startDate.slice(0,10)||round.date.slice(0,10)>t.endDate.slice(0,10)))throw Error('LPGA pairing edition mismatch');
 const fieldObjects=rscObjects(entriesHtml||html);
 const fieldTournament=fieldObjects.find(o=>o.tournamentId&&o.startDate);
 if(fieldTournament&&fieldTournament.tournamentId!==t.tournamentId)throw Error('LPGA field edition mismatch');
 const field=fieldObjects.find(o=>Array.isArray(o.entries)&&Array.isArray(o.reserves));
 for(const group of field?.entries||[])for(const row of group.rows||[]){
  const statusIndex=group.columns?.findIndex(c=>c.text==='Entry Status'),status=row[statusIndex]?.text;
  if(!/^(Entered|Withdrawn|WD)$/i.test(status||''))continue;
  for(const p of row.flatMap(c=>c.players||[])){const entry=participant({...p,status},{gender:'female',sourceUrl:sourceUrl.replace(/pairings$/,'entries'),checkedAt});entries.set(entry.id,entry);}
 }
 for(const [i,row]of (draw?.pairings||[]).entries()){
  const players=[...new Map(row.flatMap(c=>c.players||[]).map(p=>participant(p,{gender:'female',sourceUrl,checkedAt})).map(p=>[p.id,p])).values()];players.forEach(p=>{if(!entries.has(p.id))entries.set(p.id,p);});
  if(!players.length)continue;const time=row.find(c=>c.type==='text'&&/AM|PM/.test(c.text))?.text,startTimeUtc=round&&localInstant(round.date,time,zones[t.timeZone]);
  appearances.push({id:`${id}:round:${draw.currentRound}:group:${players.map(p=>p.sourceParticipantId).sort().join('-')}`,round:draw.currentRound,label:round?.name||`Round ${draw.currentRound}`,participants:players,participantIds:players.map(p=>p.id),startTimeUtc,timePrecision:startTimeUtc?'exact':'tbc',date:round?.date?.slice(0,10)||null,tee:row.find(c=>c.type==='text'&&typeof c.text==='number')?.text||null,sourceUrl,sourceCheckedAt:checkedAt});
 }
 const date=t.startDate.slice(0,10),endDate=t.endDate.slice(0,10);
 const sourceStatus=objects.find(o=>o.status&&'active' in o&&'refresh' in o)?.status;
 const status=/complete|official/i.test(sourceStatus||'')?'completed':/progress|live/i.test(sourceStatus||'')?'live':'upcoming';
 return {id,eventId:id,key:'golf',codeId:'sport:golf',competitionId:'competition:lpga-tour',competitionName:'LPGA Tour',genderCategory:'female',cardType:'golf_tournament',name:t.name,tournamentName:t.name,tournamentId:String(t.tournamentId),date,endDate,dateOnly:true,timePrecision:'date-only',status,venue:t.location,venueCity:t.city,venueCountryCode:countries[t.countryAbbr]||null,participants:[...entries.values()],participantIds:[...entries.keys()],entries:[...entries.values()],participantsConfirmed:entries.size>0,entryListPublished:Boolean(field?.entries?.length),excludedParticipantIds:[...entries.values()].filter(p=>p.entryStatus!=='confirmed').map(p=>p.id),appearances,sourceUrl,sourceName:'LPGA official tee times',sourceType:'official',sourceCheckedAt:checkedAt};
}
function mergeObservation(next,previous){if(!previous)return next;if(!next.participantsConfirmed)return {...previous,...next,participants:previous.participants,participantIds:previous.participantIds,entries:previous.entries,excludedParticipantIds:previous.excludedParticipantIds,appearances:previous.appearances,participantsConfirmed:previous.participantsConfirmed,participationCheckedAt:previous.participationCheckedAt||previous.sourceCheckedAt};const latest=new Map((next.appearances||[]).map(a=>[a.id,a]));return {...next,appearances:[...(previous.appearances||[]).filter(a=>!latest.has(a.id)&&!next.appearances.some(n=>n.round===a.round)),...latest.values()],participationCheckedAt:next.sourceCheckedAt};}

function pgaQueries(html){
 const encoded=String(html).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 if(!encoded)throw Error('PGA tournament payload missing');
 return JSON.parse(encoded).props?.pageProps?.dehydratedState?.queries||[];
}
function parsePga(html,{base,sourceUrl,checkedAt=new Date().toISOString(),fieldHtml=''}={}){
 const qs=pgaQueries(html),fieldQs=fieldHtml?pgaQueries(fieldHtml):qs;
 const draw=qs.find(q=>q.queryKey?.[0]==='teeTimes')?.state?.data;
 const field=fieldQs.find(q=>q.queryKey?.[0]==='field')?.state?.data;
 for(const d of [draw,field])if(d&&d.id!==base.tournamentId)throw Error('PGA tournament edition mismatch');
 if(!draw&&!field)throw Error('PGA field and tee times unavailable');
 const entries=new Map(),appearances=[];
 const player=p=>participant({...p,displayName:[p.firstName,p.lastName].filter(Boolean).join(' ')||p.displayName,status:p.withdrawn?'withdrawn':p.status},{sourceUrl,checkedAt});
 for(const p of field?.players||[]){if(p.alternate)continue;const entry=player(p);entries.set(entry.id,entry);}
 for(const round of draw?.rounds||[])for(const group of round.groups||[]){
  const participants=(group.players||[]).map(player);participants.forEach(p=>{if(!entries.has(p.id))entries.set(p.id,p);});
  if(!participants.length)continue;
  const time=Number(group.teeTime),startTimeUtc=Number.isFinite(time)&&time>1e12?new Date(time).toISOString():null;
  appearances.push({id:`${base.id}:round:${round.roundInt}:group:${group.groupNumber}`,round:round.roundInt,label:`Round ${round.roundInt}`,participants,participantIds:participants.map(p=>p.id),startTimeUtc,timePrecision:startTimeUtc?'exact':'tbc',tee:group.startTee,sourceUrl,sourceCheckedAt:checkedAt});
 }
 const next={...base,cardType:'golf_tournament',participants:[...entries.values()],participantIds:[...entries.keys()],entries:[...entries.values()],participantsConfirmed:entries.size>0,entryListPublished:Boolean(field?.players?.length),excludedParticipantIds:[...entries.values()].filter(p=>p.entryStatus!=='confirmed').map(p=>p.id),appearances,sourceUrl,sourceCheckedAt:checkedAt};
 delete next.detailsUnavailable;return next;
}
module.exports={participant,rscObjects,localInstant,parseLpga,parsePga,mergeObservation};

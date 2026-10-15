'use strict';
// Reviewed-catalogue selector and bounded refresh; the existing canonical refresh owns calls.
const SCHEMA_VERSION='stan-football-programmes.v1',MAX_AGE_MS=7*86400000;
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const scopes=Object.freeze({
  'premier-league':['competition:premier-league','Premier League'],
  'uefa-champions-league':['competition:uefa-champions-league','UEFA Champions League'],
  'uefa-europa-league':['competition:uefa-europa-league','UEFA Europa League'],
  'uefa-conference-league':['competition:uefa-conference-league','UEFA Conference League'],
  'fa-cup':['competition:fa-cup','FA Cup'],
  'womens-fa-cup':['competition:womens-fa-cup',"Women's FA Cup"],
  wsl:['competition:womens-super-league','WSL'],nwsl:['competition:nwsl','NWSL'],
  jleague:['competition:j-league','J.League'],'k-league':['competition:k-league','K League']
});
const feedIds=Object.freeze({'premier-league':{programme:3578},'uefa-champions-league':{rapid_recap:1397,highlights:1396},'uefa-europa-league':{rapid_recap:1401,highlights:1400},'uefa-conference-league':{rapid_recap:1405},wsl:{rapid_recap:3699,highlights:3698},nwsl:{highlights:3690},'fa-cup':{rapid_recap:3844,highlights:3786},'womens-fa-cup':{rapid_recap:4339,highlights:4338}});
const competition=value=>String(value||'').replace(/-20\d{2}(?:-\d{2,4})?$/,'');
function season(value){const input=String(value||'').trim();if(/^20\d{2}$/.test(input))return input;const m=input.match(/\b(20\d{2})[/-](\d{2}|20\d{2})\b/);if(!m)return null;const end=m[2].length===2?Number(m[1].slice(0,2)+m[2]):Number(m[2]);return end===Number(m[1])+1?m[1]+'/'+end:null;}
const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function sourceMonthDay(value){const m=String(value||'').match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\b/);if(!m)return null;const month=monthNames.indexOf(m[2].slice(0,3).toLowerCase())+1;return month&&Number(m[1])>=1&&Number(m[1])<=31?String(month).padStart(2,'0')+'-'+m[1].padStart(2,'0'):null;}
function parseTitle(value){const m=String(value||'').match(/^(.+?)\s+v\s+(.+?)\s+-\s+(.+?)\s+(20\d{2}(?:[/-](?:20\d{2}|\d{2}))?)\s*$/i);if(!m)return null;const edition=season(m[4]);if(!edition)return null;const round=m[3].match(/\b(?:Matchday|Matchweek|Round)\s+(\d+)\b/i);return {home:m[1].trim(),away:m[2].trim(),competitionTitle:m[3].trim(),season:edition,roundNumber:round?Number(round[1]):null};}
const kindRank=kind=>kind==='rapid_recap'?0:kind==='highlights'?1:2;
function kindForHeading(heading){if(/^Premier League Replays & Extras$/i.test(String(heading||'').trim()))return 'programme';return /\brapid recaps?\b/i.test(heading)?'rapid_recap':/\bhighlights\b/i.test(heading)?'highlights':null;}
function normalizeCatalogue(feeds){const programmes=[];for(const feed of Array.isArray(feeds)?feeds:[]){let url;try{url=new URL(feed.sourceUrl);}catch{continue;}const slug=url.pathname.match(/^\/watch\/sport\/football\/([^/]+)\/?$/)?.[1],scope=scopes[slug],kind=kindForHeading(feed.heading);if(url.origin!=='https://www.stan.com.au'||!scope||!kind||!/^https:\/\/www\.stan\.com\.au\/watch\/sport\/feed\/\d+\.json$/.test(feed.feedUrl||'')||!Number.isFinite(Date.parse(feed.observedAt||'')))continue;if(feed.feedUrl!=='https://www.stan.com.au/watch/sport/feed/'+feedIds[slug]?.[kind]+'.json')continue;
  for(const entry of (feed.entries||[]).slice(0,100)){const parsed=parseTitle(entry.title);if(!parsed||!/^\d{1,12}$/.test(String(entry.guid||''))||!entry.isSportBundle||entry.type!=='program'||!normal(parsed.competitionTitle).includes(normal(scope[1])))continue;if(entry.shortform&&(kind==='programme'||entry.shortform!==(kind==='rapid_recap'?'recap':'highlights')))continue;const dm=String(entry.durationText||'').match(/^(\d{1,2}):(\d{2})$/),seconds=kind==='programme'?null:dm?Number(dm[1])*60+Number(dm[2]):null;if(kind!=='programme'&&entry.durationText&&!dm)continue;if(seconds!==null&&(seconds<=0||seconds>1200||Number(dm[2])>59))continue;
    programmes.push({programId:String(entry.guid),title:entry.title,...parsed,competitionId:scope[0],kind,programUrl:'https://play.stan.com.au/programs/'+entry.guid+'/play',programmeScope:'fixture',variantSpecific:false,requiresVariantSelection:true,sourceUrl:feed.sourceUrl,feedUrl:feed.feedUrl,sourceHeading:feed.heading,observedAt:feed.observedAt,sourceDateText:entry.sourceDateText||null,sourceMonthDay:sourceMonthDay(entry.sourceDateText),durationSeconds:seconds});
  }
}return {schemaVersion:SCHEMA_VERSION,programmes};}
const aliases=new Map([['man city','manchester city'],['psg','paris saint germain'],['man utd','manchester united'],['inter milan','internazionale'],['inter','internazionale']]);
const team=value=>aliases.get(normal(value))||normal(value);
function candidatesFor(event,catalogue,now=Date.now()){
  now=+now;
  if(!['completed','finished','final','past'].includes(String(event?.status||'').toLowerCase())||!Number.isFinite(now)||catalogue?.schemaVersion!==SCHEMA_VERSION)return [];
  const start=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');if(Number.isFinite(start)&&start>now)return [];
  const edition=season(event.season||event.footballMatchContext?.season),participants=event.participants||[];if(!edition||participants.length!==2)return [];
  const home=participants.find(p=>p.role==='home')||participants[0],away=participants.find(p=>p.role==='away')||participants[1];if(!home?.name||!away?.name)return [];
  const displayWindow=currentWindow(now);
  if(displayWindow.days.get(String(event.date||'').slice(5))!==event.date)return [];
  const sourcedDays=new Set([event.date.slice(5,10)]);if(Number.isFinite(start))sourcedDays.add(new Date(start).toISOString().slice(5,10));
  const eventRound=Number(event.roundNumber)||Number(String(event.roundLabel||event.round||'').match(/\b(?:Matchday|Matchweek|Round)\s+(\d+)\b/i)?.[1])||null;
  return (catalogue.programmes||[]).filter(p=>{
    if(!p.sourceMonthDay||!sourcedDays.has(p.sourceMonthDay))return false;
    const observed=Date.parse(p.observedAt||'');if(!Number.isFinite(observed)||now<observed||now-observed>MAX_AGE_MS)return false;
    if(p.competitionId!==competition(event.competitionId)||p.season!==edition||team(p.home)!==team(home.name)||team(p.away)!==team(away.name))return false;
    if(p.roundNumber!==null&&p.roundNumber!==eventRound)return false;
    if(!sourcedDays.has(p.sourceMonthDay))return false;
    return ['rapid_recap','highlights','programme'].includes(p.kind)&&p.programUrl==='https://play.stan.com.au/programs/'+p.programId+'/play'&&p.variantSpecific===false;
  }).sort((a,b)=>kindRank(a.kind)-kindRank(b.kind)||Date.parse(b.observedAt)-Date.parse(a.observedAt));
}
function select(event,catalogue,now){const selected=candidatesFor(event,catalogue,now)[0];return selected?{...selected,canonicalFixtureId:event.canonicalEventId||event.id}:null;}
const REFRESH_LIMITS=Object.freeze({deadlineMs:20000,requestMs:3000,concurrency:3,maxBytes:1024*1024,maxEntries:100,maxProgrammes:512});
function sydneyDay(now){const parts=new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(+now));const get=k=>parts.find(p=>p.type===k).value;return get('year')+'-'+get('month')+'-'+get('day');}
function currentWindow(now){const today=sydneyDay(now),end=Date.parse(today+'T00:00:00Z'),days=new Map();for(let i=0;i<=7;i++){const date=new Date(end-i*86400000).toISOString().slice(0,10);days.set(date.slice(5),date);}return {today,days};}
function validObservation(row,now){const stamp=Date.parse(row.observedAt||'');return Number.isFinite(stamp)&&stamp<=now&&now-stamp<=MAX_AGE_MS;}
function currentRow(row,window,allowed,sourceDates=new Map()){const edition=season(row.season),date=window.days.get(row.sourceMonthDay)||sourceDates.get(row.competitionId+'|'+edition)?.get(row.sourceMonthDay);if(!date||!edition)return false;if(!edition.includes('/'))return edition===date.slice(0,4);return allowed.get(row.competitionId)?.has(edition)||false;}
function displayEntry(entry){let fields={};try{const part=new URL(entry.imageURL).pathname.match(/^\/tile\/[^.]+\.([^.]+)\.[^.]+$/)?.[1];if(part){const decoded=JSON.parse(Buffer.from(part,'base64url').toString('utf8'));const params=new URLSearchParams(decoded.Params);fields={sourceDateText:params.get('desc'),durationText:params.get('duration'),shortform:params.get('shortform')};}}catch{}return {guid:entry.guid,title:entry.title,type:entry.type,isSportBundle:entry.isSportBundle,...fields};}
async function boundedRead(url,{fetchImpl,signal,requestMs,maxBytes}){
  const controller=new AbortController();let timer,abort;
  const work=async()=>{const response=await fetchImpl(url,{signal:controller.signal,redirect:'error',headers:{Accept:'application/json,text/html;q=0.9'}});if(response.status!==200)throw Error('source_http');const declared=Number(response.headers?.get('content-length'));if(Number.isFinite(declared)&&declared>maxBytes)throw Error('source_size');if(!response.body?.getReader)throw Error('source_body');const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>maxBytes)throw Error('source_size');chunks.push(Buffer.from(item.value));}}finally{await reader.cancel().catch(()=>{});}return Buffer.concat(chunks).toString('utf8');};
  try{return await Promise.race([work(),new Promise((_,reject)=>{abort=()=>{controller.abort();reject(Error('source_aborted'));};if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{controller.abort();reject(Error('source_timeout'));},Math.ceil(requestMs));})]);}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
async function refreshCatalogue({previousCatalogue={schemaVersion:SCHEMA_VERSION,programmes:[]},fetchImpl=globalThis.fetch,now=Date.now(),signal,events=[],deadlineMs=REFRESH_LIMITS.deadlineMs}={}){
  now=+now;if(!Number.isFinite(now))throw Error('invalid_refresh_time');
  const window=currentWindow(now),allowed=new Map(),sourceDates=new Map(),add=(id,value)=>{const edition=season(value);if(!id||!edition)return;if(!allowed.has(id))allowed.set(id,new Set());allowed.get(id).add(edition);};
  const previous=previousCatalogue.schemaVersion===SCHEMA_VERSION?(previousCatalogue.programmes||[]):[];
  // Previously reviewed live-window editions or canonical fixture editions establish season identity.
  for(const row of previous)if(validObservation(row,now)&&window.days.has(row.sourceMonthDay))add(row.competitionId,row.season);
  for(const event of events)if(window.days.get(String(event.date||'').slice(5))===event.date){const id=competition(event.competitionId),edition=season(event.season||event.footballMatchContext?.season);add(id,edition);const key=id+'|'+edition;if(!sourceDates.has(key))sourceDates.set(key,new Map());sourceDates.get(key).set(event.date.slice(5),event.date);const start=Date.parse(event.actualStartTimeUtc||event.startTimeUtc||'');if(Number.isFinite(start)){const utcDate=new Date(start).toISOString().slice(0,10);sourceDates.get(key).set(utcDate.slice(5),utcDate);}}
  const retained=previous.filter(row=>validObservation(row,now)&&currentRow(row,window,allowed,sourceDates));
  const replacements=new Map(),failures=[],withdrawn=new Set(),started=performance.now(),deadline=Math.max(1,Math.min(REFRESH_LIMITS.deadlineMs,Number(deadlineMs)||REFRESH_LIMITS.deadlineMs));
  const jobs=Object.entries(feedIds);let next=0;
  const read=async url=>{const remaining=deadline-(performance.now()-started);if(remaining<1||signal?.aborted)throw Error('refresh_deadline');return boundedRead(url,{fetchImpl,signal,requestMs:Math.min(REFRESH_LIMITS.requestMs,remaining),maxBytes:REFRESH_LIMITS.maxBytes});};
  const worker=async()=>{for(;;){const index=next++;if(index>=jobs.length)return;const [slug,kinds]=jobs[index],sourceUrl='https://www.stan.com.au/watch/sport/football/'+slug;let html;try{html=await read(sourceUrl);}catch{failures.push({sourceUrl,stage:'page'});continue;}
    const advertised=[...html.matchAll(/data-feed-load-url="([^"<>]+)"[^>]*>\s*<h2[^>]*>([^<]+)<\/h2>/g)].map(m=>({path:m[1],heading:m[2].replace(/&amp;/g,'&').replace(/&#39;/g,"'")}));
    for(const [kind,id]of Object.entries(kinds)){const feedUrl='https://www.stan.com.au/watch/sport/feed/'+id+'.json',entry=advertised.find(item=>item.path==='/watch/sport/feed/'+id+'.json'&&kindForHeading(item.heading)===kind);if(!entry){withdrawn.add(feedUrl);continue;}
      try{const raw=JSON.parse(await read(feedUrl));if(!Array.isArray(raw.entries))throw Error('source_schema');const feed={sourceUrl,feedUrl,heading:entry.heading,observedAt:new Date(now).toISOString(),entries:raw.entries.slice(0,REFRESH_LIMITS.maxEntries).map(displayEntry)};const rows=normalizeCatalogue([feed]).programmes.filter(row=>currentRow(row,window,allowed,sourceDates));replacements.set(feedUrl,rows);}catch{failures.push({sourceUrl,feedUrl,stage:'feed'});}
    }
  }};
  await Promise.all(Array.from({length:REFRESH_LIMITS.concurrency},()=>worker()));
  const combined=retained.filter(row=>!replacements.has(row.feedUrl)&&!withdrawn.has(row.feedUrl)).concat([...replacements.values()].flat());
  const unique=new Map(combined.map(row=>[row.feedUrl+'|'+row.programId,row]));
  const programmes=[...unique.values()].sort((a,b)=>String(window.days.get(b.sourceMonthDay)).localeCompare(String(window.days.get(a.sourceMonthDay)))||kindRank(a.kind)-kindRank(b.kind)||a.programId.localeCompare(b.programId)||a.feedUrl.localeCompare(b.feedUrl)).slice(0,REFRESH_LIMITS.maxProgrammes);
  const catalogue=!replacements.size&&!withdrawn.size?{...previousCatalogue,schemaVersion:SCHEMA_VERSION,programmes:retained.slice(0,REFRESH_LIMITS.maxProgrammes)}:{schemaVersion:SCHEMA_VERSION,reviewedAt:window.today,retainedWindow:{start:[...window.days.values()].at(-1),end:window.today,basis:'Source display dates and explicit canonical or retained reviewed edition; no publication date inferred'},programmes};
  return {catalogue,failed:failures.length>0,changed:JSON.stringify(catalogue)!==JSON.stringify(previousCatalogue),diagnostics:{checkedAt:new Date(now).toISOString(),successfulFeeds:replacements.size,withdrawnFeeds:withdrawn.size,failures}};
}
module.exports={SCHEMA_VERSION,MAX_AGE_MS,scopes,season,sourceMonthDay,parseTitle,kindForHeading,normalizeCatalogue,candidatesFor,select,REFRESH_LIMITS,refreshCatalogue};

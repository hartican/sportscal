'use strict';
const assert=require('node:assert/strict');
const BASE='https://racingaustralia.horse/FreeFields/';
const text=s=>String(s||'').replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|quot|apos|rsquo|lsquo|ndash|mdash);/g,e=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&rsquo;':"'",'&lsquo;':"'",'&ndash;':'–','&mdash;':'—'})[e]).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function key(e){assert(/^20\d\d-\d\d-\d\d$/.test(e.date),'Unpublished horse race date');return e.date.slice(0,4)+months[+e.date.slice(5,7)-1]+e.date.slice(8)+','+e.state+','+e.meeting;}
function url(e,stage='Acceptances'){assert(['Acceptances','Weights','Nominations','Results'].includes(stage));return BASE+stage+'.aspx?Key='+encodeURIComponent(key(e));}
function parse(html,e,{now=new Date(),sourceUrl}={}){
 assert(typeof html==='string'&&html.length<600000&&/<\/html>\s*$/i.test(html.trim()),'Horse source budget exceeded');
 const meeting=text(html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]||html.match(/class="meeting-header"[^>]*>([\s\S]*?)<\//i)?.[1]);
 const all=text(html),day=+e.date.slice(8),month=['January','February','March','April','May','June','July','August','September','October','November','December'][+e.date.slice(5,7)-1];
 assert(all.includes(e.meeting.replace(/\+/g,' '))&&new RegExp('0?'+day+' '+month+' '+e.date.slice(0,4)).test(all),'Wrong horse meeting/date');
 const meetingInfo=text(html.match(/class="meeting-info"[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
 if(/\bMeeting (?:has been |is )?(?:cancelled|abandoned)\b/i.test(meetingInfo))return {...e.score?.racing,schema:'racing.v1',kind:'horse',eventId:e.id,sessionId:e.id,sessionName:e.name,provider:'Racing Australia',officialUrl:sourceUrl||url(e),providerAt:null,checkedAt:now.toISOString(),phase:'cancelled',status:'cancelled',statusText:'Meeting cancelled',entries:e.score?.racing?.entries||[]};
 const stage=text(html.match(/class="active-tab"[^>]*>([\s\S]*?)<\/div>/i)?.[1]);
 assert(['Nominations','Weights','Acceptances','Results'].includes(stage),'Unverified horse field stage');
 const sections=html.split(/<a name="Race\d+"><\/a>/i).slice(1),matches=sections.filter(s=>new RegExp(e.racePattern,'i').test(text(s.match(/class="race-title"[^>]*>([\s\S]*?)<\/table>/i)?.[1])));
 assert(matches.length===1,'Horse feature race unavailable or ambiguous');const section=matches[0],title=section.match(/class="race-title"[^>]*>([\s\S]*?)<\/table>/i)?.[1]||'',name=text(title.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1]),raceNumber=+name.match(/^Race (\d+)\b/)?.[1];assert(raceNumber,'Unbound feature race');
 const table=section.match(/class="race-strip-fields"[^>]*>([\s\S]*?)<\/table>/i)?.[1];assert(table,'Horse field not published');
 const rows=[...table.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi)],headers=[...rows[0][2].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m=>text(m[1]));assert(rows.length===(table.replace(/<!--[\s\S]*?-->/g,'').match(/<tr\b/gi)||[]).length&&headers.includes('Horse'),'Incomplete horse field headers');
 const entries=rows.slice(1).filter(r=>/EvenRow|OddRow/.test(r[1])).map(r=>{
  const cells=[...r[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m=>m[1]);assert(cells.length===headers.length,'Incomplete horse entry');const fields=Object.fromEntries(headers.map((h,i)=>[h,text(cells[i])])),horse=cells[headers.indexOf('Horse')],code=horse.match(/horsecode=([^&"\s]+)/i)?.[1];assert(code&&fields.Horse,'Missing stable horse identity');
  return {id:'horse:'+decodeURIComponent(code),number:fields['No.']||null,name:fields.Horse,trainer:fields.Trainer||null,jockey:fields.Jockey||null,barrier:fields['Bar.']||fields.Barrier||null,weight:fields.Weight||null,form:fields['Last 10']||null,scratched:/\bScratched\b/i.test(r[1]),position:fields.Finish||null,margin:fields.Margin||null};
 });
 assert(entries.length&&entries.length<=100&&new Set(entries.map(r=>r.id)).size===entries.length,'Incomplete or over-budget horse field');
 const count=section.match(/(?:Total Nominations|Number of (?:Nominations|Acceptances|Runners))\s*:?\s*(\d+)/i);if(count)assert(+count[1]===entries.length,'Incomplete horse collection');
 let phase=stage==='Results'?(/\b(?:Official Results|Results Official|Result Status: Official)\b/i.test(text(title))?'official-result':'provisional-result'):stage==='Acceptances'?(/\bFinal (?:Declarations|Field)\b/i.test(text(title))?'final-declarations':'acceptances'):'nominations';
 const review=e.acceptanceReview,reviewed=phase==='nominations'&&review?.stage==='acceptances'&&/^https:\/\/vrc-prod-cdn[^/]+\/media\//.test(review.sourceUrl||'')&&/^20\d\d-\d\d-\d\d$/.test(review.publishedDate||'')&&review.publishedDate<=now.toISOString().slice(0,10)&&Array.isArray(review.horseIds)&&JSON.stringify([...review.horseIds].sort())===JSON.stringify(entries.map(e=>e.id).sort());
 if(reviewed)phase='acceptances';
 const statusText=reviewed?review.label:({'official-result':'Official results','provisional-result':'Provisional results','final-declarations':'Final declarations',acceptances:'Acceptances',nominations:stage==='Weights'?'Published weights · entry list':'Nominations'})[phase];
 const clock=name.match(/^Race \d+ - (\d{1,2}):(\d{2})(AM|PM)\b/),local=clock?`${(+clock[1]%12)+(clock[3]==='PM'?12:0)}`.padStart(2,'0')+':'+clock[2]:null;
 // These catalogued venues use Sydney/Melbourne local time. Convert only an
 // explicit race-header clock; publication and scratching deadlines are not starts.
 let startTimeUtc=null;if(local){const candidate=Date.parse(e.date+'T'+local+':00Z');for(const offset of [10,11]){const d=new Date(candidate-offset*3600000),formatted=new Intl.DateTimeFormat('en-GB',{timeZone:e.timeZone||'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);if(formatted===local)startTimeUtc=d.toISOString();}assert(startTimeUtc,'Invalid published local start');}
 const published=text(html.match(/Last Published:[\s\S]{0,180}?(?:<br\s*\/?\s*>|<\/[^>]+>)/i)?.[0]);
 return {schema:'racing.v1',kind:'horse',eventId:e.id,sessionId:e.id+':race-'+raceNumber,sessionName:e.name,provider:'Racing Australia',officialUrl:sourceUrl||url(e,stage),...(reviewed?{phaseProvenance:{sourceUrl:review.sourceUrl,publishedDate:review.publishedDate,checkedAt:review.checkedAt}}:{}),providerAt:null,providerClock:published||null,checkedAt:now.toISOString(),phase,status:stage==='Results'?'completed':'upcoming',statusText,raceNumber,raceTime:text(title).match(/\bTime: (\d+:\d{2}\.\d+)\b/)?.[1]||null,startTimeUtc,entries};
}
async function read(e,{fetchImpl=globalThis.fetch,now=new Date(),signal}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000),abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 try{
  const stages=Number.isFinite(Date.parse(e.startTimeUtc))&&+now>=Date.parse(e.startTimeUtc)?['Results']:['Acceptances',e.slug==='melbourne-cup'?'Weights':'Nominations'];let last;
  for(const stage of stages){const sourceUrl=url(e,stage),r=await fetchImpl(sourceUrl,{signal:controller.signal});if(!r.ok)throw Error('Horse source unavailable');const html=await boundedText(r);try{const detail=parse(html,e,{now,sourceUrl}),rank=p=>({'nominations':0,acceptances:1,'final-declarations':2,'provisional-result':3,'official-result':4,cancelled:5})[p]??-1;assert(rank(detail.phase)>=rank(e.score?.racing?.phase),'Older entry stage cannot replace the complete field');return detail;}catch(error){last=error;}}
  throw last;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
async function boundedText(response){
 assert(!(Number(response.headers?.get('content-length'))>600000),'Horse source budget exceeded');
 if(!response.body?.getReader)return response.text();
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;assert(size<=600000,'Horse source budget exceeded');chunks.push(value);}return Buffer.concat(chunks).toString('utf8');}finally{await reader.cancel();}
}
function fixture(e,detail){const at=detail.checkedAt;return {...e,key:'horse-racing',sport:'Horse Racing',kind:'fixture',cardKind:'fixture',score:{racing:detail},status:detail.status,scoreCheckedAt:at,statusCheckedAt:at,sourceCheckedAt:at,sourceName:'Racing Australia',sourceType:'official',officialTimingUrl:detail.officialUrl,...(detail.startTimeUtc?{startTimeUtc:detail.startTimeUtc,time:new Intl.DateTimeFormat('en-GB',{timeZone:'Australia/Sydney',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(detail.startTimeUtc)),timeTbc:false,dateOnly:false,timePrecision:'exact',scheduleStatus:'confirmed',timingProvenance:{sourceUrl:detail.officialUrl,checkedAt:at,basis:'published-race-header'}}:{})};}
function due(e,now){return Number.isFinite(Date.parse(e.startTimeUtc))&&+now>=Date.parse(e.startTimeUtc)-3600000&&!['official-result','cancelled'].includes(e.score?.racing?.phase)&&!['cancelled','abandoned'].includes(e.status);}
function source({published=[],fetchImpl}={}){return {id:'live-horse-features',allowEmpty:true,seed:published.filter(e=>e.key==='horse-racing'),minimumIntervalMs:240000,timeoutMs:12000,refreshInterval:(fixtures,now)=>fixtures.some(e=>due(e,now)&&now<=Date.parse(e.startTimeUtc)+6*3600000)?240000:1800000,fetch:async({now,previous,signal})=>{const candidates=previous.filter(e=>due(e,now)).sort((a,b)=>(Date.parse(a.score?.racing?.checkedAt)||0)-(Date.parse(b.score?.racing?.checkedAt)||0)).slice(0,2),updates=[];for(const e of candidates)updates.push(fixture(e,await read(e,{fetchImpl,now,signal})));return updates.length?updates:previous;}};}
// Describe only retained, reviewed calendar facts and a validated entry stage.
// This is presentation: it must not update the observations or invent a clock.
function preview(e){
 const date=new Date(e.date+'T00:00:00Z');
 assert(Number.isFinite(+date)&&date.toISOString().slice(0,10)===e.date&&e.name&&e.meeting,'Incomplete reviewed horse calendar');
 const when=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',timeZone:'UTC'}).format(date);
 const distance=Number.isInteger(e.distanceMetres)&&e.distanceMetres>0?` over ${e.distanceMetres} metres`:'';
 const detail=e.score?.racing,entries=detail?.entries;
 const phases={nominations:['nominations','Nominations are early entries, not a confirmed final field.'],acceptances:['acceptances','Acceptances are a published entry stage, not final declarations.'],'final-declarations':['final declarations','Published final declarations remain subject to scratchings.']};
 const valid=detail?.schema==='racing.v1'&&detail.kind==='horse'&&detail.eventId===e.id&&phases[detail.phase]&&Array.isArray(entries)&&entries.length>0&&entries.length<=100&&entries.every(r=>r.id&&r.name)&&new Set(entries.map(r=>r.id)).size===entries.length;
 if(e.status==='cancelled')return {hook:`${e.name} is cancelled; retained entry information does not mean the race will run.`,context:'The official cancellation takes priority over the saved calendar and entry list.'};
 const stage=valid?`${entries.length} ${phases[detail.phase][0]} are published`:'the entry list is not yet verified';
 const timing=Number.isFinite(Date.parse(e.startTimeUtc))?'Use the published race time shown on this card.':'The race start time is still unconfirmed.';
 return {hook:`${e.name} is set for ${when} at ${e.meeting}${distance}; ${stage}.`,context:`${valid?phases[detail.phase][1]:'The final field remains unconfirmed.'} ${timing}`};
}
module.exports={parse,read,fixture,key,url,source,due,text,preview};

'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const wrc=require('./wrc-context');
const ROOT=path.resolve(__dirname,'../..');
const NRL_ID='major-match:nrl-finals-2026:grand-final';
const NRL_URL='https://www.nrl.com/draw/nrl-premiership/2026/grand-final/game-1/';
const WRC_ID='event:wrc:2026:round-13';
const paths={results:'data/canonical/official-card-results-2026.json',wrc:'data/canonical/wrc-context-2026.json',incoming:'feeds/incoming/events.json',published:'data/events.json'};
const aliases=e=>[e.id,e.eventId,e.canonicalEventId,...(e.sourceEventIds||[])].filter(Boolean);
function stamp(value,now){const n=Date.parse(value);assert(Number.isFinite(n)&&n<=+now,'invalid/future observation');return new Date(n).toISOString();}
function nrlMatch(html,{checkedAt,now=new Date()}={}){
 assert(/<\/html\s*>/i.test(html),'incomplete NRL response');
 const raw=String(html).match(/id="vue-match-centre"\s+q-data="([^"]+)"/);assert(raw,'missing official match component');
 const decoded=raw[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
 const m=JSON.parse(decoded).match;assert(m&&m.matchId==='20261113110'&&m.url===NRL_URL,'wrong official fixture identity');
 assert(m.roundNumber===31&&m.roundTitle==='Grand Final'&&m.homeTeam?.teamId===500001&&m.awayTeam?.teamId===500003,'wrong competition/participants');
 assert(m.homeTeam.name==='Sydney Roosters'&&m.awayTeam.name==='Newcastle Knights','conflicting official participant names');
 assert(Date.parse(m.startTime)===Date.parse('2026-10-04T08:30:00Z'),'rescheduled final requires review');
 assert(m.matchMode==='Post'&&m.matchState==='FullTime','official final remains unavailable');
 const observed=stamp(checkedAt,now),updated=stamp(m.updated,now);assert(Date.parse(updated)>=Date.parse(m.startTime)&&Date.parse(updated)<=Date.parse(observed),'invalid official result update');
 assert([m.homeTeam.score,m.awayTeam.score].every(n=>Number.isInteger(n)&&n>=0&&n<=200),'invalid paired final score');
 return {id:NRL_ID,status:'completed',homeScore:m.homeTeam.score,awayScore:m.awayTeam.score,
  score:`Roosters ${m.homeTeam.score}-${m.awayTeam.score} Knights`,outcomeText:`Sydney Roosters ${m.homeTeam.score}, Newcastle Knights ${m.awayTeam.score}.`,
  recapText:`The official NRL match centre reports a ${m.homeTeam.score}-${m.awayTeam.score} Grand Final result.`,
  fixtureObservationSchema:'fixture-observations.v1',resultSourceName:'NRL',resultSourceType:'official',resultSourceUrl:NRL_URL,
  resultSourceCheckedAt:observed,scoreCheckedAt:observed,statusCheckedAt:observed,scoreFactObservedAt:observed,resultSourceUpdatedAt:updated,resultPublishedAt:observed};
}
function fiaResult(html,context,{checkedAt,now=new Date()}={}){
 assert(wrc.classificationPageMatchesUrl(html,wrc.CLASSIFICATION_URLS[13]),'wrong FIA classification page');
 assert(/<\/html\s*>/i.test(html),'incomplete FIA response');
 const event=context.events.find(e=>e.id===WRC_ID);assert(event?.roundNumber===13&&event.date==='2026-10-01'&&event.endDate==='2026-10-04'&&event.status!=='cancelled','wrong retained rally');
 const result=wrc.parseFiaClassification(html,{round:{startDate:event.date,endDate:event.endDate}});assert(result?.status==='official','FIA final official classification unavailable');
 const final=html.slice(html.lastIndexOf('FINAL OFFICIAL CLASSIFICATION')),first=final.match(/<tr\s+class="competitor[^\"]*">([\s\S]*?)<\/tr>/i)?.[1];assert(/<td\s+class="position">\s*1\s*<\/td>/.test(first||''),'FIA winning position is not explicit');
 assert(Date.parse(checkedAt)>=Date.parse(event.date+'T00:00:00Z'),'classification observed before rally date');
 const person=(role,name)=>{const people=context.participants.filter(p=>p.displayName===name&&p.metadata?.championshipRole===role);assert(people.length===1,'unknown/ambiguous winning crew');return people[0].id;};
 return {status:'official',driverParticipantId:person('driver',result.driver.name),coDriverParticipantId:person('co-driver',result.coDriver.name),winningCrew:`${result.driver.name} / ${result.coDriver.name}`,vehicle:result.vehicle,totalTime:result.totalTime,sourceUrl:wrc.CLASSIFICATION_URLS[13],checkedAt:stamp(checkedAt,now)};
}
function sameFacts(a,b){const clean=v=>JSON.stringify(v,(k,x)=>['checkedAt','resultSourceCheckedAt','scoreCheckedAt','statusCheckedAt','scoreFactObservedAt','resultSourceUpdatedAt','resultPublishedAt'].includes(k)?undefined:x);return clean(a)===clean(b);}
async function fetchText(url){const r=await fetch(url,{headers:{'user-agent':'Nothingsport-Known-Final-Results/1.0'},signal:AbortSignal.timeout(15000)});assert(r.ok,`source HTTP ${r.status}`);const body=await r.text();return {body,observedAt:new Date().toISOString()};}
async function refresh({root=ROOT,now=new Date(),clock=()=>new Date(),fetchSource=fetchText,nrlOnly=false}={}){
 assert(Number.isFinite(+now),'invalid refresh time');
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
 const changed=[],checks=[],failures=[],writes=[];let requests=0;
 const recent=(start,end)=>Date.parse(start)<=+now&&+now<=Date.parse(end)+14*86400000;
 if(recent('2026-10-04T08:30:00Z','2026-10-04T23:59:59Z'))try{
  const results=read(paths.results),surfaces=[read(paths.incoming),read(paths.published)];
  for(const surface of surfaces){const fixtures=surface.events.filter(e=>aliases(e).includes(NRL_ID));assert(fixtures.length===1,'missing/ambiguous retained NRL final');const e=fixtures[0];assert(e.key==='nrl'&&e.competitionId==='competition:nrl-premiership-2026'&&JSON.stringify(e.participantIds)===JSON.stringify(['team:nrl:331','team:nrl:325'])&&Date.parse(e.startTimeUtc)===Date.parse('2026-10-04T08:30:00Z'),'retained NRL fixture conflicts with reviewed identity');}
  requests++;const receipt=await fetchSource(NRL_URL),next=nrlMatch(receipt.body,{checkedAt:receipt.observedAt,now:clock()}),matches=results.results.filter(r=>aliases(r).includes(NRL_ID)||r.id==='major-match-nrl-finals-2026-grand-final');assert(matches.length<=1,'ambiguous NRL result ledger');const prior=matches[0];
  if(prior){assert(Date.parse(next.resultSourceCheckedAt)>=Date.parse(prior.resultSourceCheckedAt||prior.sourceCheckedAt||results.checkedAt),'stale NRL observation');if(!sameFacts(prior,next))assert(!prior.resultSourceUpdatedAt||Date.parse(next.resultSourceUpdatedAt)>Date.parse(prior.resultSourceUpdatedAt),'conflicting final has no newer source update');}
  if(!prior||!sameFacts(prior,next)){const document={...results,results:[...results.results.filter(r=>r!==prior),next]};writes.push([paths.results,document]);changed.push('NRL known final');}
  checks.push({fixtureId:NRL_ID,sourceUrl:NRL_URL,state:'primary-final',observedAt:receipt.observedAt,changed:changed.includes('NRL known final')});
 }catch(e){failures.push({fixtureId:NRL_ID,sourceUrl:NRL_URL,message:e.message});}
 if(!nrlOnly&&recent('2026-10-01T00:00:00Z','2026-10-04T23:59:59Z'))try{
  const context=read(paths.wrc);
  requests++;const receipt=await fetchSource(wrc.CLASSIFICATION_URLS[13]),next=fiaResult(receipt.body,context,{checkedAt:receipt.observedAt,now:clock()}),old=context.events.find(e=>e.id===WRC_ID)?.result;
  if(old?.checkedAt){assert(Date.parse(next.checkedAt)>=Date.parse(old.checkedAt),'stale FIA observation');if(!sameFacts(old,next))assert(Date.parse(next.checkedAt)>Date.parse(old.checkedAt),'conflicting FIA final has no newer observation');}
  if(!old||!sameFacts(old,next)){const document={...context,events:context.events.map(e=>e.id===WRC_ID?{...e,status:'completed',result:next}:e),ladderSnapshots:context.ladderSnapshots.map(s=>({...s,stale:true,metadata:{...s.metadata,staleNote:'Standings have not been rechecked after the retained Round 13 final.'}}))};assert.deepEqual(wrc.validateWrcContext(document),[]);writes.push([paths.wrc,document]);changed.push('WRC known final');}
  checks.push({fixtureId:WRC_ID,sourceUrl:wrc.CLASSIFICATION_URLS[13],state:'primary-final',observedAt:receipt.observedAt,changed:changed.includes('WRC known final')});
 }catch(e){failures.push({fixtureId:WRC_ID,sourceUrl:wrc.CLASSIFICATION_URLS[13],message:e.message});}
 // Each independent complete source validates before its own replacement. The
 // canonical quick owner supplies whole-run rollback if later release QA fails.
 for(const [file,document] of writes){const target=path.join(root,file),temporary=target+'.known-final.tmp';fs.writeFileSync(temporary,JSON.stringify(document,null,2)+'\n');fs.renameSync(temporary,target);}
 return {schemaVersion:'known-final-results.v1',checkedAt:now.toISOString(),changed,checks,failures,requests,maxRequests:2,aiCalls:0};
}
function projectFinals(events,{results,context}){
 const official=require('../sync-official-card-results'),{resultFields}=require('../sync-wrc-to-feed'),{storylineFor,spoilerSafeRootCopy}=require('./storyline-card-rules');
 const final=results.results.filter(r=>r.id===NRL_ID);assert(final.length<=1,'ambiguous retained NRL result');
 const rally=context.events.find(e=>e.id===WRC_ID),changes=new Set();
 if(final.length){const cards=events.filter(e=>aliases(e).includes(NRL_ID));assert.equal(cards.length,1,'missing/ambiguous retained NRL card');const e=cards[0];assert(e.key==='nrl'&&e.competitionId==='competition:nrl-premiership-2026'&&JSON.stringify(e.participantIds)===JSON.stringify(['team:nrl:331','team:nrl:325'])&&Date.parse(e.startTimeUtc)===Date.parse('2026-10-04T08:30:00Z')&&!/cancelled|postponed|abandoned/.test(e.status||''),'retained NRL card identity/status conflicts');}
 if(rally?.result?.status==='official'){const cards=events.filter(e=>aliases(e).includes(WRC_ID));assert.equal(cards.length,1,'missing/ambiguous retained WRC card');assert(cards[0].key==='wrc'&&cards[0].date===rally.date&&cards[0].endDate===rally.endDate&&!/cancelled|postponed|abandoned/.test(cards[0].status||''),'retained WRC card identity/status conflicts');}
 function newerCard(event,next){const observed=Date.parse(event.scoreCheckedAt||event.resultSourceCheckedAt||''),candidate=Date.parse(next.scoreCheckedAt||next.resultSourceCheckedAt||'');if(!Number.isFinite(observed)||!Number.isFinite(candidate)||observed<candidate)return false;const existing=Object.fromEntries(Object.keys(next).filter(k=>!['id','resultPublishedAt'].includes(k)).map(k=>[k,event[k]])),incoming={...next};delete incoming.id;delete incoming.resultPublishedAt;if(sameFacts(existing,incoming))return true;assert(observed<candidate,'conflicting final cannot replace an equal/newer card observation');return false;}
 const next=events.map(event=>{
  if(final.length&&aliases(event).includes(NRL_ID)){
   const result=final[0],keys=Object.keys(result).filter(k=>!['id','resultPublishedAt'].includes(k));
   if(keys.every(k=>JSON.stringify(event[k])===JSON.stringify(result[k])))return event;
   if(newerCard(event,result))return event;
   changes.add('NRL');return official.applyOfficialResults([event],{results:[result]}).events[0];
  }
  if(rally?.result?.status==='official'&&aliases(event).includes(WRC_ID)){
   const facts={...resultFields(rally),fixtureObservationSchema:'fixture-observations.v1',scoreCheckedAt:rally.result.checkedAt,statusCheckedAt:rally.result.checkedAt,scoreFactObservedAt:rally.result.checkedAt};
   if(Object.keys(facts).every(k=>JSON.stringify(event[k])===JSON.stringify(facts[k])))return event;
   if(newerCard(event,facts))return event;
   const card={...event,...facts,resultPublishedAt:event.resultPublishedAt||rally.result.checkedAt,lastReviewedAt:rally.result.checkedAt};
   card.storyline=storylineFor(card);const safe=spoilerSafeRootCopy(card,card.storyline);card.selectedSentence=safe.hook;card.fullSpiel=safe.synopsis;delete card.editorialPreview;
   changes.add('WRC');return card;
  }
  return event;
 });
 return {events:next,changes:[...changes]};
}
function projectRetained({root=ROOT}={}){
 const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8')),results=read(paths.results),context=read(paths.wrc),changes=new Set();
 const prepared=[paths.incoming,paths.published].map(file=>{const document=read(file),projected=projectFinals(document.events,{results,context});projected.changes.forEach(c=>changes.add(c));return {file,document:{...document,events:projected.events},changed:projected.changes.length>0};});
 for(const p of prepared)if(p.changed)fs.writeFileSync(path.join(root,p.file),JSON.stringify(p.document,null,2)+'\n');
 return {changes:[...changes]};
}
module.exports={refresh,nrlMatch,fiaResult,sameFacts,projectFinals,projectRetained,NRL_ID,NRL_URL,WRC_ID};

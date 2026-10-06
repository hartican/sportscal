'use strict';
const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),FILE='data/canonical/tennis-scoreboard.v1.json';
// Exact publisher tournament identity and draw, not calendar overlap or player rank.
const EDITIONS=[
 {publisher:'959',tour:'atp',family:'atp-beijing',name:'China Open',draw:32},
 {publisher:'959',tour:'wta',family:'wta-beijing',name:'China Open',draw:128},
 {publisher:'5',tour:'atp',family:'atp-tokyo',name:'Kinoshita Group Japan Open Tennis Championships',draw:32},
 {publisher:'315',tour:'atp',family:'atp-shanghai',name:'Rolex Shanghai Masters',draw:128},
 {publisher:'381',tour:'wta',family:'wta-wuhan',name:'Wuhan Open',draw:64},
];
const dayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const fail=s=>{throw Error('Tennis scoreboard: '+s);};
const canonical=e=>String(e.canonicalEventId||e.eventId||e.id);
const terminal=e=>['completed','finished','final','cancelled','abandoned'].includes(e?.status);
function sourceUrl(tour,now){if(!['atp','wta'].includes(tour))fail('unknown tour');return `https://site.api.espn.com/apis/site/v2/sports/tennis/${tour}/scoreboard?dates=${new Date(now).toISOString().slice(0,10).replace(/-/g,'')}`;}
function round(label,draw){
 if(['Quarterfinal','Semifinal','Final'].includes(label))return label==='Quarterfinal'?'Quarterfinal':label==='Semifinal'?'Semifinal':'Final';
 const n=String(label).match(/^Round ([1-4])$/);if(!n)fail('unreviewed round '+label);
 return `Round of ${draw/2**(Number(n[1])-1)}`;
}
function parse(payload,{tour,checkedAt,now=new Date(),catalogue,requestUrl}={}){
 const checked=Date.parse(checkedAt);if(!Number.isFinite(checked)||checked>+now||+now-checked>6*3600000)fail('invalid or stale observation');
 if(!Array.isArray(payload?.events)||payload.events.length>24||payload.leagues?.[0]?.slug!==tour)fail('invalid tournament collection');
 const fixtures=[],gaps=[],seen=new Set(),editions=[];
 for(const event of payload.events){
  const season=event.season?.year,entry=EDITIONS.find(s=>s.tour===tour&&event.id===`${s.publisher}-${season}`);
  if(!entry)continue;
  const tournament=catalogue.tournaments.find(t=>t.providerId===`${entry.family}-${season}`&&t.tour.toLowerCase()===tour);
  if(!tournament){gaps.push({id:event.id,reason:'unreviewed-edition'});continue;}
  if(event.name!==entry.name||!Number.isInteger(season)||season!==new Date(now).getUTCFullYear()||!Array.isArray(event.groupings))fail('edition mismatch');
  const grouping=event.groupings.find(g=>g.grouping?.slug===(tour==='atp'?'mens-singles':'womens-singles'));
  if(!grouping||!Array.isArray(grouping.competitions)||grouping.competitions.length>256)fail('missing singles collection');
  editions.push({tournamentId:tournament.tournamentId,publisherEventId:event.id,publishedContests:grouping.competitions.length,checkedAt});
  for(const match of grouping.competitions){
   if(!/^\d+$/.test(match.id)||seen.has(match.id))fail('duplicate match identity');seen.add(match.id);
   if(/Qualifying/.test(match.round?.displayName||''))continue;
   const players=[...(match.competitors||[])].sort((a,b)=>a.order-b.order);
   if(players.length!==2)fail('invalid participant pair');
   if(players.some(p=>!/^\d+$/.test(p.id)||['TBD','BYE','Bye'].includes(p.athlete?.displayName))){gaps.push({id:match.id,reason:'unassigned-participant'});continue;}
   if(new Set(players.map(p=>p.id)).size!==2||players.some(p=>!p.athlete?.displayName||![1,2].includes(p.order))||new Set(players.map(p=>p.order)).size!==2)fail('ambiguous participants');
   const state=match.status?.type?.name,states={STATUS_FINAL:'completed',STATUS_SCHEDULED:'scheduled',STATUS_IN_PROGRESS:'live',STATUS_SUSPENDED:'suspended',STATUS_POSTPONED:'postponed',STATUS_CANCELED:'cancelled',STATUS_RETIRED:'completed',STATUS_WALKOVER:'completed'};
   const status=states[state];if(!status||match.status.type.completed===true&&status!=='completed')fail('unreviewed or conflicting state '+state);
   const start=Date.parse(match.date);if(!Number.isFinite(start))fail('invalid match date');
   const date=dayFormat.format(new Date(start));if(date<tournament.startDate&&Date.parse(tournament.startDate+'T00:00Z')-start>7*86400000||date>tournament.endDate&&start-Date.parse(tournament.endDate+'T00:00Z')>2*86400000)fail('match outside edition');
   const roundLabel=round(match.round?.displayName,entry.draw),id=`fixture:tennis:espn:${tour}:${match.id}`;
   const participants=players.map(p=>{const name=p.athlete.displayName,key=`competitor:tennis:${tour}:${slug(name)}`,known=catalogue.athletes.find(a=>a.athleteId===key);return {id:key,name:known?.displayName||name,displayName:known?.displayName||name,type:'athlete',entityType:'athlete',sportDomainId:'sport:tennis',...(known?.nationalityCode?{countryCode:require('../config/country-flags').alpha2(known.nationalityCode)}:{})};});
   const url=`https://www.espn.com/tennis/matchstats?gameId=${match.id}`,level=String(tournament.level).match(/(\d+)$/)?.[1]||tournament.level;
   const fixture={id,eventId:id,canonicalEventId:id,sourceEventIds:[id],key:'tennis',sport:'Tennis',sportDomainId:'sport:tennis',competitionId:tournament.competitionId,competitionName:tournament.name,tournamentId:tournament.tournamentId,tennisTournamentId:tournament.tournamentId,tournamentName:tournament.name,eventFamilyId:require('../config/tournament-schedule').family(tournament),tour:tour.toUpperCase(),gender:tour==='wta'?'women':'men',discipline:'singles',eventType:tour==='wta'?'womens-singles':'mens-singles',season,tennisProviderMatchId:match.id,tennisProviderEventId:event.id,tennisProviderTour:tour,tournamentLevel:level,round:roundLabel==='Final'?'final':'knockout',roundLabel,stage:roundLabel,name:participants.map(p=>p.name).join(' v '),date,time:null,startTimeUtc:null,estimatedStartTimeUtc:new Date(start).toISOString(),timePrecision:'unresolved',scheduleStatus:'unresolved',timeTbc:true,scheduleNote:'Publisher planning time; official match start unconfirmed.',status,cardKind:'fixture',kind:'fixture',contestUnit:'match',participantsConfirmed:true,participantIds:participants.map(p=>p.id),participants,homeParticipantId:participants[0].id,awayParticipantId:participants[1].id,venue:match.venue?.court||tournament.city,venueCity:tournament.city,sourceName:'ESPN',sourceType:'reputable',sourceUrl:url,sourceCheckedAt:checkedAt,statusCheckedAt:checkedAt,statusSourceUrl:url,statusSourceName:'ESPN',sourceRefs:[url,requestUrl||sourceUrl(tour,now)],broadcaster:'Australian viewing unconfirmed',viewingOptions:[],expected:null,liveWindow:5};
   if(['completed','live','suspended'].includes(status)){
    const lines=players.map(p=>p.linescores||[]);if(lines[0].length!==lines[1].length||lines[0].length>5)fail('unpaired set scores');
    if(status==='completed'&&players.filter(p=>p.winner===true).length!==1)fail('ambiguous winner');
    const sets=lines[0].map((s,i)=>{const away=lines[1][i];if(!Number.isInteger(s.value)||!Number.isInteger(away.value)||s.value<0||away.value<0||s.value>99||away.value>99)fail('invalid set score');return {home:s.value,away:away.value,...(Number.isInteger(s.tiebreak)||Number.isInteger(away.tiebreak)?{homeTiebreak:s.tiebreak??null,awayTiebreak:away.tiebreak??null}:{})};});
    if(status==='completed'&&!sets.length&&!/walkover/i.test(state+' '+(match.notes||[]).map(n=>n.text).join(' ')))fail('missing completed scores');
    if(sets.length){fixture.sets=sets;fixture.score=sets.map(s=>`${s.home}–${s.away}`).join(', ');fixture.scoreDisplay=fixture.score;fixture.scoreCheckedAt=checkedAt;fixture.resultSourceUrl=url;fixture.resultSourceCheckedAt=checkedAt;}
    if(status==='completed'){const special=/retir|walkover/i.test(state+' '+(match.notes||[]).map(n=>n.text).join(' '));if(!special){const wins=sets.filter(s=>s.home>s.away).length,losses=sets.filter(s=>s.away>s.home).length;if(sets.some(s=>s.home===s.away)||Math.max(wins,losses)!==2||sets.length>3||(wins>losses)!==players[0].winner)fail('winner conflicts with completed set scores');}fixture.winnerParticipantId=participants[players.findIndex(p=>p.winner===true)].id;fixture.loserParticipantId=participants.find(p=>p.id!==fixture.winnerParticipantId).id;fixture.eliminatedParticipantIds=[fixture.loserParticipantId];fixture.resultStatus='published';fixture.result=fixture.score||'Walkover';fixture.resultLabels=[/retir/i.test(state+' '+(match.notes||[]).map(n=>n.text).join(' '))?'Retirement':'Completed'];fixture.outcomeText=`${participants.find(p=>p.id===fixture.winnerParticipantId).name} won. ${fixture.score||'Walkover'}`;fixture.recapText=`ESPN reports ${participants.find(p=>p.id===fixture.winnerParticipantId).name} as the winner of this ${roundLabel.toLowerCase()} match. ${fixture.score||'Walkover'}`;}
   }
   fixtures.push(fixture);
  }
 }
 return {fixtures,gaps,editions};
}
const person=id=>String(id||'').replace(/^(?:athlete|competitor):tennis:(?:(?:atp|wta):)?/,'');
const pair=e=>[...(e.participantIds||[])].map(person).sort().join('|');
const timingKeys=['sourceUrl','sourceName','sourceType','sourceCheckedAt','canonicalSourceCheckedAt','date','time','startTimeUtc','timePrecision','scheduleStatus','timeTbc','timingVerified','timingEvidence','schedulingWindow','scheduleNote'];
function merge(previous,incoming,{now=new Date()}={}){
 const result=new Map(previous.map(e=>[canonical(e),e]));
 for(let next of incoming){
  let old=[...result.values()].find(e=>canonical(e)===canonical(next)||(e.sourceEventIds||[]).includes(next.id)||e.tennisProviderTour===next.tennisProviderTour&&e.tennisProviderMatchId===next.tennisProviderMatchId||[e.tennisTournamentId,e.tournamentId].includes(next.tennisTournamentId)&&pair(e)===pair(next)&&String(e.roundLabel||e.stage||'').toLowerCase()===next.roundLabel.toLowerCase());
  if(old){
   if(canonical(old).startsWith('fixture:tennis:espn:')){old={...old,expected:null};delete old.stakesScore;result.set(canonical(old),old);}
   const reviewed=require('../feeds/provider-exports/tennis/participant-fixtures-reviewed.v1.json').events.find(e=>canonical(e)===canonical(old));
   next={...next,name:reviewed?.name||old.name,competitionId:reviewed?.competitionId||old.competitionId};
   if(pair(old)!==pair(next))fail('retained participant identity changed');
   if(terminal(old)&&!terminal(next))continue;
   // An existing organiser final is stronger than this publisher observation.
   if(terminal(old)&&old.resultEvidence?.kind==='official-draw-result'){result.set(canonical(old),{...old,name:next.name,...(next.status==='completed'&&next.score?{outcomeText:next.outcomeText,recapText:next.recapText}:{}),competitionId:next.competitionId,eventFamilyId:next.eventFamilyId,tournamentLevel:next.tournamentLevel,tennisProviderTour:next.tennisProviderTour,tennisProviderMatchId:next.tennisProviderMatchId,tennisProviderEventId:next.tennisProviderEventId,sourceEventIds:[...new Set([...(old.sourceEventIds||[]),next.id])]});continue;}
   if(person(old.homeParticipantId)===person(next.awayParticipantId)){next={...next,homeParticipantId:old.homeParticipantId,awayParticipantId:old.awayParticipantId,participantIds:old.participantIds,participants:[...next.participants].reverse(),...(next.sets?{sets:next.sets.map(s=>({...s,home:s.away,away:s.home,homeTiebreak:s.awayTiebreak,awayTiebreak:s.homeTiebreak}))}:{})};if(next.sets){next.score=next.scoreDisplay=next.sets.map(s=>`${s.home}–${s.away}`).join(', ');if(next.status==='completed')next.result=next.score;}}
   const organiser=old.timingEvidence?.clockAssociation||old.sourceType==='official';
   const ids=new Map(next.participants.map(p=>[p.id,(old.participantIds||[]).find(id=>person(id)===person(p.id))||p.id]));
   next={...next,participantIds:next.participantIds.map(id=>ids.get(id)||id),participants:next.participants.map(p=>({...p,id:ids.get(p.id)||p.id})),homeParticipantId:ids.get(next.homeParticipantId)||next.homeParticipantId,awayParticipantId:ids.get(next.awayParticipantId)||next.awayParticipantId,...(next.winnerParticipantId?{winnerParticipantId:ids.get(next.winnerParticipantId)||next.winnerParticipantId,loserParticipantId:ids.get(next.loserParticipantId)||next.loserParticipantId,eliminatedParticipantIds:next.eliminatedParticipantIds.map(id=>ids.get(id)||id)}:{})};
   if(next.status==='completed'&&next.score){const winner=next.participants.find(p=>p.id===next.winnerParticipantId)?.name;next.outcomeText=`${winner} won. ${next.score}`;next.recapText=`ESPN reports ${winner} as the winner of this ${next.roundLabel.toLowerCase()} match. ${next.score}`;}
   const sameScore=terminal(old)&&next.status==='completed'&&old.score==null?{...old,score:old.result}:old;
   const facts=['status','score','winnerParticipantId','roundLabel',...(!organiser?['estimatedStartTimeUtc']:[])];
   if(facts.every(k=>JSON.stringify(sameScore[k])===JSON.stringify(next[k]))&&next.status!=='live'){result.set(canonical(old),{...old,name:next.name,...(next.status==='completed'&&next.score?{outcomeText:next.outcomeText,recapText:next.recapText}:{}),competitionId:next.competitionId,eventFamilyId:next.eventFamilyId,tournamentLevel:next.tournamentLevel,tennisProviderTour:next.tennisProviderTour,tennisProviderMatchId:next.tennisProviderMatchId,tennisProviderEventId:next.tennisProviderEventId,sourceEventIds:[...new Set([...(old.sourceEventIds||[]),next.id])],...(!old.recapText&&next.recapText?{recapText:next.recapText}:{})});continue;}
   next={...old,...next,id:old.id,eventId:old.eventId||old.id,canonicalEventId:canonical(old),sourceEventIds:[...new Set([...(old.sourceEventIds||[]),next.id])],...(organiser?Object.fromEntries(timingKeys.filter(k=>old[k]!==undefined).map(k=>[k,old[k]])):{}),...(old.viewingOptions?.length?{viewingOptions:old.viewingOptions,broadcaster:old.broadcaster}:{}),...(old.timingEvidence?{estimatedStartTimeUtc:old.estimatedStartTimeUtc||null}:{})};
   for(const field of ['actualEndTimeUtc','completedAt','resultEvidence','resultAvailabilityEvidence','statusEvidence'])delete next[field];
   // Do not retain preview/live result text after a new final.
   if(next.status==='completed'){delete next.storyline;delete next.editorialPreview;delete next.selectedSentence;delete next.fullSpiel;}
   result.set(canonical(old),next);
  }else result.set(canonical(next),next);
 }
 return [...result.values()];
}
async function observe({tour,now=new Date(),date=now,fetchImpl=globalThis.fetch,catalogue,signal}={}){
 const url=sourceUrl(tour,date),signals=[AbortSignal.timeout(15000),...(signal?[signal]:[])];
 const response=await fetchImpl(url,{signal:AbortSignal.any(signals),headers:{accept:'application/json','user-agent':'nothingSport canonical refresh/1.0'}});
 if(!response.ok)fail('source returned '+response.status);
 const stamp=response.headers?.get('date'),checkedAt=Number.isFinite(Date.parse(stamp))?new Date(stamp).toISOString():new Date().toISOString();
 return {tour,url,...parse(await response.json(),{tour,checkedAt,now:new Date(Math.max(+now,Date.now())),catalogue,requestUrl:url})};
}
async function refresh({now=new Date(),fetchImpl=globalThis.fetch,root=ROOT,catalogue=JSON.parse(fs.readFileSync(path.join(root,'data/canonical/tennis-catalogue-2026.json')))}={}){
 const requests=['atp','wta'].flatMap(tour=>[0,7].map(offset=>({tour,date:new Date(+now+offset*86400000)})));
 const results=await Promise.all(requests.map(async ({tour,date})=>{try{return await observe({tour,date,now,fetchImpl,catalogue});}catch(e){return {tour,url:sourceUrl(tour,date),fixtures:[],gaps:[],editions:[],failure:e.message};}}));
 const updates=[...new Map(results.flatMap(r=>r.fixtures).sort((a,b)=>Date.parse(a.statusCheckedAt)-Date.parse(b.statusCheckedAt)).map(f=>[f.id,f])).values()],file=path.join(root,FILE),retained=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)): {schemaVersion:'tennis-scoreboard.v1',fixtures:[],editions:[]};
 const plans=[];let changed=false;
 for(const target of ['feeds/incoming/events.json','data/events.json']){const p=path.join(root,target),before=fs.readFileSync(p,'utf8'),doc=JSON.parse(before),events=merge(doc.events,updates,{now});if(JSON.stringify(events)!==JSON.stringify(doc.events)){const issues=require('../scripts/lib/feed-utils').validateFeed({...doc,events});if(issues.length)fail(issues[0]);plans.push([p,JSON.stringify({...doc,events},null,2)+'\n']);changed=true;}}
 const fixtures=merge(retained.fixtures,updates,{now}),editions=[...new Map(results.flatMap(r=>r.editions).map(e=>[e.tournamentId,e])).values()];
 if(JSON.stringify(fixtures)!==JSON.stringify(retained.fixtures))plans.push([file,JSON.stringify({...retained,fixtures,editions,checkedAt:now.toISOString()},null,2)+'\n']);
 for(const [p,content] of plans){fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
 return {changed:changed||plans.length>0,fixtures:updates.length,sourceRequests:4,editions,gaps:results.flatMap(r=>r.gaps),failures:results.filter(r=>r.failure).map(r=>({tour:r.tour,message:r.failure})),checkedAt:now.toISOString()};
}
module.exports={sourceUrl,parse,merge,refresh,observe,EDITIONS};

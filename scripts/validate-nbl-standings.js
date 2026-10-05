'use strict';
const assert=require('node:assert/strict');
const {build}=require('./refresh-nbl-schedule');
const {nblStandingsChanged,nblProjectionSteps}=require('./quick-results');
const schedule=require('../data/canonical/nbl-2026-27.json');
const counts=new Map(schedule.participants.map((p,i)=>[p.id,{name:p.displayName,position:i+1,wins:0,losses:0}]));
for(const f of schedule.events.filter(f=>f.status==='completed'))for(let i=0;i<2;i++)counts.get(f.participantIds[i])[f.result.homeScore>f.result.awayScore?i===0?'wins':'losses':i===1?'wins':'losses']++;
const source={leaguePath:'nbl',year:2026,fallback:false,offset:0,total:165,seasons_meta:[{id:'season-test',name:'NBL27',season_type:'regular',match_count:165}],matches:schedule.events.map(f=>({id:f.providerId,season_id:'season-test',season_type:'regular',starts_at_ms:Date.parse(f.startTimeUtc),round_label:String(f.roundNumber),phase:f.status==='completed'?'complete':f.status==='live'?'live':'upcoming',home:{...counts.get(f.participantIds[0])},away:{...counts.get(f.participantIds[1])},home_score:f.result?.homeScore,away_score:f.result?.awayScore}))};
const now=schedule.generatedAt;
const valid=build(source,now);assert.equal(valid.standings.length,10);assert.equal(valid.standingsStatus,'current');
// Exercise the same adapter, published-record patch and display model used by
// quick refresh. A corrected final cannot inherit the preceding score date.
{
 const {cardForEvent}=require('./sync-requested-sports-to-feed');
 const {patchKnown}=require('./lib/known-fixture-patch');
 const model=require('../config/match-centre');
 const fixture=valid.events.find(event=>event.status==='completed');
 assert(fixture,'Retained NBL season has an observed final for the caller check');
 const card=cardForEvent(fixture,valid,new Map(valid.participants.map(p=>[p.id,p])));
 const oldDate=new Date(Date.parse(now)-86400000).toISOString();
 const prior={...card,scoreCheckedAt:oldDate,resultSourceCheckedAt:oldDate,sourceCheckedAt:oldDate};
 const corrected=patchKnown([{...prior,score:fixture.result.homeScore+'-'+(fixture.result.awayScore+1)}],[card]);
 assert.equal(corrected.count,1);
 assert.equal(corrected.events[0].score,fixture.result.score);
 assert.equal(model.compact(corrected.events[0]).scoreCheckedAt,fixture.result.checkedAt,'Corrected final displays its actual new observation');
 assert.deepEqual(model.compact(corrected.events[0]).score,{home:fixture.result.homeScore,away:fixture.result.awayScore});
 assert.equal(model.compact(corrected.events[0]).homeParticipantId,fixture.participantIds[0]);
 assert.equal(model.compact(corrected.events[0]).awayParticipantId,fixture.participantIds[1]);
 assert.throws(()=>patchKnown([prior],[{...card,homeParticipantId:card.awayParticipantId,awayParticipantId:card.homeParticipantId}]),/participant order/);
 assert.throws(()=>patchKnown([prior],[{...card,awayScore:null}]),/complete decisive/);
 assert.throws(()=>patchKnown([prior],[{...card,awayScore:card.homeScore}]),/complete decisive/);
 const unchanged=patchKnown([prior],[card]);
 assert.equal(unchanged.count,0,'Unchanged final is not a new Feed update');
 assert.equal(unchanged.events[0].scoreCheckedAt,oldDate);
 assert.equal(unchanged.events[0].resultSourceCheckedAt,oldDate);
 const legacy={...prior};delete legacy.scoreCheckedAt;
 const initialized=patchKnown([legacy],[card]);
 assert.equal(initialized.events[0].scoreCheckedAt,oldDate,'Legacy final uses its own observed result date, not the new collection check');
 assert.equal(initialized.events[0].resultSourceCheckedAt,oldDate);
 assert.equal(patchKnown(initialized.events,[card]).count,0,'Repeating the legacy transition does not create another update');
 const legacyPair={...legacy};for(const key of ['homeScore','awayScore','homeParticipantId','awayParticipantId'])delete legacyPair[key];
 const paired=patchKnown([legacyPair],[card]);
 assert.deepEqual(model.compact(paired.events[0]).score,{home:fixture.result.homeScore,away:fixture.result.awayScore});
 assert.equal(paired.events[0].scoreCheckedAt,oldDate,'Named-score enrichment keeps the existing final observation');
 assert.equal(patchKnown(paired.events,[card]).count,0);
 const rescheduled=patchKnown([{...prior,startTimeUtc:new Date(Date.parse(card.startTimeUtc)-3600000).toISOString()}],[card]);
 assert.equal(rescheduled.count,1);
 assert.equal(rescheduled.events[0].startTimeUtc,card.startTimeUtc);
 assert.equal(rescheduled.events[0].scoreCheckedAt,oldDate,'Schedule correction cannot re-date an unchanged final');
 // The normal quick route also crosses incoming -> existing publication.
 // Their legacy sport keys and independent score dates can differ legitimately.
 const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
 const store=fs.mkdtempSync(path.join(os.tmpdir(),'ns-nbl-publication-'));
 try{
  const incoming=path.join(store,'incoming.json'),published=path.join(store,'published.json');
  const base=require('../data/events.json');
  const oldPublished={...legacyPair,key:'nba',scoreCheckedAt:oldDate};
  const newerCollection={...card,key:'basketball',scoreCheckedAt:fixture.result.checkedAt};
  fs.writeFileSync(incoming,JSON.stringify({...base,events:[newerCollection]}));
  fs.writeFileSync(published,JSON.stringify({...base,events:[oldPublished]}));
  cp.execFileSync(process.execPath,[path.join(__dirname,'publish-feed.js'),incoming,published,path.join(store,'meta.json'),path.join(store,'events.js'),'--preserve-known'],{cwd:path.join(__dirname,'..'),stdio:'pipe'});
  const retained=JSON.parse(fs.readFileSync(published)).events[0];
  assert.equal(retained.scoreCheckedAt,oldDate,'actual normal publisher preserves an unchanged final independent date');
  assert.equal(retained.homeScore,card.homeScore,'actual publication retains the named pair enrichment');
  assert.equal(retained.awayScore,card.awayScore);
  fs.writeFileSync(incoming,JSON.stringify({...base,events:[{...newerCollection,score:card.homeScore+'-'+(card.awayScore+1),awayScore:card.awayScore+1}]}));
  cp.execFileSync(process.execPath,[path.join(__dirname,'publish-feed.js'),incoming,published,path.join(store,'meta.json'),path.join(store,'events.js'),'--preserve-known'],{cwd:path.join(__dirname,'..'),stdio:'pipe'});
  assert.equal(JSON.parse(fs.readFileSync(published)).events[0].scoreCheckedAt,fixture.result.checkedAt,'changed final publication accepts the true new date');
 }finally{fs.rmSync(store,{recursive:true,force:true});}
 const upcoming=valid.events.find(event=>event.status==='upcoming');
 assert(upcoming);
 assert(!Object.hasOwn(cardForEvent(upcoming,valid,new Map(valid.participants.map(p=>[p.id,p]))),'scoreCheckedAt'),'Upcoming fixtures acquire no result observation');
}
assert(valid.standings.every(r=>r.played===r.won+r.lost&&r.competitionId==='competition:nbl'&&r.season==='2026-27'&&!Object.hasOwn(r,'drawn')&&!Object.hasOwn(r,'pointsDifference')));
assert.deepEqual(build({...source,matches:[...source.matches].reverse()},now).standings,valid.standings,'displayed official ranks, not provider match order or invented tie-breaks');
const changedTable=edit=>{const p=structuredClone(source);edit(p);const empty=build(p,now);assert.equal(empty.standingsStatus,'unavailable');assert.equal(empty.events.length,165);assert.deepEqual(empty.standings,[]);const kept=build(p,now,valid.standings);assert.equal(kept.standingsStatus,'retained');assert.deepEqual(kept.standings.map(({tableNote,...r})=>r),valid.standings.map(({tableNote,...r})=>r));assert(kept.standings[0].tableNote.includes('out of date'));};
const changed=edit=>{const p=structuredClone(source);edit(p);assert.throws(()=>build(p,now),/NBL/);};
for(const key of ['position','wins','losses'])for(const value of [null,'1',-1,1.5])changedTable(p=>{p.matches[0].home[key]=value;});
changedTable(p=>p.matches[0].home.position=11);
changedTable(p=>p.matches[0].home.wins++);
changedTable(p=>p.matches.forEach(m=>{m.home.position=1;m.away.position=1;}));
changedTable(p=>p.matches.forEach(m=>{if(m.home.name===source.matches[0].home.name)m.home.wins++;if(m.away.name===source.matches[0].home.name)m.away.wins++;}));
changed(p=>p.matches[1].id=p.matches[0].id);
changed(p=>p.matches[0].season_id='wrong');
changed(p=>p.matches[0].phase='postponed');
changed(p=>p.matches[0].starts_at_ms=null);
changed(p=>p.matches[0].away={...p.matches[0].home});
changed(p=>p.matches.find(m=>m.phase==='complete').home_score=null);
changed(p=>{const m=p.matches.find(m=>m.phase==='complete');m.away_score=m.home_score;});
changed(p=>p.matches.find(m=>m.phase==='complete').starts_at_ms=Date.parse(now)+86400000);
for(const edit of [p=>p.fallback=true,p=>p.year=2025,p=>p.leaguePath='wnbl',p=>p.offset=1,p=>p.total++,p=>p.seasons_meta=[]])changed(edit);
assert.equal(nblStandingsChanged(valid.standings,valid.standings.map(r=>({...r,asOf:'2027-01-01T00:00:00Z'}))),false,'observation-only check does not churn projections');
assert(nblStandingsChanged(undefined,valid.standings));
assert.deepEqual(nblProjectionSteps(['NBL standings']),[['scripts/build-code-inspector.js','--codes=nbl']],'standings-only change avoids unrelated Feed republishing');
assert(nblStandingsChanged(valid.standings,valid.standings.map((r,i)=>({...r,rank:i===0?2:i===1?1:r.rank}))),'rank-only correction rebuilds standings even when fixtures are unchanged');
const broken=structuredClone(source);broken.matches[0].home.position=null;assert.deepEqual(build(broken,now,[{rank:1}]).standings,[],'malformed retained table cannot become trusted');
if(process.argv.includes('--published')){
 assert(['current','retained','unavailable'].includes(schedule.standingsStatus));
 assert.equal(schedule.standings.length,schedule.standingsStatus==='unavailable'?0:10);
 if(schedule.standings.length){assert.equal(new Set(schedule.standings.map(r=>r.participantId)).size,10);assert.equal(new Set(schedule.standings.map(r=>r.rank)).size,10);assert(schedule.standings.every(r=>counts.has(r.participantId)&&Number.isInteger(r.rank)&&r.rank>=1&&r.rank<=10&&[r.played,r.won,r.lost].every(n=>Number.isSafeInteger(n)&&n>=0)&&r.played===r.won+r.lost));}
 if(schedule.standingsStatus==='current'){
  const actual=new Map(schedule.standings.map(r=>[r.participantId,r]));
  for(const [id,c] of counts){assert.equal(actual.get(id).won,c.wins);assert.equal(actual.get(id).lost,c.losses);}
 }else if(schedule.standingsStatus==='retained'){
  assert(schedule.standings.every(r=>r.tableNote.includes('out of date')&&Number.isFinite(Date.parse(r.asOf))&&Date.parse(r.asOf)<=Date.parse(schedule.generatedAt)),'retained table must disclose its age; cannot require its old records to equal newer scores');
 }
 assert.deepEqual(require('../data/code-inspector/nbl.json').standings,schedule.standings);
}
console.log('NBL standings: ten published ranks, regular-season result reconciliation, source/identity/status guards, rank-only changes and no observation churn passed.');

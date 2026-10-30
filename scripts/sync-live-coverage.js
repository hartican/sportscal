'use strict';
// Canonical publication reuses the existing refresh owner's observations. No
// provider calls, database writes, account data or new scheduler belong here.
const fs=require('node:fs');
const identity=require('../config/fixture-identity');
const {contentHash}=require('../lib/live-fixtures');
const {supabaseServiceRequest}=require('../lib/supabase-server');
const SOURCES=['cricket-ca-current','cricket-ca-4710','discovery-cricket-history','discovery-cricket-near',...['mru','wru','mrs','wrs'].flatMap(s=>[`discovery-rugby-${s}`,`discovery-rugby-${s}-near`])];
const codeFor=f=>identity.sportKey(f)==='rugby'?'rugby-union':identity.sportKey(f);
const FILE='data/follow-sources/coverage.v1.json',PAGE_SIZE=500,MAX_PAGES=8;
async function readRows(request=supabaseServiceRequest){
 const rows=[],seen=new Set();
 for(let page=0;page<MAX_PAGES;page++){
  const data=await request(`/rest/v1/rpc/nothingsports_read_current_fixtures?source_id=in.(${SOURCES.join(',')})&order=source_id.asc,fixture_id.asc&limit=${PAGE_SIZE}&offset=${page*PAGE_SIZE}`,{method:'POST',body:{p_fixture_ids:null},timeoutMs:10000});
  if(!Array.isArray(data)||data.length>PAGE_SIZE)throw Error('Invalid live coverage page');
  for(const row of data){const id=`${row.source_id}|${row.fixture_id}`;if(!SOURCES.includes(row.source_id)||!row.fixture_id||seen.has(id))throw Error('Invalid or overlapping live coverage page');seen.add(id);rows.push(row);}
  if(data.length<PAGE_SIZE)return rows;
 }
 throw Error('Live coverage exceeded its publication budget; existing coverage retained');
}
function project(previous,rows,{now=new Date(),strictSourceEvidence=false}={}){
 if(!Array.isArray(rows))throw Error('Invalid live coverage collection');
 if(!Number.isFinite(+now))throw Error('Invalid live coverage clock');
 const updates=[],staleIds=new Set(),olderIds=new Set(),deferredResults=[];let stale=0,recent=0;
 const previousById=new Map(previous.events.flatMap(f=>[f.id,f.eventId,f.canonicalEventId,...(f.sourceEventIds||[])].filter(Boolean).map(id=>[id,f])));
 const aliases=f=>[f.id,f.eventId,f.canonicalEventId,...(f.sourceEventIds||[])].filter(Boolean).map(identity.canonicalFixtureId),retainedByAlias=new Map();
 if(strictSourceEvidence)for(const f of previous.events)for(const id of aliases(f)){if(!retainedByAlias.has(id))retainedByAlias.set(id,new Set());retainedByAlias.get(id).add(f);}
 for(const row of rows){
  const f=row.fixture,code=f&&codeFor(f),checked=Date.parse(f?.sourceCheckedAt||f?.canonicalSourceCheckedAt);
  if(!SOURCES.includes(row.source_id)||!f||!['cricket','rugby-union'].includes(code)||f.id!==row.fixture_id||!Number.isFinite(checked))throw Error('Invalid live coverage observation');
  if(strictSourceEvidence&&row.source_id.startsWith('discovery-rugby-')!==(code==='rugby-union'))throw Error('Invalid live coverage source/sport identity');
  // Never substitute a source poll time for the fixture's actual observation.
  if(checked<+now-36*3600000||checked>+now+5*60000){stale++;staleIds.add(f.id);continue;}
  recent++;
  const retained=strictSourceEvidence?[...new Set(aliases(f).flatMap(id=>[...(retainedByAlias.get(id)||[])]))]:[];
  const base=strictSourceEvidence?retained.sort((a,b)=>Date.parse(b.sourceCheckedAt||b.canonicalSourceCheckedAt)-Date.parse(a.sourceCheckedAt||a.canonicalSourceCheckedAt))[0]:previousById.get(f.id);
  if(base&&checked<Date.parse(base.sourceCheckedAt||base.canonicalSourceCheckedAt)){stale++;olderIds.add(f.id);continue;}
  if(strictSourceEvidence&&(f.status==='completed'||f.sourceStatus==='C')){
   const evidence=require('./lib/reconcile-fixture-results');
   const result=code==='rugby-union'?evidence.rugbyResult(f,now):evidence.resultFor(f,now,{strictSourceEvidence:true});
   if(!result||result.unavailable){deferredResults.push({fixtureId:f.id,reason:result?.unavailable||'Unsupported official result evidence'});continue;}
   for(const prior of retained)evidence.assertRetainedCoverage(prior,f,result);
  }
  updates.push(f);
 }
 if(!recent){
  const error=Error('No recent shared coverage observations; existing coverage retained');
  error.liveCoverageReport={checkedAt:now.toISOString(),rowsRead:rows.length,staleObservationsSkipped:stale,staleFixtureIds:[...staleIds].sort(),deferredResults};
  throw error;
 }
 updates.sort((a,b)=>Date.parse(a.sourceCheckedAt||a.canonicalSourceCheckedAt)-Date.parse(b.sourceCheckedAt||b.canonicalSourceCheckedAt));
 const old=new Map(previous.events.map(f=>[f.id,f]));
 const merged=identity.mergeOverlays(previous.events,updates).map(record=>{
  const f=require('../lib/source-observation-identity').normalize(record);
  if(!old.has(f.id))f.canonicalEventId=f.canonicalEventId||f.id;
  if(!old.get(f.id)?.sourceEventIds&&f.sourceEventIds?.every(id=>[f.id,f.eventId,f.canonicalEventId].includes(id)))delete f.sourceEventIds;
  return old.has(f.id)&&contentHash([old.get(f.id)])===contentHash([f])?old.get(f.id):f;
 });
 const changed=merged.filter(f=>!old.has(f.id)||contentHash([old.get(f.id)])!==contentHash([f]));
 const scoreFields=['score','scoreDisplay','homeScore','awayScore','innings','result','fixtureResults'];
 const statusFields=['status','sourceStatus','resultStatus','firstConfirmedCompleteAt'];
 const scheduleFields=['startTimeUtc','endTimeUtc','actualEndTimeUtc','date','endDate','timePrecision','participants','participantIds','homeParticipantId','awayParticipantId'];
 const differs=(before,after,fields)=>contentHash([Object.fromEntries(fields.map(k=>[k,before?.[k]]))])!==contentHash([Object.fromEntries(fields.map(k=>[k,after[k]]))]);
 const scoreChanged=changed.filter(f=>identity.hasScore(f)&&differs(old.get(f.id),f,scoreFields));
 const statusChanged=changed.filter(f=>differs(old.get(f.id),f,statusFields));
 const scoreIds=new Set(scoreChanged.map(f=>f.id)),statusIds=new Set(statusChanged.map(f=>f.id)),changedIds=new Set(changed.map(f=>f.id));
 const sorted=items=>[...new Set(items)].sort();
 const observations={changedFixtureIds:sorted(changedIds),scoreChangedFixtureIds:sorted(scoreIds),statusChangedFixtureIds:sorted(statusIds),
  finalResultChangedFixtureIds:changed.filter(f=>f.status==='completed'&&identity.hasScore(f)&&(scoreIds.has(f.id)||old.get(f.id)?.status!=='completed')).map(f=>f.id).sort(),
  scheduleOnlyChangedFixtureIds:changed.filter(f=>!scoreIds.has(f.id)&&(!statusIds.has(f.id)||!old.has(f.id)&&/^(scheduled|upcoming|pending)$/.test(f.status))&&differs(old.get(f.id),f,scheduleFields)).map(f=>f.id).sort(),
  unchangedFixtureIds:sorted(updates.filter(f=>!changedIds.has(f.id)).map(f=>f.id)),staleFixtureIds:sorted(staleIds),olderFixtureIds:sorted(olderIds),
  missingScoreFixtureIds:merged.filter(f=>f.status==='completed'&&!identity.hasScore(f)).map(f=>f.id).sort()};
 const codes=[...new Set(changed.map(codeFor))].sort();
 const participants=new Map((previous.participants||[]).map(p=>[p.id,p]));
 for(const f of changed)for(const p of f.participants||[])if(p.id&&!participants.has(p.id))participants.set(p.id,{...p,type:'team',displayName:p.name,sportDomainId:f.sportDomainId,leagueId:f.competitionId,sourceRefs:[f.sourceUrl],sourceCheckedAt:f.sourceCheckedAt});
 const competitions=new Map((previous.competitions||[]).map(c=>[c.id,c]));for(const f of changed)if(f.competitionId&&!competitions.has(f.competitionId))competitions.set(f.competitionId,{id:f.competitionId,name:f.competitionName,sport:f.key,scope:f.competitionScope,gender:f.gender});
 return {document:changed.length?{...previous,events:merged,participants:[...participants.values()],competitions:[...competitions.values()]}:previous,report:{checkedAt:now.toISOString(),rowsRead:rows.length,staleObservationsSkipped:stale,changed:changed.length,codes,...observations,deferredResults}};
}
async function sync({now=new Date(),file=FILE,rows,request,strictSourceEvidence=false}={}){
 const previous=JSON.parse(fs.readFileSync(file,'utf8'));
 const result=project(previous,rows||await readRows(request),{now,strictSourceEvidence});
 if(result.report.changed)fs.writeFileSync(file,JSON.stringify(result.document,null,2)+'\n');
 return result.report;
}
module.exports={SOURCES,PAGE_SIZE,MAX_PAGES,readRows,project,sync};

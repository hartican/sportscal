'use strict';
// Refresh entry point is scripts/update-cards.js; no separate scheduler.
const fs=require('node:fs'),path=require('node:path');
const {normalizeLeague,resolveLeagueIdentities,assertSnapshotContinuity,retainFixtureObservations,COMPETITIONS}=require('./lib/openligadb-football');
const registry=require('../config/football-openligadb-identities.json');
const identity=require('../config/fixture-identity');
const DEFAULT_OUTPUT=path.resolve(__dirname,'../data/providers/openligadb/football-2026-27.json');
const clubCrests=new Map(require('../config/football-club-crests.json').clubs.map(c=>[c.participantId,c]));
function eventsForLeague(facts){
  return facts.fixtures.map(fixture=>{
    const id=`fixture:football:openligadb:${facts.competitionId.replace("competition:","")}:${fixture.providerFixtureId}`;
    const participants=fixture.participants.map(p=>({id:p.participantId,participantId:p.participantId,name:p.name,role:p.role,type:'team',teamKind:'club',...(clubCrests.has(p.participantId)?{logoUrl:clubCrests.get(p.participantId).logoUrl,crestSourceUrl:clubCrests.get(p.participantId).sourceUrl}:{})}));
    return identity.normalizeCore({id,eventId:id,canonicalEventId:id,key:'football',sport:'Football',sportDomainId:'sport:football',
      competitionId:facts.competitionId,competitionName:facts.competitionName,competitionScope:'international',season:facts.season,
      stage:'League phase',roundNumber:fixture.roundNumber,roundLabel:`${facts.competitionName.replace('UEFA ','')} Matchday ${fixture.roundNumber}`,
      name:participants.map(p=>p.name).join(' v '),participants,participantIds:participants.map(p=>p.id),homeParticipantId:participants[0].id,awayParticipantId:participants[1].id,
      venue:fixture.venue||null,venueCity:fixture.venueCity||null,...(fixture.venue?{venueSourceUrl:facts.source.url}:{}),
      startTimeUtc:fixture.startTimeUtc,timePrecision:'exact',status:fixture.status,scheduleStatus:'confirmed',gender:'men',isSenior:true,
      sourceType:'community',sourceName:facts.source.name,sourceUrl:facts.source.url,sourceCheckedAt:fixture.sourceCheckedAt||facts.checkedAt,
      sourceAttribution:{provider:'OpenLigaDB',licence:'ODbL',datasetUrl:'/data/providers/openligadb/football-2026-27.json'},
      footballMatchContext:require('./lib/football-match-context').matchContext(facts,fixture),
      ...(fixture.goalScorers?{goalScorers:fixture.goalScorers,goalDetailsCheckedAt:fixture.goalDetailsCheckedAt,goalDetailsStale:fixture.goalDetailsStale===true,scorecardUrl:`https://www.openligadb.de/Match/Id/${fixture.providerFixtureId}`} : {}),
      ...(fixture.result?{...fixture.result,score:`${participants[0].name} ${fixture.result.homeScore}-${fixture.result.awayScore} ${participants[1].name}`,scoreCheckedAt:fixture.scoreCheckedAt||facts.checkedAt,resultSourceUrl:facts.source.url}:{}),
    });
  });
}
async function refresh({outputPath=DEFAULT_OUTPUT,fetchImpl=fetch,now=new Date(),identityRegistry=registry,backupOptions={}}={}){
  if(path.resolve(outputPath)!==DEFAULT_OUTPUT&&!Object.keys(backupOptions).length)backupOptions={outputPath:outputPath+'.delayed-results',directory:path.dirname(outputPath),coordinator:async()=>{throw Error('Backup disabled for disposable primary-source validation');}};
  const previous=fs.existsSync(outputPath)?JSON.parse(fs.readFileSync(outputPath,'utf8')):null;
  const retained=new Map((previous?.leagues||[]).map(f=>[f.competitionId,f]));const failures=[],primaryFailures=[];let backupChanged=false;
  for(const [league,definition] of Object.entries(COMPETITIONS)){
    try{
      const response=await fetchImpl(`https://api.openligadb.de/getmatchdata/${league}/2026`,{headers:{'User-Agent':'NothingSport-canonical-refresh/1.0 (+https://nothingsport.vercel.app/; contact: https://github.com/hartican)'},signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const normalized=resolveLeagueIdentities(normalizeLeague(await response.json(),{league,checkedAt:now.toISOString()}),identityRegistry);
      const prior=retained.get(definition.competitionId);
      assertSnapshotContinuity(prior, normalized);
      const facts=retainFixtureObservations(prior,normalized);
      retained.set(definition.competitionId,facts);
      require('./lib/football-data-backup').primary(eventsForLeague(facts),backupOptions);
      if(league==='ucl')require('./lib/football-data-backup').record({code:'CL',state:'primary',newFinals:0},{...backupOptions,now});
    }catch(error){
      primaryFailures.push({league,message:error.message});
      const saved=retained.get(definition.competitionId);
      const recovery=league==='ucl'&&saved?await require('./lib/football-data-backup').recover({code:'CL',events:eventsForLeague(saved),primaryError:error,...backupOptions}):null;
      if(recovery?.recovered)backupChanged ||= recovery.row.newFinals>0;
      else failures.push({league,message:error.message});
    }
  }
  // Never publish an empty/incomplete first import or erase a last-good season.
  if(retained.size!==2)throw new Error(`OpenLigaDB first import incomplete: ${failures.map(f=>f.league).join(', ')}`);
  const leagues=[...retained.values()];const payload={schemaVersion:'openligadb-football-public.v1',licence:'https://opendatacommons.org/licenses/odbl/1-0/',
    attribution:'Contains information from OpenLigaDB, made available under the Open Database License (ODbL). NS normalized fixture facts and identity mappings are provided with this dataset under ODbL.',
    identityMapping:registry.teams,
    scope:'2026/27 league phases only; community-maintained, not an official UEFA feed',leagues,standings:leagues.flatMap(require('./lib/european-football-standings').deriveStandings),events:leagues.flatMap(eventsForLeague)};
  if(primaryFailures.length===2&&previous)return {payload:previous,failures,primaryFailures,wrote:backupChanged};
  fs.mkdirSync(path.dirname(outputPath),{recursive:true});const temp=`${outputPath}.tmp-${process.pid}`;fs.writeFileSync(temp,JSON.stringify(payload)+'\n');fs.renameSync(temp,outputPath);
  return {payload,failures,primaryFailures,wrote:true};
}
module.exports={refresh,eventsForLeague};

if(require.main===module)refresh().then(result=>{console.log(JSON.stringify({fixtures:result.payload.events.length,failures:result.failures,primaryFailures:result.primaryFailures}));if(result.failures.length)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});

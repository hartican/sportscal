'use strict';
// Factual snapshot projection only. The canonical update-cards owner is the
// sole writer; this module has no provider transport, CLI or scheduled refresh.
const fs=require('node:fs'),path=require('node:path');
const KEY='australian-championship',COMPETITION='competition:australian-championship';
const BASE='https://api.ffa.football/c1143/s2026',COMPETITION_UUID='b07c475b-bbf8-4872-8530-109b90f09dea',SEASON_UUID='833e16c2-ede7-4c51-9f2c-769c2a2fb373';
const RESOURCES=[['summary',BASE+'/summary'],...Array.from({length:9},(_,i)=>['round-'+(i+1),BASE+'/r'+(i+1)+'/fixture']),['ladder',BASE+'/ladder']];
const participantId=id=>'team:football:australian-championship:'+id;
const sourceId=key=>'source:football:australian-championship:2026:'+key;
function requireFact(condition,message){if(!condition)throw Error('Australian Championship: '+message);}
function iso(value,label){requireFact(typeof value==='string'&&Number.isFinite(Date.parse(value)),label+' clock missing/invalid');return value;}
function fields(value,keys,label){
 requireFact(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key)),label+' fields differ');
}
function loadCapture(folder=path.join(__dirname,'../fixtures/australian-championship/2026')){
 return fromFacts(JSON.parse(fs.readFileSync(path.join(folder,'facts.json'),'utf8')));
}
function fromFacts(facts){
 fields(facts,['schemaVersion','competition','season','sources','clubs','groups','rounds'],'factual source');
 requireFact(facts.schemaVersion==='australian-championship-facts.v1','factual schema differs');
 fields(facts.competition,['id','uuid','active_season'],'competition');fields(facts.season,['id','uuid'],'season');
 requireFact(Array.isArray(facts.sources)&&facts.sources.length===11&&Array.isArray(facts.clubs)&&Array.isArray(facts.groups)&&Array.isArray(facts.rounds),'factual inventories missing');
 const receipts={},documents={},teams=new Map();
 for(const source of facts.sources){
  fields(source,['key','url','providerTimestamp','checkedAt'],'source');
  requireFact(RESOURCES.some(([key,url])=>key===source.key&&url===source.url)&&!receipts[source.key],'source route missing/duplicate');
  receipts[source.key]={requestUrl:source.url,finalUrl:source.url,receivedAtUtc:source.checkedAt};
  documents[source.key]={competition:facts.competition,season:facts.season,timestamp:source.providerTimestamp};
 }
 for(const club of facts.clubs){fields(club,['id','uuid','name','abbr','country'],'club');requireFact(!teams.has(club.id),'duplicate club');teams.set(club.id,club);}
 documents.summary.teams=facts.clubs;
 documents.summary.round_info={num_rounds:9,rounds:[]};
 const roundNumbers=new Set();
 for(const round of facts.rounds){
  fields(round,['number','name','matches'],'round');requireFact(Number.isInteger(round.number)&&round.number>=1&&round.number<=9&&!roundNumbers.has(round.number)&&typeof round.name==='string'&&round.name.length&&Array.isArray(round.matches),'round inventory invalid');roundNumbers.add(round.number);
  documents.summary.round_info.rounds.push({number:round.number,name:round.name});
  documents['round-'+round.number].rounds=round.matches.map(match=>{
   fields(match,['id','uuid','last_updated','status','start_date','end_date','timing','time_accuracy','homeClubId','awayClubId','venue','result'],'fixture');
   if(match.venue)fields(match.venue,['id','name','city'],'venue');
   const result=match.result;if(result)fields(result,['home','away','homeShootout','awayShootout','period','winnerId'],'result');
   return {...match,round_number:round.number,round:{number:round.number,name:round.name},home_team:teams.get(match.homeClubId),away_team:teams.get(match.awayClubId),
    match_info:result?{period:result.period,winner_id:result.winnerId,home_team:{score:result.home,shootout_score:result.homeShootout},away_team:{score:result.away,shootout_score:result.awayShootout}}:null};
  });
 }
 documents.ladder.standings=facts.groups.map(group=>{
  fields(group,['id','name','rows'],'group');requireFact(Array.isArray(group.rows),'group rows missing');
  return {group:{id:group.id,name:group.name},team_standings:group.rows.map(row=>{
   fields(row,['clubId','position','played','won','drawn','lost','goals_for','goals_against','goals_difference','points'],'standing');
   const {clubId,...summary}=row;return{team:teams.get(clubId),summary};
  })};
 });
 const capture={documents,receipts};validate(capture);return capture;
}
function validate({documents,receipts}){
 requireFact(documents&&receipts,'captured documents and original receipts required');
 for(const [key,url] of RESOURCES){
  const d=documents[key],r=receipts[key];requireFact(d&&r,key+' body/receipt missing');
  requireFact(d.competition?.id===1143&&d.competition?.uuid===COMPETITION_UUID&&d.competition.active_season===2026&&d.season?.id===2026&&d.season?.uuid===SEASON_UUID,key+' competition/season identity mismatch');
  requireFact(r.requestUrl===url&&r.finalUrl===url,key+' source route differs');iso(d.timestamp,key+' response');iso(r.receivedAtUtc,key+' capture');
  requireFact(Date.parse(d.timestamp)<=Date.parse(r.receivedAtUtc),key+' source response clock is after receipt');
 }
 const summary=documents.summary;requireFact(summary.round_info?.num_rounds===9&&JSON.stringify(summary.round_info.rounds?.map(r=>r.number))===JSON.stringify([1,2,3,4,5,6,7,8,9]),'round inventory differs');
 requireFact(Array.isArray(summary.teams)&&summary.teams.length===16&&new Set(summary.teams.map(t=>t.id)).size===16,'sixteen unique clubs required');
 const teams=new Map(summary.teams.map(t=>{requireFact(Number.isSafeInteger(t.id)&&t.id>0&&t.uuid&&t.name&&t.country==='Australia','invalid sourced club');return[t.id,t];}));
 const groups=documents.ladder.standings;requireFact(Array.isArray(groups)&&groups.length===4&&new Set(groups.map(g=>g.group?.id)).size===4,'four unique published groups required');
 const memberships=new Map();
 for(const g of groups){
  requireFact(g.group?.id&&g.group.name&&Array.isArray(g.team_standings)&&g.team_standings.length===4,'incomplete group table');
  const ranks=new Set();
  for(const row of g.team_standings){
   const team=teams.get(row.team?.id),s=row.summary;requireFact(team&&team.uuid===row.team.uuid&&!memberships.has(team.id),'group club mismatch/duplicate');
   requireFact(s&&Number.isInteger(s.position)&&s.position>=1&&s.position<=4&&!ranks.has(s.position),'invalid source group position');ranks.add(s.position);
   for(const key of ['played','won','drawn','lost','goals_for','goals_against','goals_difference','points'])requireFact(Number.isInteger(s[key]),'missing published group '+key);
   memberships.set(team.id,g.group);
  }
 }
 requireFact(memberships.size===16,'all sixteen group memberships required');
 const matches=[],seen=new Set();
 for(let number=1;number<=9;number++){
  const list=documents['round-'+number].rounds;requireFact(Array.isArray(list),'round'+number+' fixture array missing');
  requireFact(list.length===(number<=6?8:0),'retained round'+number+' publication count differs');
  for(const m of list){
   requireFact(Number.isSafeInteger(m.id)&&m.id>0&&m.uuid&&!seen.has(m.id),'missing/duplicate match identity');seen.add(m.id);
   requireFact(m.round_number===number&&m.round?.number===number,'match round binding differs');
   requireFact(['FullTime','PreMatch'].includes(m.status),'unsupported source match state');
   requireFact(m.timing===1&&m.time_accuracy===1,'retained exact kickoff evidence differs');
   iso(m.start_date,'match start');iso(m.end_date,'scheduled end');iso(m.last_updated,'fixture update');
   requireFact(Date.parse(m.end_date)>=Date.parse(m.start_date)&&Date.parse(m.last_updated)<=Date.parse(receipts['round-'+number].receivedAtUtc),'match timing/update clock invalid');
   for(const side of ['home_team','away_team'])requireFact(teams.get(m[side]?.id)?.uuid===m[side]?.uuid,'unknown fixture club');
   requireFact(m.home_team.id!==m.away_team.id&&memberships.get(m.home_team.id).id===memberships.get(m.away_team.id).id,'invalid group matchup');
   if(m.status==='FullTime'){
    requireFact(m.match_info&&['home_team','away_team'].every(side=>Number.isInteger(m.match_info[side]?.score)&&m.match_info[side].score>=0),'completed result lacks regulation scores');
    for(const side of ['home_team','away_team'])requireFact(Number.isInteger(m.match_info[side].shootout_score)&&m.match_info[side].shootout_score>=0,'missing original shootout field');
   }else requireFact(m.match_info==null,'upcoming result state differs');
   matches.push(m);
  }
 }
 requireFact(matches.length===48,'forty-eight retained published fixtures required');
 return {summary,teams,groups,memberships,matches};
}
const localParts=value=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
function project(capture){
 const {summary,teams,groups,memberships,matches}=validate(capture),{documents,receipts}=capture;
 const sources=RESOURCES.map(([key,url])=>({id:sourceId(key),provider:'Football Australia official Australian Championship API',url,sourceType:'official',checkedAt:receipts[key].receivedAtUtc,providerTimestamp:documents[key].timestamp}));
 const clubs=[...teams.values()].map(t=>({id:participantId(t.id),displayName:t.name,shortName:t.name,aliases:[],abbreviation:t.abbr,countryCode:'AU',teamKind:'club',competitionScope:'domestic',sportDomainId:'sport:football',leagueId:COMPETITION,externalIds:{ffa:String(t.id),ffaUuid:t.uuid},sourceRefs:[sourceId('summary')],sourceCheckedAt:receipts.summary.receivedAtUtc,crestUrl:null,crestSourceUrl:null,crestStatus:'unavailable-from-retained-source',playerCoverage:'unavailable'}));
 const events=matches.map(m=>{
  const parts=localParts(m.start_date),home=teams.get(m.home_team.id),away=teams.get(m.away_team.id),group=memberships.get(home.id),done=m.status==='FullTime',info=m.match_info;
  const id=`football-${KEY}-2026-${m.id}`,name=home.name+' v '+away.name;
  const score=done?{home:info.home_team.score,away:info.away_team.score}:null;
  const shootout=done?{home:info.home_team.shootout_score,away:info.away_team.shootout_score,sourcePeriod:info.period}:null;
  const penaltyLabel=shootout?.sourcePeriod==='ShootOut'?`Penalties ${shootout.home}–${shootout.away}`:'';
  const scoreText=done?`${home.name} ${score.home}–${score.away} ${away.name}${penaltyLabel?' · '+penaltyLabel:''}`:null;
  return {id,eventId:id,canonicalEventId:`event:football:${KEY}:2026:${m.id}`,officialMatchId:m.id,officialMatchUuid:m.uuid,
   sport:'Football',key:'football',sportDomainId:'sport:football',competitionId:COMPETITION,competitionName:'Australian Championship',competitionCountryCode:'AU',competitionScope:'domestic',gender:'mens',genderCategory:'male',season:'2026',name,displayTitleCompact:name,
   participants:[{id:participantId(home.id),name:home.name,role:'home'},{id:participantId(away.id),name:away.name,role:'away'}],participantIds:[participantId(home.id),participantId(away.id)],homeParticipantId:participantId(home.id),awayParticipantId:participantId(away.id),participantsConfirmed:true,
   date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`,startTimeUtc:m.start_date,sourceEndTimeUtc:m.end_date,...(Date.parse(m.end_date)>Date.parse(m.start_date)?{endTimeUtc:m.end_date,endTimeBasis:'source-published-window'}:{scheduledEndStatus:'unavailable-source-end-equals-start'}),timePrecision:'exact',scheduleStatus:'confirmed',status:done?'completed':'upcoming',
   round:'all',roundNumber:m.round_number,roundLabel:m.round.name,stage:'Group stage',groupId:group.id,groupName:group.name,narrativeType:'regular-season-fixture',
   venue:m.venue?.name||null,venueOfficialName:m.venue?.name||null,venueCity:m.venue?.city||null,venueId:m.venue?.id||null,venueCountryCode:'AU',
   sourceName:'Football Australia · Australian Championship',sourceUrl:BASE+'/r'+m.round_number+'/fixture',sourceType:'official',sourceTrust:'verified',sourceCheckedAt:m.last_updated,sourceUpdatedAt:m.last_updated,providerResponseTimestamp:documents['round-'+m.round_number].timestamp,captureReceivedAt:receipts['round-'+m.round_number].receivedAtUtc,
   canonicalSourceId:m.id,canonicalSourceName:'Football Australia Australian Championship API',canonicalSourceUrl:BASE+'/r'+m.round_number+'/fixture',canonicalSourceCheckedAt:m.last_updated,canonicalSourceType:'official',
   viewingOptions:[],broadcastOptions:[],broadcaster:'',viewingStatus:'unverified',replayEligible:false,catchupEligible:false,
   selectedSentence:`${name} · ${group.name} · ${m.round.name}.`,fullSpiel:'Published Australian Championship group fixture.',
   ...(done?{homeScore:score.home,awayScore:score.away,shootout,sourceMatchInfo:structuredClone(info),sourceWinnerId:info.winner_id,score:scoreText,scoreDisplay:scoreText,result:scoreText,canonicalResultScoreline:scoreText,resultLabels:penaltyLabel?[penaltyLabel]:[],scoreCheckedAt:m.last_updated,statusCheckedAt:m.last_updated}:{}),
  };
 });
 const standings=groups.flatMap(g=>g.team_standings.map(row=>({participantId:participantId(row.team.id),displayName:row.team.name,competitionId:COMPETITION,competitionName:'Australian Championship',season:'2026',groupId:g.group.id,groupName:g.group.name,rank:row.summary.position,played:row.summary.played,won:row.summary.won,drawn:row.summary.drawn,lost:row.summary.lost,goalsFor:row.summary.goals_for,goalsAgainst:row.summary.goals_against,goalDifference:row.summary.goals_difference,points:row.summary.points,sourceSummary:structuredClone(row.summary),asOf:documents.ladder.timestamp,sourceCheckedAt:receipts.ladder.receivedAtUtc,sourceUrl:BASE+'/ladder',roundLabel:g.group.name,tableNote:'Published group positions and points; regulation and shootout scores are separate. No league-wide rank inferred.'})));
 const league={id:COMPETITION,key:KEY,displayName:'Australian Championship',countryCode:'AU',seasonLabel:'2026',teamCount:16,sourceRefs:[sourceId('summary')],sourceCheckedAt:receipts.summary.receivedAtUtc,refreshPolicy:'retained-capture-only',playerCoverage:'unavailable'};
 const document={schemaVersion:'football-fixtures.v1',leagueId:COMPETITION,leagueKey:KEY,seasonLabel:'2026',checkedAt:receipts.summary.receivedAtUtc,sourceUrl:BASE+'/summary',providerTimestamp:summary.timestamp,refreshPolicy:'retained-capture-only',sourceReceipts:sources,events,standings,roundInventory:structuredClone(summary.round_info.rounds),coverage:{publishedFixtures:48,groupTables:4,clubs:16,emptyFixtureRounds:[7,8,9],finals:'No published fixture entries; participants, kickoff times and venues unavailable',viewing:'Unverified; no fixture-specific viewing link',players:'Unavailable',crests:'Unavailable'}};
 return {league,clubs,sources,document};
}
function preserveDirectory(next,previous){
 if(!previous?.leagues?.some(l=>l.id===COMPETITION))return next;
 const scoped=(incoming,old,field)=>[...incoming.filter(r=>r[field]!==COMPETITION),...old.filter(r=>r[field]===COMPETITION)];
 return {...next,sources:[...next.sources.filter(s=>!s.id.startsWith(sourceId(''))),...previous.sources.filter(s=>s.id.startsWith(sourceId('')))],
  leagues:scoped(next.leagues,previous.leagues,'id'),teams:scoped(next.teams,previous.teams,'leagueId'),players:scoped(next.players,previous.players,'leagueId')};
}
function outputPaths(){return ['data/football/fixtures/'+KEY+'.json','data/football/fixtures/'+KEY+'.js','data/canonical/football-directory.v1.json','data/canonical/football-directory.v1.js','data/canonical/football-follow-index.v1.json','data/canonical/football-follow-index.v1.js'];}
function apply({root=path.resolve(__dirname,'../..'),captureFolder}={}){
 // Validate the complete factual snapshot before staging. No clock is re-dated.
 const result=project(loadCapture(captureFolder)),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const previous=read('data/canonical/football-directory.v1.json'),oldIndex=read('data/canonical/football-follow-index.v1.json');
 const next={...previous,sources:[...previous.sources.filter(s=>!s.id.startsWith(sourceId(''))),...result.sources],leagues:[...previous.leagues.filter(l=>l.id!==COMPETITION),result.league],teams:[...previous.teams.filter(t=>t.leagueId!==COMPETITION),...result.clubs]};
 const index={...oldIndex,teams:[...oldIndex.teams.filter(t=>t.leagueId!==COMPETITION),...result.clubs.map(t=>({...oldIndex.teams.find(old=>old.id===t.id),id:t.id,leagueId:COMPETITION}))]};
 const bodies=[JSON.stringify(result.document,null,2)+'\n','globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES = globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES || {}; globalThis.NOTHINGSPORTS_FOOTBALL_FIXTURES['+JSON.stringify(KEY)+'] = '+JSON.stringify(result.document)+';\n',JSON.stringify(next,null,2)+'\n','globalThis.NOTHINGSPORTS_FOOTBALL_DIRECTORY_DATA = '+JSON.stringify(next)+';\n',JSON.stringify(index,null,2)+'\n','globalThis.NOTHINGSPORTS_FOOTBALL_FOLLOW_INDEX = '+JSON.stringify(index)+';\n'];
 const outputs=outputPaths().map((file,i)=>({file,full:path.join(root,file),body:bodies[i]})),saved=outputs.map(o=>fs.existsSync(o.full)?fs.readFileSync(o.full):null),changed=outputs.filter((o,i)=>!saved[i]||!saved[i].equals(Buffer.from(o.body)));
 const staged=[];
 try{
  for(const o of changed){fs.mkdirSync(path.dirname(o.full),{recursive:true});const temp=o.full+'.candidate-'+process.pid;fs.writeFileSync(temp,o.body);staged.push([temp,o.full]);}
  for(const [temp,target] of staged)fs.renameSync(temp,target);
 }catch(error){
  for(let i=0;i<outputs.length;i++){if(saved[i])fs.writeFileSync(outputs[i].full,saved[i]);else fs.rmSync(outputs[i].full,{force:true});}
  throw error;
 }finally{for(const [temp] of staged)fs.rmSync(temp,{force:true});}
 return {changed:changed.map(o=>o.file),state:'retained-capture-only',networkRequests:0,fixtures:48,clubs:16,groups:4,emptyFinalsRounds:[7,8,9],sourceClocksRenewed:false};
}
module.exports={KEY,COMPETITION,BASE,RESOURCES,participantId,sourceId,loadCapture,fromFacts,validate,project,preserveDirectory,outputPaths,apply};

'use strict';
const fs=require('node:fs');
const contract=require('./aflw-round-contract'),scope=require('./aflw-publication-scope');
const FILE='data/canonical/afl-nrl-2026.json',SURFACES=['feeds/incoming/events.json','data/events.json'];
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function retainedScores(row){
 if(row.status!=='completed')return null;
 if(Number.isSafeInteger(row.homeScore)&&Number.isSafeInteger(row.awayScore)&&row.homeScore>=0&&row.awayScore>=0)return [row.homeScore,row.awayScore];
 const match=row.result?.scorelineText?.match(/—\s*(\d+)-(\d+)$/);if(match)return [+match[1],+match[2]];
 throw Error('Retained AFLW final lacks complete numeric result evidence');
}
function validateFinal(row,fixture){
 const pair=retainedScores(row),text=`${fixture.displayName} — ${pair[0]}-${pair[1]}`;
 const expectedUrl=`https://www.afl.com.au/aflw/matches/${contract.scope.records.find(value=>value.id===fixture.id).numericMatchId}`;
 if(row===fixture){
  const winner=pair[0]===pair[1]?undefined:pair[0]>pair[1]?fixture.homeParticipantId:fixture.awayParticipantId;
  if(row.result?.status!=='completed'||row.result.scorelineText!==text||row.result.winnerParticipantId!==winner||(row.result.source||row.source)?.sourceType!=='official'||(row.result.source||row.source)?.sourceUrl!==expectedUrl)throw Error('Retained AFLW final contradicts its canonical evidence');
 }else if(row.resultStatus!=='official'||row.score!==text||row.canonicalResultScoreline!==text||row.sourceType!=='official'||row.resultSourceUrl!==expectedUrl||row.sourceUrl!==expectedUrl||!row.outcomeText||!row.recapText)throw Error('Retained AFLW final contradicts its Feed evidence');
 return pair;
}
function validateRetained(bundle,documents,now){
 if(bundle.schemaVersion!=='canonical-sports.v1'||bundle.season!==2026)throw Error('Invalid retained canonical season');
 const participants=new Map(bundle.participants.map(row=>[row.id,row]));if(participants.size!==bundle.participants.length)throw Error('Duplicate retained canonical participant identity');
 const all=new Map();for(const row of bundle.events){if(all.has(row.id))throw Error('Duplicate canonical fixture identity');all.set(row.id,row);}
 const targets=new Map();
 for(const expected of contract.scope.records){
  const row=all.get(expected.id);
  if(!row||row.sourceId!==expected.providerId||row.competitionId!=='competition:aflw-2026'||row.roundNumber!==expected.roundNumber||row.startTimeUtc!==expected.startTimeUtc||row.homeParticipantId!==expected.homeParticipantId||row.awayParticipantId!==expected.awayParticipantId||!same(row.participantIds,[expected.homeParticipantId,expected.awayParticipantId]))throw Error('Retained AFLW canonical binding changed');
  for(const side of ['home','away']){const participant=participants.get(expected[side+'ParticipantId']);if(!participant||participant.metadata?.providerId!==expected[side+'ProviderId']||participant.metadata?.sourceTeamId!==expected[side+'NumericId'])throw Error('AFLW participant catalogue disagrees with reviewed numeric identity');}
  if(expected.targetedResult)targets.set(row.id,{fixture:row,cards:[]});
 }
 for(const [file,document]of documents){
  const ids=new Set(),found=new Set();
  for(const card of document.events){if(ids.has(card.id))throw Error('Duplicate retained Feed ID');ids.add(card.id);const expected=scope.binding(card);if(!expected)continue;if(found.has(expected.id))throw Error('Ambiguous retained AFLW card');found.add(expected.id);targets.get(expected.id).cards.push({file,card});}
  if(found.size!==10)throw Error('Each retained Feed requires the ten existing AFLW targets');
 }
 for(const {fixture,cards}of targets.values()){
  for(const row of [fixture,...cards.map(value=>value.card)])for(const stamp of [row.source?.checkedAt,row.sourceCheckedAt,row.canonicalSourceCheckedAt,row.scoreCheckedAt,row.statusCheckedAt,row.resultSourceCheckedAt,row.updatedAt])if(stamp!=null&&(!contract.utc(stamp)||Date.parse(stamp)>+now))throw Error('Invalid or future retained AFLW observation');
  const settled=[fixture,...cards.map(value=>value.card)].filter(row=>row.status==='completed');
  const pairs=settled.map(retainedScores);
  if(pairs.some(pair=>!same(pair,pairs[0])))throw Error('Conflicting retained AFLW finals');
  for(const row of settled)validateFinal(row,fixture);
  for(const row of settled){
   const at=row.result?.source?.checkedAt||row.scoreCheckedAt||row.resultSourceCheckedAt||(row.result?.status==='completed'?row.source?.checkedAt:null);
   const supplied=[[row.result?.source,'checkedAt'],[row,'scoreCheckedAt'],[row,'resultSourceCheckedAt']].filter(([owner,key])=>owner&&Object.hasOwn(owner,key)).map(([owner,key])=>owner[key]);
   const stamps=[at,...supplied];
   if(!at||stamps.some(value=>!contract.utc(value)||Date.parse(value)<Date.parse(fixture.startTimeUtc)||Date.parse(value)>+now))throw Error('Retained AFLW final lacks its genuine post-start result clock');
  }
 }
 return targets;
}
function canonicalFinal(previous,match,facts,participants){
 const adapted=structuredClone(match);
 for(const side of ['home','away'])adapted[side].team.name=participants.get(previous[side+'ParticipantId']).displayName;
 const built=require('../refresh-canonical-sports').buildAflEvent(adapted,facts.observedAt,new Map([[previous.id,previous.createdAt]]),{code:'aflw',competitionId:'competition:aflw-2026',discoverySportId:'sport:aflw'}).event;
 const result={...built.result,scorelineText:`${previous.displayName} — ${facts.homeScore}-${facts.awayScore}`,source:built.source};
 const next={...previous,status:'completed',result,updatedAt:facts.observedAt};
 // Historical canonical preview evidence stays dated and intact. It is not
 // a new recap/review; the on-card result projection below clears that preview.
 return next;
}
function project(card,fixture,participants){
 const resultFixture={...fixture};for(const key of ['editorialPreview','selectedSentence','fullSpiel'])delete resultFixture[key];
 const result=require('../sync-canonical-fixtures-to-feed').applyCompletedCanonicalResult(card,resultFixture,participants);
 const fields=['status','homeScore','awayScore','score','outcomeText','recapText','selectedSentence','fullSpiel','resultLabels','consensusResult','sourceName','sourceUrl','sourceCheckedAt','sourceType','scoreCheckedAt','statusCheckedAt','resultSourceUrl','resultSourceCheckedAt','canonicalResultScoreline','storyline'];
 const next={...card};for(const key of fields)if(Object.hasOwn(result,key))next[key]=result[key];delete next.editorialPreview;next.resultStatus='official';
 if(next.storyline){next.storyline={...next.storyline};if(card.storyline?.lastReviewedAt)next.storyline.lastReviewedAt=card.storyline.lastReviewedAt;else delete next.storyline.lastReviewedAt;}
 return next;
}
async function refresh({now=new Date(),deadline}={}){
 const bundle=read(FILE),documents=SURFACES.map(file=>[file,read(file)]),targets=validateRetained(bundle,documents,now),participants=new Map(bundle.participants.map(row=>[row.id,row]));
 const report={mode:'aflw-results',scope:{roundNumbers:[11,12],targetedResultIds:contract.scope.records.filter(row=>row.targetedResult).map(row=>row.id),retainedFutureIds:contract.scope.records.filter(row=>!row.targetedResult).map(row=>row.id)},changed:[],deferrals:[],sourceFailures:[],updatedFixtureIdsBySurface:Object.fromEntries(SURFACES.map(file=>[file,[]])),accepted:[],unchanged:[],standings:{state:'retained-stale-relative-to-recovered-rounds',rankOrQualificationDerived:false,snapshot:bundle.ladderSnapshots.find(row=>row.competitionId==='competition:aflw-2026')?.id,noGet:true,sourceCheckedAt:bundle.ladderSnapshots.find(row=>row.competitionId==='competition:aflw-2026')?.source?.checkedAt},containerClock:bundle.generatedAt,aiCalls:0,publicationState:'candidate'};
 const budget=require('./aflw-source-json').createBudget({deadline}),updates=new Map();
 try{
  for(const round of [11,12]){
   const url=require('./aflw-source-json').URLS[round-11];
   try{const staged=await budget.read(url,payload=>{
    const staged={updates:[],accepted:[],deferrals:[]};
    const receipt=budget.summary().observations.find(row=>row.url===url);
    const checked=new Map(),rows=contract.roundRows(payload,round,{preflight:(match,binding)=>{
     const held=targets.get(binding.id);
     if(held&&[held.fixture,...held.cards.map(value=>value.card)].some(row=>row.status==='completed')&&['SCHEDULED','PRE_MATCH','LIVE','IN_PROGRESS'].includes(String(match.status||'').toUpperCase()))throw Error('Official source cannot reopen retained AFLW final');
     const facts=contract.finalFacts(match,binding,{observedAt:receipt.observedAt,now:new Date()});
     if(!facts.deferred&&[held.fixture,...held.cards.map(value=>value.card)].some(row=>row.status==='completed'&&!same(retainedScores(row),[facts.homeScore,facts.awayScore])))throw Error('Official source conflicts with retained AFLW final');
     checked.set(binding.id,facts);
    }});
    for(const {match,binding}of rows){
     const held=targets.get(binding.id),facts=checked.get(binding.id);
     if(facts.deferred){staged.deferrals.push({id:binding.id,reason:facts.deferred,nextAction:binding.targetedResult?'Review missing official result evidence in a separately allocated source attempt':'Retain unchanged; outside this ten-result allocation'});continue;}
     const pair=[facts.homeScore,facts.awayScore];
     const next=held.fixture.status==='completed'?held.fixture:canonicalFinal(held.fixture,match,facts,participants);
     staged.updates.push([binding.id,{fixture:next,pair}]);staged.accepted.push({id:binding.id,providerId:binding.providerId,numericMatchId:match.id,roundNumber:round,seasonId:match.compSeason.id,sourceUrl:url,observedAt:receipt.observedAt,bodySha256:receipt.decodedSha256,homeTeamProviderId:match.home.team.providerId,awayTeamProviderId:match.away.team.providerId,startTimeUtc:contract.utc(match.utcStartTime),homeScore:pair[0],awayScore:pair[1],homeGoals:match.home.score.goals,homeBehinds:match.home.score.behinds,awayGoals:match.away.score.goals,awayBehinds:match.away.score.behinds});
    }
    return staged;
   });for(const [id,update]of staged.updates)updates.set(id,update);report.accepted.push(...staged.accepted);report.deferrals.push(...staged.deferrals);
   }catch(error){
    if(!error.aflwRoundLocal&&!error.aflwStopAcquisition){report.sourceFailures.push({roundNumber:round,sourceUrl:url,status:error.status??null,reason:require('./refresh-report').sanitise(error.message),receipt:error.sourceReceipt||null,nextAction:'Shared integrity or invocation failure; retain the complete last-good candidate and return for review'});throw error;}
    const refused=error.aflwStopAcquisition===true,reason=refused?`Official round HTTP${error.status} refused; source acquisition stopped; separate resource approval required`:error.status>=500?'Official round HTTP5xx unavailable; no retry':[404,410].includes(error.status)?`Official round HTTP${error.status} unavailable; no retry`:'Incomplete or invalid official round response; preserve last-good facts';
    report.sourceFailures.push({roundNumber:round,sourceUrl:url,status:error.status??null,reason,receipt:error.sourceReceipt||null,nextAction:refused?'Return separate reviewed token/resource proposal; no fallback or new acquisition':'Review the refused round response before a separately allocated source attempt'});
    for(const row of contract.scope.records.filter(value=>(refused?value.roundNumber>=round:value.roundNumber===round)&&value.targetedResult))report.deferrals.push({id:row.id,reason,nextAction:refused?'Return separately reviewed resource proposal; no new acquisition':'Review the refused round response before another allocated attempt'});
    if(refused){if(!updates.size)throw error;break;}
   }
  }
  if(!updates.size)throw Error('No supported AFLW result observations; retained last-good facts');
  const nextBundle={...bundle,events:bundle.events.map(row=>updates.get(row.id)?.fixture||row)},candidates=[];
  for(const [file,document]of documents){
   const events=document.events.map(card=>{const binding=scope.binding(card),update=binding&&updates.get(binding.id);if(!update)return card;if(card.status==='completed'){report.unchanged.push({surface:file,id:card.id});return card;}const next=project(card,update.fixture,participants);report.updatedFixtureIdsBySurface[file].push(card.id);return next;});
   candidates.push([file,{...document,events}]);
  }
  budget.check();if(!same(nextBundle,bundle)){fs.writeFileSync(FILE,JSON.stringify(nextBundle,null,2)+'\n');report.changed.push('AFLW results canonical');}
  for(const [file,document]of candidates)if(report.updatedFixtureIdsBySurface[file].length){fs.writeFileSync(file,JSON.stringify(document,null,2)+'\n');report.changed.push('AFLW results '+file);}
  budget.check();return report;
 }catch(error){error.aflwReport=report;throw error;}
 finally{budget.close();report.resources=budget.summary();}
}
module.exports={refresh,validateRetained,canonicalFinal,project,retainedScores,FILE,SURFACES};

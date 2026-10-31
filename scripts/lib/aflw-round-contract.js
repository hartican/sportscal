'use strict';
// Reviewed retained bindings; no new provider observation or participant admission.
const scope=require('../fixtures/aflw-round-recovery-scope-20261031.json');
const fail=message=>{throw Error('AFLW round identity contract: '+message);};
const roundFail=message=>{throw Object.assign(Error('AFLW round identity contract: '+message),{aflwRoundLocal:true});};
const records=new Map(scope.records.map(row=>[row.providerId,row]));
function utc(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|\+0000|\+00:00)$/.test(value))return null;
 const time=Date.parse(value);if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,19)!==value.slice(0,19))return null;return new Date(time).toISOString();
}
function roundRows(payload,round){
 const expected=scope.records.filter(row=>row.roundNumber===round),page=payload?.meta?.pagination;
 if(![11,12].includes(round)||expected.length!==9)fail('unreviewed round');
 if(!Array.isArray(payload?.matches))roundFail('complete single nine-match page required');
 const seen=new Set();
 for(const match of payload.matches){
  const row=records.get(match?.providerId),season=match?.compSeason;
  if(!row||row.roundNumber!==round||seen.has(row.id)||match.id!==row.numericMatchId)fail('missing, duplicate, new or mismatched fixture');seen.add(row.id);
  if(season?.id!==96||season.providerId!==scope.season.providerId||season.name!==scope.season.name||match.round?.roundNumber!==round||match.round.providerId!==`CD_R2026264${round}`)fail('season or round changed');
  for(const side of ['home','away']){const team=match[side]?.team;if(team?.providerId!==row[side+'ProviderId']||team.id!==row[side+'NumericId']||team.teamType!=='WOMEN')fail('ordered retained team binding changed');}
 }
 if(payload?.meta?.code!==200||!page||page.page!==0||page.numPages!==1||page.pageSize!==50||page.numEntries!==9||payload.matches.length!==9)roundFail('complete single nine-match page required');
 return payload.matches.map(match=>({match,binding:records.get(match.providerId)}));
}
function finalFacts(match,binding,{observedAt,now=new Date()}={}){
 const start=utc(match.utcStartTime),observed=utc(observedAt);
 if(!observed||Date.parse(observed)>+now)fail('invalid or future source receipt');
 const status=String(match.status||'').toUpperCase();
 if(['CONCLUDED','FINAL','COMPLETED','LIVE','IN_PROGRESS'].includes(status)&&(!start||Date.parse(start)>Date.parse(observed)))fail('official final contradicts its sporting start');
 if(!binding.targetedResult)return {deferred:'Outside the exact ten-result recovery scope; retained unchanged'};
 if(!start||start!==binding.startTimeUtc)fail('selected sporting start differs from retained fixture');
 if(status!=='CONCLUDED')return {deferred:'No explicit reviewed official final; preserve last-good facts'};
 const valid=score=>score&&['goals','behinds','totalScore'].every(key=>Number.isSafeInteger(score[key])&&score[key]>=0)&&(score.superGoals==null||score.superGoals===0)&&score.totalScore===score.goals*6+score.behinds;
 if(!valid(match.home.score)||!valid(match.away.score))return {deferred:'Official final lacks complete consistent nonnegative goal/behind/total scores'};
 return {homeScore:match.home.score.totalScore,awayScore:match.away.score.totalScore,observedAt:observed};
}
module.exports={scope,roundRows,finalFacts,utc};

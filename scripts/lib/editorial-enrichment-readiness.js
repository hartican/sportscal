'use strict';
const assert=require('node:assert/strict');
const DAY_MS=86400000;
const FIXTURE_URL='https://www.premierleague.com/en/matches/premier-league/2026-27';
function sydneyDay(time){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(time));
  const value=type=>Number(parts.find(part=>part.type===type).value);
  return Date.UTC(value('year'),value('month')-1,value('day'));
}
function observed(value,reference){
  const time=typeof value==='string'?Date.parse(value):NaN;
  return Number.isFinite(time)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)
    &&new Date(time).toISOString().slice(0,19)===value.slice(0,19)&&time<=reference;
}
function optionalEarlyPreview(record,{stakes,reference,start,hasRetainedProjection}={}){
  // Draft policy, not source approval: independent source/licence/schema/result
  // and spoiler gates still inspect the entire unchanged fixture.
  if(!record||record.key!=='premier-league'||stakes!==3||!['upcoming','scheduled'].includes(record.status))return null;
  if(!Number.isFinite(reference)||!Number.isFinite(start)||Date.parse(record.startTimeUtc)!==start
    ||start>reference+30*DAY_MS||sydneyDay(start)<=sydneyDay(reference)+14*DAY_MS)return null;
  if(record.date!==new Date(sydneyDay(start)).toISOString().slice(0,10))return null;
  if(Object.hasOwn(record,'editorialNarrative')||Object.hasOwn(record,'editorialPreview'))return null;
  const storyline=record.storyline;
  if(storyline!==undefined&&(!storyline||typeof storyline!=='object'||Array.isArray(storyline)
    ||['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn'].some(field=>field in storyline)))return null;
  const identity=/^epl-2026-27-([1-9]\d*)$/.exec(record.id||'');
  if(!identity||record.eventId!==record.id||record.canonicalEventId!=='event:premier-league:'+identity[1]
    ||record.competitionId!=='competition:premier-league-2026-27'||record.season!=='2026/27')return null;
  if(!/^team:football:epl:[1-9]\d*$/.test(record.homeParticipantId||'')
    ||!/^team:football:epl:[1-9]\d*$/.test(record.awayParticipantId||'')||record.homeParticipantId===record.awayParticipantId)return null;
  if(record.sourceType!=='official'||record.sourceTrust!=='verified'||record.sourceName!=='Premier League official fixture schedule'
    ||record.sourceUrl!==FIXTURE_URL||record.canonicalSourceUrl!==FIXTURE_URL
    ||!observed(record.sourceCheckedAt,reference)||!observed(record.canonicalSourceCheckedAt,reference))return null;
  if(typeof record.name!=='string'||!record.name.trim()
    ||!/^Premier League Matchweek (?:[1-9]|[12]\d|3[0-8]) fixture, with a provisional kickoff subject to broadcast and competition amendments\.$/.test(record.selectedSentence||'')
    ||record.fullSpiel!==`${record.name} is listed in the Premier League's official 2026/27 schedule. Kick-off and venue details will refresh from the league if the fixture moves.`)return null;
  // Existing writing that failed to publish is not optional missing research.
  // Missing/failed lookup is not evidence that a projection is absent.
  if(typeof hasRetainedProjection!=='function'||hasRetainedProjection(record)!==false)return null;
  return {id:record.eventId,classification:'optional-early-preview-not-yet-researched',
    nextAction:'Retain the factual schedule fallback; use the existing editorial owner for sourced enrichment. Do not mark this fixture researched.'};
}
function assessNarrative(record,options={}){
  const deferred=optionalEarlyPreview(record,options);
  if(deferred)return {status:'deferred',...deferred};
  const narrative=record.editorialNarrative,id=String(record?.eventId||record?.id||record?.canonicalEventId||'');
  assert(narrative?.hook,`${id} (${record.name}) needs a researched L0 hook`);
  assert(narrative?.synopsis,`${id} (${record.name}) needs a researched L1/L2 narrative`);
  assert(!(options.genericPatterns||[]).some(pattern=>pattern.test(narrative.hook)),`${id} (${record.name}) still has a generic L0 hook: ${narrative.hook}`);
  assert(!(options.genericPatterns||[]).some(pattern=>pattern.test(narrative.synopsis)),`${id} (${record.name}) still has generic L1/L2 copy: ${narrative.synopsis}`);
  return {status:'ready'};
}
module.exports={assessNarrative};

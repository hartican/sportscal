'use strict';
const identity=require('../../config/fixture-identity');
const registry=require('../../data/canonical/cricket-reviewed-context.v1.json');
const sydneyDate=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
function validInstant(value){
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,19)===value.slice(0,19);
}
function validateRecords(records,now){
 const ids=new Set();
 for(const record of records){
  const url=new URL(record.sourceUrl),start=validInstant(record.startTimeUtc)&&sydneyDate(record.startTimeUtc);
  const end=Date.parse(record.endDate+'T00:00:00Z'),days=start?(end-Date.parse(start+'T00:00:00Z'))/86400000+1:NaN;
  if(!record.eventId||ids.has(record.eventId)||!/^fixture:cricket:CA:\d+$/.test(record.sourceEventId)
   ||record.participantIds?.length!==2||new Set(record.participantIds).size!==2
   ||!record.participantIds.every(id=>/^team:cricket:/.test(id))
   ||!/^competition:cricket:/.test(record.competitionId)||!record.competitionName
   ||!validInstant(record.checkedAt)||Date.parse(record.checkedAt)>+now
   ||url.protocol!=='https:'||url.hostname!=='www.cricket.com.au'||url.username||url.password||url.port
   ||record.format!=='Test'||!Number.isInteger(record.numberOfDays)||record.numberOfDays!==days
   ||!/^\d{4}-\d{2}-\d{2}$/.test(record.endDate)||!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==record.endDate
   ||!validInstant(record.sourceEndTimeUtc)||sydneyDate(record.sourceEndTimeUtc)!==record.endDate
   ||!/^\d+(?:st|nd|rd|th) Test$/.test(record.roundLabel)||!/^competition:cricket:\d+$/.test(record.sourceCompetitionId)
   ||!/^[a-f0-9]{64}$/.test(record.sourceResponseSha256||''))throw new Error('Invalid reviewed Cricket context for '+record.eventId);
  ids.add(record.eventId);
 }
}
function createResolver({records=registry.records,now=new Date()}={}){
 validateRecords(records,now);
 const byId=new Map(records.map(record=>[record.eventId,record]));
 return event=>{
  const record=byId.get(event.id||event.eventId);
  if(!record||identity.sportKey(event)!=='cricket'||!validInstant(event.startTimeUtc)
   ||Date.parse(event.startTimeUtc)!==Date.parse(record.startTimeUtc)
   ||JSON.stringify((event.participantIds||[]).map(identity.canonicalParticipantId))!==JSON.stringify(record.participantIds))return event;
  // A later reviewed calendar or a supplied different format remains authoritative.
  if(event.calendarProvenance&&Date.parse(event.calendarProvenance.checkedAt)>Date.parse(record.checkedAt)
   ||event.format&&event.format!==record.format)return event;
  const changes={};
  for(const field of ['competitionId','competitionName','format','matchFormat','numberOfDays','endDate']){
   if(event[field]==null||event[field]==='')changes[field]=field==='matchFormat'?record.format:record[field];
  }
  if(!event.roundLabel||event.roundLabel==='all')changes.roundLabel=record.roundLabel;
  const aliases=[...new Set([...(event.sourceEventIds||[event.id]),record.sourceEventId])];
  if(JSON.stringify(aliases)!==JSON.stringify(event.sourceEventIds))changes.sourceEventIds=aliases;
  if(!Object.keys(changes).length)return event;
  const provenance={kind:'official',sourceEventId:record.sourceEventId,sourceUrl:record.sourceUrl,checkedAt:record.checkedAt};
  return {...event,...changes,
   ...(!event.competitionProvenance&&changes.competitionId?{competitionProvenance:provenance}:{}),
   ...(!event.calendarProvenance?{calendarProvenance:{...provenance,fields:Object.keys(changes).filter(k=>!['sourceEventIds','competitionId','competitionName'].includes(k)),basis:'scheduled-calendar',sourceCompetitionId:record.sourceCompetitionId}}:{})};
 };
}
module.exports={createResolver};

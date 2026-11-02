'use strict';

// Retained reviewed schedules only. Called by update-cards, never a provider
// loader or a second publisher. Internal IDs are not external provider IDs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {mergeRecord}=require('../apply-current-card-evidence');
const {normalizeFeed,validateFeed}=require('./feed-utils');
const ROOT=path.resolve(__dirname,'../..');
const FILES=['feeds/incoming/events.json','data/events.json'];
const SOURCE='https://socceroos.com.au/fixtures';
const APPROVED=Object.freeze({
  'football-qatar-australia-2026-11-14':Object.freeze({opponent:'qatar',date:'2026-11-14',time:'01:45',start:'2026-11-13T14:45:00.000Z',venue:'Abdullah bin Khalifa Stadium'}),
  'football-jordan-australia-2026-11-18':Object.freeze({opponent:'jordan',date:'2026-11-18',time:'03:00',start:'2026-11-17T16:00:00.000Z',venue:'Amman International Stadium'}),
});
const aliases=row=>[row.id,row.eventId,row.canonicalId,row.canonicalEventId,...(row.sourceEventIds||[]),...(row.legacyEventIds||[])].filter(Boolean);
function fail(message){throw Error('Reviewed fixture admission: '+message);}
function validate(row,referenceTime){
  const approved=APPROVED[row.id];
  if(!approved)fail('unsupported reviewed identity '+row.id);
  const participants=['team:football:'+approved.opponent,'team:football:socceroos'];
  if(row.reviewedScheduleOnly!==true||row.canonicalId!==row.id||row.eventId!==row.id||row.key!=='football'||row.cardKind!=='fixture'||row.status!=='scheduled'||row.competitionId!=='competition:football:international-friendlies'||row.competitionScope!=='international'||row.isInternational!==true||row.isSenior!==true||row.gender!=='men')fail('canonical competition binding differs');
  if(JSON.stringify(row.participantIds)!==JSON.stringify(participants)||row.participantsConfirmed!==true||JSON.stringify((row.participants||[]).map(p=>p.id))!==JSON.stringify(participants)||row.homeParticipantId!==participants[0]||row.awayParticipantId!==participants[1])fail('participant binding differs');
  if(row.date!==approved.date||row.time!==approved.time||row.startTimeUtc!==approved.start||row.localTimezone!=='Australia/Sydney'||row.venue!==approved.venue)fail('reviewed schedule binding differs');
  if(row.sourceType!=='official'||row.sourceTrust!=='verified'||row.sourceUrl!==SOURCE||row.sourceCheckedAt!=='2026-11-02T05:42:14.000Z'||!Number.isFinite(referenceTime.getTime())||Date.parse(row.sourceCheckedAt)>referenceTime.getTime())fail('official observation binding differs');
  if(row.broadcaster!=='Paramount+'||JSON.stringify(row.broadcasterIds)!==JSON.stringify(['paramount'])||row.viewingOptions?.length!==1||row.viewingOptions[0].providerId!=='paramount'||row.viewingOptions[0].sourceUrl!==SOURCE||row.viewingOptions[0].verifiedAt!==row.sourceCheckedAt)fail('reviewed viewing binding differs');
  for(const key of ['expected','stakesScore','storyline','editorialNarrative','editorialPreview','selectedSentence','fullSpiel','actualStartTimeUtc','endTimeUtc','score','scoreDisplay','result','resultStatus','outcomeText','homeScore','awayScore','fixtureResults'])if(Object.hasOwn(row,key))fail('schedule-only admission cannot invent '+key);
  return row;
}
function assertNormalizedIdentity(record,row){
  const normalized=require('../../config/fixture-identity').normalizeCore(record);
  assert.deepEqual(normalized.participantIds,row.participantIds,'Reviewed participant IDs must survive normalization');
  assert.deepEqual(normalized.participants.map(participant=>participant.id),row.participantIds,'Reviewed participant objects must survive normalization');
  assert.deepEqual(normalized.participants.map(participant=>participant.role),['home','away'],'Reviewed participant roles must survive normalization');
  assert.equal(normalized.homeParticipantId,row.homeParticipantId);
  assert.equal(normalized.awayParticipantId,row.awayParticipantId);
}
function prepare({evidence,incoming,published,ids},{referenceTime=new Date(),repairIdentities=false}={}){
  if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length)fail('distinct exact IDs required');
  const selected=ids.map(id=>{
    const rows=(evidence.fixtureOverrides||[]).filter(row=>aliases(row).includes(id));
    if(rows.length!==1||(evidence.resultOverrides||[]).some(row=>aliases(row).includes(id)))fail('unknown, ambiguous or result-bound identity '+id);
    return validate(rows[0],referenceTime);
  });
  for(const [label,doc]of [['incoming',incoming],['published',published]])if(!Array.isArray(doc?.events))fail(label+' Feed is missing');
  const output={incoming:structuredClone(incoming),published:structuredClone(published),added:[],repaired:[],changed:false};
  for(const row of selected){
    const found=[incoming,published].map(doc=>doc.events.filter(event=>aliases(event).some(id=>aliases(row).includes(id))));
    if(found.some(rows=>rows.length>1))fail('duplicate retained identity '+row.id);
    if(repairIdentities){
      if(found.some(rows=>rows.length!==1))fail('identity repair requires both retained surfaces');
      const [source,target]=found.map(rows=>rows[0]);
      assertNormalizedIdentity(source,row);
      for(const field of ['homeParticipantId','awayParticipantId'])if(target[field]!==row[field])fail('identity repair home/away binding differs');
      const correct=JSON.stringify(target.participantIds)===JSON.stringify(row.participantIds)
        &&JSON.stringify(target.participants?.map(participant=>participant.id))===JSON.stringify(row.participantIds)
        &&JSON.stringify(target.participants?.map(participant=>participant.role))==='["home","away"]';
      if(!correct){
        if(target.key!=='football'||JSON.stringify(target.participantIds)!=='["team:football:socceroos"]'
          ||target.participants?.length!==1||target.participants[0].id!=='team:football:socceroos'
          ||target.participants[0].role!=='home')fail('identity repair is not the reviewed collapsed signature');
        const repaired={...target,participantIds:[...source.participantIds],participants:structuredClone(source.participants)};
        assertNormalizedIdentity(repaired,row);
        output.published.events[output.published.events.findIndex(event=>event.id===target.id)]=repaired;
        output.repaired.push(row.id);output.changed=true;
      }else assertNormalizedIdentity(target,row);
      continue;
    }
    for(const retained of found.flat())if(retained.key!=='football'||JSON.stringify(retained.participantIds)!==JSON.stringify(row.participantIds))fail('retained canonical binding differs for '+row.id);
    // Later results, clocks, copy and saved storage aliases always win over a
    // reviewed scheduled row. Fill a missing surface from that retained row.
    const retained=found[1][0]||found[0][0];
    const card=retained||normalizeFeed({events:[mergeRecord({id:row.id,eventId:row.id,canonicalEventId:row.canonicalId,status:'scheduled',cardKind:'fixture',expected:null,liveWindow:2.5},row,row.sourceCheckedAt)]}).events[0];
    assertNormalizedIdentity(card,row);
    for(const [index,key]of ['incoming','published'].entries())if(!found[index].length){output[key].events.push(structuredClone(card));output.changed=true;output.added.push({surface:key,id:card.id,canonicalId:row.canonicalId});}
  }
  for(const key of ['incoming','published']){
    const issues=validateFeed(output[key]);
    if(issues.length)fail(key+' Feed is invalid: '+issues.join('; '));
  }
  return output;
}
function load(ids,{root=ROOT,referenceTime=new Date(),repairIdentities=false}={}){
  const bytes=FILES.map(file=>fs.readFileSync(path.join(root,file),'utf8'));
  const result=prepare({evidence:JSON.parse(fs.readFileSync(path.join(root,'data/canonical/current-card-evidence-2026.json'),'utf8')),incoming:JSON.parse(bytes[0]),published:JSON.parse(bytes[1]),ids},{referenceTime,repairIdentities});
  return {...result,files:FILES.map((relative,index)=>({relative,before:bytes[index],after:JSON.stringify(result[index?'published':'incoming'],null,2)+'\n'}))};
}
function writePrepared(prepared,{root=ROOT,io=fs}={}){
  assert.deepEqual(prepared.files?.map(file=>file.relative),FILES,'Only canonical Feed surfaces may be admitted');
  for(const file of prepared.files)assert.equal(io.readFileSync(path.join(root,file.relative),'utf8'),file.before,'Reviewed Feed changed after preparation: '+file.relative);
  const written=[];
  try{
    for(const file of prepared.files)if(file.before!==file.after){written.push(file);io.writeFileSync(path.join(root,file.relative),file.after);}
  }catch(error){
    for(const file of written.reverse())io.writeFileSync(path.join(root,file.relative),file.before);
    throw error;
  }
}
module.exports={APPROVED,prepare,load,writePrepared};

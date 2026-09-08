"use strict";
const identity=require('../config/fixture-identity');
function materializeParticipation(document){
  if(document?.schemaVersion!=='athlete-participation.v1')throw new Error('Invalid athlete participation schema');
  const athletes=new Map(document.athletes.map(athlete=>[athlete.id,athlete]));
  const fixtures=new Map(document.fixtures.map(fixture=>[fixture.id,{...fixture,participantIds:[],participants:[],excludedParticipantIds:[],participationEvidence:[]}]));
  for(const entry of document.entries){
    const athlete=athletes.get(entry.participantId),fixture=fixtures.get(entry.eventId);
    if(!athlete||!fixture||!/^https:\/\//.test(entry.sourceUrl)||!/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedAt)||!['provisional','confirmed','completed','withdrawn'].includes(entry.participationStatus))throw new Error('Unverified athlete entry');
    fixture.participationEvidence.push({...entry});
    if(entry.participationStatus==='withdrawn')fixture.excludedParticipantIds.push(athlete.id);
    else if(!fixture.participantIds.includes(athlete.id)){fixture.participantIds.push(athlete.id);fixture.participants.push({id:athlete.id,displayName:athlete.displayName,countryCode:athlete.countryCode});}
  }
  return [...fixtures.values()].map(identity.normalizeCore);
}
module.exports={materializeParticipation};

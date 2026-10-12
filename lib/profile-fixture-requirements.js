'use strict';
const model=require('../config/athletes');
const registry=require('../config/sport-domain-registry');
const follow=require('./follow-fixture-resolver');
const identity=require('../config/fixture-identity');
const unique=values=>[...new Set(values.filter(Boolean).map(String))].sort();
const aliases=event=>[event.canonicalEventId,event.eventId,event.id,...(event.sourceEventIds||[]),...(event.fixtureIdAliases||[])];

// Select whole sport families, not a provider list or today's known fixture IDs.
// Unknown identities use the unchanged full reader. The response policy still
// owns admission, exclusions, current-team inheritance and calendar horizons.
function requirements({userState,participantId=null,events=[],participants=[]}={}){
 const ids=new Set(follow.expandedFollowEntityIds(userState));
 if(participantId){
  ids.add(participantId);
  const player=follow.playerTeamEntries([participantId]).find(p=>model.identity(p.id)===model.identity(participantId));
  if(player?.currentTeamId)ids.add(player.currentTeamId);
 }
 const requested=unique([...ids].filter(id=>model.individual(id)||id.startsWith('team:')));
 if(!requested.length||requested.length>1000)return null;
 const records=new Map(participants.map(p=>[model.identity(p.id),p]));
 const domains=new Set();
 for(const id of requested){
  const record=records.get(model.identity(id)),key=model.sport(record||{id});
  const domain=registry.byKey[key]?.domainId;
  if(!domain)return null;
  domains.add(domain);
 }
 const sportKeys=Object.keys(registry.byKey).filter(key=>domains.has(registry.byKey[key].domainId)).sort();
 const requestedKeys=new Set(requested.map(model.identity));
 const preserveIds=unique(events.filter(e=>model.participantIds(e).some(id=>requestedKeys.has(model.identity(id)))).flatMap(aliases));
 if(!sportKeys.length||preserveIds.length>5000||preserveIds.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))return null;
 const participantIds=unique(requested.flatMap(id=>[id,identity.canonicalParticipantId(id)]));
 if(participantIds.length>1000||participantIds.some(id=>!/^[-a-z0-9_:]{1,200}$/i.test(id)))return null;
 return {scope:'participants',sportKeys,knownSportKeys:Object.keys(registry.byKey).sort(),participantIds,preserveIds};
}
module.exports={requirements};

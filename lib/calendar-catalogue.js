'use strict';
const fs=require('node:fs'),path=require('node:path');
const calendar=require('../config/calendar-export');
const followFirst=require('../config/follow-first');
const {resolveUserFollowFixtures,expandedFollowEntityIds}=require('./follow-fixture-resolver');
const major=require('../config/major-events');
const majorDocument=require('../data/major-events.v1.json');
const published=require('../data/events.json');
const manifest=require('../data/code-inspector/manifest.json');
const context=require('../config/sport-context').mergeCanonicalBundles(
  require('../data/canonical/afl-nrl-2026.json'),require('../data/canonical/f1-context-2026.json'),
  require('../data/canonical/tennis-context-2026.json'),require('../data/canonical/cycling-context-2026.json'),
  require('../data/canonical/nba-context-2026.json'),require('../data/canonical/cwg-context-2026.json'));
const participants=new Map((context.participants || []).map(participant=>[participant.id,participant]));
function withCountries(event){return {...event,participantCountryCodes:[...(event.participantCountryCodes || []),...(event.participantIds || []).flatMap(id=>{const participant=participants.get(id);return [participant?.countryCode,participant?.nationalityCode,participant?.metadata?.countryCode];}).filter(Boolean)]};}
let cached;
function catalogue(){
  if(cached)return cached;
  const events=[...(published.events || [])];
  for(const code of manifest.codes){
    const file=path.join(__dirname,'..',code.chunkPath);
    const document=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const fixture of document.fixtures || [])events.push({...fixture,eventId:fixture.id,key:({'rugby-union':'rugby',motorsport:'f1',basketball:'nba'})[code.slug] || code.slug,participantIds:(fixture.participantSlots || []).map(slot=>slot.participantId).filter(Boolean),stakesScore:fixture.stakesScore || (fixture.expected>=9?5:fixture.expected>=7?4:3)});
  }
  events.push(...majorDocument.events.filter(event=>event.kind!=='ticket_sale'));
  // Inspector punctuation variants refer to the same fixture as published cards.
  const byIdentity=new Map();
  for(const event of events){
    const key=calendar.idFor(event).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!byIdentity.has(key))byIdentity.set(key,event);
  }
  cached=[...byIdentity.values()];return cached;
}
function subscriptionEvents(state,selection,now=new Date()){
  const preferences=followFirst.migratePreferences(state?.preferences || {});
  const resolved=resolveUserFollowFixtures({events:catalogue(),userState:state});
  const events=calendar.uniqueEvents(resolved.events).map(withCountries);
  const expanded=expandedFollowEntityIds(state);
  const families=new Set(preferences.followFirst.followedMajorEventIds || []);
  const eligible=events.filter(event=>{
    if(event.kind==='major_event' || event.kind==='tournament')return major.followed(event,preferences) || families.has(major.eventFamilyId(event));
    return followFirst.reasonForEvent(event,preferences) || (event.participantIds || []).some(id=>expanded.has(id));
  }).map(calendar.idFor);
  const included=new Set(selection.includedIds || []);
  return calendar.selectedEvents(events,eligible,selection).filter(event=>{
    if(included.has(calendar.idFor(event)))return true;
    const end=Date.parse(event.endDate || event.date || event.startDate || '');
    return !Number.isFinite(end) || end>=+now-14*86400000;
  });
}
module.exports={catalogue,subscriptionEvents};

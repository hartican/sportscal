'use strict';
const fs=require('node:fs'),path=require('node:path');
const calendar=require('../config/calendar-export');
const followFirst=require('../config/follow-first');
const {resolveUserFollowFixtures,expandedFollowEntityIds}=require('./follow-fixture-resolver');
const major=require('../config/major-events');
const followPolicy=require('../config/follow-feed-policy');
const fixtureIdentity=require('../config/fixture-identity');
const majorDocument=require('../data/major-events.v1.json');
const published=require('../data/events.json');
const manifest=require('../data/code-inspector/manifest.json');
const coverage=require('../data/follow-sources/coverage.v1.json');
const context=require('../config/sport-context').mergeCanonicalBundles(
  require('../data/canonical/afl-nrl-2026.json'),require('../data/canonical/f1-context-2026.json'),
  require('../data/canonical/wrc-context-2026.json'),
  require('../data/canonical/tennis-context-2026.json'),require('../data/canonical/cycling-context-2026.json'),
  require('../data/canonical/nba-context-2026.json'),require('../data/canonical/cwg-context-2026.json'));
const participants=new Map((context.participants || []).map(participant=>[participant.id,participant]));
function withCountries(event){return {...event,participantCountryCodes:[...(event.participantCountryCodes || []),...(event.participantIds || []).flatMap(id=>{const participant=participants.get(id);return [participant?.countryCode,participant?.nationalityCode,participant?.metadata?.countryCode];}).filter(Boolean)]};}
let cached;
function catalogue(){
  if(cached)return cached;
  const events=[...require('./athlete-participation').materializeParticipation(require('../data/canonical/athlete-participation.v1.json')),...(coverage.events || []),...(published.events || [])];
  for(const code of manifest.codes){
    const file=path.join(__dirname,'..',code.chunkPath);
    const document=JSON.parse(fs.readFileSync(file,'utf8'));
    for(const fixture of document.fixtures || [])events.push(fixtureIdentity.fromSchedule(fixture,code));
  }
  events.push(...majorDocument.events.filter(event=>event.kind!=='ticket_sale'));
  for(const parent of majorDocument.events || [])for(const subEvent of parent.subEvents || []){
    const fixture=major.fixtureFromSubEvent?.(subEvent,parent);
    if(fixture)events.push(fixture);
  }
  // Inspector punctuation variants refer to the same fixture as published cards.
  const byIdentity=new Map();
  for(const event of events){
    const key=calendar.idFor(event).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(!byIdentity.has(key))byIdentity.set(key,event);
  }
  cached=fixtureIdentity.estimateTimeline(fixtureIdentity.mergeOverlays([...byIdentity.values()],require('../data/discovery/enrichment.v1.json').events));return cached;
}
function subscriptionEvents(state,selection,now=new Date(),{historyDays=7,snapshots=[]}={}){
  const preferences=followFirst.migratePreferences(state?.preferences || {});
  const resolved=resolveUserFollowFixtures({events:catalogue(),userState:state});
  const events=calendar.uniqueEvents(require('./live-fixtures').overlaySnapshots(resolved.events,snapshots)).map(withCountries);
  const expanded=expandedFollowEntityIds(state);
  const families=new Set(preferences.followFirst.followedMajorEventIds || []);
  const eligible=events.filter(event=>{
    if(event.kind==='major_event' || event.kind==='tournament')return major.followed(event,preferences) || families.has(major.eventFamilyId(event));
    const applicableIds=event.participantsConfirmed===true || event.excludedParticipantIds?.length ? expandedFollowEntityIds(state,{event}) : expanded;
    const participantFollow=followPolicy.participantIds(event).some(id=>applicableIds.has(id));
    const muted = followPolicy.participantIds(event).some(id => followFirst.effectiveParticipantFollow(id,preferences).source==='mute');
    return !muted && (participantFollow || Boolean(followFirst.reasonForEvent(event,preferences)));
  }).map(calendar.idFor);
  const included=new Set(selection.includedIds || []);
  return calendar.selectedEvents(events,eligible,selection).filter(event=>{
    if(included.has(calendar.idFor(event)))return true;
    return fixtureIdentity.retainedInActiveTimeline(event,now,historyDays);
  });
}
module.exports={catalogue,subscriptionEvents};

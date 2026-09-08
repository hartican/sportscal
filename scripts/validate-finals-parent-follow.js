'use strict';
const assert=require('node:assert/strict');
const follow=require('../config/follow-first'),policy=require('../config/follow-feed-policy');
const {buildServerFeed}=require('../lib/server-feed-pipeline');
const fixture=require('../lib/competition-fixtures').fixtures().find(e=>e.id==='event:afl:cd_m20260142701');
assert(fixture);
const prefs={version:19,selectedSelectorEntityIds:['sport:afl-premiership','sport:nrl'],followedSports:['afl','nrl'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:afl',enabled:false},{sportDomainId:'sport:afl-premiership',enabled:true},{sportDomainId:'sport:nrl',enabled:true}]}};
assert(follow.reasonForEvent(fixture,prefs),'explicit AFL premiership follow must survive an old disabled parent');
assert.equal(policy.explicitlyExcluded(fixture,prefs),false);
const result=buildServerFeed({events:[fixture],userId:'finals-parent-regression',userState:{preferences:prefs},now:new Date('2026-09-09T00:00:00Z')});
assert(result.events.some(e=>e.id===fixture.id),'server Feed includes the actual screenshot final');
for(const blocked of [
 {...prefs,preferenceGraph:{...prefs.preferenceGraph,competitionPreferences:[{competitionId:fixture.competitionId,enabled:false}]}},
 {...prefs,preferenceGraph:{...prefs.preferenceGraph,entityFollows:[{participantId:fixture.participantIds[0],followLevel:'mute'}]}},
 {...prefs,preferenceGraph:{...prefs.preferenceGraph,domainPreferences:[{sportDomainId:'sport:afl-premiership',enabled:false}]}},
 {...prefs,selectedSelectorEntityIds:[],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:afl',enabled:false}]}}
])assert.equal(follow.reasonForEvent(fixture,blocked),null,'real exclusions retain precedence');
assert.equal(follow.reasonForEvent({...fixture,key:'aflw',sportDomainId:'sport:aflw',competitionId:'competition:aflw',gender:'women'},prefs),null,'AFLW is not inherited');
console.log('AFL finals: explicit premiership survives disabled parent; server parity and real exclusions passed.');
const nrl=require('../lib/competition-fixtures').fixtures().find(e=>e.key==='nrl'&&e.date==='2026-09-12');
assert(follow.reasonForEvent(nrl,{selectedSelectorEntityIds:['sport:nrl-premiership'],preferenceGraph:{domainPreferences:[{sportDomainId:'sport:nrl',enabled:false},{sportDomainId:'sport:nrl-premiership',enabled:true}]}}),'equivalent NRL child specificity');

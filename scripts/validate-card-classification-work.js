'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('index.html','utf8'),start=source.indexOf('function eventRecommendationProfile(');
const context={eventFollowReason(){throw new Error('Presentation classification must not repeat Feed admission');}};
vm.createContext(context);
vm.runInContext(source.slice(start<0?source.indexOf('function eventRecommendationClassification('):start,source.indexOf('function eventUsesFocusedSportFrothOverride(')),context);
for(const event of [{id:'fixture:followed'},{id:'fixture:unfollowed',manualPin:true},{cardType:'tennis_parent'},{key:'cricket'}])assert.equal(context.eventRecommendationClassification(event),'direct');
console.log('Card classification preserves direct presentation without repeating admission or changing fixture visibility.');

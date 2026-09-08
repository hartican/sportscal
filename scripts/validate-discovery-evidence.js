#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {acceptConsensus,acceptParticipation}=require('../lib/discovery-evidence');
const fixture={id:'rugby-test',name:'South Africa v New Zealand',key:'rugby',date:'2026-09-05'};
const a='https://www.bbc.co.uk/sport/rugby-union/articles/c7830m55lklo',b='https://www.skysports.com/rugby-union/news/12321/13578684/test';
const evidence=[{url:a,publishedAt:'2026-09-05',eventDate:'2026-09-05',eventName:fixture.name,publisherGroup:'bbc'},{url:b,publishedAt:'2026-09-05',eventDate:'2026-09-05',eventName:fixture.name,publisherGroup:'sky'}];
const accepted=acceptConsensus({eventId:fixture.id,label:'Rivalry',confidence:.9,evidence},{fixture,retrieved:[a,b],now:new Date('2026-09-08')});
assert.equal(accepted?.label,'Rivalry');assert.equal(accepted.sourceUrls.length,2);
for(const candidate of [
 {label:'Epic',evidence},
 {label:'Derby',evidence:evidence.map(item=>({...item,url:a}))},
 {label:'Rivalry',evidence:evidence.map(item=>({...item,eventDate:'2025-09-05'}))},
 {label:'Rivalry',evidence:[evidence[0],{...evidence[1],url:'https://bbc.com.im/sport/fake'}]},
 {label:'Rivalry',evidence:evidence.map(item=>({...item,publisherGroup:'reuters'}))},
 ])assert.equal(acceptConsensus({eventId:fixture.id,confidence:.9,...candidate},{fixture,retrieved:[a,b,'https://bbc.com.im/sport/fake'],now:new Date('2026-09-08')}),null);
console.log('Discovery evidence: sourced consensus accepted; ratings, stale fixtures, duplicate publishers and lookalike sources rejected.');
const athlete={id:'competitor:f1:george-russell',displayName:'George Russell',aliases:[],sportKey:'f1'};
const race={id:'fixture:nls:2026:8',name:'NLS Round 8',date:'2026-09-12',key:'motorsport',competitionId:'competition:nls-2026'};
const url='https://www.nuerburgring-langstrecken-serie.de/language/en/race-entry';
const entry={participantId:athlete.id,eventId:race.id,participationStatus:'confirmed',participationKind:'race',matchedName:'George Russell',evidence:[{url,publishedAt:'2026-09-08',eventDate:race.date,eventName:race.name,publisherGroup:'nls'}]};
const context={athletes:[athlete],fixtures:[race],retrieved:[url],now:new Date('2026-09-08'),texts:{[url]:'NLS Round 8 entry list. George Russell will race at NLS Round 8 on 12 September 2026.'}};
assert.equal(acceptParticipation(entry,context)?.participantId,athlete.id);
assert.equal(acceptParticipation(entry,{...context,texts:{[url]:'Georges drives through Karussell in NLS Round 8.'}}),null);
assert.equal(acceptParticipation({...entry,participationKind:'test'},context),null);
assert.equal(acceptParticipation(entry,{...context,texts:{[url]:'NLS Round 8. George Russell hopes to race here one day.'}}),null);
assert.equal(acceptParticipation(entry,{...context,texts:{[url]:'NLS Round 8 entry list. George Russell will race at NLS Round 8 on 12 September 2025.'}}),null,'a recurring event name cannot carry last year’s entry into this year');
console.log('Athlete evidence: explicit entries accepted; ambiguous search hits, testing and interest rejected.');

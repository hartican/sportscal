'use strict';
const assert=require('node:assert/strict');
const {assessNarrative}=require('./lib/editorial-enrichment-readiness');
// Exact public fixture/fallback fields retained from 7a794042 data/events.json.
// This reference is the recorded cloud run, never a renewed source observation.
const reference=Date.parse('2026-11-02T03:38:57.317Z');
const fixture={id:'epl-2026-27-129047',eventId:'epl-2026-27-129047',canonicalEventId:'event:premier-league:129047',
  key:'premier-league',competitionId:'competition:premier-league-2026-27',season:'2026/27',status:'upcoming',
  name:'Coventry City v Ipswich Town',date:'2026-12-02',startTimeUtc:'2026-12-01T20:00:00.000Z',
  homeParticipantId:'team:football:epl:5',awayParticipantId:'team:football:epl:8',
  sourceType:'official',sourceTrust:'verified',sourceName:'Premier League official fixture schedule',
  sourceUrl:'https://www.premierleague.com/en/matches/premier-league/2026-27',canonicalSourceUrl:'https://www.premierleague.com/en/matches/premier-league/2026-27',
  sourceCheckedAt:'2026-10-22T16:43:52.871Z',canonicalSourceCheckedAt:'2026-10-11T12:38:51.272Z',
  selectedSentence:'Premier League Matchweek 13 fixture, with a provisional kickoff subject to broadcast and competition amendments.',
  fullSpiel:"Coventry City v Ipswich Town is listed in the Premier League's official 2026/27 schedule. Kick-off and venue details will refresh from the league if the fixture moves."};
const original=JSON.stringify(fixture),genericPatterns=[/late-season (?:contest|test)/i];
const assess=(record,options={})=>assessNarrative(record,{reference,start:Date.parse(record.startTimeUtc),stakes:3,hasRetainedProjection:()=>false,genericPatterns,...options});
let controls=0;
assert.equal(assess(fixture).status,'deferred');controls++;
const day15={...fixture,date:'2026-11-17',startTimeUtc:'2026-11-16T13:00:00.000Z'};
assert.equal(assess(day15).status,'deferred','First day outside the chosen Sydney-calendar preview horizon');controls++;
const hard=(record,options={},pattern=/needs a researched/)=>{assert.throws(()=>assess(record,options),pattern);controls++;};
assert.equal(assess({...fixture,storyline:{stakes:3,lastReviewedAt:fixture.canonicalSourceCheckedAt}}).status,'deferred','Metadata-only storyline preserves the factual display fallback');controls++;
for(const field of ['hookSpoilerOff','hookSpoilerOn','synopsisSpoilerOff','synopsisSpoilerOn']){
  hard({...fixture,storyline:{[field]:'Different unsupported preview'}});
  hard({...fixture,storyline:{[field]:field.startsWith('hook')?fixture.selectedSentence:fixture.fullSpiel}}); // even exact copy overrides stay outside this narrow policy
}
for(const storyline of [null,'not metadata',[]])hard({...fixture,storyline});
hard({...fixture,storyline:Object.create({synopsisSpoilerOff:'Inherited unsupported preview'})});
hard({...fixture,date:'2026-11-16',startTimeUtc:'2026-11-16T12:00:00.000Z'}); // day14, despite >14 elapsed24-hour periods
hard(fixture,{stakes:4});hard(fixture,{stakes:5});
for(const status of ['live','completed','postponed','suspended','cancelled','unknown'])hard({...fixture,status});
for(const patch of [
  {key:'football'},{eventId:'another-fixture'},{canonicalEventId:'event:premier-league:other'},
  {competitionId:'competition:other'},{season:'2027/28'},{homeParticipantId:''},{awayParticipantId:fixture.homeParticipantId},
  {sourceType:'reputable'},{sourceTrust:'unverified'},{sourceName:'Another source'},
  {sourceUrl:'https://example.invalid/claimed-official'},{canonicalSourceUrl:'http://www.premierleague.com/'},
  {sourceCheckedAt:'2999-01-01T00:00:00Z'},{canonicalSourceCheckedAt:'2026-02-30T00:00:00Z'},
  {selectedSentence:'Unsupported claims presented as a preview.'},{fullSpiel:'Research attributed without supporting evidence.'},
  {editorialPreview:{status:'journalistic'}},{editorialPreview:null},{editorialNarrative:{}},
  {date:'2026-12-03'},{startTimeUtc:null},
])hard({...fixture,...patch});
hard(fixture,{reference:NaN});
hard(fixture,{start:reference+31*86400000}); // literal/options start mismatch, not the horizon test
hard({...fixture,date:'2026-12-03',startTimeUtc:'2026-12-02T20:00:00.000Z'}); // consistent date/start beyond the30-day limit
hard(fixture,{hasRetainedProjection:()=>true});hard(fixture,{hasRetainedProjection:()=>undefined});
hard(fixture,{hasRetainedProjection:undefined});
assert.throws(()=>assess(fixture,{hasRetainedProjection:()=>{throw Error('Projection authority unavailable');}}),/Projection authority unavailable/);controls++;
hard({...fixture,editorialNarrative:{hook:'Existing hook only.'}}, {}, /needs a researched L1/);
const ready={...fixture,editorialNarrative:{hook:'An existing original hook.',synopsis:'Existing original context.'}};
assert.equal(assess(ready).status,'ready');controls++;
hard({...ready,editorialNarrative:{...ready.editorialNarrative,hook:'A late-season contest'}},{},/generic L0/);
hard({...ready,editorialNarrative:{...ready.editorialNarrative,synopsis:'A late-season test'}},{},/generic L1/);
assert.equal(JSON.stringify(fixture),original,'Classification never modifies fixture facts, source clocks or fallback');controls++;
console.log(`Editorial enrichment draft: ${controls} focused readiness controls passed; no provider, account or source writes.`);

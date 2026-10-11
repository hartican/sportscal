'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
function validate(){
 const root=path.resolve(__dirname,'..'),audit=require('../data/coverage/australian-viewing-rights.v1.json'),rule=audit.reviewedWindows.find(r=>r.id==='shanghai-masters-2026-au-viewing');
 const follow=require('../config/follow-first'),review=require('../lib/reviewed-au-viewing').reviewedAuViewing;
 const tournament=require('../data/canonical/tennis-catalogue-2026.json').tournaments.find(t=>t.tournamentId==='tournament:tennis:atp-shanghai-2026');assert(tournament&&rule);
 const raw=require('./sync-tennis-tournaments-to-feed').tournamentToCard(tournament,'2026-10-11');
 const parent=require('../data/tennis-feed-parents.v1.json').parents.find(p=>p.tournamentId===tournament.tournamentId);assert(parent);
 const fixtures=require('../data/canonical/tennis-scoreboard.v1.json').fixtures.filter(f=>f.tennisTournamentId===tournament.tournamentId);assert(fixtures.length>0);
 const sample=fixtures.find(f=>f.date==='2026-10-07'&&!f.startTimeUtc);assert(sample,'Retained actual dated match with unknown clock');
 const inputs=[raw,parent,sample,{...parent,id:'overview:tennis:'+tournament.tournamentId+':2026',canonicalEventId:'overview:tennis:'+tournament.tournamentId+':2026'}];
 const fields=new Set(['viewingOptions','broadcaster','broadcastOptions','broadcasterIds']);
 const facts=e=>Object.fromEntries(Object.entries(e).filter(([key])=>!fields.has(key)));
 const providers=e=>follow.viewingOptions(e).map(o=>o.providerId);
 for(const event of inputs){
  const before=structuredClone(event),result=review(event),options=follow.viewingOptions(result);
  assert.deepEqual(providers(result),['bein'],'actual producer/parent/match and controlled overview use scoped AU evidence');
  assert(options.every(o=>o.rightsScope==='competition'&&o.linkScope==='sport'&&o.territory==='AU'&&o.accessType==='subscription'&&!o.replayVerified),'competition guide cannot claim free playback, a match permalink or a replay');
  assert.equal(result.viewingOptions[0].verifiedAt,rule.verifiedAt);assert.equal(result.viewingOptions[0].sourceUrl,rule.sourceUrl);
  assert.deepEqual(facts(result),facts(event),'all sporting facts, identities, source clocks and unknowns remain exact');assert.deepEqual(event,before,'reader does not mutate inputs');
  assert.deepEqual(review(result),result,'unchanged source evidence retains the same output');
 }
 const sydneyDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
 for(const fixture of fixtures){
  const date=fixture.startTimeUtc?sydneyDate.format(new Date(fixture.startTimeUtc)):fixture.date;
  const available=date>=rule.notBefore&&date<rule.notAfter;
  assert.deepEqual(providers(review(fixture)),available?['bein']:[],'each retained Shanghai fixture respects its dated edition window');
  assert.deepEqual(facts(review(fixture)),facts(fixture),'all retained Shanghai fixture facts and original clocks remain');
 }
 const inspector=require('./build-code-inspector'),code=require('../config/canonical-sports-taxonomy').sportDomains.find(c=>c.id==='sport:tennis');assert(code);
 const viewing=require('../lib/reviewed-au-viewing');let baseline;
 try{viewing.reviewedAuViewing=event=>event;baseline=inspector.codeFixtures(code);}finally{viewing.reviewedAuViewing=review;}
 const projected=inspector.codeFixtures(code),projectedMatches=projected.filter(f=>f.tennisTournamentId===tournament.tournamentId);
 assert.deepEqual(projected.map(f=>f.id),baseline.map(f=>f.id),'viewing review cannot change Schedule identities or ordering');
 projected.forEach((fixture,index)=>assert.deepEqual(facts(fixture),facts(baseline[index]),'viewing review preserves all composed Schedule facts, clocks and independent timing evidence'));
 assert(projectedMatches.length>0,'actual Schedule projection includes retained Shanghai matches');
 for(const fixture of projectedMatches){
  const date=fixture.startTimeUtc?sydneyDate.format(new Date(fixture.startTimeUtc)):fixture.date;
  assert.deepEqual(providers(fixture),date>=rule.notBefore&&date<rule.notAfter?['bein']:[],'real Schedule projection retains the edition-specific option');
 }
 const variants=[{key:'football'},{taxonomySportId:'sport:football'},{tennisTournamentId:'tournament:tennis:atp-shanghai-2027'},
  {tournamentId:'tournament:tennis:atp-tokyo-2026'},{tournamentIds:['tournament:tennis:atp-shanghai-2026','tournament:tennis:wta-wuhan-2026']},
  {tournamentIds:'tournament:tennis:atp-shanghai-2026'},{tournamentIds:['']},{season:2027},{tour:'WTA'},{representedTours:['ATP','WTA']},
  {competitionId:'competition:wta-tour'},{date:'2026-10-06'},{date:'2026-10-19'},{date:'2026-02-30'},
  {tennisTournamentId:undefined,tournamentId:undefined,tournamentIds:undefined}];
 for(const variant of variants){const event={...raw,...variant};assert.deepEqual(providers(review(event)),[],JSON.stringify(variant)+': unrelated, contradictory or unsupported context cannot inherit Shanghai rights');}
 const reviewed=review(raw),expired=review({...reviewed,date:'2026-10-19'});assert.deepEqual(providers(expired),[],'generated options expire with their source window');assert.equal(expired.broadcaster,'Australian viewing unconfirmed');
 const independentlySourced={providerId:'seven',rightsScope:'fixture',linkScope:'fixture',webUrl:'https://www.7plus.com.au/',sourceUrl:'https://example.test/controlled-fixture-rights',verifiedAt:'2026-10-10T00:00:00Z'};
 assert.deepEqual(providers(review({...raw,viewingOptions:[independentlySourced]})),['seven'],'controlled independently sourced fixture access outranks general carriage');
 for(const invalid of [{verifiedAt:'2099-01-01T00:00:00Z'},{verifiedAt:'2026-02-30T00:00:00Z'},{sourceUrl:'http://example.test/fixture'},{sourceUrl:'https://owner:secret@example.test/fixture'}]){
  assert.deepEqual(providers(review({...raw,viewingOptions:[{...independentlySourced,...invalid}]})),['bein'],'invalid independent evidence cannot displace genuine competition guidance');
 }
 const preferences={preferenceGraph:{competitionPreferences:[{competitionId:raw.competitionId,enabled:false}],entityFollows:[{participantId:'player:tennis:alex-de-minaur',followLevel:'follow'}]},reminderChoice:'off'};
 for(const event of inputs)assert.deepEqual(follow.reasonForEvent(review(event),preferences),follow.reasonForEvent(event,preferences),'viewing presentation cannot change explicit follow/exclusion choices');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-shanghai-viewing-'));
 try{
  const document=structuredClone(require('../data/events.json'));assert(!document.events.some(e=>e.id===raw.id));document.events.push(raw);
  const input=path.join(temp,'incoming.json'),output=path.join(temp,'events.json');fs.writeFileSync(input,JSON.stringify(document));fs.writeFileSync(output,JSON.stringify(document));
  const args=[path.join(__dirname,'publish-feed.js'),input,output,path.join(temp,'meta.json'),path.join(temp,'events.js'),'--preserve-known'];
  execFileSync(process.execPath,args,{cwd:root,stdio:'pipe'});const actual=JSON.parse(fs.readFileSync(output));
  assert.deepEqual(actual.events.map(e=>e.id),document.events.map(e=>e.id),'real publisher preserves every fixture identity and order');
  const event=actual.events.find(e=>e.id===raw.id);assert.deepEqual(providers(event),['bein'],'actual publisher persists viewing guidance for the failed card producer');
  for(const key of ['id','eventId','date','time','timeTbc','tennisTournamentId','competitionId','sourceUrl','sourceCheckedAt','lastReviewedAt','status'])assert.deepEqual(event[key],raw[key],'publication retains '+key);
  assert(event.startTimeUtc==null,'publication does not invent a sporting clock');
  const first=structuredClone(actual.events);execFileSync(process.execPath,args,{cwd:root,stdio:'pipe'});assert.deepEqual(JSON.parse(fs.readFileSync(output)).events,first,'unchanged publication retains facts and viewing observations');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log('Shanghai AU viewing: actual failed-card producer, retained parent/match, scoped paid guidance, identity/tour/date guards, independent fixture overrides and real publication preserve facts, clocks, choices and unchanged reruns.');
}
module.exports={validate};if(require.main===module)validate();

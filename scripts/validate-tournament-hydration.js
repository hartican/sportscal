#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const bjk=require('./refresh-bjk-cup'),hydration=require('./refresh-tournament-hydration');
const blocks=['2026 Billie Jean King Cup Finals Schedule','Tuesday 22 September','Czechia v Great Britain (17:00) – Quarter-final 1','Wednesday 23 September','Spain v Kazakhstan (17:00) – Quarter-final 2','Thursday 24 September','Ukraine v Belgium (10:00) – Quarter-final 3','China v Italy (not before 17:00) – Quarter-final 4','Friday 25 September','Semi-final 1 (17:00) – Winner Quarter-final 1 v Winner Quarter-final 2','Saturday 26 September','Semi-final 2 (17:00) – Winner Quarter-final 3 v Winner Quarter-final 4','Sunday 27 September','Final (17:00)'];
const checkedAt='2026-09-24T08:00:00.000Z';
const fixtures=bjk.parseSchedule({blocks},checkedAt);
assert.equal(require('../config/fixture-identity').fromSchedule(fixtures[3],'tennis').timePrecision,'not-before');
assert.equal(fixtures.length,7);assert.equal(fixtures[0].time,'19:00');assert.equal(fixtures[2].time,'12:00');assert.equal(fixtures[3].timePrecision,'not-before');assert.equal(fixtures[6].startTimeUtc,'2026-09-27T09:00:00.000Z');
assert.equal(bjk.local('2026-10-04T16:00:00Z').date,'2026-10-05','Sydney daylight saving crosses the date boundary');
assert.throws(()=>bjk.parseSchedule({blocks:blocks.slice(0,4)},checkedAt),/seven/);
const documents=[{url:'https://www.billiejeankingcup.com/en/news/test-quarter-final',checkedAt,doc:{titles:[],blocks:['Historical 2025 win: 6-0 6-0','Match 1: Marie Bouzkova (CZE) d. Sonay Kartal (GBR) 7-6(2) 4-6 6-4','Match 2: Linda Noskova (CZE) d. Katie Boulter (GBR) 6-2 7-6(3)']}}];
const inProgress=bjk.applyArticles(bjk.parseSchedule({blocks},checkedAt),[{...documents[0],doc:{titles:[],blocks:[documents[0].doc.blocks[1]]}}]);assert.equal(inProgress[0].status,'live');assert.equal(inProgress[0].score,'1-0');assert(!inProgress[0].winnerParticipantId);
bjk.applyArticles(fixtures,documents);
assert.equal(fixtures[0].score,'2-0');assert.equal(fixtures[0].status,'completed');assert.equal(fixtures[0].rubbers[2].status,'not-required');assert.equal(fixtures[4].participantSlots[0].label,'Czechia');assert.equal(fixtures[4].id,'fixture:tennis:bjk-cup:2026:finals:sf1');assert.match(fixtures[4].spoilerSafeTitle,/Winner Quarter-final 1/);
const repeated=bjk.applyArticles(bjk.parseSchedule({blocks},checkedAt),[],fixtures);assert.equal(repeated[0].score,'2-0','a failed article fetch preserves confirmed results');
const correction=bjk.applyArticles(bjk.parseSchedule({blocks},checkedAt),[{...documents[0],doc:{titles:[],blocks:['Match 2: Katie Boulter (GBR) d. Linda Noskova (CZE) 6-2 6-2']}}],fixtures);assert.equal(correction[0].score,'1-1');assert.equal(correction[0].winnerParticipantId,undefined,'a corrected rubber retracts the previous winner');assert.equal(correction[4].participantSlots[0].participantId,null);
assert.equal(bjk.parseRubbers({blocks:['Match 1: (Singles)']},'source',checkedAt).length,0,'unannounced lineups never come from squad order');
const mixed='Match 3: Cristina Bucsa/Sara Sorribes Tormo (ESP) d Anna Danilina/Zhibek Kulambayeva (KAZ) 6-2 7-5';
assert.equal(bjk.parseRubbers({blocks:[mixed]},'source',checkedAt)[0].sides[0].names.length,2);
const flight='f:'+JSON.stringify({body:{nodeType:'heading-3',content:[{nodeType:'text',value:'Match 1: '},{nodeType:'text',value:'A (CZE) d. B (GBR) 6-0 6-0'}]}})+'\n';
assert.equal(bjk.article('<script>self.__next_f.push('+JSON.stringify([1,flight])+')</script>').blocks[0],'Match 1: A (CZE) d. B (GBR) 6-0 6-0');
for(const [start,end,want]of [['2026-10-01','2026-10-10',true],['2026-10-02','2026-10-10',false],['2026-09-01','2026-09-26',true],['2026-09-01','2026-09-16',false]])assert.equal(hydration.eligible({startDate:start,endDate:end},'2026-09-24'),want);
assert(!hydration.eligible({kind:'ticket_sale',startDate:'2026-09-01',endDate:'2027-01-01'},'2026-09-24'));
assert.equal(hydration.adapterFor({tournamentId:'R2026500',code:'golf'}),'pga');assert.equal(hydration.adapterFor({tournamentId:'event:wrc:2026:round-13',code:'wrc'}),'wrc');assert.equal(hydration.assess({fixtures:[{id:'placeholder',status:'provisional'}]},null,{}).status,'partial');
assert.equal(hydration.assess({fixtures:[{id:'calendar',date:'2026-09-24'}]},'pga',{}).status,'partial','calendar presence cannot attest rounds');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-hydration-test-')),reportPath=path.join(tmp,'report.json');
 const t={tournamentId:bjk.TOURNAMENT,code:'tennis',name:'BJK',startDate:'2026-09-22',endDate:'2026-09-27',fixtures:[]};let calls=0;
 try{
  const snapshot=path.join(tmp,'teams.json');fs.copyFileSync('data/canonical/tennis-team-contests.v1.json',snapshot);
  const htmlFor=lines=>'<script>self.__next_f.push('+JSON.stringify([1,'f:'+JSON.stringify({body:lines.map(value=>({nodeType:'paragraph',content:[{nodeType:'text',value}]}))})+'\n'])+')</script>';
  const fetchImpl=async url=>({ok:true,text:async()=>htmlFor(url===bjk.SCHEDULE?blocks:documents[0].doc.blocks)});
  const first=await bjk.refresh({fetchImpl,now:new Date(checkedAt),output:snapshot});assert(first.changed);assert.equal(JSON.parse(fs.readFileSync(snapshot)).fixtures.filter(f=>f.tournamentId===bjk.TOURNAMENT).length,7);
  const bytes=fs.readFileSync(snapshot);const second=await bjk.refresh({fetchImpl,now:new Date('2026-09-24T09:00:00Z'),output:snapshot});assert(!second.changed);assert(fs.readFileSync(snapshot).equals(bytes),'timestamp-only fetch is byte-identical');
  const fail=await hydration.refresh({now:new Date(checkedAt),inventoryFn:()=>[t,t],runAdapter:async()=>{calls++;throw new Error('Source unavailable');},reportPath});
  assert.equal(calls,1,'shared sources checked once');assert(fail.tournaments.every(t=>t.issues.includes('Source unavailable')));
  const offline=await hydration.refresh({now:new Date(checkedAt),offline:true,inventoryFn:()=>[t],runAdapter:async()=>{throw new Error('must not fetch');},reportPath});assert(offline.tournaments[0].issues.includes('Offline: source not checked'));
  const full=fs.readFileSync('scripts/update-cards.js','utf8'),quick=fs.readFileSync('scripts/quick-results.js','utf8');assert(full.includes('["scripts/refresh-tournament-hydration.js", "--full"]'));assert(quick.includes("require('./refresh-tournament-hydration').refresh({now,offline})"));
  assert.equal(bjk.semantic({a:1,sourceCheckedAt:'a'}),bjk.semantic({a:1,sourceCheckedAt:'b'}));
  console.log('Tournament hydration: seven-day windows, sources, incomplete formats, preservation, offline, deduplication and BJK bracket/match parsing passed.');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});

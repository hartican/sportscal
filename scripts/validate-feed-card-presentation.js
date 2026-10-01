'use strict';
const assert=require('node:assert/strict'),p=require('../config/feed-card-presentation'),t=require('../config/card-timing'),v=require('../config/venue-registry'),f=require('../config/follow-first');
const now=new Date('2026-09-24T00:00:00Z');
for(const [day,suffix] of [[1,'1ST'],[2,'2ND'],[3,'3RD'],[11,'11TH'],[12,'12TH'],[13,'13TH'],[21,'21ST'],[22,'22ND'],[23,'23RD']])assert.equal(p.ordinal(day),suffix);
assert.equal(p.dateBanner('2026-09-25',now),'FRI 25 SEP');assert.match(p.dateBanner('2027-01-01',now),/2027$/);
assert.equal(p.venue({venue:'Suncorp Stadium',venueCity:'Brisbane'},v),'Suncorp Stadium, Brisbane');
assert.equal(p.venue({venue:'MCG',venueCity:'Melbourne'},v),'Melbourne Cricket Ground, Melbourne');
assert.equal(p.venue({venue:'Unknown'},v),'Venue TBC');
assert.equal(p.venue({venue:'Suncorp Stadium'},v),'Suncorp Stadium, Brisbane','cached projections can recover reviewed venue location');
const fixture={competitionId:'competition:nrl-premiership-2026',startTimeUtc:'2026-09-25T09:50:00Z'};
const data={ladderSnapshots:[{competitionId:fixture.competitionId,snapshotTimeUtc:'2026-09-23T00:00:00Z',entries:[{participantId:'team:nrl:9538',rank:3}]},{competitionId:fixture.competitionId,snapshotTimeUtc:'2026-09-30T00:00:00Z',entries:[{participantId:'team:nrl:9538',rank:1}]}]};
assert.equal(p.ranking(fixture,'team:nrl:9538',data.ladderSnapshots).label,'3RD','the later table must not rewrite a historical badge');
assert.equal(p.ranking({...fixture,startTimeUtc:'2025-01-01T00:00:00Z'},'team:nrl:9538',data.ladderSnapshots),null);
assert.equal(p.ranking(fixture,'team:missing',data.ladderSnapshots),null);
for(const [entry,label] of [[{rank:6,sharedRank:true},'Joint 6'],[{rank:6},'6'],[{rank:6,rankPending:true},'Pending'],[{rank:null,rankPending:true},'Pending'],[{rank:null},'—'],[{rank:false},'—'],[{rank:''},'—'],[{rank:0},'—'],[{rank:1.5},'—']])assert.equal(p.standingPosition(entry),label);
const tiedSnapshot={competitionId:fixture.competitionId,snapshotTimeUtc:'2026-09-24T00:00:00Z',seasonLabel:'2026',roundLabel:'After Matchweek 5',entries:[{participantId:'test:club',rank:6,sharedRank:true}]};
assert.equal(p.ranking(fixture,'test:club',[tiedSnapshot]).label,'JOINT 6TH','a sourced shared rank must not become an exclusive ordinal badge');
tiedSnapshot.entries[0].rankPending=true;
assert.equal(p.ranking(fixture,'test:club',[tiedSnapshot]),null,'a pending position must not produce a definite rank badge');
// Exercise actual JSON loading and compact browser expansion; packing must not
// silently strip the semantics before a correct formatter ever sees them.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),builder=require('./build-app-shell-runtime');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ns-position-wire-'));
try{
  const wire={...tiedSnapshot,entries:[{participantId:'test:club:a',rank:1},{participantId:'test:club:b',rank:2,sharedRank:true},{participantId:'test:club:c',rank:null,rankPending:true},{participantId:'test:club:d',rank:4},{participantId:'test:club:e',rank:8}]};
  fs.writeFileSync(path.join(dir,'sample.json'),JSON.stringify({ladderSnapshots:[wire]}));
  const loaded=builder.cardStandings(dir),context={};vm.runInNewContext(builder.standingsSource(loaded),context);
  const expanded=JSON.parse(JSON.stringify(context.NOTHINGSPORTS_FEED_CARD_STANDINGS));assert.deepEqual(expanded,[wire]);
  assert.equal(p.ranking(fixture,'test:club:a',expanded).label,'1ST');assert.equal(p.ranking(fixture,'test:club:b',expanded).label,'JOINT 2ND');assert.equal(p.ranking(fixture,'test:club:c',expanded),null);assert.equal(p.ranking(fixture,'test:club:e',expanded).label,'8TH');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
for(const status of ['live','completed','postponed','cancelled'])assert(t.presentation({...fixture,status},now).primary===t.presentation({...fixture,status},now).status);
assert.equal(t.presentation({...fixture,date:'2026-09-25',timePrecision:'follows'},now).primary,'FOLLOWS PRIOR MATCH');
assert.equal(t.presentation({...fixture,timeTbc:true},now).primary,'TIME TBC');
assert.equal(t.presentation({...fixture,timePrecision:'estimated'},now).primary,'APPROX. 7:50 PM');
for(const id of ['major-match:nrl-finals-2026:preliminary-final-2','major-match-nrl-finals-2026-preliminary-final-1'])assert.deepEqual(f.viewingOptions({id,key:'nrl'}).map(x=>x.providerId),['nine-tv','nine','kayo','foxtel']);
assert(!f.viewingOptions({id:'unrelated',key:'nrl'}).some(x=>x.providerId==='nine-tv'));
assert.deepEqual(f.viewingOptions({id:'major-match:nrl-finals-2026:preliminary-final-2',key:'nrl'},['foxtel']).map(x=>x.providerId),['nine-tv','nine','kayo','foxtel']);
console.log('Feed presentation: dates, timing, source-backed rankings, historical cutoff, full venues and fixture-specific providers passed.');
for(const [id,label] of [['team:afl:cd_t60','Dockers'],['participant:team:afl:cd_t20','Lions'],['team:football:socceroos','Socceroos'],['team:football:matildas','Matildas'],['team:cricket:south-africa-women','Proteas Women']])assert.equal(p.displayLabel(id,'Canonical name'),label);
assert.equal(p.displayLabel('team:unknown','Unknown club'),'Unknown club');
assert.equal(p.displayLabel('athlete:tennis:unknown','Player Name'),'Player Name');
assert.deepEqual(p.palette({participantIds:['team:afl:cd_t60','team:afl:cd_t20']}),['#7751a8','#a53557']);
assert.deepEqual(p.palette({participantIds:['team:tennis:bjk-cup:czechia','team:tennis:bjk-cup:spain'],participants:[{id:'team:tennis:bjk-cup:czechia',countryCode:'CZ'},{id:'team:tennis:bjk-cup:spain',countryCode:'ES'}]}),['#3863a5','#b63342']);
assert.deepEqual(p.palette({key:'f1',venueCountryCode:'AU',participantIds:['athlete:f1:a','athlete:f1:b']}),['#397c66','#c8a733'],'two featured drivers never produce a team split');
assert.equal(p.palette({key:'f1',venueCountryCode:'ZZ'}),null);
assert.deepEqual(p.palette({key:'golf',competitionId:'competition:golf:masters-2027'}),['#248458','#248458']);
console.log('Feed polish: canonical nickname mappings, unknown identities, team/nation splits and event palettes passed.');
assert.equal(p.displayLabel('team:afl:cd_t60','Winner of preliminary final'),'Winner of preliminary final','display nicknames cannot reveal protected opponents');
assert.equal(p.palette({participantIds:['team:afl:cd_t60','team:afl:cd_t20']},[{label:'Winner of preliminary final'}]),null,'team tints cannot reveal protected opponents');

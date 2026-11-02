'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const canonicalId='major-match:rlwc-2026:tonga-samoa';
const publishedId='major-match-rlwc-2026-tonga-samoa';
const ids=['team:nrl:national:tonga','team:nrl:national:samoa'];
const labels=['Tonga','Samoa'];

const socceroos='team:football:socceroos';
const socceroosAsset='assets/identities/national/football/socceroos-symbol.svg';
const football=Object.freeze({
  'football-qatar-australia-2026-11-14':Object.freeze({opponent:'Qatar',id:'team:football:qatar',country:'QA'}),
  'football-jordan-australia-2026-11-18':Object.freeze({opponent:'Jordan',id:'team:football:jordan',country:'JO'}),
});
function ruleFor(event){
  if([canonicalId,publishedId].includes(event?.id))return {canonicalId,ids,labels,displayIds:ids,optionalIds:ids,key:'nrl',competition:'competition:rugby-league-world-cup:2026',sourceName:'International Rugby League',sourceUrl:'https://www.intrl.sport/match-details/2578'};
  const team=football[event?.id];
  if(team)return {canonicalId:event.id,ids:[team.id,socceroos],labels:[team.opponent,'Socceroos'],displayIds:[socceroos,team.id],optionalIds:[team.id],key:'football',competition:'competition:football:international-friendlies',sourceName:'Football Australia / Socceroos',sourceUrl:'https://socceroos.com.au/fixtures',country:team.country};
  return null;
}
function applies(event){return Boolean(ruleFor(event));}

function assertEligible(event,sides){
  const rule=ruleFor(event);
  assert(rule,'Absent-artwork allowance is limited to the three exact reviewed fixtures');
  assert.equal(event.canonicalEventId||event.id,rule.canonicalId,'Exact canonical fixture identity required');
  assert.equal(event.key,rule.key,'Correct sport identity required');
  assert.equal(event.sportDomainId,'sport:'+rule.key);
  assert.equal(event.competitionId,rule.competition);
  assert.equal(event.competitionScope,'international');
  assert.equal(event.isInternational,true);
  assert.equal(event.participantsConfirmed,true);
  assert.equal(event.name,rule.labels.join(' v '));
  assert.equal(event.sourceName,rule.sourceName);
  assert.equal(event.sourceUrl,rule.sourceUrl);
  assert.equal(event.sourceType,'official');
  assert(Number.isFinite(Date.parse(event.sourceCheckedAt))&&Date.parse(event.sourceCheckedAt)<=Date.now(),'Genuine original source observation required');
  assert.deepEqual(event.participantIds,rule.ids,'Exact distinct sport-specific participant IDs and source order required');
  assert.deepEqual((event.participants||[]).map(p=>p.id),rule.ids);
  assert.deepEqual(event.participants.map(p=>p.name||p.displayName),rule.labels);
  assert.deepEqual(event.participants.map(p=>p.role),['home','away'],'Sourced home/away roles required');
  assert.equal(sides.length,2);
  assert.deepEqual(sides.map(s=>s.participant?.id),rule.displayIds,'Existing Australian-first display order must not change source home/away roles');
  assert.deepEqual(sides.map(s=>s.label),rule.displayIds.map(id=>rule.labels[rule.ids.indexOf(id)]));
  if(rule.key==='football'){
    assert.equal(event.homeParticipantId,rule.ids[0]);assert.equal(event.awayParticipantId,socceroos);
    assert.deepEqual(event.participants.map(p=>p.countryCode),[rule.country,'AU']);
    const mark=sides.find(s=>s.participant.id===socceroos).mark;
    assert.equal(mark?.id,socceroos,'Existing Socceroos artwork remains required');
    assert.equal(mark.isNationalTeam,true);
    for(const url of [mark.url,...['primary','light','dark','icon','iconLight','iconDark'].map(k=>mark.logo?.[k])])assert.equal(url,socceroosAsset,'Required Socceroos image reference cannot use the optional-artwork allowance');
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',socceroosAsset))).digest('hex'),'b5b451c0044372f7c4980d2fde14aa9d78423200fb3660f1c5a985411b04b818','Required local Socceroos asset must retain its reviewed bytes');
  }
  for(const side of sides.filter(s=>rule.optionalIds.includes(s.participant?.id)))assert.equal(side.mark,null,'An absent optional crest cannot conceal a referenced/broken image or assert fabricated artwork');
  for(const participant of [...event.participants,...(event.participantSlots||[])].filter(p=>rule.optionalIds.includes(p.id||p.participantId))){
    for(const field of ['logoUrl','logoDarkUrl','crestUrl','imageUrl','logo','crest'])assert(!participant[field],'Referenced artwork must pass normal image checks, not the text-only allowance');
  }
  return true;
}
module.exports={applies,assertEligible,ruleFor};

'use strict';
const crypto=require('node:crypto');
const preferences=require('../config/milestone-preferences');
const coverage=require('../config/cricket-coverage');
const actionIdentity=require('../config/event-action-identity');
const feedPolicy=require('../config/follow-feed-policy');
const follow=require('../config/follow-first');
const FRESH_MS=240000,ACHIEVEMENT_MS=300000;
// Accepted source rows use their primary fixture ID; other provider aliases
// remain available to the shared action/consent resolver.
const id=e=>String(e.id||e.canonicalEventId||e.eventId||'');
const format=e=>{const explicit=String(e.format||e.matchFormat||'').trim().toLowerCase(),known={test:'test',tests:'test',odi:'odi',odis:'odi','one day':'odi','one-day':'odi',t20:'t20',t20i:'t20',t20is:'t20',twenty20:'t20',bbl:'t20'};if(explicit)return known[explicit]||null;if(/warm.up|invitation xi/i.test(e.name||''))return null;return ({Tests:'test',ODIs:'odi',T20Is:'t20',BBL:'t20'})[coverage.format(e)]||null;};
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const latest=e=>[...(e.innings||[])].sort((a,b)=>a.inningNumber-b.inningNumber).at(-1);
function fresh(e,now){const i=latest(e),at=Date.parse(i?.detailCheckedAt||'');return Array.isArray(e.innings)&&new Set(e.innings.map(i=>i.inningNumber)).size===e.innings.length&&e.cricketPhaseConfirmed===true&&e.sourceStale!==true&&e.stale!==true&&i?.detailStale!==true&&Number.isFinite(at)&&at<=now&&now-at<=FRESH_MS&&coverage.allowed(e)&&format(e);}
function playing(e,now){return fresh(e,now)&&e.status==='live';}
function key(e,family,actor,target,inning){return crypto.createHash('sha256').update(JSON.stringify(['milestone.v1',id(e),family,String(actor),target,inning])).digest('hex');}
function moment(e,{family,actor,target,inning,priority,stage,text,value},now){return {schemaVersion:'sport-moment.v1',momentId:key(e,family,actor,target,inning),eventId:id(e),sport:'cricket',family,actor:String(actor),target,inning,priority,stage,text,value,observedAt:latest(e).detailCheckedAt,detectedAt:new Date(now).toISOString()};}
function recentTransition(before,after,now){const a=Date.parse(latest(before||{})?.detailCheckedAt||''),b=Date.parse(latest(after)?.detailCheckedAt||'');return id(before||{})===id(after)&&format(before||{})===format(after)&&Number.isFinite(a)&&Number.isFinite(b)&&a<b&&a>=now-ACHIEVEMENT_MS&&b<=now&&fresh(before,a)&&fresh(after,now)&&before.status==='live';}
function validateRecords(document){
 if(document?.schemaVersion!=='cricket-record-watchlist.v1'||!Array.isArray(document.records)||document.records.length>5)throw Error('Invalid record watchlist');
 const ids=new Set();for(const r of document.records){
  const start=Date.parse(r.baselineCheckedAt),end=Date.parse(r.expiresAt),match=Date.parse(r.fixtureStartAt);
  if(r.reviewed!==true||!Number.isFinite(Date.parse(r.reviewedAt))||Date.parse(r.reviewedAt)>Date.now()||!/^https:\/\//.test(r.evidence?.baselineUrl||'')||!/^https:\/\//.test(r.evidence?.targetUrl||'')||!r.recordId||ids.has(r.recordId)||!/^fixture:cricket:CA:\d+$/.test(r.fixtureId||'')||!r.playerId||!['test','odi','t20'].includes(r.format)||!['runs','wickets'].includes(r.metric)||!integer(r.baseline)||!integer(r.target)||r.target<=r.baseline||r.baselineExcludesFixture!==true||!Number.isFinite(start)||!Number.isFinite(match)||start>match||!Number.isFinite(end)||end<=match||!/^https:\/\//.test(r.sourceUrl||'')||!r.title||r.title.length>160)throw Error('Unverified record watchlist entry');
  ids.add(r.recordId);
 }return document.records;
}
function recordValue(e,r){let result=r.baseline;for(const i of e.innings||[]){const rows=r.metric==='runs'?i.batting:i.bowling;const p=(rows||[]).find(p=>String(p.playerId)===String(r.playerId));if(p){if(r.metric==='runs'&&p.didNotBat===true)continue;if(i.detailStale||!integer(p[r.metric]))return null;result+=p[r.metric];}}return result;}
function competitiveChase(e){
 const c=e.cricketChase;if(c?.confirmed!==true||c.inningNumber!==latest(e)?.inningNumber||!integer(c.runsRemaining)||!integer(c.wicketsRemaining)||c.wicketsRemaining<1||c.wicketsRemaining>10||c.runsRemaining<1)return null;
 const r=c.runsRemaining,w=c.wicketsRemaining,f=format(e),limited=['odi','t20'].includes(f);
 if(!f||f==='test'&&c.inningNumber!==4)return null;
 if(limited&&(!integer(c.ballsRemaining)||c.ballsRemaining<1||r*6/c.ballsRemaining>12))return null;
 if(!(r<=30&&(w<=4||limited&&c.ballsRemaining<=30)||r<=60&&w<=2))return null;
 return c;
}
function detect(e,{previous=null,now=Date.now(),records={schemaVersion:'cricket-record-watchlist.v1',records:[]}}={}){
 now=+now;if(!fresh(e,now))return [];
 const i=latest(e),active=playing(e,now),transition=previous&&recentTransition(previous,e,now),out=[];
 const add=m=>out.push(moment(e,m,now));
 for(const inning of e.innings||[]){const prior=(previous?.innings||[]).find(p=>p.inningNumber===inning.inningNumber),activeInning=active&&inning.inningNumber===i.inningNumber;
 for(const p of inning.batting||[]){if(!integer(p.runs)||!p.playerId)continue;for(const [target,start] of [[50,40],[100,80],[200,180],[300,280]]){
  const family=target===100?'centuries':'extraBatting',old=prior?.batting?.find(b=>String(b.playerId)===String(p.playerId));
  const approach=activeInning&&p.isBatting===true&&p.notOut===true&&p.runs>=start&&p.runs<target;
  const achieved=transition&&integer(old?.runs)&&old.runs<target&&p.runs>=target;
  if(approach||achieved)add({family,actor:p.playerId,target,inning:inning.inningNumber,priority:target===100?4:5,stage:approach?'approaching':'achieved',value:p.runs,text:approach?`${p.name} is on ${p.runs}, closing on ${target===100?'a century':target+' runs'}.`:`${p.name} has reached ${target===100?'a century':target+' runs'}.`});
 }}
 for(const p of inning.bowling||[]){const old=prior?.bowling?.find(b=>String(b.playerId)===String(p.playerId)),approach=activeInning&&p.wickets===4,achieved=transition&&integer(old?.wickets)&&integer(p.wickets)&&old.wickets<5&&p.wickets>=5;if(p.playerId&&(approach||achieved))add({family:'bowling',actor:p.playerId,target:5,inning:inning.inningNumber,priority:3,stage:approach?'approaching':'achieved',value:p.wickets,text:approach?`${p.name} has four wickets, one from five.`:`${p.name} has taken five wickets.`});}
 }
 const chase=active&&competitiveChase(e);if(chase)add({family:'finishes',actor:i.battingTeamId,target:'chase',inning:i.inningNumber,priority:2,stage:'approaching',value:chase.runsRemaining,text:`${i.team||'The chasing side'} need ${chase.runsRemaining} runs${chase.ballsRemaining!=null?' from '+chase.ballsRemaining+' balls':''}, with ${chase.wicketsRemaining} wickets remaining.`});
 for(const r of validateRecords(records)){if(r.fixtureId!==id(e)||r.format!==format(e)||Date.parse(r.expiresAt)<=now||r.fixtureStartAt!==e.startTimeUtc)continue;const value=recordValue(e,r),old=previous?recordValue(previous,r):null,current=(r.metric==='runs'?i.batting:i.bowling)?.find(p=>String(p.playerId)===String(r.playerId)),p=current||(e.innings||[]).flatMap(i=>r.metric==='runs'?i.batting||[]:i.bowling||[]).find(p=>String(p.playerId)===String(r.playerId));if(value===null||!p)continue;const approach=active&&Boolean(current)&&(r.metric!=='runs'||current.isBatting===true&&current.notOut===true)&&value<r.target&&r.target-value<=(r.metric==='runs'?20:1),achieved=transition&&old!==null&&old<r.target&&value>=r.target;if(approach||achieved)add({family:'records',actor:r.recordId,target:r.target,inning:0,priority:1,stage:approach?'approaching':'achieved',value,text:approach?`${p.name} needs ${r.target-value} ${r.metric} for ${r.title}.`:`${p.name} has reached ${r.title}.`});}
 return out.sort((a,b)=>a.priority-b.priority||a.momentId.localeCompare(b.momentId));
}
function revalidate(m,e,{now=Date.now(),records={schemaVersion:'cricket-record-watchlist.v1',records:[]}}={}){
 if(!fresh(e,+now)||id(e)!==m.eventId)return null;
 if(m.stage==='achieved'){
  if(Date.parse(m.detectedAt)<+now-ACHIEVEMENT_MS||Date.parse(m.observedAt)>+now)return null;
  const i=(e.innings||[]).find(i=>i.inningNumber===m.inning);
  const record=m.family==='records'?validateRecords(records).find(r=>r.recordId===m.actor&&r.fixtureId===id(e)&&r.format===format(e)&&Date.parse(r.expiresAt)>+now):null;
  const value=m.family==='records'?(record?recordValue(e,record):null):m.family==='bowling'?i?.bowling?.find(p=>String(p.playerId)===m.actor)?.wickets:i?.batting?.find(p=>String(p.playerId)===m.actor)?.runs;
  return integer(value)&&value>=m.target?m:null;
 }
 return detect(e,{now:+now,records}).find(candidate=>candidate.momentId===m.momentId&&candidate.stage==='approaching')||null;
}
function recipient(e,account,now=Date.now()){
 const prefs=require('../config/discovery-catalogue').migratePreferences(account.preferences||{}),settings=preferences.normalize(prefs.followFirst?.notifications?.milestones),actions=account.actions||account.eventUserState||{},action=actionIdentity.actionFor(e,actions);
 if(account.preferences?.followFirst?.notifications?.enabled===false||prefs.followFirst?.notifications?.enabled===false||!settings.enabled||settings.sports.cricket.coverage==='off'||preferences.quiet(settings,+now)||action.milestoneAlertsMuted===true||action.dismissed||action.isDismissed||action.archived||feedPolicy.explicitlyExcluded(e,prefs)||feedPolicy.eventExcluded(e,prefs)||!coverage.allowed(e))return null;
 const expanded=require('./follow-fixture-resolver').expandedFollowEntityIds({preferences:prefs},{event:e});
 const feed=require('./server-feed-pipeline').shouldEnrichEvent(e,prefs,action,expanded,new Date(now));
 const broad=settings.sports.cricket.audience==='sport'&&(prefs.selectedSelectorEntityIds||[]).includes('sport:cricket')&&!feedPolicy.explicitCompetitionRequired(e);
 if(!feed&&!broad)return null;
 const strict=prefs.feedControls?.spoilers==='strict',spoiler=account.eventSpoilerState||{};
 const choice=actionIdentity.actionFor(e,spoiler).override;
 return {settings,limits:preferences.LIMITS[settings.sports.cricket.coverage],showFacts:!strict&&choice!=='hide'&&(choice==='show'||prefs.showSpoilers===true)};
}
function explicitSuppression(e,account,now){const p=require('../config/discovery-catalogue').migratePreferences(account.preferences||{}),s=preferences.normalize(p.followFirst?.notifications?.milestones),a=actionIdentity.actionFor(e,account.actions||account.eventUserState||{});return account.preferences?.followFirst?.notifications?.enabled===false||p.followFirst?.notifications?.enabled===false||!s.enabled||s.sports.cricket.coverage==='off'||preferences.quiet(s,now)||a.milestoneAlertsMuted===true||a.dismissed||a.isDismissed||a.archived||feedPolicy.explicitlyExcluded(e,p)||feedPolicy.eventExcluded(e,p);}
function payload(e,moments,{showFacts,now=Date.now()}={}){
 const main=moments[0],sides=[e.homeParticipantId,e.awayParticipantId].map(id=>(e.participants||[]).find(p=>id&&(p.id===id||p.participantId===id))).map(p=>p?.displayName||p?.name).filter(Boolean),safeName=(sides.length===2?sides.join(' v '):'this match').slice(0,150);
 return {kind:'milestone',eventId:id(e),momentId:main.momentId,expiresAt:new Date(+now+120000).toISOString(),title:showFacts?'A moment worth watching':'Something’s building',body:showFacts?moments.slice(0,2).map(m=>m.text).join(' ')+' Open Match Centre.':`Something’s building in ${safeName}. Open Match Centre.`,tag:'milestone-'+main.momentId.slice(0,28),url:`/?event=${encodeURIComponent(id(e))}&surface=match-centre&moment=${main.momentId}`};
}
module.exports={FRESH_MS,ACHIEVEMENT_MS,id,format,fresh,playing,detect,revalidate,validateRecords,competitiveChase,recipient,explicitSuppression,payload};

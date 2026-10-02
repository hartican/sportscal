'use strict';
// Reviewed evidence for generated/API presentation only. No provider calls,
// browser credentials or clock-based sporting updates. Apply after reconciliation,
// so viewing richness cannot select a different result or identity.
const audit=require('../data/coverage/australian-viewing-rights.v1.json');
const follow=require('../config/follow-first');
const key=value=>String(value||'').replace(/:/g,'-');
const reviewedIds=new Set((audit.reviewedWindows||[]).flatMap(rule=>rule.fixtureIds||[]).map(key));
const australianDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'});
function reviewedAuViewing(event){
 const rugby=event.sportDomainId==='sport:rugby-union'||['rugby','rugby-union'].includes(event.key);
 const ids=[event.id,event.eventId,event.canonicalEventId,...(event.sourceEventIds||[])].map(key);
 if(!rugby&&!ids.some(id=>reviewedIds.has(id))&&!(event.viewingOptions||[]).some(option=>option.reviewId==='au-viewing-20261002'))return event;
 const at=Date.parse(event.startTimeUtc||event.startsAt||event.date||'');
 const date=Number.isFinite(at)?(event.startTimeUtc||event.startsAt?australianDate.format(new Date(at)):event.date):null;
 const validDate=date && /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
 const rule=(audit.reviewedWindows||[]).find(rule=>validDate&&date>=rule.notBefore&&date<rule.notAfter
   && (rule.fixtureIds?.some(id=>ids.includes(key(id)))||rule.competitionIds?.includes(event.competitionId))
   && (!rule.fixtureIds||!rule.competitionIds||rule.fixtureIds.some(id=>ids.includes(key(id)))&&rule.competitionIds.includes(event.competitionId))
   && (!rule.participantIds||JSON.stringify([...(event.participantIds||[])].sort())===JSON.stringify([...rule.participantIds].sort()))
   && (!rule.format||String(event.format||event.matchFormat||'').toLowerCase()===rule.format));
 if(!rule&&!rugby&&!(event.viewingOptions||[]).some(option=>option.reviewId==='au-viewing-20261002'))return event;
 // Older generated options from our review must expire with the evidence window.
 // Preserve independently sourced fixture options; unstructured provider guesses
 // cannot restore the retired blanket Rugby rule.
 const retained=(event.viewingOptions||[]).filter(option=>option&&typeof option==='object'&&option.reviewId!=='au-viewing-20261002'
   && option.rightsScope==='fixture'&&option.sourceUrl&&Number.isFinite(Date.parse(option.verifiedAt)));
 const viewingOptions=rule?rule.providers.map(provider=>({providerId:provider.id,rightsScope:'fixture',linkScope:provider.linkScope||'event',
   webUrl:provider.url,sourceUrl:provider.sourceUrl||rule.sourceUrl,verifiedAt:provider.verifiedAt||rule.verifiedAt,territory:'AU',liveOrReplay:'live',reviewId:'au-viewing-20261002'})):retained;
 return {...event,viewingOptions,broadcaster:viewingOptions.length?viewingOptions.map(option=>follow.VIEWING_PROVIDERS[option.providerId]?.label).filter(Boolean).join(' / '):'Australian viewing unconfirmed',
   broadcastOptions:[],broadcasterIds:[]};
}
module.exports={reviewedAuViewing};

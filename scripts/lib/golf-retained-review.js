'use strict';
const fs=require('node:fs');
function apply(){
 const file='data/canonical/pga-tour-schedule.json',document=JSON.parse(fs.readFileSync(file)),review=require('../../data/canonical/reviewed-baycurrent-2026.v1.json'),scope=require('../../lib/golf-tracked-scope');
 const next=review.observation,old=document.pgaParticipation.find(e=>e.tournamentId===review.tournamentId);
 if(review.tournamentId!=='R2026527'||review.season!==2026||next.date!=='2026-10-08'||next.endDate!=='2026-10-11'||review.sourceUrl!=='https://www.pgatour.com/tournaments/2026/baycurrent-classic/R2026527/tee-times'||!Number.isFinite(Date.parse(review.sourceCheckedAt))||Date.parse(review.sourceCheckedAt)>Date.now())throw Error('Invalid reviewed Baycurrent source tuple');
 if(!old||Date.parse(old.sourceCheckedAt||0)<=Date.parse(review.sourceCheckedAt))document.pgaParticipation=[...document.pgaParticipation.filter(e=>e.tournamentId!==review.tournamentId),{...next,...(old?.roundScores?{roundScores:old.roundScores}:{})}];
 const projected=scope.projectDocument(document,{ids:scope.trackedIds(scope.privateFollowIds())});const bytes=JSON.stringify(projected,null,2)+'\n';if(fs.readFileSync(file,'utf8')!==bytes)fs.writeFileSync(file,bytes);
 // Upgrade only known parent cards. The Code catalogue owns tee-group children.
 const fixtures=require('../../lib/golf-fixtures').fixtures(projected);let feedChanged=false;
 for(const name of ['feeds/incoming/events.json','data/events.json']){const feed=JSON.parse(fs.readFileSync(name));let changed=false;feed.events=feed.events.map(e=>{if(!['golf','masters'].includes(e.key))return e;const match=fixtures.find(f=>f.id===e.id&&f.cardType!=='golf_appearance');if(!match?.participationScope)return e;const copy={...e};for(const key of ['participants','participantIds','entries','excludedParticipantIds','appearances','participationScope','participationScopeCheckedOn','participantsConfirmed','entryListPublished','sourceUrl','sourceCheckedAt','roundScores','statusSource','statusCheckedAt'])if(Object.hasOwn(match,key))copy[key]=match[key];if(JSON.stringify(copy)!==JSON.stringify(e))changed=true;return copy;});if(changed)feedChanged=true;if(changed)fs.writeFileSync(name,JSON.stringify(feed,null,2)+'\n');}
 return {document:projected,feedChanged};
}
module.exports={apply};

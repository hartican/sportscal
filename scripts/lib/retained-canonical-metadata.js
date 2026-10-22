'use strict';
const {isDeepStrictEqual:equal}=require('node:util');
const identityFields=['id','sourceId','sportDomainId','discoverySportId','competitionId','seasonLabel','roundNumber','roundLabel','displayName','homeParticipantId','awayParticipantId','participantIds','startTimeUtc','endTimeUtc','venueName','venueCity','status'];
function resultFacts(value){
 if(Array.isArray(value))return value.map(resultFacts);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='checkedAt').map(([key,v])=>[key,resultFacts(v)]));
 return value;
}
function sameFixture(a,b){return identityFields.every(key=>equal(a[key],b[key]))&&equal(resultFacts(a.result),resultFacts(b.result))&&['provider','sourceUrl','sourceType'].every(key=>a.source?.[key]===b.source?.[key]);}
function dated(value,checkedAt){const at=Date.parse(value),limit=Date.parse(checkedAt);return Number.isFinite(at)&&Number.isFinite(limit)&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value||'')&&new Date(at).toISOString().slice(0,19)===value.slice(0,19)&&at<=limit&&at<=Date.now();}
function retainReviewedCanonicalMetadata(previous,incoming,{checkedAt,fixtureOverrides=[]}={}){
 const byId=new Map();
 for(const event of previous){if(byId.has(event.id))throw Error('Ambiguous retained canonical metadata identity');byId.set(event.id,event);}
 return incoming.map(event=>{
  const prior=byId.get(event.id);if(!prior||!sameFixture(prior,event))return event;
  let next=event;
  const old=prior.editorialPreview,fresh=event.editorialPreview;
  // Fixture and ladder facts are polled by this owner. Changed copy keeps its
  // genuine primary observation, even when the static story angle is the same.
  // Only an identical generated hook AND full preview may retain the old clock.
  if(old?.status==='journalistic'&&fresh?.status==='journalistic'
    &&prior.selectedSentence===event.selectedSentence&&prior.fullSpiel===event.fullSpiel
    &&old.angle===fresh.angle&&old.sourceName===fresh.sourceName&&old.sourceUrl===fresh.sourceUrl
    &&old.sourceUrl===prior.source?.sourceUrl&&dated(old.sourceCheckedAt,checkedAt)
    &&equal(old.evidenceReferences,fresh.evidenceReferences)
    &&old.evidenceReferences?.every(row=>/^https:\/\//.test(row.url||''))){
   next={...next,editorialPreview:old};
   for(const field of ['selectedSentence','fullSpiel'])if(typeof prior[field]==='string'&&prior[field].trim())next[field]=prior[field];
  }
  // A generic competition carriage list cannot replace a fixture-specific
  // review already represented in the existing current-card evidence owner.
  const reviews=fixtureOverrides.filter(row=>(row.canonicalId||row.id)===event.id);
  if(reviews.length===1){const review=reviews[0];
   if(review.competitionId===event.competitionId&&review.startTimeUtc===event.startTimeUtc
     &&equal(review.participantIds,event.participantIds)&&Array.isArray(review.broadcasters)&&review.broadcasters.length
     &&equal(prior.broadcasters,review.broadcasters)&&review.viewingOptions?.length
     &&review.viewingOptions.every(option=>option.rightsScope==='fixture'&&option.territory==='AU'&&/^https:\/\//.test(option.sourceUrl||'')&&dated(option.verifiedAt,checkedAt))){next={...next,broadcasters:prior.broadcasters};}
  }
  return next;
 });
}
module.exports={retainReviewedCanonicalMetadata,sameFixture};

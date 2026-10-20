'use strict';
const policy=require('../../config/editorial-maintenance');
const narrative=require('./editorial-narrative');
const fields=['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline'];
const factFields=['id','name','date','time','timePrecision','startTimeUtc','endTimeUtc','actualEndTimeUtc','venue','competitionId','season','participantIds','participants','participantsConfirmed','teamMatchContext','standingsContext','eventType','sessionType','cardKind','round','roundNumber','roundLabel','stage','status','scheduleStatus','score','scoreDisplay','canonicalResultScoreline','result','resultLabels','homeScore','awayScore','outcomeText','recapText','fixtureResults'];
function sameEditorialFacts(a,b){
  // Representation-only empty participants and the two unresolved status names
  // do not invalidate writing. Real identities, results and context still do.
  const fact=(event,key)=>key==='status'&&['scheduled','upcoming'].includes(event[key])?'scheduled':['participants','participantIds'].includes(key)&&event[key]===undefined?[]:event[key];
  return factFields.every(key=>JSON.stringify(fact(a,key))===JSON.stringify(fact(b,key)));
}
function newerReviewedNarrative(a,b,now=Date.now()){
  const reviewed=Date.parse(a.editorialNarrative?.researchedAt),other=Date.parse(b.editorialNarrative?.researchedAt);
  return Number.isFinite(reviewed)&&reviewed<=now&&reviewed>(Number.isFinite(other)&&other<=now?other:0)&&Boolean(a.editorialNarrative?.sourceIds?.length);
}
const matches=(a,b)=>policy.ids(a).some(id=>policy.ids(b).includes(id));
const complete=copy=>policy.fields.every(field=>String(copy?.[field]||'').trim());
function reconcileFullPreviews(events,knowledge){
  const indexes=narrative.indexesFor(knowledge);
  return events.map(event=>{
    if(policy.protectedFixture(event)||['completed','finished','final','cancelled','canceled','abandoned'].includes(event.status))return event;
    const projection=narrative.projectionForTarget(knowledge,'feed-event',event);
    if(!projection||!complete(projection))return event;
    // A fixture/score fetch clock is not a newer editorial observation.
    if(Date.parse(event.editorialNarrative?.researchedAt)>Date.parse(projection.researchedAt))return event;
    const projected=narrative.applyToFeedEvent(event,projection,indexes);
    return {...event,...Object.fromEntries(fields.map(field=>[field,projected[field]]))};
  });
}
function publicationMismatch(event,published){
  const cards=published.filter(card=>matches(event,card));
  return cards.length>0&&cards.some(card=>!policy.equalCopy(policy.copy(event),policy.copy(card)));
}
function publicationPlan(rows,local,served){
  const published=[],deferred=[];
  for(const row of rows){
    if(!row.staged_copy||row.held||policy.protectedFixture({id:row.event_id}))continue;
    const event=local.find(event=>policy.ids(event).includes(row.event_id));
    const cards=event?served.filter(card=>matches(event,card)):[];
    if(!event||!complete(row.staged_copy)||!policy.equalCopy(row.staged_copy,policy.copy(event))||!cards.length||cards.some(card=>!policy.equalCopy(row.staged_copy,policy.copy(card))||card.selectedSentence!==card.editorialNarrative?.hook||card.fullSpiel!==card.editorialNarrative?.synopsis)){
      deferred.push({row,reason:'Served card does not contain the complete staged Hook, Form, Storyline and Match Context. Retain staged copy for independent repair.'});
    }else published.push(row);
  }
  return {published,deferred};
}
module.exports={fields,sameEditorialFacts,newerReviewedNarrative,complete,reconcileFullPreviews,publicationMismatch,publicationPlan};

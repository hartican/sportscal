'use strict';
const policy=require('../../config/editorial-maintenance');
const narrative=require('./editorial-narrative');
const fields=['selectedSentence','fullSpiel','editorialNarrative','editorialPreview','lastReviewedAt','storyline'];
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
module.exports={fields,complete,reconcileFullPreviews,publicationMismatch,publicationPlan};

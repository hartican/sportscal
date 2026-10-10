'use strict';
const {lifecycleFor,stakesFor}=require('./storyline-card-rules');
const policy=require('../../config/editorial-maintenance');
const locks=require('../../config/editorial-locks');
function displayCopy(event,spoilersOn,now=new Date()){
  const storyline=event.storyline||{};
  if(lifecycleFor(event,now)!=='completed')return {
    hook:storyline.hookSpoilerOff||storyline.hookSpoilerOn||event.selectedSentence||'',
    synopsis:storyline.synopsisSpoilerOff||storyline.synopsisSpoilerOn||event.fullSpiel||'',
  };
  if(spoilersOn)return {
    hook:storyline.hookSpoilerOn||event.outcomeText||event.selectedSentence||'',
    synopsis:storyline.synopsisSpoilerOn||event.recapText||event.fullSpiel||'',
  };
  const title=event.displayTitleCompact||event.name||'This event';
  return {
    hook:storyline.hookSpoilerOff||`${title} is complete, with the result protected until you choose to reveal it.`,
    synopsis:storyline.synopsisSpoilerOff||`${title} is complete. The key moments and result are ready when you are, without giving anything away here.`,
  };
}
function needsDisplayCopy(event,now=new Date()){
  return stakesFor(event)>=4&&[false,true].some(on=>{const copy=displayCopy(event,on,now);return !copy.hook||!copy.synopsis;});
}
function completeStagedCopy(state){
  return state.staged_copy&&policy.fields.every(field=>typeof state.staged_copy[field]==='string'&&state.staged_copy[field].trim());
}
function baselineCopy(card){
  return card.state.pending_copy||(completeStagedCopy(card.state)?card.state.staged_copy:policy.copy(card.event));
}
function selectCards(inventory,published,publicationMismatch,now=new Date()){
  const byAlias=new Map(published.flatMap(event=>policy.ids(event).map(id=>[id,event])));
  return inventory.cards.flatMap(card=>{
    if(card.schedule.held||card.schedule.protected||locks.activeFor(card.event))return [];
    const served=policy.ids(card.event).map(id=>byAlias.get(id)).find(Boolean);
    // Repair required existing public copy, not ratings, admission or new coverage.
    const repair=card.schedule.inWindow&&served&&needsDisplayCopy(served,now);
    // A successful check is not publication. Recover complete unpublished copy
    // independently of cadence, without broadening eligibility or kickoff scope.
    const unpublished=card.selected&&card.schedule.inWindow&&served&&completeStagedCopy(card.state)&&!policy.equalCopy(card.state.staged_copy,policy.copy(served));
    const due=card.selected&&card.schedule.inWindow&&(card.schedule.due||publicationMismatch(card.event,published));
    return repair||due||unpublished?[{...card,repairReason:repair?'missing-required-display-copy':unpublished?'unpublished-staged-copy':null}]:[];
  });
}
module.exports={displayCopy,needsDisplayCopy,selectCards,baselineCopy};

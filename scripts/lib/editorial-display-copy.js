'use strict';
const {lifecycleFor,stakesFor,wordCount}=require('./storyline-card-rules');
const policy=require('../../config/editorial-maintenance');
const locks=require('../../config/editorial-locks');
const cricket=require('../../config/cricket-editorial-policy');
function displayCopy(event,spoilersOn,now=new Date()){
  if(cricket.isCricket(event))return require('../../config/editorial-lifecycle').copy(event,event.editorialNarrative||{},spoilersOn,now);
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
  if(cricket.isCricket(event))return stakesFor(event)>=4&&!cricket.complete(event.editorialNarrative);
  return stakesFor(event)>=4&&[false,true].some(on=>{const copy=displayCopy(event,on,now);return !copy.hook||!copy.synopsis||wordCount(copy.hook)>25||wordCount(copy.synopsis)>80;});
}
function completeStagedCopy(state){
  return state.staged_copy&&policy.completeCopy(state.staged_copy);
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
    const repair=card.schedule.inWindow&&served&&needsDisplayCopy(served,now)&&(!cricket.isCricket(card.event)||!card.schedule.phase);
    // A successful check is not publication. Recover complete unpublished copy
    // independently of cadence, without broadening eligibility or kickoff scope.
    const unpublished=card.selected&&card.schedule.inWindow&&served&&completeStagedCopy(card.state)&&!policy.equalCopy(card.state.staged_copy,policy.copy(served));
    const due=card.selected&&card.schedule.inWindow&&(card.schedule.due||publicationMismatch(card.event,published));
    return repair||due||unpublished?[{...card,repairReason:repair?'missing-required-display-copy':unpublished?'unpublished-staged-copy':null}]:[];
  });
}
module.exports={displayCopy,needsDisplayCopy,completeStagedCopy,selectCards,baselineCopy};

'use strict';
const fs=require('node:fs');
function branchesFor(event){
 const sides=String(event.name||'').split(/\s+v\s+/);if(sides.length!==2||!event.sourceUrl)return null;
 const round=event.roundLabel||event.round||'',context=round?` in ${round}`:'';
 const sourceIds=[event.sourceUrl],safe=`${event.name}${context}: the result is available to reveal.`;
 return {
  home:{sourceIds,spoilerSafe:safe,revealed:`${sides[0]} defeated ${sides[1]}${context}.`},
  away:{sourceIds,spoilerSafe:safe,revealed:`${sides[1]} defeated ${sides[0]}${context}.`},
  draw:{sourceIds,spoilerSafe:safe,revealed:`${sides[0]} and ${sides[1]} finished level${context}.`},
 };
}
function preparedResultMatchesFixture(event){
 if(!event.resultEditorialBranches)return true;
 const current=branchesFor(event);
 return Boolean(current&&['home','away','draw'].every(key=>{
  const prior=event.resultEditorialBranches[key],next=current[key];
  return prior&&prior.spoilerSafe===next.spoilerSafe&&prior.revealed===next.revealed;
 }));
}
function usesStalePreparedResult(event){
 if(preparedResultMatchesFixture(event))return false;
 const narrative=event.editorialNarrative;
 if(narrative?.phase==='recap'&&!narrative.resultResearchRequired&&narrative.resultSignature===require('../config/editorial-lifecycle').signature(event))return false;
 return Object.values(event.resultEditorialBranches||{}).some(branch=>branch&&
  [event.storyline?.hookSpoilerOff,event.storyline?.hookSpoilerOn,event.editorialNarrative?.hookSpoilerOn].some(copy=>copy===branch.spoilerSafe||copy===branch.revealed));
}
function select(event){
 if(Number(event.stakesScore || 0)<4||!['completed','finished','final'].includes(event.status))return event;
 const home=Number(event.homeScore),away=Number(event.awayScore);
 if(event.homeScore==null||event.awayScore==null||!Number.isFinite(home)||!Number.isFinite(away))return event;
 if(!preparedResultMatchesFixture(event)){
  if(!usesStalePreparedResult(event))return event;
  const rules=require('./lib/storyline-card-rules'),storyline=rules.storylineFor(event),safe=rules.spoilerSafeRootCopy(event,storyline);
  return {...event,selectedSentence:safe.hook,fullSpiel:safe.synopsis,storyline,
   ...(event.editorialNarrative?{editorialNarrative:{...event.editorialNarrative,phase:'preview',resultResearchRequired:true,hookSpoilerOn:storyline.hookSpoilerOn,synopsisSpoilerOn:storyline.synopsisSpoilerOn}}:{})};
 }
 const branch=event.resultEditorialBranches?.[home===away?'draw':home>away?'home':'away'];
 if(!branch?.sourceIds?.length||!branch.spoilerSafe||!branch.revealed)return event;
 return {...event,...(event.editorialNarrative?{editorialNarrative:{...event.editorialNarrative,hookSpoilerOn:branch.revealed,synopsisSpoilerOn:[branch.revealed,event.recapText].filter(Boolean).join(' ')}}:{}),storyline:{...event.storyline,hookSpoilerOff:branch.spoilerSafe,hookSpoilerOn:branch.revealed,arcStage:'recap'}};
}
if(require.main===module){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path));doc.events=doc.events.map(select);fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');}
module.exports={select,branchesFor,preparedResultMatchesFixture,usesStalePreparedResult};

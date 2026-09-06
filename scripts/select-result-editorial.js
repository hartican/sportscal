'use strict';
const fs=require('node:fs');
function select(event){
 if(Number(event.stakesScore || 0)<4||!['completed','finished','final'].includes(event.status))return event;
 const home=Number(event.homeScore),away=Number(event.awayScore);
 if(event.homeScore==null||event.awayScore==null||!Number.isFinite(home)||!Number.isFinite(away))return event;
 const branch=event.resultEditorialBranches?.[home===away?'draw':home>away?'home':'away'];
 if(!branch?.sourceIds?.length||!branch.spoilerSafe||!branch.revealed)return event;
 return {...event,...(event.editorialNarrative?{editorialNarrative:{...event.editorialNarrative,hookSpoilerOn:branch.revealed,synopsisSpoilerOn:[branch.revealed,event.recapText].filter(Boolean).join(' ')}}:{}),storyline:{...event.storyline,hookSpoilerOff:branch.spoilerSafe,hookSpoilerOn:branch.revealed,arcStage:'recap'}};
}
if(require.main===module){const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path));doc.events=doc.events.map(select);fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');}
module.exports={select};

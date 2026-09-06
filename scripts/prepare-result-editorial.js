'use strict';
// Prepared at full refresh; these conditional facts only become copy after a verified result.
const fs=require('node:fs');
const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path));
for(const event of doc.events){
 if(Number(event.stakesScore||0)<4||event.status==='completed'||!event.sourceUrl)continue;
 const sides=String(event.name||'').split(/\s+v\s+/);if(sides.length!==2)continue;
 const round=event.roundLabel || event.round || '';const context=round?` in ${round}`:'';
 const sourceIds=[event.sourceUrl];
 const safe=`${event.name}${context}: the result is available to reveal.`;
 event.resultEditorialBranches={
 home:{sourceIds,spoilerSafe:safe,revealed:`${sides[0]} defeated ${sides[1]}${context}.`},
 away:{sourceIds,spoilerSafe:safe,revealed:`${sides[1]} defeated ${sides[0]}${context}.`},
 draw:{sourceIds,spoilerSafe:safe,revealed:`${sides[0]} and ${sides[1]} finished level${context}.`},
 };
}
fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');

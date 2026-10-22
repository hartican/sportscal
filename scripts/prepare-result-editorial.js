'use strict';
// Prepared at full refresh; these conditional facts only become copy after a verified result.
const fs=require('node:fs');
const path='feeds/incoming/events.json',doc=JSON.parse(fs.readFileSync(path));
for(const event of doc.events){
 if(Number(event.stakesScore||0)<4||event.status==='completed'||!event.sourceUrl)continue;
 const branches=require('./select-result-editorial').branchesFor(event);
 if(branches)event.resultEditorialBranches=branches;
}
fs.writeFileSync(path,JSON.stringify(doc,null,2)+'\n');

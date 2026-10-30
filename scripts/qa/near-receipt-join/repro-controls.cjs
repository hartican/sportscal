'use strict';
// Retained plan/string controls only, never a new query or performance run.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{planWork,assertOriginalRepro}=require('./adapter.cjs');
const retained=JSON.parse(fs.readFileSync(path.join(__dirname,'retained-original-plan.json'),'utf8')),work=planWork(retained);assertOriginalRepro(work);
let refused=0;for(const patch of [{loops:900},{loops:984},{loops:986},{rows:4830},{rows:985,loops:4831},{node:'Other Scan'}]){const changed=structuredClone(work);Object.assign(changed.receiptScans[0],patch);changed.receiptScans[0].visits=changed.receiptScans[0].rows*changed.receiptScans[0].loops;changed.receiptVisits=changed.receiptScans[0].visits;assert.throws(()=>assertOriginalRepro(changed),e=>e.code==='NO_REPRO');refused++;}
const duplicate=structuredClone(work);duplicate.receiptScans.push({...duplicate.receiptScans[0]});assert.throws(()=>assertOriginalRepro(duplicate),e=>e.code==='NO_REPRO');refused++;
console.log(JSON.stringify({state:'RETAINED_PLAN_CONTROLS_ONLY',retainedActualPlanPositive:true,expectedReceiptRows:4831,expectedLoops:985,expectedVisits:4758535,refusedNonfaithfulShapes:refused,newQueriesOrNativeOrCI:0}));

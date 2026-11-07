#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const [stage,state,exitCode]=process.argv.slice(2);
const sourceReports=[];
for(const name of ['QUICK_RESULTS_REPORT','KNOWN_FINAL_RESULTS_REPORT','FOOTBALL_DATA_REPORT','GOLF_SOURCE_REPORT','WRC_SOURCE_FAILURE_REPORT']){
 const file=process.env[name];if(!file||!fs.existsSync(file)||fs.statSync(file).size>5*1024*1024)continue;
 try{const value=JSON.parse(fs.readFileSync(file,'utf8'));const failures=value.failures||value.checks?.filter(row=>['failed','rejected'].includes(row.state))||[];sourceReports.push({name,failures});}catch{}
}
const report=require('./lib/refresh-report').update({stage,publicationState:state,sourceReports,...(exitCode?{exitCode:Number(exitCode)}:{})});
if(report&&process.env.GITHUB_STEP_SUMMARY&&['complete','failed'].includes(stage))fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,`### Canonical refresh: ${state}\n\n- Last step: ${report.failedStep||report.lastStep||'not started'}\n- Missing results: ${report.missingResults.length}\n- Source failures retained: ${report.sourceFailures.length}\n- Diagnostics: refresh-diagnostics artifact\n${report.blockingError?'\nFailure: '+report.blockingError.replace(/[<>`]/g,'').replace(/\n/g,' ')+'\n':''}`);

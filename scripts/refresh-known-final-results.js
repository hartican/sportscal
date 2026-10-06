#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
async function main(){const report=await require('./lib/known-final-results').refresh({nrlOnly:process.argv.includes('--nrl-only')});if(process.env.KNOWN_FINAL_RESULTS_REPORT){fs.mkdirSync(path.dirname(process.env.KNOWN_FINAL_RESULTS_REPORT),{recursive:true});fs.writeFileSync(process.env.KNOWN_FINAL_RESULTS_REPORT,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report));if(report.failures.length)throw new Error('Known final source checks failed; retained last-good facts.');}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={main};

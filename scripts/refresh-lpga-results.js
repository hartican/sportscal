#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
async function main(){const path='data/canonical/pga-tour-schedule.json',result=await require('../lib/lpga-results').refresh(JSON.parse(fs.readFileSync(path)));if(result.changed)fs.writeFileSync(path,JSON.stringify(result.document,null,2)+'\n');console.log(JSON.stringify({checked:result.checked,changed:result.changed,failures:result.failures}));if(result.failures.length)process.exitCode=1;}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});

'use strict';
const {spawnSync}=require('node:child_process');
const checks=['build-public-comments-ui.js --check','validate-public-comments.js','validate-public-comments-api.js','validate-public-comment-alerts.js','validate-public-comments-ui.js','validate-public-comment-navigation.js','validate-public-comment-consent.js','validate-public-comments-state.js','validate-public-comment-retirement.js'];
if(!process.argv.includes('--light'))checks.push('validate-public-comments-database.js');
for(const check of checks){const [file,...args]=check.split(' '),result=spawnSync(process.execPath,['scripts/'+file,...args],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(!process.argv.includes('--light')){const result=spawnSync(process.execPath,['scripts/validate-public-comments-database.js'],{stdio:'inherit',env:{...process.env,PGLITE_MODULE:'pglite-pg17'}});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
console.log(process.argv.includes('--light')?'Public Feed light source checks passed; database engines excluded.':'Public Feed source and PostgreSQL 17/18 checks passed.');

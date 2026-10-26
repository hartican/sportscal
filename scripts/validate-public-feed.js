'use strict';
const {spawnSync}=require('node:child_process');
const checks=['build-public-comments-ui.js --check','validate-public-comments.js','validate-public-comments-api.js','validate-public-comment-alerts.js','validate-public-comments-ui.js','validate-public-comment-navigation.js','validate-public-comment-consent.js','validate-public-comments-state.js','validate-public-comment-retirement.js','validate-public-comment-picker.js','validate-public-comment-erasure-access.js','validate-public-feed-browser-fixtures.js'];
const databaseChecks=['validate-public-comments-database.js','validate-public-comment-managed-coexistence.js'];
if(!process.argv.includes('--light'))checks.push(...databaseChecks);
for(const check of checks){const [file,...args]=check.split(' '),result=spawnSync(process.execPath,['scripts/'+file,...args],{stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
if(!process.argv.includes('--light'))for(const file of databaseChecks){const result=spawnSync(process.execPath,['scripts/'+file],{stdio:'inherit',env:{...process.env,PGLITE_MODULE:'pglite-pg17'}});if(result.error)throw result.error;if(result.status!==0)process.exit(result.status||1);}
console.log(process.argv.includes('--light')?'Public Feed light source checks passed; database engines excluded.':'Public Feed source and PostgreSQL 17/18 checks passed.');

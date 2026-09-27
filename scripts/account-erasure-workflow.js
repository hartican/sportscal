#!/usr/bin/env node
'use strict';
// Operator-only. No public route. Inspect is read-only; advance requires a
// private verified-request record and currently stops before destructive cleanup.
const fs=require('node:fs'),path=require('node:path');
const {operator}=require('../lib/account-erasure-operator');
const {openJournal}=require('../lib/account-erasure-journal');
const {newJournal,advance}=require('../lib/account-erasure-workflow');
async function main(){
 const args=process.argv.slice(2),mode=args.shift();
 if(!['inspect','advance'].includes(mode)||args.length%2)throw Error('Usage: account-erasure-workflow.js inspect --user UUID | advance --user UUID --request PRIVATE_JSON --directory PRIVATE_DIRECTORY');
 const values={};for(let i=0;i<args.length;i+=2){if(!['--user','--request','--directory'].includes(args[i])||values[args[i]])throw Error('Invalid or duplicate argument');values[args[i]]=args[i+1];}
 const accountId=values['--user'];if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(accountId||''))throw Error('Exact account UUID required.');
 const adapter=operator();
 if(mode==='inspect'){const i=await adapter.inventory(accountId);console.log(JSON.stringify(i,null,2));return;}
 if(!values['--request']||!values['--directory'])throw Error('Advance requires a verified request and private journal directory.');
 const stat=fs.lstatSync(values['--request']);if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o077))throw Error('Verified request must be a private regular file (0600).');
 const verified=JSON.parse(fs.readFileSync(values['--request'],'utf8'));
 const initial=newJournal(accountId,verified),store=openJournal(path.resolve(values['--directory']),accountId);
 try{
  const journal=store.load()||initial;
  if(journal.request.requestId!==verified.requestId)throw Error('Request does not match existing operation.');
  await advance({journal,...adapter,persist:store.persist});
  console.log(JSON.stringify({phase:journal.phase,complete:journal.complete,pending:journal.pending,confirmedSteps:journal.steps.map(s=>s.phase)},null,2));
 }finally{store.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

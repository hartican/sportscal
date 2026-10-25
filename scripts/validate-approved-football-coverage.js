'use strict';
const assert=require('node:assert/strict');
const coverage=require('./lib/approved-football-coverage');
function run(){
 const directory=require('../data/canonical/football-directory.v1.json');
 const approved=coverage.validate(directory);
 assert(approved.some(league=>league.id==='competition:australian-championship'),'Retained Championship belongs to approved complete coverage');
 coverage.validate({...directory,leagues:[...directory.leagues].reverse(),teams:[...directory.teams].reverse()});
 let rejected=0;
 const reject=change=>{const next=structuredClone(directory);change(next);assert.throws(()=>coverage.validate(next));rejected++;};
 for(const expected of approved)reject(next=>{next.leagues=next.leagues.filter(league=>league.id!==expected.id);});
 reject(next=>next.leagues.push({...next.leagues[0],id:'competition:unapproved',key:'unapproved'}));
 reject(next=>next.leagues.push({...next.leagues[0]}));
 reject(next=>{next.leagues[0].id='competition:unapproved';});
 reject(next=>{next.leagues[0].key=next.leagues[1].key;});
 reject(next=>{next.leagues[0].key='wrong-key';});
 reject(next=>{next.leagues[0].teamCount--;});
 reject(next=>{next.leagues.find(league=>league.id==='competition:australian-championship').refreshPolicy='network';});
 reject(next=>next.teams.pop());
 reject(next=>next.teams.push({...next.teams[0]}));
 reject(next=>{next.teams[0].leagueId='competition:unapproved';});
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ns-approved-football-owner-'));
 try{
  const guard=path.join(temp,'deny.cjs');
  fs.writeFileSync(guard,"global.fetch=async()=>{throw Error('Unexpected provider request in retained owner check');};for(const name of ['node:http','node:https'])for(const method of ['request','get'])require(name)[method]=()=>{throw Error('Unexpected native request in retained owner check');};\n");
  const owner=spawnSync(process.execPath,['--require',guard,path.join(__dirname,'refresh-football-directory.js'),'--check'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,LANG:process.env.LANG}});
  assert.equal(owner.status,0,owner.stderr||owner.stdout);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 console.log(`Approved football coverage: all ${approved.length} source-owned contexts, ordering independence and ${rejected} missing/extra/duplicate/misbound controls passed.`);
}
if(require.main===module)run();
module.exports={run};

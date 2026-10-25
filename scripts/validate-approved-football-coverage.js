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
 console.log(`Approved football coverage: all ${approved.length} source-owned contexts, ordering independence and ${rejected} missing/extra/duplicate/misbound controls passed.`);
}
if(require.main===module)run();
module.exports={run};

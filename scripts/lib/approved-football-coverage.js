'use strict';
const assert=require('node:assert/strict');
const {LEAGUES}=require('../refresh-football-directory');
const championship=require('./australian-championship');

function approvedLeagues(){
 const retained=championship.project(championship.loadCapture()).league;
 return [...LEAGUES.map(({id,key,teams})=>({id,key,teamCount:teams})),
  {id:championship.COMPETITION,key:championship.KEY,teamCount:retained.teamCount,refreshPolicy:'retained-capture-only'}];
}

function validate(directory){
 const approved=approvedLeagues();
 assert(Array.isArray(directory.leagues),'Football league contexts must be an array');
 const ids=directory.leagues.map(league=>league.id),keys=directory.leagues.map(league=>league.key);
 assert.equal(new Set(ids).size,ids.length,'Football league contexts must have unique identities');
 assert.equal(new Set(keys).size,keys.length,'Football league contexts must have unique keys');
 assert.deepEqual([...ids].sort(),approved.map(league=>league.id).sort(),'Football coverage must include every approved league and no extra context');
 for(const expected of approved){
  const actual=directory.leagues.find(league=>league.id===expected.id);
  assert.equal(actual.key,expected.key,'Approved football identity/key binding differs: '+expected.id);
  assert.equal(actual.teamCount,expected.teamCount,'Approved football team count differs: '+expected.id);
  if(expected.refreshPolicy)assert.equal(actual.refreshPolicy,expected.refreshPolicy,'Retained football context must keep its source policy');
 }
 assert(Array.isArray(directory.teams),'Football team contexts must be an array');
 assert.equal(new Set(directory.teams.map(team=>team.id)).size,directory.teams.length,'Football team identities must be unique');
 assert(directory.teams.every(team=>ids.includes(team.leagueId)),'Football team must belong to an approved context');
 for(const league of approved)assert.equal(directory.teams.filter(team=>team.leagueId===league.id).length,league.teamCount,'Approved football context must contain every team: '+league.id);
 return approved;
}
module.exports={approvedLeagues,validate};

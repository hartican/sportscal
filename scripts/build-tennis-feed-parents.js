#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const model=require('../config/tennis-feed');
function build(){
  const catalogue=JSON.parse(fs.readFileSync('data/canonical/tennis-catalogue-2026.json','utf8'));
  let fixtures=JSON.parse(fs.readFileSync('data/follow-schedule/tennis.json','utf8')).fixtures;
  const raw=require('./refresh-us-open-events').fixturesFromSnapshot(JSON.parse(fs.readFileSync('feeds/provider-exports/tennis/us-open-2026-official-schedule.json','utf8')));
  const elimination=new Map(raw.filter(e=>e.eliminatedParticipantIds?.length).map(e=>[e.id,e.eliminatedParticipantIds]));
  fixtures=fixtures.map(e=>elimination.has(e.id)?{...e,eliminatedParticipantIds:elimination.get(e.id)}:e);
  return {schemaVersion:'tennis-feed-parents.v1',contests:require('../data/canonical/tennis-team-contests.v1.json').fixtures,parents:model.buildParents(catalogue,fixtures).map(({childContests,...parent})=>({...parent,sourceParticipantIds:parent.participantIds,contestCount:childContests.length}))};
}
if(require.main===module){
  const content=JSON.stringify(build(),null,2)+'\n',path='data/tennis-feed-parents.v1.json';
  if(process.argv.includes('--check')){if(fs.readFileSync(path,'utf8')!==content)throw new Error('Tennis parent projection is stale');}
  else fs.writeFileSync(path,content);
  console.log('Tennis parent projection verified.');
}
module.exports={build};

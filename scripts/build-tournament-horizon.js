#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),{day,add,inHorizon,structure}=require('./lib/tournament-horizon');
function build(today=day()){
 const formats=require('../data/canonical/tournament-formats.v1.json').formats,tennis=require('../data/canonical/tennis-catalogue-2026.json').tournaments;
 const catalogue=require('../lib/calendar-catalogue').catalogue(),feedIds=new Set(catalogue.map(e=>e.id)),tournaments=new Map(),audit=[];
 for(const name of fs.readdirSync('data/follow-schedule').filter(f=>f.endsWith('.json'))){
  const document=JSON.parse(fs.readFileSync(path.join('data/follow-schedule',name))),fixtures=document.fixtures||[];
  for(const f of fixtures){
   const tournament=f.tournamentId||((f.endDate&&f.endDate!==f.date&&!(f.participantSlots?.length>=2))||['tournament','major_event'].includes(f.kind)?f.id:null);
   audit.push({code:document.code.id,id:f.id,candidate:feedIds.has(f.id),tournament:Boolean(tournament),automaticRule:require('../config/follow-feed-policy').golfMajor(f)?'golf-major':require('../config/follow-feed-policy').aggregateEvent(f)?'event-family-only':'follow-policy'});
   if(!tournament||!inHorizon(f,today)||f.cardType==='golf_session')continue;
   const entry={...f,tournamentId:tournament};
   tournaments.set(tournament,structure(entry,fixtures.filter(x=>x.tournamentId===tournament),formats[tournament]||{}));
  }
  if(document.code.id==='sport:tennis')for(const t of tennis.filter(t=>inHorizon(t,today)))tournaments.set(t.tournamentId,structure({...t,key:'tennis'},fixtures.filter(f=>f.tournamentId===t.tournamentId),formats[t.tournamentId]||{}));
 }
 return {schemaVersion:'tournament-horizon.v1',from:today,through:add(today,27),tournaments:[...tournaments.values()],audit};
}
if(require.main===module){const doc=build(process.env.TOURNAMENT_REFERENCE_DAY||day());fs.writeFileSync('data/tournament-horizon.v1.json',JSON.stringify({...doc,audit:undefined})+'\n');fs.writeFileSync('data/coverage/schedule-feed-audit.json',JSON.stringify({from:doc.from,through:doc.through,entries:doc.audit})+'\n');console.log(`Tournament horizon ${doc.from}–${doc.through}: ${doc.tournaments.length} tournaments, ${doc.audit.length} Schedule fixtures audited.`);}
module.exports={build};

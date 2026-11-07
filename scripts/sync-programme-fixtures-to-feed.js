#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),{fixtures}=require('../lib/competition-fixtures'),identity=require('../config/fixture-identity'),policy=require('../config/follow-feed-policy');
function sync(document){
  // Resolver hydration retains the full programme. Only researched tennis
  // fixtures enter the shared initial payload; individual follows fetch others.
  const authored=new Set(require('../data/editorial-fixture-research.v1.json').entries.map(e=>e.id));
  const programme=fixtures(),tennisIds=new Set(programme.filter(e=>e.key==='tennis').map(e=>e.id));
  const initial=(document.events||[]).filter(e=>!['major-match:nrl-finals-2026:grand-final','major-match-nrl-finals-2026-grand-final'].includes(e.id)).filter(e=>!tennisIds.has(e.id)||authored.has(e.id));
  const events=identity.mergeOverlays(initial,programme.filter(e=>e.key!=='tennis'||authored.has(e.id)));
  return {...document,events:events.map(e=>{
    // Identity normalization supplies empty arrays internally. These two
    // sourced legacy field races have unknown entries, not empty matchups;
    // serialize the original absence without exempting malformed match cards.
    if(['evt_79','evt_80'].includes(e.id)&&e.lemansCalendar===true&&e.cardKind!=='fixture'
      &&/^https:\/\/www\.24h-lemans\.com\//.test(e.sourceUrl||'')
      &&Array.isArray(e.participants)&&e.participants.length===0
      &&Array.isArray(e.participantIds)&&e.participantIds.length===0
      &&!/(?:^|\s)(?:v\.?|vs\.?|versus)(?:\s|$)/i.test(e.name||'')){
      e={...e};delete e.participants;
    }
    return policy.aggregateEvent(e)?{...e,cardKind:'event',kind:'major_event'}:e;
  })};
}
if(require.main===module){for(const file of process.argv.slice(2)){const d=sync(JSON.parse(fs.readFileSync(file)));fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');console.log(`Materialised programme fixtures: ${d.events.length} in ${file}`);}}
module.exports={sync};

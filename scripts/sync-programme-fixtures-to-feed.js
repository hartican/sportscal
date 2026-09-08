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
  return {...document,events:events.map(e=>policy.aggregateEvent(e)?{...e,cardKind:'event',kind:'major_event'}:e)};
}
if(require.main===module){for(const file of process.argv.slice(2)){const d=sync(JSON.parse(fs.readFileSync(file)));fs.writeFileSync(file,JSON.stringify(d,null,2)+'\n');console.log(`Materialised programme fixtures: ${d.events.length} in ${file}`);}}
module.exports={sync};

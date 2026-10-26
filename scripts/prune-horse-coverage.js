'use strict';
// Called by the canonical owner. Never visits profiles, user state or history
// tables; these are source-owned local publication/cache artifacts only.
const fs=require('node:fs'),path=require('node:path'),policy=require('../config/horse-coverage');
const files=['data/editorial-knowledge.v1.json','feeds/incoming/events.json','data/events.json','data/follow-fixtures.v1.json','data/event-overviews.v1.json','data/major-events.v1.json','data/follow-sources/official.v1.json','data/follow-sources/coverage.v1.json','data/discovery/enrichment.v1.json'];
function prune(value,{events=false}={}){
 if(Array.isArray(value))return value.map(v=>prune(v,{events})).filter(v=>v!==null);
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value.eventProjections))value={...value,eventProjections:value.eventProjections.map(p=>({...p,targetIds:p.targetIds.filter(id=>!policy.isHorse({id}))})).filter(p=>p.targetIds.length)};
 if(policy.isHorse(value))return events?null:policy.project(value);
 return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,prune(v,{events})]));
}
function run(root=path.resolve(__dirname,'..')){
 const changed=[];
 for(const name of files){const file=path.join(root,name);if(!fs.existsSync(file))continue;const old=JSON.parse(fs.readFileSync(file)),next=prune(old,{events:name==='data/event-overviews.v1.json'||name==='data/major-events.v1.json'});if(JSON.stringify(next)===JSON.stringify(old))continue;const pretty=name==='data/events.json'||name.startsWith('feeds/');fs.writeFileSync(file,JSON.stringify(next,null,pretty?2:undefined)+'\n');changed.push(name);}
 return changed;
}
if(require.main===module)console.log('Retired horse publication payloads: '+run().join(', '));
module.exports={run,prune};

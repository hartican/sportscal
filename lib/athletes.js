'use strict';
const model=require('../config/athletes'),{expandedFollowEntityIds}=require('./follow-fixture-resolver');
function projection({participants=[],preferences={},events=[]}={}){
 const active=expandedFollowEntityIds({preferences});
 const records=[...participants,...events.flatMap(e=>e.participants||[])];
 const athletes=model.list(records,active),known=new Set(athletes.map(p=>model.identity(p.id)));
 for(const id of active){if(!model.individual(id)||known.has(model.identity(id)))continue;athletes.push({id,sportKey:model.sport({id}),displayName:'Followed athlete'});known.add(model.identity(id));}
 return athletes.map(({id,displayName,canonicalName,name,sportKey,type,profileRef,headshotUrl})=>({id,displayName:displayName||canonicalName||name,sportKey,type:type||'athlete',...(profileRef?{profileRef}:{}),...(headshotUrl?{headshotUrl}:{})}));
}
module.exports={projection};

'use strict';
// Private retained-publisher scope from the actual two-surface patch receipt.
// It grants neither fixture admission nor another source route.
const identities=require('../../lib/epl-provider-identities');
const PREFIX='--epl-updated-ids=';
function validate(ids){
 if(!Array.isArray(ids)||ids.length>760||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||identities.aliasesForId(id).length!==4))throw Error('Invalid EPL publication identity scope');
 return new Set(ids);
}
function parse(argv){
 const args=argv.filter(arg=>arg==='--epl-updated-ids'||arg.startsWith(PREFIX));
 if(!args.length)return null;
 if(args.length!==1||!args[0].startsWith(PREFIX))throw Error('Invalid EPL publication identity selector');
 let ids;try{ids=JSON.parse(args[0].slice(PREFIX.length));}catch{throw Error('Invalid EPL publication identity list');}
 return {arg:args[0],ids:validate(ids)};
}
function selected(event,ids){
 if(!ids.has(event.id))return false;
 if(!identities.binding(event)?.primary)throw Error('EPL publication scope cannot replace an unbound fixture');
 return true;
}
function retain(before,after,ids){
 const originals=new Set(before.filter(e=>selected(e,ids)).map(e=>e.id)),next=new Map();
 for(const event of after){if(!selected(event,ids)||!originals.has(event.id)||next.has(event.id))throw Error('EPL publication cannot admit or duplicate a fixture');next.set(event.id,event);}
 return before.map(event=>{if(!selected(event,ids))return event;const value=next.get(event.id);if(!value)throw Error('EPL publication cannot drop a retained fixture');return value;});
}
module.exports={parse,selected,retain,argument:ids=>{validate(ids);return PREFIX+JSON.stringify(ids);}};

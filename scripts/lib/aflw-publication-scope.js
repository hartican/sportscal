'use strict';
// Exact private receipt for existing AFLW cards, never a new fixture selector.
const bindings=require('./aflw-round-contract').scope.records.filter(row=>row.targetedResult);
const canonical=new Map(bindings.map(row=>[row.id,row]));
const byCardId=new Map(bindings.map(row=>[row.id.replaceAll(':','-'),row]));
const PREFIX='--aflw-updated-ids=';
function binding(card){
 const row=canonical.get(card.canonicalEventId)||byCardId.get(card.id);
 if(!row)return null;
 if(card.key!=='aflw'||card.canonicalEventId!==row.id||card.id!==row.id.replaceAll(':','-')||Date.parse(card.startTimeUtc)!==Date.parse(row.startTimeUtc)||card.participantIds?.length!==2||card.participantIds[0]!==row.homeParticipantId||card.participantIds[1]!==row.awayParticipantId||card.homeParticipantId!==row.homeParticipantId||card.awayParticipantId!==row.awayParticipantId)throw Error('AFLW retained card identity/ordered sides/start mismatch');
 return row;
}
function validate(list){if(!Array.isArray(list)||list.length>10||new Set(list).size!==list.length||list.some(id=>!byCardId.has(id)))throw Error('Invalid AFLW publication scope');return new Set(list);}
function scopes(value){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='data/events.json,feeds/incoming/events.json')throw Error('Invalid AFLW per-surface publication scope');return {incomingIds:validate(value['feeds/incoming/events.json']),ids:validate(value['data/events.json'])};}
function parse(argv){const args=argv.filter(arg=>arg==='--aflw-updated-ids'||arg.startsWith(PREFIX));if(!args.length)return null;if(args.length!==1||!args[0].startsWith(PREFIX)||args[0].length>8192)throw Error('Invalid AFLW publication selector');let value;try{value=JSON.parse(args[0].slice(PREFIX.length));}catch{throw Error('Invalid AFLW publication selector');}return {arg:args[0],...scopes(value)};}
function selected(card,ids){if(!ids.has(card.id))return false;if(!binding(card))throw Error('AFLW publication cannot replace an unbound card');return true;}
function retain(before,after,ids){const original=new Set(before.filter(card=>selected(card,ids)).map(card=>card.id)),next=new Map();for(const card of after){if(!selected(card,ids)||!original.has(card.id)||next.has(card.id))throw Error('AFLW publication cannot admit or duplicate a card');next.set(card.id,card);}return before.map(card=>{if(!selected(card,ids))return card;if(!next.has(card.id))throw Error('AFLW publication cannot drop a retained card');return next.get(card.id);});}
function route(argv){if(!argv.includes('--source=aflw-results'))return;const allowed=new Set(['--quick','--source=aflw-results','--local-only','-p']);if(!argv.includes('--quick')||argv.filter(arg=>arg==='--local-only'||arg==='-p').length!==1||new Set(argv).size!==argv.length||argv.some(arg=>!allowed.has(arg)))throw Error('AFLW result recovery requires only --quick --source=aflw-results and one local-only flag; no source work ran');}
module.exports={route,binding,parse,selected,retain,argument:value=>{scopes(value);return PREFIX+JSON.stringify(value);}};

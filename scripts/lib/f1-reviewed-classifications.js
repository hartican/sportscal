'use strict';
// Current individually reviewed session witnesses, never a future field-size rule.
const witness=require('../fixtures/f1-reviewed-classifications-20261031.json');
const byCanonical=new Map(witness.records.map(row=>[row.canonicalEventId,row]));
const normal=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
function forEvent(event){
 const row=byCanonical.get(event.canonicalEventId);
 if(!row)return null;
 if(event.key!=='f1'||event.id!==row.id||Date.parse(event.startTimeUtc)!==Date.parse(row.startTimeUtc))throw Error('F1 retained fixture identity/start disagrees with its reviewed session');
 return row;
}
function deferral(event){return {id:event.id,canonicalEventId:event.canonicalEventId,reason:witness.deferrals.find(row=>row.canonicalEventId===event.canonicalEventId)?.reason||'No individually reviewed complete session classification',nextAction:'Review this session through the existing F1 source owner; retained last-good facts and clocks'};}
function check(row,url,html,rows,columns){
 if(url!==row.url)throw Error('F1 index-derived GP/session URL disagrees with reviewed identity');
 const headings=[...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];
 if(headings.length!==1||normal(headings[0][1].replace(/<[^>]*>/g,''))!==normal(row.heading))return 'Official heading does not bind the reviewed GP/year/session';
 const bodies=[...html.matchAll(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi)];
 if(bodies.length!==1||[...html.matchAll(/<tbody\b/gi)].length!==1||rows.length!==row.field.length||[...bodies[0][1].matchAll(/<tr\b/gi)].length!==rows.length)return 'Incomplete or ambiguous official session classification';
 for(let i=0;i<rows.length;i++){
  const value=rows[i],expected=row.field[i];
  if(value.length!==columns||value[0]!==expected.position||value[1]!==expected.number||normal(value[2])!==normal(expected.driver)||normal(value[3])!==normal(expected.team))return 'Official entry/position/status set differs from the reviewed complete session';
  if(!/^\d+$/.test(value.at(-1))&&!row.canonicalEventId.endsWith(':race'))return 'Official session lap count is incomplete';
  if(expected.finish){if(!/^\d+$/.test(value[4])||!/^\d+(?:\.\d+)?$/.test(value[6])||(expected.finish==='DNF'?value[5]!=='DNF':!/^(?:\d+:)?\d+:\d{2}\.\d{3}$|^\+\d+(?:\.\d+)?s$|^\+\d+ laps?$/.test(value[5])))return 'Official race timing/classification status is incomplete';}
  else if(columns===6&&!/^\d+:\d{2}\.\d{3}$|^\+\d+(?:\.\d+)?s$/.test(value[4]))return 'Official practice timing is incomplete';
  else if(columns===8&&(!/^\d+:\d{2}\.\d{3}$/.test(value[4])||value.slice(5,7).some(time=>time!==''&&!/^\d+:\d{2}\.\d{3}$/.test(time))))return 'Official qualifying timing is incomplete';
 }
 return null;
}
module.exports={forEvent,deferral,check,records:witness.records};

'use strict';
// A shared document rebuild is not an observation of every participant source.
function participantObservation(record,sources,now=Date.now()){
 const valid=value=>{
  if(typeof value!=='string')return false;
  const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/);if(!m)return false;
  const day=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  return day.getUTCFullYear()===Number(m[1])&&day.getUTCMonth()+1===Number(m[2])&&day.getUTCDate()===Number(m[3])&&Number.isFinite(Date.parse(value))&&Date.parse(value)<=Number(now);
 };
 if(record.sourceCheckedAt!==undefined&&record.sourceCheckedAt!==null)return valid(record.sourceCheckedAt)?record.sourceCheckedAt:null;
 const ids=[...new Set(record.sourceIds||[])];if(!ids.length)return null;
 const observations=ids.map(id=>sources?.[id]?.checkedAt);
 if(!observations.every(valid)||new Set(observations).size!==1)return null;
 return observations[0];
}
module.exports={participantObservation};

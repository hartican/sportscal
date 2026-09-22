'use strict';
module.exports=function filterRatings(rows,userId,{crowdAllowed=true}={}){
 const latest=new Map();
 for(const row of rows){const phase=row.phase,owner=row.userId||row.user_id;if(row.demo||row.modelled||row.moderation_flag||!owner||!['heat','pulse','impact'].includes(phase))continue;
  const value=Number(row.rating);if(!Number.isFinite(value)||value<1||value>5)continue;
  const key=owner+'|'+phase,at=Date.parse(row.updatedAt||row.updated_at||row.created_at||0)||0;
  if(!latest.has(key)||at>=latest.get(key).at)latest.set(key,{owner,phase,value,at});
 }
 const own=[...latest.values()].filter(r=>r.owner===userId).map(r=>r.value),means=[];
 if(crowdAllowed)for(const phase of ['heat','pulse','impact']){const peers=[...latest.values()].filter(r=>r.owner!==userId&&r.phase===phase);if(peers.length)means.push(peers.reduce((a,r)=>a+r.value,0)/peers.length);}
 return {personal:own.length?Math.max(...own):null,crowd:means.length?Math.max(...means):null};
};

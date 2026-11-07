(function(root,factory){const api=factory();root.NOTHINGSPORTS_FEED_VIEW_FILTER=api;if(typeof module!=='undefined')module.exports=api;})(globalThis,function(){
 'use strict';
 const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=5;
 function score(snapshot,legacy=null){
  const exact=snapshot?.filterRatings;
  if(exact){if(valid(exact.personal))return exact.personal;if(valid(legacy))return legacy;return valid(exact.crowd)?exact.crowd:null;}
  const own=Object.values(snapshot?.currentUser?.submissions||{}).map(x=>Number(x?.rating));
  if(snapshot?.currentUser?.contribution)own.push(Number(snapshot.currentUser.contribution.rating));
  if(valid(legacy))own.push(legacy);
  const personal=own.filter(valid);if(personal.length)return Math.max(...personal);
  // Only server-provided unrounded real averages are usable for thresholds.
  const crowd=Object.values(snapshot?.aggregates||{}).filter(x=>x?.ratingCount>0).map(x=>x.average).filter(valid);
  return crowd.length?Math.max(...crowd):null;
 }
 function matches(snapshot,minimum=0,legacy=null){if(!minimum)return true;const rating=score(snapshot,legacy);return rating!==null&&rating>=minimum;}
 return {score,matches};
});

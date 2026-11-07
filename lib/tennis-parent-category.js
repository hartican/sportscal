'use strict';
// Carry the explicit category of team ties into their parent; unknown or mixed evidence stays unknown.
function teamParentCategory(parent){
  if(parent.tour!=='TEAM'||parent.gender||!parent.childContests?.length)return parent;
  const genders=new Set(parent.childContests.map(contest=>contest.gender));
  if(genders.size!==1||!['men','women'].includes([...genders][0]))return parent;
  return {...parent,gender:[...genders][0]};
}
module.exports={teamParentCategory};

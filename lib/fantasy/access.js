'use strict';
function access(environment=process.env){
  const approved=environment.FANTASY_FPL_ACCESS_APPROVED==='true';
  const evaluation=environment.FANTASY_FPL_EVALUATION_ENABLED==='true';
  const enabled=environment.FANTASY_FPL_ENABLED==='true'&&(approved||evaluation);
  return {enabled,accessStatus:enabled?(approved?'approved':'evaluation'):'disabled'};
}
module.exports={access};

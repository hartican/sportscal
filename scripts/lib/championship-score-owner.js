'use strict';
// Modifier of the existing Championship canonical owner, not a second refresh.
module.exports=require('./scoped-football-score-owner').createOwner({
 contract:require('./championship-score-contract'),source:require('./championship-source-json'),label:'Championship',mode:'championship-results-only',key:'australian-championship',selector:'--championship-results-ids=',
 validationSteps:[['scripts/build-follow-directories.js','--codes=football','--check'],['scripts/validate-australian-championship.js'],['scripts/validate-australian-championship-integration.js'],['scripts/validate-fixtures-contract.js'],['scripts/validate-follow-decisions.js'],['scripts/validate-follow-policy-parity.js'],['scripts/validate-backend-efficiency.js'],['scripts/build-app-shell-runtime.js','--check'],['scripts/validate-feed-performance.js']]
});

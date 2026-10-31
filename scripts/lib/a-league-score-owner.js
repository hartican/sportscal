'use strict';
// Existing canonical owner uses shared containment; no additional entrypoint.
module.exports=require('./scoped-football-score-owner').createOwner({
 contract:require('./a-league-score-contract'),source:require('./a-league-source-json'),label:'A-League',mode:'a-league-results-only',key:'a-league-men',selector:'--a-league-results-ids=',
 validationSteps:[['scripts/build-follow-directories.js','--codes=football','--check'],['scripts/validate-a-league-schedule.js'],['scripts/validate-fixtures-contract.js'],['scripts/validate-follow-decisions.js'],['scripts/validate-follow-policy-parity.js'],['scripts/validate-backend-efficiency.js'],['scripts/build-app-shell-runtime.js','--check'],['scripts/validate-feed-performance.js']]
});

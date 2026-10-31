'use strict';
// Existing one-resource compiled wrapper; transport contract and limits unchanged.
const {createSingleReader,strictJson}=require('./bounded-source-json');
const {scope}=require('./a-league-score-contract');
const LIMITS=Object.freeze({requests:1,resourceMs:15000,ownerMs:90000,cleanupMs:10000,encodedBytes:1048576,decodedBytes:1048576});
function createReader(options={}){return createSingleReader({...options,url:scope.sourceUrl,userAgent:'NothingSport-canonical-a-league-scores/1.0',label:'A-League',LIMITS});}
module.exports={createReader,strictJson,LIMITS};

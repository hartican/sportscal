'use strict';
// Compatibility entry point; qualification has one shared implementation.
const api=require('./reviewed-calendar-notes');
if(require.main===module)try{console.log(JSON.stringify(api.applyRetained({selectedIds:api.surfIds})));}catch(e){console.error(e.message);process.exitCode=1;}
module.exports=api;

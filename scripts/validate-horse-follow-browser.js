'use strict';
const suite=require('./validate-melbourne-cup-browser');
if(require.main===module)suite.main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={openSport:suite.openSport};

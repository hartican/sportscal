'use strict';
const fs=require('node:fs');
async function refresh(){const report=await require('../lib/tennis-scoreboard').refresh();if(process.env.TENNIS_SOURCE_REPORT)fs.writeFileSync(process.env.TENNIS_SOURCE_REPORT,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));return report;}
if(require.main===module)refresh().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={refresh};

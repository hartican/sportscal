'use strict';
// Invoked by the canonical update-cards owner; no independent scheduled task.
require('../lib/mlb-postseason').refresh().then(report=>console.log(JSON.stringify(report))).catch(error=>{console.error(error.message);process.exitCode=1;});

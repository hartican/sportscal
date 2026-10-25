'use strict';
// Detailed fields were retired. Keep the historic QA entrypoint on the new public contract.
require('./validate-melbourne-cup-browser').main().catch(error=>{console.error(error);process.exitCode=1;});

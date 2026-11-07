'use strict';

// The same policy steps serve synchronous tools and cooperative API requests.
// API yields let ready database responses and their deadlines run between batches.
module.exports=function runFeedSteps(steps,cooperative=false){
  if(cooperative)return (async()=>{
    for(let step=steps.next();;step=steps.next()){
      if(step.done)return step.value;
      await new Promise(resolve=>setImmediate(resolve));
    }
  })();
  for(let step=steps.next();;step=steps.next())if(step.done)return step.value;
};

"use strict";
const policy=require('../../config/follow-feed-policy');
// A research workload, not a fixture rating or an admission threshold. Legacy
// projection.stakes is read only when validating archived v1 editorial records.
function researchDepthFor(record){
  return ['major_event','tournament'].includes(record?.kind)||policy.isMarquee(record)?5:2;
}
module.exports={researchDepthFor};

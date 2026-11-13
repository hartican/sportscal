'use strict';
const server=require('./nothingscore-server');
const {supabaseServiceRequest}=require('./supabase-server');
async function submit(userId,eventId,phase,rating,event,now=new Date()){
  const exact=Boolean(event?.startTimeUtc)&&(!event?.timePrecision||event.timePrecision==='exact');
  const labels=require('../config/fixture-labels');
  const completed=/^(completed|finished|final|cancelled|canceled|abandoned)$/.test(String(event.status||''));
  const end=completed?(event.actualEndTimeUtc||event.completedAt||event.resultPublishedAt||now.toISOString()):event.endTimeUtc;
  const receipt=await supabaseServiceRequest('/rest/v1/rpc/nothingsports_rate_v2',{method:'POST',body:{target_user_id:userId,target_event_id:eventId,target_phase:phase,target_rating:rating,fixture_start:exact?event.startTimeUtc:null,fixture_end:end,fixture_status:String(event.status||'').toLowerCase(),fixture_sport:labels.sport(event),fixture_gender:labels.gender(event)}});
  return require('./epic-classics').afterRating(event,{...receipt,rating,phase});
}
module.exports={submit};

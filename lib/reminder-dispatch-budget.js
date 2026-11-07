'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
function budget({request=supabaseServiceRequest,clock=Date.now,limitMs=27000}={}){
 const deadline=clock()+limitMs,remaining=()=>deadline-clock();
 const boundedRequest=(path,options={})=>{
  const left=remaining();if(left<250)throw Object.assign(Error('Notification request deadline reached'),{status:503,code:'dispatch_deadline'});
  return request(path,{...options,timeoutMs:Math.min(options.timeoutMs||3000,3000,left)});
 };
 const send=transport=>(subscription,payload,options={})=>{
  const left=remaining();if(left<250)throw Object.assign(Error('Notification deferred before provider contact'),{statusCode:503,code:'notification_send_not_started'});
  return transport(subscription,payload,{...options,timeout:Math.min(options.timeout||3000,3000,left)});
 };
 return {request:boundedRequest,send,remaining};
}
async function workers(items,operation,concurrency=2){
 let cursor=0;
 const outcomes=await Promise.allSettled(Array.from({length:Math.min(concurrency,items.length)},async()=>{while(cursor<items.length){const item=items[cursor++];await operation(item);}}));
 const failed=outcomes.find(r=>r.status==='rejected');if(failed)throw failed.reason;
}
module.exports={budget,workers};

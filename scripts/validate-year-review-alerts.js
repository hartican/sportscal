'use strict';
const assert=require('node:assert/strict'),{dispatch}=require('../lib/year-review-alerts');
async function scenario({globalOff=false,annualOff=false,permission='granted',failure=null,checksFail=false}={}){
 let row={user_id:'account',installation_id:'installation',year:2026,attempts:0,status:'pending'},calls=0,provider=0,checks=0;
 const request=async(url,options)=>{calls++;if(url.includes('prepare_year_reviews'))return{};if(url.includes('year_review_deliveries')){if(!options)return row.status==='pending'?[{...row}]:[];if(options.body.status==='sending'&&row.status!=='pending')return[];row={...row,...options.body};return[{...row}];}
  if(url.includes('classic_settings')){checks++;if(checksFail)throw Error('source failure');return[{year_review_enabled:!annualOff}];}
  if(url.includes('user_state'))return[{preferences:{followFirst:{notifications:{enabled:!globalOff}}}}];if(url.includes('push_installations'))return[{permission}];
  if(url.includes('begin_notification_send'))return{leaseId:'lease',subscription:{}};if(url.includes('notification_send_leases'))return{};throw Error('unexpected request');};
 const send=async(_,payload)=>{provider++;assert(!/score|won|lost|winner|result|2–0/i.test(payload),'invitation has no sporting spoiler');if(failure)throw failure;return{};},now=new Date('2026-12-27T00:00Z');
 const first=await dispatch({now,request,send}),second=await dispatch({now,request,send});return{first,second,row,calls,provider,checks};
}
(async()=>{
 let calls=0;await dispatch({now:new Date('2027-01-01'),request:async()=>{calls++;},send:async()=>{throw Error();}});assert.equal(calls,0,'off-season makes no database/provider request');
 const good=await scenario();assert.equal(good.provider,1);assert.equal(good.row.status,'sent');assert.equal(good.second.sent,0);
 for(const options of [{globalOff:true},{annualOff:true},{permission:'denied'}]){const r=await scenario(options);assert.equal(r.provider,0);assert.equal(r.row.status,'suppressed');}
 const uncertain=await scenario({failure:Error('connection lost after contact')});assert.equal(uncertain.provider,1);assert.equal(uncertain.row.status,'uncertain','uncertain contact cannot replay');
 const rejected=await scenario({failure:Object.assign(Error('provider rejected'),{statusCode:503})});assert.equal(rejected.provider,2);assert.equal(rejected.row.status,'pending','confirmed rejection has bounded retry eligibility');
 const configuration=await scenario({checksFail:true});assert.equal(configuration.provider,0);assert.equal(configuration.row.status,'pending','failure before contact does not strand sending forever');
 console.log('Year review delivery: off-season quiet, account/installation deduplication, global/annual/device opt-outs, spoiler safety and uncertain-contact rejection passed.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});

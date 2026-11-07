'use strict';
const {supabaseServiceRequest}=require('./supabase-server');
const API_LIMITS=Object.freeze({search:90,ordinary:500});
const SCHEDULED_SEARCH_LIMIT=50;
async function reserveApiQuota(bucket,{sourceToken=null,request=supabaseServiceRequest,environment=process.env,timeoutMs=3000}={}){
  if(!Object.hasOwn(API_LIMITS,bucket))return {granted:false,code:'quota_limit'};
  return request('/rest/v1/rpc/nothingsports_reserve_youtube_quota',{method:'POST',body:{p_bucket:bucket,p_source_token:sourceToken},environment,timeoutMs});
}
module.exports={API_LIMITS,SCHEDULED_SEARCH_LIMIT,reserveApiQuota};
